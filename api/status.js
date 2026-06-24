'use strict';

const STARTED_AT = new Date();
const VERSION = '0.8.0';

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
      target: 'browser simulation',
      websocketPath: '/ws/mud',
      legacyWebsocketPath: '/ws',
      activeClients: 0,
      totalClients: 0,
      maxClients: 100,
      telnetFilter: true,
      ready: true,
      error: null
    },
    agent: {
      enabled: true,
      ready: true,
      command: 'neko-browser-guide',
      workdir: 'browser',
      websocketPath: null,
      activeSessions: 0,
      totalSessions: 0,
      maxSessions: 100,
      useScriptPty: false,
      scriptAvailable: false,
      ptyBridgeAvailable: false,
      localOnly: false,
      error: null
    }
  });
};
