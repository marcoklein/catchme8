import { InputState } from '@shared/types';

// Declare TouchInputManager globally since it's defined elsewhere
declare global {
  interface Window {
    input?: InputManager;
  }
}

export class InputManager {
  private keys: { [key: string]: boolean } = {};
  private inputState: InputState = {
    up: false,
    down: false,
    left: false,
    right: false,
    touchX: 0,
    touchY: 0,
    isTouchActive: false,
    timestamp: 0,
  };
  private lastInputSent = Date.now();
  private inputSendRate = 1000 / 30; // Send input 30 times per second
  private isMobile: boolean;
  private touchInput?: any; // TouchInputManager type would need to be defined

  constructor() {
    this.isMobile = this.detectMobile();

    // Initialize touch input for mobile devices
    if (this.isMobile && (window as any).TouchInputManager) {
      this.touchInput = new (window as any).TouchInputManager();
    }

    this.setupEventListeners();
  }

  private detectMobile(): boolean {
    return (
      /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      ) || window.innerWidth <= 768
    );
  }

  private setupEventListeners(): void {
    document.addEventListener("keydown", (e) => {
      // Only handle game controls if we're not in an input field
      if (e.target && (e.target as HTMLElement).tagName !== "INPUT" && (e.target as HTMLElement).tagName !== "TEXTAREA") {
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
      if (e.target && (e.target as HTMLElement).tagName !== "INPUT" && (e.target as HTMLElement).tagName !== "TEXTAREA") {
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

  public update(): InputState {
    // Collect current input state (no movement calculation)
    const inputState: InputState = {
      up: this.keys["KeyW"] || this.keys["ArrowUp"] || false,
      down: this.keys["KeyS"] || this.keys["ArrowDown"] || false,
      left: this.keys["KeyA"] || this.keys["ArrowLeft"] || false,
      right: this.keys["KeyD"] || this.keys["ArrowRight"] || false,
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

  private sendInputState(inputState: InputState): void {
    const now = Date.now();
    const hasChanged = this.hasInputChanged(inputState);
    const shouldSend = now - this.lastInputSent >= this.inputSendRate;

    if (hasChanged || shouldSend) {
      // Send via network manager - assume it's available globally
      const network = (window as any).network;
      if (network) {
        network.sendInputState(inputState);
      }
      this.lastInputSent = now;
      this.inputState = inputState;
    }
  }

  private hasInputChanged(newInputState: InputState): boolean {
    return (
      newInputState.up !== this.inputState.up ||
      newInputState.down !== this.inputState.down ||
      newInputState.left !== this.inputState.left ||
      newInputState.right !== this.inputState.right ||
      Math.abs((newInputState.touchX || 0) - (this.inputState.touchX || 0)) > 0.01 ||
      Math.abs((newInputState.touchY || 0) - (this.inputState.touchY || 0)) > 0.01 ||
      newInputState.isTouchActive !== this.inputState.isTouchActive
    );
  }

  public isMoving(): boolean {
    return (
      this.inputState.up ||
      this.inputState.down ||
      this.inputState.left ||
      this.inputState.right ||
      this.inputState.isTouchActive
    );
  }
}