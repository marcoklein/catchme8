import { Server, Socket } from 'socket.io';
import { ServerToClientEvents, ClientToServerEvents, InterServerEvents, SocketData, InputState } from '@shared/types';
import { GameState } from './GameState';
import { Player } from './Player';
import { MovementEngine } from './MovementEngine';

type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
type TypedServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

interface InputTracking {
  lastInputTime: number;
  inputCount: number;
  windowStart: number;
  consecutiveViolations: number;
  lastViolationTime: number;
  backoffUntil: number;
}

interface BufferedInput extends InputState {
  lastUpdated: number;
}

export class GameManager {
  private gameState: GameState;
  private io: TypedServer;
  
  // Game loop timing
  private lastUpdate = Date.now();
  private readonly updateInterval = 1000 / 60; // 60 FPS
  private lastBroadcast = Date.now();
  private readonly broadcastInterval = 1000 / 30; // 30 FPS

  // Server-authoritative input system
  private playerInputStates = new Map<string, InputState & { lastUpdated: number }>();
  private inputTracking: Record<string, InputTracking> = {};
  
  // Input buffering for network issues
  private inputBuffer = new Map<string, BufferedInput[]>();
  private readonly maxBufferSize = 10;

  // Rate limiting constants
  private readonly MAX_INPUT_RATE = 60;
  private readonly INPUT_RATE_WINDOW = 1000;
  private readonly BASE_BACKOFF_DELAY = 50;
  private readonly MAX_BACKOFF_DELAY = 500;

  // Ghost player detection
  private lastInactiveCheck = Date.now();
  private readonly inactiveCheckInterval = 5000;

  constructor(io: TypedServer) {
    this.io = io;
    this.gameState = new GameState();
    this.startGameLoop();
  }

  public handlePlayerJoin(socket: TypedSocket, playerName: string): void {
    try {
      // Find a safe spawn position
      const spawnPos = this.gameState.findSafeSpawnPosition();
      
      // Create new player at safe position
      const player = new Player(socket.id, playerName, spawnPos.x, spawnPos.y);
      
      if (!this.gameState.addPlayer(player)) {
        socket.emit('joinError', 'Game is full');
        return;
      }

      // Initialize player activity tracking
      player.lastMovement = Date.now();

      // Join the game room
      socket.join('game');

      // Send initial game state to the new player
      socket.emit('gameJoined', {
        playerId: socket.id,
        gameState: this.gameState.toJSON(),
      });

      // Broadcast updated game state to all players
      this.broadcastGameState();

      console.log(`Player ${playerName} (${socket.id}) joined the game`);
      console.log(`Total players after join: ${this.gameState.getPlayerCount()}`);
      
    } catch (error) {
      console.error('Error in handlePlayerJoin:', error);
      socket.emit('joinError', 'Failed to join game');
    }
  }

  public handlePlayerInput(socket: TypedSocket, inputState: InputState): void {
    const player = this.gameState.getPlayer(socket.id);
    if (!player) return;

    // Rate limiting for input
    const now = Date.now();
    if (!this.inputTracking[socket.id]) {
      this.inputTracking[socket.id] = {
        lastInputTime: 0,
        inputCount: 0,
        windowStart: now,
        consecutiveViolations: 0,
        lastViolationTime: 0,
        backoffUntil: 0,
      };
    }

    const tracker = this.inputTracking[socket.id];

    // Check if player is in backoff period
    if (tracker.backoffUntil > now) {
      this.bufferInput(socket.id, inputState, now);
      return;
    }

    // Reset window if needed
    if (now - tracker.windowStart > this.INPUT_RATE_WINDOW) {
      tracker.inputCount = 0;
      tracker.windowStart = now;
      
      // Reset consecutive violations if enough time has passed
      if (now - tracker.lastViolationTime > this.INPUT_RATE_WINDOW * 2) {
        tracker.consecutiveViolations = 0;
      }
    }

    tracker.inputCount++;

    if (tracker.inputCount > this.MAX_INPUT_RATE) {
      // Apply exponential backoff for excessive input
      if (tracker.inputCount > this.MAX_INPUT_RATE * 1.5) {
        tracker.consecutiveViolations++;
        tracker.lastViolationTime = now;
        
        const backoffDelay = Math.min(
          this.BASE_BACKOFF_DELAY * Math.pow(2, tracker.consecutiveViolations - 1),
          this.MAX_BACKOFF_DELAY
        );
        tracker.backoffUntil = now + backoffDelay;
        
        console.warn(`Player ${socket.id} rate limited, backoff for ${backoffDelay}ms`);
        this.bufferInput(socket.id, inputState, now);
        return;
      }
    }

    // Validate and store input state
    if (MovementEngine.validateInputState(inputState)) {
      this.playerInputStates.set(socket.id, {
        ...inputState,
        lastUpdated: now,
      });
    }
  }

  public handlePlayerDisconnect(socket: TypedSocket): void {
    const player = this.gameState.getPlayer(socket.id);
    if (player) {
      this.gameState.removePlayer(socket.id);

      // Clean up input tracking and buffers
      this.playerInputStates.delete(socket.id);
      delete this.inputTracking[socket.id];
      this.inputBuffer.delete(socket.id);

      this.broadcastGameState();
      console.log(`Player ${player.name} (${socket.id}) disconnected`);
    }
  }

  public getPlayerCount(): number {
    return this.gameState.getPlayerCount();
  }

  private bufferInput(socketId: string, inputState: InputState, timestamp: number): void {
    if (!this.inputBuffer.has(socketId)) {
      this.inputBuffer.set(socketId, []);
    }
    
    const buffer = this.inputBuffer.get(socketId)!;
    if (buffer.length < this.maxBufferSize) {
      buffer.push({ ...inputState, lastUpdated: timestamp });
    }
  }

  private broadcastGameState(): void {
    this.io.to('game').emit('gameState', this.gameState.toJSON());
  }

  private startGameLoop(): void {
    this.gameLoop();
  }

  private gameLoop(): void {
    const now = Date.now();
    const deltaTime = now - this.lastUpdate;

    if (deltaTime >= this.updateInterval) {
      // Check for inactive players periodically
      if (now - this.lastInactiveCheck >= this.inactiveCheckInterval) {
        this.removeInactivePlayers(now);
        this.lastInactiveCheck = now;
      }

      // Ensure there's always a player who is "it"
      this.gameState.ensureItPlayer();

      // Update points system (deduct points for IT players)
      this.updatePointsSystem(now);

      // Process all player inputs and calculate movements
      this.processPlayerMovements(deltaTime);

      // Update game state
      this.gameState.update(deltaTime);

      // Check if we should broadcast
      const shouldBroadcast = now - this.lastBroadcast >= this.broadcastInterval;

      // Broadcast game state if there are players and enough time has passed
      if (this.gameState.getPlayerCount() > 0 && shouldBroadcast) {
        this.broadcastGameState();
        this.lastBroadcast = now;
      }

      this.lastUpdate = now;
    }

    // Continue the game loop
    setTimeout(() => this.gameLoop(), 16); // ~60 FPS
  }

  private processPlayerMovements(deltaTime: number): void {
    for (const [socketId, inputState] of this.playerInputStates.entries()) {
      const player = this.gameState.getPlayer(socketId);
      if (!player || !inputState) continue;

      // Skip if input is too old
      const now = Date.now();
      const INPUT_EXPIRY_TIME = 3000;
      const inputAge = now - inputState.lastUpdated;
      
      if (inputAge > INPUT_EXPIRY_TIME) {
        // Try to use buffered input
        const bufferedInputs = this.inputBuffer.get(socketId);
        if (bufferedInputs && bufferedInputs.length > 0) {
          const bufferedInput = bufferedInputs.shift()!;
          this.playerInputStates.set(socketId, {
            ...bufferedInput,
            lastUpdated: now - 50
          });
          
          if (bufferedInputs.length === 0) {
            this.inputBuffer.delete(socketId);
          }
          continue;
        }
        
        // Clear old input state
        this.playerInputStates.delete(socketId);
        player.currentInput = null;
        continue;
      }

      // Set the current input for the player
      player.currentInput = inputState;

      // Calculate movement using the MovementEngine
      const movement = MovementEngine.calculateMovement(player, deltaTime);
      
      if (movement.dx !== 0 || movement.dy !== 0) {
        // Validate and apply movement
        const result = MovementEngine.validateMovement(
          player,
          movement.dx,
          movement.dy,
          this.gameState.gameWidth,
          this.gameState.gameHeight,
          this.gameState.obstacles
        );

        if (result.isValid) {
          player.x = result.x;
          player.y = result.y;
          
          // Check for game events (power-ups, collisions)
          this.checkGameEvents(player);
        }
      }
    }
  }

  private checkGameEvents(player: Player): void {
    // This will be implemented with the GameState
    // For now, just update player activity
    player.lastMovement = Date.now();
  }

  private removeInactivePlayers(now: number): void {
    const INACTIVE_TIMEOUT = 30000; // 30 seconds
    const playersToRemove: string[] = [];

    this.gameState.forEachPlayer((player, playerId) => {
      if (player.isAI) return; // Skip AI players

      const lastActivity = Math.max(
        player.lastMovement || 0,
        this.playerInputStates.get(playerId)?.lastUpdated || 0
      );

      const timeSinceActivity = now - lastActivity;

      if (timeSinceActivity > INACTIVE_TIMEOUT) {
        console.log(`Removing inactive player: ${player.name} (${playerId})`);
        playersToRemove.push(playerId);
      }
    });

    // Remove inactive players
    let removedCount = 0;
    for (const playerId of playersToRemove) {
      const player = this.gameState.getPlayer(playerId);
      if (player) {
        this.gameState.removePlayer(playerId);
        this.playerInputStates.delete(playerId);
        delete this.inputTracking[playerId];
        this.inputBuffer.delete(playerId);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      this.broadcastGameState();
    }
  }

  private updatePointsSystem(now: number): void {
    this.gameState.forEachPlayer((player) => {
      if (player.isIt && player.becameItTime && !player.isStunned) {
        const lastDeduction = player.lastPointDeduction || player.becameItTime;
        const timeSinceDeduction = now - lastDeduction;

        // Deduct points every second
        if (timeSinceDeduction >= 1000) {
          const secondsToDeduct = Math.floor(timeSinceDeduction / 1000);
          const pointsToDeduct = secondsToDeduct * 10;

          player.deductItPoints(pointsToDeduct);
          player.timeAsIt += timeSinceDeduction;

          // Emit score update
          this.io.to('game').emit('scoreUpdate', {
            playerId: player.id,
            playerName: player.name,
            score: player.score,
            change: -pointsToDeduct,
            reason: 'being_it',
          });
        }
      }
    });
  }
}