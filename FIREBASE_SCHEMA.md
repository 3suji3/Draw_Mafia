# FIREBASE DATA SCHEMA
## Project: Draw Mafia

---

# 1. rooms

rooms
└ roomId

---

# 2. room 구조

room
{
id: string
hostId: string
status: "waiting" | "playing" | "voting" | "result" | "ended"

maxPlayers: number

drawTime: number
voteTime: number

round: number

turnIndex: number

turnOrder: string[]

prompt:
{
action: string
subject: string
}

mafiaId: string

}

---

# 3. players

players
└ playerId

---

# 4. player 구조

player
{
id: string
nickname: string

role: "citizen" | "mafia"

alive: boolean

isHost: boolean

joinedAt: timestamp
}

---

# 5. drawings

Canvas 데이터

drawings
└ strokeId

---

stroke
{
playerId: string

tool: "pen" | "eraser"

color: string

size: number

points: [{x,y}]

createdAt: timestamp
}

---

# 6. votes

votes
└ playerId

---

vote
{
voterId: string
targetId: string
}

targetId

playerId
또는
skip

---

# 7. derived states

클라이언트에서 계산

alivePlayers
voteResult
isGameEnd

---