# Copilot Instructions – 그림마피아 (Draw Mafia)

## 1. 프로젝트 목표

이 프로젝트는 Firestore 기반 실시간 멀티플레이 그림 추리 게임이다. 반드시 현재 실제 게임 규칙과 문서를 일치시키는 방향으로 작업한다.

핵심 목표:

- 방 생성 / 방 입장
- 실시간 대기방 동기화
- 시민 / 마피아 역할 분배
- PromptPair 기반 완성형 제시어 시스템
- 턴 기반 그림판
- 실시간 그림 공유
- 플레이어별 턴 그림 저장
- 투표 / 결과 / 승패 판정

## 2. 기술 스택

- Next.js App Router
- TypeScript
- Tailwind CSS
- Firebase Firestore
- HTML Canvas 직접 구현
- Radix Dialog 기반 모달 UI

주의:

- Realtime Database를 전제로 가정하지 않는다.
- Canvas 라이브러리(Fabric.js, Konva 등)로 임의 교체하지 않는다.

## 3. 반드시 지켜야 할 게임 규칙

### 3-1. 제시어 규칙

- 시민: `행동 + 피사체`
- 마피아: 시민 제시어와 유사하지만 다른 `행동 + 피사체`
- 마피아에게 행동만 또는 피사체만 주는 부분 힌트 규칙은 사용하지 않는다.

### 3-2. 그림판 규칙

- 현재 턴 플레이어만 입력 가능
- 다른 플레이어는 현재 그려지는 과정을 실시간으로 본다
- stroke는 플레이어별 `drawingsByPlayer` 문서에 누적 저장된다
- 턴 종료 후 그 문서가 해당 플레이어의 라운드 결과 그림으로 남는다

### 3-3. 시간 규칙

- draw time: 30초 또는 60초
- vote time: 최대 60초 (전원 투표 완료 시 즉시 종료)
- mafia guess time: 20초

### 3-4. 채팅 규칙

채팅은 게임 상태에 따라 활성/비활성이 결정된다.

- `waiting`: 채팅 가능
- `playing`: 채팅 불가 (그림 그리는 단계)
- `voting`: 채팅 가능
- 그 외 상태: 채팅 불가

`ChatPanel` 컴포넌트의 `isEnabled` prop으로 제어한다. 비활성 상태에서는 입력창과 이모지 버튼이 비활성화되고 안내 문구가 표시된다.

## 4. 데이터 구조 규칙

### room.prompt

반드시 `PromptPair` 구조를 사용한다.

```ts
type PromptPair = {
  citizenAction: string;
  mafiaAction: string;
  citizenSubject: string;
  mafiaSubject: string;
  category: string;
};
```

### prompt source data

- `ACTION_PAIRS`
- `SUBJECT_PAIRS`
- `allowedCategories`
- `getRandomPromptPair()`

무작정 완성형 pair를 나열하는 것보다 조합 가능한 데이터 구조를 우선한다.

## 5. 문서 동기화 규칙

아래 파일 중 하나의 규칙 설명을 바꾸면 나머지도 함께 확인한다.

- `README.md`
- `copilot-instructions.md`
- `GAME_DESIGN.md`
- `FIREBASE_SCHEMA.md`
- `ARCHITECTURE.md`
- `TASK_LIST.md`

특히 아래 문구는 문서마다 동일한 의미를 유지해야 한다.

- 상태 흐름: `waiting -> playing -> voting -> result -> ended`
- 그림판 구조: `실시간 공유 + 턴별 저장`
- 제시어 규칙: `시민/마피아 모두 완성형 제시어`

## 6. 구현 원칙

- 실제 코드 구조를 먼저 읽고 수정한다.
- 필요 없는 전면 리디자인이나 구조 갈아엎기는 하지 않는다.
- Firestore 구조를 불필요하게 크게 바꾸지 않는다.
- 현재 코드가 사용하는 흐름과 문서를 맞춘다.
- 대량 데이터 확장은 유지보수 가능한 형태로 작성한다.

## 7. UI / 입력 원칙

- 모바일에서도 캔버스, 타이머, 투표 UI가 동작해야 한다.
- 캔버스는 pointer 기반 입력을 우선한다.
- 버튼 텍스트는 작은 화면에서도 줄바꿈되지 않게 유지한다.
- 시스템 피드백은 모달, 토스트, 인라인 상태 UI로 처리하고 `alert()`는 사용하지 않는다.

alert() 사용 금지

모든 알림은 **중앙 모달**로 구현한다.

예시

- 게임 시작 안내
- 투표 결과
- 탈락자 공개
- 승리 화면

---

# 10. 코드 스타일

AI는 아래 규칙을 따라야 한다.

### TypeScript strict

모든 데이터 타입 정의

types/

폴더에 작성

---

### React 규칙

- Client Component 명확히 표시
- 상태는 Zustand 사용
- 비즈니스 로직은 hooks 분리

---

### 컴포넌트 분리

Canvas 로직은 반드시 별도 컴포넌트로 작성

components/canvas

---

# 11. 성능 규칙

Canvas 데이터는 너무 자주 저장하지 않는다.

stroke 단위로 저장한다.

---

# 12. AI 코드 생성 규칙

AI는 아래 규칙을 반드시 따른다.

❌ 하지 말 것

- 전체 프로젝트 코드를 한 번에 생성
- 구조를 임의로 변경
- Firebase 구조 변경
- alert 사용
- 불필요한 라이브러리 추가

✔ 해야 할 것

- 단계별 코드 생성
- 파일 역할 설명
- 초보자가 이해할 수 있는 설명

---

# 13. MVP 범위

첫 구현 단계는 다음 기능만 포함한다.

- 닉네임 입력
- 방 생성
- 방 입장
- 플레이어 목록 표시
- 방장 표시
- 방장만 Start 버튼 가능

---

# 14. 확장 기능

다음 기능은 MVP 이후 구현

- 그림판
- 턴 시스템
- 투표 시스템
- 승패 판정
- 애니메이션
- 사운드

---

# 15. AI 응답 형식

AI는 항상 다음 형식으로 답변한다.


1. 구현 목표
2. 변경될 파일 목록
3. 각 파일 역할
4. 코드
5. 실행 방법
6. 다음 단계