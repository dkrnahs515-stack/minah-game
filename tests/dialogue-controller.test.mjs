import test from "node:test";
import assert from "node:assert/strict";
import { DialogueController } from "../src/dialogue-controller.js";

function button() {
  const listeners = [];
  return {
    textContent: "",
    addEventListener(type, listener) {
      if (type === "click") listeners.push(listener);
    },
    click() {
      for (const listener of listeners) listener();
    },
  };
}

function fixture(onAction = () => {}) {
  const overlay = { hidden: true };
  const title = { textContent: "" };
  const body = { textContent: "" };
  const actionButton = button();
  return {
    overlay,
    title,
    body,
    actionButton,
    controller: new DialogueController({ overlay, title, body, actionButton, onAction }),
  };
}

test("open은 대화 모델을 표시하고 오버레이를 연다", () => {
  const view = fixture();
  view.controller.open({
    title: "현자 아렌",
    body: "슬라임을 처치해 주세요.",
    action: "accept",
    actionLabel: "퀘스트 수락",
  });

  assert.equal(view.overlay.hidden, false);
  assert.equal(view.title.textContent, "현자 아렌");
  assert.equal(view.body.textContent, "슬라임을 처치해 주세요.");
  assert.equal(view.actionButton.textContent, "퀘스트 수락");
});

test("반복해서 열어도 현재 행동은 클릭 한 번에 한 번만 전달된다", () => {
  const actions = [];
  const view = fixture(action => actions.push(action));
  view.controller.open({ title: "아렌", body: "첫 대화", action: "accept", actionLabel: "수락" });
  view.controller.open({ title: "아렌", body: "둘째 대화", action: "complete", actionLabel: "보고" });
  view.actionButton.click();

  assert.deepEqual(actions, ["complete"]);
});

test("close는 대화 오버레이를 숨긴다", () => {
  const view = fixture();
  view.controller.open({ title: "아렌", body: "안녕하세요", action: "close", actionLabel: "마치기" });
  view.controller.close();

  assert.equal(view.overlay.hidden, true);
});
