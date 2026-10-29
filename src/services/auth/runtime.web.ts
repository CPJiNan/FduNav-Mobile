import { AccountSession, type SavedSession } from './session';
import { rsaEncryptPassword } from './rsa';
import { AuthError } from './protocol';
import { profileBrowser } from './profile-browser.web';
let saved: SavedSession | null = null;
export const accountSession = new AccountSession({
  fetch: async (url, init) => {
    const response = await fetch('/__school__/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, method: init.method, body: init.body, headers: init.headers }),
      signal: init.signal,
    });
    if (!response.ok) throw new AuthError('连接学校服务失败或超时，请检查网络后重试。');
    const result = await response.json();
    const headers = new Headers(result.headers);
    return {
      status: result.status,
      headers: {
        get: (name: string) => headers.get(name),
        getSetCookie: () => result.cookies || [],
      },
      text: async () => result.text,
      arrayBuffer: async () => Uint8Array.from(atob(result.base64), (c) => c.charCodeAt(0)).buffer,
    };
  },
  storage: {
    load: async () => saved,
    save: async (value) => {
      saved = value;
    },
    clear: async () => {
      saved = null;
    },
  },
  encrypt: (password, key) =>
    rsaEncryptPassword(password, key, (size) => crypto.getRandomValues(new Uint8Array(size))),
  browser: {
    clear: async () => {},
    open: async (url) => {
      const { openBrowserAsync } = await import('expo-web-browser');
      await openBrowserAsync(url);
    },
    render: async (url, jar, signal) =>
      url === 'https://my.fudan.edu.cn/' || url === 'https://fdjwgl.fudan.edu.cn/student/home'
        ? (await profileBrowser('render', url, url, jar, signal)).html
        : null,
    challenge: async (error, jar, signal) =>
      (await profileBrowser('challenge', error.loginUrl, error.target, jar, signal)).jar,
  },
});
