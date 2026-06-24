'use strict';

const screenEl = document.getElementById('screen');
const statusEl = document.getElementById('status');
const tokenEl = document.getElementById('token');
const connectBtn = document.getElementById('connect');
const disconnectBtn = document.getElementById('disconnect');
const sendEnterBtn = document.getElementById('sendEnter');
const clearBtn = document.getElementById('clear');
const checkStatusBtn = document.getElementById('checkStatus');
const diagnosticsEl = document.getElementById('diagnostics');
const commandForm = document.getElementById('commandForm');
const commandEl = document.getElementById('command');
const sendBtn = document.getElementById('send');
const stripAnsiEl = document.getElementById('stripAnsi');
const autoScrollEl = document.getElementById('autoScroll');

const MAX_BUFFER_CHARS = 220_000;
const HISTORY_LIMIT = 100;
let socket = null;
let outputBuffer = '';
let history = [];
let historyIndex = 0;
let terminalDecoder = new TextDecoder('utf-8', { fatal: false });

const savedToken = localStorage.getItem('muhan.accessToken');
if (savedToken) tokenEl.value = savedToken;

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

function appendText(text) {
  const normalized = normalizeTerminalText(text);
  let next = outputBuffer;

  for (const char of normalized) {
    if (char === '\b') {
      next = next.slice(0, -1);
    } else {
      next += char;
    }
  }

  if (next.length > MAX_BUFFER_CHARS) {
    next = next.slice(next.length - MAX_BUFFER_CHARS);
  }

  outputBuffer = next;
  screenEl.textContent = outputBuffer;
  if (autoScrollEl.checked) screenEl.scrollTop = screenEl.scrollHeight;
}

function clearScreen() {
  outputBuffer = '';
  screenEl.textContent = '';
}

function setConnected(connected) {
  connectBtn.disabled = connected;
  disconnectBtn.disabled = !connected;
  sendEnterBtn.disabled = !connected;
  commandEl.disabled = !connected;
  sendBtn.disabled = !connected;
  if (connected) commandEl.focus();
}

function wsUrl() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const url = new URL(`${protocol}//${window.location.host}/ws`);
  const token = tokenEl.value.trim();
  if (token) url.searchParams.set('token', token);
  return url;
}

async function checkStatus() {
  setDiagnostics('상태 확인 중...');
  try {
    const res = await fetch('/api/status', { cache: 'no-store' });
    const data = await res.json();
    const ready = data.targetReady ? 'MUD 준비됨' : 'MUD 미준비';
    const clients = `접속 ${data.activeClients}/${data.maxClients}`;
    const error = data.targetError ? `, 오류: ${data.targetError}` : '';
    setDiagnostics(`${ready}, ${clients}, 대상 ${data.target}${error}`);
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      setStatus(data.targetReady ? '서버 준비됨' : '서버 미준비', data.targetReady ? 'online' : 'offline');
    }
  } catch (error) {
    setDiagnostics(`상태 확인 실패: ${error.message}`);
    if (!socket || socket.readyState !== WebSocket.OPEN) setStatus('상태 확인 실패', 'offline');
  }
}

function connect() {
  if (socket && socket.readyState === WebSocket.OPEN) return;

  const token = tokenEl.value.trim();
  if (token) localStorage.setItem('muhan.accessToken', token);
  else localStorage.removeItem('muhan.accessToken');

  setStatus('접속 중', '');
  appendText('[gateway] connecting...\n');

  socket = new WebSocket(wsUrl());
  socket.binaryType = 'arraybuffer';

  socket.addEventListener('open', () => {
    setConnected(true);
    setStatus('접속됨', 'online');
    appendText('[gateway] connected. 첫 화면에서 “[엔터]”가 보이면 Enter를 누르세요.\n');
  });

  socket.addEventListener('message', async (event) => {
    if (event.data instanceof ArrayBuffer) {
      appendText(terminalDecoder.decode(event.data, { stream: true }));
      return;
    }
    appendText(event.data);
  });

  socket.addEventListener('close', (event) => {
    try {
      const tail = terminalDecoder.decode();
      if (tail) appendText(tail);
    } catch (_) {
      // ignore decoder flush errors
    }
    terminalDecoder = new TextDecoder('utf-8', { fatal: false });
    setConnected(false);
    setStatus('연결 종료', 'offline');
    appendText(`\n[gateway] disconnected${event.reason ? `: ${event.reason}` : ''}.\n`);
    checkStatus();
  });

  socket.addEventListener('error', () => {
    setConnected(false);
    setStatus('연결 오류', 'offline');
    appendText('\n[gateway] websocket error. 서버 로그와 /api/status를 확인하세요.\n');
  });
}

function disconnect() {
  if (!socket) return;
  socket.close(1000, 'user disconnected');
  socket = null;
  setConnected(false);
}

function sendCommand(command) {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    appendText('[gateway] not connected.\n');
    return;
  }

  socket.send(`${command}\n`);
  if (command.trim()) {
    history.push(command);
    if (history.length > HISTORY_LIMIT) history = history.slice(-HISTORY_LIMIT);
    historyIndex = history.length;
  }
}

connectBtn.addEventListener('click', connect);
disconnectBtn.addEventListener('click', disconnect);
sendEnterBtn.addEventListener('click', () => sendCommand(''));
clearBtn.addEventListener('click', clearScreen);
checkStatusBtn.addEventListener('click', checkStatus);

commandForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const command = commandEl.value;
  commandEl.value = '';
  sendCommand(command);
});

commandEl.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowUp') {
    event.preventDefault();
    if (history.length === 0) return;
    historyIndex = Math.max(0, historyIndex - 1);
    commandEl.value = history[historyIndex] || '';
    commandEl.setSelectionRange(commandEl.value.length, commandEl.value.length);
  }

  if (event.key === 'ArrowDown') {
    event.preventDefault();
    if (history.length === 0) return;
    historyIndex = Math.min(history.length, historyIndex + 1);
    commandEl.value = history[historyIndex] || '';
    commandEl.setSelectionRange(commandEl.value.length, commandEl.value.length);
  }

  if (event.ctrlKey && event.key.toLowerCase() === 'l') {
    event.preventDefault();
    clearScreen();
  }
});

window.addEventListener('beforeunload', () => {
  if (socket && socket.readyState === WebSocket.OPEN) socket.close(1000, 'page unload');
});

appendText('무한대전 Web Runner\n접속 버튼을 눌러 서버에 연결하세요. 상태 점검 버튼으로 MUD 포트 준비 상태를 확인할 수 있습니다.\n\n');
setConnected(false);
checkStatus();
