'use strict';

const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const net = require('net');
const path = require('path');
const { URL } = require('url');

const WEB_HOST = process.env.WEB_HOST || '0.0.0.0';
const WEB_PORT = Number.parseInt(process.env.WEB_PORT || '8080', 10);
const MUHAN_HOST = process.env.MUHAN_HOST || '127.0.0.1';
const MUHAN_PORT = Number.parseInt(process.env.MUHAN_PORT || '4102', 10);
const WS_PATH = process.env.WS_PATH || '/ws';
const ACCESS_TOKEN = process.env.ACCESS_TOKEN || '';
const PUBLIC_DIR = path.resolve(__dirname, '..', 'web');
const MAX_FRAME_SIZE = Number.parseInt(process.env.MAX_FRAME_SIZE || String(64 * 1024), 10);
const IDLE_TIMEOUT_MS = Number.parseInt(process.env.IDLE_TIMEOUT_MS || String(30 * 60 * 1000), 10);
const TCP_CONNECT_TIMEOUT_MS = Number.parseInt(process.env.TCP_CONNECT_TIMEOUT_MS || '5000', 10);
const MAX_CLIENTS = Number.parseInt(process.env.MAX_CLIENTS || '20', 10);
const TELNET_FILTER = process.env.TELNET_FILTER !== '0';
const HEALTHCHECK_TARGET = process.env.HEALTHCHECK_TARGET === '1';

let activeClients = 0;
let totalClients = 0;
const startedAt = new Date();

const MIME_TYPES = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'application/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.svg', 'image/svg+xml; charset=utf-8'],
  ['.ico', 'image/x-icon']
]);

function json(res, statusCode, payload, req) {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(body)
  });
  if (req && req.method === 'HEAD') res.end();
  else res.end(body);
}

function checkTcp(host, port, timeoutMs = 700) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    let settled = false;

    const finish = (ok, error) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve({ ok, error: error ? String(error.message || error) : null });
    };

    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false, new Error('timeout')));
    socket.once('error', (error) => finish(false, error));
  });
}

async function statusPayload(includeTarget) {
  const payload = {
    ok: true,
    gateway: 'muhan-web-runner',
    startedAt: startedAt.toISOString(),
    uptimeSec: Math.round(process.uptime()),
    websocketPath: WS_PATH,
    target: `${MUHAN_HOST}:${MUHAN_PORT}`,
    activeClients,
    totalClients,
    maxClients: MAX_CLIENTS,
    telnetFilter: TELNET_FILTER,
    accessTokenRequired: Boolean(ACCESS_TOKEN)
  };

  if (includeTarget) {
    const target = await checkTcp(MUHAN_HOST, MUHAN_PORT, Math.min(TCP_CONNECT_TIMEOUT_MS, 1500));
    payload.targetReady = target.ok;
    payload.targetError = target.error;
    payload.ok = target.ok;
  }

  return payload;
}

function sendStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  let pathname;

  try {
    pathname = decodeURIComponent(url.pathname);
  } catch (_) {
    res.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Bad request');
    return;
  }

  if (pathname === '/') pathname = '/index.html';

  const filePath = path.resolve(PUBLIC_DIR, `.${pathname}`);
  if (!filePath.startsWith(PUBLIC_DIR + path.sep) && filePath !== PUBLIC_DIR) {
    res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (statError, stat) => {
    if (statError || !stat.isFile()) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'content-type': MIME_TYPES.get(ext) || 'application/octet-stream',
      'cache-control': ext === '.html' ? 'no-store' : 'public, max-age=3600',
      'content-length': stat.size
    });

    if (req.method === 'HEAD') res.end();
    else fs.createReadStream(filePath).pipe(res);
  });
}

function getAccessToken(req) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const queryToken = url.searchParams.get('token');
  if (queryToken) return queryToken;

  const headerToken = req.headers['x-access-token'];
  if (Array.isArray(headerToken)) return headerToken[0] || '';
  if (headerToken) return headerToken;

  const auth = req.headers.authorization || '';
  if (auth.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim();
  return '';
}

function rejectUpgrade(socket, statusCode, message) {
  const reason = message || http.STATUS_CODES[statusCode] || 'Error';
  socket.write(
    `HTTP/1.1 ${statusCode} ${http.STATUS_CODES[statusCode] || 'Error'}\r\n` +
      'Connection: close\r\n' +
      'Content-Type: text/plain; charset=utf-8\r\n' +
      `Content-Length: ${Buffer.byteLength(reason)}\r\n` +
      '\r\n' +
      reason
  );
  socket.destroy();
}

function createAcceptKey(secWebSocketKey) {
  return crypto
    .createHash('sha1')
    .update(secWebSocketKey + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
    .digest('base64');
}

class TelnetFilter {
  constructor(tcpSocket) {
    this.tcpSocket = tcpSocket;
    this.state = 'data';
    this.command = 0;
  }

  process(chunk) {
    const out = [];

    for (const byte of chunk) {
      if (this.state === 'data') {
        if (byte === 255) this.state = 'iac';
        else out.push(byte);
        continue;
      }

      if (this.state === 'iac') {
        if (byte === 255) {
          out.push(255);
          this.state = 'data';
          continue;
        }

        if (byte === 251 || byte === 252 || byte === 253 || byte === 254) {
          this.command = byte;
          this.state = 'option';
          continue;
        }

        if (byte === 250) {
          this.state = 'subnegotiation';
          continue;
        }

        this.state = 'data';
        continue;
      }

      if (this.state === 'option') {
        // Minimal telnet negotiation for browser clients:
        //   server WILL x -> client DONT x
        //   server DO x   -> client WONT x
        if (this.command === 251) this.reply(254, byte); // WILL -> DONT
        if (this.command === 253) this.reply(252, byte); // DO   -> WONT
        this.command = 0;
        this.state = 'data';
        continue;
      }

      if (this.state === 'subnegotiation') {
        if (byte === 255) this.state = 'subnegotiation-iac';
        continue;
      }

      if (this.state === 'subnegotiation-iac') {
        this.state = byte === 240 ? 'data' : 'subnegotiation';
      }
    }

    return Buffer.from(out);
  }

  reply(command, option) {
    if (!this.tcpSocket.destroyed) {
      this.tcpSocket.write(Buffer.from([255, command, option]));
    }
  }
}

class WsTcpBridge {
  constructor(wsSocket, tcpSocket, options = {}) {
    this.wsSocket = wsSocket;
    this.tcpSocket = tcpSocket;
    this.remoteAddress = options.remoteAddress || 'unknown';
    this.onClose = typeof options.onClose === 'function' ? options.onClose : () => {};
    this.wsBuffer = Buffer.alloc(0);
    this.telnetFilter = new TelnetFilter(tcpSocket);
    this.closed = false;
    this.lastActiveAt = Date.now();
    this.fragmentOpcode = null;
    this.fragmentChunks = [];

    this.idleTimer = null;
    if (IDLE_TIMEOUT_MS > 0) {
      this.idleTimer = setInterval(() => {
        if (Date.now() - this.lastActiveAt > IDLE_TIMEOUT_MS) {
          this.sendText('\n[gateway] idle timeout: connection closed.\n');
          this.sendClose(1000, 'idle timeout');
          this.closeSoon();
        }
      }, Math.min(IDLE_TIMEOUT_MS, 30_000));
      this.idleTimer.unref?.();
    }

    wsSocket.on('data', (chunk) => this.handleWsData(chunk));
    wsSocket.on('error', () => this.close());
    wsSocket.on('close', () => this.close());
    wsSocket.on('end', () => this.close());

    tcpSocket.on('data', (chunk) => {
      this.lastActiveAt = Date.now();
      const payload = TELNET_FILTER ? this.telnetFilter.process(chunk) : chunk;
      if (payload.length > 0) this.sendBinary(payload);
    });
    tcpSocket.on('error', (error) => {
      this.sendText(`\n[gateway] MUHAN server error: ${error.message}\n`);
      this.sendClose(1011, 'MUHAN server error');
      this.closeSoon();
    });
    tcpSocket.on('close', () => {
      this.sendText('\n[gateway] MUHAN server disconnected.\n');
      this.sendClose(1011, 'MUHAN server disconnected');
      this.closeSoon();
    });
    tcpSocket.on('end', () => this.closeSoon());
  }

  handleWsData(chunk) {
    this.lastActiveAt = Date.now();
    this.wsBuffer = Buffer.concat([this.wsBuffer, chunk]);

    if (this.wsBuffer.length > MAX_FRAME_SIZE + 14) {
      this.sendClose(1009, 'frame too large');
      return this.closeSoon();
    }

    while (this.wsBuffer.length >= 2) {
      const firstByte = this.wsBuffer[0];
      const secondByte = this.wsBuffer[1];
      const fin = (firstByte & 0x80) !== 0;
      const opcode = firstByte & 0x0f;
      const masked = (secondByte & 0x80) !== 0;
      let payloadLength = secondByte & 0x7f;
      let offset = 2;

      if (payloadLength === 126) {
        if (this.wsBuffer.length < offset + 2) return;
        payloadLength = this.wsBuffer.readUInt16BE(offset);
        offset += 2;
      } else if (payloadLength === 127) {
        if (this.wsBuffer.length < offset + 8) return;
        const bigLength = this.wsBuffer.readBigUInt64BE(offset);
        if (bigLength > BigInt(Number.MAX_SAFE_INTEGER)) {
          this.sendClose(1009, 'frame too large');
          return this.closeSoon();
        }
        payloadLength = Number(bigLength);
        offset += 8;
      }

      if (payloadLength > MAX_FRAME_SIZE) {
        this.sendClose(1009, 'frame too large');
        return this.closeSoon();
      }

      if (!masked) {
        this.sendClose(1002, 'client frames must be masked');
        return this.closeSoon();
      }

      if (this.wsBuffer.length < offset + 4 + payloadLength) return;

      const mask = this.wsBuffer.subarray(offset, offset + 4);
      offset += 4;
      const maskedPayload = this.wsBuffer.subarray(offset, offset + payloadLength);
      this.wsBuffer = this.wsBuffer.subarray(offset + payloadLength);

      const payload = Buffer.allocUnsafe(payloadLength);
      for (let i = 0; i < payloadLength; i += 1) {
        payload[i] = maskedPayload[i] ^ mask[i % 4];
      }

      this.handleFrame({ fin, opcode, payload });
      if (this.closed) return;
    }
  }

  handleFrame(frame) {
    const { fin, opcode, payload } = frame;

    if (opcode === 0x8) {
      this.sendClose(1000, 'closing');
      return this.closeSoon();
    }

    if (opcode === 0x9) return this.sendFrame(0xA, payload);
    if (opcode === 0xA) return;

    if (opcode === 0x0) {
      if (!this.fragmentOpcode) {
        this.sendClose(1002, 'unexpected continuation');
        return this.closeSoon();
      }
      this.fragmentChunks.push(payload);
      if (fin) {
        const message = Buffer.concat(this.fragmentChunks);
        const messageOpcode = this.fragmentOpcode;
        this.fragmentOpcode = null;
        this.fragmentChunks = [];
        this.forwardPayload(messageOpcode, message);
      }
      return;
    }

    if (opcode !== 0x1 && opcode !== 0x2) {
      this.sendClose(1003, 'unsupported opcode');
      return this.closeSoon();
    }

    if (!fin) {
      this.fragmentOpcode = opcode;
      this.fragmentChunks = [payload];
      return;
    }

    this.forwardPayload(opcode, payload);
  }

  forwardPayload(opcode, payload) {
    if (this.closed || !payload || payload.length === 0) return;
    // Text and binary messages are both forwarded as bytes. The upstream MUHAN
    // restored server is UTF-8-first, and browser text frames are UTF-8.
    this.tcpSocket.write(payload);
  }

  sendText(text) {
    if (this.closed || !text) return;
    this.sendFrame(0x1, Buffer.from(text, 'utf8'));
  }

  sendBinary(payload) {
    if (this.closed || !payload || payload.length === 0) return;
    this.sendFrame(0x2, Buffer.from(payload));
  }

  sendClose(code, reason) {
    if (this.closed) return;
    const reasonBuffer = Buffer.from(String(reason || ''), 'utf8');
    const payload = Buffer.allocUnsafe(2 + reasonBuffer.length);
    payload.writeUInt16BE(code || 1000, 0);
    reasonBuffer.copy(payload, 2);
    this.sendFrame(0x8, payload);
  }

  sendFrame(opcode, payload) {
    if (this.closed || this.wsSocket.destroyed) return;
    const length = payload.length;
    let header;

    if (length < 126) {
      header = Buffer.allocUnsafe(2);
      header[0] = 0x80 | opcode;
      header[1] = length;
    } else if (length <= 0xffff) {
      header = Buffer.allocUnsafe(4);
      header[0] = 0x80 | opcode;
      header[1] = 126;
      header.writeUInt16BE(length, 2);
    } else {
      header = Buffer.allocUnsafe(10);
      header[0] = 0x80 | opcode;
      header[1] = 127;
      header.writeBigUInt64BE(BigInt(length), 2);
    }

    this.wsSocket.write(Buffer.concat([header, payload]));
  }

  closeSoon() {
    setTimeout(() => this.close(), 80).unref?.();
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    if (this.idleTimer) clearInterval(this.idleTimer);
    this.wsSocket.destroy();
    this.tcpSocket.destroy();
    this.onClose();
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if ((req.method === 'GET' || req.method === 'HEAD') && url.pathname === '/healthz') {
    const payload = await statusPayload(HEALTHCHECK_TARGET);
    json(res, payload.ok ? 200 : 503, payload, req);
    return;
  }

  if ((req.method === 'GET' || req.method === 'HEAD') && (url.pathname === '/readyz' || url.pathname === '/api/status')) {
    const payload = await statusPayload(true);
    json(res, payload.ok ? 200 : 503, payload, req);
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Method not allowed');
    return;
  }

  sendStatic(req, res);
});

server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (url.pathname !== WS_PATH) {
    rejectUpgrade(socket, 404, 'WebSocket endpoint not found');
    return;
  }

  if (ACCESS_TOKEN && getAccessToken(req) !== ACCESS_TOKEN) {
    rejectUpgrade(socket, 401, 'Unauthorized');
    return;
  }

  if ((req.headers.upgrade || '').toLowerCase() !== 'websocket') {
    rejectUpgrade(socket, 400, 'Invalid upgrade');
    return;
  }

  if (!String(req.headers.connection || '').toLowerCase().split(',').map((v) => v.trim()).includes('upgrade')) {
    rejectUpgrade(socket, 400, 'Invalid connection header');
    return;
  }

  if (req.headers['sec-websocket-version'] !== '13') {
    rejectUpgrade(socket, 426, 'Unsupported WebSocket version');
    return;
  }

  const secKey = req.headers['sec-websocket-key'];
  if (!secKey) {
    rejectUpgrade(socket, 400, 'Missing Sec-WebSocket-Key');
    return;
  }

  if (MAX_CLIENTS > 0 && activeClients >= MAX_CLIENTS) {
    rejectUpgrade(socket, 429, 'Too many clients');
    return;
  }

  const target = net.createConnection({ host: MUHAN_HOST, port: MUHAN_PORT });
  let connected = false;
  let rejected = false;

  const rejectTarget = (error) => {
    if (connected || rejected) return;
    rejected = true;
    target.destroy();
    rejectUpgrade(socket, 503, `MUHAN server unavailable: ${error.message}`);
  };

  target.setTimeout(TCP_CONNECT_TIMEOUT_MS);
  target.once('timeout', () => rejectTarget(new Error('target connect timeout')));
  target.once('error', rejectTarget);

  target.once('connect', () => {
    connected = true;
    target.setTimeout(0);
    const acceptKey = createAcceptKey(secKey);
    socket.write(
      'HTTP/1.1 101 Switching Protocols\r\n' +
        'Upgrade: websocket\r\n' +
        'Connection: Upgrade\r\n' +
        `Sec-WebSocket-Accept: ${acceptKey}\r\n` +
        '\r\n'
    );

    activeClients += 1;
    totalClients += 1;
    const bridge = new WsTcpBridge(socket, target, {
      remoteAddress: req.socket.remoteAddress,
      onClose: () => {
        activeClients = Math.max(0, activeClients - 1);
      }
    });

    if (head && head.length > 0) bridge.handleWsData(head);
  });
});

server.listen(WEB_PORT, WEB_HOST, () => {
  console.log(`[gateway] web: http://${WEB_HOST}:${WEB_PORT}`);
  console.log(`[gateway] websocket: ${WS_PATH}`);
  console.log(`[gateway] target: ${MUHAN_HOST}:${MUHAN_PORT}`);
  console.log(`[gateway] max clients: ${MAX_CLIENTS}`);
  if (ACCESS_TOKEN) console.log('[gateway] access token: enabled');
  console.log(`[gateway] telnet filter: ${TELNET_FILTER ? 'enabled' : 'disabled'}`);
  console.log(`[gateway] healthcheck target probe: ${HEALTHCHECK_TARGET ? 'enabled' : 'disabled'}`);
});

process.on('SIGTERM', () => server.close(() => process.exit(0)));
process.on('SIGINT', () => server.close(() => process.exit(0)));
