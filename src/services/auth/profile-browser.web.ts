import {Cookie, CookieJar} from 'tough-cookie';
import {AdditionalAuthenticationRequired, AuthError, validateUrl} from './protocol';

export async function profileBrowser(
    kind: 'render' | 'challenge',
    url: string,
    target: string,
    jar: CookieJar,
    signal: AbortSignal,
) {
    const targetUrl = validateUrl(target);
    if (
        !['my.fudan.edu.cn', 'fdjwgl.fudan.edu.cn', 'yjsxk.fudan.edu.cn'].includes(
            new URL(targetUrl).hostname,
        )
    )
        throw new AuthError('学校服务会话已失效，请重试。');
    const response = await fetch('/__school__/profile', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            kind,
            url: validateUrl(url),
            target: targetUrl,
            cookies: jar.serializeSync()!.cookies.flatMap((value) => {
                const cookie = Cookie.fromJSON(value);
                if (!cookie) throw new AuthError('学校服务会话已失效，请重试。');
                const expires = cookie.expiryTime() ?? Infinity;
                if (expires <= Date.now()) return [];
                return [
                    {
                        key: cookie.key,
                        value: cookie.value,
                        domain: cookie.domain,
                        path: cookie.path || '/',
                        hostOnly: cookie.hostOnly === true,
                        secure: cookie.secure,
                        httpOnly: cookie.httpOnly,
                        ...(cookie.sameSite ? {sameSite: cookie.sameSite} : {}),
                        ...(Number.isFinite(expires) ? {expires: new Date(expires).toISOString()} : {}),
                    },
                ];
            }),
        }),
        signal,
    });
    let result;
    try {
        result = await response.json();
    } catch {
        throw new AuthError('无法连接消息偏好服务，请重试或重启应用。');
    }
    if (!response.ok || !result?.ok) {
        if (typeof result?.loginUrl === 'string')
            throw new AdditionalAuthenticationRequired(result.loginUrl, targetUrl);
        throw new AuthError(result?.error || '无法连接消息偏好服务，请重试或重启应用。');
    }
    signal.throwIfAborted();
    const data = result.data;
    if (!Array.isArray(data?.cookies) || (data.html !== null && typeof data.html !== 'string'))
        throw new AuthError('无法连接消息偏好服务，请重试或重启应用。');
    for (const cookie of data.cookies) await jar.setCookie(cookie.cookie, validateUrl(cookie.url));
    return {jar, html: data.html as string | null};
}
