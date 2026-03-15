# Draw Mafia

실시간 멀티플레이 그림 추리 게임이다. 각 플레이어는 시민 또는 마피아 역할을 받고, 시민과 마피아는 서로 헷갈릴 수 있도록 유사하지만 다른 완성형 제시어를 받는다.

이 프로젝트의 실제 게임 구조는 다음 두 가지를 동시에 만족한다.

- 그림 입력은 현재 턴 플레이어만 가능하다.
- 하지만 그 플레이어가 그리는 과정은 다른 플레이어에게도 실시간으로 공유된다.

## 프로젝트 개요

Draw Mafia는 방 생성 후 여러 명이 같은 게임 세션에 참여하고, 각자 한 번씩 그림을 그린 다음 투표로 마피아를 찾아내는 턴 기반 실시간 게임이다. 프론트엔드는 Next.js App Router, 실시간 동기화는 Firebase Firestore, 그림판은 HTML Canvas 직접 구현을 사용한다.

## 게임 규칙 요약

- 플레이어 수는 기본 3명 이상 10명 이하이며, 테스트 모드에서는 1명 시작도 허용한다.
- 역할은 시민과 마피아로 나뉜다.
- 그림 그리기 순서는 게임 시작 시 무작위로 정해진다.
- 현재 턴 플레이어만 입력할 수 있다.
- 모든 생존 플레이어가 그림을 완료하면 투표 단계로 넘어간다.
- 동률 또는 넘어가기 최다가 아니면 최다 득표자가 탈락한다.
- 시민이 마피아를 탈락시키면 마피아는 시민 제시어를 맞힐 마지막 기회를 가진다.
- 투표 시간은 30초, 마피아 정답 입력 시간은 20초다.

## 시민/마피아 제시어 시스템 설명

제시어는 항상 완성형 문장 조각 두 개로 구성된다.

- 시민: 행동 + 피사체
- 마피아: 시민 제시어와 유사하지만 다른 행동 + 피사체

예시:

- 시민: 먹는 고양이
- 마피아: 마시는 강아지

현재 데이터 구조는 완성형 pair를 무한히 직접 적는 방식이 아니라 `actionPairs`와 `subjectPairs`를 분리한 뒤 카테고리 호환 규칙으로 조합을 생성하는 방식이다. 이 구조 덕분에 카테고리별 데이터만 더 넣으면 제시어 풀을 크게 늘릴 수 있다.

## 방 생성 / 방 입장 흐름

1. 홈 화면에서 닉네임을 입력한다.
2. `방 만들기`를 누르면 room document와 host player document가 Firestore에 생성된다.
3. `방 입장`을 누르면 방 코드 유효성, 정원, 중복 닉네임, 게임 상태를 확인한 뒤 player document를 추가한다.
4. 대기방에서는 플레이어 목록과 draw time 설정을 실시간으로 본다.
5. 방장이 시작 버튼을 누르면 역할, 제시어, 턴 순서가 생성되고 게임 화면으로 이동한다.

## 게임 시작 후 상태 흐름 설명

상태는 아래 순서로 진행된다.

`waiting -> playing -> voting -> result -> ended`

- `waiting`: 플레이어 입장 대기, 방장 설정 가능
- `playing`: 현재 턴 플레이어가 그림을 입력하고 모두가 그 과정을 실시간으로 본다
- `voting`: 생존 플레이어가 마피아로 의심되는 대상을 투표한다
- `result`: 탈락 결과를 공개하고, 필요하면 마피아 정답 입력을 진행한다
- `ended`: 승리 팀과 최종 결과를 보여준다

## 그림판 동작 방식 설명

그림판은 HTML Canvas 직접 구현이다. Fabric.js나 Konva를 사용하지 않는다.

- 입력 이벤트는 pointer 기반으로 처리한다.
- stroke는 `tool`, `color`, `size`, `points[]`, `createdAtMs` 형태로 저장된다.
- `points[]`에는 드래그 중 보간된 좌표가 들어가므로 선이 끊기지 않게 이어진다.
- 현재 턴 플레이어만 입력 가능하다.
- 다른 플레이어는 같은 `drawingsByPlayer` 문서를 실시간 구독해 그려지는 과정을 본다.

핵심은 `실시간 공유`와 `턴별 저장`이 동시에 존재한다는 점이다.

- 플레이어가 그리는 동안 stroke가 Firestore에 누적 저장된다.
- 다른 플레이어는 `onSnapshot`으로 그 업데이트를 바로 반영한다.
- 턴이 끝나면 그 플레이어의 canvas 문서가 해당 라운드의 최종 그림 결과로 남는다.
- 다음 플레이어는 새 빈 canvas에서 시작한다.
- 모든 턴이 끝난 뒤에는 플레이어별 결과 그림을 캐러셀 형태로 다시 확인할 수 있다.

## 실시간 동기화가 어떤 식으로 일어나는지 설명

실시간 동기화는 Firestore의 문서/컬렉션 구독으로 처리한다.

- `rooms/{roomId}`: 현재 게임 상태, 턴, 타이머 기준 정보
- `rooms/{roomId}/players`: 참가자 목록, 생존 여부, 역할 배정 결과
- `rooms/{roomId}/drawingsByPlayer`: 플레이어별 stroke 누적 데이터
- `rooms/{roomId}/votes`: 투표 데이터

게임 화면에서는 `room`, `players`, `drawingsByPlayer`, `votes`를 각각 `onSnapshot`으로 구독한다. 따라서 현재 턴 플레이어가 stroke를 추가하면 다른 플레이어도 거의 즉시 같은 그림 변화를 본다.

## Firebase가 어떤 역할을 하는지 설명

Firebase Firestore는 이 프로젝트의 실시간 멀티플레이 상태 저장소다.

- 방 생성, 입장, 종료 처리
- 플레이어 역할 및 생존 상태 관리
- 턴 순서와 게임 상태 전환
- 플레이어별 그림 stroke 저장 및 실시간 전파
- 투표 저장과 집계용 데이터 제공

이 프로젝트는 현재 Firestore를 사용하며 Realtime Database는 사용하지 않는다.

## 로컬 실행 방법

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:3000`으로 접속한다.

프로덕션 빌드 확인:

```bash
npm run build
```

## 환경변수 설명

`.env.local`에 아래 값을 설정해야 한다.

```env
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

모든 값은 Firebase Console의 Web App 설정에서 가져온다.

## 주요 디렉터리

```text
src/
	app/                  라우트 페이지
	components/           캔버스, 모달, 공통 UI
	constants/            게임 상수 및 제시어 데이터
	firebase/             Firebase 초기화
	types/                도메인 타입
	utils/                플레이어, 방 코드, 예외 처리 유틸
```

## 함께 보는 문서

- `copilot-instructions.md`
- `GAME_DESIGN.md`
- `FIREBASE_SCHEMA.md`
- `ARCHITECTURE.md`
- `TASK_LIST.md`