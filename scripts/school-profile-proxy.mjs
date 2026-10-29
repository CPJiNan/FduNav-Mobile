import { readProfileInBrowser } from './profile-browser.cjs';

export function profileRequest(input) {
  if (!input || !['render', 'challenge'].includes(input.kind)) throw new Error();
  const target = new URL(input.target);
  if (
    target.protocol !== 'https:' ||
    target.username ||
    target.password ||
    target.port ||
    !['my.fudan.edu.cn', 'fdjwgl.fudan.edu.cn', 'yjsxk.fudan.edu.cn'].includes(target.hostname)
  )
    throw new Error();
  const url = new URL(input.url);
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.port ||
    ![
      'my.fudan.edu.cn',
      'fdjwgl.fudan.edu.cn',
      'yjsxk.fudan.edu.cn',
      'id.fudan.edu.cn',
      'uis.fudan.edu.cn',
    ].includes(url.hostname)
  )
    throw new Error();
  if (
    input.kind === 'render' &&
    (url.href !== target.href ||
      !['https://my.fudan.edu.cn/', 'https://fdjwgl.fudan.edu.cn/student/home'].includes(
        target.href,
      ))
  )
    throw new Error();
  if (!Array.isArray(input.cookies) || input.cookies.length > 256) throw new Error();
  const cookies = input.cookies.map((c) => {
    const domain = String(c.domain || '')
      .replace(/^\./, '')
      .toLowerCase();
    if (
      !(domain === 'fudan.edu.cn' || domain.endsWith('.fudan.edu.cn')) ||
      !/^\.?[a-z0-9.-]+$/i.test(c.domain) ||
      typeof c.key !== 'string' ||
      typeof c.value !== 'string' ||
      /[\r\n;]/.test(c.key) ||
      /[\r\n]/.test(c.value) ||
      typeof c.path !== 'string' ||
      !c.path.startsWith('/')
    )
      throw new Error();
    return {
      key: c.key,
      value: c.value,
      domain: c.domain,
      path: c.path,
      hostOnly: c.hostOnly === true,
      secure: c.secure === true,
      httpOnly: c.httpOnly === true,
      ...(['strict', 'lax', 'none'].includes(c.sameSite) ? { sameSite: c.sameSite } : {}),
      ...(typeof c.expires === 'string' ? { expires: c.expires } : {}),
    };
  });
  return { kind: input.kind, url: url.href, target: target.href, cookies };
}

export async function schoolProfileProxy(req, res, read = readProfileInBrowser) {
  const allowed =
    ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket?.remoteAddress) &&
    req.method === 'POST' &&
    req.headers.origin === 'http://' + req.headers.host &&
    String(req.headers['content-type']).startsWith('application/json') &&
    ['same-origin', 'none', undefined].includes(req.headers['sec-fetch-site']);
  if (!allowed) {
    res.writeHead(403, { 'Cache-Control': 'no-store' });
    res.end();
    return;
  }
  let input;
  try {
    let raw = '';
    for await (const part of req) {
      raw += part;
      if (raw.length > 1000000) throw new Error();
    }
    input = profileRequest(JSON.parse(raw));
  } catch {
    res.writeHead(400, { 'Cache-Control': 'no-store' });
    res.end();
    return;
  }
  const controller = new AbortController();
  const abort = () => controller.abort();
  res.on('close', abort);
  try {
    const data = await read(input, controller.signal);
    if (controller.signal.aborted) return;
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(JSON.stringify({ ok: true, data }));
  } catch (error) {
    if (controller.signal.aborted) return;
    res.writeHead(502, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    const known = [
      '已取消学校身份验证。',
      '学校身份验证超时，请重新登录。',
      '请在学校认证窗口完成验证。',
      '学校服务会话已失效，请重试。',
      '无法读取考试安排，请重新登录教务系统。',
    ];
    let loginUrl;
    try {
      const url = new URL(error?.loginUrl);
      if (
        url.protocol === 'https:' &&
        !url.username &&
        !url.password &&
        !url.port &&
        ['id.fudan.edu.cn', 'uis.fudan.edu.cn'].includes(url.hostname)
      )
        loginUrl = url.href;
    } catch {}
    res.end(
      JSON.stringify({
        ok: false,
        ...(loginUrl ? { loginUrl } : {}),
        error: known.includes(error?.message)
          ? error.message
          : '无法连接消息偏好服务，请重试或重启应用。',
      }),
    );
  } finally {
    res.off('close', abort);
  }
}
