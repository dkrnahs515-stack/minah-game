# Firebase 배포 및 온라인 연결

이 프로젝트는 Firebase Hosting, Authentication 익명 로그인, Realtime Database를 사용합니다.

## 1. Firebase 프로젝트 만들기

1. Firebase Console에서 새 프로젝트를 생성합니다.
2. 프로젝트 설정에서 웹 앱(`</>`)을 등록합니다.
3. 표시되는 `firebaseConfig` 객체를 복사합니다.

## 2. 익명 로그인 활성화

Authentication > 로그인 방법에서 `익명` 제공업체를 활성화합니다.

## 3. Realtime Database 만들기

1. Realtime Database에서 데이터베이스를 생성합니다.
2. 앱과 가까운 위치를 선택합니다.
3. 데이터베이스 URL을 확인합니다.
4. `src/firebase-config.js`의 `FIREBASE_CONFIG`에 `databaseURL`을 포함한 전체 설정 객체를 입력합니다.

## 4. 프로젝트 ID 연결

`.firebaserc.example`을 `.firebaserc`로 복사하고 `YOUR_FIREBASE_PROJECT_ID`를 실제 프로젝트 ID로 변경합니다.

## 5. 로컬 테스트

```bash
npm install -g firebase-tools
firebase login
firebase emulators:start
```

브라우저에서 `http://localhost:5000`으로 접속합니다.

## 6. 배포

Hosting과 Realtime Database 규칙을 함께 배포합니다.

```bash
firebase deploy --only hosting,database
```

배포 후 게임 주소는 일반적으로 다음 두 주소로 제공됩니다.

- `https://PROJECT_ID.web.app`
- `https://PROJECT_ID.firebaseapp.com`

## 현재 온라인 구조

- 익명 인증으로 플레이어별 UID 발급
- `rooms/public/players/{uid}`에 위치와 방향 저장
- 위치는 초당 최대 20회 전송
- 원격 캐릭터는 보간하여 부드럽게 표시
- 접속 종료 시 `onDisconnect().remove()`로 플레이어 데이터 삭제
- `database.rules.json`에서 본인 데이터만 수정 가능
