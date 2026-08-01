export const GAME_CONFIG = Object.freeze({
  WORLD_WIDTH: 2880,
  WORLD_HEIGHT: 1800,
  TILE: 32,
  SIMULATION_HZ: 144,
  PLAYER_SPEED: 245,
  CAMERA_LERP: 13,
  MAX_DPR: 1.5,
  MIN_RENDER_SCALE: 0.75,
  NETWORK_SEND_HZ: 20,
  REMOTE_INTERPOLATION_MS: 120,
});

// Firebase 콘솔의 웹 앱 구성 객체를 아래에 붙여 넣으면 온라인 모드가 활성화됩니다.
// databaseURL이 반드시 포함되어야 합니다.
export const FIREBASE_CONFIG = null;

export const ROOM_ID = "public";