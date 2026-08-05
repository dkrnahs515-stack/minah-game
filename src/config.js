import { FIREBASE_CONFIG } from "./firebase-config.js";

export const GAME_CONFIG = Object.freeze({
  TILE: 32,
  SIMULATION_HZ: 144,
  PLAYER_SPEED: 245,
  CAMERA_LERP: 13,
  MAX_DPR: 1.5,
  MIN_RENDER_SCALE: 0.75,
  NETWORK_SEND_HZ: 20,
  REMOTE_INTERPOLATION_MS: 120,
});

export { FIREBASE_CONFIG };

export const ROOM_ID = "public";
