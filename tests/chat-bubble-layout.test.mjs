import test from "node:test";
import assert from "node:assert/strict";
import { layoutChatBubble, worldToScreen, wrapChatText } from "../src/chat-bubble-layout.js";

const graphemes = text => typeof Intl.Segmenter === "function"
  ? [...new Intl.Segmenter("ko", { granularity: "grapheme" }).segment(text)].map(part => part.segment)
  : Array.from(text);
const measure = text => graphemes(text).length * 10;

test("줄바꿈은 복합 이모지를 유지하고 4줄 이후에만 말줄임표를 적용한다", () => {
  const family = "👨‍👩‍👧‍👦";
  const lines = wrapChatText(`한글 English ${family} `.repeat(12), measure, 100, 4);
  assert.equal(lines.length, 4);
  assert.equal(lines.at(-1).endsWith("…"), true);
  assert.equal(lines.join("").includes("\uFFFD"), false);
  assert.equal(wrapChatText("12345 67890", measure, 110, 4).at(-1).endsWith("…"), false);
});

test("말풍선은 네 모서리에서 8픽셀 안전 여백 안쪽에 머문다", () => {
  for (const anchor of [
    { x: 1, topY: 1, bottomY: 50 },
    { x: 399, topY: 1, bottomY: 50 },
    { x: 1, topY: 260, bottomY: 299 },
    { x: 399, topY: 260, bottomY: 299 },
  ]) {
    const layout = layoutChatBubble({
      text: "모서리에서 읽을 수 있는 긴 말풍선입니다 😀",
      measureText: measure,
      anchor,
      viewportWidth: 400,
      viewportHeight: 300,
    });
    assert.ok(layout.box.x >= 8);
    assert.ok(layout.box.y >= 8);
    assert.ok(layout.box.x + layout.box.width <= 392);
    assert.ok(layout.box.y + layout.box.height <= 292);
  }
});

test("작고 낮은 화면에서도 말풍선 상자는 안전 영역을 넘지 않는다", () => {
  const layout = layoutChatBubble({
    text: "작은 화면에서도 네 줄을 넘지 않는 긴 말풍선입니다 👩🏽‍🚀",
    measureText: measure,
    anchor: { x: 155, topY: 6, bottomY: 70 },
    viewportWidth: 160,
    viewportHeight: 96,
  });
  assert.ok(layout.lines.length <= 3);
  assert.ok(layout.box.x >= 8);
  assert.ok(layout.box.y >= 8);
  assert.ok(layout.box.x + layout.box.width <= 152);
  assert.ok(layout.box.y + layout.box.height <= 88);
});

test("위쪽 공간이 부족하면 아래 배치로 전환하고 말꼬리를 위로 반전한다", () => {
  const layout = layoutChatBubble({
    text: "위쪽 가장자리",
    measureText: measure,
    anchor: { x: 200, topY: 10, bottomY: 58 },
    viewportWidth: 400,
    viewportHeight: 300,
  });
  assert.equal(layout.placement, "below");
  assert.equal(layout.tail.direction, "up");
});

test("수평 보정 후 말꼬리는 둥근 모서리에서 12픽셀 이상 떨어진다", () => {
  const layout = layoutChatBubble({
    text: "오른쪽",
    measureText: measure,
    anchor: { x: 398, topY: 160, bottomY: 208 },
    viewportWidth: 400,
    viewportHeight: 300,
  });
  assert.ok(layout.tail.x >= layout.box.x + 12);
  assert.ok(layout.tail.x <= layout.box.x + layout.box.width - 12);
});

test("카메라 줌은 월드 좌표 앵커만 화면 좌표로 변환한다", () => {
  assert.deepEqual(worldToScreen({ worldX: 120, worldY: 80, cameraX: 20, cameraY: 10, zoom: 1.5 }), {
    x: 150,
    y: 105,
  });
});
