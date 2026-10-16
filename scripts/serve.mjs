import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.xml':'application/xml','.txt':'text/plain','.webp':'image/webp','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png'};
http.createServer(async (req, res) => {
  try {
    let name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const baseline = name.startsWith('/baseline/');
    name = name.replace(/^\/(oldgoatcoffee|baseline)/, '');
    if (name.endsWith('/')) name += 'index.html';
    if (baseline && name === '/index.html') name = '/src/template.html';
    const file = path.resolve(root, '.' + name);
    if (!file.startsWith(root + path.sep) || !(await stat(file)).isFile()) throw Error('not found');
    res.writeHead(200, {'Content-Type': types[path.extname(file)] || 'application/octet-stream'});
    res.end(await readFile(file));
  } catch { res.writeHead(404); res.end('404'); }
}).listen(4173, '127.0.0.1', () => console.log('Preview: http://127.0.0.1:4173/oldgoatcoffee/'));
