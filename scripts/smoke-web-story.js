'use strict';

const fs = require('fs');
const vm = require('vm');

function makeElement(id = '') {
  const element = {
    id,
    value: '',
    textContent: '',
    className: '',
    disabled: false,
    checked: true,
    children: [],
    listeners: {},
    appendChild(child) {
      child.parent = this;
      this.children.push(child);
    },
    get firstChild() {
      return this.children[0];
    },
    remove() {
      if (!this.parent) return;
      this.parent.children = this.parent.children.filter((child) => child !== this);
    },
    addEventListener(type, handler) {
      this.listeners[type] = handler;
    },
    focus() {}
  };
  return element;
}

const ids = [
  'status', 'diagnostics', 'gameScreen', 'statusPanel', 'gameCommand', 'gameForm',
  'gameConnect', 'gameDisconnect', 'gameSend', 'gameClear', 'gameEnter',
  'gameAuto', 'autoMode', 'autoScroll', 'geminiTestStatus', 'geminiModel', 'nekoGender',
  'nekoTone', 'nekoPersonality', 'nekoRole', 'nekoRisk', 'nekoMemoryMode',
  'nekoLevel', 'nekoLuck', 'nekoAbility', 'nekoPrompt', 'saveSettings',
  'randomSettings', 'testGemini'
];
const elements = Object.fromEntries(ids.map((id) => [id, makeElement(id)]));
elements.geminiModel.value = 'gemini-3.1-flash-lite';
elements.autoMode.value = 'story';
elements.nekoGender.value = '검은 고양이';
elements.nekoTone.value = '짧게';
elements.nekoPersonality.value = '차분한 분석가';
elements.nekoRole.value = '길잡이';
elements.nekoRisk.value = '균형';
elements.nekoMemoryMode.value = '요약 기억';
elements.nekoLevel.value = '7';
elements.nekoLuck.value = '9';
elements.nekoAbility.value = '길찾기';
elements.nekoPrompt.value = '테스트';

const storage = {};
let seed = 7;
const seededMath = Object.create(Math);
seededMath.random = () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};
const context = {
  console,
  Math: seededMath,
  setTimeout,
  clearTimeout,
  localStorage: {
    getItem(key) { return storage[key] || null; },
    setItem(key, value) { storage[key] = String(value); }
  },
  document: {
    getElementById(id) { return elements[id] || makeElement(id); },
    createElement() { return makeElement(); },
    querySelector(selector) {
      if (selector === 'meta[name="app-version"]') return { content: 'test' };
      if (selector === '.settings') return makeElement('settings');
      return null;
    }
  },
  window: {
    setInterval() { return 1; },
    clearInterval() {},
    addEventListener() {}
  }
};
context.globalThis = context;

vm.runInNewContext(fs.readFileSync('web/app.js', 'utf8'), context, { filename: 'web/app.js' });
const allInStakes = vm.runInNewContext('(() => { const old = character.gold; character.gold = 777; const stakes = ["도박 블랙잭 올인", "도박 파칭코 올인", "도박 텍사스포커 올인", "도박 러시안룰렛 올인"].map(gambleStake); character.gold = old; return stakes; })()', context);
if (!allInStakes.every((stake) => stake === 777)) throw new Error('도박 올인 판돈 계산 실패');
const passiveCash = vm.runInNewContext('(() => { const old = character.gold; character.gold = 0; aiSocietyEvent("상단", true); const passive = character.gold; aiSocietyEvent("상단"); const explicit = character.gold; character.gold = old; return [passive, explicit]; })()', context);
if (passiveCash[0] !== 0 || passiveCash[1] !== 15) throw new Error('자동 사회 사건 현금 생성 차단 실패');
const blackjackPush = vm.runInNewContext('(() => { const oldGold = character.gold; const oldRep = economy.reputation; const oldIndex = economy.index; const oldLast = economy.last; const oldConcepts = economy.concepts.slice(); character.gold = 0; economy.reputation = 3; economy.index = 100; gambleState.blackjack = { stake: 100, player: [{ rank: 10, suit: "♠" }, { rank: 8, suit: "♣" }], dealer: [{ rank: 9, suit: "♦" }, { rank: 9, suit: "♥" }] }; finishBlackjack("push", "테스트"); const result = [character.gold, economy.reputation, economy.index]; character.gold = oldGold; economy.reputation = oldRep; economy.index = oldIndex; economy.last = oldLast; economy.concepts = oldConcepts; gambleState.blackjack = null; return result; })()', context);
if (blackjackPush[0] !== 100 || blackjackPush[1] !== 3 || blackjackPush[2] !== 100) throw new Error('블랙잭 푸시 정산 실패');
const autoGambleRisk = vm.runInNewContext('(() => { const oldRoom = roomName; const oldGold = character.gold; const oldRisk = fields.risk.value; roomName = "도박장"; character.gold = 500; fields.risk.value = "광기"; const mad = bestAutoGambleChoice().command; fields.risk.value = "공격"; const attack = bestAutoGambleChoice().command; fields.risk.value = "안전"; const safe = bestAutoGambleChoice().command; roomName = oldRoom; character.gold = oldGold; fields.risk.value = oldRisk; return [mad, attack, safe]; })()', context);
if (!autoGambleRisk[0].includes('올인') || autoGambleRisk[1].includes('올인') || autoGambleRisk[2].includes('올인') || !autoGambleRisk[1].includes('300') || !autoGambleRisk[2].includes('50')) throw new Error('자동 도박 위험 성향 반영 실패');
const bankruptcyNote = vm.runInNewContext('(() => { const oldGold = character.gold; const oldMood = character.mood; const oldScene = character.lastScene; const oldInsight = character.insight; const oldContracts = economy.contracts.slice(); const oldDebt = character.gambleDebt; character.gold = 0; character.gambleDebt = 0; noteGambleBankruptcy("테스트", 100); const result = [character.mood, economy.contracts.includes("도박장 외상 주의"), character.gambleDebt]; character.gold = oldGold; character.mood = oldMood; character.lastScene = oldScene; character.insight = oldInsight; character.gambleDebt = oldDebt; economy.contracts = oldContracts; return result; })()', context);
if (bankruptcyNote[0] !== '절망' || !bankruptcyNote[1] || bankruptcyNote[2] !== 25) throw new Error('도박 파산 안내 실패');
const debtPay = vm.runInNewContext('(() => { const oldGold = character.gold; const oldDebt = character.gambleDebt; const oldContracts = economy.contracts.slice(); const oldRep = economy.reputation; character.gold = 80; character.gambleDebt = 60; payGambleDebt("35"); const result = [character.gold, character.gambleDebt, goldLog[0]]; character.gold = oldGold; character.gambleDebt = oldDebt; economy.contracts = oldContracts; economy.reputation = oldRep; return result; })()', context);
if (debtPay[0] !== 45 || debtPay[1] !== 25 || !debtPay[2].includes('도박 빚 상환')) throw new Error('도박 빚 상환 실패');
const shardBuy = vm.runInNewContext('(() => { const oldFragments = rogue.fragments; const oldPerks = JSON.parse(JSON.stringify(rogue.perks)); const oldHpMax = character.hpMax; const oldHp = character.hp; rogue.fragments = 10; buyShardUpgrade("체력"); const result = [rogue.fragments, character.hpMax, rogue.perks.hp]; rogue.fragments = oldFragments; rogue.perks = oldPerks; character.hpMax = oldHpMax; character.hp = oldHp; return result; })()', context);
if (shardBuy[0] !== 7 || shardBuy[1] !== 43 || shardBuy[2] !== 1) throw new Error('파편 영구 성장 구매 실패');
vm.runInNewContext('(() => { const oldGold = character.gold; const oldDebt = character.gambleDebt; const oldFragments = rogue.fragments; const oldGoldLog = goldLog.slice(); changeGold(12, "테스트 수입"); rogue.fragments = 2; character.gambleDebt = 9; saveGameState(); character.gold = oldGold; character.gambleDebt = oldDebt; rogue.fragments = oldFragments; goldLog = oldGoldLog; })()', context);
const savedState = JSON.parse(storage['muhan.game.state']);
if (savedState.saveVersion !== 2 || !Array.isArray(savedState.goldLog) || savedState.character.gambleDebt !== 9 || savedState.rogue.fragments !== 2 || !savedState.rogue.perks) throw new Error('저장 버전/경제/파편 상태 저장 실패');
delete storage['muhan.game.state'];

function screenText() {
  return elements.gameScreen.children.map((child) => child.textContent).join('\n');
}

async function submit(command) {
  elements.gameCommand.value = command;
  await elements.gameForm.listeners.submit({ preventDefault() {} });
}

(async () => {
  elements.gameConnect.listeners.click();
  if (!elements.autoMode.children.some((option) => option.value === 'gamble')) throw new Error('도박 자동 목표 옵션 누락');
  elements.autoMode.value = 'gamble';
  elements.autoMode.listeners.change();
  if (!elements.statusPanel.textContent.includes('자동 목표: 도박 우선')) throw new Error('도박 자동 목표 드롭다운 선택 실패');
  elements.autoMode.value = 'story';
  elements.autoMode.listeners.change();
  vm.runInNewContext('choiceSlots = [{ label: "1", command: "지도" }, { label: "2", command: "지도" }, { label: "3", command: "지도" }, { label: "4", command: "지도" }, { label: "5", command: "보기" }]', context);
  await submit('5');
  if (!screenText().includes('=> 보기')) throw new Error('5번 추천 행동 선택 실패');
  if (!elements.diagnostics.textContent.includes('AI 유저 200명')) throw new Error('진단창 AI 유저 기본 숫자 표시 실패');
  await submit('유저');
  if (!screenText().includes('[접속자 200명]') || !screenText().includes('(결혼)')) throw new Error('AI 유저 200명/능력 표시 실패');
  await submit('사회 결혼');
  if (!screenText().includes('[AI 사회]') || !screenText().includes('현재 접속자: 201명')) throw new Error('AI 사회 결혼/증가 사건 실패');
  if (!elements.diagnostics.textContent.includes('AI 유저 201명')) throw new Error('진단창 AI 유저 증가 반영 실패');
  if (!elements.statusPanel.textContent.includes('[현재상태]') || !elements.statusPanel.textContent.includes('감정: 기쁨')) throw new Error('AI 사회 사건 현재상태 반영 실패');
  await submit('사회 투자');
  if (!elements.statusPanel.textContent.includes('[경제]') || !elements.statusPanel.textContent.includes('새 개념:')) throw new Error('AI 투자 경제 사건 반영 실패');
  await submit('경제 파산');
  if (!screenText().includes('부실채권') || elements.statusPanel.textContent.includes('부채: 없음')) throw new Error('부채 경제 사건 반영 실패');
  await submit('지도');
  if (!screenText().includes('[지도]') || !screenText().includes('[중앙광장]')) throw new Error('지도 표시 실패');
  if (!screenText().includes('도박장')) throw new Error('도박장 지도 표시 실패');
  if (!screenText().includes('표식: S 안전 / $ 상점 / H 회복 / B 보스')) throw new Error('무한평원 지도 표식 실패');
  if (!elements.statusPanel.textContent.includes('[실시간 지도]') || !elements.statusPanel.textContent.includes('[중앙광장]')) throw new Error('상태창 실시간 지도 표시 실패');
  if (!elements.statusPanel.textContent.includes('자동 목표: 스토리 우선')) throw new Error('자동 목표 기본값 표시 실패');
  const seedBeforeGambling = seed;
  await submit('이동 주막');
  await submit('이동 도박장');
  if (!screenText().includes('1. 블랙잭 50전') || !screenText().includes('4. 러시안룰렛 50전') || !screenText().includes('5. 블랙잭 올인') || !screenText().includes('8. 러시안룰렛 올인')) throw new Error('도박장 직접 선택지 표시 실패');
  await submit('1');
  if (!screenText().includes('게임: 블랙잭') || (!screenText().includes('딜러 공개') && !screenText().includes('첫 두 장'))) throw new Error('블랙잭 실제 진행 표시 실패');
  await submit('스탠드');
  await submit('도박 파칭코 10');
  await submit('도박 텍사스포커 10');
  await submit('도박 러시안룰렛 10');
  if (!screenText().includes('게임: 블랙잭') || !screenText().includes('게임: 파칭코') || !screenText().includes('게임: 텍사스포커') || !screenText().includes('게임: 검은 룰렛')) throw new Error('도박장 4종 게임 실행 실패');
  if (!screenText().includes('구슬') || !screenText().includes('보드:') || !screenText().includes('족보:') || !screenText().includes('6칸 중')) throw new Error('도박장 실제 룰 표시 실패');
  if (!elements.statusPanel.textContent.includes('도박장 신용')) throw new Error('도박장 경제 반영 실패');
  await submit('자동목표 도박');
  if (!elements.statusPanel.textContent.includes('자동 목표: 도박 우선')) throw new Error('도박 자동 목표 변경 실패');
  await submit('자동목표 도박우선');
  if (!elements.statusPanel.textContent.includes('자동 목표: 도박 우선')) throw new Error('도박 자동 목표 붙여쓰기 변경 실패');
  await submit('자동');
  await context.autoTick();
  if (!screenText().includes('=> 도박 ')) throw new Error('도박 우선 자동 진행 실패');
  await submit('자동');
  await submit('이동 주막');
  await submit('이동 중앙광장');
  seed = seedBeforeGambling;
  await submit('팀 검객루안');
  if (!elements.statusPanel.textContent.includes('팀: 검객루안')) throw new Error('팀 영입 실패');
  await submit('팀교체 검객루안 달빛상인');
  if (!elements.statusPanel.textContent.includes('팀: 달빛상인')) throw new Error('팀 교체 실패');
  await submit('팀해산');
  if (!elements.statusPanel.textContent.includes('팀: 없음')) throw new Error('팀 해산 실패');
  await submit('환영');
  if (!elements.statusPanel.textContent.includes('첫 임무')) throw new Error('환영 이후 첫 임무로 진행되지 않음');
  await submit('1');
  if (!elements.statusPanel.textContent.includes('위치: 현감청')) throw new Error('1번 선택으로 현감청 이동 실패');
  if (!elements.statusPanel.textContent.includes('[현감청]')) throw new Error('지도 현재 위치 갱신 실패');
  await submit('대화 현감');
  if (!elements.statusPanel.textContent.includes('발자국 조사')) throw new Error('현감 대화 이후 발자국 조사로 진행되지 않음');
  if (!screenText().includes('[임무 보상]') || !screenText().includes('현감의 동전')) throw new Error('임무 보상 지급 실패');
  await submit('1');
  await submit('1');
  await submit('1');
  if (!elements.statusPanel.textContent.includes('위치: 초보사냥터')) throw new Error('추천 이동으로 초보사냥터 도착 실패');
  await submit('팀 검객루안');
  await submit('선물 검객루안');
  if (!screenText().includes('[동료 선물]') || !elements.statusPanel.textContent.includes('급여 계약') || elements.statusPanel.textContent.includes('계약: 없음')) throw new Error('동료 선물/급여 경제 반영 실패');
  await submit('1');
  if (!screenText().includes('[전투]')) throw new Error('추천 선택으로 전투가 실행되지 않음');
  if (!screenText().includes('Lv.') || !screenText().includes('[전투 과정]')) throw new Error('레벨 스케일 전투 로그 표시 실패');
  if (!screenText().includes('2d36') || !/명중|강타|치명|방어|실패/.test(screenText())) throw new Error('2d36 대항 판정 로그 표시 실패');
  if (!screenText().includes('네코가 앞발로 빈틈을 만들었다')) throw new Error('네코 전투 참여 문구가 없음');
  if (!screenText().includes('[팀 신뢰]') || !elements.statusPanel.textContent.includes('[팀 신뢰]')) throw new Error('팀 신뢰도 상승 실패');
  if (!elements.statusPanel.textContent.includes('[네코 지식]') || !elements.statusPanel.textContent.includes('전투 1')) throw new Error('네코 전투 기억 누적 실패');
  if (!elements.statusPanel.textContent.includes('첫 수련')) throw new Error('전투 이후 첫 수련 임무로 진행되지 않음');
  await submit('사냥');
  await submit('사냥');
  await submit('사냥');
  if (!elements.statusPanel.textContent.includes('레벨: 2')) throw new Error('경험치 자동 레벨업 실패');
  if (!screenText().includes('[레벨 상승]')) throw new Error('레벨 상승 메시지가 없음');
  await submit('회복');
  if (!screenText().includes('HP')) throw new Error('회복 명령 응답이 없음');
  await submit('이동 생명의나무');
  await submit('대화 안내자');
  await submit('이동 중앙광장');
  await submit('이동 주막');
  await submit('이동 장터');
  await submit('네코훈련 행운');
  if (!screenText().includes('[네코 훈련]') || !elements.statusPanel.textContent.includes('훈련: 전투 0 / 행운 1')) throw new Error('네코 유료 훈련 실패');
  await submit('정보구매 무한평원 05-05');
  if (!screenText().includes('[정보 구매]') || !screenText().includes('무한평원 05-05')) throw new Error('정보 구매 실패');
  await submit('품목');
  if (!screenText().includes('철검') || !screenText().includes('사냥꾼 부적')) throw new Error('고급 장비 상점 표시 실패');
  await submit('구매 회복약');
  if (!screenText().includes('약장수')) throw new Error('장터 구매가 실행되지 않음');
  await submit('구매 청동검');
  await submit('착용 청동검');
  if (!elements.statusPanel.textContent.includes('무기: 청동검')) throw new Error('장비 착용 실패');
  await submit('강화 무기');
  if (!elements.statusPanel.textContent.includes('무기: +1')) throw new Error('장비 강화 실패');
  await submit('이동 주막');
  await submit('이동 중앙광장');
  await submit('이동 북문');
  await submit('조사');
  await submit('이동 북문 밖 숲');
  await submit('조사');
  await submit('사냥');
  if (!screenText().includes('특성:')) throw new Error('몬스터 특성 전투 로그가 없음');
  await submit('이동 폐광 입구');
  await submit('사냥 폐광 우두머리');
  if (!elements.statusPanel.textContent.includes('평원 진입')) throw new Error('폐광 이후 평원 진입 임무 실패');
  await submit('이동 북문 밖 숲');
  await submit('이동 북문');
  await submit('이동 중앙광장');
  await submit('이동 주막');
  await submit('이동 장터');
  await submit('자동목표 장비');
  await submit('자동');
  const beforeGearAuto = screenText();
  await context.autoTick();
  await context.autoTick();
  const gearAutoLog = screenText().slice(beforeGearAuto.length);
  if (!gearAutoLog.includes('=> 착용 광부의 곡괭이')) throw new Error('자동 장비가 더 좋은 곡괭이를 착용하지 않음');
  if (gearAutoLog.includes('=> 착용 청동검')) throw new Error('자동 장비가 청동검으로 되돌아감');
  await context.autoTick();
  if (!elements.statusPanel.textContent.includes('위치: 주막')) throw new Error('자동 장비 정비 후 장터를 벗어나지 않음');
  const beforeShopLoopCheck = screenText();
  await context.autoTick();
  await context.autoTick();
  if (screenText().slice(beforeShopLoopCheck.length).includes('=> 이동 장터')) throw new Error('자동 진행이 주막/장터 왕복을 반복함');
  await submit('자동');
  await submit('이동 중앙광장');
  await submit('이동 북문');
  await submit('이동 북문 밖 숲');
  await submit('이동 폐광 입구');
  await submit('이동 무한평원 01-01');
  await submit('조사');
  if (!elements.statusPanel.textContent.includes('표지석 조사')) throw new Error('평원 진입 이후 표지석 조사 임무 실패');
  if (!elements.statusPanel.textContent.includes('위치: 무한평원 01-01')) throw new Error('확장 지도 진입 실패');
  if (!screenText().includes('장면:') || !elements.statusPanel.textContent.includes('깨달음:')) throw new Error('무한평원 장면/깨달음 표시 실패');
  if (!screenText().includes('장소 사건: 평원 초소 단서')) throw new Error('장소 사건 조사 표시 실패');
  await submit('사건');
  if (!screenText().includes('[장소 사건]') || !screenText().includes('사건 보상')) throw new Error('장소 사건 처리 실패');
  if (!/사건: [1-9]\d*\//.test(elements.statusPanel.textContent)) throw new Error('장소 사건 저장 표시 실패');
  const beforeRepeatEvent = screenText();
  await submit('사건');
  if (!screenText().slice(beforeRepeatEvent.length).includes('이미 해결')) throw new Error('장소 사건 중복 처리 차단 실패');
  await submit('지도');
  if (!screenText().includes('[01-01S]') || !screenText().includes('10-10B')) throw new Error('무한평원 100구역 지도 표시 실패');
  await submit('조사');
  if (!screenText().includes('평원')) throw new Error('무한평원 조우 생성 실패');
  await submit('사냥 무리');
  if (!screenText().includes('출현:')) throw new Error('무한평원 복수 몬스터 출현 표시 실패');
  await submit('원정');
  if (!screenText().includes('[무한원정]') || !screenText().includes('[유물]')) throw new Error('무한원정 시작/유물 지급 실패');
  if (!elements.statusPanel.textContent.includes('[무한원정]') || !elements.statusPanel.textContent.includes('상태: 진행 중')) throw new Error('무한원정 상태창 표시 실패');
  if (!elements.statusPanel.textContent.includes('유물:')) throw new Error('무한원정 유물 상태 표시 실패');
  await submit('자동목표 무한평원');
  if (!elements.statusPanel.textContent.includes('자동 목표: 무한평원')) throw new Error('무한평원 자동 목표 변경 실패');
  await submit('자동');
  await context.autoTick();
  await context.autoTick();
  await context.autoTick();
  if (elements.statusPanel.textContent.includes('위치: 무한평원 01-01')) throw new Error('무한평원 자동 진행이 깊은 지역으로 이동하지 않음');
  if (!screenText().includes('깊은 탐험')) throw new Error('무한평원 깊은 탐험 로그가 없음');
  await submit('자동');
  await submit('자동목표 사냥');
  if (!elements.statusPanel.textContent.includes('자동 목표: 사냥 우선')) throw new Error('자동 목표 변경 실패');
  await submit('자동');
  if (!elements.statusPanel.textContent.includes('자동 진행: 켜짐')) throw new Error('자동 진행 상태 표시 실패');
  const beforeAuto = screenText();
  await context.autoTick();
  await context.autoTick();
  const autoLog = screenText().slice(beforeAuto.length);
  if (!screenText().includes('[팀 신뢰]')) throw new Error('자동 사냥 실행 실패');
  if ((autoLog.match(/=> 사냥/g) || []).length > 1) throw new Error('자동 진행이 같은 방에서 사냥만 반복함');
  if (!/=> (회복|팀|사건|조사|귓|강화|구매|수련|연성)/.test(autoLog)) throw new Error('자동 진행 대체 행동 선택 실패');
  await context.autoTick();
  if (elements.statusPanel.textContent.includes('위치: 무한평원 01-01')) throw new Error('자동 진행 장소 2회 제한 이동 실패');
  if (!screenText().includes('장소 행동 2회 완료')) throw new Error('자동 진행 강제 이동 안내 실패');
  await submit('연성');
  if (!screenText().includes('[네코 연성]') || !screenText().includes('비용:') || !screenText().includes('특수')) throw new Error('네코 아이템 유료 연성 실패');
  if (!/연성 [1-9]/.test(elements.statusPanel.textContent)) throw new Error('네코 연성 기억 누적 실패');
  await submit('소지품');
  if (!screenText().includes('계보:')) throw new Error('연성 아이템 계보 표시 실패');
  await submit('사회 살해');
  if (!screenText().includes('즉시 체포') || !screenText().includes('현재 접속자: 199명')) throw new Error('AI 사회 범죄/체포 사건 실패');
  if (!elements.diagnostics.textContent.includes('AI 유저 199명')) throw new Error('진단창 AI 유저 감소 반영 실패');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
