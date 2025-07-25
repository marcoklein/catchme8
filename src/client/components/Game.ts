import {
  GameStateData,
  PlayerState,
  InputState,
  Position,
} from "@shared/types";
import { NetworkManager } from "../network/NetworkManager";
import { Renderer } from "./Renderer";
import { InputManager } from "../utils/InputManager";

interface PredictedPlayerState {
  x: number;
  y: number;
  lastUpdate: number;
}

interface CorrectionState {
  startTime: number;
  duration: number;
  startPos: Position;
  targetPos: Position;
  needsCorrection: boolean;
}

export class Game {
  private gameState: GameStateData | null = null;
  private myPlayerId: string | null = null;
  private gameActive = false;
  private lastUpdate = Date.now();

  // Client-side prediction state
  private localPlayerState: PlayerState | null = null;
  private predictedPlayerState: PredictedPlayerState | null = null;
  private lastServerUpdate = Date.now();

  // Correction system
  private correction: CorrectionState = {
    startTime: 0,
    duration: 50,
    startPos: { x: 0, y: 0 },
    targetPos: { x: 0, y: 0 },
    needsCorrection: false,
  };

  // Adaptive correction thresholds (matched to legacy client)
  private baseCorrectionThreshold = 15;
  private maxCorrectionThreshold = 30;
  private lastCorrectionTime = 0;
  private correctionCooldown = 200;
  private consecutiveCorrections = 0;
  private maxConsecutiveCorrections = 5;
  private correctionsDisabled = false;
  private correctionDisableTimeout = 0;

  // Game components
  private network: NetworkManager;
  private renderer: Renderer | null = null;
  private input: InputManager | null = null;

  // Mobile and fullscreen support
  private isMobile = false;
  private isFullscreen = false;
  private canvas: HTMLCanvasElement | null = null;
  private originalCanvasSize = { width: 800, height: 600 };

  constructor() {
    this.network = new NetworkManager();
    (window as any).network = this.network; // Make network globally available for InputManager
    this.detectMobile();
    this.initializeUI();
    this.setupCanvas();
    this.setupFullscreenSupport();
    this.initializeInput();
    this.autoJoinGame();
    this.gameLoop();
  }

  private initializeUI(): void {
    const joinButton = document.getElementById(
      "joinButton"
    ) as HTMLButtonElement;
    const nameInput = document.getElementById("nameInput") as HTMLInputElement;

    if (!joinButton || !nameInput) {
      console.error("UI elements not found!");
      return;
    }

    // Focus the name input for better UX
    nameInput.focus();

    joinButton.addEventListener("click", () => {
      this.joinGame();
    });

    nameInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        this.joinGame();
      }
    });

    nameInput.addEventListener("input", () => {
      // Clear any error messages when typing
      const errorElement = document.getElementById("errorMessage");
      if (errorElement) {
        errorElement.textContent = "";
      }
    });
  }

  private setupCanvas(): void {
    const canvas = document.getElementById("gameCanvas") as HTMLCanvasElement;
    if (!canvas) {
      console.error("Game canvas not found!");
      return;
    }

    this.canvas = canvas;
    this.originalCanvasSize = { width: canvas.width, height: canvas.height };
    this.renderer = new Renderer(canvas);
    (window as any).renderer = this.renderer; // Make globally available
    (window as any).game = this; // Make game globally available for fullscreen toggle
  }

  private initializeInput(): void {
    this.input = new InputManager();
    (window as any).input = this.input; // Make globally available for touch joystick rendering
  }

  private detectMobile(): void {
    this.isMobile =
      /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      ) || window.innerWidth <= 768;
  }

  private setupFullscreenSupport(): void {
    // Enable fullscreen support for all devices

    // Add fullscreen change event listeners
    document.addEventListener("fullscreenchange", () =>
      this.handleFullscreenChange()
    );
    document.addEventListener("webkitfullscreenchange", () =>
      this.handleFullscreenChange()
    );
    document.addEventListener("mozfullscreenchange", () =>
      this.handleFullscreenChange()
    );
    document.addEventListener("MSFullscreenChange", () =>
      this.handleFullscreenChange()
    );

    // Add orientation change listener
    window.addEventListener("orientationchange", () => {
      setTimeout(() => this.handleOrientationChange(), 100);
    });

    // Add resize listener for viewport changes
    window.addEventListener("resize", () => this.handleResize());

    // Prevent zoom on double tap
    let lastTouchEnd = 0;
    document.addEventListener(
      "touchend",
      (event) => {
        const now = new Date().getTime();
        if (now - lastTouchEnd <= 300) {
          event.preventDefault();
        }
        lastTouchEnd = now;
      },
      false
    );
  }

  private isInFullscreen(): boolean {
    return !!(
      document.fullscreenElement ||
      (document as any).webkitFullscreenElement ||
      (document as any).mozFullScreenElement ||
      (document as any).msFullscreenElement
    );
  }

  private enterFullscreen(): void {
    if (!this.canvas || this.isInFullscreen()) return;

    const element = document.documentElement;

    if (element.requestFullscreen) {
      element.requestFullscreen();
    } else if ((element as any).webkitRequestFullscreen) {
      (element as any).webkitRequestFullscreen();
    } else if ((element as any).mozRequestFullScreen) {
      (element as any).mozRequestFullScreen();
    } else if ((element as any).msRequestFullscreen) {
      (element as any).msRequestFullscreen();
    }
  }

  private exitFullscreen(): void {
    if (!this.isInFullscreen()) return;

    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if ((document as any).webkitExitFullscreen) {
      (document as any).webkitExitFullscreen();
    } else if ((document as any).mozCancelFullScreen) {
      (document as any).mozCancelFullScreen();
    } else if ((document as any).msExitFullscreen) {
      (document as any).msExitFullscreen();
    }
  }

  public toggleFullscreen(): void {
    if (this.isInFullscreen()) {
      this.exitFullscreen();
    } else {
      this.enterFullscreen();
    }
  }

  private handleFullscreenChange(): void {
    this.isFullscreen = this.isInFullscreen();
    this.updateCanvasSize();
    this.updateUIForFullscreen();
  }

  private handleOrientationChange(): void {
    // Wait for orientation change to complete
    setTimeout(() => {
      this.updateCanvasSize();
    }, 500);
  }

  private handleResize(): void {
    // Update canvas size for all devices when window is resized
    this.updateCanvasSize();
  }

  private updateCanvasSize(): void {
    if (!this.canvas) return;

    if (this.isFullscreen) {
      // Fullscreen mode - use full viewport
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      // Maintain aspect ratio while filling screen
      const gameAspectRatio =
        this.originalCanvasSize.width / this.originalCanvasSize.height;
      const screenAspectRatio = viewportWidth / viewportHeight;

      let canvasWidth, canvasHeight;

      if (screenAspectRatio > gameAspectRatio) {
        // Screen is wider than game - fit to height
        canvasHeight = viewportHeight;
        canvasWidth = canvasHeight * gameAspectRatio;
      } else {
        // Screen is taller than game - fit to width
        canvasWidth = viewportWidth;
        canvasHeight = canvasWidth / gameAspectRatio;
      }

      this.canvas.style.width = `${canvasWidth}px`;
      this.canvas.style.height = `${canvasHeight}px`;

      // Center the canvas
      this.canvas.style.position = "fixed";
      this.canvas.style.top = `${(viewportHeight - canvasHeight) / 2}px`;
      this.canvas.style.left = `${(viewportWidth - canvasWidth) / 2}px`;
      this.canvas.style.zIndex = "1000";
    } else {
      // Normal mode - restore original sizing
      this.canvas.style.position = "";
      this.canvas.style.top = "";
      this.canvas.style.left = "";
      this.canvas.style.zIndex = "";

      if (this.isMobile) {
        // Mobile responsive sizing
        this.canvas.style.width = "90vw";
        this.canvas.style.height = "calc(90vw * 0.75)";
      } else {
        // Desktop sizing - use CSS for responsive behavior
        this.canvas.style.width = "";
        this.canvas.style.height = "";
      }
    }
  }

  private updateUIForFullscreen(): void {
    const container = document.getElementById("container");
    const ui = document.getElementById("ui");

    if (!container || !ui) return;

    if (this.isFullscreen) {
      // Hide most UI elements in fullscreen
      ui.style.display = "none";
      container.classList.add("fullscreen-mode");
    } else {
      // Show UI elements when not fullscreen
      ui.style.display = "";
      container.classList.remove("fullscreen-mode");
    }
  }

  private generateRandomPlayerName(): string {
    const adjectives = [
      "Swift",
      "Sneaky",
      "Blazing",
      "Shadow",
      "Mighty",
      "Clever",
      "Wild",
      "Brave",
      "Quick",
      "Silent",
      "Fierce",
      "Agile",
      "Sharp",
      "Bold",
      "Sleek",
      "Fast",
    ];
    const nouns = [
      "Fox",
      "Wolf",
      "Eagle",
      "Tiger",
      "Lion",
      "Hawk",
      "Ninja",
      "Runner",
      "Hunter",
      "Dash",
      "Storm",
      "Flash",
      "Blade",
      "Arrow",
      "Comet",
      "Rocket",
    ];

    const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    const number = Math.floor(Math.random() * 999) + 1;

    return `${adjective}${noun}${number}`;
  }

  private autoJoinGame(): void {
    // Wait a bit for the network connection to establish
    setTimeout(() => {
      const randomName = this.generateRandomPlayerName();
      console.log(`Auto-joining game with name: ${randomName}`);

      // Set the name in the input field (for display purposes)
      const nameInput = document.getElementById(
        "nameInput"
      ) as HTMLInputElement;
      if (nameInput) {
        nameInput.value = randomName;
      }

      // Hide join form immediately and show joining message
      const joinForm = document.getElementById("joinForm");
      if (joinForm) {
        joinForm.style.display = "none";
      }

      // Show connecting message
      this.network.showMessage(`Connecting as ${randomName}...`, "info");

      // Join the game
      this.network.joinGame(randomName);
    }, 500);
  }

  private joinGame(): void {
    const nameInput = document.getElementById("nameInput") as HTMLInputElement;
    const playerName = nameInput.value.trim();

    if (!playerName) {
      this.network.showError("Please enter your name");
      return;
    }

    if (playerName.length > 15) {
      this.network.showError("Name must be 15 characters or less");
      return;
    }

    const joinButton = document.getElementById(
      "joinButton"
    ) as HTMLButtonElement;
    joinButton.disabled = true;
    joinButton.textContent = "Joining...";

    this.network.joinGame(playerName);
  }

  public onGameJoined(data: {
    playerId: string;
    gameState: GameStateData;
  }): void {
    this.myPlayerId = data.playerId;
    if (this.renderer) {
      this.renderer.setMyPlayerId(this.myPlayerId);
    }

    // Hide join form and show game
    const joinForm = document.getElementById("joinForm");
    const gameCanvas = document.getElementById("gameCanvas");

    if (joinForm) joinForm.classList.add("hidden");
    if (gameCanvas) gameCanvas.classList.add("visible");

    // Initialize canvas sizing for mobile
    this.updateCanvasSize();

    // Update UI
    const player = data.gameState.players.find((p) => p.id === this.myPlayerId);
    const playerNameText = document.getElementById("playerNameText");
    if (playerNameText) {
      playerNameText.textContent = player ? player.name : "Unknown";
    }

    this.updateGameState(data.gameState);
    this.network.showMessage("Welcome to CatchMe!", "info");
  }

  public updateGameState(gameState: GameStateData): void {
    this.gameState = gameState;
    this.lastServerUpdate = Date.now();

    // Debug: Always log AI player data to diagnose rendering issue
    const aiPlayers = gameState.players.filter((p) => p.isAI);
    if (aiPlayers.length > 0) {
      console.log(
        `[CLIENT] AI Players received:`,
        aiPlayers.map((p) => ({
          name: p.name,
          id: p.id,
          isAI: p.isAI,
          x: p.x,
          y: p.y,
          radius: p.radius,
          color: p.color,
        }))
      );

      // Force immediate render to ensure AI players are drawn
      if (this.renderer) {
        this.renderer.render();
      }
    }

    // Handle server reconciliation for local player
    if (this.myPlayerId && gameState.players) {
      const serverPlayer = gameState.players.find(
        (p) => p.id === this.myPlayerId
      );
      if (serverPlayer) {
        this.localPlayerState = { ...serverPlayer };

        // Initialize or reconcile prediction
        if (!this.predictedPlayerState) {
          // First time - initialize prediction with server state
          this.predictedPlayerState = {
            x: serverPlayer.x,
            y: serverPlayer.y,
            lastUpdate: Date.now(),
          };
        } else {
          // Check if we need correction with adaptive threshold and cooldown
          const now = Date.now();
          const timeSinceLastCorrection = now - this.lastCorrectionTime;

          // Check if corrections are temporarily disabled
          if (this.correctionsDisabled && now < this.correctionDisableTimeout) {
            // Skip correction check
          } else if (now >= this.correctionDisableTimeout) {
            this.correctionsDisabled = false;
            this.consecutiveCorrections = 0;
          }

          // Reset consecutive counter after enough time has passed
          if (timeSinceLastCorrection > 1000) {
            this.consecutiveCorrections = 0;
          }

          // Only check for corrections if not in cooldown and not disabled
          if (
            !this.correctionsDisabled &&
            timeSinceLastCorrection >= this.correctionCooldown &&
            this.consecutiveCorrections < this.maxConsecutiveCorrections
          ) {
            const distanceError = Math.sqrt(
              Math.pow(this.predictedPlayerState.x - serverPlayer.x, 2) +
                Math.pow(this.predictedPlayerState.y - serverPlayer.y, 2)
            );

            // Calculate adaptive correction threshold
            const timeSinceLastUpdate = now - this.lastServerUpdate;
            const adaptiveThreshold =
              this.calculateAdaptiveCorrectionThreshold(timeSinceLastUpdate);

            // Only start correction if error is significant
            if (
              distanceError > adaptiveThreshold &&
              !this.correction.needsCorrection
            ) {
              const timeSinceServerUpdate = now - this.lastServerUpdate;

              if (timeSinceServerUpdate < 100) {
                // Recent server update
                console.log(
                  `Starting correction: error=${distanceError.toFixed(
                    1
                  )}px, threshold=${adaptiveThreshold.toFixed(
                    1
                  )}px, consecutive=${this.consecutiveCorrections}`
                );
                this.startCorrection(serverPlayer);
                this.lastCorrectionTime = now;
                this.consecutiveCorrections++;
              }
            }
          } else if (
            this.consecutiveCorrections >= this.maxConsecutiveCorrections &&
            !this.correctionsDisabled
          ) {
            // Hit consecutive limit, disable temporarily
            this.correctionsDisabled = true;
            this.correctionDisableTimeout = now + 3000;
            console.warn(
              `Too many consecutive corrections, disabling for 3 seconds`
            );
          }
        }
      }
    }

    // Create modified game state with predicted local player position
    const modifiedGameState = { ...gameState };
    if (this.predictedPlayerState && this.localPlayerState && this.myPlayerId) {
      const predictedPos = this.getCurrentPredictedPosition();
      if (predictedPos && !isNaN(predictedPos.x) && !isNaN(predictedPos.y)) {
        modifiedGameState.players = gameState.players.map((player) => {
          if (player.id === this.myPlayerId) {
            return {
              ...player,
              x: predictedPos.x,
              y: predictedPos.y,
            };
          }
          return player;
        });
      } else {
        modifiedGameState.players = gameState.players;
      }
    } else {
      modifiedGameState.players = gameState.players;
    }

    // Pass modified state to renderer
    if (this.renderer) {
      this.renderer.setGameState(modifiedGameState);
    }

    // Update UI elements
    this.updateUI(gameState);
    this.gameActive = gameState.gameActive;
  }

  private updateUI(gameState: GameStateData): void {
    const playerCountText = document.getElementById("playerCountText");
    if (playerCountText) {
      playerCountText.textContent = gameState.players.length.toString();
    }

    const timeRemainingText = document.getElementById("timeRemainingText");
    if (timeRemainingText && this.renderer) {
      timeRemainingText.textContent = gameState.gameActive
        ? this.renderer.formatTime(gameState.timeRemaining)
        : "-";
    }

    const myPlayer = gameState.players.find((p) => p.id === this.myPlayerId);
    if (myPlayer) {
      const gameStatusText = document.getElementById("gameStatusText");
      if (gameStatusText) {
        gameStatusText.textContent = gameState.gameActive
          ? myPlayer.isIt
            ? "You are IT!"
            : "Run!"
          : "Waiting for players...";
      }

      const playerScoreText = document.getElementById("playerScoreText");
      if (playerScoreText) {
        playerScoreText.textContent = (myPlayer.score || 0).toString();
      }
    }

    // Update leaderboard
    this.updateLeaderboard(gameState.players);
  }

  private updateLeaderboard(players: PlayerState[]): void {
    const leaderboardDiv = document.getElementById("playerScores");
    if (!leaderboardDiv) return;

    // Sort players by score (descending)
    const sortedPlayers = [...players].sort(
      (a, b) => (b.score || 0) - (a.score || 0)
    );

    // Generate leaderboard HTML
    const leaderboardHTML = sortedPlayers
      .map((player, index) => {
        const isMyPlayer = player.id === this.myPlayerId;
        const isItPlayer = player.isIt;
        const classes = [];

        if (isMyPlayer) classes.push("my-score");
        if (isItPlayer) classes.push("it-player");

        const rank = index + 1;
        const rankEmoji =
          rank === 1
            ? "🥇"
            : rank === 2
            ? "🥈"
            : rank === 3
            ? "🥉"
            : `${rank}.`;
        const itIndicator = isItPlayer ? " 🎯" : "";

        return `
        <div class="score-entry ${classes.join(" ")}">
          <span>${rankEmoji} ${player.name}${itIndicator}</span>
          <span>${player.score || 0}</span>
        </div>
      `;
      })
      .join("");

    leaderboardDiv.innerHTML = leaderboardHTML;
  }

  // Event handlers
  public onScoreUpdate(data: any): void {
    this.showScoreChangeAnimation(data);

    if (data.reason === "successful_tag") {
      this.network.showMessage(
        `+${data.change} points for tagging ${data.playerName}!`,
        "success"
      );
    } else if (data.reason === "star_collection") {
      const points = data.change;
      const bonus = points === 50 ? " (IT bonus!)" : "";
      if (data.playerId === this.myPlayerId) {
        this.network.showMessage(`⭐ +${points} points${bonus}`, "star");
      }
    }
  }

  public onStarCollected(data: any): void {
    const bonus = data.pointsAwarded === 50 ? " (IT bonus!)" : "";
    this.network.showMessage(
      `⭐ ${data.playerName} collected a star! +${data.pointsAwarded} points${bonus}`,
      "star"
    );
  }

  public onPowerUpCollected(data: any): void {
    const powerUpName =
      data.powerUpType === "transparency" ? "transparency" : data.powerUpType;
    this.network.showMessage(
      `⚡ ${data.playerName} collected ${powerUpName} power-up!`,
      "info"
    );
  }

  public onPlayerTagged(data: any): void {
    const message = `${data.tagged} was tagged by ${data.tagger}!`;
    this.network.showMessage(message, "tagged");

    if (data.newIt === this.myPlayerId) {
      this.network.showMessage("You are now IT!", "tagged");
    }
  }

  public onGameEnd(reason: string): void {
    this.gameActive = false;
    this.network.showMessage(`Game Over: ${reason}`, "info");
    const gameStatusText = document.getElementById("gameStatusText");
    if (gameStatusText) {
      gameStatusText.textContent = "Game Over";
    }
  }

  private showScoreChangeAnimation(data: any): void {
    // Trigger canvas-based score animation for all players
    if (this.renderer) {
      this.renderer.triggerScoreChangeAnimation(data.playerId, data.change);
    }

    // Keep the old DOM-based animation only for the current player as fallback
    if (data.playerId !== this.myPlayerId) return;

    const changeElement = document.createElement("div");
    changeElement.className = `score-change ${
      data.change > 0 ? "positive" : "negative"
    }`;
    changeElement.textContent = `${data.change > 0 ? "+" : ""}${data.change}`;

    const scoreElement = document.getElementById("playerScore");
    if (scoreElement) {
      const rect = scoreElement.getBoundingClientRect();
      changeElement.style.left = `${rect.right + 10}px`;
      changeElement.style.top = `${rect.top}px`;
      document.body.appendChild(changeElement);

      setTimeout(() => {
        if (changeElement.parentNode) {
          changeElement.parentNode.removeChild(changeElement);
        }
      }, 2000);
    }
  }

  // Client-side prediction helpers
  private startCorrection(serverPlayer: PlayerState): void {
    if (!this.predictedPlayerState) return;

    this.correction.needsCorrection = true;
    this.correction.startTime = Date.now();
    this.correction.startPos = {
      x: this.predictedPlayerState.x,
      y: this.predictedPlayerState.y,
    };
    this.correction.targetPos = {
      x: serverPlayer.x,
      y: serverPlayer.y,
    };
  }

  private getCurrentPredictedPosition(): Position | null {
    if (!this.predictedPlayerState) return null;

    // If we're in the middle of a correction, interpolate
    if (this.correction.needsCorrection) {
      const now = Date.now();
      const elapsed = now - this.correction.startTime;
      const progress = Math.min(1, elapsed / this.correction.duration);

      if (progress >= 1) {
        // Correction complete
        this.correction.needsCorrection = false;
        this.predictedPlayerState.x = this.correction.targetPos.x;
        this.predictedPlayerState.y = this.correction.targetPos.y;
        return {
          x: this.correction.targetPos.x,
          y: this.correction.targetPos.y,
        };
      } else {
        // Smooth interpolation during correction
        const easedProgress = this.easeOutCubic(progress);
        const correctedX =
          this.correction.startPos.x +
          (this.correction.targetPos.x - this.correction.startPos.x) *
            easedProgress;
        const correctedY =
          this.correction.startPos.y +
          (this.correction.targetPos.y - this.correction.startPos.y) *
            easedProgress;
        return { x: correctedX, y: correctedY };
      }
    }

    return { x: this.predictedPlayerState.x, y: this.predictedPlayerState.y };
  }

  private easeOutCubic(t: number): number {
    return 1 - Math.pow(1 - t, 3);
  }

  private calculateAdaptiveCorrectionThreshold(
    timeSinceLastUpdate: number
  ): number {
    let threshold = this.baseCorrectionThreshold;

    if (timeSinceLastUpdate > 50) {
      const delayFactor = Math.min(timeSinceLastUpdate / 50, 3);
      threshold *= delayFactor;
    }

    if (this.consecutiveCorrections > 0) {
      threshold *= 1 + this.consecutiveCorrections * 0.5;
    }

    return Math.min(threshold, this.maxCorrectionThreshold);
  }

  private applyClientSidePrediction(
    inputState: InputState,
    deltaTime: number
  ): void {
    if (!this.localPlayerState) return;

    let dx = 0;
    let dy = 0;

    // Handle keyboard input (same as server)
    if (inputState.up) dy -= 1;
    if (inputState.down) dy += 1;
    if (inputState.left) dx -= 1;
    if (inputState.right) dx += 1;

    // Handle touch input (overrides keyboard, same as server)
    if (
      inputState.isTouchActive &&
      inputState.touchX !== undefined &&
      inputState.touchY !== undefined
    ) {
      dx = inputState.touchX;
      dy = inputState.touchY;
    }

    // Normalize diagonal movement (same as server)
    const magnitude = Math.sqrt(dx * dx + dy * dy);
    if (magnitude > 1) {
      dx /= magnitude;
      dy /= magnitude;
    }

    // Apply speed and time scaling (same as server)
    const currentSpeed = this.localPlayerState.isIt
      ? this.localPlayerState.speed * 1.3
      : this.localPlayerState.speed;
    const moveDistance = currentSpeed * (deltaTime / 1000);

    dx *= moveDistance;
    dy *= moveDistance;

    // Apply movement with bounds checking (using actual game dimensions)
    const gameWidth = this.gameState?.gameWidth || 800;
    const gameHeight = this.gameState?.gameHeight || 600;
    const newX = Math.max(
      this.localPlayerState.radius,
      Math.min(
        gameWidth - this.localPlayerState.radius,
        this.localPlayerState.x + dx
      )
    );
    const newY = Math.max(
      this.localPlayerState.radius,
      Math.min(
        gameHeight - this.localPlayerState.radius,
        this.localPlayerState.y + dy
      )
    );

    // Update predicted position
    this.localPlayerState.x = newX;
    this.localPlayerState.y = newY;
    this.localPlayerState.lastUpdate = Date.now();

    // Store predicted state for correction comparison
    if (this.predictedPlayerState) {
      this.predictedPlayerState.x = newX;
      this.predictedPlayerState.y = newY;
      this.predictedPlayerState.lastUpdate = Date.now();
    }
  }

  private gameLoop(): void {
    const now = Date.now();
    const deltaTime = now - this.lastUpdate;

    // Handle input with immediate client-side prediction
    if (this.gameActive && this.myPlayerId && this.input) {
      const inputState = this.input.update(); // This already sends input to server at 30 FPS

      // Apply client-side prediction immediately
      if (
        inputState &&
        this.localPlayerState &&
        !this.localPlayerState.isStunned
      ) {
        this.applyClientSidePrediction(inputState, deltaTime);
      }
    }

    // Render the game
    if (this.renderer) {
      this.renderer.render();
    }

    this.lastUpdate = now;
    requestAnimationFrame(() => this.gameLoop());
  }
}
