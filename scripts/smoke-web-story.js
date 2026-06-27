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
  'nekoTone', 'nekoLevel', 'nekoAbility', 'nekoPrompt', 'saveSettings',
  'randomSettings', 'testGemini'
];
const elements = Object.fromEntries(ids.map((id) => [id, makeElement(id)]));
elements.geminiModel.value = 'gemini-3.1-flash-lite';
elements.autoMode.value = 'story';
elements.nekoGender.value = '검은 고양이';
elements.nekoTone.value = '짧게';
elements.nekoLevel.value = '7';
elements.nekoAbility.value = '길찾기';
elements.nekoPrompt.value = '테스트';

const storage = {};
const context = {
  console,
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

function screenText() {
  return elements.gameScreen.children.map((child) => child.textContent).join('\n');
}

async function submit(command) {
  elements.gameCommand.value = command;
  await elements.gameForm.listeners.submit({ preventDefault() {} });
}

(async () => {
  elements.gameConnect.listeners.click();
  await submit('지도');
  if (!screenText().includes('[지도]') || !screenText().includes('[중앙광장]')) throw new Error('지도 표시 실패');
  if (!screenText().includes('표식: S 안전 / $ 상점 / H 회복 / B 보스')) throw new Error('무한평원 지도 표식 실패');
  if (!elements.statusPanel.textContent.includes('[실시간 지도]') || !elements.statusPanel.textContent.includes('[중앙광장]')) throw new Error('상태창 실시간 지도 표시 실패');
  if (!elements.statusPanel.textContent.includes('자동 목표: 스토리 우선')) throw new Error('자동 목표 기본값 표시 실패');
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
  await submit('1');
  if (!screenText().includes('[전투]')) throw new Error('추천 선택으로 전투가 실행되지 않음');
  if (!screenText().includes('네코가 앞발로 빈틈을 만들었다')) throw new Error('네코 전투 참여 문구가 없음');
  if (!screenText().includes('[팀 신뢰]') || !elements.statusPanel.textContent.includes('[팀 신뢰]')) throw new Error('팀 신뢰도 상승 실패');
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
  if (!/=> (회복|팀|사건|조사|귓|강화|구매|수련)/.test(autoLog)) throw new Error('자동 진행 대체 행동 선택 실패');
  await context.autoTick();
  if (elements.statusPanel.textContent.includes('위치: 무한평원 01-01')) throw new Error('자동 진행 장소 2회 제한 이동 실패');
  if (!screenText().includes('장소 행동 2회 완료')) throw new Error('자동 진행 강제 이동 안내 실패');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
