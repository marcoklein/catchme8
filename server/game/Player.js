class Player {
  constructor(id, name, x = 400, y = 300) {
    this.id = id;
    this.name = name;
    this.x = x;
    this.y = y;
    this.isIt = false;
    this.color = this.generateRandomColor();
    this.radius = 20;
    this.speed = 200; // pixels per second
    this.lastUpdate = Date.now();
    this.lastMovement = Date.now();
    this.velocity = { dx: 0, dy: 0 }; // Current movement direction
    
    // Power-up properties
    this.isTransparent = false;
    this.transparencyEndTime = 0;
  }

  generateRandomColor() {
    const colors = [
      "#FF6B6B",
      "#4ECDC4",
      "#45B7D1",
      "#96CEB4",
      "#FFEAA7",
      "#DDA0DD",
      "#98D8C8",
      "#F7DC6F",
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  update(deltaTime) {
    this.lastUpdate = Date.now();
  }

  move(dx, dy, deltaTime, gameWidth, gameHeight, obstacles = []) {
    // Store current velocity for prediction
    this.velocity = { dx, dy };

    const moveDistance = this.speed * (deltaTime / 1000);

    // Calculate new position
    let newX = this.x + dx * moveDistance;
    let newY = this.y + dy * moveDistance;

    // Keep player within bounds
    newX = Math.max(this.radius, Math.min(gameWidth - this.radius, newX));
    newY = Math.max(this.radius, Math.min(gameHeight - this.radius, newY));

    // Check for obstacle collisions
    const wouldCollide = this.checkObstacleCollision(newX, newY, obstacles);

    if (!wouldCollide) {
      this.x = newX;
      this.y = newY;
    } else {
      // Try moving only in X direction
      if (!this.checkObstacleCollision(newX, this.y, obstacles)) {
        this.x = newX;
      }
      // Try moving only in Y direction
      else if (!this.checkObstacleCollision(this.x, newY, obstacles)) {
        this.y = newY;
      }
      // If both directions would cause collision, don't move
    }

    this.lastUpdate = Date.now();
  }

  checkObstacleCollision(x, y, obstacles) {
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

        const distanceX = x - closestX;
        const distanceY = y - closestY;
        const distanceSquared = distanceX * distanceX + distanceY * distanceY;

        if (distanceSquared < this.radius * this.radius) {
          return true;
        }
      } else if (obstacle.type === "circle") {
        // Check circle-circle collision
        const dx = x - obstacle.x;
        const dy = y - obstacle.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < this.radius + obstacle.radius) {
          return true;
        }
      }
    }
    return false;
  }

  distanceTo(other) {
    const dx = this.x - other.x;
    const dy = this.y - other.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  canCatch(other) {
    // Can't catch transparent players
    if (other.isTransparent) return false;
    
    return (
      this.isIt && this.distanceTo(other) <= this.radius + other.radius + 5
    );
  }

  activateTransparency(duration) {
    this.isTransparent = true;
    this.transparencyEndTime = Date.now() + duration;
  }

  updatePowerUps(currentTime) {
    // Check if transparency expired
    if (this.isTransparent && currentTime >= this.transparencyEndTime) {
      this.isTransparent = false;
      this.transparencyEndTime = 0;
    }
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      x: this.x,
      y: this.y,
      isIt: this.isIt,
      color: this.color,
      radius: this.radius,
      isTransparent: this.isTransparent,
    };
  }
}

module.exports = Player;
