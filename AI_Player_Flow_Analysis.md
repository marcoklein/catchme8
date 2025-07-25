# AI Player Flow Analysis

## Overview
This document traces the complete lifecycle of an AI player in the CatchMe game, from creation to client-side rendering.

## 1. AI Player Creation and Joining

### Server-Side Creation
**File: `src/server/game/GameManager.ts`**

1. **Initial AI Player Creation** (Line 65-68)
   ```typescript
   setTimeout(() => {
     this.addAIPlayer('Bot Alpha');
   }, 1000);
   ```
   - AI player is automatically created 1 second after GameManager starts
   - Called in the constructor

2. **addAIPlayer Method** (Line 211-238)
   ```typescript
   public addAIPlayer(name?: string): boolean {
     // Generate unique AI ID
     const aiId = `ai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
     const aiPlayer = new AIPlayer(aiId, name, spawnPos.x, spawnPos.y);
     
     if (this.gameState.addPlayer(aiPlayer)) {
       this.broadcastGameState();
       return true;
     }
   }
   ```
   - Creates unique AI ID with timestamp and random string
   - Uses `AIPlayer` class (extends `Player`)
   - Finds safe spawn position
   - Adds to game state
   - **Broadcasts game state to all connected clients**

3. **GameState.addPlayer** (Line 38-56 in `GameState.ts`)
   ```typescript
   public addPlayer(player: Player): boolean {
     this.players.set(player.id, player);
     // If this is the first player, make them "it"
     if (this.players.size === 1) {
       player.becomeIt();
     }
   }
   ```

## 2. AI Player Movement Updates

### Server-Side Movement Processing
**File: `src/server/game/GameManager.ts`**

1. **Game Loop** (Line 302-355)
   - Runs at ~60 FPS using `setTimeout(..., 16)`
   - Calls `updateAIPlayers()` every frame

2. **updateAIPlayers Method** (Line 249-273)
   ```typescript
   private updateAIPlayers(): void {
     // Update every 100ms (10 FPS for AI decisions)
     if (now - this.lastAIUpdate < this.aiUpdateInterval) return;
     
     this.gameState.forEachPlayer((player) => {
       if (player instanceof AIPlayer) {
         // Get AI decision and movement
         const movement = player.makeDecision(this.gameState.toJSON());
         
         // Apply movement using updatePlayer method
         if (this.gameState.updatePlayer(player.id, movement, deltaTime)) {
           this.checkGameEvents(player);
         }
       }
     });
   }
   ```

3. **AIPlayer.makeDecision** (Line 38-67 in `AIPlayer.ts`)
   - Makes decisions every 100ms
   - Returns `{ dx: number, dy: number }` movement vector
   - Uses AI behavior logic (chase, flee, wander)

4. **GameState.updatePlayer** (Line 443-469 in `GameState.ts`)
   ```typescript
   public updatePlayer(playerId: string, movement: { dx: number; dy: number }, deltaTime: number): boolean {
     // Validates movement magnitude
     // Calls applyMovementToPlayer
     this.applyMovementToPlayer(player, dx, dy, deltaTime);
   }
   ```

5. **applyMovementToPlayer** (Line 472-499 in `GameState.ts`)
   ```typescript
   private applyMovementToPlayer(player: Player, dx: number, dy: number, deltaTime: number): void {
     // Calculate new position based on speed and deltaTime
     const currentSpeed = player.isIt ? player.speed * 1.3 : player.speed;
     const moveDistance = currentSpeed * (deltaTime / 1000);
     
     let newX = player.x + dx * moveDistance;
     let newY = player.y + dy * moveDistance;
     
     // Boundary checking and obstacle collision
     // Updates player.x and player.y
   }
   ```

## 3. Broadcasting to Clients

### Server-Side Broadcasting
**File: `src/server/game/GameManager.ts`**

1. **broadcastGameState Method** (Line 286-296)
   ```typescript
   private broadcastGameState(): void {
     const gameState = this.gameState.toJSON();
     this.io.to('game').emit('gameState', gameState);
   }
   ```
   - Called every 33ms (30 FPS broadcast rate)
   - Sends complete game state to all clients in 'game' room
   - Includes all player positions, including AI players

2. **GameState.toJSON** (GameState.ts)
   ```typescript
   public toJSON(): GameStateData {
     return {
       players: Array.from(this.players.values()).map(p => p.toJSON()),
       // ... other game objects
     };
   }
   ```

3. **Player.toJSON** (Player.ts)
   ```typescript
   public toJSON() {
     return {
       id: this.id,
       name: this.name,
       x: this.x,
       y: this.y,
       isAI: this.isAI,
       // ... other properties
     };
   }
   ```

## 4. Client-Side Reception and Processing

### Network Layer
**File: `src/client/network/NetworkManager.ts`**

1. **Socket Event Listener** (Line 36-41)
   ```typescript
   this.socket.on('gameState', (gameState: GameStateData) => {
     const game = (window as any).game;
     if (game) {
       game.updateGameState(gameState);
     }
   });
   ```

### Game State Update
**File: `src/client/components/Game.ts`**

1. **updateGameState Method** (Line 199-285)
   ```typescript
   public updateGameState(gameState: GameStateData): void {
     this.gameState = gameState;
     this.lastServerUpdate = Date.now();
     
     // Process server reconciliation for local player
     // AI players are included in gameState.players array
   }
   ```

### Client-Side Game Loop
**File: `src/client/components/Game.ts`**

1. **Game Loop** (Line 587-608)
   ```typescript
   private gameLoop(): void {
     // Runs at 60 FPS using requestAnimationFrame
     if (this.renderer) {
       this.renderer.render();
     }
     requestAnimationFrame(() => this.gameLoop());
   }
   ```

## 5. Client-Side Rendering

### Renderer
**File: `src/client/components/Renderer.ts`**

1. **render Method** (Line 289-382)
   ```typescript
   public render(): void {
     if (!this.gameState) return;
     
     // Draw all players (including AI)
     this.gameState.players.forEach((player) => {
       this.drawPlayer(player, currentTime);
     });
   }
   ```

2. **drawPlayer Method** (Line 757-958)
   ```typescript
   private drawPlayer(player: PlayerState, currentTime: number): void {
     // Get interpolated position
     const interpolatedPos = this.getInterpolatedPlayerPosition(player, currentTime);
     
     // Draw player circle with appropriate colors
     // AI players get red border (line 873-875)
     if (player.isAI) {
       this.ctx.strokeStyle = "#FF0000"; // Bright red for AI players
     }
   }
   ```

3. **getInterpolatedPlayerPosition** (Line 223-235)
   ```typescript
   private getInterpolatedPlayerPosition(player: PlayerState, currentTime: number): Position {
     // Returns player position directly
     return { x: player.x, y: player.y };
   }
   ```

## Data Flow Summary

```
1. Server: AIPlayer created → GameState.addPlayer()
2. Server: broadcastGameState() → Socket.IO emit('gameState')
3. Client: NetworkManager receives 'gameState' event
4. Client: Game.updateGameState() updates this.gameState
5. Client: Game loop calls Renderer.render() at 60 FPS
6. Client: Renderer iterates through gameState.players
7. Client: drawPlayer() called for each player (including AI)
8. Client: AI players drawn with red border

Movement Updates:
1. Server: AIPlayer.makeDecision() every 100ms
2. Server: GameState.updatePlayer() applies movement
3. Server: broadcastGameState() sends updated positions
4. Client: Process repeats from step 3 above
```

## Key Issues to Investigate

1. **Client Connection**: Is the client properly joining the 'game' room to receive broadcasts?
2. **Game State Reception**: Is the client receiving the 'gameState' events with AI player data?
3. **Rendering Loop**: Is the render loop actually calling drawPlayer for AI players?
4. **Canvas Context**: Are the canvas drawing operations actually being applied to the visible canvas?

## Debug Points

- Check browser console for Socket.IO connection status
- Verify 'gameState' events are being received
- Confirm `this.gameState.players` contains AI players
- Ensure canvas context is drawing to visible element