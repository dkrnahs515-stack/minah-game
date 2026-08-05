# Firebase 배포 및 온라인 연결

Firebase 프로젝트: `pixel-world-8cb9b`

이 프로젝트는 Firebase Hosting, Authentication 익명 로그인, Realtime Database를 사용합니다.

## 현재 완료된 설정

- Firebase 웹 앱 설정 연결
- `.firebaserc` 프로젝트 별칭 연결
- `firebase.json` Hosting 및 Database 규칙 설정
- Firebase Hosting GitHub Actions 워크플로 추가
- 익명 인증 및 Realtime Database 클라이언트 코드 구현
- 원격 플레이어 위치 보간 및 접속 종료 자동 삭제 구현

## 1. 익명 로그인 활성화

Firebase Console에서 다음 경로로 이동합니다.

`Authentication > Sign-in method > Anonymous > Enable`

## 2. Realtime Database 만들기

1. `Build > Realtime Database > Create Database`로 이동합니다.
2. 앱 이용자와 가까운 리전을 선택합니다.
3. 잠금 모드로 생성합니다.
4. 생성된 Database URL을 복사합니다.
5. `src/firebase-config.js`의 빈 `databaseURL` 값에 붙여 넣습니다.

예시 형식:

```js
databaseURL: "https://pixel-world-8cb9b-default-rtdb.REGION.firebasedatabase.app"
```

## 3. Database 보안 규칙 배포

저장소의 `database.rules.json`을 Firebase Console의 Realtime Database `Rules` 탭에 붙여 넣고 게시하거나 Firebase CLI로 배포합니다.

```bash
firebase deploy --only database
```

## 4. Firebase Hosting 자동 배포 연결

워크플로 파일:

`.github/workflows/firebase-hosting-merge.yml`

필요한 GitHub Actions Secret:

`FIREBASE_SERVICE_ACCOUNT_PIXEL_WORLD_8CB9B`

Firebase CLI에서 아래 명령을 실행하면 GitHub 저장소 연결, 서비스 계정 생성, Secret 등록 과정을 자동으로 진행할 수 있습니다.

```bash
firebase login
firebase init hosting:github
```

저장소는 `dkrnahs515-stack/pixel_world`, 배포 브랜치는 `main`을 선택합니다.

## 5. 수동 배포

Firebase CLI가 설치된 컴퓨터에서 저장소 루트 기준으로 실행합니다.

```bash
npm install -g firebase-tools
firebase login
firebase use pixel-world-8cb9b
firebase deploy --only hosting,database
```

배포 주소:

- `https://pixel-world-8cb9b.web.app`
- `https://pixel-world-8cb9b.firebaseapp.com`

## 온라인 구조

- 익명 인증으로 플레이어별 UID 발급
- `rooms/public/players/{uid}`에 위치, 방향과 현재 `mapId` 저장
- 위치는 초당 최대 20회 전송
- 같은 `mapId`에 있는 원격 캐릭터만 보간하여 부드럽게 표시
- 이전 데이터에 `mapId`가 없으면 중앙 마을(`village`)로 처리
- 접속 종료 시 `onDisconnect().remove()`로 플레이어 데이터 삭제
- `database.rules.json`에서 본인 데이터만 수정 가능

지역 ID는 `village`, `volcano`, `forest`, `coast`만 허용됩니다. 보안 규칙은 중앙 마을 좌표를 `2,880 × 1,800`, 외부 지역 좌표를 `4,320 × 3,600` 안으로 제한합니다. 월드 확장 코드를 배포할 때 갱신된 `database.rules.json`도 함께 게시해야 온라인 이동이 거부되지 않습니다.
