# Hunting Reward and Render Stability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 모든 몬스터 처치 보상을 `3 EXP + 1~3 Gold`로 통일하고 Canvas 깜빡임 원인을 제거해 Pages에 배포한다.

**Architecture:** 순수 진행도 모듈이 공통 사냥 보상을 계산하고 게임 오케스트레이터가 퀘스트 진행과 보상 저장을 분리한다. 메인 Canvas는 브라우저의 동기화된 합성 경로를 사용한다.

**Tech Stack:** JavaScript ES modules, HTML Canvas 2D, Node test runner, GitHub Pages

## Global Constraints

- 모든 현재 몬스터 처치는 정확히 `3 EXP`와 `1~3 Gold`를 지급한다.
- 퀘스트 진행은 활성 퀘스트의 슬라임 처치에만 적용한다.
- 기존 localStorage v2 데이터 형식을 변경하지 않는다.
- 한 공격의 다중 처치는 상태를 한 번만 저장한다.

---

### Task 1: 공통 사냥 Gold 보상

**Files:**
- Modify: `tests/game-progression.test.mjs`
- Modify: `src/player-progression.js`
- Modify: `src/game.js`

**Interfaces:**
- Consumes: `grantHuntingReward(progress, options)`, `PixelRPG.recordEnemyKill(enemyKind)`
- Produces: 모든 몬스터에 `{ rewardExp: 3, rewardGold: 1..3 }`

- [ ] **Step 1: 퀘스트 미수락 멧돼지 처치가 Gold를 지급하는 실패 테스트 작성**

```js
assert.equal(game.progress.exp, 3);
assert.equal(game.progress.gold, 1);
assert.equal(game.progress.quests.adventureStart.status, "available");
assert.deepEqual(notifications, ["몬스터 처치! EXP +3 · Gold +1"]);
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `node --test tests/game-progression.test.mjs`

Expected: 멧돼지 처치 Gold가 `0`이어서 실패한다.

- [ ] **Step 3: 공통 사냥 보상이 Gold를 항상 추첨하도록 최소 구현**

`grantHuntingReward`가 몬스터 종류와 관계없이 `rollSlimeGold`와 동일한 `1..3` 정수 추첨을 사용하게 하고, 게임 알림에 Gold를 표시한다.

- [ ] **Step 4: 집중 테스트와 전체 테스트 실행**

Run: `node --test tests/game-progression.test.mjs tests/player-progression.test.mjs`

Run: `node --test tests/*.test.mjs tests/quest-ui-smoke.cjs`

- [ ] **Step 5: 변경 커밋**

```bash
git add src/player-progression.js src/game.js tests/game-progression.test.mjs
git commit -m "모든 몬스터 사냥 골드 지급"
```

### Task 2: PR, 병합, Pages 검증

**Files:**
- Verify: GitHub PR changed files and mergeability
- Verify: `https://dkrnahs515-stack.github.io/pixel_world/`

**Interfaces:**
- Consumes: 검증된 기능 브랜치
- Produces: `main` 병합 커밋과 Pages 실배포 결과

- [ ] **Step 1: 문법·전체 테스트·diff 검사**

Run: `node --check src/game.js && node --check src/player-progression.js`

Run: `node --test tests/*.test.mjs tests/quest-ui-smoke.cjs`

Run: `git diff origin/main...HEAD --check`

- [ ] **Step 2: 브랜치 게시와 PR 생성**

PR 본문에 경험치 누락과 Canvas 깜빡임의 원인, 수정 범위, 테스트 결과를 기록한다.

- [ ] **Step 3: PR 검증 후 `main` 병합**

변경 파일, mergeability, 상태 검사를 확인한 뒤 squash merge한다.

- [ ] **Step 4: Pages 실플레이**

배포된 코드에서 신규 Canvas 설정과 HUD를 확인하고, 가능한 범위에서 실제 이동·공격·재입장을 점검한다.
