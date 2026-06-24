'use strict';

const MAX_BUFFER_CHARS = 240_000;
const HISTORY_LIMIT = 80;
const APP_VERSION = document.querySelector('meta[name="app-version"]')?.content || '0.8.0';

const statusEl = document.getElementById('status');
const diagnosticsEl = document.getElementById('diagnostics');
const screenEl = document.getElementById('gameScreen');
const commandEl = document.getElementById('gameCommand');
const formEl = document.getElementById('gameForm');
const connectBtn = document.getElementById('gameConnect');
const disconnectBtn = document.getElementById('gameDisconnect');
const sendBtn = document.getElementById('gameSend');
const clearBtn = document.getElementById('gameClear');
const nekoBtn = document.getElementById('gameEnter');
const checkStatusBtn = document.getElementById('checkStatus');
const autoScrollEl = document.getElementById('autoScroll');

const names = [
  '검객루안', '달빛상인', '하늘도사', '백야검', '연화술사', '청풍객', '비류', '묵향', '서리궁수', '단목',
  '초롱도적', '은비', '무영', '해월', '자운', '흑린', '소하', '강철비', '운랑', '나린',
  '마루', '도윤', '초아', '류하', '태산', '진서', '별하', '유겸', '아라', '호연',
  '설아', '이안', '가온', '라온', '미르', '해솔', '봄비', '서율', '하람', '윤슬',
  '노을', '비안', '시온', '도겸', '채운', '은결', '태오', '유하', '다온', '새벽',
  '월영', '청아', '흑월', '백운', '비천', '화린', '풍백', '검우', '호림', '류운',
  '월하', '천랑', '강호초보', '만두상인', '비단장수', '낡은검', '고요', '파랑새', '오래된별', '칠성',
  '사월', '초승', '구름검', '무림객', '은하수', '단비', '진홍', '연무', '벽력', '창천',
  '적월', '소금장수', '산들', '태극', '여울', '매화', '비호', '검은별', '푸른달', '나그네',
  '도깨비불', '호수', '하늬', '은도끼', '불새', '그림자', '찬솔', '담쟁이', '무명검', '파천'
];

const rooms = {
  '중앙광장': {
    exits: ['북문', '주막', '수련장'],
    desc: '푸른 전광판 아래에 접속자 명단이 흐르고 있다.'
  },
  '북문': {
    exits: ['중앙광장', '초보사냥터'],
    desc: '성문 밖에서 낮은 북소리가 들린다.'
  },
  '주막': {
    exits: ['중앙광장', '장터'],
    desc: '소문과 농담이 가장 빨리 모이는 곳이다.'
  },
  '수련장': {
    exits: ['중앙광장'],
    desc: '낡은 목검과 허수아비가 줄지어 서 있다.'
  },
  '장터': {
    exits: ['주막'],
    desc: '상인들이 회복약과 낡은 장비를 펼쳐 놓았다.'
  },
  '초보사냥터': {
    exits: ['북문'],
    desc: '작은 괴물의 발자국이 흙길 위에 남아 있다.'
  }
};

const chatter = [
  '지금 중앙광장 사람 많다.',
  '초보는 수련장에서 감 잡고 나가면 편해.',
  '네코가 생각보다 똑똑하네.',
  '장터에 회복약 싸게 떴다.',
  '북문 밖은 아직 조심해야 해.',
  '누구 파티 할 사람?',
  '오늘 접속자가 꽤 많네.',
  '명령어 모르면 네코에게 물어봐.'
];

let connected = false;
let outputBuffer = '';
let history = [];
let historyIndex = 0;
let roomName = '중앙광장';
let tickTimer = null;
let lastSpeaker = names[0];

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function setStatus(text, className) {
  statusEl.textContent = text;
  statusEl.className = className || '';
}

function setDiagnostics(text) {
  diagnosticsEl.textContent = text;
}

function append(text) {
  outputBuffer += String(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (outputBuffer.length > MAX_BUFFER_CHARS) outputBuffer = outputBuffer.slice(outputBuffer.length - MAX_BUFFER_CHARS);
  screenEl.textContent = outputBuffer;
  if (autoScrollEl.checked) screenEl.scrollTop = screenEl.scrollHeight;
}

function clearScreen() {
  outputBuffer = '';
  screenEl.textContent = '';
}

function setConnected(value) {
  connected = value;
  connectBtn.disabled = value;
  disconnectBtn.disabled = !value;
  commandEl.disabled = !value;
  sendBtn.disabled = !value;
  nekoBtn.disabled = !value;
  if (value) commandEl.focus();
}

function roomUsers() {
  const offset = Object.keys(rooms).indexOf(roomName) * 13;
  return Array.from({ length: 12 }, (_, index) => names[(offset + index) % names.length]);
}

function look() {
  const room = rooms[roomName];
  append(`\n[${roomName}]\n${room.desc}\n출구: ${room.exits.join(', ')}\n주변 유저: ${roomUsers().join(', ')}\n`);
}

function neko(question = '') {
  const q = question.trim();
  let answer = '궁금한 건 그냥 말해. "도움", "유저", "보기", "이동 주막", "말 안녕" 같은 식이면 돼.';

  if (/어디|위치|길|가야|이동/.test(q)) answer = `지금은 ${roomName}. 갈 수 있는 곳은 ${rooms[roomName].exits.join(', ')}야.`;
  if (/명령|도움|뭐.*해|방법/.test(q)) answer = '쓸 수 있는 명령은 도움, 보기, 유저, 이동 장소, 말 내용, 귓 이름 내용, 네코 질문이야.';
  if (/사람|유저|누구/.test(q)) answer = `현재 가상 유저 100명이 접속 중이야. 이 방에는 ${roomUsers().slice(0, 6).join(', ')} 등이 있어.`;
  if (/사냥|전투|초보/.test(q)) answer = '처음이면 수련장으로 가서 분위기를 보고, 그 다음 북문을 지나 초보사냥터로 가면 돼.';
  if (/고양|네코|너/.test(q)) answer = '나는 네코. 네 옆을 따라다니면서 길, 명령어, 사람들 반응을 알려주는 검은 고양이야.';

  append(`\n네코: ${answer}\n`);
}

function listUsers() {
  append(`\n[접속자 100명]\n${names.map((name, index) => `${String(index + 1).padStart(3, '0')} ${name}`).join('\n')}\n`);
}

function say(message) {
  if (!message.trim()) {
    neko('말 명령어');
    return;
  }

  append(`\n나: ${message}\n`);
  const responders = roomUsers().slice(0, 3);
  responders.forEach((name, index) => {
    const response = index === 0
      ? `${message.includes('?') || message.includes('？') ? '그건 네코에게도 물어봐.' : '좋아, 같이 보자.'}`
      : pick(['반가워.', '여기서 자주 보자.', '나도 방금 그 생각했어.', '주막 쪽 소문도 들어봐.']);
    append(`${name}: ${response}\n`);
  });
}

function whisper(input) {
  const [target, ...rest] = input.trim().split(/\s+/);
  if (!target || rest.length === 0) {
    append('\n사용법: 귓 이름 내용\n');
    return;
  }

  const name = names.find((candidate) => candidate === target) || target;
  append(`\n귓속말 -> ${name}: ${rest.join(' ')}\n${name}: 응, 들었어. 지금 ${roomName} 근처에 있어.\n`);
}

function move(destination) {
  const target = destination.trim();
  if (!target) {
    append(`\n이동할 곳을 입력해. 출구: ${rooms[roomName].exits.join(', ')}\n`);
    return;
  }

  if (!rooms[roomName].exits.includes(target)) {
    append(`\n그쪽으로는 바로 갈 수 없어. 출구: ${rooms[roomName].exits.join(', ')}\n`);
    return;
  }

  roomName = target;
  append(`\n${roomName}(으)로 이동했다.\n`);
  look();
}

function help() {
  append(`\n[명령어]\n도움              이 안내\n보기              현재 장소 보기\n유저              가상 유저 100명 보기\n말 내용           주변 유저와 대화\n귓 이름 내용      특정 유저에게 말하기\n이동 장소         장소 이동\n네코 질문         네코에게 묻기\n\n예) 네코 어디로 가야 해?\n예) 말 안녕하세요\n`);
}

function ambientChat() {
  if (!connected) return;
  const user = pick(roomUsers());
  lastSpeaker = user;
  append(`\n${user}: ${pick(chatter)}\n`);
}

function connect() {
  if (connected) return;

  setConnected(true);
  setStatus('입장 완료', 'online');
  setDiagnostics(`GATEWAY ${APP_VERSION}\nMUD 브라우저 시뮬레이션 준비됨\nAI 유저 100명 / 네코 동행`);
  clearScreen();
  append(`무한대전에 입장했습니다.\nVercel에서는 브라우저 안에서 바로 진행됩니다.\n\n검은 고양이 네코가 조용히 옆에 앉습니다.\n네코: 길을 잃으면 나한테 물어봐. "네코 도움"이라고 해도 좋아.\n`);
  look();
  tickTimer = window.setInterval(ambientChat, 5000);
}

function disconnect() {
  if (!connected) return;
  window.clearInterval(tickTimer);
  tickTimer = null;
  setConnected(false);
  setStatus('퇴장', 'offline');
  append('\n접속을 종료했습니다.\n');
}

function runCommand(raw) {
  const input = raw.trim();
  if (!input) {
    neko();
    return;
  }

  const [command, ...rest] = input.split(/\s+/);
  const body = rest.join(' ');

  if (['도움', 'help', '?', '명령'].includes(command)) help();
  else if (['보기', 'look', 'l'].includes(command)) look();
  else if (['유저', '누구', 'users'].includes(command)) listUsers();
  else if (['말', '채팅', 'say'].includes(command)) say(body);
  else if (['귓', '귓속말', 'tell'].includes(command)) whisper(body);
  else if (['이동', '가', 'move'].includes(command)) move(body);
  else if (command === '네코') neko(body);
  else if (names.includes(command)) whisper(input);
  else say(input);

  if (Math.random() > 0.55) append(`${lastSpeaker}: ${pick(['네코 말대로 해봐.', '좋은 질문이야.', '나도 따라갈게.', '잠깐, 주변을 먼저 봐.'])}\n`);
}

connectBtn.addEventListener('click', connect);
disconnectBtn.addEventListener('click', disconnect);
clearBtn.addEventListener('click', clearScreen);
nekoBtn.addEventListener('click', () => neko('도움'));
checkStatusBtn.addEventListener('click', () => setDiagnostics(`GATEWAY ${APP_VERSION}\nMUD 브라우저 시뮬레이션 ${connected ? '접속 중' : '대기 중'}\nAI 유저 100명 / 네코 동행`));

formEl.addEventListener('submit', (event) => {
  event.preventDefault();
  const input = commandEl.value;
  commandEl.value = '';
  if (input.trim()) {
    history.push(input);
    if (history.length > HISTORY_LIMIT) history = history.slice(-HISTORY_LIMIT);
    historyIndex = history.length;
  }
  runCommand(input);
});

commandEl.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowUp') {
    event.preventDefault();
    historyIndex = Math.max(0, historyIndex - 1);
    commandEl.value = history[historyIndex] || '';
  }

  if (event.key === 'ArrowDown') {
    event.preventDefault();
    historyIndex = Math.min(history.length, historyIndex + 1);
    commandEl.value = history[historyIndex] || '';
  }
});

window.addEventListener('beforeunload', () => window.clearInterval(tickTimer));

setConnected(false);
setStatus('입장 대기', '');
setDiagnostics(`GATEWAY ${APP_VERSION}\nMUD 브라우저 시뮬레이션 대기 중\nAI 유저 100명 / 네코 동행`);
append('무한대전 PC통신 접속 대기\n\n1. 입장\n2. 퇴장\n3. 네코\n4. 화면 지우기\n5. 상태 확인\n\n입장하면 네코와 100명의 가상 유저가 함께합니다.\n');
