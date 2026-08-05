/**
 * Written with ESM syntax even though the module under test is CommonJS: vitest
 * transforms the test file, and its own API cannot be `require`d. The interop
 * default import is the CJS `module.exports` object.
 */
import http from 'node:http';
import net from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';

import upgradeProxy from './upgrade-proxy';

const {
  attachSocketProxy,
  buildUpstreamHeaders,
  isSocketUpgrade,
  readCookie,
  resolveSocketTarget,
} = upgradeProxy;

/** Everything a case opened, torn down even when it fails half way through. */
const openServers = [];
const openSockets = [];

afterEach(async () => {
  while (openSockets.length) openSockets.pop().destroy();
  await Promise.all(
    openServers.splice(0).map((server) => new Promise((resolve) => server.close(resolve)))
  );
});

function listen(server) {
  openServers.push(server);
  // An upgraded socket is detached from its server, so `close()` alone would hang
  // waiting for tunnels the test deliberately left open. Tracking every accepted
  // connection lets the teardown cut them first.
  server.on('connection', (socket) => openSockets.push(socket));
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });
}

/**
 * A stand-in backend that accepts the upgrade, records what it was sent, and
 * echoes every byte back so the test can prove the tunnel is bidirectional.
 */
function createUpstream() {
  const seen = { headers: null, url: null };

  const server = http.createServer();
  server.on('upgrade', (req, socket) => {
    seen.headers = req.headers;
    seen.url = req.url;
    socket.write(
      'HTTP/1.1 101 Switching Protocols\r\n' +
        'Upgrade: websocket\r\n' +
        'Connection: Upgrade\r\n' +
        'X-Backend: gateway\r\n\r\n'
    );
    socket.on('data', (chunk) => socket.write(chunk));
  });

  return { server, seen };
}

/** The panel server: Next is irrelevant here, only the upgrade wiring is. */
async function createProxy(env, options = {}) {
  const server = http.createServer((_req, res) => res.end('next'));
  attachSocketProxy(server, { env, ...options });
  return { server, port: await listen(server) };
}

function connect(port) {
  const socket = net.connect(port, '127.0.0.1');
  openSockets.push(socket);
  return socket;
}

function sendUpgrade(socket, { path = '/socket.io/?EIO=4&transport=websocket', cookie } = {}) {
  socket.write(
    `GET ${path} HTTP/1.1\r\n` +
      'Host: panel.local\r\n' +
      'Connection: Upgrade\r\n' +
      'Upgrade: websocket\r\n' +
      'Sec-WebSocket-Version: 13\r\n' +
      'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n' +
      (cookie ? `Cookie: ${cookie}\r\n` : '') +
      '\r\n'
  );
}

/** Resolves once `predicate` is happy with everything received so far. */
function readUntil(socket, predicate) {
  return new Promise((resolve, reject) => {
    let buffer = '';
    const onData = (chunk) => {
      buffer += chunk.toString('utf8');
      if (!predicate(buffer)) return;
      socket.off('data', onData);
      resolve(buffer);
    };
    socket.on('data', onData);
    socket.once('error', reject);
    socket.once('close', () => reject(new Error(`socket closed, saw: ${JSON.stringify(buffer)}`)));
  });
}

describe('resolveSocketTarget', () => {
  it('prefers the runtime var over the build-time one', () => {
    const target = resolveSocketTarget({
      SOCKET_URL: 'https://runtime.example',
      NEXT_PUBLIC_SOCKET_URL: 'https://build.example',
    });

    expect(target.origin).toBe('https://runtime.example');
  });

  it('falls back to the build-time socket url', () => {
    expect(resolveSocketTarget({ NEXT_PUBLIC_SOCKET_URL: 'https://build.example' }).origin).toBe(
      'https://build.example'
    );
  });

  it('strips the api prefix when only an API url is configured', () => {
    // engine.io is mounted at the host root, not under /api/v1.
    expect(resolveSocketTarget({ API_URL: 'https://api.example/api/v1' }).origin).toBe(
      'https://api.example'
    );
  });

  it('defaults to the local backend', () => {
    expect(resolveSocketTarget({}).origin).toBe('http://localhost:3000');
  });
});

describe('isSocketUpgrade', () => {
  it('matches the engine.io endpoint with and without a query', () => {
    expect(isSocketUpgrade('/socket.io')).toBe(true);
    expect(isSocketUpgrade('/socket.io/')).toBe(true);
    expect(isSocketUpgrade('/socket.io/?EIO=4&transport=websocket')).toBe(true);
  });

  it("leaves Next's own sockets alone", () => {
    // Hot reload runs over an upgrade too; claiming it would break dev.
    expect(isSocketUpgrade('/_next/webpack-hmr')).toBe(false);
    expect(isSocketUpgrade('/socket.iomalicious')).toBe(false);
    expect(isSocketUpgrade(undefined)).toBe(false);
  });
});

describe('readCookie', () => {
  it('picks the named cookie out of the header', () => {
    expect(readCookie('theme=dark; manager_token=abc.def; other=1', 'manager_token')).toBe(
      'abc.def'
    );
  });

  it('does not match on a prefix', () => {
    expect(readCookie('manager_token_refresh=nope', 'manager_token')).toBeNull();
  });

  it('returns null when there is no cookie header at all', () => {
    expect(readCookie(undefined, 'manager_token')).toBeNull();
  });
});

describe('buildUpstreamHeaders', () => {
  const target = new URL('https://api.example');

  it('turns the cookie into a Bearer header the gateway understands', () => {
    const headers = buildUpstreamHeaders(
      { 'sec-websocket-key': 'k', connection: 'Upgrade', upgrade: 'websocket' },
      'token-123',
      target
    );

    expect(headers.authorization).toBe('Bearer token-123');
    expect(headers.host).toBe('api.example');
    expect(headers['sec-websocket-key']).toBe('k');
  });

  it('never forwards the browser cookie upstream', () => {
    // Session cookies belong to this origin. The backend authenticates from the
    // Bearer header and has no business seeing them.
    const headers = buildUpstreamHeaders(
      { cookie: 'manager_refresh_token=secret', 'x-forwarded-for': '1.2.3.4' },
      'token-123',
      target
    );

    expect(headers.cookie).toBeUndefined();
    expect(headers['x-forwarded-for']).toBeUndefined();
  });
});

describe('attachSocketProxy', () => {
  it('tunnels the handshake to the backend with the cookie swapped for a Bearer', async () => {
    const upstream = createUpstream();
    const upstreamPort = await listen(upstream.server);
    const { port } = await createProxy({ SOCKET_URL: `http://127.0.0.1:${upstreamPort}` });

    const client = connect(port);
    sendUpgrade(client, { cookie: 'manager_token=tok-xyz; theme=dark' });

    const handshake = await readUntil(client, (buf) => buf.includes('\r\n\r\n'));

    expect(handshake).toContain('101 Switching Protocols');
    expect(handshake).toContain('X-Backend: gateway');
    expect(upstream.seen.headers.authorization).toBe('Bearer tok-xyz');
    expect(upstream.seen.headers.cookie).toBeUndefined();
    expect(upstream.seen.url).toBe('/socket.io/?EIO=4&transport=websocket');
  });

  it('pipes frames both ways once the tunnel is up', async () => {
    const upstream = createUpstream();
    const upstreamPort = await listen(upstream.server);
    const { port } = await createProxy({ SOCKET_URL: `http://127.0.0.1:${upstreamPort}` });

    const client = connect(port);
    sendUpgrade(client, { cookie: 'manager_token=tok-xyz' });
    await readUntil(client, (buf) => buf.includes('\r\n\r\n'));

    client.write('ping-payload');
    const echoed = await readUntil(client, (buf) => buf.includes('ping-payload'));

    expect(echoed).toContain('ping-payload');
  });

  it('refuses the upgrade with a 401 when there is no session cookie', async () => {
    const upstream = createUpstream();
    const upstreamPort = await listen(upstream.server);
    const { port } = await createProxy({ SOCKET_URL: `http://127.0.0.1:${upstreamPort}` });

    const client = connect(port);
    sendUpgrade(client);

    const response = await readUntil(client, (buf) => buf.includes('\r\n\r\n'));

    expect(response).toContain('401 Unauthorized');
    // The backend must not even be dialled for an unauthenticated attempt.
    expect(upstream.seen.headers).toBeNull();
  });

  it('hands non-engine.io upgrades to the fallback handler', async () => {
    let fallbackUrl = null;
    const { port } = await createProxy(
      { SOCKET_URL: 'http://127.0.0.1:1' },
      {
        fallback: (req, socket) => {
          fallbackUrl = req.url;
          socket.destroy();
        },
      }
    );

    const client = connect(port);
    sendUpgrade(client, { path: '/_next/webpack-hmr', cookie: 'manager_token=tok' });
    await new Promise((resolve) => client.once('close', resolve));

    expect(fallbackUrl).toBe('/_next/webpack-hmr');
  });

  it('closes the browser socket when the backend is unreachable', async () => {
    // Port 1 is never listening; the client must be dropped rather than hung.
    const { port } = await createProxy({ SOCKET_URL: 'http://127.0.0.1:1' });

    const client = connect(port);
    sendUpgrade(client, { cookie: 'manager_token=tok' });

    await new Promise((resolve) => client.once('close', resolve));
    expect(client.destroyed).toBe(true);
  });
});
