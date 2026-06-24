'use strict';

const MAX_BUFFER_CHARS = 240_000;
const HISTORY_LIMIT = 80;
const APP_VERSION = document.querySelector('meta[name="app-version"]')?.content || '0.7.1';

const statusEl = document.getElementById('status');
const diagnosticsEl = document.getElementById('diagnostics');
const checkStatusBtn = document.getElementById('checkStatus');
const stripAnsiEl = document.getElementById('stripAnsi');
const autoScrollEl = document.getElementById('autoScroll');

function setStatus(text, className) {
  statusEl.textContent = text;
  statusEl.className = className || '';
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
    this.path = options.path;
    this.screenEl = options.screenEl;
    this.commandEl = options.commandEl;
    this.formEl = options.formEl;
    this.connectBtn = options.connectBtn;
    this.disconnectBtn = options.disconnectBtn;
    this.sendBtn = options.sendBtn;
    this.clearBtn = options.clearBtn;
    this.enterBtn = options.enterBtn;
    this.lineEnding = '\n';
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
    this.enterBtn.addEventListener('click', () => this.sendRaw(this.lineEnding));

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
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        if (this.history.length === 0) return;
        this.historyIndex = Math.min(this.history.length, this.historyIndex + 1);
        this.commandEl.value = this.history[this.historyIndex] || '';
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
    this.enterBtn.disabled = !connected;
    if (connected) this.commandEl.focus();
  }

  connect() {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) return;

    setStatus('접속 중', '');
    this.append(`[gateway] ${this.path} 접속 시도...\n`);

    this.socket = new WebSocket(wsUrl(this.path));
    this.socket.binaryType = 'arraybuffer';

    this.socket.addEventListener('open', () => {
      this.setConnected(true);
      setStatus('접속됨', 'online');
      this.append(`[gateway] ${this.path} 접속 완료.\n`);
    });

    this.socket.addEventListener('message', (event) => {
      if (event.data instanceof ArrayBuffer) {
        this.append(this.decoder.decode(event.data, { stream: true }));
        return;
      }
      this.append(event.data);
    });

    this.socket.addEventListener('close', (event) => {
      const reason = event.reason ? `: ${event.reason}` : '';
      this.decoder = new TextDecoder('utf-8', { fatal: false });
      this.setConnected(false);
      setStatus('연결 종료', 'offline');
      this.append(`\n[gateway] 연결 종료${reason}.\n`);
      checkStatus();
    });

    this.socket.addEventListener('error', () => {
      this.setConnected(false);
      setStatus('연결 오류', 'offline');
      this.append('\n[gateway] WebSocket 연결 오류.\n');
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
      this.append('[gateway] 아직 접속되지 않았습니다.\n');
      return;
    }
    this.socket.send(payload);
  }

  closeBeforeUnload() {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) this.socket.close(1000, 'page unload');
  }
}

function updateStatus(data) {
  const gateway = data.gateway && data.gateway.version ? `GATEWAY ${data.gateway.version}` : 'GATEWAY 확인';
  const mud = data.mud && data.mud.ready ? 'MUD 준비됨' : `MUD 미준비${data.mud?.error ? ` - ${data.mud.error}` : ''}`;
  setDiagnostics(`${gateway}\n${mud}\nUI ${APP_VERSION}`);
  setStatus(data.mud && data.mud.ready ? '서버 준비됨' : '서버 미준비', data.mud && data.mud.ready ? 'online' : 'offline');
}

async function checkStatus() {
  setDiagnostics('상태 확인 중...');
  try {
    const res = await fetch('/api/status', { cache: 'no-store' });
    updateStatus(await res.json());
  } catch (error) {
    setDiagnostics(`상태 확인 실패: ${safeErrorMessage(error)}`);
    setStatus('상태 확인 실패', 'offline');
  }
}

const gameSession = new TerminalSession({
  path: '/ws/mud',
  screenEl: document.getElementById('gameScreen'),
  commandEl: document.getElementById('gameCommand'),
  formEl: document.getElementById('gameForm'),
  connectBtn: document.getElementById('gameConnect'),
  disconnectBtn: document.getElementById('gameDisconnect'),
  sendBtn: document.getElementById('gameSend'),
  clearBtn: document.getElementById('gameClear'),
  enterBtn: document.getElementById('gameEnter')
});

checkStatusBtn.addEventListener('click', checkStatus);
window.addEventListener('beforeunload', () => gameSession.closeBeforeUnload());

gameSession.append(`무한대전 PC통신 접속 대기\n\n1. 접속\n2. 끊기\n3. 엔터\n4. 화면 지우기\n\n선택> `);
checkStatus();
setInterval(checkStatus, 10_000);
