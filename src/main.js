import { PixelRPG } from "./game.js";

const elements = {
  canvas: document.querySelector("#game"),
  minimap: document.querySelector("#minimap"),
  hpBar: document.querySelector("#hpBar"),
  hpText: document.querySelector("#hpText"),
  mpBar: document.querySelector("#mpBar"),
  mpText: document.querySelector("#mpText"),
  fpsText: document.querySelector("#fpsText"),
  playerCount: document.querySelector("#playerCount"),
  qualityText: document.querySelector("#qualityText"),
  networkBadge: document.querySelector("#networkBadge"),
  message: document.querySelector("#message"),
  playerSubtitle: document.querySelector(".player-header small"),
  playerName: document.querySelector("#playerName"),
  respawnOverlay: document.querySelector("#respawnOverlay"),
  strongSlot: document.querySelector("#strongSlot"),
  strongCooldown: document.querySelector("#strongCooldown"),
  portalTransitionOverlay: document.querySelector("#portalTransitionOverlay"),
  portalDestination: document.querySelector("#portalDestination"),
};

const game = new PixelRPG(elements);
const hud = document.querySelector("#hud");
const entryOverlay = document.querySelector("#entryOverlay");
const exitOverlay = document.querySelector("#exitOverlay");
const nicknameForm = document.querySelector("#nicknameForm");
const nicknameInput = document.querySelector("#nicknameInput");
const nicknameLength = document.querySelector("#nicknameLength");
const nicknameError = document.querySelector("#nicknameError");
const enterButton = document.querySelector("#enterButton");
const exitButton = document.querySelector("#exitButton");
const cancelExitButton = document.querySelector("#cancelExitButton");
const confirmExitButton = document.querySelector("#confirmExitButton");

const storedName = localStorage.getItem("pixelWorldNickname") || "";
nicknameInput.value = storedName;
updateNicknameLength();
queueMicrotask(() => nicknameInput.focus());

nicknameInput.addEventListener("input", () => {
  nicknameInput.classList.remove("invalid");
  nicknameError.textContent = "";
  updateNicknameLength();
});

nicknameForm.addEventListener("submit", async event => {
  event.preventDefault();
  const nickname = normalizeNickname(nicknameInput.value);
  const error = validateNickname(nickname);
  if (error) {
    nicknameInput.classList.add("invalid");
    nicknameError.textContent = error;
    nicknameInput.focus();
    return;
  }

  enterButton.disabled = true;
  enterButton.textContent = "세계에 접속 중...";
  try {
    localStorage.setItem("pixelWorldNickname", nickname);
    await game.enter(nickname);
    entryOverlay.hidden = true;
    hud.hidden = false;
  } catch (error) {
    console.error(error);
    nicknameError.textContent = "게임 접속에 실패했습니다. 잠시 후 다시 시도해 주세요.";
  } finally {
    enterButton.disabled = false;
    enterButton.textContent = "게임 입장";
  }
});

exitButton.addEventListener("click", openExitDialog);
cancelExitButton.addEventListener("click", closeExitDialog);
confirmExitButton.addEventListener("click", async () => {
  confirmExitButton.disabled = true;
  confirmExitButton.textContent = "나가는 중...";
  try {
    await game.leave();
    exitOverlay.hidden = true;
    hud.hidden = true;
    entryOverlay.hidden = false;
    nicknameInput.value = localStorage.getItem("pixelWorldNickname") || "";
    updateNicknameLength();
    nicknameInput.focus();
  } finally {
    confirmExitButton.disabled = false;
    confirmExitButton.textContent = "게임 나가기";
  }
});

addEventListener("keydown", event => {
  if (event.code !== "Escape") return;
  if (!exitOverlay.hidden) {
    closeExitDialog();
  } else if (game.isRunning()) {
    openExitDialog();
  }
});

addEventListener("pagehide", () => {
  game.leave({ silent: true });
});

function openExitDialog() {
  if (!game.isRunning()) return;
  game.setInputEnabled(false);
  exitOverlay.hidden = false;
  cancelExitButton.focus();
}

function closeExitDialog() {
  exitOverlay.hidden = true;
  game.setInputEnabled(true);
  exitButton.focus();
}

function updateNicknameLength() {
  nicknameLength.textContent = String(Array.from(nicknameInput.value.trim()).length);
}

function normalizeNickname(value) {
  return value.replace(/\s+/g, " ").trim().slice(0, 12);
}

function validateNickname(value) {
  const length = Array.from(value).length;
  if (length < 1) return "닉네임을 입력해 주세요.";
  if (length > 12) return "닉네임은 12자 이내로 입력해 주세요.";
  if (/[<>\\/{}\[\]]/.test(value)) return "닉네임에 사용할 수 없는 문자가 포함되어 있습니다.";
  return "";
}
