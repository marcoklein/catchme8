class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.gameState = null;
    this.myPlayerId = null;
    this.interpolationBuffer = new Map(); // Store previous positions for smooth interpolation
  }

  setGameState(gameState) {
    this.gameState = gameState;
  }

  setMyPlayerId(playerId) {
    this.myPlayerId = playerId;
  }

  render() {
    if (!this.gameState) return;

    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw background pattern
    this.drawBackground();

    // Draw all players
    this.gameState.players.forEach((player) => {
      this.drawPlayer(player);
    });

    // Draw UI elements
    this.drawUI();
  }

  drawBackground() {
    // Draw a subtle grid pattern
    this.ctx.strokeStyle = "#e0e0e0";
    this.ctx.lineWidth = 1;
    this.ctx.globalAlpha = 0.3;

    const gridSize = 50;
    for (let x = 0; x <= this.canvas.width; x += gridSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, this.canvas.height);
      this.ctx.stroke();
    }

    for (let y = 0; y <= this.canvas.height; y += gridSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(this.canvas.width, y);
      this.ctx.stroke();
    }

    this.ctx.globalAlpha = 1;
  }

  drawPlayer(player) {
    const isMyPlayer = player.id === this.myPlayerId;

    // Store previous position for trail effect
    if (!this.interpolationBuffer.has(player.id)) {
      this.interpolationBuffer.set(player.id, {
        prevX: player.x,
        prevY: player.y,
        trail: [],
      });
    }

    const playerData = this.interpolationBuffer.get(player.id);

    // Add to trail if player moved significantly
    const dx = player.x - playerData.prevX;
    const dy = player.y - playerData.prevY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > 2) {
      playerData.trail.push({
        x: playerData.prevX,
        y: playerData.prevY,
        alpha: 1.0,
      });
      // Keep trail length manageable
      if (playerData.trail.length > 5) {
        playerData.trail.shift();
      }
      playerData.prevX = player.x;
      playerData.prevY = player.y;
    }

    // Draw trail
    playerData.trail.forEach((point, index) => {
      point.alpha *= 0.85; // Fade trail
      if (point.alpha > 0.1) {
        this.ctx.beginPath();
        this.ctx.arc(point.x, point.y, player.radius * 0.6, 0, Math.PI * 2);
        this.ctx.fillStyle =
          player.color +
          Math.floor(point.alpha * 255)
            .toString(16)
            .padStart(2, "0");
        this.ctx.fill();
      }
    });

    // Remove faded trail points
    playerData.trail = playerData.trail.filter((point) => point.alpha > 0.1);

    // Draw player circle
    this.ctx.beginPath();
    this.ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
    this.ctx.fillStyle = player.color;
    this.ctx.fill();

    // Add border
    this.ctx.strokeStyle = isMyPlayer ? "#000" : "#333";
    this.ctx.lineWidth = isMyPlayer ? 3 : 2;
    this.ctx.stroke();

    // Special effect for "it" player
    if (player.isIt) {
      // Animated glow effect
      const time = Date.now() / 1000;
      const glowSize = 8 + Math.sin(time * 3) * 3;

      this.ctx.beginPath();
      this.ctx.arc(
        player.x,
        player.y,
        player.radius + glowSize,
        0,
        Math.PI * 2
      );
      this.ctx.strokeStyle = "#FFD700";
      this.ctx.lineWidth = 4;
      this.ctx.setLineDash([5, 5]);
      this.ctx.stroke();
      this.ctx.setLineDash([]);
    }

    // Draw player name
    this.ctx.fillStyle = "#000";
    this.ctx.font = "bold 12px Arial";
    this.ctx.textAlign = "center";
    this.ctx.fillText(player.name, player.x, player.y - player.radius - 10);

    // Draw "IT" label
    if (player.isIt) {
      this.ctx.fillStyle = "#FFD700";
      this.ctx.font = "bold 14px Arial";
      this.ctx.fillText("IT!", player.x, player.y + 5);
    }
  }

  drawUI() {
    // Draw game boundaries
    this.ctx.strokeStyle = "#333";
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(0, 0, this.canvas.width, this.canvas.height);
  }

  formatTime(milliseconds) {
    const seconds = Math.ceil(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  }
}

// Global renderer instance (will be initialized in game.js)
let renderer;
