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

    // Stars system
    this.stars = this.generateStars();
    this.starRespawnTimer = new Map();
    this.maxActiveStars = 3;
    this.starRespawnInterval = 8000; // 8 seconds base respawn

    // Stun orbs system
    this.stunOrbs = this.generateStunOrbs();
    this.stunOrbRespawnTimer = new Map();
    this.maxActiveStunOrbs = 2;
    this.stunOrbRespawnInterval = 20000; // 20 seconds
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
          type: "transparency",
          radius: 15,
          active: true,
          duration: 5000, // 5 seconds
          respawnTime: 15000, // 15 seconds to respawn
        });
      }
    });

    return powerUps;
  }

  generateStars() {
    const stars = [];
    const starPositions = [
      { x: 200, y: 150 },
      { x: 600, y: 150 },
      { x: 200, y: 450 },
      { x: 600, y: 450 },
      { x: 400, y: 200 },
      { x: 150, y: 300 },
      { x: 650, y: 300 },
      { x: 300, y: 350 },
      { x: 500, y: 350 },
    ];

    // Select 3 random positions for initial stars
    const selectedPositions = [];
    const positionsCopy = [...starPositions]; // Create a copy to avoid modifying original

    while (
      selectedPositions.length < this.maxActiveStars &&
      positionsCopy.length > 0
    ) {
      const randomIndex = Math.floor(Math.random() * positionsCopy.length);
      const pos = positionsCopy.splice(randomIndex, 1)[0];

      // Only place star if it doesn't collide with obstacles
      if (!this.checkObstacleCollision(pos.x, pos.y, 12)) {
        selectedPositions.push(pos);
      }
    }

    // Fallback: if no safe positions found, use default positions anyway
    if (selectedPositions.length === 0) {
      selectedPositions.push(
        { x: 100, y: 100 },
        { x: 700, y: 100 },
        { x: 400, y: 500 }
      );
    }

    // Ensure we have at least maxActiveStars positions
    while (selectedPositions.length < this.maxActiveStars) {
      selectedPositions.push({
        x: 100 + Math.random() * 600,
        y: 100 + Math.random() * 400,
      });
    }

    selectedPositions.forEach((pos, index) => {
      stars.push({
        id: `star_${index}`,
        x: pos.x,
        y: pos.y,
        type: "star",
        radius: 12,
        active: true,
        spawnTime: Date.now(),
        rotationAngle: Math.random() * Math.PI * 2, // Random initial rotation
      });
    });

    return stars;
  }

  generateStunOrbs() {
    const stunOrbs = [];
    const stunOrbPositions = [
      { x: 120, y: 200 },
      { x: 680, y: 200 },
      { x: 120, y: 400 },
      { x: 680, y: 400 },
      { x: 400, y: 120 },
      { x: 400, y: 480 },
      { x: 250, y: 300 },
      { x: 550, y: 300 },
    ];

    // Select 2 random positions for initial stun orbs
    const selectedPositions = [];
    const positionsCopy = [...stunOrbPositions];

    while (
      selectedPositions.length < this.maxActiveStunOrbs &&
      positionsCopy.length > 0
    ) {
      const randomIndex = Math.floor(Math.random() * positionsCopy.length);
      const pos = positionsCopy.splice(randomIndex, 1)[0];

      if (!this.checkObstacleCollision(pos.x, pos.y, 15)) {
        selectedPositions.push(pos);
      }
    }

    // Fallback: if no safe positions found, use default positions anyway
    if (selectedPositions.length === 0) {
      selectedPositions.push({ x: 100, y: 100 }, { x: 700, y: 100 });
    }

    // Ensure we have at least maxActiveStunOrbs positions
    while (selectedPositions.length < this.maxActiveStunOrbs) {
      selectedPositions.push({
        x: 100 + Math.random() * 600,
        y: 100 + Math.random() * 400,
      });
    }

    selectedPositions.forEach((pos, index) => {
      stunOrbs.push({
        id: `stunorb_${index}`,
        x: pos.x,
        y: pos.y,
        type: "stunOrb",
        radius: 15,
        active: true,
        spawnTime: Date.now(),
        electricPhase: Math.random() * Math.PI * 2, // For animation
      });
    });

    return stunOrbs;
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
      player.becomeIt();
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
      newItPlayer.becomeIt();
    }

    // Stop game if not enough players
    if (this.players.size < this.minPlayers) {
      this.stopGame();
    }

    return true;
  }

  // Ensure there's always exactly one "it" player
  ensureItPlayer() {
    if (this.players.size === 0) return;

    const itPlayers = Array.from(this.players.values()).filter((p) => p.isIt);

    if (itPlayers.length === 0) {
      // No "it" player - assign one randomly
      const playerIds = Array.from(this.players.keys());
      const randomId = playerIds[Math.floor(Math.random() * playerIds.length)];
      const newItPlayer = this.players.get(randomId);
      newItPlayer.becomeIt();
      console.log(
        `Assigned new "it" player: ${newItPlayer.name} (${randomId})`
      );
    } else if (itPlayers.length > 1) {
      // Multiple "it" players - keep only one
      for (let i = 1; i < itPlayers.length; i++) {
        itPlayers[i].stopBeingIt();
      }
      console.log(`Fixed multiple "it" players, kept: ${itPlayers[0].name}`);
    }
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
      // Award points for successful tag
      tagger.awardTagPoints();

      // Transfer "IT" status using new methods
      tagger.stopBeingIt();
      target.becomeIt();

      // Stun the player who was just caught (1 second)
      target.stun(1000);

      // Set timeout before the new "IT" player can catch again (1 second)
      target.setCatchTimeout(1000);

      return true;
    }

    return false;
  }

  updatePlayer(playerId, movement, deltaTime) {
    const player = this.players.get(playerId);
    if (!player) return false;

    const { dx, dy } = movement;

    // Server-side movement validation to prevent cheating
    const magnitude = Math.sqrt(dx * dx + dy * dy);
    const maxAllowedSpeed = 1.1; // Allow slight tolerance for floating point precision

    if (magnitude > maxAllowedSpeed) {
      // Log suspicious movement for monitoring
      console.warn(
        `Player ${
          player.name
        } (${playerId}) attempted invalid movement: magnitude ${magnitude.toFixed(
          3
        )}`
      );

      // Normalize the movement to maximum allowed speed
      const normalizedDx = magnitude > 0 ? dx / magnitude : 0;
      const normalizedDy = magnitude > 0 ? dy / magnitude : 0;

      this.applyMovementToPlayer(
        player,
        normalizedDx,
        normalizedDy,
        deltaTime
      );
    } else {
      // Movement is within valid range
      this.applyMovementToPlayer(
        player,
        dx,
        dy,
        deltaTime
      );
    }

    return true;
  }

  applyMovementToPlayer(player, dx, dy, deltaTime) {
    // Check if player is stunned - if so, don't allow movement
    if (player.isStunned) {
      return;
    }

    // Store current velocity for prediction
    player.velocity = { dx, dy };

    // Adjust speed based on whether player is "it" (catcher gets speed boost)
    const currentSpeed = player.isIt ? player.speed * 1.3 : player.speed; // 30% speed boost for catcher
    const moveDistance = currentSpeed * (deltaTime / 1000);

    // Calculate new position
    let newX = player.x + dx * moveDistance;
    let newY = player.y + dy * moveDistance;

    // Keep player within bounds
    newX = Math.max(player.radius, Math.min(this.gameWidth - player.radius, newX));
    newY = Math.max(player.radius, Math.min(this.gameHeight - player.radius, newY));

    // Check for obstacle collisions
    const wouldCollide = this.checkObstacleCollision(newX, newY, player.radius);

    if (!wouldCollide) {
      player.x = newX;
      player.y = newY;
    } else {
      // Try moving only in X direction
      if (!this.checkObstacleCollision(newX, player.y, player.radius)) {
        player.x = newX;
      }
      // Try moving only in Y direction
      else if (!this.checkObstacleCollision(player.x, newY, player.radius)) {
        player.y = newY;
      }
      // If both directions would cause collision, don't move
    }

    player.lastUpdate = Date.now();
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
    if (powerUp.type === "transparency") {
      // Don't make AI players transparent (for visibility)
      if (!player.isAI) {
        player.activateTransparency(powerUp.duration);
      }
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

  checkStarCollision(player) {
    for (const star of this.stars) {
      if (!star.active) continue;

      const dx = player.x - star.x;
      const dy = player.y - star.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < player.radius + star.radius) {
        this.collectStar(player, star);
        return star;
      }
    }
    return null;
  }

  checkStunOrbCollision(player) {
    for (const stunOrb of this.stunOrbs) {
      if (!stunOrb.active) continue;

      const dx = player.x - stunOrb.x;
      const dy = player.y - stunOrb.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < player.radius + stunOrb.radius) {
        return stunOrb;
      }
    }
    return null;
  }

  collectStunOrb(player, stunOrb) {
    // Deactivate the stun orb
    stunOrb.active = false;

    // Create explosion effect only for IT players
    if (player.isIt) {
      player.startStunPulse();
      // Execute explosion at the stun orb location instead of around the player
      const affectedPlayers = this.executeStunOrbExplosion(stunOrb, player);

      // Set respawn timer
      this.stunOrbRespawnTimer.set(
        stunOrb.id,
        Date.now() + this.stunOrbRespawnInterval
      );

      return affectedPlayers;
    }

    // Set respawn timer for non-IT collection
    this.stunOrbRespawnTimer.set(
      stunOrb.id,
      Date.now() + this.stunOrbRespawnInterval
    );
    return [];
  }

  executeStunPulse(itPlayer) {
    const stunRadius = 80;
    const stunDuration = 500;
    const affectedPlayers = [];

    for (const [playerId, player] of this.players) {
      if (player.id === itPlayer.id) continue; // Don't stun self

      const dx = player.x - itPlayer.x;
      const dy = player.y - itPlayer.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance <= stunRadius) {
        player.stun(stunDuration);
        affectedPlayers.push({
          id: player.id,
          name: player.name,
        });
      }
    }

    return affectedPlayers;
  }

  executeStunOrbExplosion(stunOrb, itPlayer) {
    // Screen-wide explosion - covers entire game field regardless of distance  
    const explosionRadius = Math.sqrt(this.gameWidth * this.gameWidth + this.gameHeight * this.gameHeight); // Diagonal coverage
    const affectedPlayers = [];

    console.log(`Screen-wide stun orb explosion at (${stunOrb.x}, ${stunOrb.y}) affecting entire game field`);

    for (const [playerId, player] of this.players) {
      if (player.id === itPlayer.id) continue; // Don't stun the IT player who collected it

      // Calculate distance from player to the stun orb explosion center for duration scaling
      const dx = player.x - stunOrb.x;
      const dy = player.y - stunOrb.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Distance-based stun duration: closer players get shorter stun, farther players get longer stun
      let stunDuration;
      if (distance <= 100) {
        stunDuration = 3000; // Close range: 3.0 seconds
      } else if (distance <= 200) {
        stunDuration = 4000; // Medium range: 4.0 seconds  
      } else {
        stunDuration = 5000; // Far range: 5.0 seconds
      }

      player.stun(stunDuration);
      affectedPlayers.push({
        id: player.id,
        name: player.name,
        distance: Math.round(distance),
        stunDuration: stunDuration
      });
      console.log(`Player ${player.name} stunned for ${stunDuration}ms at distance ${Math.round(distance)}px`);
    }

    return affectedPlayers;
  }

  collectStar(player, star) {
    // Deactivate the star
    star.active = false;

    // Award points based on player IT status
    const pointsAwarded = player.awardStarPoints();

    // Set respawn timer
    this.starRespawnTimer.set(star.id, Date.now() + this.starRespawnInterval);

    return pointsAwarded;
  }

  updateStars() {
    const now = Date.now();

    // Update star rotation animations
    for (const star of this.stars) {
      if (star.active) {
        star.rotationAngle += 0.02; // Slow rotation
        if (star.rotationAngle > Math.PI * 2) {
          star.rotationAngle -= Math.PI * 2;
        }
      }
    }

    // Check for stars to respawn
    for (const star of this.stars) {
      if (!star.active) {
        const respawnTime = this.starRespawnTimer.get(star.id);
        if (respawnTime && now >= respawnTime) {
          // Find a new safe position for respawn
          const newPosition = this.findSafeStarPosition();
          if (newPosition) {
            star.x = newPosition.x;
            star.y = newPosition.y;
            star.active = true;
            star.spawnTime = now;
            star.rotationAngle = Math.random() * Math.PI * 2;
            this.starRespawnTimer.delete(star.id);
          }
        }
      }
    }
  }

  updateStunOrbs() {
    const now = Date.now();

    // Update electrical animation phase
    for (const stunOrb of this.stunOrbs) {
      if (stunOrb.active) {
        stunOrb.electricPhase += 0.15; // Fast electrical animation
        if (stunOrb.electricPhase > Math.PI * 2) {
          stunOrb.electricPhase -= Math.PI * 2;
        }
      }
    }

    // Check for stun orbs to respawn
    for (const stunOrb of this.stunOrbs) {
      if (!stunOrb.active) {
        const respawnTime = this.stunOrbRespawnTimer.get(stunOrb.id);
        if (respawnTime && now >= respawnTime) {
          // Find a new safe position for respawn
          const newPosition = this.findSafeStunOrbPosition();
          if (newPosition) {
            stunOrb.x = newPosition.x;
            stunOrb.y = newPosition.y;
            stunOrb.active = true;
            stunOrb.spawnTime = now;
            stunOrb.electricPhase = Math.random() * Math.PI * 2;
            this.stunOrbRespawnTimer.delete(stunOrb.id);
          }
        }
      }
    }
  }

  findSafeStunOrbPosition() {
    const stunOrbPositions = [
      { x: 120, y: 200 },
      { x: 680, y: 200 },
      { x: 120, y: 400 },
      { x: 680, y: 400 },
      { x: 400, y: 120 },
      { x: 400, y: 480 },
      { x: 250, y: 300 },
      { x: 550, y: 300 },
      { x: 300, y: 200 },
      { x: 500, y: 200 },
      { x: 300, y: 400 },
      { x: 500, y: 400 },
    ];

    // Shuffle positions for randomness
    for (let i = stunOrbPositions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [stunOrbPositions[i], stunOrbPositions[j]] = [
        stunOrbPositions[j],
        stunOrbPositions[i],
      ];
    }

    // Find first safe position
    for (const pos of stunOrbPositions) {
      if (!this.checkObstacleCollision(pos.x, pos.y, 15)) {
        // Also check if position is not too close to players
        let tooClose = false;
        for (const player of this.players.values()) {
          const dx = pos.x - player.x;
          const dy = pos.y - player.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance < 60) {
            // Minimum distance from players
            tooClose = true;
            break;
          }
        }
        if (!tooClose) {
          return pos;
        }
      }
    }

    // Fallback to random position
    return {
      x: 120 + Math.random() * 560,
      y: 120 + Math.random() * 360,
    };
  }

  findSafeStarPosition() {
    const starPositions = [
      { x: 200, y: 150 },
      { x: 600, y: 150 },
      { x: 200, y: 450 },
      { x: 600, y: 450 },
      { x: 400, y: 200 },
      { x: 150, y: 300 },
      { x: 650, y: 300 },
      { x: 300, y: 350 },
      { x: 500, y: 350 },
      { x: 250, y: 250 },
      { x: 550, y: 250 },
      { x: 400, y: 400 },
    ];

    // Shuffle positions for randomness
    for (let i = starPositions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [starPositions[i], starPositions[j]] = [
        starPositions[j],
        starPositions[i],
      ];
    }

    // Find first safe position
    for (const pos of starPositions) {
      if (!this.checkObstacleCollision(pos.x, pos.y, 12)) {
        // Also check if position is not too close to players
        let tooClose = false;
        for (const player of this.players.values()) {
          const dx = pos.x - player.x;
          const dy = pos.y - player.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance < 50) {
            // Minimum distance from players
            tooClose = true;
            break;
          }
        }
        if (!tooClose) {
          return pos;
        }
      }
    }

    // Fallback to random position if no safe position found
    return {
      x: 100 + Math.random() * 600,
      y: 100 + Math.random() * 400,
    };
  }

  toJSON() {
    return {
      players: Array.from(this.players.values()).map((p) => p.toJSON()),
      gameActive: this.gameActive,
      timeRemaining: this.getTimeRemaining(),
      gameWidth: this.gameWidth,
      gameHeight: this.gameHeight,
      obstacles: this.obstacles,
      powerUps: this.powerUps.filter((p) => p.active), // Only send active power-ups
      stars: this.stars.filter((s) => s.active), // Only send active stars
      stunOrbs: this.stunOrbs.filter((s) => s.active), // Only send active stun orbs
    };
  }
}

module.exports = GameState;
