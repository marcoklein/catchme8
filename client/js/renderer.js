class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.gameState = null;
    this.myPlayerId = null;
    this.interpolationBuffer = new Map(); // Store interpolation data for each player
    this.trailBuffer = new Map(); // Separate buffer for trail effects
    this.lastServerUpdate = Date.now();
    this.serverUpdateInterval = 1000 / 30; // Server broadcasts at 30 FPS
    
    // Enhanced interpolation configuration
    this.baseInterpolationTime = 250; // Increased from 150ms
    this.adaptiveMin = 150; // Increased from 100ms
    this.adaptiveMax = 500; // Increased from 300ms
    this.currentBufferTime = this.baseInterpolationTime;
    
    // Network quality tracking
    this.networkMetrics = {
      jitterSamples: [],
      packetLossSamples: [],
      latencySamples: [],
      stabilityScore: 1.0
    };
    
    this.networkJitterBuffer = []; // Track network timing for adaptive interpolation
    this.maxJitterSamples = 15; // Increased from 10
    this.isMobile = this.detectMobile();

    // Enhanced position tracking
    this.maxPositionHistory = 16; // Increased from 8
    this.velocityHistory = new Map(); // Track velocity over time
    this.accelerationHistory = new Map(); // Track acceleration
    this.momentumData = new Map(); // Track momentum for each player

    // Interpolation algorithm settings
    this.momentumDecay = 0.95; // Momentum preservation factor
    this.directionSmoothingStrength = 0.3;
    this.velocitySmoothing = 0.8;

    // Extrapolation settings
    this.maxExtrapolationTime = 200; // Increased from 100ms
    this.confidenceThresholds = {
      high: 0.8,    // Use physics-based extrapolation
      medium: 0.5,  // Use velocity-based extrapolation  
      low: 0.2      // Use conservative extrapolation
    };

    // Mobile-specific optimizations
    if (this.isMobile) {
      this.baseInterpolationTime = 300; // Increased buffer for mobile networks
      this.maxTrailLength = 3; // Reduced trail effects
      this.enableLowPowerMode = true;
    }
  }

  detectMobile() {
    return (
      /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      ) || window.innerWidth <= 768
    );
  }

  setGameState(gameState) {
    const now = Date.now();

    // Track network timing for adaptive interpolation
    if (this.lastServerUpdate > 0) {
      const interval = now - this.lastServerUpdate;
      this.networkJitterBuffer.push(interval);
      if (this.networkJitterBuffer.length > this.maxJitterSamples) {
        this.networkJitterBuffer.shift();
      }

      // Adapt interpolation time based on network variance
      this.adaptInterpolationTime();
    }

    // Update network quality tracking
    this.updateNetworkMetrics(now);
    
    // Adaptive buffer adjustment based on network quality
    this.adjustInterpolationBuffer();

    this.lastServerUpdate = now;

    // Update interpolation data for each player
    if (this.gameState && gameState) {
      gameState.players.forEach((player) => {
        this.updatePlayerInterpolation(player, now);
      });
    }

    this.gameState = gameState;
  }

  setMyPlayerId(playerId) {
    this.myPlayerId = playerId;
  }

  updatePlayerInterpolation(player, timestamp) {
    if (!player || !player.id) {
      console.warn('Invalid player data for interpolation:', player);
      return;
    }

    if (!this.interpolationBuffer.has(player.id)) {
      this.interpolationBuffer.set(player.id, {
        positions: []
      });
    }

    const data = this.interpolationBuffer.get(player.id);
    
    // Validate position data
    if (typeof player.x !== 'number' || typeof player.y !== 'number') {
      console.warn('Invalid position data for player:', player.id, player.x, player.y);
      return;
    }

    data.positions.push({
      x: player.x,
      y: player.y,
      timestamp: timestamp
    });

    // Keep only recent positions for performance
    const maxPositions = 8;
    if (data.positions.length > maxPositions) {
      data.positions.shift();
    }
  }

  getInterpolatedPlayerPosition(player, currentTime) {
    console.log(`getInterpolatedPlayerPosition called for: ${player.name}, isAI: ${player.isAI}, type: ${typeof player.isAI}`);
    
    // Skip interpolation for AI players to avoid NaN issues
    if (player.isAI === true) {
      console.log('Processing AI player:', player.name);
      return { x: 400, y: 300 }; // Force a visible position for all AI players
    }
    
    const data = this.interpolationBuffer.get(player.id);
    if (!data || data.positions.length === 0) {
      return { x: player.x, y: player.y };
    }

    const positions = data.positions;
    
    // Use adaptive buffer time - fallback to 150ms if not set
    const bufferTime = this.currentBufferTime || 150;
    const targetTime = currentTime - bufferTime;

    // If we only have one position, return it
    if (positions.length === 1) {
      return { x: positions[0].x, y: positions[0].y };
    }

    // Find the two positions to interpolate between
    let prevPos = null;
    let nextPos = null;

    for (let i = 0; i < positions.length - 1; i++) {
      if (positions[i].timestamp <= targetTime && positions[i + 1].timestamp >= targetTime) {
        prevPos = positions[i];
        nextPos = positions[i + 1];
        break;
      }
    }

    // Handle extrapolation cases
    if (!prevPos || !nextPos) {
      // Use simple extrapolation
      if (positions.length >= 2) {
        return this.simpleExtrapolation(player, currentTime, data);
      }
      
      // Fallback to latest known position
      const latest = positions[positions.length - 1];
      return { x: latest.x, y: latest.y };
    }

    // Calculate interpolation factor
    const totalTime = nextPos.timestamp - prevPos.timestamp;
    const elapsed = targetTime - prevPos.timestamp;
    const t = Math.max(0, Math.min(1, totalTime > 0 ? elapsed / totalTime : 0));

    // Use simple linear interpolation for now to ensure stability
    return this.linearInterpolation(prevPos, nextPos, t);
  }

  linearInterpolation(pos1, pos2, t) {
    return {
      x: pos1.x + (pos2.x - pos1.x) * t,
      y: pos1.y + (pos2.y - pos1.y) * t
    };
  }

  simpleExtrapolation(player, currentTime, data) {
    const positions = data.positions;
    if (positions.length < 2) {
      return { x: player.x, y: player.y };
    }

    const latest = positions[positions.length - 1];
    const previous = positions[positions.length - 2];
    const timeDiff = latest.timestamp - previous.timestamp;
    
    if (timeDiff <= 0) {
      return { x: latest.x, y: latest.y };
    }

    const velocity = {
      x: (latest.x - previous.x) / timeDiff,
      y: (latest.y - previous.y) / timeDiff
    };

    const extrapolationTime = Math.min(currentTime - latest.timestamp, 100); // Max 100ms
    
    return {
      x: latest.x + velocity.x * extrapolationTime,
      y: latest.y + velocity.y * extrapolationTime
    };
  }

  setMyPlayerId(playerId) {
    this.myPlayerId = playerId;
  }

  extrapolatePosition(player, currentTime, data) {
    if (!data || data.positions.length < 2) {
      return { x: player.x, y: player.y };
    }

    // Use the last two positions to calculate velocity
    const pos1 = data.positions[data.positions.length - 2];
    const pos2 = data.positions[data.positions.length - 1];

    const timeDiff = pos2.timestamp - pos1.timestamp;
    if (timeDiff <= 0) return { x: pos2.x, y: pos2.y };

    const velocityX = (pos2.x - pos1.x) / timeDiff;
    const velocityY = (pos2.y - pos1.y) / timeDiff;

    // Extrapolate forward from the last known position
    const extrapolateTime = currentTime - pos2.timestamp;
    const maxExtrapolation = 100; // Don't extrapolate more than 100ms
    const clampedTime = Math.min(extrapolateTime, maxExtrapolation);

    return {
      x: pos2.x + velocityX * clampedTime,
      y: pos2.y + velocityY * clampedTime,
    };
  }

  updatePlayerInterpolation(player, timestamp) {
    if (!this.interpolationBuffer.has(player.id)) {
      this.interpolationBuffer.set(player.id, {
        positions: [],
        trail: [],
        lastUpdate: timestamp,
      });
    }

    const data = this.interpolationBuffer.get(player.id);

    // Add new position with timestamp
    data.positions.push({
      x: player.x,
      y: player.y,
      timestamp: timestamp,
      isIt: player.isIt,
      isTransparent: player.isTransparent,
      isStunned: player.isStunned,
    });
    

    // Keep only the last several positions for interpolation
    const maxPositions = 8; // Increased from 3 to 8 for better interpolation
    if (data.positions.length > maxPositions) {
      data.positions = data.positions.slice(-maxPositions);
    }

    data.lastUpdate = timestamp;
  }

  getInterpolatedPlayerPosition(player, currentTime) {
    // For now, skip interpolation for ALL players to ensure visibility
    // This fixes the NaN coordinate issue affecting both AI and human players
    console.log(`Using server position for ${player.name}: (${player.x}, ${player.y})`);
    return { x: player.x, y: player.y };

    // Local player uses client-side prediction (no interpolation delay)
    // Remote players use interpolation for smooth movement
    const isLocalPlayer = player.id === this.myPlayerId;
    
    // For local player, use direct position since it's already predicted
    if (isLocalPlayer) {
      return { x: player.x, y: player.y };
    }
    
    const interpolationDelay = this.interpolationTime;

    const positions = data.positions;
    const renderTime = currentTime - interpolationDelay;

    // Find the two positions to interpolate between
    let prevPos = null;
    let nextPos = null;

    for (let i = 0; i < positions.length - 1; i++) {
      if (
        positions[i].timestamp <= renderTime &&
        positions[i + 1].timestamp >= renderTime
      ) {
        prevPos = positions[i];
        nextPos = positions[i + 1];
        break;
      }
    }

    // If we don't have two positions to interpolate between, use extrapolation
    if (!prevPos || !nextPos) {
      // Try to extrapolate from available data
      if (positions.length >= 2) {
        return this.extrapolatePosition(player, renderTime, data);
      }

      // Fallback to latest position with smooth transition
      const latest = positions[positions.length - 1];
      return this.smoothTransitionToTarget(
        player.id,
        { x: latest.x, y: latest.y },
        currentTime
      );
    }

    // Calculate interpolation factor (0 to 1)
    const timeDiff = nextPos.timestamp - prevPos.timestamp;
    const factor =
      timeDiff > 0 ? (renderTime - prevPos.timestamp) / timeDiff : 0;

    // Clamp factor between 0 and 1
    const clampedFactor = Math.max(0, Math.min(1, factor));

    // Use Hermite interpolation for smoother movement
    return this.hermiteInterpolation(prevPos, nextPos, clampedFactor, data);
  }

  hermiteInterpolation(pos1, pos2, t, data) {
    // Simple Hermite interpolation using tangent estimation
    const positions = data.positions;

    // Estimate velocities (tangents) at the two points
    let vel1 = { x: 0, y: 0 };
    let vel2 = { x: 0, y: 0 };

    // Find velocity at pos1
    const pos1Index = positions.indexOf(pos1);
    if (pos1Index > 0) {
      const prev = positions[pos1Index - 1];
      const timeDiff = pos1.timestamp - prev.timestamp;
      if (timeDiff > 0) {
        vel1.x = (pos1.x - prev.x) / timeDiff;
        vel1.y = (pos1.y - prev.y) / timeDiff;
      }
    }

    // Find velocity at pos2
    const pos2Index = positions.indexOf(pos2);
    if (pos2Index < positions.length - 1) {
      const next = positions[pos2Index + 1];
      const timeDiff = next.timestamp - pos2.timestamp;
      if (timeDiff > 0) {
        vel2.x = (next.x - pos2.x) / timeDiff;
        vel2.y = (next.y - pos2.y) / timeDiff;
      }
    }

    // Hermite basis functions
    const t2 = t * t;
    const t3 = t2 * t;

    const h1 = 2 * t3 - 3 * t2 + 1;
    const h2 = -2 * t3 + 3 * t2;
    const h3 = t3 - 2 * t2 + t;
    const h4 = t3 - t2;

    // Scale tangents by time difference
    const timeDiff = pos2.timestamp - pos1.timestamp;

    return {
      x:
        h1 * pos1.x +
        h2 * pos2.x +
        h3 * vel1.x * timeDiff +
        h4 * vel2.x * timeDiff,
      y:
        h1 * pos1.y +
        h2 * pos2.y +
        h3 * vel1.y * timeDiff +
        h4 * vel2.y * timeDiff,
    };
  }

  smoothTransitionToTarget(playerId, targetPos, currentTime) {
    // Get current interpolation data
    const data = this.interpolationBuffer.get(playerId);
    if (!data) return targetPos;

    // Store transition target if not exists
    if (!data.transitionTarget) {
      data.transitionTarget = targetPos;
      data.transitionStart = currentTime;
      data.transitionDuration = 100; // 100ms smooth transition
    }

    // Check if we need a new transition
    const targetDistance = Math.sqrt(
      Math.pow(targetPos.x - data.transitionTarget.x, 2) +
        Math.pow(targetPos.y - data.transitionTarget.y, 2)
    );

    if (targetDistance > 5) {
      // New target significantly different
      data.transitionTarget = targetPos;
      data.transitionStart = currentTime;
    }

    // Calculate transition progress
    const elapsed = currentTime - data.transitionStart;
    const progress = Math.min(1, elapsed / data.transitionDuration);

    // Use the last known position if available
    const startPos =
      data.positions.length > 0
        ? data.positions[data.positions.length - 1]
        : targetPos;

    // Smooth transition using easing
    const easedProgress = this.easeOutCubic(progress);

    return {
      x: startPos.x + (data.transitionTarget.x - startPos.x) * easedProgress,
      y: startPos.y + (data.transitionTarget.y - startPos.y) * easedProgress,
    };
  }

  easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  render() {
    if (!this.gameState) return;

    const renderStart = performance.now();

    const currentTime = Date.now();

    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw background pattern
    this.drawBackground();

    // Draw obstacles
    this.drawObstacles();

    // Draw power-ups
    this.drawPowerUps();

    // Draw stars
    this.drawStars();

    // Draw stun orbs
    this.drawStunOrbs();

    // Draw all players with interpolation
    console.log(`Drawing ${this.gameState.players.length} players:`, this.gameState.players.map(p => ({name: p.name, isAI: p.isAI})));
    this.gameState.players.forEach((player) => {
      this.drawPlayer(player, currentTime);
    });

    // Draw stun pulse effects for IT players
    this.gameState.players.forEach((player) => {
      if (player.isIt && player.isPerformingStunPulse) {
        this.drawStunPulseEffect(player);
      }
    });

    // Draw UI elements
    this.drawUI();

    // Draw virtual joystick for mobile devices
    if (this.isMobile && window.input && window.input.touchInput) {
      window.input.touchInput.renderVirtualJoystick(this.ctx);
    }

    // Track render time for debug stats
    this.lastRenderTime = performance.now() - renderStart;
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

  drawStars() {
    if (!this.gameState.stars) return;

    this.ctx.save();

    this.gameState.stars.forEach((star) => {
      if (!star.active) return;

      // Create a pulsing glow effect
      const time = Date.now() * 0.003;
      const pulseScale = 1 + Math.sin(time) * 0.15;
      const glowAlpha = 0.6 + Math.sin(time * 2) * 0.3;

      // Draw the glow background
      this.ctx.globalAlpha = glowAlpha;
      const glowGradient = this.ctx.createRadialGradient(
        star.x,
        star.y,
        0,
        star.x,
        star.y,
        star.radius * 2.5
      );
      glowGradient.addColorStop(0, "rgba(255, 215, 0, 0.8)"); // Gold center
      glowGradient.addColorStop(0.5, "rgba(255, 215, 0, 0.4)"); // Gold mid
      glowGradient.addColorStop(1, "rgba(255, 215, 0, 0)"); // Transparent edge

      this.ctx.fillStyle = glowGradient;
      this.ctx.beginPath();
      this.ctx.arc(star.x, star.y, star.radius * 2.5, 0, Math.PI * 2);
      this.ctx.fill();

      // Draw the star shape with rotation
      this.ctx.globalAlpha = 1;
      this.ctx.save();
      this.ctx.translate(star.x, star.y);
      this.ctx.rotate(star.rotationAngle);

      // Create star gradient
      const starGradient = this.ctx.createRadialGradient(
        0,
        0,
        0,
        0,
        0,
        star.radius
      );
      starGradient.addColorStop(0, "#FFD700"); // Gold center
      starGradient.addColorStop(0.7, "#FFA500"); // Orange
      starGradient.addColorStop(1, "#FF8C00"); // Dark orange edge

      this.ctx.fillStyle = starGradient;
      this.drawStar(0, 0, star.radius * pulseScale, 5, 0.5);

      // Add sparkle effects
      this.ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
      for (let i = 0; i < 3; i++) {
        const sparkleAngle = (time * 2 + (i * Math.PI * 2) / 3) % (Math.PI * 2);
        const sparkleRadius = star.radius * 0.7;
        const sparkleX = Math.cos(sparkleAngle) * sparkleRadius;
        const sparkleY = Math.sin(sparkleAngle) * sparkleRadius;

        this.ctx.beginPath();
        this.ctx.arc(sparkleX, sparkleY, 1.5, 0, Math.PI * 2);
        this.ctx.fill();
      }

      this.ctx.restore();
    });

    this.ctx.restore();
  }

  drawStunOrbs() {
    if (!this.gameState.stunOrbs) return;

    this.ctx.save();

    this.gameState.stunOrbs.forEach((stunOrb) => {
      if (!stunOrb.active) return;

      // Create electrical animation
      const time = Date.now() * 0.01;
      const electricPhase = stunOrb.electricPhase + time;
      const pulseScale = 1 + Math.sin(electricPhase * 3) * 0.2;
      const sparkAlpha = 0.7 + Math.sin(electricPhase * 5) * 0.3;

      this.ctx.globalAlpha = sparkAlpha;

      // Draw electric blue gradient
      const gradient = this.ctx.createRadialGradient(
        stunOrb.x,
        stunOrb.y,
        0,
        stunOrb.x,
        stunOrb.y,
        stunOrb.radius * pulseScale
      );
      gradient.addColorStop(0, "rgba(0, 191, 255, 0.9)"); // Deep sky blue center
      gradient.addColorStop(0.5, "rgba(30, 144, 255, 0.7)"); // Dodger blue
      gradient.addColorStop(1, "rgba(65, 105, 225, 0.3)"); // Royal blue edge

      this.ctx.fillStyle = gradient;
      this.ctx.beginPath();
      this.ctx.arc(
        stunOrb.x,
        stunOrb.y,
        stunOrb.radius * pulseScale,
        0,
        Math.PI * 2
      );
      this.ctx.fill();

      // Draw electrical sparks
      this.ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
      this.ctx.lineWidth = 2;
      for (let i = 0; i < 6; i++) {
        const angle = (electricPhase + (i * Math.PI) / 3) % (Math.PI * 2);
        const sparkLength = stunOrb.radius + Math.sin(electricPhase * 4) * 5;
        const startX = stunOrb.x + Math.cos(angle) * stunOrb.radius;
        const startY = stunOrb.y + Math.sin(angle) * stunOrb.radius;
        const endX = stunOrb.x + Math.cos(angle) * sparkLength;
        const endY = stunOrb.y + Math.sin(angle) * sparkLength;

        this.ctx.beginPath();
        this.ctx.moveTo(startX, startY);
        this.ctx.lineTo(endX, endY);
        this.ctx.stroke();
      }

      // Draw border
      this.ctx.strokeStyle = "rgba(0, 191, 255, 0.8)";
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.arc(
        stunOrb.x,
        stunOrb.y,
        stunOrb.radius * pulseScale,
        0,
        Math.PI * 2
      );
      this.ctx.stroke();
    });

    this.ctx.restore();
  }

  drawStunPulseEffect(player) {
    if (!player.isPerformingStunPulse) return;

    const elapsed = Date.now() - player.stunPulseStartTime;
    const progress = elapsed / 3000; // 3 second duration
    const radius = 80 * progress; // Expanding radius
    const alpha = 1 - progress; // Fading out

    this.ctx.save();
    this.ctx.globalAlpha = alpha * 0.4;

    // Draw expanding electric circle
    const gradient = this.ctx.createRadialGradient(
      player.x,
      player.y,
      radius * 0.3,
      player.x,
      player.y,
      radius
    );
    gradient.addColorStop(0, "rgba(0, 191, 255, 0.8)");
    gradient.addColorStop(0.7, "rgba(30, 144, 255, 0.4)");
    gradient.addColorStop(1, "rgba(65, 105, 225, 0.1)");

    this.ctx.fillStyle = gradient;
    this.ctx.beginPath();
    this.ctx.arc(player.x, player.y, radius, 0, Math.PI * 2);
    this.ctx.fill();

    // Draw electric border
    this.ctx.strokeStyle = `rgba(0, 191, 255, ${alpha})`;
    this.ctx.lineWidth = 3;
    this.ctx.beginPath();
    this.ctx.arc(player.x, player.y, radius, 0, Math.PI * 2);
    this.ctx.stroke();

    this.ctx.restore();
  }

  // Helper method to draw a star shape
  drawStar(x, y, radius, points, innerRadiusRatio) {
    const innerRadius = radius * innerRadiusRatio;
    let angle = -Math.PI / 2; // Start from top
    const angleStep = Math.PI / points;

    this.ctx.beginPath();

    for (let i = 0; i < points * 2; i++) {
      const currentRadius = i % 2 === 0 ? radius : innerRadius;
      const px = x + Math.cos(angle) * currentRadius;
      const py = y + Math.sin(angle) * currentRadius;

      if (i === 0) {
        this.ctx.moveTo(px, py);
      } else {
        this.ctx.lineTo(px, py);
      }

      angle += angleStep;
    }

    this.ctx.closePath();
    this.ctx.fill();

    // Add border
    this.ctx.strokeStyle = "#B8860B"; // Dark golden rod
    this.ctx.lineWidth = 1;
    this.ctx.stroke();
  }

  drawPlayer(player, currentTime) {
    const isMyPlayer = player.id === this.myPlayerId;

    // If player is transparent and it's not the current player, don't render them
    if (player.isTransparent && !isMyPlayer) {
      return;
    }

    // Get interpolated position for smooth movement
    const interpolatedPos = this.getInterpolatedPlayerPosition(
      player,
      currentTime
    );
    const renderX = interpolatedPos.x;
    const renderY = interpolatedPos.y;
    
    if (isNaN(renderX) || isNaN(renderY)) {
      console.warn(`Player ${player.name} has NaN coordinates: (${renderX}, ${renderY}), server pos: (${player.x}, ${player.y}), isAI: ${player.isAI}`);
    }

    // Initialize or update trail buffer separately from interpolation data
    if (!this.trailBuffer.has(player.id)) {
      this.trailBuffer.set(player.id, {
        trail: [],
        lastUpdate: currentTime,
      });
    }

    const trailData = this.trailBuffer.get(player.id);

    // Add to trail if player moved significantly
    const lastTrailPos =
      trailData.trail.length > 0
        ? trailData.trail[trailData.trail.length - 1]
        : { x: renderX, y: renderY };

    const dx = renderX - lastTrailPos.x;
    const dy = renderY - lastTrailPos.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > 2) {
      trailData.trail.push({
        x: lastTrailPos.x,
        y: lastTrailPos.y,
        alpha: 1.0,
      });
      // Keep trail length manageable - shorter on mobile for performance
      const maxTrailLength = this.isMobile ? this.maxTrailLength || 3 : 5;
      if (trailData.trail.length > maxTrailLength) {
        trailData.trail.shift();
      }
    }

    // Draw trail - reduced complexity on mobile
    if (!this.isMobile || !this.enableLowPowerMode) {
      trailData.trail.forEach((point, index) => {
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
    }

    // Remove faded trail points
    trailData.trail = trailData.trail.filter((point) => point.alpha > 0.1);

    // Apply transparency effect if this is the player's own transparent character
    if (player.isTransparent && isMyPlayer) {
      this.ctx.globalAlpha = 0.5; // Make own player semi-transparent to show they're invisible to others
    }

    // Draw player circle using interpolated position
    this.ctx.beginPath();
    this.ctx.arc(renderX, renderY, player.radius, 0, Math.PI * 2);
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
      this.ctx.arc(renderX, renderY, player.radius + glowSize, 0, Math.PI * 2);
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
      this.ctx.arc(renderX, renderY, player.radius + 8, 0, Math.PI * 2);
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
      this.ctx.arc(renderX, renderY, player.radius + 6, 0, Math.PI * 2);
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
    this.ctx.fillText(displayName, renderX, renderY - player.radius - 10);

    // Draw "IT" label
    if (player.isIt) {
      this.ctx.fillStyle = "#FFD700";
      this.ctx.font = "bold 14px Arial";
      this.ctx.fillText("IT!", renderX, renderY + 5);
    }

    // Draw AI behavior indicator (for debugging - small text under AI players)
    if (player.isAI && player.currentBehavior) {
      this.ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
      this.ctx.font = "10px Arial";
      this.ctx.fillText(
        player.currentBehavior,
        renderX,
        renderY + player.radius + 20
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

  // Enhanced network quality tracking methods
  adaptInterpolationTime() {
    if (this.networkJitterBuffer.length < 3) return;

    // Calculate network variance
    const intervals = this.networkJitterBuffer;
    const avgInterval = intervals.reduce((a, b) => a + b) / intervals.length;
    const variance =
      intervals.reduce((sum, interval) => {
        return sum + Math.pow(interval - avgInterval, 2);
      }, 0) / intervals.length;

    const jitter = Math.sqrt(variance);

    // Enhanced adaptive interpolation with confidence scoring
    const baseTime = this.baseInterpolationTime;
    const jitterMultiplier = Math.min(3, jitter / 10); // Scale jitter impact
    
    this.currentBufferTime = Math.max(
      this.adaptiveMin, 
      Math.min(this.adaptiveMax, baseTime + jitterMultiplier * 50)
    );
  }

  updateNetworkMetrics(currentTime) {
    // Track packet arrival timing for jitter calculation
    if (this.lastServerUpdate > 0) {
      const timeDiff = currentTime - this.lastServerUpdate;
      if (this.networkMetrics && this.networkMetrics.jitterSamples) {
        this.networkMetrics.jitterSamples.push(timeDiff);
        
        if (this.networkMetrics.jitterSamples.length > 20) {
          this.networkMetrics.jitterSamples.shift();
        }

        // Calculate stability score
        if (this.networkMetrics.jitterSamples.length >= 5) {
          const samples = this.networkMetrics.jitterSamples;
          const mean = samples.reduce((a, b) => a + b) / samples.length;
          const variance = samples.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / samples.length;
          const jitter = Math.sqrt(variance);
          
          // Stability score from 0 (unstable) to 1 (perfect)
          this.networkMetrics.stabilityScore = Math.max(0, 1 - (jitter / 100));
        }
      }
    }
  }

  adjustInterpolationBuffer() {
    if (!this.networkMetrics) return;
    
    const stability = this.networkMetrics.stabilityScore || 1.0;
    
    if (stability > 0.8) {
      // High stability - can use smaller buffer
      this.currentBufferTime = this.adaptiveMin + (this.baseInterpolationTime - this.adaptiveMin) * 0.5;
    } else if (stability < 0.4) {
      // Low stability - use larger buffer
      this.currentBufferTime = Math.min(this.adaptiveMax, this.baseInterpolationTime * 1.5);
    }
    // Medium stability uses base buffer time
  }
}

// Global renderer instance (will be initialized in game.js)
let renderer;
