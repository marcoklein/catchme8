const Player = require("./Player");

class AIPlayer extends Player {
  constructor(id, name, x = 400, y = 300) {
    super(id, name, x, y);
    this.isAI = true;
    this.lastDecisionTime = Date.now();
    this.decisionInterval = 100; // Make decisions every 100ms
    this.targetPosition = null;
    this.currentBehavior = "wander"; // wander, chase, flee, collect_powerup
    this.pathfinding = null;
    this.personalityTraits = this.generatePersonality();
    this.lastMovement = { dx: 0, dy: 0 };
    this.stuckCounter = 0;
    this.lastPosition = { x: this.x, y: this.y };
  }

  generatePersonality() {
    return {
      aggressiveness: Math.random(), // 0-1, affects chasing behavior
      fearfulness: Math.random(), // 0-1, affects fleeing behavior
      curiosity: Math.random(), // 0-1, affects power-up seeking
      intelligence: Math.random(), // 0-1, affects pathfinding quality
    };
  }

  // Override toJSON to include AI-specific properties
  toJSON() {
    const playerData = super.toJSON();
    return {
      ...playerData,
      isAI: this.isAI,
      currentBehavior: this.currentBehavior,
    };
  }

  // Simple wandering behavior for Phase 1
  makeDecision(gameState) {
    const now = Date.now();
    if (now - this.lastDecisionTime < this.decisionInterval) {
      return this.lastMovement;
    }

    this.lastDecisionTime = now;

    // Check if stuck (not moved much in last few updates)
    const distanceMoved = Math.sqrt(
      Math.pow(this.x - this.lastPosition.x, 2) +
        Math.pow(this.y - this.lastPosition.y, 2)
    );

    if (distanceMoved < 5) {
      this.stuckCounter++;
    } else {
      this.stuckCounter = 0;
      this.lastPosition = { x: this.x, y: this.y };
    }

    // If stuck, try a different direction
    if (this.stuckCounter > 10) {
      this.stuckCounter = 0;
      return this.generateRandomMovement();
    }

    // Basic wandering behavior
    return this.wanderBehavior(gameState);
  }

  wanderBehavior(gameState) {
    // Simple wandering: mostly continue in current direction with occasional changes
    if (Math.random() < 0.1) {
      // 10% chance to change direction
      return this.generateRandomMovement();
    }

    // Continue in roughly the same direction with small variations
    let dx = this.lastMovement.dx + (Math.random() - 0.5) * 0.4;
    let dy = this.lastMovement.dy + (Math.random() - 0.5) * 0.4;

    // Normalize if too large
    const magnitude = Math.sqrt(dx * dx + dy * dy);
    if (magnitude > 1) {
      dx /= magnitude;
      dy /= magnitude;
    }

    // Avoid edges of the game field
    const edgeBuffer = 50;
    if (this.x < edgeBuffer) dx = Math.abs(dx);
    if (this.x > gameState.gameWidth - edgeBuffer) dx = -Math.abs(dx);
    if (this.y < edgeBuffer) dy = Math.abs(dy);
    if (this.y > gameState.gameHeight - edgeBuffer) dy = -Math.abs(dy);

    this.lastMovement = { dx, dy };
    return this.lastMovement;
  }

  generateRandomMovement() {
    const angle = Math.random() * Math.PI * 2;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    this.lastMovement = { dx, dy };
    return this.lastMovement;
  }

  // Method to update AI behavior (will be expanded in later phases)
  updateBehavior(gameState) {
    if (this.isIt) {
      // If AI is "IT", switch to chase behavior
      this.currentBehavior = "chase";
    } else {
      // Check if "IT" player is nearby and switch to flee behavior
      const itPlayer = Array.from(gameState.players.values()).find(
        (p) => p.isIt
      );
      if (itPlayer && this.distanceTo(itPlayer) < 100) {
        this.currentBehavior = "flee";
      } else {
        // Check for nearby power-ups
        const nearbyPowerUp = this.findNearestPowerUp(gameState.powerUps);
        if (nearbyPowerUp && this.distanceTo(nearbyPowerUp) < 150) {
          this.currentBehavior = "collect_powerup";
          this.targetPosition = { x: nearbyPowerUp.x, y: nearbyPowerUp.y };
        } else {
          this.currentBehavior = "wander";
        }
      }
    }
  }

  // Find the nearest power-up
  findNearestPowerUp(powerUps) {
    let nearest = null;
    let minDistance = Infinity;

    for (const powerUp of powerUps) {
      if (!powerUp.active) continue;

      const distance = this.distanceTo(powerUp);
      if (distance < minDistance) {
        minDistance = distance;
        nearest = powerUp;
      }
    }

    return nearest;
  }

  // Find the nearest catchable player when AI is "IT"
  findNearestTarget(gameState) {
    let nearest = null;
    let minDistance = Infinity;

    for (const [playerId, player] of gameState.players) {
      if (player.id === this.id || player.isIt) continue;

      const distance = this.distanceTo(player);
      if (distance < minDistance) {
        minDistance = distance;
        nearest = player;
      }
    }

    return nearest;
  }

  // Chase behavior when AI is "IT"
  chaseBehavior(gameState) {
    const target = this.findNearestTarget(gameState);
    if (!target) {
      return this.wanderBehavior(gameState);
    }

    // Calculate direction to target
    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance === 0) {
      return { dx: 0, dy: 0 };
    }

    // Normalize direction
    let moveX = dx / distance;
    let moveY = dy / distance;

    // Add some intelligence based on personality
    const intelligence = this.personalityTraits.intelligence;
    const aggressiveness = this.personalityTraits.aggressiveness;

    // Predict target movement if AI is intelligent enough
    if (intelligence > 0.5 && target.velocity) {
      const predictionTime = intelligence * 0.5; // Up to 0.5 seconds of prediction
      const predictedX =
        target.x + target.velocity.dx * target.speed * predictionTime;
      const predictedY =
        target.y + target.velocity.dy * target.speed * predictionTime;

      // Calculate direction to predicted position
      const predDx = predictedX - this.x;
      const predDy = predictedY - this.y;
      const predDistance = Math.sqrt(predDx * predDx + predDy * predDy);

      if (predDistance > 0) {
        moveX = predDx / predDistance;
        moveY = predDy / predDistance;
      }
    }

    // Adjust movement based on aggressiveness
    const intensity = 0.7 + aggressiveness * 0.3;
    moveX *= intensity;
    moveY *= intensity;

    // Simple obstacle avoidance
    const avoidance = this.calculateObstacleAvoidance(gameState, moveX, moveY);
    moveX += avoidance.dx;
    moveY += avoidance.dy;

    // Normalize final movement
    const finalMagnitude = Math.sqrt(moveX * moveX + moveY * moveY);
    if (finalMagnitude > 1) {
      moveX /= finalMagnitude;
      moveY /= finalMagnitude;
    }

    this.lastMovement = { dx: moveX, dy: moveY };
    return this.lastMovement;
  }

  // Flee behavior when being chased
  fleeBehavior(gameState) {
    const itPlayer = Array.from(gameState.players.values()).find((p) => p.isIt);
    if (!itPlayer) {
      return this.wanderBehavior(gameState);
    }

    // Calculate direction away from "IT" player
    const dx = this.x - itPlayer.x;
    const dy = this.y - itPlayer.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance === 0) {
      return this.generateRandomMovement();
    }

    // Normalize direction (away from IT player)
    let moveX = dx / distance;
    let moveY = dy / distance;

    // Add some panic based on fearfulness
    const fearfulness = this.personalityTraits.fearfulness;
    const panicFactor = 0.8 + fearfulness * 0.2;
    moveX *= panicFactor;
    moveY *= panicFactor;

    // Try to use obstacles for cover
    const coverDirection = this.findCoverDirection(gameState, itPlayer);
    if (coverDirection) {
      moveX = (moveX + coverDirection.dx) / 2;
      moveY = (moveY + coverDirection.dy) / 2;
    }

    // Simple obstacle avoidance
    const avoidance = this.calculateObstacleAvoidance(gameState, moveX, moveY);
    moveX += avoidance.dx;
    moveY += avoidance.dy;

    // Normalize final movement
    const finalMagnitude = Math.sqrt(moveX * moveX + moveY * moveY);
    if (finalMagnitude > 1) {
      moveX /= finalMagnitude;
      moveY /= finalMagnitude;
    }

    this.lastMovement = { dx: moveX, dy: moveY };
    return this.lastMovement;
  }

  // Power-up collection behavior
  collectPowerUpBehavior(gameState) {
    if (!this.targetPosition) {
      return this.wanderBehavior(gameState);
    }

    // Move toward target power-up
    const dx = this.targetPosition.x - this.x;
    const dy = this.targetPosition.y - this.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < 20) {
      // Close enough, switch back to other behavior
      this.targetPosition = null;
      return this.wanderBehavior(gameState);
    }

    // Normalize direction
    let moveX = dx / distance;
    let moveY = dy / distance;

    // Add caution based on curiosity (less curious = more careful)
    const curiosity = this.personalityTraits.curiosity;
    const intensity = 0.5 + curiosity * 0.5;
    moveX *= intensity;
    moveY *= intensity;

    // Simple obstacle avoidance
    const avoidance = this.calculateObstacleAvoidance(gameState, moveX, moveY);
    moveX += avoidance.dx;
    moveY += avoidance.dy;

    // Normalize final movement
    const finalMagnitude = Math.sqrt(moveX * moveX + moveY * moveY);
    if (finalMagnitude > 1) {
      moveX /= finalMagnitude;
      moveY /= finalMagnitude;
    }

    this.lastMovement = { dx: moveX, dy: moveY };
    return this.lastMovement;
  }

  // Calculate simple obstacle avoidance
  calculateObstacleAvoidance(gameState, currentDx, currentDy) {
    const avoidanceRadius = 40;
    let avoidanceX = 0;
    let avoidanceY = 0;

    for (const obstacle of gameState.obstacles) {
      let obstacleDistance;

      if (obstacle.type === "rectangle") {
        // Distance to rectangle
        const closestX = Math.max(
          obstacle.x - obstacle.width / 2,
          Math.min(this.x, obstacle.x + obstacle.width / 2)
        );
        const closestY = Math.max(
          obstacle.y - obstacle.height / 2,
          Math.min(this.y, obstacle.y + obstacle.height / 2)
        );

        const dx = this.x - closestX;
        const dy = this.y - closestY;
        obstacleDistance = Math.sqrt(dx * dx + dy * dy);

        if (obstacleDistance < avoidanceRadius && obstacleDistance > 0) {
          const strength =
            (avoidanceRadius - obstacleDistance) / avoidanceRadius;
          avoidanceX += (dx / obstacleDistance) * strength * 0.3;
          avoidanceY += (dy / obstacleDistance) * strength * 0.3;
        }
      } else if (obstacle.type === "circle") {
        // Distance to circle
        const dx = this.x - obstacle.x;
        const dy = this.y - obstacle.y;
        obstacleDistance = Math.sqrt(dx * dx + dy * dy) - obstacle.radius;

        if (obstacleDistance < avoidanceRadius && obstacleDistance > 0) {
          const strength =
            (avoidanceRadius - obstacleDistance) / avoidanceRadius;
          avoidanceX += (dx / Math.sqrt(dx * dx + dy * dy)) * strength * 0.3;
          avoidanceY += (dy / Math.sqrt(dx * dx + dy * dy)) * strength * 0.3;
        }
      }
    }

    return { dx: avoidanceX, dy: avoidanceY };
  }

  // Find direction toward cover (behind obstacles relative to IT player)
  findCoverDirection(gameState, itPlayer) {
    let bestCover = null;
    let bestScore = -1;

    for (const obstacle of gameState.obstacles) {
      // Calculate if obstacle is between AI and IT player
      const toObstacle = { x: obstacle.x - this.x, y: obstacle.y - this.y };
      const toIt = { x: itPlayer.x - this.x, y: itPlayer.y - this.y };

      const obstacleDistance = Math.sqrt(
        toObstacle.x * toObstacle.x + toObstacle.y * toObstacle.y
      );
      const itDistance = Math.sqrt(toIt.x * toIt.x + toIt.y * toIt.y);

      if (obstacleDistance < itDistance) {
        // Obstacle is closer than IT player, good for cover
        const score = itDistance - obstacleDistance;
        if (score > bestScore) {
          bestScore = score;
          const distance = Math.sqrt(
            toObstacle.x * toObstacle.x + toObstacle.y * toObstacle.y
          );
          bestCover = {
            dx: toObstacle.x / distance,
            dy: toObstacle.y / distance,
          };
        }
      }
    }

    return bestCover;
  }
}

module.exports = AIPlayer;
