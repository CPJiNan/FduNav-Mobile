const schoolUrl = (value) => {
  const url = new URL(value);
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.port ||
    !(url.hostname === 'fudan.edu.cn' || url.hostname.endsWith('.fudan.edu.cn'))
  )
    throw new Error();
  return url.href;
};
export async function schoolProxy(req, res, upstream = fetch) {
  const origin = req.headers.origin;
  const expected = 'http://' + req.headers.host;
  if (
    req.method !== 'POST' ||
    (origin && origin !== expected) ||
    !['same-origin', 'none', undefined].includes(req.headers['sec-fetch-site']) ||
    !String(req.headers['content-type']).startsWith('application/json')
  ) {
    res.writeHead(403);
    res.end();
    return;
  }
  try {
    let raw = '';
    for await (const part of req) {
      raw += part;
      if (raw.length > 65536) throw new Error();
    }
    const input = JSON.parse(raw);
    const url = schoolUrl(input.url);
    if (!['GET', 'POST'].includes(input.method)) throw new Error();
    const headers = {};
    for (const name of ['Cookie', 'Content-Type', 'Origin', 'Referer', 'User-Agent'])
      if (typeof input.headers?.[name] === 'string') headers[name] = input.headers[name];
    if (headers.Origin && headers.Origin !== 'https://id.fudan.edu.cn') throw new Error();
    if (
      headers.Referer &&
      input.method === 'POST' &&
      new URL(schoolUrl(headers.Referer)).origin !== 'https://id.fudan.edu.cn'
    )
      throw new Error();
    const response = await upstream(url, {
      method: input.method,
      headers,
      body: input.method === 'POST' ? input.body : undefined,
      redirect: 'manual',
      signal: AbortSignal.timeout(15000),
    });
    const chunks = [];
    let size = 0;
    for await (const chunk of response.body || []) {
      size += chunk.length;
      if (size > 20 * 1024 * 1024) throw new Error();
      chunks.push(chunk);
    }
    const text = Buffer.concat(chunks).toString('utf8');
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(
      JSON.stringify({
        status: response.status,
        headers: [...response.headers.entries()].filter(([name]) => name !== 'set-cookie'),
        cookies: response.headers.getSetCookie(),
        text,
        base64: Buffer.concat(chunks).toString('base64'),
      }),
    );
  } catch {
    res.writeHead(502, { 'Cache-Control': 'no-store' });
    res.end();
  }
}
