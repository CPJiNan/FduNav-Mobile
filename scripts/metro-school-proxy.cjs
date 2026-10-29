function withSchoolProxy(
  enhance = (middleware) => middleware,
  load = () => import('./school-proxy.mjs'),
) {
  return (middleware, server) => {
    const nextMiddleware = enhance(middleware, server);
    return (req, res, next) => {
      const route = req.url?.split('?')[0];
      if (route !== '/__school__/request' && route !== '/__school__/profile') {
        return nextMiddleware(req, res, next);
      }

      if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket?.remoteAddress)) {
        res.writeHead(403, { 'Cache-Control': 'no-store' });
        res.end();
        return;
      }
      void (
        route === '/__school__/profile'
          ? import('./school-profile-proxy.mjs').then(({ schoolProfileProxy }) =>
              schoolProfileProxy(req, res),
            )
          : load().then(({ schoolProxy }) => schoolProxy(req, res))
      ).catch(() => {
        if (!res.headersSent) res.writeHead(502, { 'Cache-Control': 'no-store' });
        res.end();
      });
    };
  };
}
module.exports = { withSchoolProxy };
