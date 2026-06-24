'use strict';

const STARTED_AT = new Date().toISOString();
const VERSION = '0.7.1';

module.exports = function handler(req, res) {
  res.setHeader('cache-control', 'no-store');
  res.status(200).json({
    name: 'muhan-web-runner',
    version: VERSION,
    publicDir: 'web',
    startedAt: STARTED_AT,
    cachePolicy: 'no-store'
  });
};
