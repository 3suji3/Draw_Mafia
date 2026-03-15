# FIREBASE DATA SCHEMA

## 1. 상위 컬렉션 구조

```text
rooms/
	{roomId}/
		players/
		drawingsByPlayer/
		votes/
		messages/
```

이 프로젝트는 Firestore를 사용한다. 실시간 업데이트는 각 문서/컬렉션을 `onSnapshot`으로 구독하는 방식으로 처리한다.

## 2. room document

```ts
type Room = {
	id: string;
	hostId: string;
	status: "waiting" | "playing" | "voting" | "result" | "ended";
	maxPlayers: number;
	drawTime: number;
	voteTime: number;
	gameSession?: number;
	round: number;
	turnIndex: number;
	turnOrder: string[];
	prompt: {
		citizenAction: string;
		mafiaAction: string;
		citizenSubject: string;
		mafiaSubject: string;
		category: string;
	};
	mafiaId: string;
	eliminatedPlayerId?: string | null;
	eliminatedRole?: "citizen" | "mafia" | null;
	resultMessage?: string;
	winner?: "citizen" | "mafia" | null;
	awaitingMafiaGuess?: boolean;
	endedByHostLeave?: boolean;
};
```

설명:

- `status`: 현재 게임 단계
- `drawTime`: 대기방에서 선택하는 그림 시간
- `voteTime`: 투표 시간, 현재 기본값 60초 (전원 투표 시 즉시 종료)
- `turnOrder`, `turnIndex`: 턴 진행 제어
- `prompt`: 시민/마피아 각각에게 지급할 완성형 제시어 쌍
- `awaitingMafiaGuess`: 마피아 탈락 후 정답 입력 단계 여부

## 3. players subcollection

경로:

```text
rooms/{roomId}/players/{playerId}
```

```ts
type Player = {
	id: string;
	nickname: string;
	role: "citizen" | "mafia";
	alive: boolean;
	isHost: boolean;
	isBot?: boolean;
	joinedAt: timestamp;
};
```

설명:

- 대기방과 게임 화면 모두 이 컬렉션을 실시간 구독한다.
- 게임 중 퇴장하면 문서를 지우지 않고 `alive=false`로 처리할 수 있다.

## 4. drawingsByPlayer subcollection

경로:

```text
rooms/{roomId}/drawingsByPlayer/{playerId}
```

```ts
type DrawingStroke = {
	tool: "pen" | "eraser";
	color: string;
	size: number;
	points: Array<{ x: number; y: number }>;
	createdAtMs: number;
};

type PlayerDrawing = {
	playerId: string;
	playerName: string;
	gameSession: number;
	round: number;
	turnOrder: number;
	strokes: DrawingStroke[];
	createdAt: timestamp;
	updatedAt: timestamp;
};
```

중요한 동작 방식:

- 이 문서는 플레이어별, 라운드별 최종 그림 저장 단위다.
- 동시에 현재 턴 플레이어가 stroke를 추가할 때마다 실시간으로 업데이트된다.
- 즉 `실시간 공유용 스트림`과 `턴 결과 저장소` 역할을 한 문서가 함께 수행한다.
- 다음 턴으로 넘어가면 다음 플레이어가 자신의 빈 canvas 문서를 사용한다.

## 5. votes subcollection

경로:

```text
rooms/{roomId}/votes/{playerId}
```

```ts
type Vote = {
	voterId: string;
	targetId: string;
};
```

`targetId`는 실제 player id 또는 `skip` 값을 가진다.

## 6. 실시간 구독 포인트

게임 화면에서 주로 구독하는 대상은 아래 네 가지다.

- `rooms/{roomId}`
- `rooms/{roomId}/players`
- `rooms/{roomId}/drawingsByPlayer`
- `rooms/{roomId}/votes`

이 구조 덕분에 현재 턴 플레이어의 그림 진행 과정, 참가자 상태, 투표 상황이 거의 즉시 반영된다.

## 7. 파생 상태

아래 값은 Firestore에 별도 저장하지 않고 클라이언트에서 계산한다.
## 6-1. messages subcollection

경로:

```text
rooms/{roomId}/messages/{auto-id}
```

```ts
type ChatMessage = {
	playerId: string;
	nickname: string;
	message: string;
	createdAt: timestamp;
};
```

- `createdAt` 오름차순으로 정렬한다.
- 채팅은 `waiting`과 `voting` 상태에서만 클라이언트측에서 허용한다.
- 메시지는 최대 200자로 제한한다.


- `alivePlayers`
- `currentTurnPlayer`
- `voteResult`
- `orderedDrawings`
- `winnerNicknames`

---