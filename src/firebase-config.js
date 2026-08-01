// Firebase 콘솔 > 프로젝트 설정 > 내 앱 > SDK 설정 및 구성에서
// firebaseConfig 객체 전체를 복사해 아래 null 자리에 붙여 넣으세요.
// Realtime Database를 사용하므로 databaseURL이 반드시 포함되어야 합니다.
// Firebase 웹 설정 객체는 공개되어도 되는 식별 정보이며,
// 실제 데이터 보호는 Authentication과 database.rules.json 규칙이 담당합니다.

export const FIREBASE_CONFIG = null;

/* 예시
export const FIREBASE_CONFIG = {
  apiKey: "...",
  authDomain: "PROJECT_ID.firebaseapp.com",
  databaseURL: "https://PROJECT_ID-default-rtdb.REGION.firebasedatabase.app",
  projectId: "PROJECT_ID",
  storageBucket: "PROJECT_ID.firebasestorage.app",
  messagingSenderId: "...",
  appId: "..."
};
*/
