'use strict';

const MAX_LINES = 700;
const HISTORY_LIMIT = 80;
const SETTINGS_KEY = 'muhan.neko.settings';
const NEKO_MEMORY_KEY = 'muhan.neko.memory';
const GAME_STATE_KEY = 'muhan.game.state';
const SAVE_VERSION = 3;
const DEFAULT_MODEL = 'gemini-3.1-flash-lite';
const APP_VERSION = document.querySelector('meta[name="app-version"]')?.content || '0.30.8';

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
const autoBtn = document.getElementById('gameAuto');
const autoModeEl = document.getElementById('autoMode');
const autoScrollEl = document.getElementById('autoScroll');
const geminiStatusEl = document.getElementById('geminiTestStatus');

const fields = {
  model: document.getElementById('geminiModel'),
  gender: document.getElementById('nekoGender'),
  tone: document.getElementById('nekoTone'),
  personality: document.getElementById('nekoPersonality'),
  role: document.getElementById('nekoRole'),
  risk: document.getElementById('nekoRisk'),
  memoryMode: document.getElementById('nekoMemoryMode'),
  level: document.getElementById('nekoLevel'),
  luck: document.getElementById('nekoLuck'),
  ability: document.getElementById('nekoAbility'),
  prompt: document.getElementById('nekoPrompt')
};

const FRONTIER_ROOM = '무한구역';
const FRONTIER_ENEMY_POWER = 10;
const FRONTIER_SIZE = 1;
const autoStrategies = {
  균형: '균형',
  안정: '안정 정비',
  파밍: '아이템 파밍',
  보스: '보스 도전',
  파편: '파편 원정',
  빚: '빚 청산'
};
const frontierPhases = [
  { name: '피의 위상', mood: '분노', hpRate: 1.25, expRate: 1.25, goldRate: 0.9, damage: 8, warning: '반격이 거칠다. 회복약과 방어가 먼저다.' },
  { name: '침묵의 위상', mood: '불안', hpRate: 1.1, expRate: 1.1, goldRate: 1, damage: 12, warning: '회복 타이밍이 늦어지기 쉽다. 위험하면 원정종료.' },
  { name: '황금의 위상', mood: '호기심', hpRate: 1, expRate: 0.95, goldRate: 1.8, damage: 4, warning: '돈은 잘 돌지만 욕심이 전투를 늘린다.' },
  { name: '망각의 위상', mood: '슬픔', hpRate: 1.45, expRate: 1.6, goldRate: 0.75, damage: 10, warning: '강하지만 배움이 크다. 패배도 기록으로 남긴다.' },
  { name: '별빛의 위상', mood: '희망', hpRate: 0.95, expRate: 1.25, goldRate: 1.15, damage: 2, warning: '드문 기회다. 파편과 경험을 노리자.' }
];

let names = [
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

const aiAbilityCatalog = ['결혼', '살해', '체포', '약탈', '중재', '치유', '상단', '소문', '보호', '스승', '투자', '파산', '고용', '기부'];
const generatedUserWords = ['가람', '누리', '다래', '로하', '바림', '새온', '아린', '여명', '이솔', '찬별', '타래', '하랑', '휘온', '비설', '연담', '초린'];
let aiBirthSeq = 1;
let aiWealth = {};
let aiDebt = {};
let economy = { index: 100, fund: 0, last: '광장 장터 개장', concepts: [], reputation: 0, contracts: [] };
let nekoTraining = { combat: 0, luck: 0, counsel: 0 };
let gambleState = { blackjack: null };

function hashName(name) {
  return Array.from(name).reduce((hash, char) => hash + char.charCodeAt(0), 0);
}

function aiAbility(name) {
  return aiAbilityCatalog[hashName(name) % aiAbilityCatalog.length];
}

function aiUserLabel(name) {
  return `${name}(${aiAbility(name)})`;
}

function generatedUserName(index) {
  return `${generatedUserWords[index % generatedUserWords.length]}${Math.floor(index / generatedUserWords.length) + 1}`;
}

function ensureAiUsers(target = 200) {
  let index = 0;
  while (names.length < target) {
    const name = generatedUserName(index);
    if (!names.includes(name)) names.push(name);
    index += 1;
  }
}

function cleanAiUsers(list) {
  return list.filter((name, index, source) => (
    typeof name === 'string' && name.trim() && source.indexOf(name) === index
  )).slice(0, 300);
}

function addAiUser(prefix = '새싹') {
  let name = `${prefix}${aiBirthSeq}`;
  while (names.includes(name)) {
    aiBirthSeq += 1;
    name = `${prefix}${aiBirthSeq}`;
  }
  aiBirthSeq += 1;
  names.push(name);
  return name;
}

function removeAiUser(name) {
  const index = names.indexOf(name);
  if (index < 0 || names.length <= 1) return false;
  names.splice(index, 1);
  team = team.filter((member) => member !== name);
  delete teamTrust[name];
  delete aiWealth[name];
  delete aiDebt[name];
  return true;
}

const rooms = {
  '중앙광장': { exits: ['북문', '주막', '수련장', '현감청', '생명의나무'], desc: '푸른 전광판과 오래된 향로가 있는 시작 광장이다.' },
  '북문': { exits: ['중앙광장', '초보사냥터', '북문 밖 숲'], desc: '성문 밖에서 낮은 북소리가 들리고 경비가 길을 막고 있다.' },
  '주막': { exits: ['중앙광장', '장터', '도박장'], desc: '소문과 농담이 가장 빨리 모이는 곳이다.' },
  '도박장': { exits: ['주막'], desc: '푸른 칩과 낡은 확률표가 걸린 지하 놀이판이다.' },
  '수련장': { exits: ['중앙광장'], desc: '낡은 목검과 허수아비가 줄지어 서 있다.' },
  '현감청': { exits: ['중앙광장'], desc: '초보 모험가에게 첫 임무를 내리는 관아다.' },
  '생명의나무': { exits: ['중앙광장', '초보사냥터'], desc: '새 모험가들이 길을 묻는 거대한 나무가 뿌리를 드리우고 있다.' },
  '장터': { exits: ['주막'], desc: '상인들이 회복약과 낡은 장비를 펼쳐 놓았다.' },
  '초보사냥터': { exits: ['북문', '생명의나무'], desc: '작은 괴물의 발자국이 흙길 위에 남아 있다.' },
  '북문 밖 숲': { exits: ['북문', '폐광 입구'], desc: '안개 낀 숲길 사이로 오래된 발자국과 새 발자국이 겹쳐 있다.' },
  '폐광 입구': { exits: ['북문 밖 숲', FRONTIER_ROOM], desc: '무너진 광차와 검은 돌가루가 폐광의 입을 막고 있다.' },
  [FRONTIER_ROOM]: { exits: ['폐광 입구'], desc: '무한평원을 하나로 압축한 푸른 사각지대다. 모든 적은 이전보다 10배 강하게 반응한다.' }
};

const autoModes = {
  story: '스토리 우선',
  hunt: '사냥 우선',
  gear: '장비 우선',
  safe: '안전 우선',
  explore: '탐험 우선',
  frontier: '무한구역',
  team: '팀 우선',
  gamble: '도박 우선'
};
const frontierRegions = [
  { row: 1, name: FRONTIER_ROOM, risk: '극한', note: '모든 좌표가 하나로 접혀 들고, 적의 힘은 10배로 솟구친다.' }
];
const frontierSpecials = {
  [FRONTIER_ROOM]: {
    type: 'boss',
    label: '무한구역 감시자',
    marker: 'X',
    monster: { name: '무한구역 감시자', hp: 128, exp: 1800, gold: 760, item: '무한전선 검', trait: '우두머리' }
  }
};

function frontierRoomName(row, col) {
  return FRONTIER_ROOM;
}

function isLegacyFrontierRoom(name = '') {
  return /^무한평원(?:\s+\d{2}-\d{2})?$/.test(String(name).trim());
}

function canonicalRoomName(name = '') {
  const trimmed = String(name).trim();
  return trimmed === FRONTIER_ROOM || isLegacyFrontierRoom(trimmed) ? FRONTIER_ROOM : trimmed;
}

function canonicalRoomList(list) {
  return Array.from(new Set(Array.from(list || []).map(canonicalRoomName).filter((name) => rooms[name])));
}

function currentFrontierPhase() {
  return frontierPhases[((Number(frontierPhaseIndex) || 0) % frontierPhases.length + frontierPhases.length) % frontierPhases.length];
}

function shiftFrontierPhase(reason = '전장의 흐름') {
  frontierPhaseIndex = (frontierPhaseIndex + 1) % frontierPhases.length;
  const phase = currentFrontierPhase();
  reflect(phase.mood, `${phase.name}: ${phase.warning}`, `${FRONTIER_ROOM} 위상 전환`);
  append(`[위상] ${reason}: ${phase.name} - ${phase.warning}`, 'choice');
  return phase;
}

function scarSummary() {
  const scars = Array.isArray(character.scars) ? character.scars : [];
  return scars.length ? scars.slice(0, 4).map((scar) => scar.name).join(' / ') : '없음';
}

function scarBonus() {
  const count = Array.isArray(character.scars) ? character.scars.length : 0;
  return {
    defense: Math.min(5, Math.floor(count / 2)),
    spirit: Math.min(8, count)
  };
}

function addDefeatScar(monster, reason = '퇴각') {
  character.scars = Array.isArray(character.scars) ? character.scars : [];
  const phase = frontierCoord(roomName) ? currentFrontierPhase().name : '전투';
  const name = `${phase} ${monster.trait || '전투'} 흉터`;
  character.scars = [{ name, monster: monster.name, reason, at: roomName }]
    .concat(character.scars.filter((scar) => scar.name !== name))
    .slice(0, 8);
  rememberNeko('전투', `흉터 ${name}`, 1);
  reflect('절망', '패배가 몸에 남으면 다음 선택은 조금 더 진짜가 된다.', `${reason}: ${monster.name}`);
  append(`[흉터] ${name}\n네코: 아픈 기록이지만 버리지 말자. 방어와 정신 보정으로 다음 판단을 버텨낼 거야.`, 'neko');
}

function phaseText() {
  const phase = currentFrontierPhase();
  return `${phase.name} / ${phase.warning}`;
}

function showFrontierPhase() {
  append(`\n[무한구역 위상]\n현재: ${phaseText()}\n효과: HP x${currentFrontierPhase().hpRate}, 경험 x${currentFrontierPhase().expRate}, 돈 x${currentFrontierPhase().goldRate}, 피해 +${currentFrontierPhase().damage}\n명령: 위상변경`, 'room');
  showChoices();
}

function frontierCoord(name) {
  return canonicalRoomName(name) === FRONTIER_ROOM ? { row: 1, col: 1 } : null;
}

function frontierRegion(name) {
  const coord = frontierCoord(name);
  return coord ? frontierRegions[coord.row - 1] : null;
}

function frontierSpecial(name = roomName) {
  return frontierSpecials[canonicalRoomName(name)] || null;
}

function buildFrontierRooms() {
  const region = frontierRegions[0];
  const special = frontierSpecials[FRONTIER_ROOM];
  rooms[FRONTIER_ROOM] = {
    exits: ['폐광 입구'],
    desc: `${region.name} 단일 구역이다. ${region.note} 위험도: ${region.risk}. 적 전투력 x${FRONTIER_ENEMY_POWER}.${special ? ` 특수지점: ${special.label}.` : ''}`
  };
}

buildFrontierRooms();

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
  '수련 부적': { price: 220, desc: '정신 +3 장신구.' },
  '철검': { price: 420, desc: '공격 +8 무기.' },
  '철갑옷': { price: 380, desc: '방어 +6 방어구.' },
  '사냥꾼 부적': { price: 460, desc: '정신 +6 장신구.' }
};

const equipmentCatalog = {
  '낡은 목검': { slot: '무기', attack: 1 },
  '수련복': { slot: '방어구', defense: 1 },
  '푸른 접속패': { slot: '장신구', spirit: 1 },
  '청동검': { slot: '무기', attack: 4 },
  '가죽갑옷': { slot: '방어구', defense: 3 },
  '수련 부적': { slot: '장신구', spirit: 3 },
  '광부의 곡괭이': { slot: '무기', attack: 6, defense: 1 },
  '철검': { slot: '무기', attack: 8 },
  '철갑옷': { slot: '방어구', defense: 6 },
  '사냥꾼 부적': { slot: '장신구', spirit: 6 },
  '고성검': { slot: '무기', attack: 11, defense: 2 },
  '무한전선 검': { slot: '무기', attack: 15, spirit: 3 }
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

const rogueRelicCatalog = [
  { name: '검은별 손잡이', attack: 4, desc: '공격 +4' },
  { name: '고성 방패문양', defense: 3, desc: '방어 +3' },
  { name: '네코의 은방울', spirit: 3, desc: '정신 +3' },
  { name: '전선의 깃털', attack: 2, defense: 2, desc: '공격 +2, 방어 +2' },
  { name: '상인의 주사위', goldRate: 0.22, desc: '돈 +22%' },
  { name: '푸른 샘병', afterCombatHeal: 7, desc: '전투 뒤 HP +7' }
];

const rogueCurseCatalog = [
  { name: '깊은 안개', damage: 2, desc: '받는 피해 +2' },
  { name: '끊긴 접속음', goldRate: -0.18, desc: '돈 -18%' },
  { name: '무거운 먼지', healRate: -0.25, desc: '회복 -25%' },
  { name: '붉은 표식', damage: 3, desc: '위험 피해 +3' }
];

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
  gambleDebt: 0,
  scars: [],
  storyStep: 0,
  mood: '담담함',
  insight: '아직 마음에 남은 문장은 없다.',
  lastScene: '중앙광장의 접속 대기',
  equipment: {
    무기: '낡은 목검',
    방어구: '수련복',
    장신구: '푸른 접속패',
    동료: '네코'
  },
  upgrades: {
    무기: 0,
    방어구: 0,
    장신구: 0
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
  { title: '무한구역 진입', goal: '하나로 접힌 무한구역에 들어가 구조를 조사하라.', hint: '이동 무한구역 → 조사' },
  { title: '압축 좌표 조사', goal: '무한구역의 압축된 표지와 위험 규칙을 확인하라.', hint: '조사' },
  { title: '극한 정비', goal: '무한구역 안에서 보급과 전투 준비를 마쳐라.', hint: '조사 / 품목 / 강화 무기' },
  { title: '무한구역 감시자', goal: '10배 강해진 무한구역 감시자에게 맞서라.', hint: '사냥 무한구역 감시자' },
  { title: '극한 생환', goal: '무한구역에서 한 번 더 살아남아 새 깃발을 얻어라.', hint: '사냥' },
  { title: '열린 대전', goal: '사냥, 수련, 장비, 팀업, 탐험을 반복해 더 깊은 지역을 준비하라.', hint: '자동목표 / 사냥 / 강화 / 팀교체 / 네코' }
];

const storyRewards = {
  2: { exp: 60, gold: 80, item: '현감의 동전' },
  3: { exp: 100, gold: 90, item: '증거 주머니' },
  4: { exp: 120, gold: 100, item: '수련 완주표' },
  5: { exp: 120, gold: 120, item: '생명의나무 열매' },
  8: { exp: 220, gold: 240, item: '평원 입장패' },
  10: { exp: 240, gold: 260, item: '표지석 탁본' },
  11: { exp: 280, gold: 300, item: '역참 보급권' },
  12: { exp: 360, gold: 420, item: '검은 고성 열쇠' },
  13: { exp: 500, gold: 600, item: '무한전선 깃발' }
};

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

const frontierMonsterNames = [
  '평원 들개', '떠돌이 검객', '바람 도적', '검은 풀벌레', '낡은 병정',
  '황야 박쥐', '철가면 수색꾼', '초승 늑대', '먼지 정령', '표지석 파수꾼'
];
const frontierPrefixes = ['굶주린', '비에 젖은', '이름 잃은', '분노한', '노래하는', '침묵의', '달빛 아래', '도망친'];
const frontierScenes = [
  '낡은 채팅 로그가 풀잎처럼 흩어진다',
  '먼 곳에서 접속음과 울음소리가 겹친다',
  '누군가 버린 이름표가 흙에 반쯤 묻혀 있다',
  '표지석 그림자가 방금 전과 다른 방향을 가리킨다',
  '네코의 털이 곤두설 만큼 공기가 얇다',
  '비어 있는 주막 간판이 바람에 혼자 대답한다',
  '깨진 갑옷 속에서 오래된 감사 인사가 새어 나온다',
  '발자국 셋이 들어갔는데 둘만 돌아 나온 흔적이 있다'
];
const frontierLandmarks = ['흰 억새 언덕', '끊어진 돌다리', '검은 샘', '녹슨 역참 종', '버려진 훈련 말뚝', '푸른 돌무덤', '무너진 통신탑', '아이 이름이 새겨진 표지목'];
const frontierInsights = [
  ['불안', '길은 넓어질수록 마음속 빈자리도 드러난다.'],
  ['기쁨', '함께 버틴 시간은 전리품보다 오래 남는다.'],
  ['분노', '상처는 힘이 되기도 하지만, 오래 쥐면 손부터 다친다.'],
  ['슬픔', '사라진 이름을 기억하는 일도 모험의 일부다.'],
  ['희망', '오늘의 작은 이동이 내일의 지도가 된다.'],
  ['외로움', '혼자 남겨진 길도 누군가의 발자국 위에 놓여 있다.'],
  ['행복', '살아남았다는 사실은 때때로 가장 작은 축제다.'],
  ['절망', '끝을 보았다고 믿는 순간에도 발밑의 흙은 아직 길이다.']
];

function frontierEncounters(room = roomName) {
  const coord = frontierCoord(room);
  if (!coord) return [];
  const special = frontierSpecial(room);
  const depth = coord.row + coord.col;
  const base = 22 + depth * 5;
  const firstName = `${pick(frontierPrefixes)} ${frontierMonsterNames[(coord.row + coord.col) % frontierMonsterNames.length]}`;
  const secondName = `${pick(frontierPrefixes)} ${frontierMonsterNames[(coord.row * 3 + coord.col * 5) % frontierMonsterNames.length]}`;
  const traits = Object.keys(monsterTraits);
  const encounters = [
    {
      name: `${firstName} 무한구역`,
      hp: base,
      exp: 180 + depth * 42,
      gold: 60 + depth * 16,
      item: '무한구역 표지석 조각',
      trait: traits[depth % traits.length]
    },
    {
      name: `${secondName} 무리`,
      hp: base + 12,
      exp: 220 + depth * 48,
      gold: 80 + depth * 20,
      item: depth % 9 === 0 ? '먼지 낀 수련 부적' : '',
      trait: traits[(depth + coord.row) % traits.length]
    }
  ];
  return special?.type === 'boss' ? [special.monster].concat(encounters) : encounters;
}

function frontierSceneText(room = roomName) {
  const coord = frontierCoord(room);
  if (!coord) return '';
  const region = frontierRegion(room);
  const landmark = pick(frontierLandmarks);
  const scene = pickFresh(frontierScenes);
  const depth = coord.row + coord.col - 1;
  const special = frontierSpecial(room);
  const phase = currentFrontierPhase();
  return `${region.name}, ${landmark}. ${scene}. 압축 깊이감 ${depth} / 적 전투력 x${FRONTIER_ENEMY_POWER} / 위상: ${phase.name}${special ? ` / ${special.label}` : ''}`;
}

function sceneTextForRoom(room = roomName) {
  return frontierCoord(room) ? frontierSceneText(room) : `${room}: ${rooms[room].desc}`;
}

function reflect(mood, insight, scene = '') {
  character.mood = mood || character.mood;
  character.insight = insight || character.insight;
  if (scene) character.lastScene = scene;
}

function chooseEncounter(encounters, input = '') {
  const query = input.trim();
  const forceGroup = /무리|떼|다수|여러/.test(query);
  const named = !forceGroup && encounters.find((item) => query && item.name.includes(query));
  if (named) return named;
  if (!frontierCoord(roomName) || encounters.length < 2 || (!forceGroup && Math.random() < 0.45)) return pick(encounters);
  const count = Math.min(encounters.length, 2 + (Math.random() > 0.72 ? 1 : 0));
  const group = Array.from({ length: count }, () => pick(encounters));
  const primary = group[0];
  return {
    ...primary,
    name: `${group.map((monster) => monster.name).join(' + ')} 습격대`,
    hp: Math.round(group.reduce((sum, monster) => sum + monster.hp, 0) * 0.75),
    exp: Math.round(group.reduce((sum, monster) => sum + monster.exp, 0) * 0.85),
    gold: Math.round(group.reduce((sum, monster) => sum + monster.gold, 0) * 0.85),
    item: group.find((monster) => monster.item)?.item || '',
    bonusItem: group.find((monster) => monster.bonusItem)?.bonusItem || '',
    level: Math.max(...group.map((monster) => monster.level || 1)),
    groupCount: count
  };
}

function frontierTwist(monster, defeated) {
  if (!frontierCoord(roomName) || Math.random() < 0.45) return '';
  const [mood, insight] = pick(frontierInsights);
  const scene = frontierSceneText();
  reflect(mood, insight, scene);
  if (!defeated) {
    return `\n[위험상황]\n${scene}\n네코: ${insight}`;
  }
  const roll = Math.random();
  if (roll > 0.66) {
    const foundGold = 25 + Math.floor((monster.level || character.level) * 4);
    changeGold(foundGold, '평원 전낭');
    return `\n[변수]\n${scene}\n쓰러진 적 뒤에서 오래된 전낭을 찾았다. +${foundGold}전\n네코: ${insight}`;
  }
  if (roll > 0.33 && team.length) {
    raiseTeamTrust(1);
    return `\n[변수]\n${scene}\n위기를 같이 넘기며 관계가 조금 깊어졌다.\n네코: ${insight}`;
  }
  const scratch = Math.min(Math.max(0, character.hp - 1), 3 + rogueDamageBonus());
  if (scratch > 0) character.hp -= scratch;
  if (!scratch) return `\n[변수]\n${scene}\n네코가 꼬리로 후퇴 신호를 그어 마지막 피해를 막았다.\n네코: ${insight}`;
  return `\n[위험상황]\n${scene}\n뒤늦은 매복으로 HP ${scratch} 감소.\n네코: ${insight}`;
}

function monsterLevelFor(room, monster) {
  const coord = frontierCoord(room);
  const roomOffset = {
    '초보사냥터': 0,
    '북문': 0,
    '북문 밖 숲': 1,
    '폐광 입구': 2
  }[room] || 0;
  const frontierOffset = coord ? Math.floor((coord.row + coord.col - 2) / 4) : 0;
  const bossOffset = monster.trait === '우두머리' && coord ? 2 : 0;
  const baseLevel = Math.max(1, character.level + roomOffset + frontierOffset + bossOffset);
  return coord ? baseLevel * FRONTIER_ENEMY_POWER : baseLevel;
}

function scaleMonster(monster, room = roomName) {
  const coord = frontierCoord(room);
  const phase = coord ? currentFrontierPhase() : null;
  const level = monsterLevelFor(room, monster);
  const normalLevel = coord ? Math.max(1, Math.round(level / FRONTIER_ENEMY_POWER)) : level;
  const levelRate = 1 + (normalLevel - 1) * 0.18;
  const overLevelRate = 1 + Math.max(0, level - character.level) * 0.08;
  const expFloor = Math.round(expForLevel(character.level) * (0.16 + Math.max(0, level - character.level) * 0.03));
  const goldFloor = 35 + level * 32;
  const bonusItem = level >= 5 && (monster.trait === '우두머리' || level % 3 === 0)
    ? `Lv.${level} ${monster.trait || '전투'} 전리품`
    : '';
  return {
    ...monster,
    level,
    hp: Math.round(monster.hp * levelRate * overLevelRate * (coord ? FRONTIER_ENEMY_POWER : 1) * (phase?.hpRate || 1)),
    exp: Math.max(Math.round(monster.exp * levelRate * (coord ? FRONTIER_ENEMY_POWER : 1) * (phase?.expRate || 1)), expFloor),
    gold: Math.max(Math.round(monster.gold * (1 + level * 0.08) * (coord ? FRONTIER_ENEMY_POWER : 1) * (phase?.goldRate || 1)), goldFloor),
    threat: coord ? `x${FRONTIER_ENEMY_POWER}` : '',
    phase: phase?.name || '',
    phaseWarning: phase?.warning || '',
    phaseDamage: phase?.damage || 0,
    bonusItem
  };
}

function rollD36Pair() {
  const first = 1 + Math.floor(Math.random() * 36);
  const second = 1 + Math.floor(Math.random() * 36);
  return { first, second, total: first + second };
}

function checkLabel(margin) {
  if (margin >= 30) return '치명';
  if (margin >= 12) return '강타';
  if (margin >= 0) return '명중';
  if (margin >= -18) return '방어';
  return '실패';
}

function combatDiceResult(monster, attackPower, guardPower, traitDamage, gearEffects) {
  const rounds = 5;
  let totalDamage = 0;
  let monsterHp = monster.hp;
  const lines = Array.from({ length: rounds }, (_, index) => {
    const heroDice = rollD36Pair();
    const monsterDice = rollD36Pair();
    const heroScore = heroDice.total + Math.floor(attackPower / 3) + (index === 0 ? 2 : 0);
    const monsterScore = monsterDice.total + monster.level * 2 + Math.floor(traitDamage / 2);
    const margin = heroScore - monsterScore;
    const label = checkLabel(margin);
    const roundDamage = label === '실패'
      ? 0
      : Math.max(1, Math.round(attackPower * (label === '방어' ? 0.45 : 0.9) + Math.max(0, margin) * 0.7));
    const counter = Math.max(0, Math.round(monster.level + traitDamage + Math.max(0, -margin) * 0.35 - guardPower * 0.35 - gearEffects.damageReduction));
    monsterHp = Math.max(0, monsterHp - roundDamage);
    totalDamage += counter;
    return `${index + 1}턴: 주인공 ${heroDice.first}+${heroDice.second}+보정=${heroScore} / 몬스터 ${monsterDice.first}+${monsterDice.second}+보정=${monsterScore} / ${label} / 몬스터 HP ${monsterHp}/${monster.hp} / 반격 ${counter}`;
  });
  if (attackPower >= monster.level * 8 && monsterHp > 0) {
    monsterHp = 0;
    lines.push('결정타: 전력 차이로 남은 HP를 밀어냈다.');
  }
  if (monsterHp > 0 && monsterHp <= Math.ceil(monster.hp * 0.4) && attackPower + guardPower >= monster.level * 6) {
    monsterHp = 0;
    lines.push('마무리: 적의 자세가 무너져 끝장을 냈다.');
  }
  const floorDamage = Math.max(1, Math.ceil(monster.hp * 0.22) + traitDamage - guardPower - gearEffects.damageReduction);
  return {
    text: lines.join('\n'),
    defeated: monsterHp <= 0,
    monsterHp,
    damage: Math.max(1, Math.min(Math.ceil(monster.hp * 0.75), totalDamage || floorDamage))
  };
}

function encountersForRoom(room = roomName) {
  return (roomEncounters[room] || frontierEncounters(room)).map((monster) => scaleMonster(monster, room));
}

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
  personality: ['차분한 분석가', '장난스러운 동료', '냉정한 전술가', '다정한 보호자'],
  role: ['길잡이', '전술가', '수호자', '치유사', '상인'],
  risk: ['균형', '안전', '공격', '광기'],
  memoryMode: ['요약 기억', '전투 우선', '탐험 우선', '대화 우선'],
  level: ['7', '13', '21', '44', '99'],
  luck: ['5', '12', '21', '34', '55'],
  ability: ['길찾기와 명령어 해석', '위험 예지', '가상 유저 설득', '숨겨진 소문 탐지', '전투 전술 조언'],
  prompt: [
    '네코는 무한대전의 오래된 접속 기록을 읽을 수 있다. 플레이어가 길을 잃으면 장소, 유저, 다음 행동을 짧게 제안한다.',
    '네코는 장터와 주막 소문에 밝다. 돈, 아이템, 파티 선택을 도와주며 말끝에 가끔 "냐"를 붙인다.',
    '네코는 수련장 출신 전술 고양이다. 전투보다 생존을 우선하고 초보자에게 안전한 선택지를 준다.',
    '네코는 북문 밖을 오래 떠돌았다. 세계관의 음모와 다른 유저의 속내를 암시하지만 과하게 설명하지 않는다.'
  ]
};

const localEvents = {
  '중앙광장': { title: '전광판 오류', text: '푸른 전광판에 오래된 접속 기록이 흘러나온다.', exp: 40, gold: 25, item: '전광판 기록 조각' },
  '주막': { title: '낡은 소문', text: '주막 구석에서 북문 밖 폐광 이야기를 들었다.', exp: 35, gold: 35, trust: 1 },
  '수련장': { title: '흔들리는 허수아비', text: '네코가 허수아비의 약한 축을 찾아낸다.', exp: 90, gold: 10 },
  '현감청': { title: '분실된 장부', text: '현감청 서랍 밑에서 초보 모험가 명단을 찾았다.', exp: 45, gold: 50 },
  '생명의나무': { title: '푸른 잎맥', text: '나무의 잎맥이 북문 너머의 길을 잠깐 비춘다.', exp: 55, heal: 18, item: '푸른 잎맥' },
  '장터': { title: '약장수 장부', text: '약장수의 흐트러진 장부를 맞춰 주고 작은 보급을 받았다.', exp: 45, gold: 20, item: '장터 외상표' },
  '북문': { title: '성문 발자국', text: '성문 아래 흙먼지에서 폐광으로 이어지는 무거운 발자국을 읽었다.', exp: 60, gold: 30 },
  '초보사냥터': { title: '작은 송곳니 둥지', text: '수풀 아래 둥지를 정리하고 쓸 만한 흔적을 챙겼다.', exp: 75, gold: 45, item: '작은 송곳니' },
  '북문 밖 숲': { title: '안개 속 표식', text: '안개 사이로 광부들이 남긴 표식을 찾았다.', exp: 85, gold: 60, trust: 1 },
  '폐광 입구': { title: '무너진 광차', text: '광차를 밀어 길을 넓히자 검은 돌가루 아래 물품이 드러났다.', exp: 110, gold: 80, item: '검은 돌가루' }
};

const regionEvents = [
  { title: '무한구역 접속 흔적', text: '하나로 접힌 전장 안에 막 접속을 끊은 유저의 발자국이 겹쳐 있다.', item: '무한구역 표식', trust: 1 },
  { title: '표지석 암호', text: '낡은 표지석의 숫자 배열이 다음 길의 위험도를 알려준다.', item: '표지석 암호문' },
  { title: '이끼습지 구조 요청', text: '젖은 이끼 아래에서 끊어진 귓속말 기록을 건져 올렸다.', item: '젖은 귓속말 기록', heal: 12 },
  { title: '붉은협곡 매복 흔적', text: '네코가 붉은 절벽 아래 매복 자리를 먼저 찾아낸다.', item: '붉은 돌조각', damage: 3 },
  { title: '낡은역참 보급 상자', text: '역참 기둥 뒤에 숨겨진 보급 상자를 열었다.', item: '역참 보급표' },
  { title: '안개벌판 접속음', text: '안개 속 접속음의 방향을 따라가 잃어버린 돈주머니를 찾았다.', item: '흐린 접속패', damage: 4 },
  { title: '검은고성터 문양', text: '무너진 성벽의 문양이 고성 파수장의 약점을 가리킨다.', item: '고성 문양 탁본', trust: 2 },
  { title: '유리폐허 반사광', text: '깨진 돌의 반사광 속에서 숨은 통로의 방향을 읽었다.', item: '유리 파편 지도' },
  { title: '별무덤 이름표', text: '사라진 유저의 이름표를 정리하자 주변 유저들이 조용히 고개를 끄덕인다.', item: '낡은 이름표', trust: 2, damage: 5 },
  { title: '무한전선 깃발 흔적', text: '전선 끝에 꽂힌 찢어진 깃발에서 다음 장의 좌표를 읽었다.', item: '찢어진 전선 깃발', trust: 2, damage: 6 }
];

let connected = false;
let history = [];
let historyIndex = 0;
let roomName = '중앙광장';
let team = [];
let teamTrust = {};
let tickTimer = null;
let autoTimer = null;
let autoProgress = false;
let autoBusy = false;
let autoRoomActions = 0;
let autoRoomCommands = [];
let autoShopCooldown = 0;
let autoStrategy = '균형';
let frontierPhaseIndex = 0;
let visitedRooms = new Set([roomName]);
let resolvedEvents = new Set();
let customItems = {};
let goldLog = [];
let rogue = {
  active: false,
  depth: 0,
  maxDepth: 0,
  bestDepth: 0,
  kills: 0,
  runs: 0,
  fragments: 0,
  relicChoice: 0,
  perks: { hp: 0, attack: 0, defense: 0, spirit: 0, curse: 0 },
  relics: [],
  curses: [],
  nodes: []
};
let lastSpeaker = names[0];
let nekoInteractionId = null;
let choiceSlots = [];
const recentPhrases = [];
let nekoMemory = loadNekoMemory();

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

function defaultNekoMemory() {
  return { level: 1, exp: 0, conversations: 0, battles: 0, events: 0, expeditions: 0, fusions: 0, notes: [] };
}

function loadNekoMemory() {
  try {
    const saved = JSON.parse(localStorage.getItem(NEKO_MEMORY_KEY) || '{}');
    return {
      ...defaultNekoMemory(),
      ...saved,
      notes: Array.isArray(saved.notes) ? saved.notes.slice(0, 8) : []
    };
  } catch (error) {
    return defaultNekoMemory();
  }
}

function saveNekoMemory() {
  try {
    localStorage.setItem(NEKO_MEMORY_KEY, JSON.stringify(nekoMemory));
  } catch (error) {
    // 저장소가 막힌 브라우저에서는 현재 세션 기억만 쓴다.
  }
}

function rememberNeko(kind, note = '', amount = 1) {
  const key = { 대화: 'conversations', 전투: 'battles', 사건: 'events', 원정: 'expeditions', 연성: 'fusions' }[kind];
  const mode = fields.memoryMode?.value || '요약 기억';
  if ((mode === '전투 우선' && kind === '전투') || (mode === '탐험 우선' && kind === '원정') || (mode === '대화 우선' && kind === '대화')) amount += 1;
  if (key) nekoMemory[key] += 1;
  nekoMemory.exp += amount;
  nekoMemory.level = 1 + Math.floor(nekoMemory.exp / 8);
  const text = `${kind}: ${note}`.slice(0, 70);
  if (note && !nekoMemory.notes.includes(text)) nekoMemory.notes.unshift(text);
  nekoMemory.notes = nekoMemory.notes.slice(0, 8);
  saveNekoMemory();
}

function nekoMemoryText() {
  return [
    `지능 Lv.${nekoMemory.level}, 학습 ${nekoMemory.exp}`,
    `대화 ${nekoMemory.conversations}, 전투 ${nekoMemory.battles}, 사건 ${nekoMemory.events}, 원정 ${nekoMemory.expeditions}, 연성 ${nekoMemory.fusions}`,
    `최근 기억: ${nekoMemory.notes.join(' / ') || '없음'}`
  ].join('\n');
}

function catalogItem(catalog, name) {
  return catalog.find((item) => item.name === name) || {};
}

function rogueRelicStats() {
  return rogue.relics.reduce((stats, name) => {
    const relic = catalogItem(rogueRelicCatalog, name);
    stats.attack += relic.attack || 0;
    stats.defense += relic.defense || 0;
    stats.spirit += relic.spirit || 0;
    return stats;
  }, { attack: 0, defense: 0, spirit: 0 });
}

function rogueGoldRate() {
  const relicRate = rogue.relics.reduce((rate, name) => rate + (catalogItem(rogueRelicCatalog, name).goldRate || 0), 0);
  const curseRate = rogue.curses.reduce((rate, name) => rate + (catalogItem(rogueCurseCatalog, name).goldRate || 0), 0);
  return rogue.active ? Math.max(0.45, 1 + relicRate + curseRate) : 1;
}

function rogueHealRate() {
  const curseRate = rogue.curses.reduce((rate, name) => rate + (catalogItem(rogueCurseCatalog, name).healRate || 0), 0);
  return rogue.active ? Math.max(0.45, 1 + curseRate) : 1;
}

function rogueDamageBonus() {
  return rogue.active
    ? rogue.curses.reduce((damage, name) => damage + (catalogItem(rogueCurseCatalog, name).damage || 0), 0)
    : 0;
}

function rogueAfterCombatHeal() {
  return rogue.active
    ? rogue.relics.reduce((amount, name) => amount + (catalogItem(rogueRelicCatalog, name).afterCombatHeal || 0), 0)
    : 0;
}

function rogueNodeType(name = roomName) {
  const coord = frontierCoord(name);
  if (!coord) return '';
  const special = frontierSpecial(name);
  const depth = coord.row + coord.col - 1;
  if (special?.type === 'safe') return '안전';
  if (special?.type === 'heal') return '휴식';
  if (special?.type === 'shop') return '상점';
  if (special?.type === 'boss') return '보스';
  if (depth % 5 === 0) return '휴식';
  if (depth % 4 === 0) return '정예';
  return '전투';
}

function ensureRoguePerks() {
  rogue.perks = {
    hp: Math.max(0, Number(rogue.perks?.hp) || 0),
    attack: Math.max(0, Number(rogue.perks?.attack) || 0),
    defense: Math.max(0, Number(rogue.perks?.defense) || 0),
    spirit: Math.max(0, Number(rogue.perks?.spirit) || 0),
    curse: Math.max(0, Number(rogue.perks?.curse) || 0)
  };
  rogue.relicChoice = Math.max(0, Number(rogue.relicChoice) || 0);
}

const shardShop = [
  { key: '체력', cost: 3, desc: '최대 HP +5', apply: () => { character.hpMax += 5; character.hp += 5; rogue.perks.hp += 1; } },
  { key: '공격', cost: 4, desc: '기본 공격 +1', apply: () => { character.attack += 1; rogue.perks.attack += 1; } },
  { key: '방어', cost: 4, desc: '기본 방어 +1', apply: () => { character.defense += 1; rogue.perks.defense += 1; } },
  { key: '정신', cost: 4, desc: '기본 정신 +1', apply: () => { character.spirit += 1; rogue.perks.spirit += 1; } },
  { key: '네코기억', cost: 2, desc: '네코 지식 경험 +120', apply: () => { rememberNeko('원정', '무한 파편 기억 강화', 3); } },
  { key: '저주저항', cost: 5, desc: '원정 저주 회피율 상승', apply: () => { rogue.perks.curse += 1; } },
  { key: '유물권', cost: 6, desc: '다음 원정 시작 유물 선택권 +1', apply: () => { rogue.relicChoice += 1; } }
];

function rogueSummaryText() {
  ensureRoguePerks();
  return `[무한원정]\n상태: ${rogue.active ? '진행 중' : '대기'}\n현재 깊이: ${rogue.depth} / 이번 최고 ${rogue.maxDepth} / 역대 최고 ${rogue.bestDepth}\n처치: ${rogue.kills} / 원정 횟수 ${rogue.runs}\n파편: ${rogue.fragments}\n영구 보너스: HP ${rogue.perks.hp}, 공격 ${rogue.perks.attack}, 방어 ${rogue.perks.defense}, 정신 ${rogue.perks.spirit}, 저주저항 ${rogue.perks.curse}, 유물권 ${rogue.relicChoice}\n유물: ${rogue.relics.length ? rogue.relics.join(', ') : '없음'}\n저주: ${rogue.curses.length ? rogue.curses.join(', ') : '없음'}`;
}

function preferredRogueRelic() {
  const risk = nekoProfile().risk;
  if (risk === '공격' || risk === '광기') return '검은별 손잡이';
  if (risk === '안전') return '고성 방패문양';
  if (nekoProfile().role === '상인') return '상인의 주사위';
  return '네코의 은방울';
}

function grantRogueRelic(reason = '원정 보상', preferred = '') {
  if (!rogue.active) return '';
  const pool = rogueRelicCatalog.filter((item) => !rogue.relics.includes(item.name));
  if (!pool.length) return '';
  const relic = pool.find((item) => item.name === preferred) || pool[(rogue.maxDepth + rogue.kills + rogue.relics.length * 3) % pool.length];
  rogue.relics.push(relic.name);
  append(`[유물] ${reason}: ${relic.name} - ${relic.desc}`, 'ally');
  return relic.name;
}

function addRogueCurse(reason = '깊은 원정') {
  if (!rogue.active) return '';
  ensureRoguePerks();
  if (rogue.perks.curse && Math.random() < Math.min(0.5, rogue.perks.curse * 0.08)) {
    append(`[저주 저항] 네코가 ${reason}의 압박을 먼저 읽어 저주를 피했습니다.`, 'ally');
    return '';
  }
  const pool = rogueCurseCatalog.filter((item) => !rogue.curses.includes(item.name));
  if (!pool.length) return '';
  const curse = pool[(rogue.maxDepth + rogue.curses.length * 2) % pool.length];
  rogue.curses.push(curse.name);
  append(`[저주] ${reason}: ${curse.name} - ${curse.desc}`, 'choice');
  return curse.name;
}

function enterRogueRoom() {
  const coord = frontierCoord(roomName);
  if (!rogue.active || !coord) return;
  const depth = coord.row + coord.col - 1;
  rogue.depth = depth;
  rogue.maxDepth = Math.max(rogue.maxDepth, depth);
  rogue.bestDepth = Math.max(rogue.bestDepth, depth);
  if (!rogue.nodes.includes(roomName)) {
    rogue.nodes.push(roomName);
    append(`[원정 노드] 깊이 ${depth} / ${rogueNodeType()} / ${frontierRegion(roomName).name}`, 'choice');
  }
  while (rogue.curses.length < Math.floor(depth / 5)) addRogueCurse(`깊이 ${depth}`);
}

function startRogueRun() {
  if (rogue.active) {
    append(rogueSummaryText(), 'choice');
    showChoices();
    return;
  }
  if (character.storyStep < 8 && !frontierCoord(roomName)) {
    append('무한원정은 폐광 입구의 우두머리를 넘기고 무한구역 입장패를 얻은 뒤 시작할 수 있습니다.', 'choice');
    showChoices();
    return;
  }

  rogue = {
    ...rogue,
    active: true,
    depth: 0,
    maxDepth: 0,
    kills: 0,
    runs: rogue.runs + 1,
    relics: [],
    curses: [],
    nodes: []
  };
  if (!frontierCoord(roomName)) {
    roomName = FRONTIER_ROOM;
    visitedRooms.add(roomName);
    autoRoomActions = 0;
    autoRoomCommands = [];
  }
  append(`[무한원정]\n${rogue.runs}번째 원정을 시작합니다. 깊이 들어갈수록 유물은 강해지고 저주는 무거워집니다.\n탈출 명령: 원정종료 / 탈출`, 'choice');
  ensureRoguePerks();
  if (rogue.relicChoice > 0) {
    rogue.relicChoice -= 1;
    grantRogueRelic('출발 선택권', preferredRogueRelic());
  } else {
    grantRogueRelic('출발 보급');
  }
  enterRogueRoom();
  rememberNeko('원정', `${rogue.runs}번째 원정 시작`, 2);
  commitProgress();
  showChoices();
}

function finishRogueRun(success = false, reason = '탈출') {
  if (!rogue.active) {
    append('진행 중인 무한원정이 없습니다.');
    showChoices();
    return;
  }
  const earned = Math.max(1, Math.floor(rogue.maxDepth / 3) + rogue.relics.length + (success ? 5 : 0));
  const finishedDepth = rogue.maxDepth;
  const finishedKills = rogue.kills;
  rogue.fragments += earned;
  rogue.bestDepth = Math.max(rogue.bestDepth, finishedDepth);
  const expReward = earned * 35 + finishedDepth * 12;
  character.exp += expReward;
  if (finishedDepth >= 15) character.title = '무한 심연 생환자';
  else if (finishedDepth >= 10) character.title = '무한원정 생환자';
  else if (finishedDepth >= 5 && character.title === '초보') character.title = '평원 생환자';
  shiftReputation(Math.min(3, Math.floor(finishedDepth / 6)));
  rogue.active = false;
  rogue.depth = 0;
  rogue.maxDepth = 0;
  rogue.kills = 0;
  rogue.relics = [];
  rogue.curses = [];
  rogue.nodes = [];
  if (frontierCoord(roomName)) {
    roomName = '중앙광장';
    visitedRooms.add(roomName);
    autoRoomActions = 0;
    autoRoomCommands = [];
  }
  character.hp = Math.max(character.hp, Math.ceil(character.hpMax * 0.5));
  autoLevelUp('원정 귀환');
  append(`[무한원정 종료]\n사유: ${reason}\n도달 깊이 ${finishedDepth}, 처치 ${finishedKills}. 무한 파편 ${earned}개와 경험 ${expReward}을 회수했습니다.\n칭호: ${character.title}`, 'choice');
  rememberNeko('원정', `깊이 ${finishedDepth} / 처치 ${finishedKills}`, 3);
  commitProgress();
  showChoices();
}

function showShardShop() {
  ensureRoguePerks();
  append(`\n[파편 상점]\n보유 파편: ${rogue.fragments}\n${shardShop.map((item) => `${item.key}: ${item.cost} 파편 - ${item.desc}`).join('\n')}\n구매 예) 파편구매 체력 / 파편구매 저주저항 / 파편구매 유물권`, 'room');
  showChoices();
}

function buyShardUpgrade(input = '') {
  ensureRoguePerks();
  const item = shardShop.find((entry) => input.includes(entry.key)) || null;
  if (!item) {
    showShardShop();
    return;
  }
  if (rogue.fragments < item.cost) {
    append(`${item.key} 구매에 필요한 파편이 부족합니다. 필요 ${item.cost} / 보유 ${rogue.fragments}`, 'choice');
    showChoices();
    return;
  }
  rogue.fragments -= item.cost;
  item.apply();
  rememberNeko('원정', `파편 구매 ${item.key}`, 2);
  commitProgress();
  append(`\n[파편 구매]\n${item.key}: ${item.desc}\n남은 파편: ${rogue.fragments}`, 'ally');
  showChoices();
}

function recordRogueCombat(monster) {
  if (!rogue.active) return;
  rogue.kills += 1;
  const node = rogueNodeType();
  if (node === '보스' || node === '정예' || rogue.kills % 3 === 0) {
    grantRogueRelic(`${node} 승리`);
  }
  const healed = rogueAfterCombatHeal();
  if (healed) healCharacter(healed, '푸른 샘병', 'ally');
  append(`[원정 기록] ${monster.name} 처치. 깊이 ${rogue.depth}, 처치 ${rogue.kills}.`, 'choice');
}

function setStatus(text, className) {
  statusEl.textContent = text;
  statusEl.className = className || '';
}

function setDiagnostics(text) {
  diagnosticsEl.textContent = text;
}

function diagnosticsText() {
  return `GATEWAY ${APP_VERSION}\nGemini 네코 서버 키 사용\n자동 진행 ${autoProgress ? '켜짐' : '꺼짐'} / 목표 ${autoModes[currentAutoMode()]}\n무한원정 ${rogue.active ? `깊이 ${rogue.depth}` : '대기'} / AI 유저 ${names.length}명`;
}

function updateDiagnostics() {
  setDiagnostics(diagnosticsText());
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
  return customItems[item] || equipmentCatalog[item] || {};
}

function equipmentNames() {
  return Object.keys({ ...equipmentCatalog, ...customItems });
}

function equipmentScore(item) {
  const stats = itemStats(item);
  return (stats.attack || 0) * 3 + (stats.defense || 0) * 2 + (stats.spirit || 0) + (stats.luck || 0) + (stats.special ? 8 : 0);
}

function isBetterEquipment(item) {
  const slot = itemStats(item).slot;
  return Boolean(slot && character.equipment[slot] !== item && equipmentScore(item) > equipmentScore(character.equipment[slot]));
}

function equipmentBonus() {
  const bonus = Object.values(character.equipment).reduce((total, item) => {
    const stats = itemStats(item);
    total.attack += stats.attack || 0;
    total.defense += stats.defense || 0;
    total.spirit += stats.spirit || 0;
    total.luck += stats.luck || 0;
    return total;
  }, { attack: 0, defense: 0, spirit: 0, luck: 0 });
  bonus.attack += (Number(character.upgrades.무기) || 0) * 2;
  bonus.defense += (Number(character.upgrades.방어구) || 0) * 2;
  bonus.spirit += (Number(character.upgrades.장신구) || 0) * 2;
  return bonus;
}

function effectiveStats() {
  const bonus = equipmentBonus();
  const relic = rogueRelicStats();
  const scar = scarBonus();
  return {
    attack: character.attack + bonus.attack + relic.attack,
    defense: character.defense + bonus.defense + relic.defense + scar.defense,
    spirit: character.spirit + bonus.spirit + relic.spirit + scar.spirit
  };
}

function equipmentEffects() {
  return Object.values(character.equipment).reduce((effects, item) => {
    const special = itemStats(item).special;
    if (special === '흡혈') effects.afterHeal += 8;
    if (special === '탐욕') effects.goldRate += 0.25;
    if (special === '성장') effects.expRate += 0.2;
    if (special === '수호') effects.damageReduction += 4;
    if (special === '치명') effects.attackBonus += 5;
    if (special === '예지') effects.damageReduction += 2;
    if (special === '저주') {
      effects.damageReduction -= 4;
      effects.goldRate -= 0.1;
    }
    return effects;
  }, { afterHeal: 0, goldRate: 1, expRate: 1, damageReduction: 0, attackBonus: 0 });
}

function itemBonusText(item) {
  const stats = itemStats(item);
  return [
    stats.attack ? `공격 +${stats.attack}` : '',
    stats.defense ? `방어 +${stats.defense}` : '',
    stats.spirit ? `정신 +${stats.spirit}` : '',
    stats.luck ? `행운 +${stats.luck}` : '',
    stats.special ? `특수 ${stats.special}` : ''
  ].filter(Boolean).join(', ');
}

function upgradeCost(slot) {
  return 120 * ((Number(character.upgrades[slot]) || 0) + 1);
}

function upgradeSlotFromInput(input = '') {
  if (/방어|갑옷|옷|armor/i.test(input)) return '방어구';
  if (/장신|부적|접속패|정신|accessory|spirit/i.test(input)) return '장신구';
  return '무기';
}

function allyRole(name) {
  const index = Math.max(0, names.indexOf(name));
  return allyRoles[index % allyRoles.length];
}

function teamPower() {
  return team.reduce((power, name) => {
    const role = allyRole(name);
    const trustBonus = Math.floor(trustFor(name) / 3);
    power.attack += role.attack + (role.attack ? trustBonus : 0);
    power.defense += role.defense + (role.defense ? trustBonus : 0);
    power.heal += role.heal + (role.heal ? trustBonus : 0);
    if (role.label === '정찰형') power.scout += 1 + trustBonus;
    return power;
  }, { attack: 0, defense: 0, heal: 0, scout: 0 });
}

function teamLabel() {
  return team.length ? team.map((name) => `${name}(${allyRole(name).label}, 신뢰 ${trustFor(name)})`).join(', ') : '없음';
}

function trustFor(name) {
  return Math.max(0, Math.min(99, Number(teamTrust[name]) || 0));
}

function raiseTeamTrust(amount = 1) {
  if (!team.length) return;
  team.forEach((name) => {
    teamTrust[name] = Math.min(99, trustFor(name) + amount);
  });
}

function wealthFor(name) {
  if (!names.includes(name)) return 0;
  if (aiWealth[name] === undefined) aiWealth[name] = 80 + (hashName(name) % 220);
  return Math.max(0, Number(aiWealth[name]) || 0);
}

function setWealth(name, amount) {
  if (!names.includes(name)) return;
  aiWealth[name] = Math.max(0, Math.round(amount));
}

function debtFor(name) {
  return Math.max(0, Number(aiDebt[name]) || 0);
}

function addDebt(name, amount) {
  if (!names.includes(name)) return;
  aiDebt[name] = Math.max(0, Math.round(debtFor(name) + amount));
}

function addEconomyConcept(concept) {
  if (!concept) return;
  economy.concepts = [concept].concat(economy.concepts.filter((item) => item !== concept)).slice(0, 8);
}

function addContract(contract) {
  if (!contract) return;
  economy.contracts = [contract].concat((economy.contracts || []).filter((item) => item !== contract)).slice(0, 8);
}

function shiftEconomy(delta, concept, text) {
  economy.index = Math.max(40, Math.min(180, Math.round((Number(economy.index) || 100) + delta)));
  economy.last = text || economy.last;
  addEconomyConcept(concept);
}

function shiftReputation(delta) {
  economy.reputation = Math.max(-99, Math.min(99, Math.round((Number(economy.reputation) || 0) + delta)));
}

function recordGold(delta, reason = '기록 없음') {
  if (!delta) return;
  goldLog = [`${delta > 0 ? '+' : ''}${delta}전 ${reason}`].concat(goldLog).slice(0, 5);
}

function changeGold(delta, reason = '돈 이동') {
  const before = character.gold;
  character.gold = Math.max(0, Math.round((Number(character.gold) || 0) + delta));
  recordGold(character.gold - before, reason);
  return character.gold - before;
}

function spendGold(cost, reason) {
  if (character.gold < cost) {
    append(`${reason} 비용이 부족합니다. 필요 ${cost} 전 / 보유 ${character.gold} 전`);
    showChoices();
    return false;
  }
  changeGold(-cost, reason);
  economy.fund = Math.max(0, Math.round((Number(economy.fund) || 0) + cost));
  return true;
}

function roomZoneText(name = roomName) {
  const region = frontierRegion(name);
  const special = frontierSpecial(name);
  if (!region && !special) return '';
  return [region ? `${region.name} / 위험 ${region.risk}` : '', special ? special.label : ''].filter(Boolean).join(' / ');
}

function canShopHere() {
  return roomName === '장터' || roomName === FRONTIER_ROOM || frontierSpecial(roomName)?.type === 'shop';
}

function isShopCommand(command = '') {
  return /^(구매|구입|사|buy|착용|장착|equip|강화|업그레이드|upgrade)(\s|$)/.test(command);
}

function roomEvent(name = roomName) {
  const local = localEvents[name];
  if (local) return local;
  const coord = frontierCoord(name);
  if (!coord) return null;
  const region = regionEvents[coord.row - 1];
  const special = frontierSpecial(name);
  const depth = coord.row + coord.col;
  const specialText = {
    safe: '초소의 접속 기록을 정리하자 주변 지도가 또렷해졌다.',
    heal: '샘가의 푸른 흔적을 따라가며 상처를 돌본다.',
    shop: '역참 장부를 맞춰 주고 보급품 위치를 얻었다.',
    boss: `${special?.label} 주변의 낡은 전투 흔적을 읽었다.`
  };
  return {
    title: special ? `${special.label} 단서` : region.title,
    text: special ? specialText[special.type] : region.text,
    exp: 50 + depth * 18,
    gold: 20 + depth * 10,
    item: special ? `${special.label} 기록` : region.item,
    heal: (region.heal || 0) + (special?.type === 'heal' || special?.type === 'safe' ? 24 : 0),
    trust: region.trust || (special?.type === 'boss' ? 2 : 0),
    damage: region.damage || (special?.type === 'boss' ? 6 : 0)
  };
}

function eventDone(name = roomName) {
  return resolvedEvents.has(canonicalRoomName(name));
}

function eventChoice() {
  const event = roomEvent();
  return event && !eventDone() ? { label: `${event.title} 처리`, command: '사건' } : null;
}

function currentAutoMode() {
  return autoModes[autoModeEl?.value] ? autoModeEl.value : 'story';
}

function modeKey(text = '') {
  return String(text).replace(/\s+/g, '').toLowerCase();
}

function syncAutoModeOptions() {
  if (!autoModeEl) return;
  const existing = new Set(Array.from(autoModeEl.children || []).map((option) => option.value));
  Object.entries(autoModes).forEach(([value, label]) => {
    if (existing.has(value)) return;
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    autoModeEl.appendChild(option);
  });
  if (!autoModes[autoModeEl.value]) autoModeEl.value = 'story';
}

function setAutoMode(input = '') {
  const value = input.trim();
  const normalized = modeKey(value);
  const aliasMode = /무한평원|무한구역|frontier/.test(normalized) ? 'frontier' : '';
  const mode = aliasMode
    || Object.keys(autoModes).find((key) => key === value)
    || Object.keys(autoModes).find((key) => modeKey(key) === normalized)
    || Object.keys(autoModes).find((key) => modeKey(autoModes[key]).includes(normalized));
  if (!mode) {
    append(`자동 목표: ${Object.entries(autoModes).map(([key, label]) => `${key}=${label}`).join(' / ')}`);
    return;
  }
  syncAutoModeOptions();
  autoModeEl.value = mode;
  saveGameState();
  renderStatusPanel();
  append(`자동 목표를 ${autoModes[mode]}(으)로 바꿨습니다.`);
}

function frontierMapText() {
  const cell = `${FRONTIER_ROOM}${frontierSpecial(FRONTIER_ROOM)?.marker || 'X'} x${FRONTIER_ENEMY_POWER}`;
  return frontierCoord(roomName) ? `[${cell}]` : cell;
}

function mapText() {
  const here = (name) => (roomName === name ? `[${name}]` : name);
  return `${here('현감청')}        ${here('수련장')}
    \\          /
     ${here('중앙광장')} -- ${here('주막')} -- ${here('장터')}
        |    \\      |
      ${here('북문')}  ${here('생명의나무')} ${here('도박장')}
     /   \\    |
${here('초보사냥터')}  ${here('북문 밖 숲')}
              |
          ${here('폐광 입구')} -- ${here(FRONTIER_ROOM)}

[무한구역 1구역]
폐광 입구에서 단일 무한구역으로 진입한다.
표식: X 압축 전장 / 적 전투력 x${FRONTIER_ENEMY_POWER}
${frontierMapText()}
권역: ${frontierRegions.map((region) => `${region.name}(${region.risk})`).join(' / ')}`;
}

function nekoProfile() {
  const settings = currentSettings();
  const level = Math.max(1, Math.min(99, Number(settings.level) || 1));
  const equipLuck = equipmentBonus().luck || 0;
  const luck = Math.max(0, Math.min(99, Number(settings.luck) || 0)) + equipLuck + Math.floor(nekoMemory.level / 2) + nekoTraining.luck * 2;
  const ability = settings.ability || '길찾기와 명령어 해석';
  const role = settings.role || '길잡이';
  const risk = settings.risk || '균형';
  const memoryBonus = Math.min(6, Math.floor(nekoMemory.level / 3));
  const combat = 2 + Math.floor(level / 8) + memoryBonus + nekoTraining.combat + (/전투|전술|공격/.test(ability) || role === '전술가' ? 4 : 0);
  const guard = Math.floor(level / 15) + Math.floor(memoryBonus / 2) + Math.floor(nekoTraining.counsel / 2) + (/위험|예지|생존/.test(ability) || role === '수호자' || risk === '안전' ? 3 : 0);
  const growthRate = 1 + Math.min(0.7, level / 100) + Math.min(0.2, nekoMemory.level / 120) + (/전투|수련|성장/.test(ability) ? 0.15 : 0);
  const goldRate = 1 + Math.min(0.35, level / 180) + (/소문|탐지|상인/.test(ability) || role === '상인' ? 0.15 : 0);
  const autoDelay = risk === '공격' || risk === '광기' ? 1200 : /길찾기|명령어|예지/.test(ability) || role === '길잡이' ? 1500 : 1900;
  return { level, luck, ability, role, risk, combat, guard, growthRate, goldRate, autoDelay };
}

function saveGameState() {
  try {
    localStorage.setItem(GAME_STATE_KEY, JSON.stringify({
      saveVersion: SAVE_VERSION,
      roomName: canonicalRoomName(roomName),
      team,
      teamTrust,
      aiUsers: names,
      aiWealth,
      aiDebt,
      economy,
      goldLog,
      autoStrategy,
      frontierPhaseIndex,
      nekoTraining,
      aiBirthSeq,
      visitedRooms: canonicalRoomList(visitedRooms),
      resolvedEvents: canonicalRoomList(resolvedEvents),
      autoMode: currentAutoMode(),
      customItems,
      rogue: {
        active: rogue.active,
        depth: rogue.depth,
        maxDepth: rogue.maxDepth,
        bestDepth: rogue.bestDepth,
        kills: rogue.kills,
        runs: rogue.runs,
        fragments: rogue.fragments,
        relicChoice: rogue.relicChoice,
        perks: rogue.perks,
        relics: rogue.relics,
        curses: rogue.curses,
        nodes: canonicalRoomList(rogue.nodes)
      },
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
        gambleDebt: character.gambleDebt,
        scars: character.scars,
        storyStep: character.storyStep,
        mood: character.mood,
        insight: character.insight,
        lastScene: character.lastScene,
        equipment: character.equipment,
        upgrades: character.upgrades,
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
  const savedRoom = canonicalRoomName(saved.roomName);
  if (rooms[savedRoom]) roomName = savedRoom;
  if (Array.isArray(saved.visitedRooms)) {
    visitedRooms = new Set(canonicalRoomList(saved.visitedRooms));
  }
  visitedRooms.add(roomName);
  if (Array.isArray(saved.resolvedEvents)) {
    resolvedEvents = new Set(canonicalRoomList(saved.resolvedEvents));
  }
  if (autoModeEl && autoModes[saved.autoMode]) autoModeEl.value = saved.autoMode;
  if (Array.isArray(saved.aiUsers)) names = cleanAiUsers(saved.aiUsers);
  if (!names.length) ensureAiUsers(200);
  if (saved.aiWealth && typeof saved.aiWealth === 'object') {
    aiWealth = Object.fromEntries(Object.entries(saved.aiWealth)
      .filter(([name]) => names.includes(name))
      .map(([name, value]) => [name, Math.max(0, Number(value) || 0)]));
  }
  if (saved.aiDebt && typeof saved.aiDebt === 'object') {
    aiDebt = Object.fromEntries(Object.entries(saved.aiDebt)
      .filter(([name]) => names.includes(name))
      .map(([name, value]) => [name, Math.max(0, Number(value) || 0)]));
  }
  if (saved.economy && typeof saved.economy === 'object') {
    economy = {
      index: Math.max(40, Math.min(180, Number(saved.economy.index) || 100)),
      fund: Math.max(0, Number(saved.economy.fund) || 0),
      last: String(saved.economy.last || economy.last),
      concepts: Array.isArray(saved.economy.concepts) ? saved.economy.concepts.filter(Boolean).slice(0, 8) : [],
      reputation: Math.max(-99, Math.min(99, Number(saved.economy.reputation) || 0)),
      contracts: Array.isArray(saved.economy.contracts) ? saved.economy.contracts.filter(Boolean).slice(0, 8) : []
    };
  }
  if (Array.isArray(saved.goldLog)) {
    goldLog = saved.goldLog.filter(Boolean).slice(0, 5);
  }
  if (autoStrategies[saved.autoStrategy]) autoStrategy = saved.autoStrategy;
  frontierPhaseIndex = Math.max(0, Number(saved.frontierPhaseIndex) || 0) % frontierPhases.length;
  if (saved.nekoTraining && typeof saved.nekoTraining === 'object') {
    nekoTraining = {
      combat: Math.max(0, Number(saved.nekoTraining.combat) || 0),
      luck: Math.max(0, Number(saved.nekoTraining.luck) || 0),
      counsel: Math.max(0, Number(saved.nekoTraining.counsel) || 0)
    };
  }
  aiBirthSeq = Math.max(1, Number(saved.aiBirthSeq) || aiBirthSeq);
  if (Array.isArray(saved.team)) {
    team = saved.team.filter((name, index, list) => names.includes(name) && list.indexOf(name) === index).slice(0, 4);
  }
  if (saved.teamTrust && typeof saved.teamTrust === 'object') {
    teamTrust = Object.fromEntries(Object.entries(saved.teamTrust)
      .filter(([name]) => names.includes(name))
      .map(([name, value]) => [name, Math.max(0, Math.min(99, Number(value) || 0))]));
  }
  if (saved.customItems && typeof saved.customItems === 'object') {
    customItems = Object.fromEntries(Object.entries(saved.customItems).filter(([, stats]) => (
      stats && ['무기', '방어구', '장신구'].includes(stats.slot)
    )));
  }
  if (saved.rogue && typeof saved.rogue === 'object') {
    rogue.active = Boolean(saved.rogue.active);
    rogue.depth = Math.max(0, Number(saved.rogue.depth) || 0);
    rogue.maxDepth = Math.max(0, Number(saved.rogue.maxDepth) || 0);
    rogue.bestDepth = Math.max(0, Number(saved.rogue.bestDepth) || 0);
    rogue.kills = Math.max(0, Number(saved.rogue.kills) || 0);
    rogue.runs = Math.max(0, Number(saved.rogue.runs) || 0);
    rogue.fragments = Math.max(0, Number(saved.rogue.fragments) || 0);
    rogue.relicChoice = Math.max(0, Number(saved.rogue.relicChoice) || 0);
    if (saved.rogue.perks && typeof saved.rogue.perks === 'object') {
      rogue.perks = { ...rogue.perks, ...saved.rogue.perks };
    }
    rogue.relics = Array.isArray(saved.rogue.relics)
      ? saved.rogue.relics.filter((name) => rogueRelicCatalog.some((item) => item.name === name))
      : [];
    rogue.curses = Array.isArray(saved.rogue.curses)
      ? saved.rogue.curses.filter((name) => rogueCurseCatalog.some((item) => item.name === name))
      : [];
    rogue.nodes = Array.isArray(saved.rogue.nodes) ? canonicalRoomList(saved.rogue.nodes) : [];
  }
  if (saved.character && typeof saved.character === 'object') {
    for (const key of ['title', 'level', 'hp', 'hpMax', 'mp', 'mpMax', 'attack', 'defense', 'spirit', 'exp', 'expToLevel', 'gold', 'gambleDebt', 'storyStep', 'mood', 'insight', 'lastScene']) {
      if (saved.character[key] !== undefined) character[key] = saved.character[key];
    }
    if (Array.isArray(saved.character.scars)) {
      character.scars = saved.character.scars.filter((scar) => scar && scar.name).slice(0, 8);
    }
    if (saved.character.equipment && typeof saved.character.equipment === 'object') character.equipment = saved.character.equipment;
    if (saved.character.upgrades && typeof saved.character.upgrades === 'object') {
      character.upgrades = { ...character.upgrades, ...saved.character.upgrades };
    }
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
  character.gambleDebt = Math.max(0, Number(character.gambleDebt) || 0);
  character.scars = Array.isArray(character.scars) ? character.scars.slice(0, 8) : [];
  character.storyStep = Math.max(0, Math.min(story.length - 1, Number(character.storyStep) || 0));
  ensureRoguePerks();
  for (const slot of ['무기', '방어구', '장신구']) {
    character.upgrades[slot] = Math.max(0, Number(character.upgrades[slot]) || 0);
  }
}

function renderStatusPanel() {
  const neko = nekoProfile();
  const growth = growthForJob();
  const stats = effectiveStats();
  const debtors = Object.entries(aiDebt)
    .filter(([, debt]) => Number(debt) > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, debt]) => `${name} ${debt}전`);
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
    `도박 빚: ${character.gambleDebt || 0} 전`,
    `위치: ${roomName}`,
    `방문: ${visitedRooms.size}/${Object.keys(rooms).length}`,
    `사건: ${resolvedEvents.size}/${Object.keys(rooms).length}`,
    `AI 유저: ${names.length}명`,
    ...(roomZoneText() ? [`지역: ${roomZoneText()}`] : []),
    '',
    '[경제]',
    `시장지수: ${economy.index}`,
    `공동기금: ${economy.fund} 전`,
    `평판: ${economy.reputation}`,
    `부채: ${debtors.join(', ') || '없음'}`,
    `계약: ${(economy.contracts || []).slice(0, 3).join(' / ') || '없음'}`,
    `최근: ${economy.last}`,
    `새 개념: ${economy.concepts.join(', ') || '없음'}`,
    `돈 장부: ${goldLog.join(' / ') || '없음'}`,
    '',
    '[현재상태]',
    `감정: ${character.mood}`,
    `장면: ${character.lastScene}`,
    `깨달음: ${character.insight}`,
    `팀: ${teamLabel()}`,
    `자동 목표: ${autoModes[currentAutoMode()]}`,
    `자동 전략: ${autoStrategies[autoStrategy] || autoStrategies.균형}`,
    `흉터: ${scarSummary()}`,
    '',
    '[무한구역]',
    `위상: ${phaseText()}`,
    `적 배율: x${FRONTIER_ENEMY_POWER}`,
    '',
    '[무한원정]',
    `상태: ${rogue.active ? '진행 중' : '대기'}`,
    `현재 깊이: ${rogue.depth} / 이번 최고 ${rogue.maxDepth}`,
    `역대 최고: ${rogue.bestDepth}`,
    `현재 노드: ${frontierCoord(roomName) ? rogueNodeType() : '없음'}`,
    `처치: ${rogue.kills}`,
    `파편: ${rogue.fragments}`,
    `영구: HP ${rogue.perks?.hp || 0} / 공격 ${rogue.perks?.attack || 0} / 방어 ${rogue.perks?.defense || 0} / 정신 ${rogue.perks?.spirit || 0} / 저주저항 ${rogue.perks?.curse || 0} / 유물권 ${rogue.relicChoice || 0}`,
    `유물: ${rogue.relics.length ? rogue.relics.join(', ') : '없음'}`,
    `저주: ${rogue.curses.length ? rogue.curses.join(', ') : '없음'}`,
    '',
    '[현재 임무]',
    currentQuest().title,
    currentQuest().goal,
    '',
    ...(team.length ? [
      '[팀 신뢰]',
      ...team.map((name) => `${name}: ${trustFor(name)} / ${allyRole(name).label} / ${aiAbility(name)}`)
    ] : []),
    ...(team.length ? [''] : []),
    '[네코]',
    `레벨: ${neko.level}`,
    `행운: ${neko.luck}`,
    `능력: ${neko.ability}`,
    `역할: ${neko.role} / 위험 ${neko.risk}`,
    `훈련: 전투 ${nekoTraining.combat} / 행운 ${nekoTraining.luck} / 조언 ${nekoTraining.counsel}`,
    `전투 보조: +${neko.combat}`,
    `성장 보정: x${neko.growthRate.toFixed(2)}`,
    `자동 진행: ${autoProgress ? '켜짐' : '꺼짐'}`,
    '',
    '[네코 지식]',
    nekoMemoryText(),
    '',
    '[장비]',
    ...Object.entries(character.equipment).map(([slot, item]) => `${slot}: ${item}${itemBonusText(item) ? ` (${itemBonusText(item)})` : ''}`),
    '',
    '[강화]',
    ...['무기', '방어구', '장신구'].map((slot) => `${slot}: +${character.upgrades[slot] || 0}`),
    '',
    '[보관 아이템]',
    ...character.inventory.map((item, index) => `${index + 1}. ${item}${itemBonusText(item) ? ` (${itemBonusText(item)})` : ''}`),
    '',
    '[실시간 지도]',
    mapText()
  ].join('\n');
  updateDiagnostics();
}

function hasItem(name) {
  return character.inventory.some((item) => item.startsWith(name));
}

function addItem(item) {
  character.inventory.push(item);
}

function grantStoryReward(step) {
  const reward = storyRewards[step];
  if (!reward) return;
  character.exp += reward.exp || 0;
  changeGold(reward.gold || 0, '임무 보상');
  if (reward.item && !hasItem(reward.item)) addItem(reward.item);
  append(`\n[임무 보상]\n경험 ${reward.exp || 0}, 돈 ${reward.gold || 0} 전${reward.item ? `, 물품 ${reward.item}` : ''}`, 'choice');
  autoLevelUp('임무 보상');
}

function removeOneItem(name) {
  const index = character.inventory.findIndex((item) => item.startsWith(name));
  if (index >= 0) character.inventory.splice(index, 1);
  return index >= 0;
}

function removeExactItem(name) {
  const index = character.inventory.indexOf(name);
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
  const adjusted = Math.max(1, Math.round(amount * rogueHealRate()));
  character.hp = Math.min(character.hpMax, character.hp + adjusted);
  const healed = character.hp - before;
  if (healed > 0) append(`${source}: HP ${healed} 회복. 현재 HP ${character.hp}/${character.hpMax}`, className);
  return healed;
}

function nekoHeal() {
  const neko = nekoProfile();
  const abilityBonus = /회복|치유|생존|위험|예지/.test(neko.ability) ? 8 : 0;
  const roleBonus = neko.role === '치유사' ? 10 : 0;
  const amount = Math.round(character.hpMax * 0.22) + Math.floor(neko.level / 6) + Math.floor(nekoMemory.level / 4) + character.spirit + abilityBonus + roleBonus;
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
  const canRestRogue = rogue.active && rogueNodeType() === '휴식';
  if (character.hp >= character.hpMax && !(canRestRogue && rogue.curses.length)) {
    append('HP는 이미 가득 찼습니다.');
    showChoices();
    return;
  }

  let healed = 0;
  if (canRestRogue) {
    healed += healCharacter(Math.ceil(character.hpMax * 0.45), '무한원정 휴식 노드', 'ally');
    if (rogue.curses.length) {
      const removed = rogue.curses.shift();
      append(`[저주 해제] ${removed}의 압박이 옅어졌습니다.`, 'choice');
    }
  }
  if (frontierSpecial(roomName)?.type === 'heal') healed += healCharacter(character.hpMax, frontierSpecial(roomName).label, 'ally');
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
  if (!canShopHere()) {
    append('상점 품목은 장터나 무한구역 보급지점에서 확인할 수 있습니다.');
    showChoices();
    return;
  }
  append(`\n[상점 품목]\n${Object.entries(shopItems).map(([name, item]) => `${name}: ${item.price} 전 - ${item.desc}`).join('\n')}\n구매 예) 구매 회복약 / 구매 청동검\n강화 예) 강화 무기 / 강화 방어구 / 강화 장신구`, 'room');
  showChoices();
}

function buyItem(input = '') {
  if (!canShopHere()) {
    append('구매는 장터나 무한구역 보급지점에서 할 수 있습니다.');
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

  changeGold(-item.price, `${itemName} 구매`);
  addItem(itemName);
  append(`약장수: ${itemName} 하나 챙겨두게. 남은 돈 ${character.gold} 전.`, 'ally');
  commitProgress();
  showChoices();
}

function trainNekoWithGold(input = '') {
  const key = /행운|운/.test(input) ? 'luck' : /위로|조언|상담/.test(input) ? 'counsel' : 'combat';
  const label = { combat: '전투', luck: '행운', counsel: '조언' }[key];
  const total = nekoTraining.combat + nekoTraining.luck + nekoTraining.counsel;
  const cost = 80 + total * 45;
  if (!spendGold(cost, `네코 ${label} 훈련`)) return;
  nekoTraining[key] += 1;
  shiftEconomy(1, '네코 훈련소', `네코 ${label} 훈련비 ${cost}전이 시장에 풀렸다.`);
  rememberNeko('대화', `네코 ${label} 훈련`, 2);
  reflect('희망', '투자는 미래의 불안을 오늘의 선택으로 바꾸는 일이다.', `네코 ${label} 훈련`);
  commitProgress();
  append(`\n[네코 훈련]\n분야: ${label}\n비용: ${cost} 전\n훈련: 전투 ${nekoTraining.combat} / 행운 ${nekoTraining.luck} / 조언 ${nekoTraining.counsel}\n네코: 이건 단순한 소비가 아니라, 다음 위험을 읽는 감각을 사는 거야.`, 'neko');
  showChoices();
}

function giftTeam(input = '') {
  if (!team.length) {
    append('선물이나 급여를 줄 팀원이 없습니다.');
    showChoices();
    return;
  }
  const target = team.find((name) => input.includes(name));
  const targets = target ? [target] : team;
  const cost = targets.length * (40 + character.level * 5);
  if (!spendGold(cost, '동료 선물')) return;
  targets.forEach((name) => {
    teamTrust[name] = Math.min(99, trustFor(name) + (target ? 5 : 3));
    setWealth(name, wealthFor(name) + Math.floor(cost / targets.length));
  });
  shiftReputation(1);
  targets.forEach((name) => addContract(`${name} 동료 급여`));
  shiftEconomy(1, '급여 계약', `${targets.join(', ')}에게 ${cost}전이 지급됐다.`);
  reflect('기쁨', '관계는 마음만으로 유지되지 않고, 때로는 밥값으로도 증명된다.', `동료 선물: ${targets.join(', ')}`);
  commitProgress();
  append(`\n[동료 선물]\n대상: ${targets.join(', ')}\n비용: ${cost} 전\n신뢰: ${targets.map((name) => `${name} ${trustFor(name)}`).join(' / ')}`, 'ally');
  showChoices();
}

function buyInformation(input = '') {
  const cost = 50 + character.level * 8;
  if (!spendGold(cost, '정보 구매')) return;
  const normalizedInput = input.replace(/무한평원(?:\s+\d{2}-\d{2})?/g, FRONTIER_ROOM);
  const directRoom = Object.keys(rooms).find((name) => normalizedInput.includes(name));
  const frontierNext = FRONTIER_ROOM;
  const targetRoom = directRoom || frontierNext || roomName;
  const event = roomEvent(targetRoom);
  const monsters = encountersForRoom(targetRoom).slice(0, 2).map((monster) => `${monster.name} Lv.${monster.level}`).join(', ') || '낮음';
  shiftEconomy(1, '정보 상인', `${targetRoom} 정보가 ${cost}전에 거래됐다.`);
  rememberNeko('대화', `${targetRoom} 정보 구매`, 1);
  reflect('호기심', '정보는 위험을 없애지 않지만, 두려움의 모양을 보여준다.', `정보 구매: ${targetRoom}`);
  commitProgress();
  append(`\n[정보 구매]\n비용: ${cost} 전\n대상: ${targetRoom}\n위험: ${monsters}\n사건: ${event ? event.title : '없음'}\n네코: 알기 전의 위험과 알고 난 뒤의 위험은 전혀 달라.`, 'neko');
  showChoices();
}

function paidCare(input = '') {
  const missingHp = Math.max(0, character.hpMax - character.hp);
  const removeCurse = rogue.curses.length && /저주|해제|요양|치료소/.test(input);
  if (!missingHp && !removeCurse) {
    append('치료할 부상이나 해제할 저주가 없습니다.');
    showChoices();
    return;
  }
  const cost = 55 + Math.ceil(missingHp / 2) + (removeCurse ? 70 : 0);
  if (!spendGold(cost, '치료소')) return;
  if (missingHp) healCharacter(character.hpMax, '치료소', 'ally');
  const removed = removeCurse ? rogue.curses.shift() : '';
  shiftEconomy(1, '치료 조합', `치료소가 ${cost}전을 받고 ${removed || '부상'}을 처리했다.`);
  reflect('안도', '회복은 상처가 없던 과거로 돌아가는 것이 아니라 다시 걸을 수 있는 현재를 사는 일이다.', removed ? `저주 해제: ${removed}` : '부상 치료');
  commitProgress();
  append(`\n[치료소]\n비용: ${cost} 전${removed ? `\n저주 해제: ${removed}` : ''}\n현재 HP: ${character.hp}/${character.hpMax}`, 'ally');
  showChoices();
}

function applyEconomyEvent(kind, actor, target) {
  const actorMoney = wealthFor(actor);
  const targetMoney = wealthFor(target);
  if (kind === '파산') {
    const loss = Math.min(actorMoney, 80 + (hashName(actor) % 120));
    setWealth(actor, actorMoney - loss);
    setWealth(target, targetMoney + Math.floor(loss * 0.2));
    addDebt(actor, loss);
    shiftEconomy(-5, '부실채권', `${actor}의 파산으로 빚문서가 돌기 시작했다.`);
    return `${actor}이(가) 파산했다. ${loss}전 규모의 부실채권이 생기고 ${target}이(가) 일부를 헐값에 사들였다.`;
  }
  if (kind === '고용') {
    const wage = Math.min(actorMoney, 45 + character.level * 10);
    setWealth(actor, actorMoney - wage);
    setWealth(target, targetMoney + wage);
    if (team.includes(target)) teamTrust[target] = Math.min(99, trustFor(target) + 2);
    addContract(`${actor}-${target} 고용`);
    shiftEconomy(2, '고용 시장', `${actor}이(가) ${target}에게 ${wage}전을 지급했다.`);
    return `${actor}이(가) ${target}을(를) 고용했다. 급여 ${wage}전이 이동했다.`;
  }
  if (kind === '기부') {
    const gift = Math.min(actorMoney, 35 + (hashName(target) % 70));
    setWealth(actor, actorMoney - gift);
    economy.fund += gift;
    if (character.hp < character.hpMax) character.hp = Math.min(character.hpMax, character.hp + 5);
    shiftReputation(1);
    shiftEconomy(1, '구호 기금', `${actor}의 기부금 ${gift}전이 공동기금에 들어왔다.`);
    return `${actor}이(가) ${gift}전을 기부했다. 주막에는 구호 기금이라는 새 말이 돌기 시작했다.`;
  }
  const stake = Math.min(actorMoney, 50 + (hashName(target) % 100));
  const success = Math.random() + economy.index / 260 > 0.82;
  setWealth(actor, actorMoney - stake + (success ? stake * 2 : Math.floor(stake * 0.25)));
  setWealth(target, targetMoney + (success ? Math.floor(stake * 0.4) : Math.floor(stake * 0.1)));
  if (!success) addDebt(actor, Math.floor(stake * 0.45));
  addContract(`${actor}-${target} 투자`);
  shiftEconomy(success ? 4 : -4, success ? '투자 조합' : '실패 담보', `${actor}의 투자 ${success ? '성공' : '실패'}`);
  return success
    ? `${actor}이(가) ${target}에게 ${stake}전을 투자해 성공했다. 배당과 소문이 시장을 달궜다.`
    : `${actor}이(가) ${target}에게 ${stake}전을 투자했지만 실패했다. 실패 담보라는 새 거래가 생겼다.`;
}

function economyEvent(input = '') {
  const kind = /파산/.test(input) ? '파산' : /고용/.test(input) ? '고용' : /기부/.test(input) ? '기부' : '투자';
  const actor = pick(names);
  const target = pick(names.filter((name) => name !== actor));
  const text = applyEconomyEvent(kind, actor, target);
  append(`\n[경제]\n${text}\n시장지수: ${economy.index}\n새 개념: ${economy.concepts[0] || '없음'}`, 'ally');
  commitProgress();
  renderStatusPanel();
}

function isAllIn(input = '') {
  return /올인|all[-\s]?in|전부|전체|모두/i.test(input);
}

function gambleStake(input = '') {
  if (isAllIn(input)) return Math.max(0, Math.floor(character.gold));
  const amount = Number((input.match(/\d+/) || [])[0]) || 50;
  return Math.max(10, Math.min(500, Math.floor(amount)));
}

function noteGambleBankruptcy(game, stake) {
  if (character.gold > 0 || stake <= 0) return;
  const debt = Math.max(25, Math.floor(stake * 0.2));
  character.gambleDebt = Math.max(0, (Number(character.gambleDebt) || 0) + debt);
  addContract('도박장 외상 주의');
  shiftReputation(-1);
  reflect('절망', '빈 주머니는 끝이 아니라, 다음 선택이 얼마나 진짜인지 묻는 조용한 질문이다.', `도박 파산: ${game}`);
  commitProgress();
  append(`[도박장 파산]\n남은 돈 0전. 외상 ${debt}전이 붙었습니다. 총 도박 빚 ${character.gambleDebt}전.\n네코: 지금은 더 걸 돈이 없어. "사냥", "사건", "사회 상단", "빚갚기"로 다시 발판을 만들자.`, 'neko');
}

function payGambleDebt(input = '') {
  if (!character.gambleDebt) {
    append('갚을 도박 빚이 없습니다.');
    showChoices();
    return;
  }
  const requested = Number((input.match(/\d+/) || [])[0]) || character.gambleDebt;
  const amount = Math.min(character.gold, character.gambleDebt, Math.max(1, Math.floor(requested)));
  if (amount <= 0) {
    append(`도박 빚 ${character.gambleDebt}전이 남아 있습니다. 먼저 돈을 마련하세요.`);
    showChoices();
    return;
  }
  changeGold(-amount, '도박 빚 상환');
  character.gambleDebt -= amount;
  if (!character.gambleDebt) {
    addContract('도박장 빚 청산');
    shiftReputation(1);
  }
  commitProgress();
  append(`[빚 상환]\n${amount}전을 갚았습니다. 남은 도박 빚 ${character.gambleDebt}전.`, 'ally');
  showChoices();
}

function settleGamble(game, stake, result, detail, payout = stake * 2, loseEffect = null) {
  if (!spendGold(stake, game)) return;
  const outcome = result === 'push' || result === 'partial' ? result : result ? 'win' : 'lose';
  if (outcome !== 'lose' && payout > 0) {
    changeGold(payout, `${game} 정산`);
    economy.fund = Math.max(0, economy.fund - Math.floor(payout / 2));
  }
  if (outcome === 'win') {
    shiftReputation(1);
  } else if (outcome === 'lose') {
    if (loseEffect) loseEffect();
    shiftReputation(game === '검은 룰렛' ? -2 : -1);
  }
  const detailText = typeof detail === 'function' ? detail() : detail;
  const outcomeText = outcome === 'win' ? `승리 / 수령 ${payout}전` : outcome === 'push' ? `무승부 / 반환 ${payout}전` : outcome === 'partial' ? `부분 환급 ${payout}전` : '패배';
  shiftEconomy(outcome === 'win' ? 1 : outcome === 'lose' ? -1 : 0, '도박장 신용', `${game} ${stake}전 ${outcomeText}`);
  reflect(outcome === 'lose' ? '불안' : '기쁨', outcome === 'lose' ? '잃은 돈은 숫자지만, 잃은 판단은 다음 선택에 남는다.' : '운은 노력의 반대가 아니라 위험을 감당한 뒤 남는 해석이다.', `도박장: ${game}`);
  commitProgress();
  append(`\n[도박장]\n게임: ${game}\n판돈: ${stake} 전\n${detailText}\n결과: ${outcomeText}\n평판: ${economy.reputation}`, outcome === 'lose' ? 'choice' : 'ally');
  if (outcome === 'lose') noteGambleBankruptcy(game, stake);
  showChoices();
}

function newDeck() {
  const suits = ['♠', '♥', '♦', '♣'];
  return suits.flatMap((suit) => Array.from({ length: 13 }, (_, index) => ({ rank: index + 2, suit })))
    .sort(() => Math.random() - 0.5);
}

function drawCard(deck) {
  return deck.pop();
}

function cardText(card) {
  const labels = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };
  return `${labels[card.rank] || card.rank}${card.suit}`;
}

function cardsText(cards) {
  return cards.map(cardText).join(' ');
}

function blackjackValue(cards) {
  let total = cards.reduce((sum, card) => sum + (card.rank === 14 ? 11 : Math.min(10, card.rank)), 0);
  let aces = cards.filter((card) => card.rank === 14).length;
  while (total > 21 && aces) {
    total -= 10;
    aces -= 1;
  }
  return total;
}

function finishBlackjack(outcome, detail) {
  const hand = gambleState.blackjack;
  if (!hand) return;
  const payout = outcome === 'blackjack' ? Math.round(hand.stake * 2.5) : outcome === 'win' ? hand.stake * 2 : outcome === 'push' ? hand.stake : 0;
  if (payout) {
    changeGold(payout, '블랙잭 정산');
    economy.fund = Math.max(0, economy.fund - Math.floor(payout / 2));
  }
  shiftEconomy(outcome === 'lose' ? -1 : outcome === 'push' ? 0 : 1, '블랙잭 테이블', `블랙잭 ${hand.stake}전 ${outcome}`);
  if (outcome !== 'push') shiftReputation(outcome === 'lose' ? -1 : 1);
  reflect(outcome === 'lose' ? '불안' : outcome === 'push' ? '안도' : '기쁨', '카드를 더 받는 용기와 멈추는 용기는 서로 다른 기술이다.', '도박장: 블랙잭');
  gambleState.blackjack = null;
  commitProgress();
  append(`\n[도박장]\n게임: 블랙잭\n판돈: ${hand.stake} 전\n내 패: ${cardsText(hand.player)} (${blackjackValue(hand.player)})\n딜러 패: ${cardsText(hand.dealer)} (${blackjackValue(hand.dealer)})\n${detail}\n결과: ${outcome === 'push' ? `푸시 / 반환 ${payout}전` : outcome === 'lose' ? '패배' : `승리 / 수령 ${payout}전`}`, outcome === 'lose' ? 'choice' : 'ally');
  if (outcome === 'lose') noteGambleBankruptcy('블랙잭', hand.stake);
  showChoices();
}

function startBlackjack(stake) {
  if (!spendGold(stake, '블랙잭')) return;
  const deck = newDeck();
  const player = [drawCard(deck), drawCard(deck)];
  const dealer = [drawCard(deck), drawCard(deck)];
  gambleState.blackjack = { stake, deck, player, dealer };
  if (blackjackValue(player) === 21 || blackjackValue(dealer) === 21) {
    finishBlackjack(blackjackValue(player) === blackjackValue(dealer) ? 'push' : blackjackValue(player) === 21 ? 'blackjack' : 'lose', '첫 두 장에서 승부가 났다.');
    return;
  }
  append(`\n[도박장]\n게임: 블랙잭\n판돈: ${stake} 전\n내 패: ${cardsText(player)} (${blackjackValue(player)})\n딜러 공개: ${cardText(dealer[0])}\n선택: 히트 / 스탠드`, 'room');
  showChoices();
}

function blackjackHit() {
  const hand = gambleState.blackjack;
  if (!hand) {
    append('진행 중인 블랙잭 판이 없습니다.');
    showChoices();
    return;
  }
  hand.player.push(drawCard(hand.deck));
  if (blackjackValue(hand.player) > 21) {
    finishBlackjack('lose', '버스트.');
    return;
  }
  append(`\n[블랙잭]\n내 패: ${cardsText(hand.player)} (${blackjackValue(hand.player)})\n선택: 히트 / 스탠드`, 'room');
  showChoices();
}

function blackjackStand() {
  const hand = gambleState.blackjack;
  if (!hand) {
    append('스탠드할 블랙잭 판이 없습니다.');
    showChoices();
    return;
  }
  while (blackjackValue(hand.dealer) < 17) hand.dealer.push(drawCard(hand.deck));
  const player = blackjackValue(hand.player);
  const dealer = blackjackValue(hand.dealer);
  const outcome = dealer > 21 || player > dealer ? 'win' : player === dealer ? 'push' : 'lose';
  finishBlackjack(outcome, `딜러는 17 이상에서 멈췄다.`);
}

function straightHigh(ranks) {
  const unique = [...new Set(ranks)].sort((a, b) => b - a);
  if (unique.includes(14)) unique.push(1);
  for (let index = 0; index <= unique.length - 5; index += 1) {
    const run = unique.slice(index, index + 5);
    if (run[0] - run[4] === 4) return run[0];
  }
  return 0;
}

function pokerHand(cards) {
  const ranks = cards.map((card) => card.rank).sort((a, b) => b - a);
  const bySuit = ['♠', '♥', '♦', '♣'].map((suit) => cards.filter((card) => card.suit === suit));
  const flush = bySuit.find((items) => items.length >= 5)?.map((card) => card.rank).sort((a, b) => b - a) || [];
  const straight = straightHigh(ranks);
  const straightFlush = flush.length ? straightHigh(flush) : 0;
  const counts = [...new Set(ranks)].map((rank) => [rank, ranks.filter((item) => item === rank).length])
    .sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const four = counts.find(([, count]) => count === 4);
  const trips = counts.filter(([, count]) => count === 3);
  const pairs = counts.filter(([, count]) => count === 2);
  const score = (name, values) => ({ name, values });
  if (straightFlush) return score('스트레이트 플러시', [8, straightFlush]);
  if (four) return score('포카드', [7, four[0], ...ranks.filter((rank) => rank !== four[0]).slice(0, 1)]);
  if (trips.length && (pairs.length || trips.length > 1)) return score('풀하우스', [6, trips[0][0], (pairs[0] || trips[1])[0]]);
  if (flush.length) return score('플러시', [5, ...flush.slice(0, 5)]);
  if (straight) return score('스트레이트', [4, straight]);
  if (trips.length) return score('트리플', [3, trips[0][0], ...ranks.filter((rank) => rank !== trips[0][0]).slice(0, 2)]);
  if (pairs.length >= 2) return score('투페어', [2, pairs[0][0], pairs[1][0], ...ranks.filter((rank) => rank !== pairs[0][0] && rank !== pairs[1][0]).slice(0, 1)]);
  if (pairs.length) return score('원페어', [1, pairs[0][0], ...ranks.filter((rank) => rank !== pairs[0][0]).slice(0, 3)]);
  return score('하이카드', [0, ...ranks.slice(0, 5)]);
}

function comparePoker(a, b) {
  for (let index = 0; index < Math.max(a.values.length, b.values.length); index += 1) {
    if ((a.values[index] || 0) !== (b.values[index] || 0)) return (a.values[index] || 0) - (b.values[index] || 0);
  }
  return 0;
}

function gamble(input = '') {
  if (roomName !== '도박장') {
    append('도박은 주막 옆 도박장에서만 가능합니다. 예) 이동 주막 → 이동 도박장');
    showChoices();
    return;
  }
  if (isAllIn(input) && !/블랙잭|blackjack|파칭코|pachinko|텍사스|포커|poker|러시안|룰렛|roulette/i.test(input)) {
    input = `${input} 블랙잭`;
  }
  const stake = gambleStake(input);
  if (stake <= 0) {
    append('올인할 돈이 없습니다. 사냥이나 사건으로 돈을 먼저 마련하세요.');
    showChoices();
    return;
  }
  if (/블랙잭|blackjack/i.test(input)) {
    startBlackjack(stake);
    return;
  }
  if (/파칭코|pachinko/i.test(input)) {
    const balls = Math.max(3, Math.min(20, Math.floor(stake / 10)));
    let payout = 0;
    const slots = Array.from({ length: balls }, () => {
      let pos = 0;
      for (let row = 0; row < 7; row += 1) pos += Math.random() > 0.5 ? 1 : -1;
      const multiplier = pos === 0 ? 5 : Math.abs(pos) === 1 ? 2 : Math.abs(pos) === 2 ? 1 : 0;
      payout += Math.round((stake / balls) * multiplier);
      return pos;
    });
    settleGamble('파칭코', stake, payout > stake ? true : payout === stake ? 'push' : payout > 0 ? 'partial' : false, `구슬 ${balls}개 / 슬롯 ${slots.join(', ')} / 환급 ${payout}전`, payout);
    return;
  }
  if (/텍사스|포커|poker/i.test(input)) {
    const deck = newDeck();
    const player = [drawCard(deck), drawCard(deck)];
    const dealer = [drawCard(deck), drawCard(deck)];
    const board = [drawCard(deck), drawCard(deck), drawCard(deck), drawCard(deck), drawCard(deck)];
    const playerHand = pokerHand(player.concat(board));
    const dealerHand = pokerHand(dealer.concat(board));
    const result = comparePoker(playerHand, dealerHand);
    const payout = result > 0 ? stake * 2 : result === 0 ? stake : 0;
    settleGamble('텍사스포커', stake, result > 0 ? true : result === 0 ? 'push' : false, `내 패: ${cardsText(player)} / 딜러 패: ${cardsText(dealer)}\n보드: ${cardsText(board)}\n족보: ${playerHand.name} vs ${dealerHand.name}`, payout);
    return;
  }
  if (/러시안|룰렛|roulette/i.test(input)) {
    const chamber = 1 + Math.floor(Math.random() * 6);
    const safe = chamber !== 1;
    settleGamble(
      '검은 룰렛',
      stake,
      safe,
      () => (safe ? `6칸 중 ${chamber}번. 위험 칸을 피했다.` : `6칸 중 1번 위험 칸. HP ${character.hp}/${character.hpMax}`),
      stake * 4,
      () => { character.hp = Math.max(1, character.hp - (3 + character.level)); }
    );
    return;
  }
  append('\n[도박장]\n도박 블랙잭 50\n도박 파칭코 50\n도박 텍사스포커 50\n도박 러시안룰렛 50\n도박 블랙잭 올인\n도박 파칭코 올인\n도박 텍사스포커 올인\n도박 러시안룰렛 올인\n네코: 이곳은 돈보다 판단력이 먼저 닳는 장소야.', 'room');
  showChoices();
}

function setStoryStep(step, text) {
  if (character.storyStep >= step) return;
  character.storyStep = Math.min(step, story.length - 1);
  append(`\n[임무 갱신]\n${currentQuest().title}\n${text || currentQuest().goal}`, 'choice');
  grantStoryReward(character.storyStep);
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
  append('설정이 저장되었습니다. 네코의 대화 연결만 새로 시작하고 축적 지식은 유지합니다.');
  if (autoProgress) setAutoProgress(true);
  else renderStatusPanel();
}

function loadSettings() {
  const defaults = {
    model: DEFAULT_MODEL,
    gender: '검은 고양이',
    tone: '상냥하고 짧게 말함',
    personality: '차분한 분석가',
    role: '길잡이',
    risk: '균형',
    memoryMode: '요약 기억',
    level: '7',
    luck: '7',
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
  fields.personality.value = pick(randomSettings.personality);
  fields.role.value = pick(randomSettings.role);
  fields.risk.value = pick(randomSettings.risk);
  fields.memoryMode.value = pick(randomSettings.memoryMode);
  fields.level.value = pick(randomSettings.level);
  fields.luck.value = pick(randomSettings.luck);
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
  if (!names.length) return [];
  const offset = Object.keys(rooms).indexOf(roomName) * 13;
  return Array.from({ length: 12 }, (_, index) => names[(offset + index) % names.length]);
}

function findUser(query) {
  if (!query.trim()) return '';
  return names.find((name) => name === query) || names.find((name) => name.includes(query));
}

function look() {
  const room = rooms[roomName];
  append(`\n[${roomName}]\n${room.desc}${roomZoneText() ? `\n권역: ${roomZoneText()}` : ''}${frontierCoord(roomName) ? `\n장면: ${character.lastScene}\n원정 노드: ${rogueNodeType()}` : ''}\n출구: ${room.exits.join(', ')}\n고정 NPC: ${(roomNpcs[roomName] || []).join(', ') || '없음'}\n주변 유저: ${roomUsers().map(aiUserLabel).join(', ')}\n팀: ${team.length ? team.join(', ') : '없음'}\n`, 'room');
  showChoices();
}

function showMap() {
  append(`\n[지도]\n${mapText()}`, 'room');
  showChoices();
}

function showQuest() {
  append(`\n[임무]\n${currentQuest().title}\n${currentQuest().goal}\n힌트: ${currentQuest().hint}`, 'choice');
}

function welcome() {
  append('\n[환영]\n무한대전은 광장에서 시작해 봐/조사로 주변을 읽고, 대화로 임무를 받고, 공격과 수련으로 경험을 얻는 PC통신식 MUD입니다.\n경험치가 충분하면 자동으로 레벨이 오르고, HP가 낮으면 회복/사용 회복약/구매 회복약으로 버틸 수 있습니다.\n무한구역에 들어간 뒤에는 "원정"으로 유물과 저주가 쌓이는 로그라이크 원정을 시작할 수 있습니다. 이 구역의 적은 10배 강합니다.', 'room');
  if (character.storyStep === 0) setStoryStep(1, '현감청으로 가서 현감과 대화하자.');
  commitProgress();
  showChoices();
}

function resolveRoomEvent() {
  const event = roomEvent();
  if (!event) {
    append('이곳에는 처리할 장소 사건이 없습니다.');
    showChoices();
    return;
  }
  if (eventDone()) {
    append(`[장소 사건]\n${event.title}은(는) 이미 해결했습니다.`, 'choice');
    showChoices();
    return;
  }

  resolvedEvents.add(roomName);
  append(`\n[장소 사건]\n${event.title}\n${event.text}`, 'choice');
  if (event.damage) {
    const beforeHp = character.hp;
    const damage = Math.max(1, event.damage + rogueDamageBonus() - teamPower().scout);
    character.hp = Math.max(1, character.hp - damage);
    append(`위험 처리: HP ${damage} 감소. 현재 HP ${character.hp}/${character.hpMax}`, 'choice');
    if (rogue.active && beforeHp <= damage) {
      finishRogueRun(false, `${event.title}에서 탈진`);
      return;
    }
  }
  if (event.exp) character.exp += event.exp;
  const goldGain = event.gold ? Math.round(event.gold * rogueGoldRate()) : 0;
  if (goldGain) changeGold(goldGain, `${event.title} 보상`);
  if (event.item && !hasItem(event.item)) {
    addItem(event.item);
    append(`획득 물품: ${event.item}`, 'ally');
  }
  if (event.heal) healCharacter(event.heal, event.title, 'ally');
  if (event.trust && team.length) {
    raiseTeamTrust(event.trust);
    append(`[팀 신뢰] ${team.map((name) => `${name} ${trustFor(name)}`).join(' / ')}`, 'ally');
  }
  append(`사건 보상: 경험 ${event.exp || 0}, 돈 ${goldGain} 전`, 'choice');
  rememberNeko('사건', `${roomName} ${event.title}`, 2);
  autoLevelUp('장소 사건');
  commitProgress();
  showChoices();
}

function inspectRoom() {
  const npcs = roomNpcs[roomName] || [];
  const encounters = encountersForRoom(roomName);
  const event = roomEvent();
  const eventText = event ? `${event.title}${eventDone() ? ' (해결됨)' : ' - "사건"으로 처리'}` : '없음';
  append(`\n[조사]\n${rooms[roomName].desc}${roomZoneText() ? `\n권역: ${roomZoneText()}` : ''}${frontierCoord(roomName) ? `\n장면: ${character.lastScene}\n원정 노드: ${rogueNodeType()}` : ''}\nNPC: ${npcs.join(', ') || '없음'}\n위험: ${encounters.map((monster) => monster.name).join(', ') || '낮음'}\n장소 사건: ${eventText}\n임무 힌트: ${currentQuest().hint}`, 'room');
  if (roomName === '북문' && character.storyStep === 5) {
    addItem('북문 경비의 표식');
    setStoryStep(6, '북문 조사를 마쳤다. 북문 밖 숲으로 나가 새 발자국을 확인하자.');
    commitProgress();
  }
  if (roomName === '북문 밖 숲' && character.storyStep === 6) {
    setStoryStep(7, '숲길 끝에서 폐광 입구를 찾았다. 폐광 입구로 가서 우두머리를 상대하자.');
    commitProgress();
  }
  if (roomName === FRONTIER_ROOM && character.storyStep === 8) {
    setStoryStep(9, '무한구역의 압축 지도를 읽었다. 같은 구역 안에서 표지석의 규칙을 더 조사하자.');
    commitProgress();
  }
  else if (roomName === FRONTIER_ROOM && character.storyStep === 9) {
    if (!hasItem('표지석 탁본')) addItem('표지석 탁본');
    setStoryStep(10, '표지석 탁본을 얻었다. 무한구역 안에서 보급로와 장비 상태를 확인하자.');
    commitProgress();
  }
  else if (roomName === FRONTIER_ROOM && character.storyStep === 10) {
    setStoryStep(11, '무한구역의 보급로를 확인했다. 이제 10배 강해진 감시자와 맞서자.');
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
  append(`\n[소지품]\n${character.inventory.map((item, index) => {
    const stats = itemStats(item);
    return `${index + 1}. ${item}${itemBonusText(item) ? ` (${itemBonusText(item)})` : ''}${stats.lineage ? `\n   계보: ${stats.lineage}` : ''}`;
  }).join('\n') || '비어 있음'}`);
  showChoices();
}

function showScore() {
  renderStatusPanel();
  const stats = effectiveStats();
  append(`\n[점수]\n${character.title} ${character.name} / 레벨 ${character.level} ${character.job}\nHP ${character.hp}/${character.hpMax}  MP ${character.mp}/${character.mpMax}\n공격 ${stats.attack}  방어 ${stats.defense}  정신 ${stats.spirit}\n강화 무기 +${character.upgrades.무기} / 방어구 +${character.upgrades.방어구} / 장신구 +${character.upgrades.장신구}\nEXP ${character.exp}/${character.expToLevel}  돈 ${character.gold} 전\n현재 임무: ${currentQuest().title}`);
}

function showNekoMemory() {
  append(`\n[네코 지식]\n${nekoMemoryText()}`, 'neko');
  showChoices();
}

function fusionIngredients(input = '') {
  const named = character.inventory.filter((item, index, list) => (
    list.indexOf(item) === index && input.includes(item)
  ));
  if (named.length >= 2) return named.slice(0, 3);
  const nonPotion = character.inventory.filter((item) => !shopItems[item]?.heal);
  return (nonPotion.length >= 2 ? nonPotion : character.inventory).slice(0, 3);
}

function forgeCost(input, ingredients) {
  const invested = /투자|고급|안전|희귀/.test(input);
  return {
    invested,
    cost: 50 + ingredients.length * 20 + character.level * 5 + (invested ? 120 : 0)
  };
}

function forgeItem(input = '') {
  const ingredients = fusionIngredients(input);
  if (ingredients.length < 2) {
    append('연성에는 보관 아이템이 최소 2개 필요합니다. 예) 연성');
    showChoices();
    return;
  }

  const neko = nekoProfile();
  const forge = forgeCost(input, ingredients);
  if (!spendGold(forge.cost, '네코 연성')) return;
  const roll = Math.random() + neko.luck / 120 + ingredients.length * 0.05 + (forge.invested ? 0.18 : 0);
  const cursed = roll < (forge.invested ? 0.12 : 0.22);
  const tier = cursed ? '불길한' : roll >= 1.25 ? '전설' : roll >= 0.95 ? '희귀' : '기묘';
  const special = cursed ? '저주' : pick(['흡혈', '탐욕', '성장', '수호', '치명', '예지']);
  const slot = ingredients.map((item) => itemStats(item).slot).find(Boolean) || pick(['무기', '방어구', '장신구']);
  const base = ingredients.reduce((sum, item) => sum + Math.max(1, equipmentScore(item)), character.level * 3 + neko.luck);
  const power = Math.max(2, Math.round(base * ({ 불길한: 0.55, 기묘: 0.9, 희귀: 1.25, 전설: 1.7 }[tier] || 1) / 7));
  const stats = {
    slot,
    attack: slot === '무기' ? power + 2 : Math.floor(power / 3),
    defense: slot === '방어구' ? power + 2 : Math.floor(power / 3),
    spirit: slot === '장신구' ? power + 2 : Math.floor(power / 3),
    luck: cursed ? 0 : Math.max(1, Math.floor(neko.luck / 12) + (tier === '전설' ? 5 : tier === '희귀' ? 3 : 1)),
    special,
    lineage: `${roomName} / ${ingredients.join('+')} / 네코 행운 ${neko.luck} / ${character.lastScene}`
  };
  const itemName = `${tier} ${special} ${slot} ${Date.now().toString(36).slice(-4)}`;
  ingredients.forEach(removeExactItem);
  customItems[itemName] = stats;
  addItem(itemName);
  shiftEconomy(1, forge.invested ? '연성 투자' : '연성 수수료', `연성 비용 ${forge.cost}전이 장터에 풀렸다.`);
  rememberNeko('연성', `${ingredients.join('+')} => ${itemName}`, cursed ? 1 : tier === '전설' ? 4 : tier === '희귀' ? 3 : 2);
  commitProgress();
  append(`\n[네코 연성]\n재료: ${ingredients.join(' + ')}\n비용: ${forge.cost} 전${forge.invested ? ' / 추가 투자' : ''}\n행운 판정: ${neko.luck} / 결과 ${tier}${cursed ? ' / 뒤틀림' : ''}\n완성: ${itemName} (${itemBonusText(itemName)})\n네코: 완전 안정적인 선택은 아니지만, 이런 도박수가 가끔 판을 뒤집어.`, 'neko');
  showChoices();
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
  const itemName = equipmentNames().find((name) => input.includes(name))
    || character.inventory.find((item) => itemStats(item).slot && item.includes(input.trim()));
  if (!itemName) {
    append('착용할 장비를 입력하세요. 예) 착용 청동검');
    return;
  }
  if (!hasItem(itemName)) {
    append(`${itemName}이(가) 보관함에 없습니다. 장터에서 구매하거나 사냥으로 얻으세요.`);
    return;
  }

  const slot = itemStats(itemName).slot;
  const oldItem = character.equipment[slot];
  removeOneItem(itemName);
  if (oldItem) addItem(oldItem);
  character.equipment[slot] = itemName;
  commitProgress();
  append(`${slot}에 ${itemName}을(를) 착용했습니다.${itemBonusText(itemName) ? ` ${itemBonusText(itemName)}.` : ''}`, 'ally');
  showChoices();
}

function upgradeEquipment(input = '') {
  const slot = upgradeSlotFromInput(input);
  const item = character.equipment[slot];
  if (!item || !itemStats(item).slot) {
    append(`${slot}에 강화할 장비가 없습니다.`);
    showChoices();
    return;
  }

  const cost = upgradeCost(slot);
  if (character.gold < cost) {
    append(`${slot} 강화 비용이 부족합니다. 필요 ${cost} 전 / 보유 ${character.gold} 전`);
    showChoices();
    return;
  }

  changeGold(-cost, `${slot} 강화`);
  character.upgrades[slot] = (Number(character.upgrades[slot]) || 0) + 1;
  const bonus = slot === '무기' ? '공격' : slot === '방어구' ? '방어' : '정신';
  commitProgress();
  append(`\n[강화]\n${slot} ${item}이(가) +${character.upgrades[slot]} 강화되었습니다.\n${bonus} +2 효과가 추가되었습니다. 남은 돈 ${character.gold} 전.`, 'ally');
  showChoices();
}

function hunt(input = '') {
  const encounters = encountersForRoom(roomName);
  if (!encounters.length) {
    append('이곳은 사냥터가 아닙니다. 초보사냥터, 북문 근처, 무한구역에서 시도하세요.');
    return;
  }

  const monster = chooseEncounter(encounters, input);
  const neko = nekoProfile();
  const stats = effectiveStats();
  const gearEffects = equipmentEffects();
  const allies = teamPower();
  const trait = monsterTraits[monster.trait] || {};
  const attackPower = stats.attack + allies.attack + neko.combat + gearEffects.attackBonus;
  const guardPower = stats.defense + allies.defense + neko.guard;
  const traitDamage = Math.max(0, (trait.damage || 0) - allies.scout);
  const phaseLine = monster.phase ? `\n위상: ${monster.phase} / ${monster.phaseWarning}` : '';
  const dice = combatDiceResult(monster, attackPower, guardPower, traitDamage + rogueDamageBonus() + (monster.phaseDamage || 0), gearEffects);
  const damage = dice.damage;
  const expGain = Math.round(monster.exp * (trait.expRate || 1) * neko.growthRate * gearEffects.expRate);
  const goldGain = Math.round(monster.gold * (trait.goldRate || 1) * neko.goldRate * rogueGoldRate() * gearEffects.goldRate);
  const groupText = monster.groupCount ? `\n출현: ${monster.groupCount}마리가 한꺼번에 달려들었다.` : '';
  const beforeHp = character.hp;
  character.hp = Math.max(1, character.hp - damage);
  if (rogue.active && beforeHp <= damage) {
    addDefeatScar(monster, '원정 퇴각');
    append(`\n[전투]\n${monster.name}에게 맞섰지만 원정의 압박이 더 컸습니다.\n피해 ${damage}. HP가 1까지 떨어져 네코가 퇴각 신호를 냅니다.`, 'choice');
    finishRogueRun(false, `${monster.name} 전투`);
    return;
  }
  if (!dice.defeated) {
    const twistText = frontierTwist(monster, false);
    if (!twistText && frontierCoord(roomName)) reflect('불안', '이기지 못한 전투도 다음 판단의 뼈대가 된다.', character.lastScene);
    addDefeatScar(monster, '전투 퇴각');
    if (frontierCoord(roomName) && Math.random() > 0.55) shiftFrontierPhase('패배의 파문');
    append(`\n[전투]\n${monster.name} Lv.${monster.level}와 맞섰지만 끝내 쓰러뜨리지 못했습니다.${groupText}\n규칙: 2d36 대항 판정. 총합 차이로 실패/방어/명중/강타/치명을 나눕니다.\n특성: ${monster.trait || '없음'}${trait.text ? ` - ${trait.text}` : ''}${phaseLine}\n공격력 ${attackPower}, 방어력 ${guardPower}. 네코가 퇴각 각도를 잡아줬다. 보조 +${neko.combat}.${allies.scout ? ` 정찰 보정 -${allies.scout}.` : ''}\n[전투 과정]\n${dice.text}\n몬스터 HP ${dice.monsterHp}/${monster.hp}. 총 피해 ${damage}를 받고 물러났습니다. 보상은 없습니다.${twistText}`, 'choice');
    autoRecoverIfCritical();
    rememberNeko('전투', `${roomName} ${monster.name} 퇴각`, 1);
    commitProgress();
    showChoices();
    return;
  }
  character.exp += expGain;
  changeGold(goldGain, `${monster.name} 전리품`);
  const twistText = frontierTwist(monster, true);
  if (!twistText && frontierCoord(roomName)) reflect('희망', '살아남은 전투는 몸보다 먼저 마음을 단련한다.', character.lastScene);
  append(`\n[전투]\n${monster.name} Lv.${monster.level}을(를) 공격했다.${groupText}\n규칙: 2d36 대항 판정. 총합 차이로 실패/방어/명중/강타/치명을 나눕니다.\n특성: ${monster.trait || '없음'}${trait.text ? ` - ${trait.text}` : ''}${phaseLine}\n공격력 ${attackPower}, 방어력 ${guardPower}. 네코가 앞발로 빈틈을 만들었다. 보조 +${neko.combat}, 성장 x${neko.growthRate.toFixed(2)}.${allies.scout ? ` 정찰 보정 -${allies.scout}.` : ''}\n[전투 과정]\n${dice.text}\n몬스터를 쓰러뜨리고 총 피해 ${damage}를 받았다.\n획득: 경험 ${expGain}, 돈 ${goldGain} 전${twistText}`, 'choice');
  if (frontierCoord(roomName) && Math.random() > 0.62) shiftFrontierPhase('승리의 여진');
  if (team.length) {
    raiseTeamTrust(1);
    append(`[팀 신뢰] ${team.map((name) => `${name} ${trustFor(name)}`).join(' / ')}`, 'ally');
  }
  autoRecoverIfCritical();
  if (monster.item && !hasItem(monster.item)) {
    addItem(monster.item);
    append(`획득 물품: ${monster.item}`, 'ally');
  }
  if (monster.bonusItem && !hasItem(monster.bonusItem)) {
    addItem(monster.bonusItem);
    append(`특별 전리품: ${monster.bonusItem}`, 'ally');
  }
  if (gearEffects.afterHeal) healCharacter(gearEffects.afterHeal, '흡혈 장비', 'ally');
  recordRogueCombat(monster);
  rememberNeko('전투', `${roomName} ${monster.name}`, 2);
  autoLevelUp('전투 경험');
  if (character.storyStep === 2) {
    setStoryStep(3, '증거를 얻었다. 수련장으로 가서 레벨을 올리자.');
    if (character.level >= 2) setStoryStep(4, '레벨이 올랐다. 생명의나무로 가서 안내자와 대화하자.');
  }
  if (roomName === '폐광 입구' && character.storyStep === 7) {
    setStoryStep(8, '폐광 입구의 우두머리를 넘겼다. 무한구역으로 들어가 새 지도를 확인하자.');
  }
  if (roomName === FRONTIER_ROOM && character.storyStep === 11 && monster.name.includes('무한구역 감시자')) {
    setStoryStep(12, '무한구역 감시자를 넘어섰다. 같은 구역에서 한 번 더 살아남아 극한 깃발을 얻자.');
  }
  if (roomName === FRONTIER_ROOM && character.storyStep === 12) {
    setStoryStep(13, '극한 깃발을 얻었다. 이제 무한구역 하나가 무한대전의 열린 사냥터가 되었다.');
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
  if (/기억|학습|지능|진화/.test(q)) return `내 지식은 Lv.${nekoMemory.level}이야. ${nekoMemory.notes[0] ? `최근엔 ${nekoMemory.notes[0]}을 기억해.` : '아직 쌓인 기억은 적어.'}`;
  if (/감정|기분|깨달음|생각|위로/.test(q)) return `지금 너는 ${character.mood} 쪽에 가까워 보여. 내가 기억한 문장은 "${character.insight}"야. 다음 행동은 이 감각을 버리지 않는 쪽으로 고르자.`;
  if (/파편|상점|영구|저주저항/.test(q)) return `무한 파편은 "파편상점"에서 써. 체력, 공격, 방어, 정신, 네코기억, 저주저항, 유물권을 살 수 있어. 보유 파편은 ${rogue.fragments}개야.`;
  if (/빚|외상|파산/.test(q)) return `도박 빚은 ${character.gambleDebt || 0}전이야. 돈이 있으면 "빚갚기"로 갚고, 없으면 사냥이나 사건으로 다시 발판을 만들자.`;
  if (/위상|무한구역|10배/.test(q)) return `지금 무한구역은 ${phaseText()} 상태야. "위상"으로 확인하고 "위상변경"으로 흐름을 바꿀 수 있어.`;
  if (/계획|전술|3턴/.test(q)) return '"계획"을 입력하면 내가 3턴짜리 행동 계획을 짜줄게.';
  if (/전략|자동전략/.test(q)) return `현재 자동 전략은 ${autoStrategies[autoStrategy]}이야. "전략 안정", "전략 파밍", "전략 보스", "전략 파편", "전략 빚"을 쓸 수 있어.`;
  if (/원정|로그|유물|저주|깊이|파편/.test(q)) return rogue.active
    ? `무한원정 진행 중이야. 깊이 ${rogue.depth}, 유물 ${rogue.relics.length}개, 저주 ${rogue.curses.length}개야. 위험하면 "원정종료"로 빠져.`
    : '무한구역에서 "원정"을 입력하면 로그라이크식 무한원정을 시작해. 유물은 강해지고, 적은 10배 강하게 몰아쳐.';
  if (/지도|맵|map/.test(q)) return `지도는 "지도"라고 입력하면 볼 수 있어. 현재 위치는 ${roomName}이야.`;
  if (/어디|위치|길|가야|이동/.test(q)) return `지금은 ${roomName}. 갈 수 있는 곳은 ${rooms[roomName].exits.join(', ')}야.`;
  if (/팀|파티|동료/.test(q)) return '마음에 드는 유저에게 "팀 이름"이라고 해. 해고는 "팀해고 이름", 교체는 "팀교체 기존 새", 해산은 "팀해산"이야.';
  if (/자동|목표|모드/.test(q)) return '자동목표 스토리, 자동목표 사냥, 자동목표 장비, 자동목표 안전, 자동목표 탐험, 자동목표 무한구역, 자동목표 팀, 자동목표 도박을 쓸 수 있어.';
  if (/돈|경제|투자|급여|선물|정보|치료소|도박|블랙잭|파칭코|포커/.test(q)) return `시장지수는 ${economy.index}, 새 개념은 ${economy.concepts.join(', ') || '아직 없음'}이야. 돈은 "네코훈련 행운", "선물 이름", "정보구매", "치료소", "연성 투자", "경제 투자", "도박 블랙잭 50", "도박 파칭코 올인", "빚갚기"로 움직여.`;
  if (/강화|업그레이드/.test(q)) return `장터에서 "강화 무기"처럼 입력하면 돼. 다음 무기 강화 비용은 ${upgradeCost('무기')} 전이야.`;
  if (/연성|조합|융합|합성|도박/.test(q)) return `보관함 아이템이 2개 이상이면 "연성"으로 새 장비를 만들 수 있어. 내 행운은 ${nekoProfile().luck}이라 결과가 조금 흔들려.`;
  if (/장비|착용|무기/.test(q)) return '장터 장비를 사거나, 보관 아이템을 "연성"해서 특수능력 장비를 만들 수 있어. 착용은 "착용 장비명"이야.';
  if (/임무|퀘스트|스토리/.test(q)) return `${currentQuest().title}: ${currentQuest().goal} 힌트는 "${currentQuest().hint}"야.`;
  if (/명령|도움|뭐.*해|방법/.test(q)) return '환영, 임무, 지도, 조사, 사건, 사냥, 회복, 원정, 원정종료, 구매 회복약, 강화 무기, 자동목표 도박, 도박 블랙잭 올인, 이동 장소를 쓸 수 있어.';
  if (/회복|피|HP|hp|죽/.test(q)) return 'HP가 낮으면 "회복"이라고 해. 동료와 내가 먼저 돕고, 부족하면 회복약을 써. 장터에서는 "구매 회복약"도 가능해.';
  if (/사람|유저|누구/.test(q)) return `가상 유저 ${names.length}명이 접속 중이야. 이 방에는 ${roomUsers().slice(0, 6).map(aiUserLabel).join(', ')} 등이 있어.`;
  if (/사냥|전투|초보/.test(q)) return '처음이면 수련장으로 가고, 팀을 만든 뒤 북문을 지나 초보사냥터로 가면 안전해.';
  return 'Gemini 서버 연결이 안 되면 기본 네코로 안내할게. 지금은 주변을 살피고 팀을 모으자.';
}

function buildSystemInstruction() {
  const settings = currentSettings();
  return [
    '너는 한국 PC통신 MUD "무한대전" 안에서 주인공 옆을 따라다니는 검은 고양이 네코다.',
    `성별/정체성: ${settings.gender}`,
    `말투: ${settings.tone}`,
    `성격: ${settings.personality}`,
    `역할: ${settings.role}`,
    `위험 성향: ${settings.risk}`,
    `학습 방식: ${settings.memoryMode}`,
    `레벨: ${settings.level}`,
    `행운: ${settings.luck}`,
    `특수능력: ${settings.ability}`,
    `추가 설정: ${settings.prompt}`,
    `현재 장소: ${roomName} - ${rooms[roomName].desc}`,
    `현재 장면: ${character.lastScene}`,
    `현재 감정: ${character.mood}`,
    `현재 깨달음: ${character.insight}`,
    `무한구역 위상: ${phaseText()}`,
    `자동 전략: ${autoStrategies[autoStrategy] || autoStrategies.균형}`,
    `패배 흉터: ${scarSummary()}`,
    `출구: ${rooms[roomName].exits.join(', ')}`,
    `주변 유저: ${roomUsers().map(aiUserLabel).join(', ')}`,
    `현재 팀: ${team.length ? team.join(', ') : '없음'}`,
    `캐릭터: 레벨 ${character.level}, HP ${character.hp}/${character.hpMax}, MP ${character.mp}/${character.mpMax}, 공격 ${character.attack}, 방어 ${character.defense}, 정신 ${character.spirit}, EXP ${character.exp}/${character.expToLevel}, 돈 ${character.gold}`,
    `경제: 시장지수 ${economy.index}, 공동기금 ${economy.fund}, 평판 ${economy.reputation}, 계약 ${(economy.contracts || []).join(', ') || '없음'}, 최근 ${economy.last}, 새 개념 ${economy.concepts.join(', ') || '없음'}`,
    `현재 임무: ${currentQuest().title} - ${currentQuest().goal}`,
    `소지품: ${character.inventory.join(', ')}`,
    `연성 장비: ${Object.keys(customItems).join(', ') || '없음'}`,
    `무한원정: ${rogue.active ? `진행 중, 깊이 ${rogue.depth}, 유물 ${rogue.relics.join(', ') || '없음'}, 저주 ${rogue.curses.join(', ') || '없음'}` : `대기, 역대 최고 깊이 ${rogue.bestDepth}, 파편 ${rogue.fragments}`}`,
    `축적 지식: ${nekoMemoryText()}`,
    '항상 무한대전 세계관 안에서 답하고, 1~3문장으로 짧게 한국어로 말한다.',
    '축적 지식과 최근 기억을 근거로 다음 행동을 더 똑똑하게 추천한다.',
    '플레이어가 다음 행동을 고르기 쉽게 장소, 위험, 동료 후보를 짧게 짚어준다.',
    '사용 가능한 명령어를 자연스럽게 추천한다: 환영, 임무, 지도, 조사, 사건, 대화 대상, 사냥, 수련, 회복, 원정, 원정종료, 위상, 위상변경, 전략 안정, 전략 파밍, 전략 보스, 전략 파편, 계획, 파편상점, 파편구매 체력, 파편구매 저주저항, 빚, 빚갚기, 연성, 연성 투자, 네코훈련 행운, 선물 이름, 정보구매 장소, 치료소, 저주해제, 경제 투자, 사회 투자, 이동 도박장, 도박 블랙잭 50, 도박 파칭코 50, 도박 텍사스포커 50, 도박 러시안룰렛 50, 도박 블랙잭 올인, 도박 파칭코 올인, 도박 텍사스포커 올인, 도박 러시안룰렛 올인, 자동목표 도박, 구매 회복약, 구매 청동검, 착용 청동검, 강화 무기, 자동목표 탐험, 자동목표 무한구역, 점수, 소지품, 사용 회복약, 이동 장소, 팀 이름, 팀해고 이름, 팀교체 기존 새, 팀해산.'
  ].join('\n');
}

function moveCommandToward(destination) {
  const target = canonicalRoomName(destination);
  if (rooms[roomName].exits.includes(target)) return `이동 ${target}`;
  const queue = [{ room: roomName, path: [] }];
  const visited = new Set([roomName]);
  while (queue.length) {
    const current = queue.shift();
    for (const exit of rooms[current.room].exits) {
      if (visited.has(exit)) continue;
      const path = current.path.concat(exit);
      if (exit === target) return `이동 ${path[0]}`;
      visited.add(exit);
      queue.push({ room: exit, path });
    }
  }
  return `이동 ${target}`;
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
  if (character.storyStep === 8) return roomName === FRONTIER_ROOM
    ? { label: '무한구역 조사', command: '조사' }
    : { label: '무한구역 진입', command: moveCommandToward(FRONTIER_ROOM) };
  if (character.storyStep === 9) return roomName === FRONTIER_ROOM
    ? { label: '압축 표지석 조사', command: '조사' }
    : { label: '무한구역 진입', command: moveCommandToward(FRONTIER_ROOM) };
  if (character.storyStep === 10) return roomName === FRONTIER_ROOM
    ? { label: '극한 정비 조사', command: '조사' }
    : { label: '무한구역 진입', command: moveCommandToward(FRONTIER_ROOM) };
  if (character.storyStep === 11) return roomName === FRONTIER_ROOM
    ? { label: '무한구역 감시자 사냥', command: '사냥 무한구역 감시자' }
    : { label: '무한구역 진입', command: moveCommandToward(FRONTIER_ROOM) };
  if (character.storyStep === 12) return roomName === FRONTIER_ROOM
    ? { label: '극한 생환 사냥', command: '사냥' }
    : { label: '무한구역 진입', command: moveCommandToward(FRONTIER_ROOM) };
  return { label: '현재 임무 확인', command: '임무' };
}

function bestAutoGearChoice() {
  if (character.storyStep < 8) return null;
  const desiredGear = ['무한전선 검', '고성검', '철검', '철갑옷', '사냥꾼 부적', '청동검', '가죽갑옷', '수련 부적', '광부의 곡괭이'];
  const customReady = character.inventory.find((item) => itemStats(item).slot && isBetterEquipment(item));
  if (customReady) return { label: `${customReady} 착용`, command: `착용 ${customReady}` };
  if (character.inventory.filter((item) => !shopItems[item]?.heal).length >= 8) {
    return { label: '네코 연성 도박수', command: '연성' };
  }
  if (canShopHere()) {
    const equipReady = desiredGear.find((item) => {
      return hasItem(item) && isBetterEquipment(item);
    });
    if (equipReady) return { label: `${equipReady} 착용`, command: `착용 ${equipReady}` };

    const buyReady = desiredGear.find((item) => {
      if (!shopItems[item]) return false;
      return isBetterEquipment(item) && !hasItem(item) && character.gold >= shopItems[item].price;
    });
    if (buyReady) return { label: `${buyReady} 구매`, command: `구매 ${buyReady}` };

    const upgradeSlot = ['무기', '방어구', '장신구'].find((slot) => (
      character.equipment[slot] && character.gold >= upgradeCost(slot) && (character.upgrades[slot] || 0) < character.level + 2
    ));
    if (upgradeSlot) return { label: `${upgradeSlot} 강화`, command: `강화 ${upgradeSlot}` };

    const potionCount = character.inventory.filter((item) => item === '회복약').length;
    if (potionCount < 3 && character.gold >= shopItems['회복약'].price) {
      return { label: '회복약 보충', command: '구매 회복약' };
    }
  }

  const needsGear = desiredGear.some((item) => {
    if (!shopItems[item]) return false;
    return isBetterEquipment(item) && !hasItem(item) && character.gold >= shopItems[item].price;
  });
  const canUpgrade = character.equipment.무기 !== '낡은 목검' && character.gold >= upgradeCost('무기');
  if (autoShopCooldown > 0) return null;
  if ((needsGear || canUpgrade) && !canShopHere()) {
    return { label: '장터에서 장비 정비', command: moveCommandToward('장터') };
  }
  return null;
}

function bestAutoTeamChoice() {
  if (character.storyStep < 8) return null;
  const candidate = roomUsers().find((name) => !team.includes(name));
  if (team.length < 4 && candidate) {
    return { label: `${candidate} 영입`, command: `팀 ${candidate}` };
  }

  const roleCounts = team.reduce((counts, name) => {
    const role = allyRole(name).label;
    counts[role] = (counts[role] || 0) + 1;
    return counts;
  }, {});
  const desiredRole = ['회복형', '공격형', '수호형', '정찰형'].find((role) => !roleCounts[role]);
  if (!desiredRole) return null;

  const newMember = roomUsers().find((name) => !team.includes(name) && allyRole(name).label === desiredRole);
  if (!newMember) return null;
  const oldMember = team.find((name) => roleCounts[allyRole(name).label] > 1) || team[0];
  return { label: `${oldMember}을 ${newMember}로 교체`, command: `팀교체 ${oldMember} ${newMember}` };
}

function bestAutoExploreChoice() {
  if (character.storyStep < 8 || character.hp <= Math.ceil(character.hpMax * 0.65)) return null;
  if (roomName === '폐광 입구') {
    return { label: '무한구역 진입', command: `이동 ${FRONTIER_ROOM}` };
  }
  if (!frontierCoord(roomName) && character.level >= 2) {
    return { label: '확장 지역으로 이동', command: moveCommandToward(FRONTIER_ROOM) };
  }

  const coord = frontierCoord(roomName);
  if (!coord || Math.random() > 0.45) return null;
  const frontierExits = rooms[roomName].exits.filter((exit) => frontierCoord(exit));
  if (!frontierExits.length) return null;
  const deeperExit = frontierExits.find((exit) => {
    const next = frontierCoord(exit);
    return next && next.row + next.col > coord.row + coord.col;
  });
  const nextRoom = deeperExit || pick(frontierExits);
  return nextRoom ? { label: `${nextRoom} 탐험`, command: `이동 ${nextRoom}` } : null;
}

function bestFrontierMoveChoice() {
  if (!frontierCoord(roomName)) return { label: '무한구역 진입', command: moveCommandToward(FRONTIER_ROOM) };
  const coord = frontierCoord(roomName);
  const exits = rooms[roomName].exits.filter((exit) => frontierCoord(exit));
  const nextRoom = exits.find((exit) => {
    const next = frontierCoord(exit);
    return !visitedRooms.has(exit) && next.row + next.col > coord.row + coord.col;
  }) || exits.find((exit) => {
    const next = frontierCoord(exit);
    return next.row + next.col > coord.row + coord.col;
  }) || exits.find((exit) => !visitedRooms.has(exit)) || exits[0];
  return nextRoom ? { label: `${nextRoom} 깊은 탐험`, command: `이동 ${nextRoom}` } : null;
}

function bestAutoFrontierChoice() {
  if (character.storyStep < 8) return storyChoice();
  if (!rogue.active) return { label: '무한원정 시작', command: '원정' };
  if (character.hp <= Math.ceil(character.hpMax * 0.6)) return { label: 'HP 회복', command: '회복' };
  if (!frontierCoord(roomName)) return bestFrontierMoveChoice();
  const node = rogueNodeType();
  if (node === '상점') return bestAutoGearChoice() || eventChoice() || bestFrontierMoveChoice();
  if (node === '휴식' && (character.hp < character.hpMax || rogue.curses.length)) return { label: '휴식 노드 회복', command: '회복' };
  if (node === '안전') return eventChoice() || bestFrontierMoveChoice();
  return eventChoice() || { label: `${node} 노드 전투`, command: '사냥' };
}

function bestAutoGambleChoice() {
  if (character.gold < 50) return encountersForRoom(roomName).length
    ? { label: '도박 자금 마련', command: '사냥' }
    : bestAutoMoveChoice();
  if (gambleState.blackjack) return blackjackValue(gambleState.blackjack.player) < 17
    ? { label: '블랙잭 히트', command: '히트' }
    : { label: '블랙잭 스탠드', command: '스탠드' };
  if (roomName !== '도박장') return { label: '도박장으로 이동', command: moveCommandToward('도박장') };
  const risk = nekoProfile().risk;
  const stake = risk === '광기'
    ? '올인'
    : Math.max(10, Math.min(500, Math.floor(character.gold * ({ 안전: 0.1, 균형: 0.25, 공격: 0.6 }[risk] || 0.25))));
  const stakeLabel = stake === '올인' ? '올인' : `${stake}전`;
  return pick([
    { label: `블랙잭 ${stakeLabel}`, command: `도박 블랙잭 ${stake}` },
    { label: `파칭코 ${stakeLabel}`, command: `도박 파칭코 ${stake}` },
    { label: `텍사스포커 ${stakeLabel}`, command: `도박 텍사스포커 ${stake}` },
    { label: `검은 룰렛 ${stakeLabel}`, command: `도박 러시안룰렛 ${stake}` }
  ]);
}

function bestStrategyChoice(context = {}) {
  const { combatPlan, eventPlan, gearPlan, teamPlan, explorePlan, storyPlan } = context;
  if (autoStrategy === '빚') {
    if (character.gambleDebt && character.gold > 0) return { label: '도박 빚 상환', command: '빚갚기' };
    return combatPlan || eventPlan || storyPlan;
  }
  if (autoStrategy === '안정') {
    if (character.hp < Math.ceil(character.hpMax * 0.85)) return { label: '안정 회복', command: '회복' };
    return gearPlan || teamPlan || eventPlan || storyPlan || combatPlan;
  }
  if (autoStrategy === '파밍') {
    const fusionReady = character.inventory.filter((item) => !shopItems[item]?.heal).length >= 4
      ? { label: '파밍품 연성', command: '연성' }
      : null;
    return eventPlan || combatPlan || fusionReady || explorePlan || gearPlan || storyPlan;
  }
  if (autoStrategy === '보스') {
    if (character.storyStep >= 8 && !frontierCoord(roomName)) return { label: '무한구역 보스 진입', command: moveCommandToward(FRONTIER_ROOM) };
    return combatPlan || gearPlan || storyPlan;
  }
  if (autoStrategy === '파편') {
    if (character.storyStep >= 8 && !rogue.active) return { label: '파편 원정 시작', command: '원정' };
    return combatPlan || eventPlan || storyPlan;
  }
  return null;
}

function setAutoStrategy(input = '') {
  const normalized = modeKey(input || '균형');
  const strategy = Object.keys(autoStrategies).find((key) => modeKey(key) === normalized)
    || Object.keys(autoStrategies).find((key) => modeKey(autoStrategies[key]).includes(normalized));
  if (!strategy) {
    append(`자동 전략: ${Object.entries(autoStrategies).map(([key, label]) => `${key}=${label}`).join(' / ')}`);
    showChoices();
    return;
  }
  autoStrategy = strategy;
  saveGameState();
  renderStatusPanel();
  append(`자동 전략을 ${autoStrategies[strategy]}(으)로 바꿨습니다.`);
  showChoices();
}

function nekoPlanChoices() {
  const stats = effectiveStats();
  const plan = [];
  if (character.hp < Math.ceil(character.hpMax * 0.7)) plan.push({ label: '상처를 먼저 회복', command: '회복' });
  if (character.gambleDebt && character.gold > 0) plan.push({ label: '도박 빚 정리', command: '빚갚기' });
  if (frontierCoord(roomName)) {
    plan.push({ label: `${phaseText()} 확인`, command: '위상' });
    if (stats.defense + stats.spirit < character.level * 4) plan.push({ label: '장비 정비', command: '강화 무기' });
    plan.push({ label: '무한구역 전투', command: '사냥' });
  } else {
    const story = storyChoice();
    if (story.command !== '임무') plan.push(story);
    if (character.storyStep >= 8) plan.push({ label: '무한구역 진입', command: moveCommandToward(FRONTIER_ROOM) });
  }
  plan.push(bestAutoGearChoice() || { label: '주변 조사', command: '조사' });
  plan.push(bestAutoTeamChoice() || { label: '네코에게 조언', command: '네코 지금 다음 수를 짜줘' });
  return plan.filter(Boolean).filter((choice, index, list) => (
    list.findIndex((item) => item.command === choice.command) === index
  )).slice(0, 3);
}

function showNekoPlan() {
  const plan = nekoPlanChoices();
  append(`\n[네코 3턴 계획]\n전략: ${autoStrategies[autoStrategy] || autoStrategies.균형}\n위상: ${phaseText()}\n${plan.map((choice, index) => `${index + 1}. ${choice.label} => ${choice.command}`).join('\n')}`, 'neko');
  showChoices();
}

function bestAutoMoveChoice() {
  const storyPlan = storyChoice();
  if (storyPlan.command.startsWith('이동 ')) return storyPlan;
  const explorePlan = bestAutoExploreChoice();
  if (explorePlan?.command.startsWith('이동 ')) return explorePlan;
  const exits = rooms[roomName].exits || [];
  if (!exits.length) return null;
  const coord = frontierCoord(roomName);
  const unvisitedExits = exits.filter((exit) => !visitedRooms.has(exit));
  const candidates = unvisitedExits.length ? unvisitedExits : exits;
  const nextRoom = coord
    ? candidates.find((exit) => {
      const next = frontierCoord(exit);
      return next && next.row + next.col > coord.row + coord.col;
    }) || candidates.find((exit) => frontierCoord(exit)) || candidates[0]
    : candidates[0];
  return { label: `${nextRoom}(으)로 이동`, command: `이동 ${nextRoom}` };
}

function makeChoices() {
  if (gambleState.blackjack) {
    return [
      { label: '히트', command: '히트' },
      { label: '스탠드', command: '스탠드' },
      { label: '블랙잭 규칙 보기', command: '도박' },
      { label: '판 포기 후 주막', command: '이동 주막' }
    ];
  }
  if (roomName === '도박장') {
    return [
      { label: '블랙잭 50전', command: '도박 블랙잭 50' },
      { label: '파칭코 50전', command: '도박 파칭코 50' },
      { label: '텍사스포커 50전', command: '도박 텍사스포커 50' },
      { label: '러시안룰렛 50전', command: '도박 러시안룰렛 50' },
      { label: '블랙잭 올인', command: '도박 블랙잭 올인' },
      { label: '파칭코 올인', command: '도박 파칭코 올인' },
      { label: '텍사스포커 올인', command: '도박 텍사스포커 올인' },
      { label: '러시안룰렛 올인', command: '도박 러시안룰렛 올인' }
    ];
  }
  const room = rooms[roomName];
  const candidate = roomUsers().find((name) => !team.includes(name)) || roomUsers()[0];
  const event = eventChoice();
  const combat = encountersForRoom(roomName).length ? { label: '주변 몬스터 사냥', command: '사냥' } : null;
  const heal = character.hp < character.hpMax ? { label: 'HP 회복', command: '회복' } : null;
  const shop = canShopHere() ? { label: '회복약 구매', command: '구매 회복약' } : null;
  const upgrade = canShopHere() ? { label: '무기 강화', command: '강화 무기' } : null;
  const fusion = character.inventory.filter((item) => !shopItems[item]?.heal).length >= 2
    ? { label: '네코 아이템 연성', command: '연성' }
    : null;
  const rogueChoice = character.storyStep >= 8
    ? { label: rogue.active ? '무한원정 상태' : '무한원정 시작', command: '원정' }
    : null;
  const shardChoice = rogue.fragments > 0 ? { label: '파편 상점', command: '파편상점' } : null;
  const debtChoice = character.gambleDebt ? { label: '도박 빚 갚기', command: '빚갚기' } : null;
  const planChoice = { label: '네코 3턴 계획', command: '계획' };
  const phaseChoice = frontierCoord(roomName) ? { label: '무한구역 위상', command: '위상' } : null;
  const nextExit = room.exits.find((exit) => !visitedRooms.has(exit)) || room.exits[0] || roomName;
  const raw = [
    storyChoice(),
    heal,
    planChoice,
    phaseChoice,
    rogueChoice,
    shardChoice,
    debtChoice,
    event,
    { label: '주변 조사', command: '조사' },
    fusion,
    shop,
    combat,
    roomName === '수련장' ? { label: '수련하기', command: '수련' } : null,
    canShopHere() ? { label: '청동검 구매', command: '구매 청동검' } : null,
    upgrade,
    { label: `${nextExit}(으)로 이동`, command: `이동 ${nextExit}` },
    { label: `${candidate}에게 말 걸기`, command: `귓 ${candidate} 여기서 무엇을 조심해야 해?` },
    { label: `${candidate} 팀 영입`, command: `팀 ${candidate}` },
    { label: '네코에게 다음 수 묻기', command: '네코 지금 무엇을 하면 좋을까?' }
  ].filter(Boolean);
  return raw.filter((choice, index, list) => list.findIndex((item) => item.command === choice.command) === index).slice(0, 4);
}

function autoAlternatives() {
  const candidate = roomUsers().find((name) => !team.includes(name)) || roomUsers()[0];
  return [
    eventChoice(),
    bestAutoTeamChoice(),
    bestAutoGearChoice(),
    character.inventory.filter((item) => !shopItems[item]?.heal).length >= 2 ? { label: '네코 아이템 연성', command: '연성' } : null,
    { label: '주변 조사', command: '조사' },
    encountersForRoom(roomName).length ? { label: '주변 몬스터 사냥', command: '사냥' } : null,
    roomName === '수련장' ? { label: '수련하기', command: '수련' } : null,
    canShopHere() ? { label: '무기 강화', command: '강화 무기' } : null,
    canShopHere() ? { label: '회복약 보충', command: '구매 회복약' } : null,
    candidate ? { label: `${candidate}에게 말 걸기`, command: `귓 ${candidate} 여기서 무엇을 조심해야 해?` } : null
  ].filter(Boolean).filter((choice, index, list) => (
    !choice.command.startsWith('이동 ') && list.findIndex((item) => item.command === choice.command) === index
  ));
}

function freshAutoChoice(choice) {
  if (choice?.command === '회복') return choice;
  if (!choice || choice.command.startsWith('이동 ') || !autoRoomCommands.includes(choice.command)) return choice;
  return autoAlternatives().find((item) => !autoRoomCommands.includes(item.command)) || choice;
}

function bestAutoChoice() {
  const choices = makeChoices().filter((choice) => !choice.command.startsWith('네코'));
  const mode = currentAutoMode();
  const storyPlan = storyChoice();
  const combatPlan = encountersForRoom(roomName).length ? { label: '주변 몬스터 사냥', command: '사냥' } : null;
  const eventPlan = eventChoice();
  const gearPlan = bestAutoGearChoice();
  const teamPlan = bestAutoTeamChoice();
  const explorePlan = bestAutoExploreChoice();
  const strategyPlan = bestStrategyChoice({ combatPlan, eventPlan, gearPlan, teamPlan, explorePlan, storyPlan });
  if (character.hp <= Math.ceil(character.hpMax * 0.6)) {
    return { label: 'HP 회복', command: '회복' };
  }
  if (character.storyStep === 3 && character.level < 2) {
    return roomName === '수련장'
      ? { label: '기본기 수련', command: '수련' }
      : { label: '수련장으로 이동', command: moveCommandToward('수련장') };
  }
  if (strategyPlan) return strategyPlan;
  if (mode === 'story' && storyPlan.command !== '임무') return storyPlan;
  if (mode === 'hunt') return combatPlan || eventPlan || explorePlan || gearPlan || storyPlan;
  if (mode === 'gear') return gearPlan || eventPlan || combatPlan || storyPlan;
  if (mode === 'safe') return gearPlan || teamPlan || eventPlan || storyPlan || combatPlan;
  if (mode === 'explore') return eventPlan || explorePlan || storyPlan || combatPlan;
  if (mode === 'frontier') return bestAutoFrontierChoice();
  if (mode === 'team') return teamPlan || eventPlan || combatPlan || storyPlan;
  if (mode === 'gamble') return bestAutoGambleChoice();
  return gearPlan
    || teamPlan
    || eventPlan
    || explorePlan
    || combatPlan
    || choices.find((choice) => choice.command !== '임무')
    || choices[0];
}

function showChoices() {
  choiceSlots = makeChoices();
  append(`\n[다음 행동]\n${choiceSlots.map((choice, index) => `${index + 1}. ${choice.label}`).join('\n')}`, 'choice');
}

function setAutoButton() {
  autoBtn.textContent = autoProgress ? '5. 자동 진행 끄기' : '5. 자동 진행 켜기';
  autoBtn.disabled = !connected;
  renderStatusPanel();
}

async function autoTick() {
  if (!connected || !autoProgress || autoBusy) return;
  const mode = currentAutoMode();
  const forcedMove = autoRoomActions >= 2 && mode !== 'gamble' && !(mode === 'frontier' && frontierCoord(roomName))
    ? (mode === 'frontier' ? bestFrontierMoveChoice() : bestAutoMoveChoice())
    : null;
  const choice = forcedMove || (mode === 'gamble' ? bestAutoChoice() : freshAutoChoice(bestAutoChoice()));
  if (!choice) return;
  autoBusy = true;
  const beforeRoom = roomName;
  const wasShopRoom = canShopHere();
  append(`\n[자동 진행]\n${forcedMove ? '장소 행동 2회 완료. ' : ''}네코가 "${choice.label}"을 선택했다.\n=> ${choice.command}`, 'neko');
  try {
    await runCommand(choice.command);
    if (wasShopRoom && isShopCommand(choice.command)) autoShopCooldown = 3;
    else if (autoShopCooldown > 0) autoShopCooldown -= 1;
    if (choice.command.startsWith('이동 ') || roomName !== beforeRoom) {
      autoRoomActions = 0;
      autoRoomCommands = [];
    } else {
      autoRoomActions += 1;
      autoRoomCommands.push(choice.command);
    }
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
    autoRoomActions = 0;
    autoRoomCommands = [];
    autoShopCooldown = 0;
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
    const answer = data.text || fallbackNeko(input);
    appendNeko(answer);
    rememberNeko('대화', input, 1);
    renderStatusPanel();
  } catch (error) {
    appendNeko(`Gemini 연결 실패. ${error.message}`);
    appendNeko(fallbackNeko(input));
    rememberNeko('대화', input, 1);
    renderStatusPanel();
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

function pickAiUserByAbility(ability, except = []) {
  return names.find((name) => aiAbility(name) === ability && !except.includes(name));
}

function aiSocietyEvent(requestedAbility = '', passive = false) {
  if (names.length < 2) return;
  const ability = aiAbilityCatalog.includes(requestedAbility.trim()) ? requestedAbility.trim() : '';
  const actor = ability ? pickAiUserByAbility(ability) || pick(names) : pick(names);
  const power = ability || aiAbility(actor);
  const target = pick(names.filter((name) => name !== actor));
  let text = '';

  if (power === '결혼') {
    const child = addAiUser();
    const leftTeam = team.includes(actor);
    if (leftTeam) {
      team = team.filter((member) => member !== actor);
      delete teamTrust[actor];
    }
    addContract(`${actor}-${target} 혼인`);
    text = `${actor}와 ${target}이(가) 결혼했다. ${leftTeam ? `${actor}은(는) 파티를 떠났다. ` : ''}아이 ${child}이(가) 새로 접속했다.`;
  } else if (power === '살해') {
    const seized = Math.floor(wealthFor(target) * 0.35);
    setWealth(actor, wealthFor(actor) + seized);
    shiftEconomy(-3, '상속 분쟁', `${target}의 재산 ${seized}전이 분쟁에 휘말렸다.`);
    removeAiUser(target);
    const arrestor = pickAiUserByAbility('체포', [actor, target]);
    if (arrestor) removeAiUser(actor);
    text = `${actor}이(가) ${target}을(를) 살해했다. 상속 분쟁 ${seized}전이 발생했다.${arrestor ? ` ${arrestor}이(가) 즉시 체포해 ${actor}은(는) 접속자 명단에서 사라졌다.` : ''}`;
  } else if (power === '약탈') {
    const loot = Math.min(wealthFor(target), 40 + (hashName(actor) % 80));
    setWealth(target, wealthFor(target) - loot);
    setWealth(actor, wealthFor(actor) + loot);
    shiftEconomy(-2, '치안 보험', `${actor}의 약탈로 ${loot}전이 이동했다.`);
    const arrestor = pickAiUserByAbility('체포', [actor, target]);
    if (arrestor) removeAiUser(actor);
    if (team.includes(target)) teamTrust[target] = Math.max(0, trustFor(target) - 3);
    text = `${actor}이(가) ${target}의 짐 ${loot}전어치를 약탈했다.${arrestor ? ` ${arrestor}이(가) 체포했다.` : ' 아직 붙잡히지 않았다.'}`;
  } else if (power === '체포') {
    const criminal = names.find((name) => ['살해', '약탈'].includes(aiAbility(name)) && name !== actor);
    if (criminal) removeAiUser(criminal);
    text = criminal ? `${actor}이(가) 위험 유저 ${criminal}을(를) 체포했다.` : `${actor}이(가) 광장 순찰을 돌았다.`;
  } else if (power === '중재') {
    if (team.length) raiseTeamTrust(1);
    text = `${actor}이(가) ${target}와 말다툼을 중재했다.${team.length ? ' 팀 신뢰가 조금 올랐다.' : ''}`;
  } else if (power === '치유') {
    const before = character.hp;
    character.hp = Math.min(character.hpMax, character.hp + 6);
    text = `${actor}이(가) ${target}을(를) 치료했다.${character.hp > before ? ' 당신도 작은 회복을 받았다.' : ''}`;
  } else if (power === '상단') {
    if (!passive) changeGold(15, 'AI 상단 통행세');
    text = `${actor}의 상단이 ${target}와 거래했다.${passive ? ' 돈은 AI 유저들 사이에서만 돌았다.' : ' 통행세 일부로 15전을 받았다.'}\n${applyEconomyEvent('고용', actor, target)}`;
  } else if (power === '소문') {
    text = `${actor}이(가) ${target}에게 새 소문을 퍼뜨렸다. 네코가 그 흐름을 기억했다.`;
    rememberNeko('대화', `${actor} 소문`, 1);
  } else if (power === '보호') {
    if (team.includes(target)) teamTrust[target] = Math.min(99, trustFor(target) + 2);
    addContract(`${actor}-${target} 보호`);
    text = `${actor}이(가) ${target}을(를) 보호했다.`;
  } else if (['투자', '파산', '고용', '기부'].includes(power)) {
    text = applyEconomyEvent(power, actor, target);
  } else {
    character.exp += 20;
    text = `${actor}이(가) ${target}에게 요령을 가르쳤다. 경험 20을 얻었다.`;
    autoLevelUp('AI 스승');
  }

  const socialReflection = {
    결혼: ['기쁨', '누군가의 떠남은 끝이 아니라 다른 이름의 시작이 되기도 한다.'],
    살해: ['분노', '힘이 책임을 잃으면 공동체는 가장 약한 사람부터 잃는다.'],
    약탈: ['분노', '빼앗긴 물건보다 먼저 무너지는 것은 서로를 믿는 감각이다.'],
    체포: ['희망', '질서는 늦게 도착해도 누군가의 내일을 되찾아 줄 수 있다.'],
    중재: ['안도', '말 한마디가 칼보다 늦게 오더라도 상처를 덜 깊게 만들 수 있다.'],
    치유: ['행복', '상처를 돌보는 손길은 전투보다 오래 기억된다.'],
    상단: ['호기심', '거래는 돈의 이동처럼 보이지만 결국 신뢰의 모양을 드러낸다.'],
    소문: ['불안', '소문은 사실보다 빠르지만 책임보다 느리다.'],
    보호: ['안도', '누군가를 지킨다는 말은 그 사람의 시간을 함께 짊어진다는 뜻이다.'],
    스승: ['희망', '배운다는 것은 어제의 나를 조용히 떠나보내는 일이다.'],
    투자: ['희망', '위험을 나누면 실패도 사건이 되고 성공은 공동의 기억이 된다.'],
    파산: ['불안', '경제는 숫자의 문제가 아니라 믿음이 무너지는 속도의 문제다.'],
    고용: ['호기심', '노동의 대가는 돈으로 시작하지만 관계의 모양으로 남는다.'],
    기부: ['행복', '남는 것을 나누는 것이 아니라 불안을 나누는 순간 공동체가 생긴다.']
  }[power] || pick(frontierInsights);
  reflect(socialReflection[0], socialReflection[1], `AI 사회: ${text.slice(0, 36)}`);
  append(`\n[AI 사회]\n${text}\n현재 접속자: ${names.length}명`, 'ally');
  commitProgress();
  renderStatusPanel();
}

function listUsers() {
  append(`\n[접속자 ${names.length}명]\n${names.map((name, index) => `${String(index + 1).padStart(3, '0')} ${aiUserLabel(name)} ${wealthFor(name)}전`).join('\n')}`);
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
  reflect('호기심', '말을 건다는 것은 닫힌 세계에 작은 창문을 내는 일이다.', `대화: ${message.slice(0, 36)}`);
  commitProgress();
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
  reflect('안도', '귓속말은 작지만, 혼자가 아니라는 증거가 되기도 한다.', `귓속말: ${name}`);
  commitProgress();
}

function move(destination) {
  const target = canonicalRoomName(destination);
  if (!target) {
    append(`이동할 곳을 입력해. 출구: ${rooms[roomName].exits.join(', ')}`);
    return;
  }

  if (!rooms[roomName].exits.includes(target)) {
    append(`그쪽으로는 바로 갈 수 없어. 출구: ${rooms[roomName].exits.join(', ')}`);
    return;
  }

  roomName = target;
  if (roomName !== '도박장') gambleState.blackjack = null;
  visitedRooms.add(roomName);
  autoRoomActions = 0;
  autoRoomCommands = [];
  const scene = sceneTextForRoom(roomName);
  if (frontierCoord(roomName)) {
    const [mood, insight] = pick(frontierInsights);
    reflect(mood, insight, scene);
  } else {
    reflect('담담함', character.insight, scene);
  }
  append(`${roomName}(으)로 이동했다.`);
  if (team.length) append(`${team.join(', ')}: 같이 이동했어.`);
  enterRogueRoom();
  commitProgress();
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
  teamTrust[name] = Math.max(1, trustFor(name));
  reflect('기쁨', '동료가 된다는 것은 같은 위험을 다른 속도로 바라보는 일이다.', `팀 합류: ${name}`);
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
  teamTrust[newName] = Math.max(1, trustFor(newName));
  reflect('불안', '관계는 선택될 때마다 새로 시작되지만, 남겨진 마음도 함께 움직인다.', `팀 교체: ${oldName} -> ${newName}`);
  commitProgress();
  append(`${oldName}이(가) 물러나고 ${newName}이(가) 합류했습니다.`, 'ally');
  append(`현재 팀: ${team.join(', ')}`);
}

function clearTeam() {
  team = [];
  reflect('외로움', '잠시 혼자가 되는 일은 실패가 아니라 다음 만남을 위한 빈자리다.', '팀 해산');
  commitProgress();
  append('팀을 해산했습니다.');
}

function dismissTeamMember(input = '') {
  const name = findUser(input.trim());
  if (!name || !team.includes(name)) {
    append(`해고할 팀원을 입력하세요. 현재 팀: ${team.length ? team.join(', ') : '없음'}`);
    return;
  }
  team = team.filter((member) => member !== name);
  reflect('슬픔', '헤어짐은 명령처럼 짧지만, 마음속에서는 늘 조금 더 길게 울린다.', `팀 해고: ${name}`);
  commitProgress();
  append(`${name}을(를) 팀에서 해고했습니다.`);
}

function help() {
  append(`\n[명령어]\n숫자              추천 행동 선택\n자동              자동 진행 켜기/끄기\n자동목표 무한구역 자동으로 단일 극한 구역 탐험\n전략 파밍         자동 진행의 우선 성향 변경\n계획              네코 3턴 계획 보기\n위상/위상변경     무한구역 현재 규칙 확인/전환\n자동목표 도박     자동으로 도박장 게임 진행\n원정              무한구역 로그라이크 원정 시작/상태\n원정종료/탈출     유물과 저주를 정산하고 광장 귀환\n파편상점          무한 파편 영구 보너스 상점\n파편구매 체력     파편으로 영구 성장 구매\n빚/빚갚기         도박 빚 확인과 상환\n연성/연성 투자    보관 아이템을 유료 합성, 투자 시 저주 확률 감소\n네코훈련 행운     돈을 써서 네코 전투/행운/조언 훈련\n선물 이름/급여    동료에게 돈을 써서 신뢰 상승\n정보구매 장소     돈을 내고 다음 위험과 사건 확인\n치료소/저주해제   돈을 내고 부상 치료나 원정 저주 해제\n경제 투자         AI 유저 사이 투자/파산/고용/기부 사건\n사회 투자         AI 사회사건으로 경제 사건 발생\n도박              도박장 게임 목록\n도박 블랙잭 50    블랙잭 판돈 50전\n도박 블랙잭 올인  보유금 전부를 블랙잭에 걸기\n도박 파칭코 올인  보유금 전부를 파칭코에 걸기\n도박 텍사스포커 올인 보유금 전부를 포커에 걸기\n도박 러시안룰렛 올인 보유금 전부를 검은 룰렛에 걸기\n사회              AI 유저 사회 사건 발생\n환영              초보 안내\n임무              현재 스토리 목표\n지도              전체 지도 보기\n보기              현재 장소 보기\n조사              장소/NPC/위험/사건 조사\n사건              현재 장소 사건 처리\n대화 대상         고정 NPC와 대화\n사냥/공격         현재 방 몬스터와 전투\n수련              경험치를 얻고 자동 레벨업\n회복              동료/네코/회복지점 회복\n품목              장터/무한구역 상품 보기\n구매 회복약       회복 아이템 구매\n구매 청동검       장비 구매\n착용 장비명       장비 착용\n강화 무기         장터/무한구역에서 장비 강화\n점수              캐릭터 점수 보기\n소지품            보관 아이템 보기\n네코기억          네코의 축적 지식 확인\n사용 회복약       회복약 사용\n상태              상태창 갱신\n저장              현재 진행 저장\n유저              AI 유저와 특수능력/보유금 보기\n말 내용           주변 유저와 대화\n귓 이름 내용      특정 유저에게 말하기\n팀 이름           AI 유저를 동료로 영입\n팀해고 이름       팀원 해고\n팀교체 기존 새    팀원 교체\n팀해산            팀 해산\n이동 장소         장소 이동\n네코 질문         Gemini 네코에게 묻기\n\n자동목표: 스토리 / 사냥 / 장비 / 안전 / 탐험 / 무한구역 / 팀 / 도박\n자동전략: 균형 / 안정 / 파밍 / 보스 / 파편 / 빚\n예) 이동 주막 → 이동 도박장\n예) 경제 투자\n예) 사회 파산\n예) 정보구매 무한구역`);
}

function blueprint() {
  append(`\n[설계도]\n원형 반영: 광장 시작, 환영 안내, 봐/조사, 대화, 공격, 소지품, 장비, 점수, 수련, 저장 흐름.\nRPG 루프: 사냥/수련 → 레벨업 → 장비 구매/착용/강화 → 팀 역할 조합 → 장소 사건 → 무한구역 극한 전투.\n로그라이크 축: 원정 시작 → 단일 전장(보스/전투/사건) 반복 → 유물 획득 → 저주 누적 → 탈출 정산.\n진행 방식: 폐광 입구 → 무한구역 → 10배 강한 적과 전투 → 무한원정 반복.\n확장: 적 특성, 유물, 저주, 보상 테이블을 더하면 단일 구역 안에서 밀도를 높일 수 있다.`, 'room');
}

function ambientChat() {
  if (!connected) return;
  if (Math.random() > 0.82) {
    aiSocietyEvent('', true);
    return;
  }
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
  updateDiagnostics();
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

  if (/^\d+$/.test(input) && choiceSlots[Number(input) - 1]) {
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
  else if (['사건', '탐색', 'event'].includes(command)) resolveRoomEvent();
  else if (['대화', 'talk'].includes(command)) talkNpc(body);
  else if (['사냥', '공격', '때려', '쳐', 'attack'].includes(command)) hunt(body);
  else if (command === '수련') trainCharacter();
  else if (['회복', '치료', 'heal'].includes(command)) recoverHp();
  else if (['원정', '원정시작', '무한원정', 'rogue'].includes(command)) startRogueRun();
  else if (['원정종료', '탈출', 'escape'].includes(command) || (rogue.active && ['귀환', '광장'].includes(command))) finishRogueRun(false, '수동 탈출');
  else if (['파편상점', '파편', 'fragment'].includes(command)) showShardShop();
  else if (['파편구매', '파편강화', 'fragmentbuy'].includes(command)) buyShardUpgrade(body);
  else if (['빚', '빚확인', 'debt'].includes(command)) {
    append(`도박 빚: ${character.gambleDebt || 0}전`);
    showChoices();
  }
  else if (['빚갚기', '상환', '빚상환', 'paydebt'].includes(command)) payGambleDebt(body);
  else if (['품목', '상점', 'shop'].includes(command)) showShop();
  else if (['구매', '구입', '사', 'buy'].includes(command)) buyItem(body);
  else if (['착용', '장착', 'equip'].includes(command)) equipItem(body);
  else if (['강화', '업그레이드', 'upgrade'].includes(command)) upgradeEquipment(body);
  else if (['연성', '조합', '융합', '합성', 'forge'].includes(command)) forgeItem(body);
  else if (['네코훈련', '훈련네코', '고양이훈련'].includes(command)) trainNekoWithGold(body);
  else if (['선물', '급여', '월급'].includes(command)) giftTeam(body);
  else if (['정보구매', '정보상', '소문구매'].includes(command)) buyInformation(body);
  else if (['치료소', '부상치료', '저주해제', '요양'].includes(command)) paidCare(`${command} ${body}`);
  else if (['경제', '투자', '파산', '고용', '기부'].includes(command)) economyEvent(`${command} ${body}`);
  else if (['히트', 'hit'].includes(command)) blackjackHit();
  else if (['스탠드', 'stand'].includes(command)) blackjackStand();
  else if (command === '도박장') {
    if (roomName !== '도박장' && rooms[roomName].exits.includes('도박장')) move('도박장');
    else gamble(body);
  }
  else if (['도박', '카지노', '블랙잭', '파칭코', '텍사스포커', '포커', '러시안룰렛', '룰렛', '올인', 'allin', 'all-in'].includes(command)) gamble(`${command} ${body}`);
  else if (['사회', '사건사회', 'social'].includes(command)) aiSocietyEvent(body);
  else if (['소지품', '소지', 'inventory'].includes(command)) showInventory();
  else if (['점수', '정보', '건강', 'score'].includes(command)) showScore();
  else if (['네코기억', '기억', '학습'].includes(command)) showNekoMemory();
  else if (['사용', '마셔', '먹어'].includes(command)) useItem(body);
  else if (['자동', 'auto'].includes(command)) setAutoProgress(!autoProgress);
  else if (['자동목표', '목표', 'mode'].includes(command)) setAutoMode(body);
  else if (['전략', '자동전략', 'strategy'].includes(command)) setAutoStrategy(body);
  else if (['계획', '전술', '네코계획', 'plan'].includes(command)) showNekoPlan();
  else if (['위상', 'phase'].includes(command)) showFrontierPhase();
  else if (['위상변경', '위상전환', 'phasechange'].includes(command)) {
    shiftFrontierPhase('수동 전환');
    commitProgress();
    showChoices();
  }
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
  else if (['팀해고', '파티해고', '해고', '방출'].includes(command)) dismissTeamMember(body);
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
autoModeEl.addEventListener('change', () => setAutoMode(autoModeEl.value));
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

ensureAiUsers(200);
loadSettings();
syncAutoModeOptions();
loadGameState();
setConnected(false);
renderStatusPanel();
setStatus('입장 대기', '');
updateDiagnostics();
append('무한대전 PC통신 접속 대기');
append('1. 입장  2. 퇴장  3. 네코  4. 화면 지우기  5. 자동 진행');
append('Gemini 키는 Vercel 환경변수 GEMINI_API_KEY를 사용합니다.');
