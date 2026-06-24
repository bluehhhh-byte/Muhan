'use strict';

const STARTED_AT = new Date();
const VERSION = '0.7.1';

module.exports = function handler(req, res) {
  res.setHeader('cache-control', 'no-store');
  res.status(200).json({
    ok: true,
    gateway: {
      name: 'muhan-web-runner',
      version: VERSION,
      startedAt: STARTED_AT.toISOString(),
      uptimeSec: Math.round((Date.now() - STARTED_AT.getTime()) / 1000),
      accessTokenRequired: false
    },
    mud: {
      target: 'unavailable on Vercel',
      websocketPath: '/ws/mud',
      legacyWebsocketPath: '/ws',
      activeClients: 0,
      totalClients: 0,
      maxClients: 0,
      telnetFilter: true,
      ready: false,
      error: 'Vercel cannot run this TCP/WebSocket gateway'
    },
    agent: {
      enabled: false,
      ready: false,
      command: 'agy',
      workdir: '/workspace',
      websocketPath: '/ws/agent',
      activeSessions: 0,
      totalSessions: 0,
      maxSessions: 0,
      useScriptPty: false,
      scriptAvailable: false,
      ptyBridgeAvailable: false,
      localOnly: false,
      error: 'disabled'
    }
  });
};
