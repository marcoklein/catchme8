class Player {
  constructor(id, name, x = 400, y = 300) {
    this.id = id;
    this.name = name;
    this.x = x;
    this.y = y;
    this.isIt = false;
    this.color = this.generateRandomColor();
    this.radius = 20;
    this.speed = 100; // pixels per second - significantly reduced for very controlled gameplay
    this.lastUpdate = Date.now();
    this.lastMovement = Date.now();
    this.velocity = { dx: 0, dy: 0 }; // Current movement direction

    // Power-up properties
    this.isTransparent = false;
    this.transparencyEndTime = 0;

    // Stun properties
    this.isStunned = false;
    this.stunEndTime = 0;
    this.canCatchAgainTime = 0; // Timeout before being able to catch again

    // Points system properties
    this.score = 0;
    this.totalSuccessfulTags = 0;
    this.totalStarsCollected = 0; // Track stars collected for statistics
    this.timeAsIt = 0; // Total time spent being "IT" (for statistics)
    this.becameItTime = null; // When player became "IT"
    this.lastPointDeduction = null; // Last time points were deducted

    // Stun pulse properties
    this.isPerformingStunPulse = false;
    this.stunPulseStartTime = 0;
    this.stunPulseDuration = 3000; // 3 seconds
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


  distanceTo(other) {
    const dx = this.x - other.x;
    const dy = this.y - other.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  canCatch(other) {
    // Check if we're still in the timeout period after becoming "it"
    if (Date.now() < this.canCatchAgainTime) {
      return false;
    }

    // Check if the target is stunned (can't catch stunned players)
    if (other.isStunned) {
      return false;
    }

    return (
      this.isIt && this.distanceTo(other) <= this.radius + other.radius + 5
    );
  }

  activateTransparency(duration) {
    this.isTransparent = true;
    this.transparencyEndTime = Date.now() + duration;
  }

  // Stun the player for a short duration
  stun(duration = 1000) {
    // Default 1 second stun
    this.isStunned = true;
    this.stunEndTime = Date.now() + duration;
  }

  // Set the timeout before player can catch again
  setCatchTimeout(timeout = 1000) {
    // Default 1 second timeout
    this.canCatchAgainTime = Date.now() + timeout;
  }

  updatePowerUps(currentTime) {
    // Check if transparency expired
    if (this.isTransparent && currentTime >= this.transparencyEndTime) {
      this.isTransparent = false;
      this.transparencyEndTime = 0;
    }

    // Check if stun expired
    if (this.isStunned && currentTime >= this.stunEndTime) {
      this.isStunned = false;
      this.stunEndTime = 0;
    }

    // Update stun pulse animation
    this.updateStunPulse(currentTime);
  }

  // Points system methods
  becomeIt() {
    this.isIt = true;
    this.becameItTime = Date.now();
    this.lastPointDeduction = null;
  }

  stopBeingIt() {
    this.isIt = false;
    if (this.becameItTime) {
      this.timeAsIt += Date.now() - this.becameItTime;
    }
    this.becameItTime = null;
    this.lastPointDeduction = null;
  }

  awardTagPoints() {
    this.score += 100;
    this.totalSuccessfulTags++;
  }

  awardStarPoints() {
    const points = this.isIt ? 50 : 25; // IT players get double points
    this.score += points;
    this.totalStarsCollected++;
    return points;
  }

  deductItPoints(pointsToDeduct) {
    this.score = Math.max(0, this.score - pointsToDeduct);
    this.lastPointDeduction = Date.now();
  }

  startStunPulse() {
    if (this.isIt && !this.isStunned && !this.isPerformingStunPulse) {
      this.isPerformingStunPulse = true;
      this.stunPulseStartTime = Date.now();
      return true;
    }
    return false;
  }

  updateStunPulse(currentTime) {
    // Check if stun pulse animation has finished
    if (this.isPerformingStunPulse) {
      if (currentTime >= this.stunPulseStartTime + this.stunPulseDuration) {
        this.isPerformingStunPulse = false;
        this.stunPulseStartTime = 0;
      }
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
      isStunned: this.isStunned,
      score: this.score,
      isPerformingStunPulse: this.isPerformingStunPulse,
      stunPulseStartTime: this.stunPulseStartTime,
    };
  }
}

module.exports = Player;
