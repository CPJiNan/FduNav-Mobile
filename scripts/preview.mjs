import { schoolProxy } from './school-proxy.mjs';
import { schoolProfileProxy } from './school-profile-proxy.mjs';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve('dist');
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.ttf': 'font/ttf',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
};
http
  .createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      if (pathname === '/__school__/profile') {
        await schoolProfileProxy(req, res);
        return;
      }
      if (pathname === '/__school__/request') {
        await schoolProxy(req, res);
        return;
      }
      const file = path.resolve(root, '.' + pathname);
      if (file !== root && !file.startsWith(root + path.sep)) {
        res.writeHead(403);
        res.end();
        return;
      }
      const resolved = path.extname(file) ? file : path.join(root, 'index.html');
      const body = await readFile(resolved);
      res.writeHead(200, {
        'Content-Type': types[path.extname(resolved)] || 'application/octet-stream',
      });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end('Not found');
    }
  })
  .listen(4173, '127.0.0.1', () => console.log('FduNav preview: http://localhost:4173'));
