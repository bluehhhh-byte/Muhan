'use strict';

const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const net = require('net');
const path = require('path');
const { spawn } = require('child_process');
const { URL } = require('url');

const WEB_HOST = process.env.WEB_HOST || '0.0.0.0';
const WEB_PORT = Number.parseInt(process.env.WEB_PORT || '8080', 10);
const MUHAN_HOST = process.env.MUHAN_HOST || '127.0.0.1';
const MUHAN_PORT = Number.parseInt(process.env.MUHAN_PORT || '4102', 10);
const MUD_WS_PATH = process.env.MUD_WS_PATH || '/ws/mud';
const LEGACY_WS_PATH = process.env.WS_PATH || '/ws';
const AGENT_WS_PATH = process.env.AGENT_WS_PATH || '/ws/agent';
const PUBLIC_DIR = path.resolve(__dirname, '..', 'web');
const MAX_FRAME_SIZE = Number.parseInt(process.env.MAX_FRAME_SIZE || String(64 * 1024), 10);
const IDLE_TIMEOUT_MS = Number.parseInt(process.env.IDLE_TIMEOUT_MS || String(30 * 60 * 1000), 10);
const TCP_CONNECT_TIMEOUT_MS = Number.parseInt(process.env.TCP_CONNECT_TIMEOUT_MS || '5000', 10);
const MAX_CLIENTS = Number.parseInt(process.env.MAX_CLIENTS || '1', 10);
const TELNET_FILTER = process.env.TELNET_FILTER !== '0';
const HEALTHCHECK_TARGET = process.env.HEALTHCHECK_TARGET === '1';

const ENABLE_AGENT = process.env.ENABLE_AGENT === '1';
const AGENT_COMMAND = process.env.AGENT_COMMAND || process.env.AGY_BIN || 'agy';
const AGENT_WORKDIR = path.resolve(process.env.AGENT_WORKDIR || path.resolve(__dirname, '..'));
const AGENT_MAX_SESSIONS = Number.parseInt(process.env.AGENT_MAX_SESSIONS || '1', 10);
const AGENT_IDLE_TIMEOUT_MS = Number.parseInt(process.env.AGENT_IDLE_TIMEOUT_MS || String(60 * 60 * 1000), 10);
const AGENT_USE_SCRIPT = process.env.AGENT_USE_SCRIPT !== '0';
const AGENT_LOCAL_ONLY = process.env.AGENT_LOCAL_ONLY === '1';

let activeMudClients = 0;
let totalMudClients = 0;
let activeAgentSessions = 0;
let totalAgentSessions = 0;
const agentChildren = new Set();
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

function firstCommandToken(command) {
  const value = String(command || '').trim();
  if (!value) return '';
  const match = value.match(/^"([^"]+)"|^'([^']+)'|^(\S+)/);
  return match ? (match[1] || match[2] || match[3] || '') : '';
}

function commandExists(command) {
  if (!command) return false;

  const candidate = firstCommandToken(command);
  if (!candidate) return false;

  if (candidate.includes(path.sep)) {
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      return true;
    } catch (_) {
      return false;
    }
  }

  const pathEntries = String(process.env.PATH || '')
    .split(path.delimiter)
    .filter(Boolean);

  for (const entry of pathEntries) {
    const resolved = path.join(entry, candidate);
    try {
      fs.accessSync(resolved, fs.constants.X_OK);
      return true;
    } catch (_) {
      // keep searching
    }
  }

  return false;
}

function isLocalAddress(address) {
  return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1' || address === 'localhost';
}

function agentDiagnostic() {
  const workdirExists = fs.existsSync(AGENT_WORKDIR);
  const commandReady = commandExists(AGENT_COMMAND);
  const scriptReady = commandExists('script');
  const ptyBridgePath = path.resolve(__dirname, 'pty_bridge.py');
  const ptyBridgeReady = commandExists('python3') && fs.existsSync(ptyBridgePath);

  let error = null;
  if (!ENABLE_AGENT) error = 'disabled';
  else if (!workdirExists) error = `missing workdir: ${AGENT_WORKDIR}`;
  else if (!commandReady) error = `command not found: ${firstCommandToken(AGENT_COMMAND)}`;

  return {
    enabled: ENABLE_AGENT,
    ready: ENABLE_AGENT && workdirExists && commandReady,
    command: AGENT_COMMAND,
    workdir: AGENT_WORKDIR,
    websocketPath: AGENT_WS_PATH,
    activeSessions: activeAgentSessions,
    totalSessions: totalAgentSessions,
    maxSessions: AGENT_MAX_SESSIONS,
    useScriptPty: AGENT_USE_SCRIPT,
    scriptAvailable: scriptReady,
    ptyBridgeAvailable: ptyBridgeReady,
    localOnly: AGENT_LOCAL_ONLY,
    error
  };
}

async function statusPayload(includeTarget) {
  const mud = {
    target: `${MUHAN_HOST}:${MUHAN_PORT}`,
    websocketPath: MUD_WS_PATH,
    legacyWebsocketPath: LEGACY_WS_PATH,
    activeClients: activeMudClients,
    totalClients: totalMudClients,
    maxClients: MAX_CLIENTS,
    telnetFilter: TELNET_FILTER,
    ready: null,
    error: null
  };

  if (includeTarget) {
    const target = await checkTcp(MUHAN_HOST, MUHAN_PORT, Math.min(TCP_CONNECT_TIMEOUT_MS, 1500));
    mud.ready = target.ok;
    mud.error = target.error;
  }

  return {
    ok: includeTarget ? Boolean(mud.ready) : true,
    gateway: {
      name: 'muhan-web-runner',
      version: '0.5.0',
      startedAt: startedAt.toISOString(),
      uptimeSec: Math.round(process.uptime()),
      accessTokenRequired: false
    },
    mud,
    agent: agentDiagnostic()
  };
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

function validateUpgrade(req, socket) {
  if ((req.headers.upgrade || '').toLowerCase() !== 'websocket') {
    rejectUpgrade(socket, 400, 'Invalid upgrade');
    return null;
  }

  if (!String(req.headers.connection || '').toLowerCase().split(',').map((v) => v.trim()).includes('upgrade')) {
    rejectUpgrade(socket, 400, 'Invalid connection header');
    return null;
  }

  if (req.headers['sec-websocket-version'] !== '13') {
    rejectUpgrade(socket, 426, 'Unsupported WebSocket version');
    return null;
  }

  const secKey = req.headers['sec-websocket-key'];
  if (!secKey) {
    rejectUpgrade(socket, 400, 'Missing Sec-WebSocket-Key');
    return null;
  }

  return secKey;
}

function acceptUpgrade(socket, secKey) {
  const acceptKey = createAcceptKey(secKey);
  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
      'Upgrade: websocket\r\n' +
      'Connection: Upgrade\r\n' +
      `Sec-WebSocket-Accept: ${acceptKey}\r\n` +
      '\r\n'
  );
}

class WebSocketConnection {
  constructor(wsSocket, options = {}) {
    this.wsSocket = wsSocket;
    this.onMessage = typeof options.onMessage === 'function' ? options.onMessage : () => {};
    this.onClose = typeof options.onClose === 'function' ? options.onClose : () => {};
    this.idleTimeoutMs = Number.parseInt(String(options.idleTimeoutMs || 0), 10);
    this.closeMessage = options.closeMessage || 'idle timeout';
    this.wsBuffer = Buffer.alloc(0);
    this.closed = false;
    this.lastActiveAt = Date.now();
    this.fragmentOpcode = null;
    this.fragmentChunks = [];
    this.idleTimer = null;

    if (this.idleTimeoutMs > 0) {
      this.idleTimer = setInterval(() => {
        if (Date.now() - this.lastActiveAt > this.idleTimeoutMs) {
          this.sendText(`\n[gateway] ${this.closeMessage}: connection closed.\n`);
          this.sendClose(1000, this.closeMessage);
          this.closeSoon();
        }
      }, Math.min(this.idleTimeoutMs, 30_000));
      this.idleTimer.unref?.();
    }

    wsSocket.on('data', (chunk) => this.handleData(chunk));
    wsSocket.on('error', () => this.close());
    wsSocket.on('close', () => this.close());
    wsSocket.on('end', () => this.close());
  }

  handleData(chunk) {
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
        this.onMessage(messageOpcode, message);
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

    this.onMessage(opcode, payload);
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
    this.onClose();
  }
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
        if (this.command === 251) this.reply(254, byte);
        if (this.command === 253) this.reply(252, byte);
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

function handleMudUpgrade(req, socket, head, secKey) {
  if (MAX_CLIENTS > 0 && activeMudClients >= MAX_CLIENTS) {
    rejectUpgrade(socket, 429, 'Too many MUD clients');
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
    acceptUpgrade(socket, secKey);

    activeMudClients += 1;
    totalMudClients += 1;
    const telnetFilter = new TelnetFilter(target);

    const ws = new WebSocketConnection(socket, {
      idleTimeoutMs: IDLE_TIMEOUT_MS,
      closeMessage: 'MUD idle timeout',
      onMessage: (_opcode, payload) => {
        if (!target.destroyed && payload.length > 0) target.write(payload);
      },
      onClose: () => {
        activeMudClients = Math.max(0, activeMudClients - 1);
        target.destroy();
      }
    });

    target.on('data', (chunk) => {
      ws.lastActiveAt = Date.now();
      const payload = TELNET_FILTER ? telnetFilter.process(chunk) : chunk;
      if (payload.length > 0) ws.sendBinary(payload);
    });
    target.on('error', (error) => {
      ws.sendText(`\n[gateway] MUHAN server error: ${error.message}\n`);
      ws.sendClose(1011, 'MUHAN server error');
      ws.closeSoon();
    });
    target.on('close', () => {
      ws.sendText('\n[gateway] MUHAN server disconnected.\n');
      ws.sendClose(1011, 'MUHAN server disconnected');
      ws.closeSoon();
    });
    target.on('end', () => ws.closeSoon());

    if (head && head.length > 0) ws.handleData(head);
  });
}

function spawnAgentProcess() {
  const env = {
    ...process.env,
    TERM: process.env.TERM || 'xterm-256color',
    COLORTERM: process.env.COLORTERM || 'truecolor',
    FORCE_COLOR: process.env.FORCE_COLOR || '1'
  };

  const ptyBridge = path.resolve(__dirname, 'pty_bridge.py');
  if (AGENT_USE_SCRIPT && commandExists('python3') && fs.existsSync(ptyBridge)) {
    return spawn('python3', [ptyBridge, '/bin/sh', '-lc', AGENT_COMMAND], {
      cwd: AGENT_WORKDIR,
      env,
      stdio: ['pipe', 'pipe', 'pipe']
    });
  }

  if (AGENT_USE_SCRIPT && commandExists('script')) {
    return spawn('script', ['-q', '-f', '-e', '-c', AGENT_COMMAND, '/dev/null'], {
      cwd: AGENT_WORKDIR,
      env,
      stdio: ['pipe', 'pipe', 'pipe']
    });
  }

  return spawn('/bin/sh', ['-lc', AGENT_COMMAND], {
    cwd: AGENT_WORKDIR,
    env,
    stdio: ['pipe', 'pipe', 'pipe']
  });
}

function handleAgentUpgrade(req, socket, head, secKey) {
  const agent = agentDiagnostic();

  if (AGENT_LOCAL_ONLY && !isLocalAddress(req.socket.remoteAddress)) {
    rejectUpgrade(socket, 403, 'Agent console is local-only');
    return;
  }

  if (!agent.enabled) {
    rejectUpgrade(socket, 403, 'AI agent console is disabled. Set ENABLE_AGENT=1.');
    return;
  }

  if (!agent.ready) {
    rejectUpgrade(socket, 503, agent.error || 'AI agent is not ready');
    return;
  }

  if (AGENT_MAX_SESSIONS > 0 && activeAgentSessions >= AGENT_MAX_SESSIONS) {
    rejectUpgrade(socket, 429, 'Too many AI agent sessions');
    return;
  }

  acceptUpgrade(socket, secKey);

  activeAgentSessions += 1;
  totalAgentSessions += 1;

  const child = spawnAgentProcess();
  agentChildren.add(child);
  let childExited = false;

  const ws = new WebSocketConnection(socket, {
    idleTimeoutMs: AGENT_IDLE_TIMEOUT_MS,
    closeMessage: 'AI agent idle timeout',
    onMessage: (_opcode, payload) => {
      if (!childExited && child.stdin && !child.stdin.destroyed && payload.length > 0) {
        child.stdin.write(payload);
      }
    },
    onClose: () => {
      activeAgentSessions = Math.max(0, activeAgentSessions - 1);
      child.kill('SIGTERM');
      setTimeout(() => {
        if (!childExited) child.kill('SIGKILL');
      }, 1000).unref?.();
    }
  });

  ws.sendText(
    `[agent] starting: ${AGENT_COMMAND}\n` +
      `[agent] workdir: ${AGENT_WORKDIR}\n` +
      (AGENT_USE_SCRIPT && !agent.ptyBridgeAvailable && !agent.scriptAvailable ? '[agent] note: no PTY bridge available; using plain shell stdio.\n' : '')
  );

  child.stdout.on('data', (chunk) => {
    ws.lastActiveAt = Date.now();
    ws.sendBinary(chunk);
  });
  child.stderr.on('data', (chunk) => {
    ws.lastActiveAt = Date.now();
    ws.sendBinary(chunk);
  });
  child.once('error', (error) => {
    childExited = true;
    agentChildren.delete(child);
    ws.sendText(`\n[agent] failed to start: ${error.message}\n`);
    ws.sendClose(1011, 'agent start failed');
    ws.closeSoon();
  });
  child.once('close', (code, signal) => {
    childExited = true;
    agentChildren.delete(child);
    ws.sendText(`\n[agent] process exited${signal ? ` by ${signal}` : ` with code ${code}`}\n`);
    ws.sendClose(1000, 'agent exited');
    ws.closeSoon();
  });

  if (head && head.length > 0) ws.handleData(head);
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
  const secKey = validateUpgrade(req, socket);
  if (!secKey) return;

  if (url.pathname === MUD_WS_PATH || url.pathname === LEGACY_WS_PATH) {
    handleMudUpgrade(req, socket, head, secKey);
    return;
  }

  if (url.pathname === AGENT_WS_PATH) {
    handleAgentUpgrade(req, socket, head, secKey);
    return;
  }

  rejectUpgrade(socket, 404, 'WebSocket endpoint not found');
});

server.listen(WEB_PORT, WEB_HOST, () => {
  console.log(`[gateway] web: http://${WEB_HOST}:${WEB_PORT}`);
  console.log(`[gateway] MUD websocket: ${MUD_WS_PATH} (legacy ${LEGACY_WS_PATH})`);
  console.log(`[gateway] MUD target: ${MUHAN_HOST}:${MUHAN_PORT}`);
  console.log(`[gateway] MUD max clients: ${MAX_CLIENTS}`);
  console.log('[gateway] authentication: none (local single-user mode)');
  console.log(`[gateway] telnet filter: ${TELNET_FILTER ? 'enabled' : 'disabled'}`);
  console.log(`[gateway] healthcheck target probe: ${HEALTHCHECK_TARGET ? 'enabled' : 'disabled'}`);
  console.log(`[gateway] AI agent websocket: ${AGENT_WS_PATH}`);
  console.log(`[gateway] AI agent: ${ENABLE_AGENT ? 'enabled' : 'disabled'} (${AGENT_COMMAND})`);
  console.log(`[gateway] AI agent workdir: ${AGENT_WORKDIR}`);
});

function shutdown() {
  for (const child of agentChildren) child.kill('SIGTERM');
  setTimeout(() => {
    for (const child of agentChildren) child.kill('SIGKILL');
  }, 1000).unref?.();
  server.close(() => process.exit(0));
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
