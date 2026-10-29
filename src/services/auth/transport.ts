import { CookieJar } from 'tough-cookie';
import { AuthError, validateUrl, type Page, type Transport } from './protocol';
export interface HttpResponse {
  status: number;
  headers: { get: (name: string) => string | null; getSetCookie?: () => string[] };
  text: () => Promise<string>;
  arrayBuffer?: () => Promise<ArrayBuffer>;
  body?: { cancel: () => Promise<void> } | null;
}
export type HttpFetch = (
  url: string,
  init: {
    method: string;
    body?: string;
    headers: Record<string, string>;
    redirect: 'manual';
    credentials: 'omit';
    signal: AbortSignal;
  },
) => Promise<HttpResponse>;

export function responseCookies(headers: HttpResponse['headers']): string[] {
  const values = headers.getSetCookie?.();
  if (values?.length) return values;
  return (headers.get('set-cookie') || '')
    .split(/,(?=\s*[^=;,\s]+\s*=)/)
    .map((s) => s.trim())
    .filter(Boolean);
}
export class SchoolTransport implements Transport {
  constructor(
    readonly fetch: HttpFetch,
    readonly jar = new CookieJar(),
    readonly signal: AbortSignal = new AbortController().signal,
  ) {}
  async request(value: string, payload?: Record<string, unknown>, form = false): Promise<Page> {
    const start = validateUrl(value);
    for (let attempt = 0; attempt < (payload ? 1 : 3); attempt++) {
      try {
        let url = start;
        let body = payload
          ? form
            ? new URLSearchParams(payload as Record<string, string>).toString()
            : JSON.stringify(payload)
          : undefined;
        for (let redirects = 0; redirects < 12; redirects++) {
          const headers: Record<string, string> = { 'User-Agent': 'Mozilla/5.0 FduNav/0.1' };
          const cookie = await this.jar.getCookieString(url);
          if (cookie) headers.Cookie = cookie;
          if (body)
            Object.assign(headers, {
              'Content-Type': form ? 'application/x-www-form-urlencoded' : 'application/json',
              Origin: 'https://id.fudan.edu.cn',
              Referer: 'https://id.fudan.edu.cn/ac/',
            });
          const timeout = new AbortController();
          const abort = () => timeout.abort();
          this.signal.addEventListener('abort', abort);
          if (this.signal.aborted) abort();
          const timer = setTimeout(abort, 15000);
          let response: HttpResponse;
          let text: string;
          try {
            response = await this.fetch(url, {
              method: body ? 'POST' : 'GET',
              body,
              headers,
              redirect: 'manual',
              credentials: 'omit',
              signal: timeout.signal,
            });
            for (const cookie of responseCookies(response.headers))
              await this.jar.setCookie(cookie, url);
            text = await response.text();
          } finally {
            clearTimeout(timer);
            this.signal.removeEventListener('abort', abort);
          }
          if ([301, 302, 303, 307, 308].includes(response.status)) {
            const location = response.headers.get('location');
            if (!location) throw new AuthError('认证重定向缺少目标地址。');
            const next = validateUrl(new URL(location, url).href);
            if ([301, 302, 303].includes(response.status)) body = undefined;
            if (body && new URL(next).origin !== new URL(url).origin)
              throw new AuthError('已阻止跨站转发登录凭据。');
            url = next;
            continue;
          }
          if (response.status < 200 || response.status >= 300) {
            if (!payload && [429, 500, 502, 503, 504].includes(response.status) && attempt < 2)
              break;
            throw new AuthError('学校服务器返回 HTTP ' + response.status + '，请稍后重试。');
          }
          return { text, url };
        }
      } catch (error) {
        if (error instanceof AuthError) throw error;
        if (payload || attempt === 2 || this.signal.aborted)
          throw new AuthError('连接学校服务失败或超时，请检查网络后重试。');
      }
      await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
      if (this.signal.aborted) throw new AuthError('登录超时，请重试。');
    }
    throw new AuthError('重定向次数过多或学校服务暂时不可用。');
  }
  async download(value: string, referer?: string) {
    let url = validateUrl(value);
    for (let redirects = 0; redirects < 6; redirects++) {
      const headers: Record<string, string> = {};
      const cookie = await this.jar.getCookieString(url);
      if (cookie) headers.Cookie = cookie;
      if (referer) headers.Referer = validateUrl(referer);
      const signal = AbortSignal.any([this.signal, AbortSignal.timeout(25000)]);
      const response = await this.fetch(url, {
        method: 'GET',
        headers,
        redirect: 'manual',
        credentials: 'omit',
        signal,
      });
      for (const value of responseCookies(response.headers)) await this.jar.setCookie(value, url);
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location');
        if (!location) throw new AuthError('来源重定向缺少目标网址。');
        await response.body?.cancel();
        url = validateUrl(new URL(location, url).href);
        continue;
      }
      if (response.status < 200 || response.status >= 300)
        throw new AuthError('学校服务器返回 HTTP ' + response.status + '，请稍后重试。');
      if (Number(response.headers.get('content-length')) > 20 * 1024 * 1024)
        throw new AuthError('来源文件过大。');
      if (!response.arrayBuffer) throw new AuthError('无法读取附件。');
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.length > 20 * 1024 * 1024) throw new AuthError('来源文件过大。');
      return { bytes, type: response.headers.get('content-type') || '', url };
    }
    throw new AuthError('来源网站重定向次数过多。');
  }
  async post(path: string, payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    if (!path.startsWith('/idp/')) throw new AuthError('认证服务返回了无效地址。');
    const page = await this.request('https://id.fudan.edu.cn' + path, payload);
    try {
      const result = JSON.parse(page.text);
      if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error();
      return result;
    } catch {
      throw new AuthError('学校认证响应格式发生变化，请稍后重试。');
    }
  }
}
