# Draw Mafia

실시간 멀티플레이 그림 추리 게임입니다.

플레이어는 시민 또는 마피아 역할을 받고, 각자 받은 제시어를 그림으로 표현합니다.
모든 턴이 끝나면 투표로 마피아를 추리하고, 조건에 따라 승패가 결정됩니다.

## 🎯 한눈에 보기

- 장르: 턴 기반 실시간 멀티플레이 그림 추리
- 핵심 포인트: 내 턴에만 입력 가능, 전원은 실시간 관전
- 플레이 인원: 기본 3-10명 (테스트 모드 1명 허용)
- 실시간 엔진: Firebase Firestore onSnapshot

## ✨ 주요 기능

- 방 생성/입장, 대기방 실시간 동기화
- 시민/마피아 역할 자동 배정
- 시민/마피아 완성형 제시어 지급
- 턴 기반 캔버스 입력 및 실시간 공유
- 투표 집계, 최종 추측, 승리 판정

## 🎮 게임 흐름

상태 흐름:

`waiting -> playing -> voting -> result -> ended`

| 상태 | 설명 |
|---|---|
| waiting | 플레이어 입장 대기, 방장 설정 |
| playing | 현재 턴 플레이어만 그림 입력 |
| voting | 생존 플레이어 투표 (최대 60초, 전원 투표 시 즉시 종료) |
| result | 탈락 결과 공개, 필요 시 마피아 최종 추측 진행 |
| ended | 최종 승리 팀 공개 |

채팅 가능 상태:

- ✅ waiting
- ❌ playing
- ✅ voting
- ❌ result
- ❌ ended

## 🧩 제시어 시스템

제시어는 항상 완성형 문구입니다.

- 시민: 행동 + 피사체
- 마피아: 시민 제시어와 유사하지만 다른 행동 + 피사체

예시:

- 시민: 운전하는 택시
- 마피아: 조종하는 비행기

**필터링 기반 선택:**

액션을 선택하면, 해당 액션의 `allowedCategories`에 포함된 피사체만 선택되므로, 문법적으로 자연스럽고 시민과 마피아의 제시어가 유사합니다.

🧠 제시어 품질 기준:

- 실제 한국어 문맥에서 자연스럽게 읽히는 조합 우선
- 행동과 피사체의 역할이 어색한 조합은 데이터 검증으로 제외
- 쉬운 단어 중심으로 데이터 확장

**데이터 구조:**

조합형으로 관리합니다.

- `actionPairs`: 51개 (시민 액션 / 마피아 액션 + 허용 카테고리)
- `subjectPairs`: 230개 (13개 카테고리 × 약 18개 쌍)
  - 기본: 동물, 사람, 직업
  - 생활: 탈것, 스포츠, 학용품, 음식, 물건, 생활용품, 의류/패션
  - 환경: 장소, 자연
  - 신규: 위인 (이순신, 세종대왕, 나폴레옹 등)

**최대 조합수:** 51개 × 평균 ~18개 = **약 7,360+** 자연스러운 제시어 조합

## 🏆 승리 조건

- 동률 또는 넘어가기 최다 득표면 탈락자 없음
- 시민과 마피아 수가 1:1이면 즉시 마피아 승리
- 시민이 마피아를 탈락시키면 마피아에게 20초 최종 추측 기회 제공
- 최종 추측 정답: 마피아 역전 승리
- 최종 추측 오답/시간 초과: 시민 승리

## 🛠 기술 스택

프론트엔드:

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- Zustand

백엔드/실시간 데이터:

- Firebase Firestore

캔버스/입력:

- HTML Canvas 직접 구현
- Pointer Event 기반 드로잉

오디오/테마:

- HTML5 Audio API
- 테마별 배경음악 지원 (라이트 모드: S*, 다크 모드: O* 파일명 매핑)

배포/런타임:

- Node.js
- Next.js Production Build

## 🚀 빠른 시작

1. 의존성 설치

```bash
npm install
```

2. 개발 서버 실행

```bash
npm run dev
```

3. 브라우저 접속

```text
http://localhost:3000
```

빌드 확인:

```bash
npm run build
```

## 🔐 환경 변수

프로젝트 루트에 `.env.local` 파일을 만들고 아래 값을 채워주세요.

```env
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

모든 값은 Firebase Console의 Web App 설정에서 확인할 수 있습니다.

## 📁 프로젝트 구조

```text
src/
  app/                  라우트 페이지
  components/           캔버스, 모달, 공통 UI
  constants/            게임 상수, 제시어 데이터
  firebase/             Firebase 초기화
  hooks/                게임/입력 관련 훅
  store/                전역 상태
  types/                도메인 타입
  utils/                플레이어, 방 코드, 예외 처리 유틸
```

## 🗂 Firestore 핵심 컬렉션

- `rooms/{roomId}`
- `rooms/{roomId}/players`
- `rooms/{roomId}/drawingsByPlayer`
- `rooms/{roomId}/votes`
- `rooms/{roomId}/messages`

자세한 스키마는 `FIREBASE_SCHEMA.md`를 참고하세요.

## 📚 추가 문서

- `GAME_DESIGN.md`: 최신 게임 규칙 및 UX 원칙
- `FIREBASE_SCHEMA.md`: Firestore 데이터 구조
- `ARCHITECTURE.md`: 구조 설계 문서
- `TASK_LIST.md`: 작업 목록
- `copilot-instructions.md`: 구현/동기화 규칙