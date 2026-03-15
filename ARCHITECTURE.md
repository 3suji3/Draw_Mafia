# SYSTEM ARCHITECTURE

## 1. 아키텍처 개요

```text
Browser Client
	-> Next.js App Router
	-> Firebase Firestore
```

이 프로젝트는 서버 권한 계산보다 클라이언트 주도 실시간 동기화가 중심인 구조다. 게임 상태는 Firestore 문서와 컬렉션에 저장되고, 각 화면은 필요한 데이터를 `onSnapshot`으로 구독한다.

## 2. 주요 라우트

- `/`: 닉네임 입력, 방 생성, 방 입장
- `/room/[roomId]`: 대기방, 플레이어 목록, draw time 설정, 시작 준비
- `/game/[roomId]`: 실제 게임 진행, 캔버스, 투표, 결과

## 3. 상태 관리 방식

현재 실제 구현은 전역 Zustand store 중심이 아니라 페이지 컴포넌트 내부 상태와 Firestore 구독을 조합하는 방식이다.

- Firestore snapshot -> 원본 상태
- `useMemo` -> 파생 상태 계산
- `useRef` -> 타이머 중복 실행 방지, 자동 진행 보호
- local state -> 입력 UI, 토스트, 모달, 낙관적 stroke 반영

## 4. 게임 상태 모델

게임 상태는 아래 다섯 단계로 관리된다.

- `waiting`
- `playing`
- `voting`
- `result`
- `ended`

## 5. Canvas 아키텍처

Canvas는 HTML Canvas 직접 구현이다.

- 입력 처리: pointer events
- 저장 단위: stroke 배열
- stroke 내부 좌표: `points[]`
- 도구: `pen`, `eraser`

`CanvasBoard`는 렌더링만 담당하고, 게임 페이지는 현재 턴 플레이어와 현재 라운드에 맞는 stroke 집합을 계산해 전달한다.

## 6. 실시간 공유 + 턴별 저장 구조

이 프로젝트의 가장 중요한 구조적 특징은 아래와 같다.

- 현재 턴 플레이어만 입력 가능
- 그리는 도중 추가된 stroke는 즉시 Firestore에 누적 저장
- 다른 플레이어는 `drawingsByPlayer` 구독으로 실시간 관찰
- 턴 종료 시 해당 문서가 그 플레이어의 라운드 결과로 남음
- 다음 플레이어는 새로운 빈 캔버스에서 시작

즉, `실시간 전송용 상태`와 `최종 결과 저장용 상태`를 별도 시스템으로 나누지 않고 `drawingsByPlayer` 문서가 둘 다 맡는다.

## 7. Prompt 데이터 파이프라인

제시어는 아래 계층으로 관리한다.

```text
ACTION_PAIRS
	+ SUBJECT_PAIRS
	+ allowedCategories
	-> PROMPT_PAIRS
	-> getRandomPromptPair()
```

이 구조는 카테고리별 데이터만 추가해도 제시어 풀이 빠르게 늘어나는 장점이 있다. 문서와 코드 모두 `부분 힌트 규칙 없음`, `시민/마피아 모두 완성형 제시어 지급` 기준으로 통일한다.

## 8. 동기화 전략

- room document: 상태, 턴, 라운드, 승패
- players subcollection: 참가자와 생존 상태
- drawingsByPlayer subcollection: 실시간 그림 공유 + 결과 저장
- votes subcollection: 실시간 투표 현황

네트워크 지연이나 중복 실행 방지는 클라이언트에서 토스트, 보호 ref, 재시도 로직으로 보완한다.

## 9. 결과 표시 구조

- `playing`: 현재 턴 캔버스 중심 표시
- `voting`, `result`: 플레이어별 그림을 캐러셀처럼 넘겨 보며 비교
- `ended`: 승리 팀, 승리자, 시민/마피아 제시어 공개

## 10. 문서 동기화 원칙

아래 문서는 항상 같은 규칙을 공유해야 한다.

- `README.md`
- `copilot-instructions.md`
- `GAME_DESIGN.md`
- `FIREBASE_SCHEMA.md`
- `ARCHITECTURE.md`
- `TASK_LIST.md`

특히 PromptPair 규칙, 투표 시간, 마피아 정답 입력 시간, 실시간 공유 + 턴별 저장 구조 설명은 서로 달라지면 안 된다.