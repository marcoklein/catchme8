const GameState = require("./GameState");
const Player = require("./Player");
const AIPlayer = require("./AIPlayer");
const AIBehavior = require("./AIBehavior");
const MovementEngine = require("./MovementEngine");

class GameManager {
  constructor(io) {
    this.io = io;
    this.gameState = new GameState();
    this.lastUpdate = Date.now();
    this.updateInterval = 1000 / 60; // 60 FPS
    this.lastBroadcast = Date.now();
    this.broadcastInterval = 1000 / 30; // Broadcast at 30 FPS
    this.aiUpdateInterval = 1000 / 10; // Update AI 10 times per second
    this.lastAIUpdate = Date.now();

    // Server-authoritative input system
    this.playerInputStates = new Map();
    this.inputTracking = {};

    // Rate limiting constants
    this.MAX_INPUT_RATE = 35; // Max inputs per second
    this.INPUT_RATE_WINDOW = 1000; // 1 second window

    // Ghost player detection
    this.lastInactiveCheck = Date.now();
    this.inactiveCheckInterval = 5000; // Check every 5 seconds

    this.gameLoop();
  }

  handlePlayerJoin(socket, playerName) {
    // Find a safe spawn position
    const spawnPos = this.gameState.findSafeSpawnPosition();

    // Create new player at safe position
    const player = new Player(socket.id, playerName, spawnPos.x, spawnPos.y);

    if (!this.gameState.addPlayer(player)) {
      socket.emit("joinError", "Game is full");
      return;
    }

    // Initialize player activity tracking
    player.lastMovement = Date.now();

    // Join the game room
    socket.join("game");

    // Send initial game state to the new player
    socket.emit("gameJoined", {
      playerId: socket.id,
      gameState: this.gameState.toJSON(),
    });

    // Broadcast updated game state to all players
    this.broadcastGameState();

    console.log(`Player ${playerName} (${socket.id}) joined the game`);
  }

  handlePlayerMove(socket, movement) {
    const now = Date.now();
    const deltaTime = Math.min(now - this.lastUpdate, 100); // Cap deltaTime to prevent large jumps

    // Anti-cheat: Rate limiting for movement updates
    const player = this.gameState.players.get(socket.id);
    if (player) {
      // Initialize anti-cheat tracking if not exists
      if (!player.antiCheat) {
        player.antiCheat = {
          lastMoveTime: now,
          moveCount: 0,
          suspiciousMovements: 0,
          windowStart: now,
        };
      }

      // Rate limiting: Check movement frequency
      const timeSinceLastMove = now - player.antiCheat.lastMoveTime;
      const minMoveInterval = 1000 / 60; // Maximum 60 moves per second

      if (timeSinceLastMove < minMoveInterval) {
        // Too frequent movement - ignore this update
        return;
      }

      // Track movement count in sliding window (1 second)
      if (now - player.antiCheat.windowStart > 1000) {
        player.antiCheat.moveCount = 0;
        player.antiCheat.windowStart = now;
      }

      player.antiCheat.moveCount++;
      player.antiCheat.lastMoveTime = now;

      // Check for excessive movement rate
      if (player.antiCheat.moveCount > 35) {
        // Allow up to 35 moves per second - silently ignore excessive updates
        return;
      }
    }

    if (this.gameState.updatePlayer(socket.id, movement, deltaTime)) {
      const player = this.gameState.players.get(socket.id);
      if (player) {
        // Check for power-up collection
        const collectedPowerUp = this.gameState.checkPowerUpCollision(player);
        if (collectedPowerUp) {
          // Notify all players about power-up collection
          this.io.to("game").emit("powerUpCollected", {
            playerId: player.id,
            playerName: player.name,
            powerUpType: collectedPowerUp.type,
          });
        }

        // Check for collisions/tags immediately
        this.checkCollisions(socket.id);

        // Update player's last movement time for activity tracking
        player.lastMovement = now;
      }
    }
  }

  // New server-authoritative input handler
  handlePlayerInput(socket, inputState) {
    const player = this.gameState.players.get(socket.id);
    if (!player) {
      return;
    }

    // Rate limiting for input
    const now = Date.now();
    if (!this.inputTracking[socket.id]) {
      this.inputTracking[socket.id] = {
        lastInputTime: 0,
        inputCount: 0,
        windowStart: now,
      };
    }

    const tracker = this.inputTracking[socket.id];

    // Reset window if needed
    if (now - tracker.windowStart > this.INPUT_RATE_WINDOW) {
      tracker.inputCount = 0;
      tracker.windowStart = now;
    }

    tracker.inputCount++;

    if (tracker.inputCount > this.MAX_INPUT_RATE) {
      // Silently ignore excessive input updates
      return;
    }

    // Store input state for this player
    this.playerInputStates.set(socket.id, {
      ...inputState,
      lastUpdated: now,
    });
  }

  validateAndStoreInput(player, inputState) {
    const now = Date.now();

    // Anti-cheat: Input rate limiting
    if (!player.inputTracking) {
      player.inputTracking = {
        lastInputTime: now,
        inputCount: 0,
        windowStart: now,
      };
    }

    // Rate limiting validation
    const timeSinceLastInput = now - player.inputTracking.lastInputTime;
    if (timeSinceLastInput < 16) return; // Max 60 inputs/sec

    // Track input count in sliding window (1 second)
    if (now - player.inputTracking.windowStart > 1000) {
      player.inputTracking.inputCount = 0;
      player.inputTracking.windowStart = now;
    }

    player.inputTracking.inputCount++;
    player.inputTracking.lastInputTime = now;

    // Check for excessive input rate
    if (player.inputTracking.inputCount > 35) {
      console.warn(
        `Player ${player.name} (${socket.id}) sending too many input updates: ${player.inputTracking.inputCount}/sec`
      );
      return;
    }

    // Validate input state values
    if (this.validateInputState(inputState)) {
      // Store validated input state
      player.currentInput = {
        ...inputState,
        receivedAt: now,
      };
    }
  }

  validateInputState(inputState) {
    // Validate boolean inputs
    if (
      typeof inputState.up !== "boolean" ||
      typeof inputState.down !== "boolean" ||
      typeof inputState.left !== "boolean" ||
      typeof inputState.right !== "boolean" ||
      typeof inputState.isTouchActive !== "boolean"
    ) {
      return false;
    }

    // Validate touch inputs (if active)
    if (inputState.isTouchActive) {
      if (
        typeof inputState.touchX !== "number" ||
        typeof inputState.touchY !== "number" ||
        Math.abs(inputState.touchX) > 1.1 ||
        Math.abs(inputState.touchY) > 1.1
      ) {
        return false;
      }
    }

    return true;
  }

  handlePlayerDisconnect(socket) {
    const player = this.gameState.players.get(socket.id);
    if (player) {
      this.gameState.removePlayer(socket.id);

      // Clean up input tracking
      this.playerInputStates.delete(socket.id);
      delete this.inputTracking[socket.id];

      this.broadcastGameState();
      console.log(`Player ${player.name} (${socket.id}) disconnected`);
    }
  }

  checkCollisions(playerId) {
    const player = this.gameState.players.get(playerId);
    if (!player || !player.isIt) return;

    for (const [otherId, otherPlayer] of this.gameState.players) {
      if (otherId === playerId) continue;

      if (this.gameState.tagPlayer(playerId, otherId)) {
        // Someone was tagged!
        this.io.to("game").emit("playerTagged", {
          tagger: player.name,
          tagged: otherPlayer.name,
          newIt: otherPlayer.id,
        });
        break;
      }
    }
  }

  // AI Management Methods
  addAIPlayer(name = null) {
    if (this.gameState.players.size >= this.gameState.maxPlayers) {
      return false;
    }

    // Generate AI name if not provided
    if (!name) {
      const aiNames = [
        "Bot Alpha",
        "Bot Beta",
        "Bot Gamma",
        "Bot Delta",
        "Bot Echo",
      ];
      const usedNames = Array.from(this.gameState.players.values()).map(
        (p) => p.name
      );
      const availableNames = aiNames.filter((n) => !usedNames.includes(n));
      name =
        availableNames.length > 0 ? availableNames[0] : `Bot ${Date.now()}`;
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

  removeAIPlayer(aiId) {
    const aiPlayer = this.gameState.players.get(aiId);
    if (aiPlayer && aiPlayer.isAI) {
      this.gameState.removePlayer(aiId);
      console.log(`AI Player ${aiPlayer.name} (${aiId}) removed from game`);
      this.broadcastGameState();
      return true;
    }
    return false;
  }

  updateAIPlayers() {
    const now = Date.now();
    if (now - this.lastAIUpdate < this.aiUpdateInterval) {
      return;
    }

    this.lastAIUpdate = now;
    const deltaTime = Math.min(now - this.lastUpdate, 100);

    // Update each AI player
    for (const [playerId, player] of this.gameState.players) {
      if (player.isAI) {
        // Get AI decision
        const movement = AIBehavior.decideAction(player, this.gameState);

        // Update AI player position
        if (this.gameState.updatePlayer(playerId, movement, deltaTime)) {
          // Check for power-up collection
          const collectedPowerUp = this.gameState.checkPowerUpCollision(player);
          if (collectedPowerUp) {
            this.io.to("game").emit("powerUpCollected", {
              playerId: player.id,
              playerName: player.name,
              powerUpType: collectedPowerUp.type,
            });
          }

          // Check for collisions/tags
          this.checkCollisions(playerId);
        }
      }
    }
  }

  // Check if we should add AI players to fill the game
  shouldAddAIPlayer() {
    const humanPlayers = Array.from(this.gameState.players.values()).filter(
      (p) => !p.isAI
    );
    const aiPlayers = Array.from(this.gameState.players.values()).filter(
      (p) => p.isAI
    );

    // Add AI if we have human players but not enough total players for a good game
    return (
      humanPlayers.length > 0 &&
      this.gameState.players.size < 4 &&
      aiPlayers.length < 2
    );
  }

  broadcastGameState() {
    this.io.to("game").emit("gameState", this.gameState.toJSON());
  }

  gameLoop() {
    const now = Date.now();
    const deltaTime = now - this.lastUpdate;

    if (deltaTime >= this.updateInterval) {
      // Check for inactive players periodically (not every frame for performance)
      if (now - this.lastInactiveCheck >= this.inactiveCheckInterval) {
        this.removeInactivePlayers(now);
        this.lastInactiveCheck = now;
      }

      // Ensure there's always a player who is "it"
      this.gameState.ensureItPlayer();

      // Process all player inputs and calculate movements (server-authoritative)
      this.processPlayerMovements(deltaTime);

      // Update AI players
      this.updateAIPlayers();

      // Check if we should add AI players
      if (this.shouldAddAIPlayer()) {
        this.addAIPlayer();
      }

      // Update power-ups (respawn timers, transparency expiration)
      this.gameState.updatePowerUps();

      // Update game state
      if (this.gameState.isGameOver()) {
        this.gameState.stopGame();
        this.io.to("game").emit("gameEnd", "Time up!");
      }

      // Check if we should broadcast (less frequent than game updates)
      const shouldBroadcast =
        now - this.lastBroadcast >= this.broadcastInterval;

      // Broadcast game state if there are players and enough time has passed
      if (this.gameState.players.size > 0 && shouldBroadcast) {
        this.broadcastGameState();
        this.lastBroadcast = now;
      }

      this.lastUpdate = now;
    }

    // Continue the game loop
    setTimeout(() => this.gameLoop(), 16); // ~60 FPS
  }

  // Server-authoritative movement processing
  processPlayerMovements(deltaTime) {
    for (const [socketId, inputState] of this.playerInputStates.entries()) {
      const player = this.gameState.players.get(socketId);
      if (!player || !inputState) continue;

      // Skip if input is too old (player might have disconnected)
      const now = Date.now();
      if (now - inputState.lastUpdated > 1000) {
        continue;
      }

      // Set the current input for the player
      player.currentInput = inputState;

      // Calculate movement using the MovementEngine
      const movement = MovementEngine.calculateMovement(player, deltaTime);

      if (movement.dx !== 0 || movement.dy !== 0) {
        // Update player position
        const newPosition = {
          x: player.x + movement.dx,
          y: player.y + movement.dy,
        };

        // Validate position (bounds + obstacles)
        const playerRadius = 15; // Standard player radius
        const isInBounds =
          newPosition.x >= playerRadius &&
          newPosition.x <= this.gameState.gameWidth - playerRadius &&
          newPosition.y >= playerRadius &&
          newPosition.y <= this.gameState.gameHeight - playerRadius;

        const hasNoCollision = !this.gameState.checkObstacleCollision(
          newPosition.x,
          newPosition.y,
          playerRadius
        );

        if (isInBounds && hasNoCollision) {
          player.x = newPosition.x;
          player.y = newPosition.y;

          // Check for game events (power-ups, collisions)
          this.checkGameEvents(player);
        }
      }
    }
  }

  checkGameEvents(player) {
    // Check for power-up collection
    const collectedPowerUp = this.gameState.checkPowerUpCollision(player);
    if (collectedPowerUp) {
      this.io.to("game").emit("powerUpCollected", {
        playerId: player.id,
        playerName: player.name,
        powerUpType: collectedPowerUp.type,
      });
    }

    // Check for collisions/tags
    this.checkCollisions(player.id);

    // Update player's last movement time for activity tracking
    player.lastMovement = Date.now();
  }

  // Remove inactive/ghost players who haven't sent input in a while
  removeInactivePlayers(now) {
    const INACTIVE_TIMEOUT = 30000; // 30 seconds of no input = ghost player
    const playersToRemove = [];

    for (const [playerId, player] of this.gameState.players) {
      // Skip AI players - they're managed differently
      if (player.isAI) continue;

      // Check if player has been inactive for too long
      const lastActivity = Math.max(
        player.lastMovement || 0,
        this.playerInputStates.get(playerId)?.lastUpdated || 0
      );

      const timeSinceActivity = now - lastActivity;

      // Also check if we have any input state for non-AI players
      const hasInputState = this.playerInputStates.has(playerId);

      if (
        timeSinceActivity > INACTIVE_TIMEOUT ||
        (!hasInputState && timeSinceActivity > 5000)
      ) {
        console.log(
          `Removing inactive player: ${
            player.name
          } (${playerId}) - inactive for ${Math.round(
            timeSinceActivity / 1000
          )}s, has input state: ${hasInputState}`
        );
        playersToRemove.push(playerId);
      }
    }

    // Remove inactive players
    let removedCount = 0;
    for (const playerId of playersToRemove) {
      const player = this.gameState.players.get(playerId);
      if (player) {
        this.gameState.removePlayer(playerId);

        // Clean up input tracking
        this.playerInputStates.delete(playerId);
        delete this.inputTracking[playerId];

        removedCount++;
        console.log(`Inactive player ${player.name} (${playerId}) removed`);
      }
    }

    // Broadcast game state if any players were removed
    if (removedCount > 0) {
      this.broadcastGameState();
    }
  }
}

module.exports = GameManager;
