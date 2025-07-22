class Game {
  constructor() {
    this.gameState = null;
    this.myPlayerId = null;
    this.gameActive = false;
    this.lastUpdate = Date.now();
    this.localPlayerState = null; // Store server state for UI purposes only
    
    // Client-side prediction state
    this.predictedPlayerState = null; // Our predicted local position
    this.lastServerUpdate = Date.now();
    this.predictionSequence = 0;
    this.pendingInputs = []; // Queue of inputs awaiting server confirmation
    
    // Correction state - optimized for better responsiveness
    this.correctionStartTime = 0;
    this.correctionDuration = 50; // Reduced from 100ms to 50ms for faster corrections
    this.correctionStartPos = null;
    this.correctionTargetPos = null;
    this.needsCorrection = false;
    
    // Adaptive correction thresholds
    this.baseCorrectionThreshold = 15; // Increased to 15 pixels to reduce oversensitivity
    this.maxCorrectionThreshold = 50; // Increased max threshold
    this.networkJitterBuffer = 0; // Tracks network jitter to adjust thresholds
    
    // Correction cooldown to prevent feedback loops
    this.lastCorrectionTime = 0;
    this.correctionCooldown = 500; // Increased to 500ms minimum between corrections
    this.consecutiveCorrections = 0;
    this.maxConsecutiveCorrections = 2; // Reduced to 2 consecutive corrections
    this.correctionResetTime = 1000; // Time to reset consecutive counter
    this.correctionsDisabled = false; // Emergency disable for problematic corrections
    this.correctionDisableTimeout = 0;

    this.initializeUI();
    this.setupCanvas();
    this.initializeDebugStats();
    this.gameLoop();
  }
  initializeUI() {
    const joinButton = document.getElementById("joinButton");
    const nameInput = document.getElementById("nameInput");

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

    nameInput.addEventListener("input", (e) => {
      // Clear any error messages when typing
      document.getElementById("errorMessage").textContent = "";
    });
  }

  setupCanvas() {
    const canvas = document.getElementById("gameCanvas");
    renderer = new Renderer(canvas);
  }

  joinGame() {
    const nameInput = document.getElementById("nameInput");
    const playerName = nameInput.value.trim();

    if (!playerName) {
      network.showError("Please enter your name");
      return;
    }

    if (playerName.length > 15) {
      network.showError("Name must be 15 characters or less");
      return;
    }

    const joinButton = document.getElementById("joinButton");
    joinButton.disabled = true;
    joinButton.textContent = "Joining...";

    network.joinGame(playerName);
  }

  onGameJoined(data) {
    this.myPlayerId = data.playerId;
    renderer.setMyPlayerId(this.myPlayerId);

    // Hide join form and show game
    document.getElementById("joinForm").classList.add("hidden");
    document.getElementById("gameCanvas").classList.add("visible");

    // Update UI
    const player = data.gameState.players.find((p) => p.id === this.myPlayerId);
    document.getElementById("playerNameText").textContent = player
      ? player.name
      : "Unknown";

    this.updateGameState(data.gameState);
    network.showMessage("Welcome to CatchMe!", "info");
  }

  updateGameState(gameState) {
    this.gameState = gameState;
    this.lastServerUpdate = Date.now();

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
            lastUpdate: Date.now()
          };
        } else {
          // Check if we need correction with adaptive threshold and cooldown
          const now = Date.now();
          const timeSinceLastCorrection = now - this.lastCorrectionTime;
          
          // Check if corrections are temporarily disabled
          if (this.correctionsDisabled && now < this.correctionDisableTimeout) {
            // Skip correction check but continue with rendering
          } else if (now >= this.correctionDisableTimeout) {
            this.correctionsDisabled = false;
            this.consecutiveCorrections = 0;
          }
          
          // Reset consecutive counter after enough time has passed
          if (timeSinceLastCorrection > this.correctionResetTime) {
            this.consecutiveCorrections = 0;
          }
          
          // Only check for corrections if not in cooldown and not disabled
          if (!this.correctionsDisabled && 
              timeSinceLastCorrection >= this.correctionCooldown && 
              this.consecutiveCorrections < this.maxConsecutiveCorrections) {
            
            const distanceError = Math.sqrt(
              Math.pow(this.predictedPlayerState.x - serverPlayer.x, 2) + 
              Math.pow(this.predictedPlayerState.y - serverPlayer.y, 2)
            );
            
            // Calculate adaptive correction threshold based on network conditions
            const timeSinceLastUpdate = now - this.lastServerUpdate;
            const adaptiveThreshold = this.calculateAdaptiveCorrectionThreshold(timeSinceLastUpdate);
            
            // Only start correction if error is significant, not already correcting, and server position is stable
            if (distanceError > adaptiveThreshold && !this.needsCorrection) {
              // Additional check: only correct if server position seems stable (not changing rapidly)
              const timeSinceServerUpdate = now - this.lastServerUpdate;
              
              if (timeSinceServerUpdate < 100) { // Recent server update
                console.log(`Starting correction: error=${distanceError.toFixed(1)}px, threshold=${adaptiveThreshold.toFixed(1)}px, consecutive=${this.consecutiveCorrections}`);
                this.startCorrection(serverPlayer);
                this.lastCorrectionTime = now;
                this.consecutiveCorrections++;
              } else {
                // Server data is stale, don't correct
                console.log(`Skipping correction due to stale server data (${timeSinceServerUpdate}ms old)`);
              }
            }
          } else if (this.consecutiveCorrections >= this.maxConsecutiveCorrections && !this.correctionsDisabled) {
            // Hit consecutive limit, disable temporarily
            this.correctionsDisabled = true;
            this.correctionDisableTimeout = now + 3000; // Disable for 3 seconds
            console.warn(`Too many consecutive corrections (${this.consecutiveCorrections}), disabling for 3 seconds`);
          }
        }
        
        // Clean up acknowledged inputs (simple approach - clear all for now)
        this.pendingInputs = [];
      }
    }

    // Create modified game state with predicted local player position
    const modifiedGameState = { ...gameState };
    if (this.predictedPlayerState && this.localPlayerState && this.myPlayerId) {
      // Only modify the local player's position, keep all other players as-is
      const predictedPos = this.getCurrentPredictedPosition();
      if (predictedPos && !isNaN(predictedPos.x) && !isNaN(predictedPos.y)) {
        modifiedGameState.players = gameState.players.map(player => {
          if (player.id === this.myPlayerId) {
            return { 
              ...player, 
              x: predictedPos.x,
              y: predictedPos.y
            };
          }
          return player;
        });
      } else {
        // Prediction position is invalid, use original game state
        modifiedGameState.players = gameState.players;
      }
    } else {
      // Ensure players are always passed through, even without local player prediction
      modifiedGameState.players = gameState.players;
    }

    // Pass modified state to renderer
    renderer.setGameState(modifiedGameState);

    // Update UI elements
    document.getElementById("playerCountText").textContent =
      gameState.players.length;
    document.getElementById("timeRemainingText").textContent =
      gameState.gameActive ? renderer.formatTime(gameState.timeRemaining) : "-";

    const myPlayer = gameState.players.find((p) => p.id === this.myPlayerId);
    if (myPlayer) {
      document.getElementById("gameStatusText").textContent =
        gameState.gameActive
          ? myPlayer.isIt
            ? "You are IT!"
            : "Run!"
          : "Waiting for players...";

      // Update player's score
      document.getElementById("playerScoreText").textContent =
        myPlayer.score || 0;
    }

    // Update leaderboard
    this.updateLeaderboard(gameState.players);

    this.gameActive = gameState.gameActive;
  }

  updateLeaderboard(players) {
    const leaderboardDiv = document.getElementById("playerScores");

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

  onScoreUpdate(data) {
    // Show score change animation
    this.showScoreChangeAnimation(data);

    // Show message for significant events
    if (data.reason === "successful_tag") {
      network.showMessage(
        `+${data.change} points for tagging ${data.playerName}!`,
        "success"
      );
    } else if (data.reason === "star_collection") {
      const points = data.change;
      const bonus = points === 50 ? " (IT bonus!)" : "";
      if (data.playerId === this.myPlayerId) {
        network.showMessage(`⭐ +${points} points${bonus}`, "star");
      }
    }
  }

  onStarCollected(data) {
    // Show star collection message for all players
    const bonus = data.pointsAwarded === 50 ? " (IT bonus!)" : "";
    network.showMessage(
      `⭐ ${data.playerName} collected a star! +${data.pointsAwarded} points${bonus}`,
      "star"
    );
  }

  onPowerUpCollected(data) {
    // Show power-up collection message
    const powerUpName = data.powerUpType === "transparency" ? "transparency" : data.powerUpType;
    network.showMessage(
      `⚡ ${data.playerName} collected ${powerUpName} power-up!`,
      "info"
    );
  }

  showScoreChangeAnimation(data) {
    // Only show animation for the current player
    if (data.playerId !== this.myPlayerId) return;

    const changeElement = document.createElement("div");
    changeElement.className = `score-change ${
      data.change > 0 ? "positive" : "negative"
    }`;
    changeElement.textContent = `${data.change > 0 ? "+" : ""}${data.change}`;

    // Position near the score display
    const scoreElement = document.getElementById("playerScore");
    const rect = scoreElement.getBoundingClientRect();

    changeElement.style.left = `${rect.right + 10}px`;
    changeElement.style.top = `${rect.top}px`;

    document.body.appendChild(changeElement);

    // Remove after animation
    setTimeout(() => {
      if (changeElement.parentNode) {
        changeElement.parentNode.removeChild(changeElement);
      }
    }, 2000);
  }

  onPlayerTagged(data) {
    const message = `${data.tagged} was tagged by ${data.tagger}!`;
    network.showMessage(message, "tagged");

    // Update status if it affects the current player
    if (data.newIt === this.myPlayerId) {
      network.showMessage("You are now IT!", "tagged");
    }
  }

  onGameEnd(reason) {
    this.gameActive = false;
    network.showMessage(`Game Over: ${reason}`, "info");
    document.getElementById("gameStatusText").textContent = "Game Over";
  }

  // Helper methods for client-side prediction
  startCorrection(serverPlayer) {
    this.needsCorrection = true;
    this.correctionStartTime = Date.now();
    this.correctionStartPos = { 
      x: this.predictedPlayerState.x, 
      y: this.predictedPlayerState.y 
    };
    this.correctionTargetPos = { 
      x: serverPlayer.x, 
      y: serverPlayer.y 
    };
  }

  getCurrentPredictedPosition() {
    if (!this.predictedPlayerState) return { x: 0, y: 0 };
    
    // If we're in the middle of a correction, interpolate
    if (this.needsCorrection) {
      const now = Date.now();
      const elapsed = now - this.correctionStartTime;
      const progress = Math.min(1, elapsed / this.correctionDuration);
      
      if (progress >= 1) {
        // Correction complete
        this.needsCorrection = false;
        this.predictedPlayerState.x = this.correctionTargetPos.x;
        this.predictedPlayerState.y = this.correctionTargetPos.y;
        console.log(`Correction completed successfully`);
        return { x: this.correctionTargetPos.x, y: this.correctionTargetPos.y };
      } else {
        // Smooth interpolation during correction
        const easedProgress = this.easeOutCubic(progress);
        const correctedX = this.correctionStartPos.x + 
          (this.correctionTargetPos.x - this.correctionStartPos.x) * easedProgress;
        const correctedY = this.correctionStartPos.y + 
          (this.correctionTargetPos.y - this.correctionStartPos.y) * easedProgress;
        return { x: correctedX, y: correctedY };
      }
    }
    
    return { x: this.predictedPlayerState.x, y: this.predictedPlayerState.y };
  }

  easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  calculateAdaptiveCorrectionThreshold(timeSinceLastUpdate) {
    // Base threshold that increases with network delay
    let threshold = this.baseCorrectionThreshold;
    
    // Increase threshold for slower update rates (network issues)
    if (timeSinceLastUpdate > 50) { // Normal update should be ~33ms (30 FPS)
      const delayFactor = Math.min(timeSinceLastUpdate / 50, 3); // Cap at 3x
      threshold *= delayFactor;
    }
    
    // Track network jitter and adapt
    this.networkJitterBuffer = this.networkJitterBuffer * 0.9 + timeSinceLastUpdate * 0.1;
    if (this.networkJitterBuffer > 60) { // High jitter detected
      threshold *= 1.5; // Increase tolerance during network issues
    }
    
    // Increase threshold if we've had recent corrections (indicating instability)
    if (this.consecutiveCorrections > 0) {
      threshold *= (1 + this.consecutiveCorrections * 0.5); // 50% increase per consecutive correction
    }
    
    // Cap at maximum threshold
    return Math.min(threshold, this.maxCorrectionThreshold);
  }

  updatePrediction(inputState, deltaTime) {
    if (!this.predictedPlayerState || !this.localPlayerState || !inputState) return;
    
    // Don't update during correction to prevent interference
    if (this.needsCorrection) return;
    
    // Calculate predicted movement using client-side engine
    const movement = ClientMovementEngine.calculateMovement(
      inputState,
      deltaTime,
      this.localPlayerState.speed || 100,
      this.localPlayerState.isIt || false,
      this.localPlayerState.isStunned || false
    );
    
    if (movement.dx !== 0 || movement.dy !== 0) {
      const newX = this.predictedPlayerState.x + movement.dx;
      const newY = this.predictedPlayerState.y + movement.dy;
      
      // Validate position (basic bounds checking)
      const canvas = document.getElementById("gameCanvas");
      const playerRadius = 15;
      const validatedPos = ClientMovementEngine.validatePosition(
        newX, newY, playerRadius, canvas.width, canvas.height, 
        this.gameState?.obstacles || []
      );
      
      if (validatedPos) {
        this.predictedPlayerState.x = validatedPos.x;
        this.predictedPlayerState.y = validatedPos.y;
        this.predictedPlayerState.lastUpdate = Date.now();
      }
    }
  }

  gameLoop() {
    const now = Date.now();
    const deltaTime = now - this.lastUpdate;

    // Handle input with immediate client-side prediction
    if (this.gameActive && this.myPlayerId) {
      const inputState = input.update();
      
      // Apply immediate prediction for local responsiveness
      if (inputState && this.predictedPlayerState) {
        this.updatePrediction(inputState, deltaTime);
      }
    }

    // Render the game using predicted state for local player
    renderer.render();

    this.lastUpdate = now;
    requestAnimationFrame(() => this.gameLoop());
  }

  initializeDebugStats() {
    // Initialize debug stats with game components
    if (typeof DebugStats !== 'undefined') {
      this.debugStats = new DebugStats(this, renderer, network, input);
      window.debugStats = this.debugStats; // Global access
    }
  }
}

// Initialize the game when the page loads
document.addEventListener("DOMContentLoaded", () => {
  window.game = new Game();
});
