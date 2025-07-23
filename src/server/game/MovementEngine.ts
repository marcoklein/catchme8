import { InputState, MovementResult } from '@shared/types';
import { Player } from './Player';

export class MovementEngine {
  // Calculate movement based on input state and player properties
  public static calculateMovement(player: Player, deltaTime: number): MovementResult {
    if (!player.currentInput || player.isStunned) {
      return { dx: 0, dy: 0, isValid: true };
    }

    const input = player.currentInput;
    let dx = 0;
    let dy = 0;

    // Handle keyboard input
    if (input.up) dy -= 1;
    if (input.down) dy += 1;
    if (input.left) dx -= 1;
    if (input.right) dx += 1;

    // Handle touch input (overrides keyboard)
    if (input.isTouchActive && input.touchX !== undefined && input.touchY !== undefined) {
      dx = input.touchX;
      dy = input.touchY;
    }

    // Normalize diagonal movement
    const magnitude = Math.sqrt(dx * dx + dy * dy);
    if (magnitude > 1) {
      dx /= magnitude;
      dy /= magnitude;
    }

    // Apply speed and time scaling
    const currentSpeed = player.isIt ? player.speed * 1.3 : player.speed; // IT players get 30% speed boost
    const moveDistance = currentSpeed * (deltaTime / 1000);

    dx *= moveDistance;
    dy *= moveDistance;

    return { dx, dy, isValid: true };
  }

  // Validate movement bounds and obstacles
  public static validateMovement(
    player: Player,
    dx: number,
    dy: number,
    gameWidth: number,
    gameHeight: number,
    obstacles: Array<{ x: number; y: number; width?: number; height?: number; radius?: number; type: string }>
  ): { x: number; y: number; isValid: boolean } {
    let newX = player.x + dx;
    let newY = player.y + dy;

    // Keep player within bounds
    newX = Math.max(player.radius, Math.min(gameWidth - player.radius, newX));
    newY = Math.max(player.radius, Math.min(gameHeight - player.radius, newY));

    // Check for obstacle collisions
    const wouldCollide = this.checkObstacleCollision(newX, newY, player.radius, obstacles);

    if (!wouldCollide) {
      return { x: newX, y: newY, isValid: true };
    }

    // Try moving only in X direction
    if (!this.checkObstacleCollision(newX, player.y, player.radius, obstacles)) {
      return { x: newX, y: player.y, isValid: true };
    }

    // Try moving only in Y direction
    if (!this.checkObstacleCollision(player.x, newY, player.radius, obstacles)) {
      return { x: player.x, y: newY, isValid: true };
    }

    // No valid movement
    return { x: player.x, y: player.y, isValid: false };
  }

  // Check if a position would collide with obstacles
  private static checkObstacleCollision(
    x: number,
    y: number,
    radius: number,
    obstacles: Array<{ x: number; y: number; width?: number; height?: number; radius?: number; type: string }>
  ): boolean {
    for (const obstacle of obstacles) {
      if (obstacle.type === 'rectangle' && obstacle.width && obstacle.height) {
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
      } else if (obstacle.type === 'circle' && obstacle.radius) {
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

  // Calculate path to target (for AI)
  public static calculatePathToTarget(
    startX: number,
    startY: number,
    targetX: number,
    targetY: number,
    speed: number,
    deltaTime: number
  ): MovementResult {
    const dx = targetX - startX;
    const dy = targetY - startY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < 1) {
      return { dx: 0, dy: 0, isValid: true };
    }

    // Normalize and apply speed
    const normalizedDx = (dx / distance) * speed * (deltaTime / 1000);
    const normalizedDy = (dy / distance) * speed * (deltaTime / 1000);

    return { dx: normalizedDx, dy: normalizedDy, isValid: true };
  }

  // Anti-cheat: Validate input state
  public static validateInputState(input: InputState): boolean {
    // Check boolean values
    if (
      typeof input.up !== 'boolean' ||
      typeof input.down !== 'boolean' ||
      typeof input.left !== 'boolean' ||
      typeof input.right !== 'boolean' ||
      typeof input.isTouchActive !== 'boolean'
    ) {
      return false;
    }

    // Validate touch inputs if active
    if (input.isTouchActive) {
      if (
        typeof input.touchX !== 'number' ||
        typeof input.touchY !== 'number' ||
        Math.abs(input.touchX) > 1.1 ||
        Math.abs(input.touchY) > 1.1
      ) {
        return false;
      }
    }

    return true;
  }
}