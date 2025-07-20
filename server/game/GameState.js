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
    this.obstacles = this.generateObstacles();
    this.powerUps = this.generatePowerUps();
    this.powerUpRespawnTimer = new Map();
  }

  generateObstacles() {
    // Create some static obstacles
    return [
      // Center obstacle
      { x: 400, y: 300, width: 80, height: 80, type: "rectangle" },
      // Corner obstacles
      { x: 150, y: 150, width: 60, height: 60, type: "rectangle" },
      { x: 650, y: 150, width: 60, height: 60, type: "rectangle" },
      { x: 150, y: 450, width: 60, height: 60, type: "rectangle" },
      { x: 650, y: 450, width: 60, height: 60, type: "rectangle" },
      // Some circular obstacles
      { x: 200, y: 300, radius: 30, type: "circle" },
      { x: 600, y: 300, radius: 30, type: "circle" },
    ];
  }

  generatePowerUps() {
    const powerUps = [];
    const powerUpPositions = [
      { x: 80, y: 80 },
      { x: 720, y: 80 },
      { x: 80, y: 520 },
      { x: 720, y: 520 },
      { x: 300, y: 150 },
      { x: 500, y: 150 },
      { x: 300, y: 450 },
      { x: 500, y: 450 },
    ];

    powerUpPositions.forEach((pos, index) => {
      // Only place power-up if it doesn't collide with obstacles
      if (!this.checkObstacleCollision(pos.x, pos.y, 15)) {
        powerUps.push({
          id: `powerup_${index}`,
          x: pos.x,
          y: pos.y,
          type: 'transparency',
          radius: 15,
          active: true,
          duration: 5000, // 5 seconds
          respawnTime: 15000, // 15 seconds to respawn
        });
      }
    });

    return powerUps;
  }

  findSafeSpawnPosition() {
    const playerRadius = 20;
    const safePositions = [
      { x: 100, y: 100 },
      { x: 700, y: 100 },
      { x: 100, y: 500 },
      { x: 700, y: 500 },
      { x: 400, y: 100 },
      { x: 400, y: 500 },
      { x: 100, y: 300 },
      { x: 700, y: 300 },
    ];

    // Try each safe position
    for (const pos of safePositions) {
      if (!this.checkObstacleCollision(pos.x, pos.y, playerRadius)) {
        // Also check if position is not too close to other players
        let tooClose = false;
        for (const player of this.players.values()) {
          const dx = pos.x - player.x;
          const dy = pos.y - player.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance < playerRadius * 3) {
            tooClose = true;
            break;
          }
        }
        if (!tooClose) {
          return pos;
        }
      }
    }

    // Fallback to center if no safe position found
    return { x: 400, y: 300 };
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
    player.move(
      dx,
      dy,
      deltaTime,
      this.gameWidth,
      this.gameHeight,
      this.obstacles
    );
    return true;
  }

  checkObstacleCollision(x, y, radius) {
    for (const obstacle of this.obstacles) {
      if (obstacle.type === "rectangle") {
        // Check circle-rectangle collision
        const closestX = Math.max(
          obstacle.x - obstacle.width / 2,
          Math.min(x, obstacle.x + obstacle.width / 2)
        );
        const closestY = Math.max(
          obstacle.y - obstacle.height / 2,
          Math.min(y, obstacle.y + obstacle.height / 2)
        );

        const distanceX = x - closestX;
        const distanceY = y - closestY;
        const distanceSquared = distanceX * distanceX + distanceY * distanceY;

        if (distanceSquared < radius * radius) {
          return true;
        }
      } else if (obstacle.type === "circle") {
        // Check circle-circle collision
        const dx = x - obstacle.x;
        const dy = y - obstacle.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < radius + obstacle.radius) {
          return true;
        }
      }
    }
    return false;
  }

  checkPowerUpCollision(player) {
    for (const powerUp of this.powerUps) {
      if (!powerUp.active) continue;
      
      const dx = player.x - powerUp.x;
      const dy = player.y - powerUp.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < player.radius + powerUp.radius) {
        this.collectPowerUp(player, powerUp);
        return powerUp;
      }
    }
    return null;
  }

  collectPowerUp(player, powerUp) {
    // Deactivate the power-up
    powerUp.active = false;
    
    // Apply power-up effect to player
    if (powerUp.type === 'transparency') {
      player.activateTransparency(powerUp.duration);
    }
    
    // Set respawn timer
    this.powerUpRespawnTimer.set(powerUp.id, Date.now() + powerUp.respawnTime);
  }

  updatePowerUps() {
    const now = Date.now();
    
    // Check for power-ups to respawn
    for (const powerUp of this.powerUps) {
      if (!powerUp.active) {
        const respawnTime = this.powerUpRespawnTimer.get(powerUp.id);
        if (respawnTime && now >= respawnTime) {
          powerUp.active = true;
          this.powerUpRespawnTimer.delete(powerUp.id);
        }
      }
    }
    
    // Update player power-up timers
    for (const player of this.players.values()) {
      player.updatePowerUps(now);
    }
  }

  toJSON() {
    return {
      players: Array.from(this.players.values()).map((p) => p.toJSON()),
      gameActive: this.gameActive,
      timeRemaining: this.getTimeRemaining(),
      gameWidth: this.gameWidth,
      gameHeight: this.gameHeight,
      obstacles: this.obstacles,
      powerUps: this.powerUps.filter(p => p.active), // Only send active power-ups
    };
  }
}

module.exports = GameState;
