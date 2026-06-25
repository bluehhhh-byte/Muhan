'use strict';

const MAX_LINES = 700;
const HISTORY_LIMIT = 80;
const SETTINGS_KEY = 'muhan.neko.settings';
const DEFAULT_MODEL = 'gemini-3.1-flash-lite';
const APP_VERSION = document.querySelector('meta[name="app-version"]')?.content || '0.9.6';

const statusEl = document.getElementById('status');
const diagnosticsEl = document.getElementById('diagnostics');
const screenEl = document.getElementById('gameScreen');
const statusPanelEl = document.getElementById('statusPanel');
const commandEl = document.getElementById('gameCommand');
const formEl = document.getElementById('gameForm');
const connectBtn = document.getElementById('gameConnect');
const disconnectBtn = document.getElementById('gameDisconnect');
const sendBtn = document.getElementById('gameSend');
const clearBtn = document.getElementById('gameClear');
const nekoBtn = document.getElementById('gameEnter');
const checkStatusBtn = document.getElementById('checkStatus');
const autoScrollEl = document.getElementById('autoScroll');
const geminiStatusEl = document.getElementById('geminiTestStatus');

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

const character = {
  name: '무명초보',
  job: '초보검객',
  level: 1,
  hp: '38/38',
  mp: '12/12',
  exp: '0%',
  gold: 120,
  equipment: {
    무기: '낡은 목검',
    방어구: '수련복',
    장신구: '푸른 접속패',
    동료: '네코'
  },
  inventory: ['회복약 x3', '귀환부 x1', '낡은 지도 조각', '주막 쿠폰']
};

const chatter = [
  '지금 중앙광장 사람 많다.', '초보는 수련장에서 감 잡고 나가면 편해.', '네코가 생각보다 똑똑하네.',
  '장터에 회복약 싸게 떴다.', '북문 밖은 아직 조심해야 해.', '누구 파티 할 사람?',
  '오늘 접속자가 꽤 많네.', '명령어 모르면 네코에게 물어봐.', '낡은 게시판에 새 의뢰가 붙었어.',
  '방금 수련장에서 이상한 빛 봤다.', '주막 주인이 오늘은 말을 아끼네.', '초보사냥터에 발자국이 늘었어.',
  '북문 경비가 아까부터 같은 방향만 보고 있어.', '장터 물가가 또 올랐네.', '무명검이 고수라는 소문 들었어?',
  '접속음 들리면 아직도 설렌다.', '누가 방금 귓속말로 암호를 물어봤어.', '오늘은 파티 운이 좋은 날 같다.',
  '중앙광장 전광판 글자가 한 번 깜빡였어.', '파천이 북문 밖에서 돌아왔다던데.', '소금장수가 정보값을 받기 시작했어.',
  '수련장 허수아비 하나가 새것으로 바뀌었네.', '장터 뒤 골목은 아직 막혀 있어.', '주막에서는 조용한 사람이 제일 위험하지.',
  '네코가 싫어하는 길은 보통 위험한 길이야.', '레벨보다 방향감각이 중요할 때도 있더라.', '누가 낡은 지도를 팔고 있어.',
  '초보사냥터는 혼자보다 둘이 낫지.', '북문 밖 안개가 낮게 깔렸어.', '오늘따라 NPC들이 말을 길게 안 해.',
  '무한대전은 오래 볼수록 이상한 데가 보여.', '나 방금 접속했는데 분위기 괜찮네.', '파티 모집은 짧게 말해야 잘 모여.',
  '장터에서 회복약 사는 척하면 소문을 들을 수 있어.', '수련장 목검이 생각보다 아프다.', '주막 구석 자리는 항상 누가 맡아놔.',
  '중앙광장에 있으면 모든 소문이 결국 지나가.', '북문은 준비 안 되면 그냥 구경만 해.', '네코한테 먼저 물어보는 게 빠르겠어.',
  '낡은검이 아까 웃었는데 뭔가 알아낸 얼굴이었어.', '오늘은 말수가 적은 유저들이 더 많네.'
];

const roomChatter = {
  '중앙광장': ['광장 전광판에 접속자 수가 또 늘었어.', '여기서 팀 구하면 오래 안 기다려도 돼.', '새로 온 사람은 먼저 보기부터 해봐.'],
  '북문': ['문밖 바람 냄새가 달라졌어.', '북문은 한 걸음만 나가도 분위기가 바뀌지.', '경비가 오늘은 통행증을 안 묻네.'],
  '주막': ['주막 소문은 반만 믿는 게 좋아.', '저쪽 탁자에서 장터 이야기가 계속 나와.', '여기서는 조용히 듣는 것도 기술이야.'],
  '수련장': ['허수아비가 새 공격 패턴을 배운 것 같아.', '수련장은 지루해도 배신하지 않아.', '처음엔 목검부터 익숙해져야지.'],
  '장터': ['장터 시세는 사람 마음처럼 흔들려.', '싸게 보이는 물건일수록 설명을 읽어야 해.', '상인이 오늘은 북문 물건을 많이 내놨어.'],
  '초보사냥터': ['작은 몹도 둘러싸이면 귀찮아.', '처음 온 사람은 입구 근처에서 감을 봐.', '발자국을 보면 누가 먼저 지나갔는지 보여.']
};

const teamChatter = [
  '내가 앞장설게.', '네코 말도 들어보자.', '다음 방까지 같이 가자.', '위험하면 바로 빠지자.',
  '내가 주변 유저 반응을 볼게.', '사냥보다 정찰부터 하자.', '지금 팀 구성은 나쁘지 않아.', '말 걸 상대를 골라보자.'
];

const sayResponses = [
  '좋아, 같이 보자.', '반가워.', '여기서 자주 보자.', '나도 방금 그 생각했어.', '주막 쪽 소문도 들어봐.',
  '그 말은 기억해둘게.', '괜찮은 판단 같아.', '일단 주변을 더 보자.', '북문 쪽 이야기도 들어봤어?',
  '장터에 단서가 있을지도 몰라.', '네코 의견도 궁금한데.', '천천히 가도 늦지 않아.'
];

const questionResponses = [
  '그건 네코에게도 물어봐.', '나도 궁금했어. 같이 확인하자.', '질문이 좋네. 단서는 주막에 있을지도 몰라.',
  '확실하진 않은데 북문 쪽에서 비슷한 말을 들었어.', '수련장에서 답을 아는 사람이 있을 거야.'
];

const reactionChatter = [
  '네코 말대로 해봐.', '좋은 질문이야.', '나도 따라갈게.', '잠깐, 주변을 먼저 봐.', '그 선택 나쁘지 않아.',
  '팀을 더 모으면 안전하겠어.', '지금은 서두르지 않는 게 좋아.', '방금 말에 누가 반응했어.'
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
let choiceSlots = [];
const recentPhrases = [];

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function pickFresh(list) {
  const fresh = list.filter((item) => !recentPhrases.includes(item));
  const value = pick(fresh.length ? fresh : list);
  recentPhrases.push(value);
  if (recentPhrases.length > 28) recentPhrases.shift();
  return value;
}

function setStatus(text, className) {
  statusEl.textContent = text;
  statusEl.className = className || '';
}

function setDiagnostics(text) {
  diagnosticsEl.textContent = text;
}

function setGeminiStatus(text) {
  geminiStatusEl.textContent = text;
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

function appendNeko(text) {
  append(`네코: ${text}`, 'neko');
}

function renderStatusPanel() {
  statusPanelEl.textContent = [
    '[캐릭터]',
    `이름: ${character.name}`,
    `직업: ${character.job}`,
    `레벨: ${character.level}`,
    `HP: ${character.hp}`,
    `MP: ${character.mp}`,
    `EXP: ${character.exp}`,
    `돈: ${character.gold} 전`,
    `위치: ${roomName}`,
    `팀: ${team.length ? team.join(', ') : '없음'}`,
    '',
    '[장비]',
    ...Object.entries(character.equipment).map(([slot, item]) => `${slot}: ${item}`),
    '',
    '[보관 아이템]',
    ...character.inventory.map((item, index) => `${index + 1}. ${item}`)
  ].join('\n');
}

function currentSettings() {
  return Object.fromEntries(Object.entries(fields).map(([key, field]) => [key, field.value.trim()]));
}

function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(currentSettings()));
  nekoInteractionId = null;
  setGeminiStatus('저장됨');
  append('설정이 저장되었습니다. 네코의 대화 기억을 새로 시작합니다.');
}

function loadSettings() {
  const defaults = {
    apiKey: '',
    model: DEFAULT_MODEL,
    gender: '검은 고양이',
    tone: '상냥하고 짧게 말함',
    level: '7',
    ability: '길찾기와 명령어 해석',
    prompt: randomSettings.prompt[0]
  };
  const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
  const values = { ...defaults, ...saved };
  if (values.model === 'gemini-3.5-flash') values.model = DEFAULT_MODEL;
  for (const [key, value] of Object.entries(values)) fields[key].value = value;
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
  append(`\n[${roomName}]\n${room.desc}\n출구: ${room.exits.join(', ')}\n주변 유저: ${roomUsers().join(', ')}\n팀: ${team.length ? team.join(', ') : '없음'}\n`, 'room');
  showChoices();
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
    '플레이어가 다음 행동을 고르기 쉽게 장소, 위험, 동료 후보를 짧게 짚어준다.',
    '사용 가능한 명령어를 자연스럽게 추천한다: 보기, 유저, 이동 장소, 말 내용, 귓 이름 내용, 팀 이름.'
  ].join('\n');
}

function makeChoices() {
  const room = rooms[roomName];
  const candidate = roomUsers().find((name) => !team.includes(name)) || roomUsers()[0];
  const raw = [
    { label: `${room.exits[0] || roomName}(으)로 이동`, command: `이동 ${room.exits[0] || roomName}` },
    { label: `${candidate}에게 말 걸기`, command: `귓 ${candidate} 여기서 무엇을 조심해야 해?` },
    { label: `${candidate} 팀 영입`, command: `팀 ${candidate}` },
    { label: '네코에게 다음 수 묻기', command: '네코 지금 무엇을 하면 좋을까?' }
  ];
  return raw.filter((choice, index, list) => list.findIndex((item) => item.command === choice.command) === index).slice(0, 4);
}

function showChoices() {
  choiceSlots = makeChoices();
  append(`\n[다음 행동]\n${choiceSlots.map((choice, index) => `${index + 1}. ${choice.label}`).join('\n')}`, 'choice');
}

async function askNeko(question = '') {
  const settings = currentSettings();
  const input = question.trim() || '지금 무엇을 하면 좋을까?';

  appendNeko('생각 중...');
  try {
    const data = await requestNeko(input, nekoInteractionId);
    if (data.id) nekoInteractionId = data.id;
    appendNeko(data.text || fallbackNeko(input));
  } catch (error) {
    appendNeko(`Gemini 연결 실패. ${error.message}`);
    appendNeko(fallbackNeko(input));
  }
  showChoices();
}

async function requestNeko(input, previousInteractionId = null) {
  const settings = currentSettings();
  const res = await fetch('/api/neko', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      apiKey: settings.apiKey,
      model: settings.model || DEFAULT_MODEL,
      input,
      systemInstruction: buildSystemInstruction(),
      previousInteractionId
    })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const source = data.keySource ? ` / key: ${data.keySource}` : '';
    throw new Error(`${data.message || data.error || `Gemini HTTP ${res.status}`}${source}`);
  }
  return data;
}

async function testGemini() {
  const button = document.getElementById('testGemini');
  button.disabled = true;
  setGeminiStatus('확인 중...');
  try {
    const data = await requestNeko('Gemini 연결 확인입니다. 네코답게 한 문장으로만 답하세요.');
    setGeminiStatus('연결 성공');
    append(`Gemini 확인 성공: ${data.text || '응답 수신'}`);
  } catch (error) {
    setGeminiStatus('연결 실패');
    append(`Gemini 확인 실패: ${error.message}`);
  } finally {
    button.disabled = false;
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
      ? pickFresh(message.includes('?') || message.includes('？') ? questionResponses : sayResponses)
      : pickFresh(sayResponses);
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
  renderStatusPanel();
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
  renderStatusPanel();
  append(`${name}: 좋아, 같이 가자.`, 'ally');
  append(`현재 팀: ${team.join(', ')}`);
}

function clearTeam() {
  team = [];
  renderStatusPanel();
  append('팀을 해산했습니다.');
}

function help() {
  append(`\n[명령어]\n1~4               추천 행동 선택\n도움              이 안내\n보기              현재 장소 보기\n상태              캐릭터 상태 갱신\n유저              가상 유저 100명 보기\n말 내용           주변 유저와 대화\n귓 이름 내용      특정 유저에게 말하기\n팀 이름           AI 유저를 동료로 영입\n팀                현재 팀 보기\n팀해산            팀 해산\n이동 장소         장소 이동\n네코 질문         Gemini 네코에게 묻기\n설정              설정창 보기\n랜덤              네코 설정 랜덤 생성\n설계도            게임 설계 요약\n\n예) 네코 어디로 가야 해?\n예) 1\n예) 팀 검객루안`);
}

function blueprint() {
  append(`\n[설계도]\n원형: PC통신식 텍스트 MUD, 방 이동, 주변 유저, 귓속말, 팀업.\n새 핵심: 네코가 현재 방/팀/유저를 읽고 다음 행동을 추천한다.\n진행 방식: 플레이어는 직접 명령하거나 1~4 추천 행동을 고른다.\n개성: 실제 유저처럼 보이는 AI 100명이 방마다 소문, 반응, 팀 대사를 만든다.\n확장: 의뢰, 전투, 아이템은 이 선택지 구조에 명령만 추가하면 된다.`, 'room');
}

function ambientChat() {
  if (!connected) return;
  const user = team.length && Math.random() > 0.55 ? pick(team) : pick(roomUsers());
  lastSpeaker = user;
  const lines = team.includes(user) ? teamChatter : chatter.concat(roomChatter[roomName] || []);
  append(`${user}: ${pickFresh(lines)}`, team.includes(user) ? 'ally' : '');
}

function connect() {
  if (connected) return;

  setConnected(true);
  renderStatusPanel();
  setStatus('입장 완료', 'online');
  setDiagnostics(`GATEWAY ${APP_VERSION}\nGemini 네코 ${currentSettings().apiKey ? '브라우저 키 사용' : '서버 키 확인 대기'}\nAI 유저 100명 / 팀업 가능`);
  clearScreen();
  append('무한대전에 입장했습니다.');
  append('검은 고양이 네코가 조용히 옆에 앉습니다.');
  append('네코: 설정에 Gemini API 키를 넣거나 Vercel 환경변수 GEMINI_API_KEY를 쓰면 내가 대화해줄게.');
  look();
  tickTimer = window.setInterval(ambientChat, 5000);
}

function disconnect() {
  if (!connected) return;
  window.clearInterval(tickTimer);
  tickTimer = null;
  setConnected(false);
  renderStatusPanel();
  setStatus('퇴장', 'offline');
  append('접속을 종료했습니다.');
}

async function runCommand(raw) {
  const input = raw.trim();
  if (!input) {
    await askNeko();
    return;
  }

  if (/^[1-4]$/.test(input) && choiceSlots[Number(input) - 1]) {
    const choice = choiceSlots[Number(input) - 1];
    append(`=> ${choice.command}`, 'choice');
    await runCommand(choice.command);
    return;
  }

  const [command, ...rest] = input.split(/\s+/);
  const body = rest.join(' ');

  if (['도움', 'help', '?', '명령'].includes(command)) help();
  else if (['보기', 'look', 'l'].includes(command)) look();
  else if (['상태', '스탯', '장비', '아이템', 'status', 'stat'].includes(command)) renderStatusPanel();
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
  else if (command === '설계도') blueprint();
  else if (names.includes(command)) whisper(input);
  else say(input);

  if (Math.random() > 0.6) append(`${lastSpeaker}: ${pickFresh(reactionChatter)}`);
}

connectBtn.addEventListener('click', connect);
disconnectBtn.addEventListener('click', disconnect);
clearBtn.addEventListener('click', clearScreen);
nekoBtn.addEventListener('click', () => askNeko('도움'));
checkStatusBtn.addEventListener('click', () => setDiagnostics(`GATEWAY ${APP_VERSION}\nGemini 네코 ${currentSettings().apiKey ? '브라우저 키 사용' : '서버 키 확인 대기'}\nAI 유저 100명 / 팀 ${team.length ? team.join(', ') : '없음'}`));
document.getElementById('saveSettings').addEventListener('click', saveSettings);
document.getElementById('randomSettings').addEventListener('click', makeRandomSettings);
document.getElementById('testGemini').addEventListener('click', testGemini);

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
renderStatusPanel();
setStatus('입장 대기', '');
setDiagnostics(`GATEWAY ${APP_VERSION}\nGemini 네코 ${currentSettings().apiKey ? '브라우저 키 사용' : '서버 키 확인 대기'}\nAI 유저 100명 / 팀업 가능`);
append('무한대전 PC통신 접속 대기');
append('1. 입장  2. 퇴장  3. 네코  4. 화면 지우기  5. 상태 확인');
append('Gemini 키는 설정에 넣거나 Vercel 환경변수 GEMINI_API_KEY로 둘 수 있습니다.');
