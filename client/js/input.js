class InputManager {
  constructor() {
    this.keys = {};
    this.movement = { dx: 0, dy: 0 };
    this.lastMovementSent = Date.now();
    this.movementSendRate = 1000 / 30; // Send movement 30 times per second
    this.setupEventListeners();
  }

  setupEventListeners() {
    document.addEventListener("keydown", (e) => {
      // Only handle game controls if we're not in an input field
      if (e.target.tagName !== "INPUT" && e.target.tagName !== "TEXTAREA") {
        this.keys[e.code] = true;

        // Only prevent default for game control keys
        if (
          [
            "KeyW",
            "KeyA",
            "KeyS",
            "KeyD",
            "ArrowUp",
            "ArrowDown",
            "ArrowLeft",
            "ArrowRight",
          ].includes(e.code)
        ) {
          e.preventDefault();
        }
      }
    });

    document.addEventListener("keyup", (e) => {
      // Only handle game controls if we're not in an input field
      if (e.target.tagName !== "INPUT" && e.target.tagName !== "TEXTAREA") {
        this.keys[e.code] = false;

        // Only prevent default for game control keys
        if (
          [
            "KeyW",
            "KeyA",
            "KeyS",
            "KeyD",
            "ArrowUp",
            "ArrowDown",
            "ArrowLeft",
            "ArrowRight",
          ].includes(e.code)
        ) {
          e.preventDefault();
        }
      }
    });
  }

  update() {
    let dx = 0;
    let dy = 0;

    // WASD controls
    if (this.keys["KeyW"] || this.keys["ArrowUp"]) {
      dy = -1;
    }
    if (this.keys["KeyS"] || this.keys["ArrowDown"]) {
      dy = 1;
    }
    if (this.keys["KeyA"] || this.keys["ArrowLeft"]) {
      dx = -1;
    }
    if (this.keys["KeyD"] || this.keys["ArrowRight"]) {
      dx = 1;
    }

    // Normalize diagonal movement
    if (dx !== 0 && dy !== 0) {
      dx *= 0.707; // 1/sqrt(2)
      dy *= 0.707;
    }

    const now = Date.now();
    const shouldSend = now - this.lastMovementSent >= this.movementSendRate;

    // Send movement if it changed OR if enough time has passed (for continuous movement)
    if (
      dx !== this.movement.dx ||
      dy !== this.movement.dy ||
      (shouldSend && (dx !== 0 || dy !== 0))
    ) {
      this.movement = { dx, dy };
      network.sendMovement(this.movement);
      this.lastMovementSent = now;
    }

    return this.movement;
  }

  isMoving() {
    return this.movement.dx !== 0 || this.movement.dy !== 0;
  }
}

// Global input manager instance
const input = new InputManager();
