class Game {
  constructor() {
    this.gameState = null;
    this.myPlayerId = null;
    this.gameActive = false;
    this.lastUpdate = Date.now();
    this.localPlayerState = null; // Store server state for UI purposes only

    this.initializeUI();
    this.setupCanvas();
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

    // Store player ID for rendering but rely purely on server state
    if (this.myPlayerId && gameState.players) {
      const serverPlayer = gameState.players.find(
        (p) => p.id === this.myPlayerId
      );
      if (serverPlayer) {
        // No client-side prediction - just store the server state directly
        this.localPlayerState = { ...serverPlayer };
      }
    }

    // Pass server state directly to renderer - no modifications
    renderer.setGameState(gameState);

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

  gameLoop() {
    const now = Date.now();
    const deltaTime = now - this.lastUpdate;

    // Only handle input - no client-side prediction
    if (this.gameActive && this.myPlayerId) {
      const movement = input.update();
      // Input is sent to server but no local position changes are made
    }

    // Render the game using only server-authoritative state
    renderer.render();

    this.lastUpdate = now;
    requestAnimationFrame(() => this.gameLoop());
  }
}

// Initialize the game when the page loads
document.addEventListener("DOMContentLoaded", () => {
  window.game = new Game();
});
