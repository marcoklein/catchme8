const GameState = require("./GameState");
const Player = require("./Player");

class GameManager {
  constructor(io) {
    this.io = io;
    this.gameState = new GameState();
    this.lastUpdate = Date.now();
    this.updateInterval = 1000 / 60; // 60 FPS
    this.lastBroadcast = Date.now();
    this.broadcastInterval = 1000 / 30; // Broadcast at 30 FPS
    this.gameLoop();
  }

  handlePlayerJoin(socket, playerName) {
    // Create new player
    const player = new Player(socket.id, playerName);

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

    if (this.gameState.updatePlayer(socket.id, movement, deltaTime)) {
      // Check for collisions/tags immediately
      this.checkCollisions(socket.id);

      // Update player's last movement time for activity tracking
      const player = this.gameState.players.get(socket.id);
      if (player) {
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

  broadcastGameState() {
    this.io.to("game").emit("gameState", this.gameState.toJSON());
  }

  gameLoop() {
    const now = Date.now();
    const deltaTime = now - this.lastUpdate;

    if (deltaTime >= this.updateInterval) {
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
