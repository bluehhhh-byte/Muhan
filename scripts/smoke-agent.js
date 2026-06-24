#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const http = require('http');
const net = require('net');
const { spawn } = require('child_process');

function listen(server, host = '127.0.0.1', port = 0) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.off('error', reject);
      resolve(server.address().port);
    });
  });
}

function httpOk(port, path = '/healthz') {
  return new Promise((resolve) => {
    const req = http.get({ host: '127.0.0.1', port, path, timeout: 700 }, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    req.on('error', () => resolve(false));
  });
}

async function waitForHttp(port, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await httpOk(port)) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`gateway did not become healthy on port ${port}`);
}

function encodeClientFrame(text) {
  const payload = Buffer.from(text, 'utf8');
  const mask = crypto.randomBytes(4);
  let header;
  if (payload.length < 126) {
    header = Buffer.from([0x81, 0x80 | payload.length]);
  } else if (payload.length <= 0xffff) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 0x80 | 126;
    header.writeUInt16BE(payload.length, 2);
  } else {
    throw new Error('test frame too large');
  }

  const masked = Buffer.alloc(payload.length);
  for (let i = 0; i < payload.length; i += 1) masked[i] = payload[i] ^ mask[i % 4];
  return Buffer.concat([header, mask, masked]);
}

class WsReader {
  constructor(socket) {
    this.socket = socket;
    this.buffer = Buffer.alloc(0);
    this.waiters = [];
    socket.on('data', (chunk) => {
      this.buffer = Buffer.concat([this.buffer, chunk]);
      this.flush();
    });
    socket.on('error', (error) => this.rejectAll(error));
    socket.on('close', () => this.rejectAll(new Error('socket closed')));
  }

  rejectAll(error) {
    for (const waiter of this.waiters.splice(0)) waiter.reject(error);
  }

  flush() {
    while (this.waiters.length > 0) {
      const frame = this.tryReadFrame();
      if (!frame) return;
      this.waiters.shift().resolve(frame);
    }
  }

  readFrame(timeoutMs = 3000) {
    const existing = this.tryReadFrame();
    if (existing) return Promise.resolve(existing);

    return new Promise((resolve, reject) => {
      const waiter = {
        resolve: (value) => {
          clearTimeout(waiter.timer);
          resolve(value);
        },
        reject: (error) => {
          clearTimeout(waiter.timer);
          reject(error);
        },
        timer: null
      };
      waiter.timer = setTimeout(() => {
        const index = this.waiters.indexOf(waiter);
        if (index >= 0) this.waiters.splice(index, 1);
        reject(new Error('timed out waiting for websocket frame'));
      }, timeoutMs);
      this.waiters.push(waiter);
    });
  }

  tryReadFrame() {
    if (this.buffer.length < 2) return null;
    const first = this.buffer[0];
    const second = this.buffer[1];
    let length = second & 0x7f;
    let offset = 2;

    if (length === 126) {
      if (this.buffer.length < 4) return null;
      length = this.buffer.readUInt16BE(2);
      offset = 4;
    } else if (length === 127) {
      if (this.buffer.length < 10) return null;
      const big = this.buffer.readBigUInt64BE(2);
      if (big > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('frame too large');
      length = Number(big);
      offset = 10;
    }

    const masked = (second & 0x80) !== 0;
    let mask;
    if (masked) {
      if (this.buffer.length < offset + 4) return null;
      mask = this.buffer.subarray(offset, offset + 4);
      offset += 4;
    }

    if (this.buffer.length < offset + length) return null;
    let payload = this.buffer.subarray(offset, offset + length);
    this.buffer = this.buffer.subarray(offset + length);

    if (masked) {
      const unmasked = Buffer.alloc(payload.length);
      for (let i = 0; i < payload.length; i += 1) unmasked[i] = payload[i] ^ mask[i % 4];
      payload = unmasked;
    }

    return { fin: (first & 0x80) !== 0, opcode: first & 0x0f, payload };
  }
}

function connectWebSocket(port, path = '/ws/agent') {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: '127.0.0.1', port });
    const key = crypto.randomBytes(16).toString('base64');
    let handshake = Buffer.alloc(0);

    const onData = (chunk) => {
      handshake = Buffer.concat([handshake, chunk]);
      const marker = handshake.indexOf('\r\n\r\n');
      if (marker === -1) return;
      socket.off('data', onData);
      const header = handshake.subarray(0, marker).toString('latin1');
      if (!header.startsWith('HTTP/1.1 101')) {
        socket.destroy();
        reject(new Error(`websocket upgrade failed: ${header.split('\r\n')[0]}`));
        return;
      }
      const leftover = handshake.subarray(marker + 4);
      const reader = new WsReader(socket);
      if (leftover.length > 0) {
        reader.buffer = Buffer.concat([reader.buffer, leftover]);
        reader.flush();
      }
      resolve({ socket, reader });
    };

    socket.once('connect', () => {
      socket.write(
        `GET ${path} HTTP/1.1\r\n` +
          `Host: 127.0.0.1:${port}\r\n` +
          `Upgrade: websocket\r\n` +
          `Connection: Upgrade\r\n` +
          `Sec-WebSocket-Version: 13\r\n` +
          `Sec-WebSocket-Key: ${key}\r\n` +
          `\r\n`
      );
    });
    socket.on('data', onData);
    socket.once('error', reject);
  });
}

async function main() {
  const webProbe = net.createServer();
  const webPort = await listen(webProbe);
  await new Promise((resolve) => webProbe.close(resolve));

  const child = spawn(process.execPath, ['server/server.js'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      WEB_HOST: '127.0.0.1',
      WEB_PORT: String(webPort),
      ENABLE_AGENT: '1',
      AGENT_COMMAND: '/bin/cat',
      AGENT_WORKDIR: process.cwd(),
      // Use plain stdio for deterministic echo testing. The real browser agent
      // path still uses PTY by default; `npm run check` validates the PTY bridge syntax.
      AGENT_USE_SCRIPT: '0',
      HEALTHCHECK_TARGET: '0'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let childOutput = '';
  child.stdout.on('data', (chunk) => { childOutput += chunk.toString(); });
  child.stderr.on('data', (chunk) => { childOutput += chunk.toString(); });

  try {
    await waitForHttp(webPort);
    const { socket, reader } = await connectWebSocket(webPort, '/ws/agent');

    let seen = '';
    for (let i = 0; i < 3; i += 1) {
      const frame = await reader.readFrame();
      seen += frame.payload.toString('utf8');
      if (seen.includes('starting')) break;
    }

    socket.write(encodeClientFrame('ping-agent\n'));
    for (let i = 0; i < 5 && !seen.includes('ping-agent'); i += 1) {
      const frame = await reader.readFrame();
      seen += frame.payload.toString('utf8');
    }

    if (!seen.includes('ping-agent')) {
      throw new Error(`unexpected agent output: ${seen}`);
    }

    socket.destroy();
    console.log('agent smoke passed');
  } catch (error) {
    console.error(childOutput);
    throw error;
  } finally {
    child.kill('SIGTERM');
  }
}

main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exit(1);
});
