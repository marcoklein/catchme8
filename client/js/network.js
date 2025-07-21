class NetworkManager {
  constructor() {
    this.socket = io();
    this.playerId = null;
    this.connected = false;
    this.setupEventListeners();
  }

  setupEventListeners() {
    this.socket.on("connect", () => {
      this.connected = true;
      console.log("Connected to server");
    });

    this.socket.on("disconnect", () => {
      this.connected = false;
      console.log("Disconnected from server");
      this.showMessage("Disconnected from server", "error");
    });

    this.socket.on("gameJoined", (data) => {
      this.playerId = data.playerId;
      game.onGameJoined(data);
    });

    this.socket.on("gameState", (gameState) => {
      game.updateGameState(gameState);
    });

    this.socket.on("playerTagged", (data) => {
      game.onPlayerTagged(data);
    });

    this.socket.on("gameEnd", (reason) => {
      game.onGameEnd(reason);
    });

    this.socket.on("powerUpCollected", (data) => {
      const message = `${data.playerName} collected a ${data.powerUpType} power-up!`;
      this.showMessage(message, "info");
    });

    this.socket.on("joinError", (error) => {
      this.showError(error);
    });
  }

  joinGame(playerName) {
    if (this.connected) {
      this.socket.emit("playerJoin", playerName);
    } else {
      this.showError("Not connected to server");
    }
  }

  sendInputState(inputState) {
    if (this.connected && this.playerId) {
      this.socket.emit("playerInput", inputState);
    }
  }

  // Keep sendMovement for backward compatibility during transition
  sendMovement(movement) {
    if (this.connected && this.playerId) {
      this.socket.emit("playerMove", movement);
    }
  }

  showMessage(text, type = "info") {
    const messagesContainer = document.getElementById("gameMessages");
    const message = document.createElement("div");
    message.className = `message ${type}`;
    message.textContent = text;
    messagesContainer.appendChild(message);

    // Remove message after 3 seconds
    setTimeout(() => {
      if (message.parentNode) {
        message.parentNode.removeChild(message);
      }
    }, 3000);
  }

  showError(text) {
    const errorElement = document.getElementById("errorMessage");
    errorElement.textContent = text;
    setTimeout(() => {
      errorElement.textContent = "";
    }, 3000);
  }
}

// Global network manager instance
const network = new NetworkManager();
