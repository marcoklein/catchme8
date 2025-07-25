import { Server, Socket } from 'socket.io';
import { ServerToClientEvents, ClientToServerEvents, InterServerEvents, SocketData, InputState } from '@shared/types';
import { GameState } from './GameState';
import { Player } from './Player';
import { AIPlayer } from './AIPlayer';
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
  
  // Game loop control
  private running: boolean = true;
  private gameLoopTimeout: NodeJS.Timeout | null = null;
  
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

  // AI management
  private lastAIUpdate = Date.now();
  private readonly aiUpdateInterval = 1000 / 30; // Update AI 30 times per second (same as broadcast rate)

  constructor(io: TypedServer) {
    this.io = io;
    this.gameState = new GameState();
    this.startGameLoop();
    
    // Add initial AI player for testing
    setTimeout(() => {
      this.addAIPlayer('Bot Alpha');
    }, 1000);
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

  public shutdown(): void {
    console.log('GameManager: Shutting down game loop...');
    this.running = false;
    
    // Clear any pending timeout
    if (this.gameLoopTimeout) {
      clearTimeout(this.gameLoopTimeout);
      this.gameLoopTimeout = null;
    }
    
    // Clean up all input tracking and buffers
    this.playerInputStates.clear();
    this.inputTracking = {};
    this.inputBuffer.clear();
    
    console.log('GameManager: Shutdown complete');
  }

  // AI Management Methods
  public addAIPlayer(name?: string): boolean {
    if (this.gameState.getPlayerCount() >= 8) { // Max players limit
      return false;
    }

    // Generate AI name if not provided
    if (!name) {
      const aiNames = ['Bot Alpha', 'Bot Beta', 'Bot Gamma', 'Bot Delta', 'Bot Echo'];
      const usedNames = Array.from(this.gameState.getPlayers().values()).map(p => p.name);
      const availableNames = aiNames.filter(n => !usedNames.includes(n));
      name = availableNames.length > 0 ? availableNames[0] : `Bot ${Date.now()}`;
    }

    // Find a safe spawn position
    const spawnPos = this.gameState.findSafeSpawnPosition();

    // Create AI player with unique ID
    const aiId = `ai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const aiPlayer = new AIPlayer(aiId, name, spawnPos.x, spawnPos.y);

    if (this.gameState.addPlayer(aiPlayer)) {
      console.log(`AI Player ${name} (${aiId}) joined the game`);
      this.broadcastGameState();
      return true;
    }

    return false;
  }

  private shouldAddAIPlayer(): boolean {
    const players = this.gameState.getPlayers();
    const humanPlayers = Array.from(players.values()).filter(p => !p.isAI);
    const aiPlayers = Array.from(players.values()).filter(p => p.isAI);

    // Add AI if we have human players but not enough total players for a good game
    return humanPlayers.length > 0 && humanPlayers.length + aiPlayers.length < 3 && aiPlayers.length < 2;
  }

  private updateAIPlayers(): void {
    const now = Date.now();
    if (now - this.lastAIUpdate < this.aiUpdateInterval) {
      return;
    }

    // Calculate proper AI deltaTime based on AI update frequency
    const aiDeltaTime = Math.min(now - this.lastAIUpdate, 200); // Cap at 200ms for safety
    this.lastAIUpdate = now;

    // Update each AI player
    this.gameState.forEachPlayer((player) => {
      if (player instanceof AIPlayer) {
        // Get AI decision and movement
        const movement = player.makeDecision(this.gameState.toJSON());

        // Apply movement using the proper updatePlayer method with AI deltaTime
        if (this.gameState.updatePlayer(player.id, movement, aiDeltaTime)) {
          // Check for game events (power-ups, collisions)
          this.checkGameEvents(player);
        }
      }
    });
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
    const gameState = this.gameState.toJSON();
    
    // Debug: Log AI player positions when broadcasting (occasionally)
    const aiPlayers = gameState.players.filter(p => p.isAI);
    if (aiPlayers.length > 0 && Math.random() < 0.05) { // Only 5% of the time
      console.log(`[BROADCAST] AI Players positions:`, aiPlayers.map(p => `${p.name}: (${p.x.toFixed(1)}, ${p.y.toFixed(1)})`));
    }
    
    this.io.to('game').emit('gameState', gameState);
  }

  private startGameLoop(): void {
    this.gameLoop();
  }

  private gameLoop(): void {
    // Check if we should continue running
    if (!this.running) {
      console.log('GameManager: Game loop stopped');
      return;
    }

    const now = Date.now();
    const deltaTime = now - this.lastUpdate;

    if (deltaTime >= this.updateInterval) {
      // Check for inactive players periodically
      if (now - this.lastInactiveCheck >= this.inactiveCheckInterval) {
        this.removeInactivePlayers(now);
        this.lastInactiveCheck = now;
      }

      // Update AI players
      this.updateAIPlayers();

      // Check if we should add AI players
      if (this.shouldAddAIPlayer()) {
        this.addAIPlayer();
      }

      // Ensure there's always a player who is "it"
      this.gameState.ensureItPlayer();

      // Update points system (deduct points for IT players)
      this.updatePointsSystem(now);

      // Process all player inputs and calculate movements
      this.processPlayerMovements(deltaTime);

      // Update game state
      this.gameState.update(deltaTime);

      // Check for player collisions (independent of movement)
      this.checkAllPlayerCollisions();

      // Check if we should broadcast
      const shouldBroadcast = now - this.lastBroadcast >= this.broadcastInterval;

      // Broadcast game state if there are players and enough time has passed
      if (this.gameState.getPlayerCount() > 0 && shouldBroadcast) {
        this.broadcastGameState();
        this.lastBroadcast = now;
      }

      this.lastUpdate = now;
    }

    // Continue the game loop only if still running
    if (this.running) {
      this.gameLoopTimeout = setTimeout(() => this.gameLoop(), 16); // ~60 FPS
    }
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
    // Update player activity
    player.lastMovement = Date.now();

    // Check for power-up collection
    const collectedPowerUp = this.gameState.checkPowerUpCollision(player);
    if (collectedPowerUp) {
      console.log(`Player ${player.name} collected power-up: ${collectedPowerUp.type}`);
      
      // Apply power-up effect
      if (collectedPowerUp.type === 'transparency') {
        player.activateTransparency(10000); // 10 seconds
      } else if (collectedPowerUp.type === 'speed') {
        // Speed boost could be implemented later
        console.log(`Speed boost not yet implemented`);
      } else if (collectedPowerUp.type === 'size') {
        player.activateSizeBoost(10000); // 10 seconds
      }

      // Emit power-up collection event
      this.io.to('game').emit('powerUpCollected', {
        playerId: player.id,
        playerName: player.name,
        powerUpType: collectedPowerUp.type,
      });
    }

    // Check for star collection
    const collectedStar = this.gameState.checkStarCollision(player);
    if (collectedStar) {
      console.log(`Player ${player.name} collected star`);
      
      // Award points
      const points = player.awardStarPoints();
      
      // Emit star collection event
      this.io.to('game').emit('starCollected', {
        playerId: player.id,
        playerName: player.name,
        starId: collectedStar.id,
        pointsAwarded: points,
        newScore: player.score,
      });

      // Emit score update
      this.io.to('game').emit('scoreUpdate', {
        playerId: player.id,
        playerName: player.name,
        score: player.score,
        change: points,
        reason: 'star_collection',
      });
    }

    // Check for stun orb collection
    const collectedStunOrb = this.gameState.checkStunOrbCollision(player);
    if (collectedStunOrb) {
      console.log(`Player ${player.name} collected stun orb, isIt: ${player.isIt}`);
      
      const affectedPlayers = this.gameState.collectStunOrb(player, collectedStunOrb);

      console.log(`Affected players: ${affectedPlayers.length}`);

      // Emit stun orb collection event
      this.io.to('game').emit('stunOrbCollected', {
        playerId: player.id,
        playerName: player.name,
        stunOrbId: collectedStunOrb.id,
        onlyForIt: !player.isIt,
        stunActivated: player.isIt,
        affectedPlayers: affectedPlayers,
        explosionCenter: { x: collectedStunOrb.x, y: collectedStunOrb.y },
      });

      // If stun was activated by IT player, notify about the explosion
      if (player.isIt) {
        console.log(`IT player collected stun orb, emitting explosion event`);
        
        // Emit explosion event to trigger client-side effects
        this.io.to('game').emit('stunOrbExplosion', {
          itPlayerId: player.id,
          itPlayerName: player.name,
          explosionX: collectedStunOrb.x,
          explosionY: collectedStunOrb.y,
          explosionRadius: Math.sqrt(this.gameState.gameWidth * this.gameState.gameWidth + this.gameState.gameHeight * this.gameState.gameHeight), // Screen-wide coverage
          stunDuration: 1000,
          affectedPlayers: affectedPlayers,
        });
      } else {
        console.log(`Non-IT player collected stun orb, no explosion`);
      }
    }
  }

  private checkAllPlayerCollisions(): void {
    // Check for player-to-player collisions (tagging) for all IT players
    this.gameState.forEachPlayer((player) => {
      if (player.isIt && !player.isStunned) {
        this.gameState.forEachPlayer((otherPlayer) => {
          if (otherPlayer.id !== player.id && !otherPlayer.isStunned && !otherPlayer.isTransparent) {
            const dx = player.x - otherPlayer.x;
            const dy = player.y - otherPlayer.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // Check if collision occurs (players touching)
            if (distance < player.currentRadius + otherPlayer.currentRadius) {
              console.log(`Player ${player.name} tagged ${otherPlayer.name}!`);
              
              // Stun the player who was caught for 3 seconds
              otherPlayer.stun(3000);
              
              // Transfer "it" status
              player.stopBeingIt();
              otherPlayer.becomeIt();
              
              // Award points to the tagger
              player.awardTagPoints();
              const tagPoints = 100;
              
              // Emit tagging event
              this.io.to('game').emit('playerTagged', {
                tagger: player.name,
                tagged: otherPlayer.name,
                newIt: otherPlayer.id,
              });
              
              // Emit score update for the tagger
              this.io.to('game').emit('scoreUpdate', {
                playerId: player.id,
                playerName: player.name,
                score: player.score,
                change: tagPoints,
                reason: 'successful_tag',
              });
              
              return; // Only tag one player at a time
            }
          }
        });
      }
    });
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