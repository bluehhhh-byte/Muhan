'use strict';

const MAX_BUFFER_CHARS = 240_000;
const HISTORY_LIMIT = 80;
const APP_VERSION = document.querySelector('meta[name="app-version"]')?.content || '0.7.0';

const statusEl = document.getElementById('status');
const diagnosticsEl = document.getElementById('diagnostics');
const gatewayStateEl = document.getElementById('gatewayState');
const mudStateEl = document.getElementById('mudState');
const agentStateEl = document.getElementById('agentState');
const clientStateEl = document.getElementById('clientState');
const checkStatusBtn = document.getElementById('checkStatus');
const stripAnsiEl = document.getElementById('stripAnsi');
const autoScrollEl = document.getElementById('autoScroll');
const agentHelpTextEl = document.getElementById('agentHelpText');

function setStatus(text, className) {
  statusEl.textContent = text;
  statusEl.className = `status ${className || ''}`.trim();
}

function setDiagnostics(text) {
  diagnosticsEl.textContent = text;
}

function stripAnsi(text) {
  return text
    .replace(/\x1B\][^\x07]*(?:\x07|\x1B\\)/g, '')
    .replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, '');
}

function normalizeTerminalText(text) {
  let value = String(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (stripAnsiEl.checked) value = stripAnsi(value);
  return value;
}

function wsUrl(pathname) {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return new URL(`${protocol}//${window.location.host}${pathname}`);
}

function safeErrorMessage(error) {
  return error && error.message ? error.message : String(error || 'unknown error');
}

class TerminalSession {
  constructor(options) {
    this.name = options.name;
    this.path = options.path;
    this.screenEl = options.screenEl;
    this.commandEl = options.commandEl;
    this.formEl = options.formEl;
    this.connectBtn = options.connectBtn;
    this.disconnectBtn = options.disconnectBtn;
    this.sendBtn = options.sendBtn;
    this.clearBtn = options.clearBtn;
    this.enterBtn = options.enterBtn || null;
    this.ctrlCBtn = options.ctrlCBtn || null;
    this.eofBtn = options.eofBtn || null;
    this.arrowUpBtn = options.arrowUpBtn || null;
    this.arrowDownBtn = options.arrowDownBtn || null;
    this.lineEnding = options.lineEnding || '\n';
    this.connectedLabel = options.connectedLabel || `${this.name} 연결됨`;
    this.connectingLabel = options.connectingLabel || `${this.name} 연결 중`;
    this.disconnectedLabel = options.disconnectedLabel || `${this.name} 연결 종료`;

    this.socket = null;
    this.outputBuffer = '';
    this.history = [];
    this.historyIndex = 0;
    this.decoder = new TextDecoder('utf-8', { fatal: false });

    this.bindEvents();
    this.setConnected(false);
  }

  bindEvents() {
    this.connectBtn.addEventListener('click', () => this.connect());
    this.disconnectBtn.addEventListener('click', () => this.disconnect());
    this.clearBtn.addEventListener('click', () => this.clear());

    if (this.enterBtn) this.enterBtn.addEventListener('click', () => this.sendRaw(this.lineEnding));
    if (this.arrowUpBtn) this.arrowUpBtn.addEventListener('click', () => this.sendRaw('\x1b[A'));
    if (this.arrowDownBtn) this.arrowDownBtn.addEventListener('click', () => this.sendRaw('\x1b[B'));
    if (this.ctrlCBtn) this.ctrlCBtn.addEventListener('click', () => this.sendRaw('\x03'));
    if (this.eofBtn) this.eofBtn.addEventListener('click', () => this.sendRaw('\x04'));

    this.formEl.addEventListener('submit', (event) => {
      event.preventDefault();
      const command = this.commandEl.value;
      this.commandEl.value = '';
      this.sendLine(command);
    });

    this.commandEl.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        if (this.history.length === 0) return;
        this.historyIndex = Math.max(0, this.historyIndex - 1);
        this.commandEl.value = this.history[this.historyIndex] || '';
        this.commandEl.setSelectionRange(this.commandEl.value.length, this.commandEl.value.length);
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        if (this.history.length === 0) return;
        this.historyIndex = Math.min(this.history.length, this.historyIndex + 1);
        this.commandEl.value = this.history[this.historyIndex] || '';
        this.commandEl.setSelectionRange(this.commandEl.value.length, this.commandEl.value.length);
      }

      if (event.ctrlKey && event.key.toLowerCase() === 'l') {
        event.preventDefault();
        this.clear();
      }
    });
  }

  append(text) {
    const normalized = normalizeTerminalText(text);
    let next = this.outputBuffer;

    for (const char of normalized) {
      if (char === '\b') next = next.slice(0, -1);
      else next += char;
    }

    if (next.length > MAX_BUFFER_CHARS) next = next.slice(next.length - MAX_BUFFER_CHARS);

    this.outputBuffer = next;
    this.screenEl.textContent = this.outputBuffer;
    if (autoScrollEl.checked) this.screenEl.scrollTop = this.screenEl.scrollHeight;
  }

  clear() {
    this.outputBuffer = '';
    this.screenEl.textContent = '';
  }

  setConnected(connected) {
    this.connectBtn.disabled = connected;
    this.disconnectBtn.disabled = !connected;
    this.commandEl.disabled = !connected;
    this.sendBtn.disabled = !connected;
    if (this.enterBtn) this.enterBtn.disabled = !connected;
    if (this.ctrlCBtn) this.ctrlCBtn.disabled = !connected;
    if (this.eofBtn) this.eofBtn.disabled = !connected;
    if (this.arrowUpBtn) this.arrowUpBtn.disabled = !connected;
    if (this.arrowDownBtn) this.arrowDownBtn.disabled = !connected;
    if (connected) this.commandEl.focus();
  }

  connect() {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) return;

    setStatus(this.connectingLabel, '');
    this.append(`[gateway] connecting to ${this.path}...\n`);

    this.socket = new WebSocket(wsUrl(this.path));
    this.socket.binaryType = 'arraybuffer';

    this.socket.addEventListener('open', () => {
      this.setConnected(true);
      setStatus(this.connectedLabel, 'online');
      this.append(`[gateway] connected to ${this.path}.\n`);
    });

    this.socket.addEventListener('message', (event) => {
      if (event.data instanceof ArrayBuffer) {
        this.append(this.decoder.decode(event.data, { stream: true }));
        return;
      }
      this.append(event.data);
    });

    this.socket.addEventListener('close', (event) => {
      try {
        const tail = this.decoder.decode();
        if (tail) this.append(tail);
      } catch (_) {
        // ignore decoder flush errors
      }
      this.decoder = new TextDecoder('utf-8', { fatal: false });
      this.setConnected(false);
      setStatus(this.disconnectedLabel, 'offline');
      this.append(`\n[gateway] disconnected${event.reason ? `: ${event.reason}` : ''}.\n`);
      checkStatus();
    });

    this.socket.addEventListener('error', () => {
      this.setConnected(false);
      setStatus(`${this.name} 연결 오류`, 'offline');
      this.append('\n[gateway] websocket error. 상태 카드와 서버 로그를 확인하세요.\n');
    });
  }

  disconnect() {
    if (!this.socket) return;
    this.socket.close(1000, 'user disconnected');
    this.socket = null;
    this.setConnected(false);
  }

  sendLine(command) {
    this.sendRaw(`${command}${this.lineEnding}`);
    if (command.trim()) {
      this.history.push(command);
      if (this.history.length > HISTORY_LIMIT) this.history = this.history.slice(-HISTORY_LIMIT);
      this.historyIndex = this.history.length;
    }
  }

  sendRaw(payload) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      this.append('[gateway] not connected.\n');
      return;
    }
    this.socket.send(payload);
  }

  closeBeforeUnload() {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) this.socket.close(1000, 'page unload');
  }
}

function formatUptime(seconds) {
  const value = Number(seconds || 0);
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const secs = value % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

function updateStatusCards(data) {
  gatewayStateEl.textContent = `정상 · ${formatUptime(data.gateway.uptimeSec)}`;

  if (data.mud.ready) {
    mudStateEl.textContent = `준비됨 · ${data.mud.target}`;
  } else {
    mudStateEl.textContent = data.mud.error ? `미준비 · ${data.mud.error}` : '미준비';
  }

  if (!data.agent.enabled) {
    agentStateEl.textContent = '비활성';
    agentHelpTextEl.textContent = '.env에서 ENABLE_AGENT=1로 켜면 /ws/agent로 AGENT_COMMAND를 실행합니다.';
  } else if (data.agent.ready) {
    agentStateEl.textContent = `준비됨 · ${data.agent.command}`;
    agentHelpTextEl.textContent = `작업 폴더: ${data.agent.workdir}`;
  } else {
    agentStateEl.textContent = `미준비 · ${data.agent.error || '확인 필요'}`;
    agentHelpTextEl.textContent = 'Antigravity CLI 설치 또는 AGENT_COMMAND / AGENT_WORKDIR 설정을 확인하세요.';
  }

  clientStateEl.textContent = `게임 ${data.mud.activeClients}/${data.mud.maxClients}, AI ${data.agent.activeSessions}/${data.agent.maxSessions}`;

  if (data.mud.ready) setStatus('서버 준비됨', 'online');
  else setStatus('MUD 미준비', 'offline');

  const parts = [
    `UI ${APP_VERSION}`,
    `Gateway ${data.gateway.version || 'unknown'} uptime ${formatUptime(data.gateway.uptimeSec)}`,
    `MUD ${data.mud.ready ? 'ready' : 'not ready'} (${data.mud.target})`,
    `AI ${data.agent.enabled ? (data.agent.ready ? 'ready' : 'not ready') : 'disabled'}`
  ];
  if (data.mud.error) parts.push(`MUD error: ${data.mud.error}`);
  if (data.agent.error && data.agent.error !== 'disabled') parts.push(`AI error: ${data.agent.error}`);
  setDiagnostics(parts.join(' · '));
}

async function checkStatus() {
  setDiagnostics('상태 확인 중...');
  try {
    const res = await fetch('/api/status', { cache: 'no-store' });
    const data = await res.json();
    updateStatusCards(data);
  } catch (error) {
    setDiagnostics(`상태 확인 실패: ${safeErrorMessage(error)}`);
    setStatus('상태 확인 실패', 'offline');
    gatewayStateEl.textContent = '확인 실패';
  }
}

const gameSession = new TerminalSession({
  name: '게임',
  path: '/ws/mud',
  screenEl: document.getElementById('gameScreen'),
  commandEl: document.getElementById('gameCommand'),
  formEl: document.getElementById('gameForm'),
  connectBtn: document.getElementById('gameConnect'),
  disconnectBtn: document.getElementById('gameDisconnect'),
  sendBtn: document.getElementById('gameSend'),
  clearBtn: document.getElementById('gameClear'),
  enterBtn: document.getElementById('gameEnter'),
  connectedLabel: '게임 접속됨',
  connectingLabel: '게임 접속 중',
  disconnectedLabel: '게임 연결 종료'
});


const pressAnyKeyBtn = document.getElementById('pressAnyKey');
const bootScreenEl = document.getElementById('bootScreen');
if (pressAnyKeyBtn) {
  pressAnyKeyBtn.addEventListener('click', () => {
    if (!gameSession.socket || gameSession.socket.readyState !== WebSocket.OPEN) gameSession.connect();
    else gameSession.sendRaw('\n');
  });
}
if (bootScreenEl) {
  bootScreenEl.addEventListener('dblclick', () => {
    if (!gameSession.socket || gameSession.socket.readyState !== WebSocket.OPEN) gameSession.connect();
  });
}

const agentSession = new TerminalSession({
  name: 'AI',
  path: '/ws/agent',
  screenEl: document.getElementById('agentScreen'),
  commandEl: document.getElementById('agentCommand'),
  formEl: document.getElementById('agentForm'),
  connectBtn: document.getElementById('agentConnect'),
  disconnectBtn: document.getElementById('agentDisconnect'),
  sendBtn: document.getElementById('agentSend'),
  clearBtn: document.getElementById('agentClear'),
  enterBtn: document.getElementById('agentEnter'),
  arrowUpBtn: document.getElementById('agentArrowUp'),
  arrowDownBtn: document.getElementById('agentArrowDown'),
  ctrlCBtn: document.getElementById('agentCtrlC'),
  eofBtn: document.getElementById('agentEof'),
  lineEnding: '\r',
  connectedLabel: 'AI 개발 콘솔 연결됨',
  connectingLabel: 'AI 개발 콘솔 연결 중',
  disconnectedLabel: 'AI 개발 콘솔 종료'
});

function showTab(tabName) {
  for (const button of document.querySelectorAll('.tab')) {
    button.classList.toggle('active', button.dataset.tab === tabName);
  }
  for (const panel of document.querySelectorAll('.tab-panel')) {
    panel.classList.toggle('active', panel.id === `${tabName}Panel`);
  }

  if (tabName === 'game') document.getElementById('gameCommand').focus();
  if (tabName === 'agent') document.getElementById('agentCommand').focus();
}

for (const button of document.querySelectorAll('.tab')) {
  button.addEventListener('click', () => showTab(button.dataset.tab));
}

checkStatusBtn.addEventListener('click', checkStatus);

window.addEventListener('beforeunload', () => {
  gameSession.closeBeforeUnload();
  agentSession.closeBeforeUnload();
});

gameSession.append(`MUHAN NET 01410 · UI ${APP_VERSION}\n무한대전 PC통신 접속 대기 중입니다. [접속] 버튼을 누르면 MUD 서버에 연결됩니다.\n첫 화면에서 [엔터] 또는 [아무키나 누르세요]가 보이면 Enter를 누르세요.\n\n선택> `);
agentSession.append('ANTIGRAVITY LOCAL DEV CONSOLE\n.env에서 ENABLE_AGENT=1로 켠 뒤 [AI 연결] 버튼을 누르세요. 기본 명령은 agy입니다.\n\nAGY> ');
checkStatus();
setInterval(checkStatus, 10_000);
