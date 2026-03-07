# SYSTEM ARCHITECTURE
## Project: Draw Mafia

---

# 1. Architecture Overview

Client
↓
Next.js
↓
Firebase

---

# 2. 주요 컴포넌트

Home
Room
Game
Canvas
Vote
Result

---

# 3. 상태 관리

Zustand 사용

gameStore

관리 상태

player
room
gameState
turn
votes
canvas

---

# 4. Game State

게임 상태는 아래 enum으로 관리

waiting
playing
voting
result
ended

---

# 5. Page Structure

/
홈

/room/[roomId]
대기방

/game/[roomId]
게임

---

# 6. 주요 컴포넌트 구조

components
├ canvas
│   ├ CanvasBoard
│   └ useCanvas
│
├ room
│   ├ PlayerList
│   └ RoomControls
│
├ game
│   ├ TurnIndicator
│   ├ VotePanel
│   └ ResultModal
│
└ modals
└ GameModal

---

# 7. Canvas Architecture

Canvas는

stroke 기반

데이터 저장

points[]

로 저장

---

# 8. Sync Strategy

Canvas

stroke 단위 저장

게임 상태

room document

---

# 9. Turn System

turnIndex
+
turnOrder

조합

---

# 10. Vote System

votes collection

→ 결과 계산

---

# 11. UI System

알림

Dialog modal

사용

---

# 12. Performance

Canvas 데이터

stroke batch

저장

---

# 13. Future Expansion

향후 기능

- AI 플레이어
- 리플레이
- 그림 저장
- 모바일 최적화

---

# 📦 최종 프로젝트 구조

이렇게 두면 된다.
root
 ├ copilot-instructions.md
 ├ GAME_DESIGN.md
 ├ FIREBASE_SCHEMA.md
 ├ ARCHITECTURE.md
 ├ README.md
 ├ package.json
 └ src

---