class InputManager {
  constructor() {
    this.keys = {};
    this.movement = { dx: 0, dy: 0 };
    this.lastMovementSent = Date.now();
    this.movementSendRate = 1000 / 30; // Send movement 30 times per second
    this.isMobile = this.detectMobile();

    // Initialize touch input for mobile devices
    if (this.isMobile) {
      this.touchInput = new TouchInputManager();
    }

    this.setupEventListeners();
  }

  detectMobile() {
    return (
      /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      ) || window.innerWidth <= 768
    );
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

    // Check for touch input first (mobile)
    if (this.isMobile && this.touchInput) {
      const touchMovement = this.touchInput.getMovement();
      dx = touchMovement.dx;
      dy = touchMovement.dy;

      // Apply mobile speed adjustment - reduce touch sensitivity
      const mobileSpeedMultiplier = 0.7; // Reduce mobile speed by 30%
      dx *= mobileSpeedMultiplier;
      dy *= mobileSpeedMultiplier;
    } else {
      // WASD controls (desktop)
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
    }

    // Always normalize movement to ensure consistent speed
    const magnitude = Math.sqrt(dx * dx + dy * dy);
    if (magnitude > 0) {
      // Normalize to unit vector, then scale appropriately
      dx = (dx / magnitude) * Math.min(magnitude, 1.0);
      dy = (dy / magnitude) * Math.min(magnitude, 1.0);
    }

    const now = Date.now();
    const shouldSend = now - this.lastMovementSent >= this.movementSendRate;

    // Send movement if it changed OR if enough time has passed (for continuous movement)
    if (
      dx !== this.movement.dx ||
      dy !== this.movement.dy ||
      (shouldSend && (dx !== 0 || dy !== 0))
    ) {
      // Store previous movement to detect stopping
      const wasMoving = this.movement.dx !== 0 || this.movement.dy !== 0;
      const isNowStopped = dx === 0 && dy === 0;

      this.movement = { dx, dy };
      network.sendMovement(this.movement);
      this.lastMovementSent = now;

      // If player just stopped, immediately send another stop signal for better sync
      if (wasMoving && isNowStopped) {
        setTimeout(() => {
          network.sendMovement({ dx: 0, dy: 0 });
        }, 16); // Send stop confirmation after one frame
      }
    }

    return this.movement;
  }

  isMoving() {
    return this.movement.dx !== 0 || this.movement.dy !== 0;
  }
}

// Global input manager instance
const input = new InputManager();

// Make input accessible globally for renderer
window.input = input;
