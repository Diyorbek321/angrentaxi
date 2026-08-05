'use strict';

/**
 * Custom Node server for the dispatcher panel.
 *
 * Next's own entry point — `next start`, or the `server.js` a standalone build
 * generates — gives no way to hook the HTTP `upgrade` event, and App Router route
 * handlers cannot see one at all. The panel needs that hook: proxying the socket.io
 * handshake through this origin is what keeps the access token out of page scripts
 * (see `server/upgrade-proxy.js`). Everything else is handed to Next untouched.
 *
 * Deployment is a long-lived Node container (Dockerfile -> Railway), so a stateful
 * websocket hop is fine here; this would not work on a serverless/edge target.
 *
 * ⚠️ Taking over the server has one consequence that is easy to miss: Next.js
 * middleware does NOT run behind `app.getRequestHandler()`. `src/middleware.ts`
 * is therefore dead weight in production here, and the route guard it provides
 * has to be applied by this server instead — see `server/route-guard.js`.
 */

const http = require('node:http');
const path = require('node:path');

const { attachSocketProxy, readCookie } = require('./server/upgrade-proxy');
const { applyRouteGuard } = require('./server/route-guard');

const SESSION_COOKIE = process.env.SESSION_COOKIE_NAME || 'manager_token';

const dir = __dirname;
const dev = process.env.NODE_ENV !== 'production';
const port = parseInt(process.env.PORT, 10) || 3002;
const hostname = process.env.HOSTNAME || '0.0.0.0';

let conf;

if (!dev) {
  // A standalone build ships only the files its own server.js needs, and webpack
  // is not among them — so Next's normal config load blows up with a missing
  // module. The generated server.js dodges this by passing the already-resolved
  // config in through this env var; the same config is on disk in the build
  // manifest, so we read it from there and do exactly the same thing.
  conf = require(path.join(dir, '.next', 'required-server-files.json')).config;
  process.env.__NEXT_PRIVATE_STANDALONE_CONFIG = JSON.stringify(conf);
  // `distDir` in that config is relative, as it is for the generated server.
  process.chdir(dir);
}

const next = require('next');

const app = next({ dev, dir, conf, hostname, port });
const handle = app.getRequestHandler();

app
  .prepare()
  .then(() => {
    const server = http.createServer((req, res) => {
      // Stands in for src/middleware.ts, which Next never invokes behind a
      // custom server. Without it a logged-out browser gets 200 on /dispatch.
      if (applyRouteGuard(req, res, readCookie, SESSION_COOKIE)) return;

      handle(req, res).catch(() => {
        res.statusCode = 500;
        res.end('Internal Server Error');
      });
    });

    const keepAliveTimeout = parseInt(process.env.KEEP_ALIVE_TIMEOUT, 10);
    if (Number.isFinite(keepAliveTimeout) && keepAliveTimeout >= 0) {
      server.keepAliveTimeout = keepAliveTimeout;
    }

    // Next owns every upgrade that is not engine.io — in dev that is the HMR
    // socket, and swallowing it would kill hot reload.
    const upgradeHandler = app.getUpgradeHandler();
    attachSocketProxy(server, {
      fallback: (req, socket, head) => {
        upgradeHandler(req, socket, head);
      },
    });

    server.listen(port, hostname, () => {
      console.log(`> Manager panel ready on http://${hostname}:${port}`);
    });
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
