import test from "node:test";
import assert from "node:assert/strict";
import { ChatController, chatKeyAction } from "../src/chat-controller.js";

function element(documentRef, tagName = "div") {
  const listeners = new Map();
  return {
    tagName,
    value: "",
    disabled: false,
    className: "",
    textContent: "",
    children: [],
    scrollTop: 0,
    scrollHeight: 100,
    addEventListener: (type, listener) => listeners.set(type, listener),
    dispatch: (type, event = {}) => listeners.get(type)?.(event),
    focus() { documentRef.activeElement = this; this.dispatch("focus"); },
    blur() { if (documentRef.activeElement === this) documentRef.activeElement = null; this.dispatch("blur"); },
    append(...children) { this.children.push(...children); },
    replaceChildren(...children) { this.children = children; },
  };
}

function controllerFixture(onSend = async () => ({ ok: true, error: "" })) {
  const documentRef = { activeElement: null };
  documentRef.createElement = tag => element(documentRef, tag);
  documentRef.createDocumentFragment = () => element(documentRef, "fragment");
  const button = element(documentRef, "button");
  const form = element(documentRef, "form");
  form.querySelector = selector => selector === "button" ? button : null;
  const input = element(documentRef, "input");
  const status = element(documentRef);
  const list = element(documentRef, "ol");
  const typingChanges = [];
  const controller = new ChatController({
    panel: element(documentRef, "section"),
    list,
    form,
    input,
    status,
    onSend,
    onTypingChange: active => typingChanges.push(active),
    documentRef,
  });
  return { controller, documentRef, form, input, button, status, list, typingChanges };
}

test("Enter는 실행 중인 게임에서만 채팅을 열고 Escape는 나가기보다 채팅을 먼저 취소한다", () => {
  assert.equal(chatKeyAction({ code: "Enter", typing: false, running: true, exitOpen: false }), "open");
  assert.equal(chatKeyAction({ code: "Enter", typing: false, running: false, exitOpen: false }), null);
  assert.equal(chatKeyAction({ code: "Enter", typing: false, running: true, exitOpen: true }), null);
  assert.equal(chatKeyAction({ code: "Escape", typing: true, running: true, exitOpen: false }), "cancel");
});

test("전송이 끝나기 전에 Enter를 다시 눌러도 요청은 하나만 실행된다", async () => {
  let resolveSend;
  let calls = 0;
  const fixture = controllerFixture(() => {
    calls += 1;
    return new Promise(resolve => { resolveSend = resolve; });
  });
  fixture.controller.setMode("online", "전체 채팅");
  fixture.controller.open();
  fixture.input.value = " 안녕  월드 ";
  const first = fixture.controller.submit();
  const second = await fixture.controller.submit();
  assert.equal(calls, 1);
  assert.equal(second, false);
  assert.equal(fixture.input.disabled, true);
  resolveSend({ ok: true, error: "" });
  assert.equal(await first, true);
  assert.equal(fixture.input.disabled, false);
  assert.equal(fixture.input.value, "");
});

test("오프라인 전환은 입력 내용과 포커스 상태를 모두 초기화한다", () => {
  const fixture = controllerFixture();
  fixture.controller.setMode("online", "전체 채팅");
  fixture.controller.open();
  fixture.input.value = "작성 중";
  fixture.controller.setMode("offline", "오프라인");
  assert.equal(fixture.controller.isTyping(), false);
  assert.equal(fixture.input.value, "");
  assert.equal(fixture.input.disabled, true);
  assert.equal(fixture.typingChanges.at(-1), false);
});

test("메시지는 HTML이 아니라 텍스트 노드 속성으로 렌더링된다", () => {
  const fixture = controllerFixture();
  fixture.controller.renderMessages([{ name: "<b>별</b>", text: "<img src=x>" }]);
  const fragment = fixture.list.children[0];
  const item = fragment.children[0];
  assert.equal(item.children[0].textContent, "<b>별</b>");
  assert.equal(item.children[1].textContent, "<img src=x>");
});
