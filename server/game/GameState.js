class GameState {
  constructor() {
    this.players = new Map();
    this.gameActive = false;
    this.gameStartTime = null;
    this.gameDuration = 120000; // 2 minutes in milliseconds
    this.gameWidth = 800;
    this.gameHeight = 600;
    this.minPlayers = 2;
    this.maxPlayers = 8;
  }

  addPlayer(player) {
    if (this.players.size >= this.maxPlayers) {
      return false;
    }

    this.players.set(player.id, player);

    // If this is the first player, make them "it"
    if (this.players.size === 1) {
      player.isIt = true;
    }

    // Start game if we have minimum players
    if (this.players.size >= this.minPlayers && !this.gameActive) {
      this.startGame();
    }

    return true;
  }

  removePlayer(playerId) {
    const player = this.players.get(playerId);
    if (!player) return false;

    const wasIt = player.isIt;
    this.players.delete(playerId);

    // If the "it" player left, assign new "it" player
    if (wasIt && this.players.size > 0) {
      const newItPlayer = this.players.values().next().value;
      newItPlayer.isIt = true;
    }

    // Stop game if not enough players
    if (this.players.size < this.minPlayers) {
      this.stopGame();
    }

    return true;
  }

  startGame() {
    this.gameActive = true;
    this.gameStartTime = Date.now();
  }

  stopGame() {
    this.gameActive = false;
    this.gameStartTime = null;
  }

  isGameOver() {
    if (!this.gameActive) return false;
    return Date.now() - this.gameStartTime > this.gameDuration;
  }

  getTimeRemaining() {
    if (!this.gameActive) return 0;
    const elapsed = Date.now() - this.gameStartTime;
    return Math.max(0, this.gameDuration - elapsed);
  }

  tagPlayer(taggerId, targetId) {
    const tagger = this.players.get(taggerId);
    const target = this.players.get(targetId);

    if (!tagger || !target || !tagger.isIt || tagger.id === target.id) {
      return false;
    }

    if (tagger.canCatch(target)) {
      tagger.isIt = false;
      target.isIt = true;
      return true;
    }

    return false;
  }

  updatePlayer(playerId, movement, deltaTime) {
    const player = this.players.get(playerId);
    if (!player) return false;

    const { dx, dy } = movement;
    player.move(dx, dy, deltaTime, this.gameWidth, this.gameHeight);
    return true;
  }

  toJSON() {
    return {
      players: Array.from(this.players.values()).map((p) => p.toJSON()),
      gameActive: this.gameActive,
      timeRemaining: this.getTimeRemaining(),
      gameWidth: this.gameWidth,
      gameHeight: this.gameHeight,
    };
  }
}

module.exports = GameState;
