/** Local-only static preview. No dependencies, uploads, directory listing or remote bind. */
import http from 'node:http';
import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const types = {
  '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8',
  '.mjs':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8',
  '.json':'application/json', '.png':'image/png', '.jpg':'image/jpeg',
  '.jpeg':'image/jpeg', '.webp':'image/webp', '.svg':'image/svg+xml',
  '.glb':'model/gltf-binary', '.gltf':'model/gltf+json', '.bin':'application/octet-stream',
  '.skel':'application/octet-stream', '.atlas':'text/plain; charset=utf-8',
  '.obj':'text/plain; charset=utf-8', '.mtl':'text/plain; charset=utf-8',
  '.woff':'font/woff', '.woff2':'font/woff2', '.ttf':'font/ttf', '.ico':'image/x-icon',
  '.md':'text/plain; charset=utf-8'
};
const publicScripts = new Set(['gallery.js','ui-motion.js','dossier.js','model-viewer.js','ba-model-materials.js','mika-halo.js','toon-renderer.js','spine-viewer.js']);
const inside = (root, target) => {
  const relative = path.relative(root, target);
  return relative !== '' && relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative);
};

export async function createPreviewServer(root = projectRoot) {
  const base = await realpath(root);
  return http.createServer(async (req, res) => {
    const send = (status, body) => {
      res.writeHead(status, {'Content-Type':'text/plain; charset=utf-8'});
      res.end(req.method === 'HEAD' ? undefined : body);
    };
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    const authority = `127.0.0.1:${req.socket.localPort}`;
    // Reject untrusted Host/Origin values as well as non-loopback listeners.
    if (![authority, `localhost:${req.socket.localPort}`].includes(req.headers.host)) return send(403, 'Local preview only.');
    if (req.headers.origin && ![`http://${authority}`, `http://localhost:${req.socket.localPort}`].includes(req.headers.origin)) return send(403, 'Cross-origin requests are not allowed.');
    if (!['GET','HEAD'].includes(req.method)) return send(405, 'Read-only preview.');
    let pathname;
    try { pathname = decodeURIComponent((req.url || '/').split('?')[0]); }
    catch { return send(400, 'Invalid path.'); }
    if (!pathname.startsWith('/') || /[\\:\0]/.test(pathname)) return send(403, 'Invalid path.');
    const parts = pathname.split('/').filter(Boolean);
    if (parts.some(part => part.startsWith('.'))) return send(403, 'Private path.');
    const relative = parts.join('/') || 'index.html';
    const publicPath = ['index.html','styles.css','README.md'].includes(relative)
      || ['assets','styles','i18n'].includes(parts[0])
      || (parts[0] === 'scripts' && parts.length === 2 && publicScripts.has(parts[1]));
    if (!publicPath || !types[path.extname(relative).toLowerCase()]) return send(404, 'Not found.');
    try {
      const target = await realpath(path.join(base, relative));
      if (!inside(base, target)) return send(403, 'Outside project.');
      const info = await stat(target);
      if (!info.isFile()) return send(404, 'Not found.');
      res.writeHead(200, {'Content-Type':types[path.extname(target).toLowerCase()] || 'application/octet-stream','Content-Length':info.size});
      if (req.method === 'HEAD') return res.end();
      await pipeline(createReadStream(target), res);
    } catch (error) {
      if (res.headersSent) res.destroy();
      else send(['ENOENT','ENOTDIR'].includes(error.code) ? 404 : 500, 'File unavailable.');
    }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PAWEB_PREVIEW_PORT || 18900);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid PAWEB_PREVIEW_PORT.');
  const server = await createPreviewServer();
  server.on('error', error => {
    console.error(error.code === 'EADDRINUSE'
      ? `Port ${port} is already in use. If preview is already running, use its existing window; otherwise set PAWEB_PREVIEW_PORT to another port.`
      : error.message);
    process.exitCode = 1;
  });
  server.listen(port, '127.0.0.1', () => {
    console.log(`Project Archive local preview\nhttp://127.0.0.1:${port}/index.html#characters\nKeep this window open. Press Ctrl+C to stop.\nOnly this computer can connect.`);
  });
}
