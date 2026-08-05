'use strict';

/**
 * Server-side half of the socket.io proxy.
 *
 * The panel's websocket used to be the one hole in the BFF: it went from the
 * browser straight to the backend host, a different origin, so the `httpOnly`
 * session cookie was never attached and the handshake token had to be handed to
 * page scripts through /api/auth/socket-token. Anything that could run in the
 * page could take that access token.
 *
 * Here the upgrade lands on our own origin instead. The browser attaches the
 * cookie because it is same-origin, this process reads it, and the Bearer header
 * is added on the hop to the backend — the same trick /api/proxy already uses for
 * ordinary requests. No token is ever readable from JS.
 *
 * This has to live outside `src/` and in CommonJS: it is required by the custom
 * `server.js`, which runs as plain Node before (and around) Next, so it never
 * passes through the app's TypeScript build.
 */

const http = require('node:http');
const https = require('node:https');

/**
 * engine.io's mount point. The gateway is on the `/ws` *namespace*, which is a
 * socket.io-level concept carried inside the payload — the HTTP path is this.
 */
const SOCKET_IO_PATH = '/socket.io';

/** Headers that make an upgrade an upgrade. Everything else is dropped. */
const HANDSHAKE_HEADERS = [
  'connection',
  'upgrade',
  'sec-websocket-key',
  'sec-websocket-version',
  'sec-websocket-protocol',
  'sec-websocket-extensions',
];

const UPSTREAM_TIMEOUT_MS = 15_000;

/**
 * Where the backend's socket.io server lives, as seen from this process.
 *
 * Runtime vars win over the build-time `NEXT_PUBLIC_*` ones so a container can be
 * repointed without a rebuild — the same order `src/lib/server/api-config.ts` uses.
 * `API_URL` is the last resort and needs its `/api/v1` suffix stripped, since
 * engine.io is mounted at the host root.
 *
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {URL}
 */
function resolveSocketTarget(env = process.env) {
  const direct = env.SOCKET_URL || env.NEXT_PUBLIC_SOCKET_URL;
  if (direct) return new URL(direct);

  const api = env.API_URL || env.NEXT_PUBLIC_API_URL;
  if (api) return new URL(new URL(api).origin);

  return new URL('http://localhost:3000');
}

/**
 * True for the engine.io endpoint and nothing else.
 *
 * Deliberately narrow: this server also carries Next's own dev HMR socket, and a
 * loose match would hand that to the backend.
 *
 * @param {string | undefined} url
 */
function isSocketUpgrade(url) {
  if (!url) return false;
  const pathname = url.split('?')[0];
  return pathname === SOCKET_IO_PATH || pathname.startsWith(`${SOCKET_IO_PATH}/`);
}

/**
 * Pulls one cookie out of a raw Cookie header.
 *
 * @param {string | undefined} header
 * @param {string} name
 * @returns {string | null}
 */
function readCookie(header, name) {
  if (!header) return null;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() !== name) continue;
    return decodeURIComponent(part.slice(eq + 1).trim()) || null;
  }
  return null;
}

/**
 * Builds the headers for the backend hop.
 *
 * Allow-list, not deny-list. In particular the browser's `Cookie` never travels
 * on: our session cookies belong to this origin alone, and the backend
 * authenticates from the Bearer header — `RealtimeGateway.handleConnection`
 * reads `handshake.auth.token` or exactly this `authorization` header.
 *
 * @param {import('node:http').IncomingHttpHeaders} headers
 * @param {string} token
 * @param {URL} target
 */
function buildUpstreamHeaders(headers, token, target) {
  /** @type {Record<string, string>} */
  const out = { host: target.host, authorization: `Bearer ${token}` };

  for (const name of HANDSHAKE_HEADERS) {
    const value = headers[name];
    if (typeof value === 'string') out[name] = value;
  }

  return out;
}

/**
 * Serialises the backend's 101 response back to the browser verbatim, so the
 * negotiated `Sec-WebSocket-Accept` and any extensions survive the hop.
 *
 * @param {import('node:http').IncomingMessage} res
 */
function serialiseHandshakeResponse(res) {
  const lines = [`HTTP/1.1 ${res.statusCode} ${res.statusMessage || 'Switching Protocols'}`];
  for (let i = 0; i < res.rawHeaders.length; i += 2) {
    lines.push(`${res.rawHeaders[i]}: ${res.rawHeaders[i + 1]}`);
  }
  return `${lines.join('\r\n')}\r\n\r\n`;
}

function destroy(socket) {
  if (socket && !socket.destroyed) socket.destroy();
}

/**
 * Forwards a single websocket upgrade to the backend.
 *
 * @param {object} options
 * @param {import('node:http').IncomingMessage} options.req
 * @param {import('node:stream').Duplex} options.socket
 * @param {Buffer} options.head
 * @param {string} options.token
 * @param {URL} options.target
 */
function proxyUpgrade({ req, socket, head, token, target }) {
  const transport = target.protocol === 'https:' ? https : http;

  const upstream = transport.request({
    protocol: target.protocol,
    hostname: target.hostname,
    port: target.port || (target.protocol === 'https:' ? 443 : 80),
    method: 'GET',
    path: req.url,
    headers: buildUpstreamHeaders(req.headers, token, target),
    timeout: UPSTREAM_TIMEOUT_MS,
  });

  upstream.on('upgrade', (upstreamRes, upstreamSocket, upstreamHead) => {
    socket.write(serialiseHandshakeResponse(upstreamRes));

    // Bytes that arrived glued to the handshake on either side have already been
    // read off their socket, so they have to be replayed by hand before piping.
    if (upstreamHead && upstreamHead.length) socket.write(upstreamHead);
    if (head && head.length) upstreamSocket.write(head);

    upstreamSocket.on('error', () => destroy(socket));
    socket.on('error', () => destroy(upstreamSocket));

    upstreamSocket.pipe(socket);
    socket.pipe(upstreamSocket);
  });

  // A plain response means the backend refused the upgrade (a rejected token
  // shows up as a disconnect, but a wrong path or a dead gateway lands here).
  upstream.on('response', () => {
    socket.write('HTTP/1.1 502 Bad Gateway\r\nConnection: close\r\n\r\n');
    destroy(socket);
  });

  upstream.on('timeout', () => upstream.destroy());
  upstream.on('error', () => destroy(socket));
  socket.on('error', () => upstream.destroy());

  upstream.end();
}

/**
 * Wires the proxy onto an http server's `upgrade` event.
 *
 * Anything that is not engine.io is handed to `fallback` — in dev that is Next's
 * own HMR socket, and dropping it would break hot reload.
 *
 * @param {import('node:http').Server} server
 * @param {object} [options]
 * @param {(req: any, socket: any, head: any) => void} [options.fallback]
 * @param {NodeJS.ProcessEnv} [options.env]
 * @param {string} [options.cookieName]
 */
function attachSocketProxy(server, { fallback, env = process.env, cookieName } = {}) {
  const target = resolveSocketTarget(env);
  const name = cookieName || 'manager_token';

  server.on('upgrade', (req, socket, head) => {
    if (!isSocketUpgrade(req.url)) {
      if (fallback) fallback(req, socket, head);
      else destroy(socket);
      return;
    }

    const token = readCookie(req.headers.cookie, name);
    if (!token) {
      // No session: refuse before touching the backend. socket.io surfaces this
      // as `connect_error`, which `useSocket` already renders as an error state.
      socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
      destroy(socket);
      return;
    }

    proxyUpgrade({ req, socket, head, token, target });
  });
}

module.exports = {
  SOCKET_IO_PATH,
  attachSocketProxy,
  buildUpstreamHeaders,
  isSocketUpgrade,
  proxyUpgrade,
  readCookie,
  resolveSocketTarget,
};
