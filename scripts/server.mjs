import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve, extname, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const port = Number(process.env.PORT || 4173);
const types = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.json':'application/json'};
http.createServer(async (request,response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url,'http://localhost').pathname);
    const target = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (!target.startsWith(root + sep) || !(pathname === '/' || pathname === '/index.html' || pathname.startsWith('/assets/'))) {
      response.writeHead(404);response.end('Not found');return;
    }
    const body = await readFile(target);
    response.writeHead(200,{'Content-Type':types[extname(target)] || 'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});
    response.end(body);
  } catch {response.writeHead(404);response.end('Not found');}
}).listen(port,'127.0.0.1',() => console.log(`Pocket is ready: http://127.0.0.1:${port}`));
