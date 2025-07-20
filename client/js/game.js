class Game {
  constructor() {
    this.gameState = null;
    this.myPlayerId = null;
    this.gameActive = false;
    this.lastUpdate = Date.now();
    this.clientPrediction = new Map(); // Store predicted positions for smooth movement
    this.serverReconciliation = true; // Enable server reconciliation

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

    // Update client prediction with server authoritative positions
    if (this.serverReconciliation) {
      gameState.players.forEach((serverPlayer) => {
        this.clientPrediction.set(serverPlayer.id, {
          x: serverPlayer.x,
          y: serverPlayer.y,
          lastUpdate: Date.now(),
        });
      });
    }

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
    }

    this.gameActive = gameState.gameActive;
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

    // Update input and apply client-side movement prediction
    if (this.gameActive && this.myPlayerId) {
      const movement = input.update();

      // Apply client-side prediction for smoother movement
      this.updateClientPrediction(deltaTime, movement);
    }

    // Render the game
    renderer.render();

    this.lastUpdate = now;
    requestAnimationFrame(() => this.gameLoop());
  }

  updateClientPrediction(deltaTime, movement) {
    if (!this.gameState) return;

    const myPlayer = this.gameState.players.find(
      (p) => p.id === this.myPlayerId
    );
    if (!myPlayer) return;

    // Get current predicted position or use server position
    let predicted = this.clientPrediction.get(this.myPlayerId);
    if (!predicted) {
      predicted = { x: myPlayer.x, y: myPlayer.y, lastUpdate: Date.now() };
      this.clientPrediction.set(this.myPlayerId, predicted);
    }

    // Apply movement prediction if player is moving
    if (movement.dx !== 0 || movement.dy !== 0) {
      const speed = 200; // pixels per second (should match server)
      const moveDistance = speed * (deltaTime / 1000);

      // Calculate new predicted position
      let newX = predicted.x + movement.dx * moveDistance;
      let newY = predicted.y + movement.dy * moveDistance;

      // Apply boundaries (should match server logic)
      const gameWidth = this.gameState.gameWidth || 800;
      const gameHeight = this.gameState.gameHeight || 600;
      const radius = 20;

      newX = Math.max(radius, Math.min(gameWidth - radius, newX));
      newY = Math.max(radius, Math.min(gameHeight - radius, newY));

      // Update predicted position
      predicted.x = newX;
      predicted.y = newY;
      predicted.lastUpdate = Date.now();

      // Update the rendered player position for smooth movement
      myPlayer.x = newX;
      myPlayer.y = newY;
    }
  }
}

// Initialize the game when the page loads
document.addEventListener("DOMContentLoaded", () => {
  window.game = new Game();
});
