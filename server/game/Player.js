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

  move(dx, dy, deltaTime, gameWidth, gameHeight) {
    // Store current velocity for prediction
    this.velocity = { dx, dy };

    const moveDistance = this.speed * (deltaTime / 1000);

    // Calculate new position
    let newX = this.x + dx * moveDistance;
    let newY = this.y + dy * moveDistance;

    // Keep player within bounds
    newX = Math.max(this.radius, Math.min(gameWidth - this.radius, newX));
    newY = Math.max(this.radius, Math.min(gameHeight - this.radius, newY));

    this.x = newX;
    this.y = newY;
    this.lastUpdate = Date.now();
  }

  distanceTo(other) {
    const dx = this.x - other.x;
    const dy = this.y - other.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  canCatch(other) {
    return (
      this.isIt && this.distanceTo(other) <= this.radius + other.radius + 5
    );
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
    };
  }
}

module.exports = Player;
