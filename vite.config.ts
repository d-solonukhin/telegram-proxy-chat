import react from '@vitejs/plugin-react';
import type { Connect, Plugin } from 'vite';
import { defineConfig } from 'vite';
import { handleNodeRequest } from './server/greenProxy.mjs';

/**
 * Browser calls never go to GREEN-API directly (that host does not allow
 * browser CORS). The client builds:
 *   /green-api/{host}/waInstance{id}/{method}/{token}
 * and this middleware forwards the request to https://{host}/...
 *
 * {host} is taken from apiUrl, or derived as
 * https://{first 4 digits of idInstance}.api.green-api.com.
 * A static server.proxy target cannot cover every instance host, so the
 * rewrite is dynamic and allowlists *.green-api.com only.
 *
 * The same path is served in production by the Vercel/Netlify function.
 */
function greenApiDevPlugin(): Plugin {
  const middleware: Connect.NextHandleFunction = (req, res, next) => {
    const url = req.url ?? '';
    if (!url.startsWith('/green-api/')) {
      next();
      return;
    }
    void handleNodeRequest(req, res).catch(() => {
      if (!res.headersSent) {
        res.statusCode = 502;
        res.setHeader('content-type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ error: 'proxy_error' }));
      }
    });
  };

  return {
    name: 'green-api-dev-proxy',
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}

export default defineConfig({
  plugins: [react(), greenApiDevPlugin()],
  server: {
    port: 5173,
  },
  preview: {
    port: 4173,
  },
});
