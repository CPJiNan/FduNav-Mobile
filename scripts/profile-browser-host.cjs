const { app, BrowserWindow, session } = require('electron');
const { randomUUID } = require('node:crypto');
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const school = (value) => {
  const url = new URL(value);
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.port ||
    !(url.hostname === 'fudan.edu.cn' || url.hostname.endsWith('.fudan.edu.cn'))
  )
    throw new Error('学校服务会话已失效，请重试。');
  return url;
};
const auth = (value) => ['id.fudan.edu.cn', 'uis.fudan.edu.cn'].includes(new URL(value).hostname);
const authenticationRequired = (value) =>
  Object.assign(new Error('请在学校认证窗口完成验证。'), { loginUrl: school(value).href });
app.setName('FduNav');
app.on('window-all-closed', () => {});
process.once('message', async (input) => {
  let window;
  let reader;
  try {
    const target = school(input.target);
    const start = school(input.url);
    if (!['my.fudan.edu.cn', 'fdjwgl.fudan.edu.cn', 'yjsxk.fudan.edu.cn'].includes(target.hostname))
      throw new Error('学校服务会话已失效，请重试。');
    reader = session.fromPartition('fdunav-profile-' + randomUUID());
    reader.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    reader.on('will-download', (event) => event.preventDefault());
    for (const cookie of input.cookies) {
      const domain = String(cookie.domain || '').replace(/^\./, '');
      school('https://' + domain);
      if (!cookie.key || typeof cookie.value !== 'string') continue;
      const expirationDate =
        cookie.expires && cookie.expires !== 'Infinity'
          ? Date.parse(cookie.expires) / 1000
          : undefined;
      if (Number.isFinite(expirationDate) && expirationDate <= Date.now() / 1000) continue;
      await reader.cookies.set({
        url: 'https://' + domain + (cookie.path || '/'),
        name: cookie.key,
        value: cookie.value,
        path: cookie.path || '/',
        secure: !!cookie.secure,
        httpOnly: !!cookie.httpOnly,
        ...(!cookie.hostOnly ? { domain: cookie.domain } : {}),
        ...(Number.isFinite(expirationDate) ? { expirationDate } : {}),
        ...(cookie.sameSite
          ? { sameSite: cookie.sameSite === 'none' ? 'no_restriction' : cookie.sameSite }
          : {}),
      });
    }
    window = new BrowserWindow({
      show: input.kind === 'challenge',
      title: '复旦统一身份认证',
      width: 900,
      height: 700,
      webPreferences: {
        session: reader,
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    window.webContents.on('will-navigate', (event, value) => {
      try {
        school(value);
      } catch {
        event.preventDefault();
      }
    });
    let closed = false;
    window.on('closed', () => {
      closed = true;
    });
    void window.loadURL(start.href).catch(() => {});
    const deadline = Date.now() + (input.kind === 'challenge' ? 295000 : 25000);
    let arrived = false;
    while (Date.now() < deadline) {
      if (closed) throw new Error('已取消学校身份验证。');
      const current = window.webContents.getURL();
      if (current && !window.webContents.isLoading()) {
        if (new URL(current).origin === target.origin) {
          arrived = true;
          break;
        }
        if (auth(current)) {
          if (input.kind === 'challenge') window.show();
          else throw authenticationRequired(current);
        }
      }
      await wait(250);
    }
    if (!arrived) throw new Error('学校身份验证超时，请重新登录。');
    let html = null;
    if (input.kind === 'render' && target.origin === 'https://my.fudan.edu.cn') {
      let clicked = false;
      while (Date.now() < deadline) {
        if (closed) throw new Error('已取消学校身份验证。');
        const current = window.webContents.getURL();
        if (auth(current)) throw authenticationRequired(current);
        if (new URL(current).origin !== target.origin)
          throw new Error('学校服务会话已失效，请重试。');
        if (window.webContents.isLoading()) {
          await wait(250);
          continue;
        }
        const result = await window.webContents.executeJavaScript(`(clicked => {
          const documents = [document];
          for (const frame of document.querySelectorAll('iframe')) {
            try { if (frame.contentDocument?.documentElement) documents.push(frame.contentDocument); } catch {}
          }
          if (!clicked) {
            for (const page of documents) {
              const link = [...page.querySelectorAll('a,button,[role="button"]')]
                .find(element => /个人信息|我的信息|个人资料/.test(element.textContent || ''));
              if (link) { link.click(); return {clicked:true, ready:false, html:null}; }
            }
          }
          const page = documents.find(page => /性别|院系|专业名称|培养层次|学历阶段|入学年份/.test(page.body?.innerText || ''));
          return {clicked, ready:!!page, html:(page || document).documentElement.outerHTML};
        })(${JSON.stringify(clicked)})`);
        clicked = result.clicked;
        if (result.html) html = result.html;
        if (result.ready) break;
        await wait(250);
      }
    }
    if (input.kind === 'render' && target.href === 'https://fdjwgl.fudan.edu.cn/student/home') {
      let clicked = false;
      while (Date.now() < deadline) {
        if (closed) throw new Error('已取消学校身份验证。');
        const current = window.webContents.getURL();
        if (auth(current)) throw authenticationRequired(current);
        if (new URL(current).origin !== target.origin)
          throw new Error('学校服务会话已失效，请重试。');
        const result = await window.webContents.executeJavaScript(`(clicked => {
          if (!clicked) {
            const link = [...document.querySelectorAll('a')].find(element => (element.textContent || '').includes('考试信息'));
            if (link) { link.click(); clicked = true; }
          }
          for (const frame of document.querySelectorAll('iframe')) {
            try {
              if ((frame.getAttribute('src') || '').includes('exam-arrange') && frame.contentDocument) {
                const html = frame.contentDocument.documentElement.outerHTML;
                if (/\\d{4}[-/.年]\\d{1,2}/.test(html)) return {clicked, html};
              }
            } catch {}
          }
          return {clicked, html:null};
        })(${JSON.stringify(clicked)})`);
        clicked = result.clicked;
        if (result.html) {
          html = result.html;
          break;
        }
        await wait(250);
      }
      if (!html) throw new Error('无法读取考试安排，请重新登录教务系统。');
    }
    if (html && html.length > 4000000) throw new Error('无法连接消息偏好服务，请重试或重启应用。');
    const cookies = (await reader.cookies.get({}))
      .filter((c) => {
        try {
          school('https://' + c.domain.replace(/^\./, ''));
          return true;
        } catch {
          return false;
        }
      })
      .map((c) => ({
        url: 'https://' + c.domain.replace(/^\./, '') + (c.path || '/'),
        cookie:
          c.name +
          '=' +
          c.value +
          '; Path=' +
          (c.path || '/') +
          (!c.hostOnly ? '; Domain=' + c.domain : '') +
          (c.secure ? '; Secure' : '') +
          (c.httpOnly ? '; HttpOnly' : '') +
          (c.expirationDate ? '; Expires=' + new Date(c.expirationDate * 1000).toUTCString() : '') +
          (c.sameSite && c.sameSite !== 'unspecified'
            ? '; SameSite=' + (c.sameSite === 'no_restriction' ? 'None' : c.sameSite)
            : ''),
      }));
    process.send?.({ ok: true, data: { html, cookies } });
  } catch (error) {
    process.send?.({
      ok: false,
      ...(error.loginUrl ? { loginUrl: error.loginUrl } : {}),
      error: error instanceof Error ? error.message : '无法连接消息偏好服务，请重试或重启应用。',
    });
  } finally {
    if (window && !window.isDestroyed()) window.destroy();
    await reader?.clearStorageData().catch(() => {});
    app.quit();
  }
});
app.whenReady().then(() => process.send?.({ ready: true }));
