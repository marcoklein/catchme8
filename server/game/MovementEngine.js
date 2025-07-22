class MovementEngine {
  static calculateMovement(player, deltaTime) {
    if (!player.currentInput) return { dx: 0, dy: 0 };

    // Check if player is stunned - return zero movement if so
    if (player.isStunned) {
      return { dx: 0, dy: 0 };
    }

    const input = player.currentInput;
    let dx = 0,
      dy = 0;

    // Desktop input processing
    if (input.up) dy -= 1;
    if (input.down) dy += 1;
    if (input.left) dx -= 1;
    if (input.right) dx += 1;

    // Mobile touch input processing (takes precedence if active)
    if (input.isTouchActive) {
      dx = input.touchX || 0;
      dy = input.touchY || 0;
    }

    // Return zero movement if no input is active
    if (dx === 0 && dy === 0 && !input.isTouchActive) {
      return { dx: 0, dy: 0 };
    }

    // Apply server-side movement rules
    return this.normalizeMovement(dx, dy, player, deltaTime);
  }

  static normalizeMovement(dx, dy, player, deltaTime) {
    // Server-authoritative normalization
    const magnitude = Math.sqrt(dx * dx + dy * dy);

    if (magnitude > 1.0) {
      dx = dx / magnitude;
      dy = dy / magnitude;
    }

    // Apply player-specific modifiers
    const speedMultiplier = player.isIt ? 1.3 : 1.0;
    const finalSpeed = player.speed * speedMultiplier;

    return {
      dx: dx * finalSpeed * (deltaTime / 1000),
      dy: dy * finalSpeed * (deltaTime / 1000),
    };
  }

  static applyPhysics(player, movement, gameState) {
    const { dx, dy } = movement;

    // Store previous position for validation
    const prevX = player.x;
    const prevY = player.y;

    // Calculate new position
    let newX = player.x + dx;
    let newY = player.y + dy;

    // Boundary checking
    newX = Math.max(
      player.radius,
      Math.min(gameState.gameWidth - player.radius, newX)
    );
    newY = Math.max(
      player.radius,
      Math.min(gameState.gameHeight - player.radius, newY)
    );

    // Collision detection with obstacles
    if (
      !this.checkObstacleCollisions(newX, newY, player, gameState.obstacles)
    ) {
      player.x = newX;
      player.y = newY;
    } else {
      // Try partial movement (slide along obstacles)
      this.attemptPartialMovement(player, dx, dy, gameState);
    }

    // Update velocity for prediction
    player.velocity = { dx, dy };
    player.lastUpdate = Date.now();

    return { x: player.x, y: player.y };
  }

  static checkObstacleCollisions(x, y, player, obstacles) {
    for (const obstacle of obstacles) {
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

        const distance = Math.sqrt((x - closestX) ** 2 + (y - closestY) ** 2);
        if (distance < player.radius) {
          return true;
        }
      } else if (obstacle.type === "circle") {
        // Check circle-circle collision
        const distance = Math.sqrt(
          (x - obstacle.x) ** 2 + (y - obstacle.y) ** 2
        );
        if (distance < player.radius + obstacle.radius) {
          return true;
        }
      }
    }
    return false;
  }

  static attemptPartialMovement(player, dx, dy, gameState) {
    const stepSize = 0.1;
    const maxMovement = Math.max(Math.abs(dx), Math.abs(dy));
    const steps = Math.max(1, Math.ceil(maxMovement / stepSize));

    const stepX = dx / steps;
    const stepY = dy / steps;

    for (let i = 0; i < steps; i++) {
      const testX = player.x + stepX;
      const testY = player.y + stepY;

      if (
        !this.checkObstacleCollisions(testX, testY, player, gameState.obstacles)
      ) {
        player.x = testX;
        player.y = testY;
      } else {
        // Try moving only in X direction
        if (
          !this.checkObstacleCollisions(
            testX,
            player.y,
            player,
            gameState.obstacles
          )
        ) {
          player.x = testX;
        }
        // Try moving only in Y direction
        else if (
          !this.checkObstacleCollisions(
            player.x,
            testY,
            player,
            gameState.obstacles
          )
        ) {
          player.y = testY;
        } else {
          // Can't move further, stop here
          break;
        }
      }
    }
  }
}

module.exports = MovementEngine;
