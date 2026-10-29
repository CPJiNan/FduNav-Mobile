import { CookieJar } from 'tough-cookie';
import { AdditionalAuthenticationRequired, AuthError } from './protocol';
export type BrowserJob = {
  id: number;
  kind: 'challenge' | 'render' | 'page';
  url: string;
  target: string;
  jar: CookieJar;
  signal: AbortSignal;
  resolve: (value: CookieJar | string | null) => void;
  reject: (error: Error) => void;
};
let nextId = 0;
let host: ((job: BrowserJob) => void) | null = null;
export function registerSchoolBrowser(handler: (job: BrowserJob) => void) {
  host = handler;
  return () => {
    if (host === handler) host = null;
  };
}
export function openSchoolBrowser(
  kind: BrowserJob['kind'],
  url: string,
  target: string,
  jar: CookieJar,
  signal: AbortSignal,
): Promise<CookieJar | string | null> {
  if (!host || signal.aborted) return Promise.reject(new AuthError('已取消学校身份验证。'));
  return new Promise((resolve, reject) =>
    host!({ id: ++nextId, kind, url, target, jar, signal, resolve, reject }),
  );
}
export const schoolBrowser = {
  async open(url: string, jar: CookieJar, signal: AbortSignal) {
    await openSchoolBrowser('page', url, url, jar, signal);
  },
  challenge(error: AdditionalAuthenticationRequired, jar: CookieJar, signal: AbortSignal) {
    return openSchoolBrowser(
      'challenge',
      error.loginUrl,
      error.target,
      jar,
      signal,
    ) as Promise<CookieJar>;
  },
  render(url: string, jar: CookieJar, signal: AbortSignal) {
    return openSchoolBrowser('render', url, url, jar, signal) as Promise<string | null>;
  },
};
