class InputManager {
  constructor() {
    this.keys = {};
    this.inputState = {
      up: false,
      down: false,
      left: false,
      right: false,
      touchX: 0,
      touchY: 0,
      isTouchActive: false,
      timestamp: 0,
    };
    this.lastInputSent = Date.now();
    this.inputSendRate = 1000 / 30; // Send input 30 times per second
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
    // Collect current input state (no movement calculation)
    const inputState = {
      up: this.keys["KeyW"] || this.keys["ArrowUp"],
      down: this.keys["KeyS"] || this.keys["ArrowDown"],
      left: this.keys["KeyA"] || this.keys["ArrowLeft"],
      right: this.keys["KeyD"] || this.keys["ArrowRight"],
      touchX: 0,
      touchY: 0,
      isTouchActive: false,
      timestamp: Date.now(),
    };

    // Add touch input state for mobile
    if (this.isMobile && this.touchInput) {
      const touchInput = this.touchInput.getInputState();
      inputState.touchX = touchInput.dx;
      inputState.touchY = touchInput.dy;
      inputState.isTouchActive = touchInput.isActive;
    }

    // Send input state at regular intervals
    this.sendInputState(inputState);

    return inputState; // Return input state instead of movement
  }

  sendInputState(inputState) {
    const now = Date.now();
    const hasChanged = this.hasInputChanged(inputState);
    const shouldSend = now - this.lastInputSent >= this.inputSendRate;

    if (hasChanged || shouldSend) {
      network.sendInputState(inputState);
      this.lastInputSent = now;
      this.inputState = inputState;
    }
  }

  hasInputChanged(newInputState) {
    return (
      newInputState.up !== this.inputState.up ||
      newInputState.down !== this.inputState.down ||
      newInputState.left !== this.inputState.left ||
      newInputState.right !== this.inputState.right ||
      Math.abs(newInputState.touchX - this.inputState.touchX) > 0.01 ||
      Math.abs(newInputState.touchY - this.inputState.touchY) > 0.01 ||
      newInputState.isTouchActive !== this.inputState.isTouchActive
    );
  }

  isMoving() {
    return (
      this.inputState.up ||
      this.inputState.down ||
      this.inputState.left ||
      this.inputState.right ||
      this.inputState.isTouchActive
    );
  }
}

// Global input manager instance
const input = new InputManager();

// Make input accessible globally for renderer
window.input = input;
