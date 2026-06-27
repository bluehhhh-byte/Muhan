'use strict';

const MAX_LINES = 700;
const HISTORY_LIMIT = 80;
const SETTINGS_KEY = 'muhan.neko.settings';
const GAME_STATE_KEY = 'muhan.game.state';
const DEFAULT_MODEL = 'gemini-3.1-flash-lite';
const APP_VERSION = document.querySelector('meta[name="app-version"]')?.content || '0.10.7';

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
const autoBtn = document.getElementById('gameAuto');
const autoScrollEl = document.getElementById('autoScroll');
const geminiStatusEl = document.getElementById('geminiTestStatus');

const fields = {
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
  '중앙광장': { exits: ['북문', '주막', '수련장', '현감청', '생명의나무'], desc: '푸른 전광판과 오래된 향로가 있는 시작 광장이다.' },
  '북문': { exits: ['중앙광장', '초보사냥터', '북문 밖 숲'], desc: '성문 밖에서 낮은 북소리가 들리고 경비가 길을 막고 있다.' },
  '주막': { exits: ['중앙광장', '장터'], desc: '소문과 농담이 가장 빨리 모이는 곳이다.' },
  '수련장': { exits: ['중앙광장'], desc: '낡은 목검과 허수아비가 줄지어 서 있다.' },
  '현감청': { exits: ['중앙광장'], desc: '초보 모험가에게 첫 임무를 내리는 관아다.' },
  '생명의나무': { exits: ['중앙광장', '초보사냥터'], desc: '새 모험가들이 길을 묻는 거대한 나무가 뿌리를 드리우고 있다.' },
  '장터': { exits: ['주막'], desc: '상인들이 회복약과 낡은 장비를 펼쳐 놓았다.' },
  '초보사냥터': { exits: ['북문', '생명의나무'], desc: '작은 괴물의 발자국이 흙길 위에 남아 있다.' },
  '북문 밖 숲': { exits: ['북문', '폐광 입구'], desc: '안개 낀 숲길 사이로 오래된 발자국과 새 발자국이 겹쳐 있다.' },
  '폐광 입구': { exits: ['북문 밖 숲'], desc: '무너진 광차와 검은 돌가루가 폐광의 입을 막고 있다.' }
};

const jobGrowth = {
  '초보검객': { label: '균형형 검객', hp: 10, mp: 2, attack: 3, defense: 2, spirit: 1 },
  '기공술사': { label: '기공 중심', hp: 7, mp: 6, attack: 1, defense: 1, spirit: 4 },
  '수호무사': { label: '방어 중심', hp: 13, mp: 2, attack: 2, defense: 4, spirit: 1 },
  '유랑도적': { label: '기민한 공격형', hp: 8, mp: 3, attack: 4, defense: 1, spirit: 2 },
  '초보의원': { label: '회복 보조형', hp: 8, mp: 5, attack: 1, defense: 2, spirit: 4 }
};

const shopItems = {
  '회복약': { price: 40, heal: 999, desc: 'HP를 모두 회복한다.' },
  '생명환': { price: 120, heal: 28, desc: '전투 중 버티기 좋은 회복 알약이다.' },
  '청동검': { price: 180, desc: '공격 +4 무기.' },
  '가죽갑옷': { price: 160, desc: '방어 +3 방어구.' },
  '수련 부적': { price: 220, desc: '정신 +3 장신구.' }
};

const equipmentCatalog = {
  '낡은 목검': { slot: '무기', attack: 1 },
  '수련복': { slot: '방어구', defense: 1 },
  '푸른 접속패': { slot: '장신구', spirit: 1 },
  '청동검': { slot: '무기', attack: 4 },
  '가죽갑옷': { slot: '방어구', defense: 3 },
  '수련 부적': { slot: '장신구', spirit: 3 },
  '광부의 곡괭이': { slot: '무기', attack: 6, defense: 1 }
};

const allyRoles = [
  { label: '공격형', attack: 4, defense: 0, heal: 0 },
  { label: '수호형', attack: 1, defense: 4, heal: 0 },
  { label: '회복형', attack: 0, defense: 1, heal: 7 },
  { label: '정찰형', attack: 2, defense: 1, heal: 2 }
];

const monsterTraits = {
  '기습': { damage: 4, expRate: 1.05, text: '기습으로 먼저 달려든다.' },
  '단단함': { damage: 2, expRate: 1.1, text: '단단한 껍질로 버틴다.' },
  '독': { damage: 6, expRate: 1.15, text: '독 기운이 상처를 파고든다.' },
  '우두머리': { damage: 8, expRate: 1.35, goldRate: 1.4, text: '주변 괴물을 부리는 우두머리다.' }
};

const character = {
  name: '무명초보',
  job: '초보검객',
  title: '초보',
  level: 1,
  hp: 38,
  hpMax: 38,
  mp: 12,
  mpMax: 12,
  attack: 6,
  defense: 3,
  spirit: 2,
  exp: 0,
  expToLevel: 512,
  gold: 500,
  storyStep: 0,
  equipment: {
    무기: '낡은 목검',
    방어구: '수련복',
    장신구: '푸른 접속패',
    동료: '네코'
  },
  inventory: ['회복약', '회복약', '회복약', '귀환부', '낡은 지도 조각', '주막 쿠폰']
};

const story = [
  { title: '환영 읽기', goal: '광장에서 환영 안내를 읽어라.', hint: '환영' },
  { title: '첫 임무', goal: '현감청에서 현감과 대화해 첫 임무를 받아라.', hint: '이동 현감청 → 대화 현감' },
  { title: '발자국 조사', goal: '초보사냥터에서 작은 괴물을 사냥해 증거를 얻어라.', hint: '이동 초보사냥터 → 사냥' },
  { title: '첫 수련', goal: '사냥이나 수련으로 경험치를 쌓아 자동 승급하라.', hint: '초보사냥터 → 사냥 / 수련장 → 수련' },
  { title: '생명의나무', goal: '생명의나무의 안내자와 대화해 북문 단서를 확인하라.', hint: '이동 생명의나무 → 대화 안내자' },
  { title: '북문 조사', goal: '북문을 조사해 다음 장의 길을 열어라.', hint: '이동 북문 → 조사' },
  { title: '숲길 정찰', goal: '북문 밖 숲을 조사해 폐광 입구를 찾아라.', hint: '이동 북문 밖 숲 → 조사' },
  { title: '폐광 입구', goal: '폐광 입구의 우두머리를 쓰러뜨려 새 장비를 얻어라.', hint: '이동 폐광 입구 → 사냥' },
  { title: '열린 대전', goal: '사냥, 수련, 장비, 팀업을 반복해 더 깊은 지역을 준비하라.', hint: '임무 / 사냥 / 착용 / 팀교체 / 네코' }
];

const roomNpcs = {
  '중앙광장': ['전광판 관리인', '떠돌이 도우미'],
  '현감청': ['현감'],
  '생명의나무': ['안내자'],
  '주막': ['주모', '소문꾼'],
  '장터': ['약장수'],
  '북문': ['북문 경비'],
  '초보사냥터': ['겁먹은 나그네'],
  '북문 밖 숲': ['숲길 파수꾼'],
  '폐광 입구': ['낡은 광부'],
  '수련장': ['수련 교관']
};

const roomEncounters = {
  '초보사냥터': [
    { name: '들쥐', hp: 10, exp: 120, gold: 35, item: '작은 송곳니', trait: '기습' },
    { name: '흙도깨비', hp: 16, exp: 180, gold: 55, item: '짐승의 발톱', trait: '단단함' },
    { name: '떠도는 그림자', hp: 22, exp: 240, gold: 75, item: '낡은 부적 조각', trait: '독' }
  ],
  '북문': [
    { name: '성문 박쥐', hp: 18, exp: 160, gold: 45, item: '박쥐 날개', trait: '기습' }
  ],
  '북문 밖 숲': [
    { name: '안개 늑대', hp: 30, exp: 320, gold: 110, item: '안개 송곳니', trait: '기습' },
    { name: '독버섯 정령', hp: 26, exp: 300, gold: 95, item: '푸른 포자', trait: '독' }
  ],
  '폐광 입구': [
    { name: '폐광 우두머리', hp: 46, exp: 520, gold: 220, item: '광부의 곡괭이', trait: '우두머리' }
  ]
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
let autoTimer = null;
let autoProgress = false;
let autoBusy = false;
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

function expForLevel(level) {
  return 512 * (2 ** Math.max(0, Math.min(level - 1, 8)));
}

function growthForJob(job = character.job) {
  return jobGrowth[job] || jobGrowth['초보검객'];
}

function titleForLevel(level) {
  if (level >= 8) return '대전검객';
  if (level >= 5) return '숙련생';
  if (level >= 3) return '수련생';
  return '초보';
}

function defaultStatsForLevel(level, job = character.job) {
  const growth = growthForJob(job);
  const gained = Math.max(0, level - 1);
  return {
    attack: 6 + growth.attack * gained,
    defense: 3 + growth.defense * gained,
    spirit: 2 + growth.spirit * gained
  };
}

function currentQuest() {
  return story[Math.min(character.storyStep, story.length - 1)];
}

function itemStats(item) {
  return equipmentCatalog[item] || {};
}

function equipmentBonus() {
  return Object.values(character.equipment).reduce((bonus, item) => {
    const stats = itemStats(item);
    bonus.attack += stats.attack || 0;
    bonus.defense += stats.defense || 0;
    bonus.spirit += stats.spirit || 0;
    return bonus;
  }, { attack: 0, defense: 0, spirit: 0 });
}

function effectiveStats() {
  const bonus = equipmentBonus();
  return {
    attack: character.attack + bonus.attack,
    defense: character.defense + bonus.defense,
    spirit: character.spirit + bonus.spirit
  };
}

function itemBonusText(item) {
  const stats = itemStats(item);
  return [
    stats.attack ? `공격 +${stats.attack}` : '',
    stats.defense ? `방어 +${stats.defense}` : '',
    stats.spirit ? `정신 +${stats.spirit}` : ''
  ].filter(Boolean).join(', ');
}

function allyRole(name) {
  const index = Math.max(0, names.indexOf(name));
  return allyRoles[index % allyRoles.length];
}

function teamPower() {
  return team.reduce((power, name) => {
    const role = allyRole(name);
    power.attack += role.attack;
    power.defense += role.defense;
    power.heal += role.heal;
    return power;
  }, { attack: 0, defense: 0, heal: 0 });
}

function teamLabel() {
  return team.length ? team.map((name) => `${name}(${allyRole(name).label})`).join(', ') : '없음';
}

function nekoProfile() {
  const settings = currentSettings();
  const level = Math.max(1, Math.min(99, Number(settings.level) || 1));
  const ability = settings.ability || '길찾기와 명령어 해석';
  const combat = 2 + Math.floor(level / 8) + (/전투|전술|공격/.test(ability) ? 4 : 0);
  const guard = Math.floor(level / 15) + (/위험|예지|생존/.test(ability) ? 3 : 0);
  const growthRate = 1 + Math.min(0.7, level / 100) + (/전투|수련|성장/.test(ability) ? 0.15 : 0);
  const goldRate = 1 + Math.min(0.35, level / 180) + (/소문|탐지|상인/.test(ability) ? 0.15 : 0);
  const autoDelay = /길찾기|명령어|예지/.test(ability) ? 3200 : 4200;
  return { level, ability, combat, guard, growthRate, goldRate, autoDelay };
}

function saveGameState() {
  try {
    localStorage.setItem(GAME_STATE_KEY, JSON.stringify({
      roomName,
      team,
      character: {
        title: character.title,
        level: character.level,
        hp: character.hp,
        hpMax: character.hpMax,
        mp: character.mp,
        mpMax: character.mpMax,
        attack: character.attack,
        defense: character.defense,
        spirit: character.spirit,
        exp: character.exp,
        expToLevel: character.expToLevel,
        gold: character.gold,
        storyStep: character.storyStep,
        equipment: character.equipment,
        inventory: character.inventory
      }
    }));
  } catch (error) {
    // 저장소가 막힌 브라우저에서는 현재 세션만 유지한다.
  }
}

function loadGameState() {
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(GAME_STATE_KEY) || '{}');
  } catch (error) {
    return;
  }
  if (rooms[saved.roomName]) roomName = saved.roomName;
  if (Array.isArray(saved.team)) {
    team = saved.team.filter((name, index, list) => names.includes(name) && list.indexOf(name) === index).slice(0, 4);
  }
  if (saved.character && typeof saved.character === 'object') {
    for (const key of ['title', 'level', 'hp', 'hpMax', 'mp', 'mpMax', 'attack', 'defense', 'spirit', 'exp', 'expToLevel', 'gold', 'storyStep']) {
      if (saved.character[key] !== undefined) character[key] = saved.character[key];
    }
    if (saved.character.equipment && typeof saved.character.equipment === 'object') character.equipment = saved.character.equipment;
    if (Array.isArray(saved.character.inventory)) character.inventory = saved.character.inventory;
  }
  character.level = Math.max(1, Number(character.level) || 1);
  character.hpMax = Math.max(1, Number(character.hpMax) || 38);
  character.mpMax = Math.max(0, Number(character.mpMax) || 12);
  character.hp = Math.min(character.hpMax, Math.max(1, Number(character.hp) || character.hpMax));
  character.mp = Math.min(character.mpMax, Math.max(0, Number(character.mp) || character.mpMax));
  const defaultStats = defaultStatsForLevel(character.level);
  character.attack = Math.max(1, Number(character.attack) || defaultStats.attack);
  character.defense = Math.max(0, Number(character.defense) || defaultStats.defense);
  character.spirit = Math.max(0, Number(character.spirit) || defaultStats.spirit);
  character.exp = Math.max(0, Number(character.exp) || 0);
  character.expToLevel = Math.max(1, Number(character.expToLevel) || expForLevel(character.level));
  character.gold = Math.max(0, Number(character.gold) || 0);
  character.storyStep = Math.max(0, Math.min(story.length - 1, Number(character.storyStep) || 0));
}

function renderStatusPanel() {
  const neko = nekoProfile();
  const growth = growthForJob();
  const stats = effectiveStats();
  statusPanelEl.textContent = [
    '[캐릭터]',
    `이름: ${character.name}`,
    `직업: ${character.job}`,
    `칭호: ${character.title}`,
    `레벨: ${character.level}`,
    `HP: ${character.hp}/${character.hpMax}`,
    `MP: ${character.mp}/${character.mpMax}`,
    `공격: ${stats.attack} (${character.attack})`,
    `방어: ${stats.defense} (${character.defense})`,
    `정신: ${stats.spirit} (${character.spirit})`,
    `성장: ${growth.label}`,
    `EXP: ${character.exp}/${character.expToLevel}`,
    `돈: ${character.gold} 전`,
    `위치: ${roomName}`,
    `팀: ${teamLabel()}`,
    '',
    '[현재 임무]',
    currentQuest().title,
    currentQuest().goal,
    '',
    '[네코]',
    `레벨: ${neko.level}`,
    `능력: ${neko.ability}`,
    `전투 보조: +${neko.combat}`,
    `성장 보정: x${neko.growthRate.toFixed(2)}`,
    `자동 진행: ${autoProgress ? '켜짐' : '꺼짐'}`,
    '',
    '[장비]',
    ...Object.entries(character.equipment).map(([slot, item]) => `${slot}: ${item}${itemBonusText(item) ? ` (${itemBonusText(item)})` : ''}`),
    '',
    '[보관 아이템]',
    ...character.inventory.map((item, index) => `${index + 1}. ${item}`)
  ].join('\n');
}

function hasItem(name) {
  return character.inventory.some((item) => item.startsWith(name));
}

function addItem(item) {
  character.inventory.push(item);
}

function removeOneItem(name) {
  const index = character.inventory.findIndex((item) => item.startsWith(name));
  if (index >= 0) character.inventory.splice(index, 1);
  return index >= 0;
}

function autoLevelUp(source = '경험') {
  const growth = growthForJob();
  let gained = 0;
  while (character.exp >= character.expToLevel) {
    character.exp -= character.expToLevel;
    character.level += 1;
    gained += 1;
    character.title = titleForLevel(character.level);
    character.hpMax += growth.hp;
    character.mpMax += growth.mp;
    character.attack += growth.attack;
    character.defense += growth.defense;
    character.spirit += growth.spirit;
    character.hp = character.hpMax;
    character.mp = character.mpMax;
    character.expToLevel = expForLevel(character.level);
    append(`\n[레벨 상승]\n${source}으로 레벨 ${character.level}이 되었습니다.\n직업 성장(${growth.label}): HP +${growth.hp}, MP +${growth.mp}, 공격 +${growth.attack}, 방어 +${growth.defense}, 정신 +${growth.spirit}`, 'choice');
  }
  if (gained && character.storyStep === 3 && character.level >= 2) {
    setStoryStep(4, '레벨이 올랐다. 생명의나무로 가서 안내자와 대화하자.');
  }
  return gained;
}

function healCharacter(amount, source, className = 'ally') {
  if (character.hp >= character.hpMax) return 0;
  const before = character.hp;
  character.hp = Math.min(character.hpMax, character.hp + amount);
  const healed = character.hp - before;
  if (healed > 0) append(`${source}: HP ${healed} 회복. 현재 HP ${character.hp}/${character.hpMax}`, className);
  return healed;
}

function nekoHeal() {
  const neko = nekoProfile();
  const abilityBonus = /회복|치유|생존|위험|예지/.test(neko.ability) ? 8 : 0;
  const amount = Math.round(character.hpMax * 0.22) + Math.floor(neko.level / 6) + character.spirit + abilityBonus;
  return healCharacter(Math.max(5, amount), '네코가 푸른 숨결로 상처를 핥았다', 'neko');
}

function allyHeal() {
  if (!team.length) return 0;
  const healer = pick(team);
  const role = allyRole(healer);
  const stats = effectiveStats();
  const amount = 5 + team.length * 3 + teamPower().heal + Math.floor(stats.spirit / 2);
  return healCharacter(amount, `${healer}(${role.label})의 응급 회복술`, 'ally');
}

function autoRecoverIfCritical() {
  if (character.hp > Math.ceil(character.hpMax * 0.35)) return 0;
  append('[위험] HP가 낮아져 동료들이 회복 행동을 시작합니다.', 'choice');
  let healed = 0;
  healed += allyHeal();
  if (character.hp <= Math.ceil(character.hpMax * 0.6)) healed += nekoHeal();
  if (character.hp <= Math.ceil(character.hpMax * 0.35) && removeOneItem('회복약')) {
    healed += healCharacter(character.hpMax, '회복약 자동 사용', 'ally');
  }
  return healed;
}

function recoverHp() {
  if (character.hp >= character.hpMax) {
    append('HP는 이미 가득 찼습니다.');
    showChoices();
    return;
  }

  let healed = 0;
  healed += allyHeal();
  if (character.hp < character.hpMax) healed += nekoHeal();
  if (character.hp < Math.ceil(character.hpMax * 0.55) && removeOneItem('회복약')) {
    healed += healCharacter(character.hpMax, '회복약 사용', 'ally');
  }

  if (!healed) append('지금은 회복할 수단이 없습니다. 장터에서 "구매 회복약"을 시도하세요.');
  commitProgress();
  showChoices();
}

function showShop() {
  if (roomName !== '장터') {
    append('상점 품목은 장터에서 확인할 수 있습니다. 예) 이동 주막 → 이동 장터');
    showChoices();
    return;
  }
  append(`\n[장터 품목]\n${Object.entries(shopItems).map(([name, item]) => `${name}: ${item.price} 전 - ${item.desc}`).join('\n')}\n구매 예) 구매 회복약 / 구매 청동검`, 'room');
  showChoices();
}

function buyItem(input = '') {
  if (roomName !== '장터') {
    append('구매는 장터에서 할 수 있습니다. 중앙광장 → 주막 → 장터로 이동하세요.');
    showChoices();
    return;
  }

  const itemName = Object.keys(shopItems).find((name) => input.includes(name)) || '회복약';
  const item = shopItems[itemName];
  if (!item) {
    showShop();
    return;
  }
  if (character.gold < item.price) {
    append(`${itemName}을(를) 사기에는 돈이 부족합니다. 필요 ${item.price} 전 / 보유 ${character.gold} 전`);
    showChoices();
    return;
  }

  character.gold -= item.price;
  addItem(itemName);
  append(`약장수: ${itemName} 하나 챙겨두게. 남은 돈 ${character.gold} 전.`, 'ally');
  commitProgress();
  showChoices();
}

function setStoryStep(step, text) {
  if (character.storyStep >= step) return;
  character.storyStep = Math.min(step, story.length - 1);
  append(`\n[임무 갱신]\n${currentQuest().title}\n${text || currentQuest().goal}`, 'choice');
}

function commitProgress() {
  renderStatusPanel();
  saveGameState();
}

function currentSettings() {
  return Object.fromEntries(Object.entries(fields).map(([key, field]) => [key, field.value.trim()]));
}

function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(currentSettings()));
  nekoInteractionId = null;
  setGeminiStatus('저장됨');
  append('설정이 저장되었습니다. 네코의 대화 기억을 새로 시작합니다.');
  if (autoProgress) setAutoProgress(true);
  else renderStatusPanel();
}

function loadSettings() {
  const defaults = {
    model: DEFAULT_MODEL,
    gender: '검은 고양이',
    tone: '상냥하고 짧게 말함',
    level: '7',
    ability: '길찾기와 명령어 해석',
    prompt: randomSettings.prompt[0]
  };
  const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
  const values = { ...defaults };
  for (const key of Object.keys(fields)) {
    if (saved[key] !== undefined) values[key] = saved[key];
  }
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
  autoBtn.disabled = !value;
  if (value) commandEl.focus();
  setAutoButton();
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
  append(`\n[${roomName}]\n${room.desc}\n출구: ${room.exits.join(', ')}\n고정 NPC: ${(roomNpcs[roomName] || []).join(', ') || '없음'}\n주변 유저: ${roomUsers().join(', ')}\n팀: ${team.length ? team.join(', ') : '없음'}\n`, 'room');
  showChoices();
}

function showMap() {
  const here = (name) => (roomName === name ? `[${name}]` : name);
  append(`\n[지도]\n${here('현감청')}        ${here('수련장')}\n    \\          /\n     ${here('중앙광장')} -- ${here('주막')} -- ${here('장터')}\n        |       \\\n      ${here('북문')}    ${here('생명의나무')}\n     /   \\        |\n${here('초보사냥터')}  ${here('북문 밖 숲')}\n              |\n          ${here('폐광 입구')}`, 'room');
  showChoices();
}

function showQuest() {
  append(`\n[임무]\n${currentQuest().title}\n${currentQuest().goal}\n힌트: ${currentQuest().hint}`, 'choice');
}

function welcome() {
  append('\n[환영]\n무한대전은 광장에서 시작해 봐/조사로 주변을 읽고, 대화로 임무를 받고, 공격과 수련으로 경험을 얻는 PC통신식 MUD입니다.\n경험치가 충분하면 자동으로 레벨이 오르고, HP가 낮으면 회복/사용 회복약/구매 회복약으로 버틸 수 있습니다.', 'room');
  if (character.storyStep === 0) setStoryStep(1, '현감청으로 가서 현감과 대화하자.');
  commitProgress();
  showChoices();
}

function inspectRoom() {
  const npcs = roomNpcs[roomName] || [];
  const encounters = roomEncounters[roomName] || [];
  append(`\n[조사]\n${rooms[roomName].desc}\nNPC: ${npcs.join(', ') || '없음'}\n위험: ${encounters.map((monster) => monster.name).join(', ') || '낮음'}\n임무 힌트: ${currentQuest().hint}`, 'room');
  if (roomName === '북문' && character.storyStep === 5) {
    addItem('북문 경비의 표식');
    setStoryStep(6, '북문 조사를 마쳤다. 북문 밖 숲으로 나가 새 발자국을 확인하자.');
    commitProgress();
  }
  if (roomName === '북문 밖 숲' && character.storyStep === 6) {
    setStoryStep(7, '숲길 끝에서 폐광 입구를 찾았다. 폐광 입구로 가서 우두머리를 상대하자.');
    commitProgress();
  }
  showChoices();
}

function talkNpc(input = '') {
  const target = input.trim();
  const npcs = roomNpcs[roomName] || [];
  const npc = npcs.find((name) => !target || name.includes(target) || target.includes(name));
  if (!npc) {
    append(`대화할 상대가 없습니다. 이곳 NPC: ${npcs.join(', ') || '없음'}`);
    return;
  }

  if (npc === '현감') {
    append('현감: 광장 북쪽 발자국이 심상치 않다. 초보사냥터에서 증거를 가져오면 수련 허가를 내리겠다.', 'ally');
    if (!hasItem('현감의 추천서')) addItem('현감의 추천서');
    if (character.storyStep <= 1) setStoryStep(2, '초보사냥터에서 작은 괴물을 사냥해 증거를 찾자.');
  } else if (npc === '안내자') {
    append('안내자: 생명의나무 아래에서 길을 익힌 자만 북문 너머를 오래 버틴다. 표식을 찾으면 다음 길이 열린다.', 'ally');
    if (!hasItem('생명의나무 잎')) addItem('생명의나무 잎');
    if (character.storyStep === 4) setStoryStep(5, '북문으로 가서 성문 주변을 조사하자.');
  } else if (npc === '수련 교관') {
    append('수련 교관: 이제 경험치가 차면 바로 몸이 반응한다. 수련은 경험을 안정적으로 쌓는 방법이다.', 'ally');
  } else if (npc === '약장수') {
    append('약장수: 회복약은 40 전, 생명환은 120 전이다. "품목"으로 보고 "구매 회복약"으로 사게.', 'ally');
  } else if (npc === '숲길 파수꾼') {
    append('숲길 파수꾼: 안개 늑대는 먼저 달려든다. 방어형 동료나 갑옷이 있으면 훨씬 버틴다.', 'ally');
  } else if (npc === '낡은 광부') {
    append('낡은 광부: 폐광 우두머리는 느리지만 세다. 이기면 쓸 만한 곡괭이를 얻을 수 있다.', 'ally');
  } else {
    append(`${npc}: ${pickFresh(roomChatter[roomName] || chatter)}`, 'ally');
  }
  commitProgress();
  showChoices();
}

function showInventory() {
  append(`\n[소지품]\n${character.inventory.map((item, index) => `${index + 1}. ${item}`).join('\n') || '비어 있음'}`);
}

function showScore() {
  renderStatusPanel();
  const stats = effectiveStats();
  append(`\n[점수]\n${character.title} ${character.name} / 레벨 ${character.level} ${character.job}\nHP ${character.hp}/${character.hpMax}  MP ${character.mp}/${character.mpMax}\n공격 ${stats.attack}  방어 ${stats.defense}  정신 ${stats.spirit}\nEXP ${character.exp}/${character.expToLevel}  돈 ${character.gold} 전\n현재 임무: ${currentQuest().title}`);
}

function useItem(input = '') {
  const usableItems = Object.keys(shopItems).filter((name) => shopItems[name].heal);
  const itemName = usableItems.find((name) => input.includes(name)) || (/약/.test(input) ? '회복약' : '');
  if (!itemName) {
    append('사용할 물건을 입력하세요. 예) 사용 회복약');
    return;
  }
  if (!hasItem(itemName)) {
    append(`${itemName}이(가) 없습니다. 장터에서 "구매 ${itemName}"을 시도하세요.`);
    return;
  }
  if (character.hp >= character.hpMax) {
    append('HP가 이미 가득 차 있어 회복 아이템을 아꼈습니다.');
    return;
  }
  removeOneItem(itemName);
  healCharacter(shopItems[itemName].heal, `${itemName} 사용`, 'ally');
  commitProgress();
  showChoices();
}

function equipItem(input = '') {
  const itemName = Object.keys(equipmentCatalog).find((name) => input.includes(name));
  if (!itemName) {
    append('착용할 장비를 입력하세요. 예) 착용 청동검');
    return;
  }
  if (!hasItem(itemName)) {
    append(`${itemName}이(가) 보관함에 없습니다. 장터에서 구매하거나 사냥으로 얻으세요.`);
    return;
  }

  const slot = equipmentCatalog[itemName].slot;
  const oldItem = character.equipment[slot];
  removeOneItem(itemName);
  if (oldItem) addItem(oldItem);
  character.equipment[slot] = itemName;
  commitProgress();
  append(`${slot}에 ${itemName}을(를) 착용했습니다.${itemBonusText(itemName) ? ` ${itemBonusText(itemName)}.` : ''}`, 'ally');
  showChoices();
}

function hunt(input = '') {
  const encounters = roomEncounters[roomName] || [];
  if (!encounters.length) {
    append('이곳은 사냥터가 아닙니다. 초보사냥터나 북문 근처에서 시도하세요.');
    return;
  }

  const monster = encounters.find((item) => input && item.name.includes(input.trim())) || pick(encounters);
  const neko = nekoProfile();
  const stats = effectiveStats();
  const allies = teamPower();
  const trait = monsterTraits[monster.trait] || {};
  const attackPower = stats.attack + allies.attack + neko.combat;
  const guardPower = stats.defense + allies.defense + neko.guard;
  const damage = Math.max(1, Math.ceil(monster.hp * 0.45) + (trait.damage || 0) - guardPower);
  const expGain = Math.round(monster.exp * (trait.expRate || 1) * neko.growthRate);
  const goldGain = Math.round(monster.gold * (trait.goldRate || 1) * neko.goldRate);
  character.hp = Math.max(1, character.hp - damage);
  character.exp += expGain;
  character.gold += goldGain;
  append(`\n[전투]\n${monster.name}을(를) 공격했다.\n특성: ${monster.trait || '없음'}${trait.text ? ` - ${trait.text}` : ''}\n공격력 ${attackPower}, 방어력 ${guardPower}. 네코가 앞발로 빈틈을 만들었다. 보조 +${neko.combat}, 성장 x${neko.growthRate.toFixed(2)}.\n피해 ${damage}를 받았지만 승리했다.\n획득: 경험 ${expGain}, 돈 ${goldGain} 전`, 'choice');
  autoRecoverIfCritical();
  if (monster.item && !hasItem(monster.item)) {
    addItem(monster.item);
    append(`획득 물품: ${monster.item}`, 'ally');
  }
  autoLevelUp('전투 경험');
  if (character.storyStep === 2) {
    setStoryStep(3, '증거를 얻었다. 수련장으로 가서 레벨을 올리자.');
    if (character.level >= 2) setStoryStep(4, '레벨이 올랐다. 생명의나무로 가서 안내자와 대화하자.');
  }
  if (roomName === '폐광 입구' && character.storyStep === 7) {
    setStoryStep(8, '폐광 입구의 우두머리를 넘겼다. 이제 장비와 팀을 갖추고 더 깊은 지역을 준비하자.');
  }
  commitProgress();
  showChoices();
}

function trainCharacter() {
  if (roomName !== '수련장') {
    append('수련은 수련장에서만 할 수 있습니다.');
    return;
  }

  const neko = nekoProfile();
  const expGain = Math.round((150 + character.level * 45) * Math.min(1.7, neko.growthRate));
  const mpCost = Math.min(character.mp, 2);
  character.mp -= mpCost;
  character.exp += expGain;
  append(`\n[수련]\n목검과 호흡을 맞춰 기본기를 다졌습니다.\n획득 경험 ${expGain}. MP ${mpCost} 소모. 경험치가 충분하면 자동으로 레벨이 오릅니다.`, 'choice');
  autoLevelUp('수련 경험');
  commitProgress();
  showChoices();
}

function fallbackNeko(question = '') {
  const q = question.trim();
  if (/지도|맵|map/.test(q)) return `지도는 "지도"라고 입력하면 볼 수 있어. 현재 위치는 ${roomName}이야.`;
  if (/어디|위치|길|가야|이동/.test(q)) return `지금은 ${roomName}. 갈 수 있는 곳은 ${rooms[roomName].exits.join(', ')}야.`;
  if (/팀|파티|동료/.test(q)) return '마음에 드는 유저에게 "팀 이름"이라고 해. 교체는 "팀교체 기존 새", 해산은 "팀해산"이야.';
  if (/장비|착용|무기/.test(q)) return '장터에서 청동검, 가죽갑옷, 수련 부적을 살 수 있어. 산 다음 "착용 장비명"이라고 해.';
  if (/임무|퀘스트|스토리/.test(q)) return `${currentQuest().title}: ${currentQuest().goal} 힌트는 "${currentQuest().hint}"야.`;
  if (/명령|도움|뭐.*해|방법/.test(q)) return '환영, 임무, 조사, 대화 대상, 사냥, 수련, 회복, 구매 회복약, 구매 청동검, 착용 청동검, 점수, 소지품, 이동 장소를 쓸 수 있어.';
  if (/회복|피|HP|hp|죽/.test(q)) return 'HP가 낮으면 "회복"이라고 해. 동료와 내가 먼저 돕고, 부족하면 회복약을 써. 장터에서는 "구매 회복약"도 가능해.';
  if (/사람|유저|누구/.test(q)) return `가상 유저 100명이 접속 중이야. 이 방에는 ${roomUsers().slice(0, 6).join(', ')} 등이 있어.`;
  if (/사냥|전투|초보/.test(q)) return '처음이면 수련장으로 가고, 팀을 만든 뒤 북문을 지나 초보사냥터로 가면 안전해.';
  return 'Gemini 서버 연결이 안 되면 기본 네코로 안내할게. 지금은 주변을 살피고 팀을 모으자.';
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
    `캐릭터: 레벨 ${character.level}, HP ${character.hp}/${character.hpMax}, MP ${character.mp}/${character.mpMax}, 공격 ${character.attack}, 방어 ${character.defense}, 정신 ${character.spirit}, EXP ${character.exp}/${character.expToLevel}, 돈 ${character.gold}`,
    `현재 임무: ${currentQuest().title} - ${currentQuest().goal}`,
    `소지품: ${character.inventory.join(', ')}`,
    '항상 무한대전 세계관 안에서 답하고, 1~3문장으로 짧게 한국어로 말한다.',
    '플레이어가 다음 행동을 고르기 쉽게 장소, 위험, 동료 후보를 짧게 짚어준다.',
    '사용 가능한 명령어를 자연스럽게 추천한다: 환영, 임무, 지도, 조사, 대화 대상, 사냥, 수련, 회복, 구매 회복약, 구매 청동검, 착용 청동검, 점수, 소지품, 사용 회복약, 이동 장소, 팀 이름, 팀교체 기존 새, 팀해산.'
  ].join('\n');
}

function moveCommandToward(destination) {
  if (rooms[roomName].exits.includes(destination)) return `이동 ${destination}`;
  const queue = [{ room: roomName, path: [] }];
  const visited = new Set([roomName]);
  while (queue.length) {
    const current = queue.shift();
    for (const exit of rooms[current.room].exits) {
      if (visited.has(exit)) continue;
      const path = current.path.concat(exit);
      if (exit === destination) return `이동 ${path[0]}`;
      visited.add(exit);
      queue.push({ room: exit, path });
    }
  }
  return `이동 ${destination}`;
}

function storyChoice() {
  if (character.storyStep === 0) return { label: '환영 안내 읽기', command: '환영' };
  if (character.storyStep === 1) return roomName === '현감청'
    ? { label: '현감과 대화', command: '대화 현감' }
    : { label: '현감청으로 이동', command: moveCommandToward('현감청') };
  if (character.storyStep === 2) return roomName === '초보사냥터'
    ? { label: '작은 괴물 사냥', command: '사냥' }
    : { label: '초보사냥터로 이동', command: moveCommandToward('초보사냥터') };
  if (character.storyStep === 3) return roomName === '수련장'
    ? { label: '수련하기', command: '수련' }
    : { label: '수련장으로 이동', command: moveCommandToward('수련장') };
  if (character.storyStep === 4) return roomName === '생명의나무'
    ? { label: '안내자와 대화', command: '대화 안내자' }
    : { label: '생명의나무로 이동', command: moveCommandToward('생명의나무') };
  if (character.storyStep === 5) return roomName === '북문'
    ? { label: '북문 조사', command: '조사' }
    : { label: '북문으로 이동', command: moveCommandToward('북문') };
  if (character.storyStep === 6) return roomName === '북문 밖 숲'
    ? { label: '숲길 조사', command: '조사' }
    : { label: '북문 밖 숲으로 이동', command: moveCommandToward('북문 밖 숲') };
  if (character.storyStep === 7) return roomName === '폐광 입구'
    ? { label: '폐광 우두머리 사냥', command: '사냥 폐광 우두머리' }
    : { label: '폐광 입구로 이동', command: moveCommandToward('폐광 입구') };
  return { label: '현재 임무 확인', command: '임무' };
}

function makeChoices() {
  const room = rooms[roomName];
  const candidate = roomUsers().find((name) => !team.includes(name)) || roomUsers()[0];
  const combat = (roomEncounters[roomName] || []).length ? { label: '주변 몬스터 사냥', command: '사냥' } : null;
  const heal = character.hp < character.hpMax ? { label: 'HP 회복', command: '회복' } : null;
  const shop = roomName === '장터' ? { label: '회복약 구매', command: '구매 회복약' } : null;
  const raw = [
    storyChoice(),
    heal,
    shop,
    combat,
    roomName === '수련장' ? { label: '수련하기', command: '수련' } : null,
    roomName === '장터' ? { label: '청동검 구매', command: '구매 청동검' } : null,
    { label: `${room.exits[0] || roomName}(으)로 이동`, command: `이동 ${room.exits[0] || roomName}` },
    { label: `${candidate}에게 말 걸기`, command: `귓 ${candidate} 여기서 무엇을 조심해야 해?` },
    { label: `${candidate} 팀 영입`, command: `팀 ${candidate}` },
    { label: '네코에게 다음 수 묻기', command: '네코 지금 무엇을 하면 좋을까?' }
  ].filter(Boolean);
  return raw.filter((choice, index, list) => list.findIndex((item) => item.command === choice.command) === index).slice(0, 4);
}

function bestAutoChoice() {
  const choices = makeChoices().filter((choice) => !choice.command.startsWith('네코'));
  if (character.hp <= Math.ceil(character.hpMax * 0.45)) {
    return { label: 'HP 회복', command: '회복' };
  }
  if (character.storyStep === 3 && character.level < 2) {
    return roomName === '수련장'
      ? { label: '기본기 수련', command: '수련' }
      : { label: '수련장으로 이동', command: moveCommandToward('수련장') };
  }
  return choices.find((choice) => choice.command === '사냥')
    || choices.find((choice) => choice.command !== '임무')
    || choices[0];
}

function showChoices() {
  choiceSlots = makeChoices();
  append(`\n[다음 행동]\n${choiceSlots.map((choice, index) => `${index + 1}. ${choice.label}`).join('\n')}`, 'choice');
}

function setAutoButton() {
  autoBtn.textContent = autoProgress ? '6. 자동 진행 끄기' : '6. 자동 진행 켜기';
  autoBtn.disabled = !connected;
  renderStatusPanel();
}

async function autoTick() {
  if (!connected || !autoProgress || autoBusy) return;
  const choice = bestAutoChoice();
  if (!choice) return;
  autoBusy = true;
  append(`\n[자동 진행]\n네코가 "${choice.label}"을 선택했다.\n=> ${choice.command}`, 'neko');
  try {
    await runCommand(choice.command);
  } finally {
    autoBusy = false;
  }
}

function setAutoProgress(value) {
  autoProgress = Boolean(value);
  if (autoTimer) {
    window.clearInterval(autoTimer);
    autoTimer = null;
  }
  if (autoProgress && connected) {
    autoTimer = window.setInterval(autoTick, nekoProfile().autoDelay);
    appendNeko('자동 진행을 시작할게. 위험하면 언제든 다시 눌러서 멈춰.');
  } else if (connected) {
    appendNeko('자동 진행을 멈췄어.');
  }
  setAutoButton();
}

async function askNeko(question = '') {
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
  commitProgress();
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
    append('팀은 최대 4명까지입니다. "팀교체 기존이름 새이름" 또는 "팀해산"을 쓰세요.');
    return;
  }
  team.push(name);
  commitProgress();
  append(`${name}: 좋아, 같이 가자.`, 'ally');
  append(`현재 팀: ${team.join(', ')}`);
}

function replaceTeamMember(input = '') {
  const [oldQuery, newQuery] = input.trim().split(/\s+/);
  const oldName = findUser(oldQuery || '');
  const newName = findUser(newQuery || '');
  const index = oldName ? team.indexOf(oldName) : -1;
  if (index < 0 || !newName) {
    append(`사용법: 팀교체 기존이름 새이름\n현재 팀: ${team.length ? team.join(', ') : '없음'}`);
    return;
  }
  if (team.includes(newName)) {
    append(`${newName}은 이미 팀에 있습니다.`);
    return;
  }
  team[index] = newName;
  commitProgress();
  append(`${oldName}이(가) 물러나고 ${newName}이(가) 합류했습니다.`, 'ally');
  append(`현재 팀: ${team.join(', ')}`);
}

function clearTeam() {
  team = [];
  commitProgress();
  append('팀을 해산했습니다.');
}

function help() {
  append(`\n[명령어]\n1~4               추천 행동 선택\n자동              자동 진행 켜기/끄기\n환영              초보 안내\n임무              현재 스토리 목표\n지도              전체 지도 보기\n보기              현재 장소 보기\n조사              장소/NPC/위험 조사\n대화 대상         고정 NPC와 대화\n사냥/공격         현재 방 몬스터와 전투\n수련              경험치를 얻고 자동 레벨업\n회복              동료/네코 회복 지원\n품목              장터 상품 보기\n구매 회복약       장터에서 회복 아이템 구매\n구매 청동검       장비 구매\n착용 장비명       장비 착용\n점수              캐릭터 점수 보기\n소지품            보관 아이템 보기\n사용 회복약       회복약 사용\n상태              상태창 갱신\n저장              현재 진행 저장\n유저              가상 유저 100명 보기\n말 내용           주변 유저와 대화\n귓 이름 내용      특정 유저에게 말하기\n팀 이름           AI 유저를 동료로 영입\n팀교체 기존 새    팀원 교체\n팀해산            팀 해산\n이동 장소         장소 이동\n네코 질문         Gemini 네코에게 묻기\n\n예) 지도\n예) 구매 청동검\n예) 착용 청동검\n예) 이동 북문 밖 숲`);
}

function blueprint() {
  append(`\n[설계도]\n원형 반영: 광장 시작, 환영 안내, 봐/조사, 대화, 공격, 소지품, 장비, 점수, 수련, 저장 흐름.\nRPG 루프: 사냥/수련 → 경험치 자동 레벨업 → 장비 착용 → 팀 역할 조합 → 새 지역 정찰.\n새 핵심: 장비와 팀 역할이 전투력에 반영되고, 북문 밖 숲과 폐광 입구로 다음 장이 열린다.\n진행 방식: 환영 → 현감 → 초보사냥 → 수련 → 생명의나무 → 북문 조사 → 북문 밖 숲 → 폐광 입구.\n확장: 몬스터/지역/대화 조건만 더하면 다음 장을 계속 붙일 수 있다.`, 'room');
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
  commitProgress();
  setStatus('입장 완료', 'online');
  setDiagnostics(`GATEWAY ${APP_VERSION}\nGemini 네코 서버 키 사용\n자동 진행 ${autoProgress ? '켜짐' : '꺼짐'}\nAI 유저 100명 / 팀업 가능`);
  clearScreen();
  append(`무한대전에 입장했습니다. 이어하기: ${roomName} / ${currentQuest().title}`);
  append('검은 고양이 네코가 조용히 옆에 앉습니다.');
  append('네코: Vercel 서버 키로 대화할게. 설정에서는 내 성격과 모델만 바꾸면 돼.');
  look();
  tickTimer = window.setInterval(ambientChat, 5000);
}

function disconnect() {
  if (!connected) return;
  if (autoProgress) setAutoProgress(false);
  if (autoTimer) {
    window.clearInterval(autoTimer);
    autoTimer = null;
  }
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
  else if (command === '환영') welcome();
  else if (['임무', '퀘스트', 'quest'].includes(command)) showQuest();
  else if (['지도', '맵', 'map'].includes(command)) showMap();
  else if (['보기', 'look', 'l'].includes(command)) look();
  else if (['조사', '검색', 'search'].includes(command)) inspectRoom();
  else if (['대화', 'talk'].includes(command)) talkNpc(body);
  else if (['사냥', '공격', '때려', '쳐', 'attack'].includes(command)) hunt(body);
  else if (command === '수련') trainCharacter();
  else if (['회복', '치료', 'heal'].includes(command)) recoverHp();
  else if (['품목', '상점', 'shop'].includes(command)) showShop();
  else if (['구매', '구입', '사', 'buy'].includes(command)) buyItem(body);
  else if (['착용', '장착', 'equip'].includes(command)) equipItem(body);
  else if (['소지품', '소지', 'inventory'].includes(command)) showInventory();
  else if (['점수', '정보', '건강', 'score'].includes(command)) showScore();
  else if (['사용', '마셔', '먹어'].includes(command)) useItem(body);
  else if (['자동', 'auto'].includes(command)) setAutoProgress(!autoProgress);
  else if (['귀환', '광장'].includes(command)) move('중앙광장');
  else if (['상태', '스탯', '장비', '아이템', 'status', 'stat'].includes(command)) renderStatusPanel();
  else if (['저장', 'save'].includes(command)) {
    saveGameState();
    append('현재 위치, 팀, 캐릭터 진행을 저장했습니다.');
  }
  else if (['유저', '누구', 'users'].includes(command)) listUsers();
  else if (['말', '채팅', 'say'].includes(command)) say(body);
  else if (['귓', '귓속말', 'tell'].includes(command)) whisper(body);
  else if (['이동', '가', 'move'].includes(command)) move(body);
  else if (['팀교체', '파티교체', '교체'].includes(command)) replaceTeamMember(body);
  else if (['팀', '파티'].includes(command) && body) teamUp(body);
  else if (['팀', '파티'].includes(command)) append(`현재 팀: ${team.length ? team.join(', ') : '없음'}`);
  else if (['팀해산', '파티해산'].includes(command)) clearTeam();
  else if (command === '네코') await askNeko(body);
  else if (command === '설정') document.querySelector('.settings').open = true;
  else if (command === '랜덤') makeRandomSettings();
  else if (command === '설계도') blueprint();
  else if (rooms[command]) move(command);
  else if (names.includes(command)) whisper(input);
  else say(input);

  if (Math.random() > 0.6) append(`${lastSpeaker}: ${pickFresh(reactionChatter)}`);
}

connectBtn.addEventListener('click', connect);
disconnectBtn.addEventListener('click', disconnect);
clearBtn.addEventListener('click', clearScreen);
nekoBtn.addEventListener('click', () => askNeko('도움'));
autoBtn.addEventListener('click', () => setAutoProgress(!autoProgress));
checkStatusBtn.addEventListener('click', () => setDiagnostics(`GATEWAY ${APP_VERSION}\nGemini 네코 서버 키 사용\n자동 진행 ${autoProgress ? '켜짐' : '꺼짐'}\nAI 유저 100명 / 팀 ${team.length ? team.join(', ') : '없음'}`));
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

window.addEventListener('beforeunload', () => {
  saveGameState();
  if (autoTimer) window.clearInterval(autoTimer);
  window.clearInterval(tickTimer);
});

loadSettings();
loadGameState();
setConnected(false);
renderStatusPanel();
setStatus('입장 대기', '');
setDiagnostics(`GATEWAY ${APP_VERSION}\nGemini 네코 서버 키 사용\n자동 진행 꺼짐\nAI 유저 100명 / 팀업 가능`);
append('무한대전 PC통신 접속 대기');
append('1. 입장  2. 퇴장  3. 네코  4. 화면 지우기  5. 상태 확인  6. 자동 진행');
append('Gemini 키는 Vercel 환경변수 GEMINI_API_KEY를 사용합니다.');
