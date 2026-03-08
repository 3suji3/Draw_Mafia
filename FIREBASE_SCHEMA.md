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

# 5. drawingsByPlayer

턴별 플레이어 전용 캔버스 데이터

drawingsByPlayer
└ playerId

---

playerDrawing
{
playerId: string
playerName: string

gameSession: number
round: number
turnOrder: number

strokes: [
	{
		tool: "pen" | "eraser"
		color: string
		size: number
		points: [{x,y}]
		createdAtMs: number
	}
]

createdAt: timestamp
updatedAt: timestamp
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