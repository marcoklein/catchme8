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

    // Draw obstacles
    this.drawObstacles();

    // Draw power-ups
    this.drawPowerUps();

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

  drawObstacles() {
    if (!this.gameState.obstacles) return;

    this.ctx.save();
    this.ctx.fillStyle = "#555555";
    this.ctx.strokeStyle = "#333333";
    this.ctx.lineWidth = 2;

    this.gameState.obstacles.forEach((obstacle) => {
      if (obstacle.type === "rectangle") {
        // Draw rectangle obstacle
        const x = obstacle.x - obstacle.width / 2;
        const y = obstacle.y - obstacle.height / 2;

        this.ctx.fillRect(x, y, obstacle.width, obstacle.height);
        this.ctx.strokeRect(x, y, obstacle.width, obstacle.height);

        // Add some texture/pattern
        this.ctx.save();
        this.ctx.fillStyle = "#777777";
        this.ctx.fillRect(
          x + 5,
          y + 5,
          obstacle.width - 10,
          obstacle.height - 10
        );
        this.ctx.restore();
      } else if (obstacle.type === "circle") {
        // Draw circle obstacle
        this.ctx.beginPath();
        this.ctx.arc(obstacle.x, obstacle.y, obstacle.radius, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();

        // Add inner circle for texture
        this.ctx.save();
        this.ctx.fillStyle = "#777777";
        this.ctx.beginPath();
        this.ctx.arc(
          obstacle.x,
          obstacle.y,
          obstacle.radius - 5,
          0,
          Math.PI * 2
        );
        this.ctx.fill();
        this.ctx.restore();
      }
    });

    this.ctx.restore();
  }

  drawPowerUps() {
    if (!this.gameState.powerUps) return;

    this.ctx.save();

    this.gameState.powerUps.forEach((powerUp) => {
      if (!powerUp.active) return;

      // Create a pulsing effect
      const time = Date.now() * 0.005;
      const pulseScale = 1 + Math.sin(time) * 0.1;
      const alpha = 0.8 + Math.sin(time * 2) * 0.2;

      this.ctx.globalAlpha = alpha;

      if (powerUp.type === "transparency") {
        // Draw transparency power-up with special effect
        const gradient = this.ctx.createRadialGradient(
          powerUp.x,
          powerUp.y,
          0,
          powerUp.x,
          powerUp.y,
          powerUp.radius * pulseScale
        );
        gradient.addColorStop(0, "rgba(173, 216, 230, 0.9)"); // Light blue center
        gradient.addColorStop(0.5, "rgba(135, 206, 250, 0.7)"); // Sky blue
        gradient.addColorStop(1, "rgba(70, 130, 180, 0.3)"); // Steel blue edge

        this.ctx.fillStyle = gradient;
        this.ctx.beginPath();
        this.ctx.arc(
          powerUp.x,
          powerUp.y,
          powerUp.radius * pulseScale,
          0,
          Math.PI * 2
        );
        this.ctx.fill();

        // Add sparkle effect
        this.ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
        this.ctx.beginPath();
        this.ctx.arc(powerUp.x - 3, powerUp.y - 3, 2, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.beginPath();
        this.ctx.arc(powerUp.x + 4, powerUp.y + 2, 1.5, 0, Math.PI * 2);
        this.ctx.fill();

        // Draw border
        this.ctx.strokeStyle = "rgba(70, 130, 180, 0.8)";
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.arc(
          powerUp.x,
          powerUp.y,
          powerUp.radius * pulseScale,
          0,
          Math.PI * 2
        );
        this.ctx.stroke();
      }
    });

    this.ctx.restore();
  }

  drawPlayer(player) {
    const isMyPlayer = player.id === this.myPlayerId;

    // If player is transparent and it's not the current player, don't render them
    if (player.isTransparent && !isMyPlayer) {
      return;
    }

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

    // Apply transparency effect if this is the player's own transparent character
    if (player.isTransparent && isMyPlayer) {
      this.ctx.globalAlpha = 0.5; // Make own player semi-transparent to show they're invisible to others
    }

    // Draw player circle
    this.ctx.beginPath();
    this.ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
    this.ctx.fillStyle = player.color;
    this.ctx.fill();

    // Add border
    this.ctx.strokeStyle = isMyPlayer ? "#000" : "#333";
    this.ctx.lineWidth = isMyPlayer ? 3 : 2;
    this.ctx.stroke();

    // Reset transparency
    if (player.isTransparent && isMyPlayer) {
      this.ctx.globalAlpha = 1.0;
    }

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

    // Special transparency indicator for own player
    if (player.isTransparent && isMyPlayer) {
      this.ctx.save();
      this.ctx.globalAlpha = 0.8;
      this.ctx.strokeStyle = "rgba(173, 216, 230, 0.9)";
      this.ctx.lineWidth = 3;
      this.ctx.setLineDash([4, 4]);
      this.ctx.beginPath();
      this.ctx.arc(player.x, player.y, player.radius + 8, 0, Math.PI * 2);
      this.ctx.stroke();
      this.ctx.setLineDash([]);
      this.ctx.restore();
    }

    // Stunned effect - red pulsing circle
    if (player.isStunned) {
      this.ctx.save();
      const time = Date.now() / 1000;
      const pulseAlpha = 0.3 + Math.sin(time * 8) * 0.2; // Fast pulse
      this.ctx.globalAlpha = pulseAlpha;
      this.ctx.strokeStyle = "#FF0000";
      this.ctx.lineWidth = 4;
      this.ctx.setLineDash([2, 2]);
      this.ctx.beginPath();
      this.ctx.arc(player.x, player.y, player.radius + 6, 0, Math.PI * 2);
      this.ctx.stroke();
      this.ctx.setLineDash([]);
      this.ctx.restore();
    }

    // Draw player name
    this.ctx.fillStyle = "#000";
    this.ctx.font = "bold 12px Arial";
    this.ctx.textAlign = "center";

    // Add [AI] prefix for AI players and [STUNNED] for stunned players
    let displayName = player.isAI ? `[AI] ${player.name}` : player.name;
    if (player.isStunned) {
      displayName = `[STUNNED] ${displayName}`;
      this.ctx.fillStyle = "#FF0000"; // Red text for stunned players
    }
    this.ctx.fillText(displayName, player.x, player.y - player.radius - 10);

    // Draw "IT" label
    if (player.isIt) {
      this.ctx.fillStyle = "#FFD700";
      this.ctx.font = "bold 14px Arial";
      this.ctx.fillText("IT!", player.x, player.y + 5);
    }

    // Draw AI behavior indicator (for debugging - small text under AI players)
    if (player.isAI && player.currentBehavior) {
      this.ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
      this.ctx.font = "10px Arial";
      this.ctx.fillText(
        player.currentBehavior,
        player.x,
        player.y + player.radius + 20
      );
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
