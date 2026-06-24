'use strict';

const screenEl = document.getElementById('screen');
const statusEl = document.getElementById('status');
const tokenEl = document.getElementById('token');
const connectBtn = document.getElementById('connect');
const disconnectBtn = document.getElementById('disconnect');
const clearBtn = document.getElementById('clear');
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
    appendText('[gateway] connected.\n');
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
  });

  socket.addEventListener('error', () => {
    setConnected(false);
    setStatus('연결 오류', 'offline');
    appendText('\n[gateway] websocket error.\n');
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
clearBtn.addEventListener('click', clearScreen);

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

appendText('무한대전 Web Runner\n접속 버튼을 눌러 서버에 연결하세요.\n\n');
setConnected(false);
