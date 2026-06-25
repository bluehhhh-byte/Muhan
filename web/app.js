'use strict';

const MAX_LINES = 700;
const HISTORY_LIMIT = 80;
const SETTINGS_KEY = 'muhan.neko.settings';
const APP_VERSION = document.querySelector('meta[name="app-version"]')?.content || '0.9.0';

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

const fields = {
  apiKey: document.getElementById('geminiApiKey'),
  model: document.getElementById('geminiModel'),
  gender: document.getElementById('nekoGender'),
  tone: document.getElementById('nekoTone'),
  level: document.getElementById('nekoLevel'),
  ability: document.getElementById('nekoAbility'),
  prompt: document.getElementById('nekoPrompt')
};

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
  '중앙광장': { exits: ['북문', '주막', '수련장'], desc: '푸른 전광판 아래에 접속자 명단이 흐르고 있다.' },
  '북문': { exits: ['중앙광장', '초보사냥터'], desc: '성문 밖에서 낮은 북소리가 들린다.' },
  '주막': { exits: ['중앙광장', '장터'], desc: '소문과 농담이 가장 빨리 모이는 곳이다.' },
  '수련장': { exits: ['중앙광장'], desc: '낡은 목검과 허수아비가 줄지어 서 있다.' },
  '장터': { exits: ['주막'], desc: '상인들이 회복약과 낡은 장비를 펼쳐 놓았다.' },
  '초보사냥터': { exits: ['북문'], desc: '작은 괴물의 발자국이 흙길 위에 남아 있다.' }
};

const chatter = [
  '지금 중앙광장 사람 많다.', '초보는 수련장에서 감 잡고 나가면 편해.', '네코가 생각보다 똑똑하네.',
  '장터에 회복약 싸게 떴다.', '북문 밖은 아직 조심해야 해.', '누구 파티 할 사람?',
  '오늘 접속자가 꽤 많네.', '명령어 모르면 네코에게 물어봐.'
];

const randomSettings = {
  gender: ['검은 고양이', '여성 목소리의 고양이', '소년 같은 검은 고양이', '성별을 알 수 없는 신비한 고양이'],
  tone: ['상냥하고 짧게 말함', '장난스럽지만 핵심을 찌름', '무협 사부처럼 말함', 'PC통신 운영자처럼 담백함'],
  level: ['7', '13', '21', '44', '99'],
  ability: ['길찾기와 명령어 해석', '위험 예지', '가상 유저 설득', '숨겨진 소문 탐지', '전투 전술 조언'],
  prompt: [
    '네코는 무한대전의 오래된 접속 기록을 읽을 수 있다. 플레이어가 길을 잃으면 장소, 유저, 다음 행동을 짧게 제안한다.',
    '네코는 장터와 주막 소문에 밝다. 돈, 아이템, 파티 선택을 도와주며 말끝에 가끔 "냐"를 붙인다.',
    '네코는 수련장 출신 전술 고양이다. 전투보다 생존을 우선하고 초보자에게 안전한 선택지를 준다.',
    '네코는 북문 밖을 오래 떠돌았다. 세계관의 음모와 다른 유저의 속내를 암시하지만 과하게 설명하지 않는다.'
  ]
};

let connected = false;
let history = [];
let historyIndex = 0;
let roomName = '중앙광장';
let team = [];
let tickTimer = null;
let lastSpeaker = names[0];
let nekoInteractionId = null;

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

function append(text, className = '') {
  const line = document.createElement('span');
  line.className = `line ${className}`.trim();
  line.textContent = String(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  screenEl.appendChild(line);
  while (screenEl.children.length > MAX_LINES) screenEl.firstChild.remove();
  if (autoScrollEl.checked) screenEl.scrollTop = screenEl.scrollHeight;
}

function clearScreen() {
  screenEl.textContent = '';
}

function currentSettings() {
  return Object.fromEntries(Object.entries(fields).map(([key, field]) => [key, field.value.trim()]));
}

function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(currentSettings()));
  nekoInteractionId = null;
  append('설정이 저장되었습니다. 네코의 대화 기억을 새로 시작합니다.');
}

function loadSettings() {
  const defaults = {
    apiKey: '',
    model: 'gemini-3.5-flash',
    gender: '검은 고양이',
    tone: '상냥하고 짧게 말함',
    level: '7',
    ability: '길찾기와 명령어 해석',
    prompt: randomSettings.prompt[0]
  };
  const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
  for (const [key, value] of Object.entries({ ...defaults, ...saved })) fields[key].value = value;
}

function makeRandomSettings() {
  fields.gender.value = pick(randomSettings.gender);
  fields.tone.value = pick(randomSettings.tone);
  fields.level.value = pick(randomSettings.level);
  fields.ability.value = pick(randomSettings.ability);
  fields.prompt.value = pick(randomSettings.prompt);
  saveSettings();
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

function findUser(query) {
  return names.find((name) => name === query) || names.find((name) => name.includes(query));
}

function look() {
  const room = rooms[roomName];
  append(`\n[${roomName}]\n${room.desc}\n출구: ${room.exits.join(', ')}\n주변 유저: ${roomUsers().join(', ')}\n팀: ${team.length ? team.join(', ') : '없음'}\n`);
}

function fallbackNeko(question = '') {
  const q = question.trim();
  if (/어디|위치|길|가야|이동/.test(q)) return `지금은 ${roomName}. 갈 수 있는 곳은 ${rooms[roomName].exits.join(', ')}야.`;
  if (/팀|파티|동료/.test(q)) return '마음에 드는 유저에게 "팀 이름"이라고 말해봐. 최대 4명까지 함께 움직일 수 있어.';
  if (/명령|도움|뭐.*해|방법/.test(q)) return '도움, 보기, 유저, 이동 장소, 말 내용, 귓 이름 내용, 팀 이름, 팀해산, 네코 질문을 쓸 수 있어.';
  if (/사람|유저|누구/.test(q)) return `가상 유저 100명이 접속 중이야. 이 방에는 ${roomUsers().slice(0, 6).join(', ')} 등이 있어.`;
  if (/사냥|전투|초보/.test(q)) return '처음이면 수련장으로 가고, 팀을 만든 뒤 북문을 지나 초보사냥터로 가면 안전해.';
  return 'API 키를 설정하면 Gemini로 더 자연스럽게 대화할 수 있어. 지금은 기본 네코로 안내할게.';
}

function buildSystemInstruction() {
  const settings = currentSettings();
  return [
    '너는 한국 PC통신 MUD "무한대전" 안에서 주인공 옆을 따라다니는 검은 고양이 네코다.',
    `성별/정체성: ${settings.gender}`,
    `말투: ${settings.tone}`,
    `레벨: ${settings.level}`,
    `특수능력: ${settings.ability}`,
    `추가 설정: ${settings.prompt}`,
    `현재 장소: ${roomName} - ${rooms[roomName].desc}`,
    `출구: ${rooms[roomName].exits.join(', ')}`,
    `주변 유저: ${roomUsers().join(', ')}`,
    `현재 팀: ${team.length ? team.join(', ') : '없음'}`,
    '항상 무한대전 세계관 안에서 답하고, 1~3문장으로 짧게 한국어로 말한다.',
    '필요하면 사용 가능한 명령어를 자연스럽게 추천한다: 보기, 유저, 이동 장소, 말 내용, 귓 이름 내용, 팀 이름.'
  ].join('\n');
}

async function askNeko(question = '') {
  const settings = currentSettings();
  const input = question.trim() || '지금 무엇을 하면 좋을까?';

  if (!settings.apiKey) {
    append(`네코: ${fallbackNeko(input)}`);
    return;
  }

  append('네코: 생각 중...');
  try {
    const res = await fetch('/api/neko', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        apiKey: settings.apiKey,
        model: settings.model || 'gemini-3.5-flash',
        input,
        systemInstruction: buildSystemInstruction(),
        previousInteractionId: nekoInteractionId
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || data.error || 'Gemini 오류');
    if (data.id) nekoInteractionId = data.id;
    append(`네코: ${data.text || fallbackNeko(input)}`);
  } catch (error) {
    append(`네코: Gemini 연결 실패. ${error.message}`);
    append(`네코: ${fallbackNeko(input)}`);
  }
}

function listUsers() {
  append(`\n[접속자 100명]\n${names.map((name, index) => `${String(index + 1).padStart(3, '0')} ${name}`).join('\n')}`);
}

function say(message) {
  if (!message.trim()) {
    askNeko('말 명령어');
    return;
  }

  const responders = roomUsers().filter((name) => !team.includes(name)).slice(0, 3);
  responders.forEach((name, index) => {
    const response = index === 0
      ? `${message.includes('?') || message.includes('？') ? '그건 네코에게도 물어봐.' : '좋아, 같이 보자.'}`
      : pick(['반가워.', '여기서 자주 보자.', '나도 방금 그 생각했어.', '주막 쪽 소문도 들어봐.']);
    append(`${name}: ${response}`);
  });
}

function whisper(input) {
  const [target, ...rest] = input.trim().split(/\s+/);
  if (!target || rest.length === 0) {
    append('사용법: 귓 이름 내용');
    return;
  }

  const name = findUser(target) || target;
  append(`귓속말 -> ${name}: ${rest.join(' ')}`);
  append(`${name}: 응, 들었어. 지금 ${roomName} 근처에 있어.`);
}

function move(destination) {
  const target = destination.trim();
  if (!target) {
    append(`이동할 곳을 입력해. 출구: ${rooms[roomName].exits.join(', ')}`);
    return;
  }

  if (!rooms[roomName].exits.includes(target)) {
    append(`그쪽으로는 바로 갈 수 없어. 출구: ${rooms[roomName].exits.join(', ')}`);
    return;
  }

  roomName = target;
  append(`${roomName}(으)로 이동했다.`);
  if (team.length) append(`${team.join(', ')}: 같이 이동했어.`);
  look();
}

function teamUp(query) {
  const name = findUser(query.trim());
  if (!name) {
    append(`팀으로 부를 유저를 입력해. 주변 유저: ${roomUsers().join(', ')}`);
    return;
  }
  if (team.includes(name)) {
    append(`${name}은 이미 팀에 있습니다.`);
    return;
  }
  if (team.length >= 4) {
    append('팀은 최대 4명까지입니다. 먼저 팀해산을 하거나 다음 버전에서 교체 기능을 쓰세요.');
    return;
  }
  team.push(name);
  append(`${name}: 좋아, 같이 가자.`, 'ally');
  append(`현재 팀: ${team.join(', ')}`);
}

function clearTeam() {
  team = [];
  append('팀을 해산했습니다.');
}

function help() {
  append(`\n[명령어]\n도움              이 안내\n보기              현재 장소 보기\n유저              가상 유저 100명 보기\n말 내용           주변 유저와 대화\n귓 이름 내용      특정 유저에게 말하기\n팀 이름           AI 유저를 동료로 영입\n팀                현재 팀 보기\n팀해산            팀 해산\n이동 장소         장소 이동\n네코 질문         Gemini 네코에게 묻기\n설정              설정창 보기\n랜덤              네코 설정 랜덤 생성\n\n예) 네코 어디로 가야 해?\n예) 팀 검객루안\n예) 말 안녕하세요`);
}

function ambientChat() {
  if (!connected) return;
  const user = team.length && Math.random() > 0.55 ? pick(team) : pick(roomUsers());
  lastSpeaker = user;
  append(`${user}: ${team.includes(user) ? pick(['내가 앞장설게.', '네코 말도 들어보자.', '다음 방까지 같이 가자.']) : pick(chatter)}`, team.includes(user) ? 'ally' : '');
}

function connect() {
  if (connected) return;

  setConnected(true);
  setStatus('입장 완료', 'online');
  setDiagnostics(`GATEWAY ${APP_VERSION}\nGemini 네코 ${currentSettings().apiKey ? '연결 가능' : 'API 키 대기'}\nAI 유저 100명 / 팀업 가능`);
  clearScreen();
  append('무한대전에 입장했습니다.');
  append('검은 고양이 네코가 조용히 옆에 앉습니다.');
  append('네코: 설정에서 Gemini API 키를 넣으면 내가 진짜로 대화해줄게. 우선 "네코 도움"이라고 해봐.');
  look();
  tickTimer = window.setInterval(ambientChat, 5000);
}

function disconnect() {
  if (!connected) return;
  window.clearInterval(tickTimer);
  tickTimer = null;
  setConnected(false);
  setStatus('퇴장', 'offline');
  append('접속을 종료했습니다.');
}

async function runCommand(raw) {
  const input = raw.trim();
  if (!input) {
    await askNeko();
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
  else if (['팀', '파티'].includes(command) && body) teamUp(body);
  else if (['팀', '파티'].includes(command)) append(`현재 팀: ${team.length ? team.join(', ') : '없음'}`);
  else if (['팀해산', '파티해산'].includes(command)) clearTeam();
  else if (command === '네코') await askNeko(body);
  else if (command === '설정') document.querySelector('.settings').open = true;
  else if (command === '랜덤') makeRandomSettings();
  else if (names.includes(command)) whisper(input);
  else say(input);

  if (Math.random() > 0.6) append(`${lastSpeaker}: ${pick(['네코 말대로 해봐.', '좋은 질문이야.', '나도 따라갈게.', '잠깐, 주변을 먼저 봐.'])}`);
}

connectBtn.addEventListener('click', connect);
disconnectBtn.addEventListener('click', disconnect);
clearBtn.addEventListener('click', clearScreen);
nekoBtn.addEventListener('click', () => askNeko('도움'));
checkStatusBtn.addEventListener('click', () => setDiagnostics(`GATEWAY ${APP_VERSION}\nGemini 네코 ${currentSettings().apiKey ? '연결 가능' : 'API 키 대기'}\nAI 유저 100명 / 팀 ${team.length ? team.join(', ') : '없음'}`));
document.getElementById('saveSettings').addEventListener('click', saveSettings);
document.getElementById('randomSettings').addEventListener('click', makeRandomSettings);

formEl.addEventListener('submit', async (event) => {
  event.preventDefault();
  const input = commandEl.value;
  commandEl.value = '';
  if (input.trim()) {
    history.push(input);
    if (history.length > HISTORY_LIMIT) history = history.slice(-HISTORY_LIMIT);
    historyIndex = history.length;
    append(`선택> ${input}`, 'user');
  }
  await runCommand(input);
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

loadSettings();
setConnected(false);
setStatus('입장 대기', '');
setDiagnostics(`GATEWAY ${APP_VERSION}\nGemini 네코 ${currentSettings().apiKey ? '연결 가능' : 'API 키 대기'}\nAI 유저 100명 / 팀업 가능`);
append('무한대전 PC통신 접속 대기');
append('1. 입장  2. 퇴장  3. 네코  4. 화면 지우기  5. 상태 확인');
append('설정에서 Gemini API 키와 네코 성격을 넣거나 랜덤 생성하세요.');
