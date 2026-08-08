const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");

test("첫 퀘스트 UI와 F 조작 안내가 연결된다", () => {
  const html = readFileSync(path.join(__dirname, "../index.html"), "utf8");
  const game = readFileSync(path.join(__dirname, "../src/game.js"), "utf8");

  assert.match(html, /id="dialogueOverlay"/);
  assert.match(html, /id="questTracker"/);
  assert.match(html, /id="expText"/);
  assert.match(html, /<kbd>F<\/kbd>/);
  assert.match(game, /recordQuestKill/);
});

test("대화 중 Enter는 주요 행동에 남고 Escape만 대화를 닫는다", async () => {
  const { dialogueKeyAction } = await import("../src/game.js");

  assert.equal(dialogueKeyAction("Enter"), "allow-action");
  assert.equal(dialogueKeyAction("Escape"), "close");
});

test("대화 포커스는 주요 행동과 닫기 버튼 안에서 순환한다", async () => {
  const { nextDialogueFocus } = await import("../src/game.js");
  const actionButton = {};
  const closeButton = {};
  const controls = [actionButton, closeButton];

  assert.strictEqual(nextDialogueFocus(controls, actionButton, false), closeButton);
  assert.strictEqual(nextDialogueFocus(controls, closeButton, false), actionButton);
  assert.strictEqual(nextDialogueFocus(controls, {}, false), actionButton);
});

test("읽기가 차단된 브라우저 저장소는 사용 불가로 구분한다", async () => {
  const { readableProgressStorage } = await import("../src/game.js");
  const available = { getItem: () => null, setItem: () => {} };
  const blocked = { getItem: () => { throw new Error("blocked"); }, setItem: () => {} };

  assert.strictEqual(readableProgressStorage(available), available);
  assert.equal(readableProgressStorage(blocked), null);
});

test("좁은 화면에서 퀘스트와 대화 안내는 채팅 패널을 피한다", () => {
  const css = readFileSync(path.join(__dirname, "../styles.css"), "utf8");

  assert.match(css, /\.npc-prompt \{[^}]*z-index:\s*12/);
  assert.match(css, /@media \(max-width:\s*620px\)[\s\S]*?\.quest-tracker \{[^}]*width:\s*calc\(100% - 28px\)/);
  assert.match(css, /@media \(max-width:\s*620px\)\s*\{(?:(?!@media)[\s\S])*?\.performance-panel \{[^}]*display:\s*none/);
  assert.match(css, /@media \(max-width:\s*520px\)[\s\S]*?\.npc-prompt \{[^}]*bottom:\s*calc\(266px \+ env\(safe-area-inset-bottom\)\)/);
});
