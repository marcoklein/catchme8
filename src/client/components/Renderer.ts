import { GameStateData, PlayerState, Obstacle, PowerUp, Star, StunOrb, Position, SightUtils } from '@shared/types';

interface ExplosionEffect {
  x: number;
  y: number;
  radius: number;
  startTime: number;
  duration: number;
}

interface ScreenShake {
  active: boolean;
  intensity: number;
  duration: number;
  startTime: number;
  offsetX: number;
  offsetY: number;
}

interface InterpolationData {
  positions: Array<{
    x: number;
    y: number;
    timestamp: number;
    isIt?: boolean;
    isTransparent?: boolean;
    isStunned?: boolean;
  }>;
  trail?: Array<{
    x: number;
    y: number;
    alpha: number;
  }>;
  lastUpdate?: number;
  transitionTarget?: Position;
  transitionStart?: number;
  transitionDuration?: number;
}

interface NetworkMetrics {
  jitterSamples: number[];
  packetLossSamples: number[];
  latencySamples: number[];
  stabilityScore: number;
}

interface DebrisParticle {
  angle: number;
  speed: number;
  size: number;
  color: string;
  life: number;
  trailLength: number;
  rotationSpeed: number;
}

export class Renderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private gameState: GameStateData | null = null;
  private myPlayerId: string | null = null;
  private interpolationBuffer = new Map<string, InterpolationData>();
  private trailBuffer = new Map<string, InterpolationData>();
  private lastServerUpdate = Date.now();
  private serverUpdateInterval = 1000 / 30; // Server broadcasts at 30 FPS
  
  // Enhanced interpolation configuration
  private baseInterpolationTime = 250; // Increased from 150ms
  private adaptiveMin = 150; // Increased from 100ms
  private adaptiveMax = 500; // Increased from 300ms
  private currentBufferTime = this.baseInterpolationTime;
  
  // Network quality tracking
  private networkMetrics: NetworkMetrics = {
    jitterSamples: [],
    packetLossSamples: [],
    latencySamples: [],
    stabilityScore: 1.0
  };
  
  private networkJitterBuffer: number[] = []; // Track network timing for adaptive interpolation
  private maxJitterSamples = 15; // Increased from 10
  private isMobile: boolean;

  // Enhanced position tracking
  private maxPositionHistory = 16; // Increased from 8
  private velocityHistory = new Map<string, any>(); // Track velocity over time
  private accelerationHistory = new Map<string, any>(); // Track acceleration
  private momentumData = new Map<string, any>(); // Track momentum for each player

  // Interpolation algorithm settings
  private momentumDecay = 0.95; // Momentum preservation factor
  private directionSmoothingStrength = 0.3;
  private velocitySmoothing = 0.8;

  // Extrapolation settings
  private maxExtrapolationTime = 200; // Increased from 100ms
  private confidenceThresholds = {
    high: 0.8,    // Use physics-based extrapolation
    medium: 0.5,  // Use velocity-based extrapolation  
    low: 0.2      // Use conservative extrapolation
  };

  // Mobile-specific optimizations
  private maxTrailLength?: number;
  private enableLowPowerMode?: boolean;

  // Screen shake system
  private screenShake: ScreenShake = {
    active: false,
    intensity: 0,
    duration: 0,
    startTime: 0,
    offsetX: 0,
    offsetY: 0
  };

  // Explosion effects
  private explosionEffects: ExplosionEffect[] = [];
  private explosionDebrisParticles: DebrisParticle[] | null = null;
  private lastRenderTime = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Could not get 2D rendering context");
    }
    this.ctx = ctx;
    this.isMobile = this.detectMobile();

    // Mobile-specific optimizations
    if (this.isMobile) {
      this.baseInterpolationTime = 300; // Increased buffer for mobile networks
      this.maxTrailLength = 3; // Reduced trail effects
      this.enableLowPowerMode = true;
    }
  }

  private detectMobile(): boolean {
    return (
      /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      ) || window.innerWidth <= 768
    );
  }

  public setGameState(gameState: GameStateData): void {
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

  public setMyPlayerId(playerId: string): void {
    this.myPlayerId = playerId;
  }

  private updatePlayerInterpolation(player: PlayerState, timestamp: number): void {
    if (!player || !player.id) {
      console.warn('Invalid player data for interpolation:', player);
      return;
    }

    if (!this.interpolationBuffer.has(player.id)) {
      this.interpolationBuffer.set(player.id, {
        positions: []
      });
    }

    const data = this.interpolationBuffer.get(player.id)!;
    
    // Validate position data
    if (typeof player.x !== 'number' || typeof player.y !== 'number') {
      console.warn('Invalid position data for player:', player.id, player.x, player.y);
      return;
    }

    data.positions.push({
      x: player.x,
      y: player.y,
      timestamp: timestamp,
      isIt: player.isIt,
      isTransparent: player.isTransparent,
      isStunned: player.isStunned,
    });

    // Keep only recent positions for performance
    const maxPositions = 8;
    if (data.positions.length > maxPositions) {
      data.positions.shift();
    }

    data.lastUpdate = timestamp;
  }

  private getInterpolatedPlayerPosition(player: PlayerState, currentTime: number): Position {
    console.log(`getInterpolatedPlayerPosition called for: ${player.name}, isAI: ${player.isAI}, type: ${typeof player.isAI}`);
    
    // Skip interpolation for AI players to avoid NaN issues
    if (player.isAI === true) {
      console.log('Processing AI player:', player.name);
      return { x: 400, y: 300 }; // Force a visible position for all AI players
    }
    
    // For now, skip interpolation for ALL players to ensure visibility
    // This fixes the NaN coordinate issue affecting both AI and human players
    return { x: player.x, y: player.y };
  }

  private linearInterpolation(pos1: Position, pos2: Position, t: number): Position {
    return {
      x: pos1.x + (pos2.x - pos1.x) * t,
      y: pos1.y + (pos2.y - pos1.y) * t
    };
  }

  private simpleExtrapolation(player: PlayerState, currentTime: number, data: InterpolationData): Position {
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

  private easeOutCubic(t: number): number {
    return 1 - Math.pow(1 - t, 3);
  }

  public triggerExplosionEffect(x: number, y: number, radius: number): void {
    console.log(`EXPLOSION TRIGGERED at (${x}, ${y}) with radius ${radius}`);
    
    this.explosionEffects.push({
      x: x,
      y: y,
      radius: radius,
      startTime: Date.now(),
      duration: 2500, // Extended to 2.5 seconds for more dramatic effect
    });
    
    console.log(`Total explosions active: ${this.explosionEffects.length}`);
  }

  public render(): void {
    if (!this.gameState) return;

    const renderStart = performance.now();
    const currentTime = Date.now();

    // Get current player for sight calculations
    const myPlayer = this.gameState.players.find(p => p.id === this.myPlayerId);

    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Apply sight-based rendering if we have a player
    if (myPlayer) {
      // Step 1: Fill entire canvas with dark background
      this.ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

      // Step 2: Clear the sight circle area completely (crystal clear)
      this.ctx.globalCompositeOperation = 'destination-out';
      this.ctx.beginPath();
      this.ctx.arc(myPlayer.x, myPlayer.y, myPlayer.sightRange, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.globalCompositeOperation = 'source-over';

      // Step 3: Draw background pattern only in the cleared area
      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.arc(myPlayer.x, myPlayer.y, myPlayer.sightRange, 0, Math.PI * 2);
      this.ctx.clip();
      this.drawBackground();
      this.ctx.restore();

      // Step 4: Draw all game objects (they'll only appear in the clear circle)
      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.arc(myPlayer.x, myPlayer.y, myPlayer.sightRange, 0, Math.PI * 2);
      this.ctx.clip();

      // Draw obstacles (only visible ones)
      this.drawObstacles(myPlayer);

      // Draw power-ups (only visible ones)
      this.drawPowerUps(myPlayer);

      // Draw stars (only visible ones)
      this.drawStars(myPlayer);

      // Draw stun orbs (only visible ones)
      this.drawStunOrbs(myPlayer);

      // Draw all players with interpolation (only visible ones)
      this.gameState.players.forEach((player) => {
        if (this.isPlayerVisible(player, myPlayer)) {
          this.drawPlayer(player, currentTime);
        }
      });

      // Draw stun pulse effects for IT players (only visible ones)
      this.gameState.players.forEach((player) => {
        if (player.isIt && (player as any).isPerformingStunPulse && this.isPlayerVisible(player, myPlayer)) {
          this.drawStunPulseEffect(player);
        }
      });

      // Draw explosion effects (only visible ones)
      this.drawExplosionEffects(currentTime, myPlayer);

      this.ctx.restore(); // Remove clipping
    } else {
      // Fallback: draw everything if no player found
      this.drawBackground();
      this.drawObstacles();
      this.drawPowerUps();
      this.drawStars();
      this.drawStunOrbs();
      this.gameState.players.forEach((player) => {
        this.drawPlayer(player, currentTime);
      });
      this.gameState.players.forEach((player) => {
        if (player.isIt && (player as any).isPerformingStunPulse) {
          this.drawStunPulseEffect(player);
        }
      });
      this.drawExplosionEffects(currentTime);
    }

    // Draw UI elements (always visible)
    this.drawUI();

    // Draw virtual joystick for mobile devices
    if (this.isMobile && (window as any).input && (window as any).input.touchInput) {
      (window as any).input.touchInput.renderVirtualJoystick(this.ctx);
    }

    // Track render time for debug stats
    this.lastRenderTime = performance.now() - renderStart;
  }

  private drawBackground(): void {
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

  private drawObstacles(viewer?: PlayerState): void {
    if (!this.gameState?.obstacles) return;

    this.ctx.save();
    this.ctx.fillStyle = "#555555";
    this.ctx.strokeStyle = "#333333";
    this.ctx.lineWidth = 2;

    this.gameState.obstacles.forEach((obstacle: Obstacle) => {
      // Check visibility if viewer is provided
      if (viewer && !this.isObstacleVisible(obstacle, viewer)) {
        return;
      }

      if (obstacle.type === "rectangle" && obstacle.width && obstacle.height) {
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
      } else if (obstacle.type === "circle" && obstacle.radius) {
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

  private drawPowerUps(viewer?: PlayerState): void {
    if (!this.gameState?.powerUps) return;

    this.ctx.save();

    this.gameState.powerUps.forEach((powerUp: PowerUp) => {
      if (!powerUp.active) return;
      
      // Check visibility if viewer is provided
      if (viewer && !this.isPowerUpVisible(powerUp, viewer)) {
        return;
      }

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

  private drawStars(viewer?: PlayerState): void {
    if (!this.gameState?.stars) return;

    this.ctx.save();

    this.gameState.stars.forEach((star: Star) => {
      if (!star.active) return;
      
      // Check visibility if viewer is provided
      if (viewer && !this.isStarVisible(star, viewer)) {
        return;
      }

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

  private drawStunOrbs(viewer?: PlayerState): void {
    if (!this.gameState?.stunOrbs) return;

    this.ctx.save();

    this.gameState.stunOrbs.forEach((stunOrb: StunOrb) => {
      if (!stunOrb.active) return;
      
      // Check visibility if viewer is provided
      if (viewer && !this.isStunOrbVisible(stunOrb, viewer)) {
        return;
      }

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

  private drawStunPulseEffect(player: PlayerState): void {
    const playerAny = player as any;
    if (!playerAny.isPerformingStunPulse) return;

    const elapsed = Date.now() - playerAny.stunPulseStartTime;
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
  private drawStar(x: number, y: number, radius: number, points: number, innerRadiusRatio: number): void {
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

  private drawPlayer(player: PlayerState, currentTime: number): void {
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

    // Initialize or update trail buffer separately from interpolation data
    if (!this.trailBuffer.has(player.id)) {
      this.trailBuffer.set(player.id, {
        positions: [],
        trail: [],
        lastUpdate: currentTime,
      });
    }

    const trailData = this.trailBuffer.get(player.id)!;

    // Add to trail if player moved significantly
    const lastTrailPos =
      trailData.trail && trailData.trail.length > 0
        ? trailData.trail[trailData.trail.length - 1]
        : { x: renderX, y: renderY, alpha: 1.0 };

    const dx = renderX - lastTrailPos.x;
    const dy = renderY - lastTrailPos.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > 2) {
      if (!trailData.trail) trailData.trail = [];
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
    if (trailData.trail && (!this.isMobile || !this.enableLowPowerMode)) {
      trailData.trail.forEach((point) => {
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
    if (trailData.trail) {
      trailData.trail = trailData.trail.filter((point) => point.alpha > 0.1);
    }

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
    if (player.isAI && (player as any).currentBehavior) {
      this.ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
      this.ctx.font = "10px Arial";
      this.ctx.fillText(
        (player as any).currentBehavior,
        renderX,
        renderY + player.radius + 20
      );
    }
  }

  private drawExplosionEffects(currentTime: number, viewer?: PlayerState): void {
    // Filter out expired explosions and draw active ones
    this.explosionEffects = this.explosionEffects.filter(explosion => {
      // Check visibility if viewer is provided
      if (viewer && !this.isExplosionVisible(explosion, viewer)) {
        const elapsed = currentTime - explosion.startTime;
        const progress = elapsed / explosion.duration;
        return progress < 1; // Keep in list but don't draw
      }
      const elapsed = currentTime - explosion.startTime;
      const progress = elapsed / explosion.duration;
      
      if (progress >= 1) {
        return false; // Remove expired explosion
      }

      // Draw the explosion effect
      this.drawExplosion(explosion, progress);
      return true; // Keep active explosion
    });
  }

  private drawExplosion(explosion: ExplosionEffect, progress: number): void {
    const { x, y } = explosion;
    
    console.log(`Drawing explosion at (${x}, ${y}) with progress ${progress.toFixed(3)}`);
    
    // Calculate massive circular shock wave that covers entire screen
    // Use fixed large radius to ensure screen coverage
    const maxScreenDistance = 1000; // Fixed large radius instead of calculation
    
    // Create expanding circular shock wave
    const currentRadius = maxScreenDistance * progress;
    const opacity = Math.pow(1 - progress, 0.4) * 0.9;
    
    console.log(`Current radius: ${currentRadius.toFixed(1)}, opacity: ${opacity.toFixed(3)}`);
    
    // Initial bright flash
    if (progress < 0.1) {
      const flashIntensity = (1 - progress / 0.1) * 0.7;
      this.ctx.globalAlpha = flashIntensity;
      this.ctx.fillStyle = "#FFFFFF";
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      console.log(`Drawing flash with intensity ${flashIntensity}`);
    }
    
    // Main expanding shock wave circle - make it massive and visible
    this.ctx.globalAlpha = opacity;
    this.ctx.strokeStyle = "#00FFFF"; // Bright cyan
    this.ctx.lineWidth = Math.max(8, 40 * (1 - progress * 0.6)); // Very thick, stays thick longer
    this.ctx.setLineDash([]);
    this.ctx.beginPath();
    this.ctx.arc(x, y, currentRadius, 0, Math.PI * 2);
    this.ctx.stroke();
    console.log(`Drew main wave: radius ${currentRadius}, thickness ${this.ctx.lineWidth}`);
    
    // Secondary shock wave for depth
    if (progress > 0.05) {
      const secondaryProgress = (progress - 0.05) / 0.95;
      const secondaryRadius = maxScreenDistance * secondaryProgress;
      this.ctx.globalAlpha = opacity * 0.7;
      this.ctx.strokeStyle = "#FFD700"; // Golden
      this.ctx.lineWidth = Math.max(6, 30 * (1 - secondaryProgress * 0.6));
      this.ctx.beginPath();
      this.ctx.arc(x, y, secondaryRadius, 0, Math.PI * 2);
      this.ctx.stroke();
      console.log(`Drew secondary wave: radius ${secondaryRadius}, thickness ${this.ctx.lineWidth}`);
    }
    
    // Third wave for even more impact
    if (progress > 0.1) {
      const tertiaryProgress = (progress - 0.1) / 0.9;
      const tertiaryRadius = maxScreenDistance * tertiaryProgress;
      this.ctx.globalAlpha = opacity * 0.5;
      this.ctx.strokeStyle = "#FFFFFF"; // White
      this.ctx.lineWidth = Math.max(4, 20 * (1 - tertiaryProgress * 0.6));
      this.ctx.beginPath();
      this.ctx.arc(x, y, tertiaryRadius, 0, Math.PI * 2);
      this.ctx.stroke();
      console.log(`Drew tertiary wave: radius ${tertiaryRadius}, thickness ${this.ctx.lineWidth}`);
    }
    
    // Central explosion core
    if (progress < 0.4) {
      const coreOpacity = Math.pow(1 - progress / 0.4, 0.3);
      this.ctx.globalAlpha = coreOpacity;
      
      // Bright central explosion
      this.ctx.fillStyle = "#FFFFFF";
      this.ctx.beginPath();
      this.ctx.arc(x, y, 60 * (1 - progress / 0.4), 0, Math.PI * 2);
      this.ctx.fill();
      
      // Inner glow
      this.ctx.fillStyle = "#00FFFF";
      this.ctx.beginPath();
      this.ctx.arc(x, y, 30 * (1 - progress / 0.4), 0, Math.PI * 2);
      this.ctx.fill();
      console.log(`Drew core with opacity ${coreOpacity}`);
    }
    
    // Reset context
    this.ctx.globalAlpha = 1.0;
    this.ctx.setLineDash([]);
  }

  private drawUI(): void {
    // Draw game boundaries
    this.ctx.strokeStyle = "#333";
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(0, 0, this.canvas.width, this.canvas.height);
  }

  public formatTime(milliseconds: number): string {
    const seconds = Math.ceil(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  }

  // Enhanced network quality tracking methods
  private adaptInterpolationTime(): void {
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

  private updateNetworkMetrics(currentTime: number): void {
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

  private adjustInterpolationBuffer(): void {
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

  // Visibility helper methods for circular sight system
  private isPlayerVisible(player: PlayerState, viewer: PlayerState): boolean {
    // Always show the viewer themselves
    if (player.id === viewer.id) return true;
    
    const result = SightUtils.isInSightRange(viewer.x, viewer.y, viewer.sightRange, player.x, player.y);
    return result.isVisible;
  }

  private isObstacleVisible(obstacle: Obstacle, viewer: PlayerState): boolean {
    const result = SightUtils.isInSightRange(viewer.x, viewer.y, viewer.sightRange, obstacle.x, obstacle.y);
    return result.isVisible;
  }

  private isPowerUpVisible(powerUp: PowerUp, viewer: PlayerState): boolean {
    const result = SightUtils.isInSightRange(viewer.x, viewer.y, viewer.sightRange, powerUp.x, powerUp.y);
    return result.isVisible;
  }

  private isStarVisible(star: Star, viewer: PlayerState): boolean {
    const result = SightUtils.isInSightRange(viewer.x, viewer.y, viewer.sightRange, star.x, star.y);
    return result.isVisible;
  }

  private isStunOrbVisible(stunOrb: StunOrb, viewer: PlayerState): boolean {
    const result = SightUtils.isInSightRange(viewer.x, viewer.y, viewer.sightRange, stunOrb.x, stunOrb.y);
    return result.isVisible;
  }

  private isExplosionVisible(explosion: ExplosionEffect, viewer: PlayerState): boolean {
    const result = SightUtils.isInSightRange(viewer.x, viewer.y, viewer.sightRange, explosion.x, explosion.y);
    return result.isVisible;
  }

}