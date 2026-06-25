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
  'checkStatus', 'gameAuto', 'autoScroll', 'geminiTestStatus', 'geminiModel', 'nekoGender',
  'nekoTone', 'nekoLevel', 'nekoAbility', 'nekoPrompt', 'saveSettings',
  'randomSettings', 'testGemini'
];
const elements = Object.fromEntries(ids.map((id) => [id, makeElement(id)]));
elements.geminiModel.value = 'gemini-3.1-flash-lite';
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
  await submit('환영');
  if (!elements.statusPanel.textContent.includes('첫 임무')) throw new Error('환영 이후 첫 임무로 진행되지 않음');
  await submit('1');
  if (!elements.statusPanel.textContent.includes('위치: 현감청')) throw new Error('1번 선택으로 현감청 이동 실패');
  await submit('대화 현감');
  if (!elements.statusPanel.textContent.includes('발자국 조사')) throw new Error('현감 대화 이후 발자국 조사로 진행되지 않음');
  await submit('1');
  await submit('1');
  await submit('1');
  if (!elements.statusPanel.textContent.includes('위치: 초보사냥터')) throw new Error('추천 이동으로 초보사냥터 도착 실패');
  await submit('1');
  if (!screenText().includes('[전투]')) throw new Error('추천 선택으로 전투가 실행되지 않음');
  if (!screenText().includes('네코가 앞발로 빈틈을 만들었다')) throw new Error('네코 전투 참여 문구가 없음');
  if (!elements.statusPanel.textContent.includes('첫 수련')) throw new Error('전투 이후 첫 수련 임무로 진행되지 않음');
  await submit('사냥');
  await submit('사냥');
  await submit('사냥');
  if (!elements.statusPanel.textContent.includes('레벨: 2')) throw new Error('경험치 자동 레벨업 실패');
  if (!screenText().includes('[레벨 상승]')) throw new Error('레벨 상승 메시지가 없음');
  await submit('회복');
  if (!screenText().includes('HP')) throw new Error('회복 명령 응답이 없음');
  await submit('이동 생명의나무');
  await submit('이동 중앙광장');
  await submit('이동 주막');
  await submit('이동 장터');
  await submit('구매 회복약');
  if (!screenText().includes('약장수')) throw new Error('장터 구매가 실행되지 않음');
  await submit('자동');
  if (!elements.statusPanel.textContent.includes('자동 진행: 켜짐')) throw new Error('자동 진행 상태 표시 실패');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
