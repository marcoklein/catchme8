const GameState = require("./GameState");
const Player = require("./Player");
const AIPlayer = require("./AIPlayer");
const AIBehavior = require("./AIBehavior");

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
        // Allow up to 35 moves per second
        console.warn(
          `Player ${player.name} (${socket.id}) sending too many movement updates: ${player.antiCheat.moveCount}/sec`
        );
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

  handlePlayerDisconnect(socket) {
    const player = this.gameState.players.get(socket.id);
    if (player) {
      this.gameState.removePlayer(socket.id);
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
}

module.exports = GameManager;
