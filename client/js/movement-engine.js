// Client-side movement engine for prediction
// Mirrors server-side movement calculations for immediate local response
class ClientMovementEngine {
  static calculateMovement(inputState, deltaTime, playerSpeed = 100, isIt = false, isStunned = false) {
    if (!inputState) return { dx: 0, dy: 0 };

    // Check if player is stunned - return zero movement if so (match server logic)
    if (isStunned) {
      return { dx: 0, dy: 0 };
    }

    let dx = 0, dy = 0;

    // Desktop input processing
    if (inputState.up) dy -= 1;
    if (inputState.down) dy += 1;
    if (inputState.left) dx -= 1;
    if (inputState.right) dx += 1;

    // Mobile touch input processing (takes precedence if active)
    if (inputState.isTouchActive) {
      dx = inputState.touchX || 0;
      dy = inputState.touchY || 0;
    }

    // Apply client-side movement rules (match server logic)
    return this.normalizeMovement(dx, dy, playerSpeed, isIt, deltaTime);
  }

  static normalizeMovement(dx, dy, playerSpeed, isIt, deltaTime) {
    // Client-side normalization (mirror server logic)
    const magnitude = Math.sqrt(dx * dx + dy * dy);

    if (magnitude > 1.0) {
      dx = dx / magnitude;
      dy = dy / magnitude;
    }

    // Apply player-specific modifiers (match server)
    const speedMultiplier = isIt ? 1.3 : 1.0;
    const finalSpeed = playerSpeed * speedMultiplier;

    return {
      dx: dx * finalSpeed * (deltaTime / 1000),
      dy: dy * finalSpeed * (deltaTime / 1000),
    };
  }

  static validatePosition(newX, newY, playerRadius, gameWidth, gameHeight, obstacles) {
    // Boundary checking (match server logic)
    const clampedX = Math.max(
      playerRadius,
      Math.min(gameWidth - playerRadius, newX)
    );
    const clampedY = Math.max(
      playerRadius,
      Math.min(gameHeight - playerRadius, newY)
    );

    // Simple obstacle collision check (simplified for client-side prediction)
    if (obstacles && this.checkObstacleCollisions(clampedX, clampedY, playerRadius, obstacles)) {
      return null; // Invalid position
    }

    return { x: clampedX, y: clampedY };
  }

  static checkObstacleCollisions(x, y, playerRadius, obstacles) {
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
        if (distance < playerRadius) {
          return true;
        }
      } else if (obstacle.type === "circle") {
        // Check circle-circle collision
        const distance = Math.sqrt(
          (x - obstacle.x) ** 2 + (y - obstacle.y) ** 2
        );
        if (distance < playerRadius + obstacle.radius) {
          return true;
        }
      }
    }
    return false;
  }
}

// Global movement engine instance
window.ClientMovementEngine = ClientMovementEngine;