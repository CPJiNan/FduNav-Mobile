import {CookieJar} from 'tough-cookie';
import type {AccountState, LoginInput} from '../../shared/accounts';
import type {MessagePreferences} from '../../shared/message-preferences';
import {
    AdditionalAuthenticationRequired,
    authenticate,
    AuthError,
    isAuthUrl,
    validateUrl,
    verifySession,
} from './protocol';
import {type HttpFetch, SchoolTransport} from './transport';
import {syncPreferences} from './profile';

export interface SavedSession {
    username: string;
    lastLogin: string;
    target: string;
    cookies: NonNullable<ReturnType<CookieJar['serializeSync']>>;
}

export interface SessionStorage {
    available?(): Promise<boolean>;

    load(): Promise<SavedSession | null>;

    save(value: SavedSession): Promise<void>;

    clear(): Promise<void>;
}

export interface SessionBrowser {
    challenge(
        error: AdditionalAuthenticationRequired,
        jar: CookieJar,
        signal: AbortSignal,
    ): Promise<CookieJar>;

    render(url: string, jar: CookieJar, signal: AbortSignal): Promise<string | null>;

    clear(): Promise<void>;

    open?(url: string, jar: CookieJar, signal: AbortSignal): Promise<void>;
}

const signedOut = (): AccountState => ({
    username: null,
    status: 'signed-out',
    lastLogin: null,
    message: '',
});

export class AccountSession {
    state: AccountState = signedOut();
    private jar: CookieJar | null = null;
    private target = '';
    private listeners = new Set<() => void>();
    private generation = 0;
    private pending = Promise.resolve();
    private controller = new AbortController();

    constructor(
        private deps: {
            fetch: HttpFetch;
            storage: SessionStorage;
            browser: SessionBrowser;
            encrypt: (password: string, key: string) => string;
        },
    ) {
    }

    subscribe = (listener: () => void) => {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    };
    snapshot = () => this.state;

    async initialize() {
        return this.exclusive(async () => {
            try {
                const saved = await this.deps.storage.load();
                if (!saved) return;
                validateUrl(saved.target);
                if (!saved.username || saved.username.length > 128 || !saved.lastLogin) throw new Error();
                this.jar = CookieJar.deserializeSync(saved.cookies);
                for (const cookie of this.jar.serializeSync()!.cookies)
                    validateUrl('https://' + String(cookie.domain).replace(/^\./, '') + '/');
                this.target = saved.target;
                this.publish({
                    username: saved.username,
                    lastLogin: saved.lastLogin,
                    status: 'unverified',
                    message: '登录已过期，请验证会话或重新登录。',
                });
            } catch {
                this.jar = null;
                this.publish({
                    username: null,
                    lastLogin: null,
                    status: 'expired',
                    message: '本地会话无法解密，请重新登录。',
                });
            }
        });
    }

    async login(input: LoginInput) {
        return this.exclusive(async () => {
            if (
                !input ||
                typeof input.username !== 'string' ||
                !input.username.trim() ||
                input.username.length > 128 ||
                typeof input.password !== 'string' ||
                !input.password ||
                input.password.length > 1024
            )
                throw new AuthError('请输入有效的学号和密码。');
            if (this.deps.storage.available && !(await this.deps.storage.available()))
                throw new AuthError('系统安全存储不可用，暂时无法安全保存登录会话。');
            const generation = this.generation;
            const username = input.username.trim();
            this.controller = new AbortController();
            const timer = setTimeout(() => this.controller.abort(), 90000);
            let jar = new CookieJar();
            let target: string;
            try {
                await this.deps.browser.clear();
                try {
                    target = await authenticate(
                        this.transport(jar),
                        username,
                        input.password,
                        this.deps.encrypt,
                    );
                } catch (error) {
                    if (!(error instanceof AdditionalAuthenticationRequired)) throw error;
                    input.password = '';
                    clearTimeout(timer);
                    jar = await this.deps.browser.challenge(error, jar, this.controller.signal);
                    target = error.target;
                    if (!(await verifySession(this.transport(jar), target)))
                        throw new AuthError('认证后未能建立目标网站会话，请重新登录。');
                }
                if (generation !== this.generation || this.controller.signal.aborted)
                    throw new AuthError('已取消学校身份验证。');
                const next: AccountState = {
                    username,
                    lastLogin: new Date().toISOString(),
                    status: 'signed-in',
                    message: '已登录复旦统一身份认证。',
                };
                await this.deps.storage.save({
                    username,
                    lastLogin: next.lastLogin!,
                    target,
                    cookies: jar.serializeSync()!,
                });
                if (generation !== this.generation) {
                    await this.deps.storage.clear();
                    throw new AuthError('已取消学校身份验证。');
                }
                this.jar = jar;
                this.target = target;
                this.publish(next);
                return this.state;
            } finally {
                input.password = '';
                clearTimeout(timer);
                await this.deps.browser.clear().catch(() => {
                });
            }
        });
    }

    async verify() {
        return this.exclusive(async () => {
            if (!this.jar || !this.state.username) throw new AuthError('请先登录账号。');
            const generation = this.generation;
            this.controller = new AbortController();
            try {
                const valid = await verifySession(this.transport(), this.target);
                if (generation !== this.generation) throw new AuthError('账号已变化，请重新发起请求。');
                if (valid) {
                    await this.persist();
                    if (generation !== this.generation) throw new AuthError('账号已变化，请重新发起请求。');
                    this.publish({...this.state, status: 'signed-in', message: '会话有效。'});
                } else {
                    this.jar = null;
                    await this.deps.storage.clear();
                    if (generation !== this.generation) throw new AuthError('账号已变化，请重新发起请求。');
                    this.publish({...this.state, status: 'expired', message: '登录已过期，请重新登录。'});
                }
                return this.state;
            } catch (error) {
                if (generation !== this.generation) throw error;
                this.publish({
                    ...this.state,
                    status: 'unverified',
                    message: '暂时无法验证会话，请检查网络后重试。',
                });
                throw error;
            }
        });
    }

    async logout() {
        this.generation++;
        this.controller.abort();
        this.jar = null;
        this.target = '';
        this.publish(signedOut());
        await this.pending.catch(() => {
        });
        await this.deps.storage.clear();
        await this.deps.browser.clear();
    }

    async readPage(url: string) {
        return this.exclusive(async () => {
            if (this.state.status !== 'signed-in' || !this.jar) throw new AuthError('请先登录账号。');
            const generation = this.generation;
            const page = await this.transport().request(validateUrl(url));
            if (generation !== this.generation) throw new AuthError('账号已变化，请重新发起请求。');
            if (isAuthUrl(page.url)) {
                this.jar = null;
                await this.deps.storage.clear();
                this.publish({...this.state, status: 'expired', message: '登录已过期，请重新登录。'});
                throw new AuthError('登录已过期，请重新登录。');
            }
            await this.persist();
            return page;
        });
    }

    async readBinary(url: string, referer?: string) {
        return this.exclusive(async () => {
            if (this.state.status !== 'signed-in' || !this.jar) throw new AuthError('请先登录账号。');
            const generation = this.generation;
            const data = await this.transport().download(url, referer);
            if (generation !== this.generation) throw new AuthError('账号已变化，请重新发起请求。');
            if (isAuthUrl(data.url)) throw new AuthError('登录已过期，请重新登录。');
            await this.persist();
            return data;
        });
    }

    async servicePage(url: string, interactive = true, rendered = false) {
        return this.exclusive(async () => {
            if (this.state.status !== 'signed-in' || !this.jar) throw new AuthError('请先登录账号。');
            const generation = this.generation;
            try {
                let page = await this.transport().request(validateUrl(url));
                if (isAuthUrl(page.url)) {
                    if (!interactive) throw new AuthError('校园卡需要身份验证，请点击刷新后完成验证。');
                    this.jar = await this.deps.browser.challenge(
                        new AdditionalAuthenticationRequired(page.url, url),
                        this.jar,
                        this.controller.signal,
                    );
                    page = await this.transport().request(url);
                }
                if (generation !== this.generation) throw new AuthError('账号已变化，请重新发起请求。');
                if (isAuthUrl(page.url) || new URL(page.url).origin !== new URL(url).origin)
                    throw new AuthError('学校服务会话已失效，请重试。');
                let html: string | null = null;
                if (rendered) {
                    try {
                        html = await this.deps.browser.render(url, this.jar, this.controller.signal);
                    } catch (error) {
                        if (!(error instanceof AdditionalAuthenticationRequired)) throw error;
                        if (!interactive) throw new AuthError('校园卡需要身份验证，请点击刷新后完成验证。');
                        this.jar = await this.deps.browser.challenge(error, this.jar, this.controller.signal);
                        if (generation !== this.generation) throw new AuthError('账号已变化，请重新发起请求。');
                        html = await this.deps.browser.render(url, this.jar, this.controller.signal);
                    }
                }
                if (generation !== this.generation) throw new AuthError('账号已变化，请重新发起请求。');
                await this.persist();
                return html || page.text;
            } finally {
                await this.deps.browser.clear().catch(() => {
                });
            }
        });
    }

    async openPage(url: string) {
        return this.exclusive(async () => {
            if (this.state.status !== 'signed-in' || !this.jar) throw new AuthError('请先登录账号。');
            if (!this.deps.browser.open) throw new AuthError('无法打开学校页面，请重试。');
            try {
                await this.deps.browser.open(validateUrl(url), this.jar, this.controller.signal);
            } finally {
                await this.deps.browser.clear().catch(() => {
                });
            }
        });
    }

    async preferences(existing: MessagePreferences) {
        return this.exclusive(async () => {
            if (this.state.status !== 'signed-in' || !this.jar) throw new AuthError('请先登录账号。');
            const generation = this.generation;
            const read = async (url: string) => {
                let page = await this.transport().request(url);
                if (isAuthUrl(page.url)) {
                    this.jar = await this.deps.browser.challenge(
                        new AdditionalAuthenticationRequired(page.url, url),
                        this.jar!,
                        this.controller.signal,
                    );
                    page = await this.transport().request(url);
                }
                if (isAuthUrl(page.url) || new URL(page.url).origin !== new URL(url).origin)
                    throw new AuthError('学校服务会话已失效，请重试。');
                return page.text;
            };
            try {
                const render = async () => {
                    const url = 'https://my.fudan.edu.cn/';
                    try {
                        return await this.deps.browser.render(url, this.jar!, this.controller.signal);
                    } catch (error) {
                        if (!(error instanceof AdditionalAuthenticationRequired)) throw error;
                        this.jar = await this.deps.browser.challenge(error, this.jar!, this.controller.signal);
                        if (generation !== this.generation) throw new AuthError('账号已变化，请重新发起请求。');
                        return this.deps.browser.render(url, this.jar, this.controller.signal);
                    }
                };
                const value = await syncPreferences(existing, read, render);
                if (generation !== this.generation) throw new AuthError('账号已变化，请重新发起请求。');
                await this.persist();
                return value;
            } finally {
                await this.deps.browser.clear().catch(() => {
                });
            }
        });
    }

    private publish(value: AccountState) {
        this.state = value;
        for (const fn of this.listeners) fn();
    }

    private transport(jar = this.jar) {
        return new SchoolTransport(this.deps.fetch, jar ?? new CookieJar(), this.controller.signal);
    }

    private exclusive<T>(work: () => Promise<T>): Promise<T> {
        const generation = this.generation;
        const operation = this.pending
            .catch(() => {
            })
            .then(async () => {
                if (generation !== this.generation) throw new AuthError('账号已变化，请重新发起请求。');
                return work();
            });
        this.pending = operation.then(
            () => {
            },
            () => {
            },
        );
        return operation;
    }

    private async persist() {
        if (!this.jar || !this.state.username || !this.state.lastLogin)
            throw new AuthError('请先登录账号。');
        await this.deps.storage.save({
            username: this.state.username,
            lastLogin: this.state.lastLogin,
            target: this.target,
            cookies: this.jar.serializeSync()!,
        });
    }
}
