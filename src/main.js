import { PixelRPG } from "./game.js";

const game = new PixelRPG({
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
});

game.start().catch(error => {
  console.error(error);
  document.querySelector("#message").textContent = "게임 초기화에 실패했습니다. 콘솔을 확인하세요.";
  document.querySelector("#message").classList.add("show");
});