class TouchInputManager {
  constructor() {
    this.touchState = {
      isActive: false,
      startX: 0,
      startY: 0,
      currentX: 0,
      currentY: 0,
      dx: 0,
      dy: 0,
    };

    this.joystickRadius = 60; // Virtual joystick size
    this.deadZone = 15; // Increased dead zone for better control
    this.maxDistance = 50; // Maximum effective distance (smaller than visual radius)
    this.joystickCenter = { x: 0, y: 0 };
    this.knobPosition = { x: 0, y: 0 };
    this.canvas = null;
    this.movement = { dx: 0, dy: 0 };

    // Sensitivity and responsiveness settings
    this.sensitivity = 0.8; // Reduce overall sensitivity
    this.smoothing = 0.15; // Add smoothing to reduce jittery movement

    this.setupTouchEvents();
  }
  setupTouchEvents() {
    // Get the game canvas for touch events
    this.canvas = document.getElementById("gameCanvas");

    if (!this.canvas) {
      console.warn("TouchInputManager: Game canvas not found, retrying...");
      // Retry after a short delay if canvas isn't ready
      setTimeout(() => {
        this.canvas = document.getElementById("gameCanvas");
        if (this.canvas) {
          this.bindTouchEvents();
        }
      }, 100);
      return;
    }

    this.bindTouchEvents();
  }

  bindTouchEvents() {
    // Prevent default touch behaviors that might interfere
    this.canvas.addEventListener(
      "touchstart",
      this.handleTouchStart.bind(this),
      { passive: false }
    );
    this.canvas.addEventListener("touchmove", this.handleTouchMove.bind(this), {
      passive: false,
    });
    this.canvas.addEventListener("touchend", this.handleTouchEnd.bind(this), {
      passive: false,
    });
    this.canvas.addEventListener(
      "touchcancel",
      this.handleTouchEnd.bind(this),
      { passive: false }
    );

    // Also prevent context menu on long press
    this.canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  handleTouchStart(event) {
    event.preventDefault();

    if (!this.canvas) {
      this.canvas = document.getElementById("gameCanvas");
      if (!this.canvas) return;
    }

    const touch = event.touches[0];
    const rect = this.canvas.getBoundingClientRect();

    // Convert touch coordinates to canvas coordinates
    const canvasX = touch.clientX - rect.left;
    const canvasY = touch.clientY - rect.top;

    // Scale coordinates if canvas is scaled
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;

    this.touchState.startX = canvasX * scaleX;
    this.touchState.startY = canvasY * scaleY;
    this.touchState.currentX = this.touchState.startX;
    this.touchState.currentY = this.touchState.startY;
    this.touchState.isActive = true;

    // Set joystick center to touch start position
    this.joystickCenter.x = this.touchState.startX;
    this.joystickCenter.y = this.touchState.startY;
    this.knobPosition.x = this.touchState.startX;
    this.knobPosition.y = this.touchState.startY;
  }

  handleTouchMove(event) {
    event.preventDefault();

    if (!this.touchState.isActive || !this.canvas) return;

    const touch = event.touches[0];
    const rect = this.canvas.getBoundingClientRect();

    // Convert touch coordinates to canvas coordinates
    const canvasX = touch.clientX - rect.left;
    const canvasY = touch.clientY - rect.top;

    // Scale coordinates if canvas is scaled
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;

    this.touchState.currentX = canvasX * scaleX;
    this.touchState.currentY = canvasY * scaleY;

    // Calculate movement vector from joystick center
    const deltaX = this.touchState.currentX - this.joystickCenter.x;
    const deltaY = this.touchState.currentY - this.joystickCenter.y;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    if (distance > this.deadZone) {
      // Use maxDistance for better control (smaller than visual radius)
      const effectiveDistance = Math.min(distance, this.maxDistance);

      // Limit knob movement to joystick radius for visual feedback
      if (distance > this.joystickRadius) {
        const angle = Math.atan2(deltaY, deltaX);
        this.knobPosition.x =
          this.joystickCenter.x + Math.cos(angle) * this.joystickRadius;
        this.knobPosition.y =
          this.joystickCenter.y + Math.sin(angle) * this.joystickRadius;
      } else {
        this.knobPosition.x = this.touchState.currentX;
        this.knobPosition.y = this.touchState.currentY;
      }

      // Calculate normalized movement using effective distance and apply sensitivity
      const normalizedDistance = effectiveDistance / this.maxDistance;
      const angle = Math.atan2(deltaY, deltaX);

      // Apply sensitivity and create smooth movement curve
      const adjustedIntensity =
        Math.pow(normalizedDistance, 1.2) * this.sensitivity;

      const targetDx = Math.cos(angle) * adjustedIntensity;
      const targetDy = Math.sin(angle) * adjustedIntensity;

      // Apply smoothing to reduce jittery movement
      this.touchState.dx =
        this.touchState.dx * (1 - this.smoothing) + targetDx * this.smoothing;
      this.touchState.dy =
        this.touchState.dy * (1 - this.smoothing) + targetDy * this.smoothing;
    } else {
      // Within dead zone - gradually reduce movement to zero
      this.touchState.dx *= 1 - this.smoothing * 2; // Faster decay in dead zone
      this.touchState.dy *= 1 - this.smoothing * 2;
      this.knobPosition.x = this.joystickCenter.x;
      this.knobPosition.y = this.joystickCenter.y;

      // Stop movement completely if very small
      if (Math.abs(this.touchState.dx) < 0.01) this.touchState.dx = 0;
      if (Math.abs(this.touchState.dy) < 0.01) this.touchState.dy = 0;
    }

    // Update movement for the input system
    this.movement = {
      dx: this.touchState.dx,
      dy: this.touchState.dy,
    };
  }

  handleTouchEnd(event) {
    event.preventDefault();

    this.touchState.isActive = false;

    // Gradually stop movement instead of abrupt stop - with safety timeout
    let stopFrameCount = 0;
    const maxStopFrames = 30; // Safety limit to prevent infinite loops
    
    const stopMovement = () => {
      this.touchState.dx *= 0.7; // Smooth deceleration
      this.touchState.dy *= 0.7;
      stopFrameCount++;

      if (
        (Math.abs(this.touchState.dx) >= 0.05 || Math.abs(this.touchState.dy) >= 0.05) &&
        stopFrameCount < maxStopFrames
      ) {
        this.movement = {
          dx: this.touchState.dx,
          dy: this.touchState.dy,
        };
        requestAnimationFrame(stopMovement);
      } else {
        // Force stop if we hit the safety limit or movement is small enough
        this.touchState.dx = 0;
        this.touchState.dy = 0;
        this.movement = { dx: 0, dy: 0 };
        console.log(`Touch deceleration complete after ${stopFrameCount} frames`);
      }
    };

    stopMovement();

    // Reset knob to center
    this.knobPosition.x = this.joystickCenter.x;
    this.knobPosition.y = this.joystickCenter.y;
  }

  getInputState() {
    return {
      dx: this.touchState.dx,
      dy: this.touchState.dy,
      isActive: this.touchState.isActive,
      timestamp: Date.now(),
    };
  }

  // Keep existing getMovement method for backward compatibility during transition
  getMovement() {
    return this.movement;
  }

  isActive() {
    return this.touchState.isActive;
  }

  renderVirtualJoystick(ctx) {
    if (!this.touchState.isActive) return;

    const { x: centerX, y: centerY } = this.joystickCenter;
    const { x: knobX, y: knobY } = this.knobPosition;

    // Save context state
    ctx.save();

    // Draw joystick base (outer circle)
    ctx.beginPath();
    ctx.arc(centerX, centerY, this.joystickRadius, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw joystick knob (inner circle)
    ctx.beginPath();
    ctx.arc(knobX, knobY, this.joystickRadius * 0.4, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw movement indicator line
    if (this.touchState.dx !== 0 || this.touchState.dy !== 0) {
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(knobX, knobY);
      ctx.strokeStyle = "rgba(100, 200, 255, 0.8)";
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    // Restore context state
    ctx.restore();
  }
}
