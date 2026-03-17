# Draw Mafia

실시간 멀티플레이 그림 추리 게임입니다.

플레이어는 시민 또는 마피아 역할을 받고, 각자 받은 제시어를 그림으로 표현합니다.
모든 플레이어의 턴이 끝나면 투표로 마피아를 추리하고, 조건에 따라 승패가 결정됩니다.

## 한눈에 보기

- 장르: 턴 기반 실시간 멀티플레이 그림 추리
- 핵심 포인트: 현재 턴 플레이어만 입력 가능 + 전원에게 실시간 공유
- 플랫폼: 웹 (Next.js App Router)
- 실시간 동기화: Firebase Firestore onSnapshot

## 이 프로젝트가 하는 일

- 방 생성/입장과 대기방 동기화
- 시민/마피아 역할 배정
- 시민/마피아 각각 완성형 제시어 지급
- 턴 기반 그림 그리기
- 실시간 그림 공유 + 플레이어별 턴 결과 저장
- 투표 집계, 마피아 최종 추측, 승패 판정

## 게임 진행 흐름

상태 흐름:

waiting -> playing -> voting -> result -> ended

각 상태 설명:

- waiting: 방 생성, 참가자 대기, 방장 설정
- playing: 현재 턴 플레이어만 그림 입력, 다른 플레이어는 실시간 관전
- voting: 생존 플레이어 투표 (최대 60초, 전원 투표 시 즉시 종료)
- result: 탈락 결과 공개, 필요 시 마피아 최종 추측 진행
- ended: 최종 승리 팀 공개

채팅 가능 상태:

- waiting: 가능
- playing: 불가
- voting: 가능
- result: 불가
- ended: 불가

## 제시어 시스템

제시어는 항상 완성형 문구입니다.

- 시민: 행동 + 피사체
- 마피아: 시민 제시어와 유사하지만 다른 행동 + 피사체

예시:

- 시민: 먹는 고양이
- 마피아: 마시는 강아지

데이터 구조는 조합형입니다.

- actionPairs
- subjectPairs
- allowedCategories

이 구조를 통해 카테고리 데이터만 추가해도 제시어 풀을 확장할 수 있습니다.

## 승리 조건

- 동률 또는 넘어가기 최다는 탈락자 없음
- 시민과 마피아 수가 1:1이면 즉시 마피아 승리
- 시민이 마피아를 탈락시키면 마피아에게 20초 최종 추측 기회 제공
- 최종 추측 정답: 마피아 역전 승리
- 최종 추측 오답/시간 초과: 시민 승리

## 기술 스택

- Next.js App Router
- TypeScript
- Tailwind CSS
- Firebase Firestore
- HTML Canvas (직접 구현)
- Zustand

## 로컬 실행

1. 의존성 설치

	npm install

2. 개발 서버 실행

	npm run dev

3. 브라우저 접속

	http://localhost:3000

빌드 확인:

	npm run build

## 환경 변수

프로젝트 루트에 .env.local 파일을 만들고 아래 값을 채워주세요.

	NEXT_PUBLIC_FIREBASE_API_KEY=
	NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
	NEXT_PUBLIC_FIREBASE_PROJECT_ID=
	NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
	NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
	NEXT_PUBLIC_FIREBASE_APP_ID=

모든 값은 Firebase Console의 Web App 설정에서 확인할 수 있습니다.

## 프로젝트 구조

	src/
	  app/                  라우트 페이지
	  components/           캔버스, 모달, 공통 UI
	  constants/            게임 상수, 제시어 데이터
	  firebase/             Firebase 초기화
	  hooks/                게임/입력 관련 훅
	  store/                전역 상태
	  types/                도메인 타입
	  utils/                플레이어, 방 코드, 예외 처리 유틸

## Firestore 핵심 컬렉션

- rooms/{roomId}
- rooms/{roomId}/players
- rooms/{roomId}/drawingsByPlayer
- rooms/{roomId}/votes
- rooms/{roomId}/messages

자세한 스키마는 FIREBASE_SCHEMA.md를 참고하세요.

## 문서

- GAME_DESIGN.md: 최신 게임 규칙 및 UX 원칙
- FIREBASE_SCHEMA.md: Firestore 데이터 구조
- ARCHITECTURE.md: 구조 설계 문서
- TASK_LIST.md: 작업 목록
- copilot-instructions.md: 구현/동기화 규칙