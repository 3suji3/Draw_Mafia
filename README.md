# 🎨 그림마피아 (Draw Mafia)

실시간 멀티플레이 그림 추리 게임

플레이어들은 그림을 통해 서로의 정체를 추리한다.  
시민은 전체 제시어를 알고 있고, 마피아는 불완전한 제시어만 받는다.

그림을 그리며 서로의 정체를 추리하고  
투표를 통해 마피아를 찾아내는 게임이다.

---

# 🕹️ 게임 규칙

### 플레이어 수
- 최소 3명
- 최대 10명
- 테스트 모드에서는 1명 가능

### 역할
- 시민
- 마피아

### 제시어 시스템

제시어는 다음 형태로 구성된다.

행동 + 피사체

예시

먹는 고양이
자는 강아지
뛰는 사람

시민은 전체 제시어를 받는다.

먹는 고양이

마피아는 아래 중 하나만 받는다.

먹는
또는
고양이

---

# 🎮 게임 흐름

대기방
↓
게임 시작
↓
역할 배정
↓
그림 그리기
↓
투표
↓
결과 공개
↓
다음 라운드 또는 게임 종료

---

# 🧰 기술 스택

Frontend
- Next.js
- TypeScript
- Tailwind CSS

State Management
- Zustand

Backend
- Firebase
- Firestore 또는 Realtime Database

Canvas
- HTML Canvas API

UI
- shadcn/ui

---

# 📁 프로젝트 구조

root
├ src
│  ├ app
│  ├ components
│  ├ hooks
│  ├ store
│  ├ firebase
│  ├ types
│  ├ utils
│  └ constants
│
├ copilot-instructions.md
├ GAME_DESIGN.md
├ FIREBASE_SCHEMA.md
├ ARCHITECTURE.md
├ TASK_LIST.md

---

# ⚙️ 설치 방법

### 1. 프로젝트 클론

git clone <repo-url>
cd draw-mafia

---

### 2. 패키지 설치

npm install

---

### 3. 환경변수 설정

`.env.local` 파일 생성

cp .env.example .env.local

Firebase 콘솔에서 받은 값 입력

---

### 4. 개발 서버 실행

npm run dev

브라우저에서

[http://localhost:3000](http://localhost:3000)

접속

---

# 🔥 Firebase 설정

Firebase 콘솔에서 다음 작업이 필요하다.

1️⃣ Firebase 프로젝트 생성

2️⃣ Web App 등록

3️⃣ Firestore 또는 Realtime Database 활성화

4️⃣ Authentication 설정 (선택)

---

# ⚠️ 주의

`.env.local` 파일은 절대 GitHub에 업로드하면 안 된다.

---

# 🚀 향후 기능

- AI 플레이어
- 그림 리플레이
- 모바일 최적화
- 사운드 효과
- 방 비밀번호
- 랭킹 시스템

---

# 🤖 AI 개발 규칙

이 프로젝트는 다음 문서를 기준으로 개발된다.

- copilot-instructions.md
- GAME_DESIGN.md
- FIREBASE_SCHEMA.md
- ARCHITECTURE.md
- TASK_LIST.md

AI는 이 문서를 참고하여 코드를 생성해야 한다.

---