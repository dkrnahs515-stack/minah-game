import { splitGraphemes } from "./chat-state.js";

const VIEWPORT_MARGIN = 8;
const CORNER_TAIL_MARGIN = 12;
const BOX_PADDING_X = 10;
const BOX_PADDING_Y = 8;
const LINE_HEIGHT = 18;
const TAIL_HEIGHT = 7;
const ANCHOR_GAP = 7;

export function worldToScreen({ worldX, worldY, cameraX, cameraY, zoom = 1 }) {
  return { x: (worldX - cameraX) * zoom, y: (worldY - cameraY) * zoom };
}

function ellipsize(line, measureText, maxWidth) {
  const characters = splitGraphemes(line);
  while (characters.length && measureText(`${characters.join("")}…`) > maxWidth) characters.pop();
  return measureText(`${characters.join("")}…`) <= maxWidth ? `${characters.join("")}…` : "";
}

export function wrapChatText(text, measureText, maxWidth, maxLines = 4) {
  const characters = splitGraphemes(typeof text === "string" ? text : "");
  const width = Math.max(1, Number(maxWidth) || 1);
  const lineLimit = Math.max(1, Math.floor(maxLines) || 1);
  const lines = [];
  let line = "";
  let index = 0;

  while (index < characters.length && lines.length < lineLimit) {
    const character = characters[index];
    const candidate = line + character;
    if (!line || measureText(candidate) <= width) {
      line = candidate;
      index += 1;
      continue;
    }

    const lineCharacters = splitGraphemes(line);
    let breakIndex = -1;
    for (let cursor = lineCharacters.length - 1; cursor > 0; cursor -= 1) {
      if (/\s/u.test(lineCharacters[cursor])) {
        breakIndex = cursor;
        break;
      }
    }

    if (breakIndex > 0) {
      lines.push(lineCharacters.slice(0, breakIndex).join("").trimEnd());
      line = lineCharacters.slice(breakIndex + 1).join("").trimStart();
    } else {
      lines.push(line.trimEnd());
      line = "";
    }
  }

  if (line && lines.length < lineLimit) lines.push(line.trimEnd());
  const truncated = index < characters.length || (line.length > 0 && lines.length >= lineLimit);
  if (truncated && lines.length) lines[lines.length - 1] = ellipsize(lines.at(-1), measureText, width);
  return lines.length ? lines : [""];
}

const clamp = (value, min, max) => Math.max(min, Math.min(Math.max(min, max), value));

export function layoutChatBubble({ text, measureText, anchor, viewportWidth, viewportHeight }) {
  const viewWidth = Math.max(1, Number(viewportWidth) || 1);
  const viewHeight = Math.max(1, Number(viewportHeight) || 1);
  const marginX = Math.min(VIEWPORT_MARGIN, Math.max(0, (viewWidth - 1) / 2));
  const marginY = Math.min(VIEWPORT_MARGIN, Math.max(0, (viewHeight - 1) / 2));
  const availableWidth = Math.max(1, viewWidth - marginX * 2);
  const availableHeight = Math.max(1, viewHeight - marginY * 2);
  const maxBoxWidth = Math.max(1, Math.min(240, viewWidth * 0.45, availableWidth));
  const maxTextWidth = Math.max(1, maxBoxWidth - BOX_PADDING_X * 2);
  const maxVisibleLines = Math.max(1, Math.min(4,
    Math.floor(Math.max(0, availableHeight - BOX_PADDING_Y * 2) / LINE_HEIGHT),
  ));
  const lines = wrapChatText(text, measureText, maxTextWidth, maxVisibleLines);
  const textWidth = Math.max(...lines.map(measureText));
  const minBoxWidth = Math.min(56, maxBoxWidth);
  const width = Math.min(maxBoxWidth, Math.max(minBoxWidth, textWidth + BOX_PADDING_X * 2));
  const height = Math.min(availableHeight, lines.length * LINE_HEIGHT + BOX_PADDING_Y * 2);
  const aboveY = anchor.topY - ANCHOR_GAP - TAIL_HEIGHT - height;
  const belowY = anchor.bottomY + ANCHOR_GAP + TAIL_HEIGHT;
  const aboveFits = aboveY >= marginY;
  const belowFits = belowY + height <= viewHeight - marginY;
  const placement = aboveFits || (!belowFits && anchor.topY >= viewHeight - anchor.bottomY) ? "above" : "below";
  const preferredY = placement === "above" ? aboveY : belowY;
  const x = clamp(anchor.x - width / 2, marginX, viewWidth - marginX - width);
  const y = clamp(preferredY, marginY, viewHeight - marginY - height);
  const tailMargin = Math.min(CORNER_TAIL_MARGIN, width / 2);
  const tailX = clamp(anchor.x, x + tailMargin, x + width - tailMargin);
  return {
    lines,
    box: { x, y, width, height, paddingX: BOX_PADDING_X, paddingY: BOX_PADDING_Y, lineHeight: LINE_HEIGHT },
    tail: {
      x: tailX,
      y: placement === "above" ? y + height : y,
      direction: placement === "above" ? "down" : "up",
      height: TAIL_HEIGHT,
    },
    placement,
  };
}
