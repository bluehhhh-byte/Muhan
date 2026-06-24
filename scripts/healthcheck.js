#!/usr/bin/env node
'use strict';

const http = require('http');

const host = '127.0.0.1';
const port = Number.parseInt(process.env.WEB_PORT || '8080', 10);

const req = http.get({ host, port, path: '/healthz', timeout: 1500 }, (res) => {
  res.resume();
  process.exit(res.statusCode === 200 ? 0 : 1);
});

req.on('timeout', () => {
  req.destroy();
  process.exit(1);
});

req.on('error', () => process.exit(1));
