import {Platform} from 'react-native';
import CookieManager from '@preeternal/react-native-cookie-manager';
import {Cookie, CookieJar} from 'tough-cookie';
import {validateUrl} from './protocol';

const options = {iosCookieStore: 'webKit' as const};
let mutations = Promise.resolve();

function mutate(work: () => Promise<void>) {
    const result = mutations.catch(() => {
    }).then(work);
    mutations = result.catch(() => {
    });
    return result;
}

export function clearSchoolCookies() {
    return mutate(clearCookies);
}

async function clearCookies() {
    await CookieManager.clearAll(options);
    if (Platform.OS === 'ios') await CookieManager.clearAll();
}

export function seedSchoolCookies(jar: CookieJar) {
    return mutate(() => seedCookies(jar));
}

async function seedCookies(jar: CookieJar) {
    await clearCookies();
    for (const value of jar.serializeSync()!.cookies) {
        const cookie = Cookie.fromJSON(value);
        if (!cookie?.domain) continue;
        const url = validateUrl('https://' + cookie.domain.replace(/^\./, '') + (cookie.path || '/'));
        const expires = cookie.expiryTime() ?? Infinity;
        if (expires <= Date.now()) continue;
        await CookieManager.set(
            url,
            {
                name: cookie.key,
                value: cookie.value,
                path: cookie.path || '/',
                ...(!cookie.hostOnly ? {domain: '.' + cookie.domain.replace(/^\./, '')} : {}),
                secure: cookie.secure,
                httpOnly: cookie.httpOnly,
                ...(Number.isFinite(expires) ? {expires: new Date(expires).toISOString()} : {}),
                ...(cookie.sameSite ? {sameSite: cookie.sameSite as 'lax' | 'strict' | 'none'} : {}),
            },
            options,
        );
    }
}

export async function collectSchoolCookies(
    previous: CookieJar,
    urls: string[],
): Promise<CookieJar> {
    const jar = CookieJar.deserializeSync(previous.serializeSync()!);
    const groups =
        Platform.OS === 'ios'
            ? [{url: '', cookies: await CookieManager.getAllAsArray(options)}]
            : await Promise.all(
                [...new Set(urls)].map(async (url) => ({
                    url,
                    cookies: await CookieManager.getAsArray(validateUrl(url), options),
                })),
            );
    for (const group of groups)
        for (const value of group.cookies) {
            const domain =
                value.domain?.replace(/^\./, '') || (group.url ? new URL(group.url).hostname : '');
            if (!domain) continue;
            let url: string;
            try {
                url = validateUrl('https://' + domain + (value.path || '/'));
            } catch {
                continue;
            }
            const cookie = new Cookie({
                key: value.name,
                value: value.value,
                ...(value.domain?.startsWith('.') ? {domain} : {}),
                path: value.path || '/',
                secure: value.secure,
                httpOnly: value.httpOnly,
                ...(value.expires ? {expires: new Date(value.expires)} : {}),
                ...(value.sameSite ? {sameSite: value.sameSite} : {}),
            });
            await jar.setCookie(cookie, url);
        }
    return jar;
}
