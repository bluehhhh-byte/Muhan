#!/usr/bin/env node
'use strict';

const net = require('net');

const host = process.argv[2] || '127.0.0.1';
const port = Number.parseInt(process.argv[3] || '4102', 10);
const timeoutMs = Number.parseInt(process.argv[4] || '30000', 10);
const intervalMs = Number.parseInt(process.argv[5] || '250', 10);

function tryConnect() {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    let done = false;

    const finish = (ok) => {
      if (done) return;
      done = true;
      socket.destroy();
      resolve(ok);
    };

    socket.setTimeout(700);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
  });
}

async function main() {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await tryConnect()) {
      console.log(`TCP target is ready: ${host}:${port}`);
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  console.error(`Timed out waiting for TCP target: ${host}:${port}`);
  process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
