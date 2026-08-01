# 픽셀 월드 온라인 RPG

2D 픽셀 RPG 프로토타입입니다. 144Hz 모니터에서 `requestAnimationFrame()`을 통해 디스플레이 주사율에 맞춰 렌더링하며, 게임 로직은 144Hz 고정 타임스텝으로 처리합니다.

## 조작법

- `WASD`: 이동
- `Q / E / R`: 스킬 슬롯 — 현재 비어 있음
- `1 / 2 / 3`: 아이템 슬롯 — 현재 비어 있음

## 성능 구조

- 144Hz 고정 업데이트 + 렌더 보간
- 정적 월드 오프스크린 캐싱
- 화면 밖 엔티티 컬링
- 카메라 지수 보간
- 평균 FPS가 낮을 때 내부 렌더 해상도 자동 조절
- Firebase 위치 전송은 초당 20회, 화면 표시는 프레임마다 보간

144 FPS는 브라우저와 모니터가 144Hz 이상을 지원하고, 기기 성능이 충분할 때 표시됩니다. 게임이 모니터 주사율을 강제로 변경할 수는 없습니다.

## Firebase 온라인 연결

1. Firebase 프로젝트와 웹 앱을 생성합니다.
2. Authentication에서 익명 로그인을 활성화합니다.
3. Realtime Database를 생성합니다.
4. `src/config.js`의 `FIREBASE_CONFIG`에 Firebase 구성 객체를 입력합니다.
5. `database.rules.json` 내용을 Realtime Database 규칙에 적용합니다.

Firebase 설정이 없거나 연결에 실패하면 자동으로 오프라인 모드로 실행됩니다.