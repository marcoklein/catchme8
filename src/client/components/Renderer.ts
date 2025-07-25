import {
  GameStateData,
  PlayerState,
  Obstacle,
  PowerUp,
  Star,
  StunOrb,
  Position,
  SightUtils,
} from "@shared/types";

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

interface ScoreChangeAnimation {
  playerId: string;
  change: number;
  startTime: number;
  duration: number;
  x: number;
  y: number;
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

interface CameraState {
  x: number;        // Camera center X in world coordinates
  y: number;        // Camera center Y in world coordinates
  targetX: number;  // Target X for smooth following
  targetY: number;  // Target Y for smooth following
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
    stabilityScore: 1.0,
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
    high: 0.8, // Use physics-based extrapolation
    medium: 0.5, // Use velocity-based extrapolation
    low: 0.2, // Use conservative extrapolation
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
    offsetY: 0,
  };

  // Explosion effects
  private explosionEffects: ExplosionEffect[] = [];
  private explosionDebrisParticles: DebrisParticle[] | null = null;
  private lastRenderTime = 0;

  // Score change animations for canvas leaderboard
  private scoreChangeAnimations: ScoreChangeAnimation[] = [];

  // Camera system for player-centered rendering
  private camera: CameraState = {
    x: 400,  // Default center
    y: 300,  // Default center
    targetX: 400,
    targetY: 300
  };
  private cameraSmoothing = 0.1; // How quickly camera follows (0.1 = smooth, 1.0 = instant)

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

  private updateCamera(): void {
    if (!this.gameState || !this.myPlayerId) return;

    // Find the current player
    const myPlayer = this.gameState.players.find(p => p.id === this.myPlayerId);
    if (!myPlayer) return;

    // Set camera target to player position
    this.camera.targetX = myPlayer.x;
    this.camera.targetY = myPlayer.y;

    // Smoothly interpolate camera position
    this.camera.x += (this.camera.targetX - this.camera.x) * this.cameraSmoothing;
    this.camera.y += (this.camera.targetY - this.camera.y) * this.cameraSmoothing;
  }

  private worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
    return {
      x: worldX - this.camera.x + (this.canvas.width / 2),
      y: worldY - this.camera.y + (this.canvas.height / 2)
    };
  }

  private updatePlayerInterpolation(
    player: PlayerState,
    timestamp: number
  ): void {
    if (!player || !player.id) {
      return;
    }

    if (!this.interpolationBuffer.has(player.id)) {
      this.interpolationBuffer.set(player.id, {
        positions: [],
      });
    }

    const data = this.interpolationBuffer.get(player.id)!;

    // Validate position data
    if (typeof player.x !== "number" || typeof player.y !== "number") {
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

  private getInterpolatedPlayerPosition(
    player: PlayerState,
    currentTime: number
  ): Position {
    // AI players need interpolation since they update at 10 FPS but are broadcast at 30 FPS
    if (player.isAI) {
      const data = this.interpolationBuffer.get(player.id);
      if (data && data.positions && data.positions.length >= 2) {
        return this.performInterpolation(data.positions, currentTime);
      }
    }

    // For human players or AI players without enough data, use direct position
    const position = { x: player.x, y: player.y };

    // Validate position coordinates
    if (isNaN(position.x) || isNaN(position.y)) {
      return { x: 400, y: 300 }; // Safe fallback position
    }

    return position;
  }

  private performInterpolation(positions: any[], currentTime: number): Position {
    // Use a smaller delay now that AI updates at 30 FPS instead of 10 FPS
    const interpolationDelay = 50; // 50ms behind for smooth interpolation
    const targetTime = currentTime - interpolationDelay;

    // Find the two positions to interpolate between
    let beforePos = null;
    let afterPos = null;

    for (let i = 0; i < positions.length - 1; i++) {
      if (positions[i].timestamp <= targetTime && positions[i + 1].timestamp >= targetTime) {
        beforePos = positions[i];
        afterPos = positions[i + 1];
        break;
      }
    }

    // If we can't find bracketing positions, use the most recent
    if (!beforePos || !afterPos) {
      const latest = positions[positions.length - 1];
      return { x: latest.x, y: latest.y };
    }

    // Calculate interpolation factor
    const timeDiff = afterPos.timestamp - beforePos.timestamp;
    if (timeDiff === 0) {
      return { x: beforePos.x, y: beforePos.y };
    }

    const t = Math.max(0, Math.min(1, (targetTime - beforePos.timestamp) / timeDiff));
    
    // Perform linear interpolation
    return {
      x: beforePos.x + (afterPos.x - beforePos.x) * t,
      y: beforePos.y + (afterPos.y - beforePos.y) * t
    };
  }

  private linearInterpolation(
    pos1: Position,
    pos2: Position,
    t: number
  ): Position {
    return {
      x: pos1.x + (pos2.x - pos1.x) * t,
      y: pos1.y + (pos2.y - pos1.y) * t,
    };
  }

  private simpleExtrapolation(
    player: PlayerState,
    currentTime: number,
    data: InterpolationData
  ): Position {
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
      y: (latest.y - previous.y) / timeDiff,
    };

    const extrapolationTime = Math.min(currentTime - latest.timestamp, 100); // Max 100ms

    return {
      x: latest.x + velocity.x * extrapolationTime,
      y: latest.y + velocity.y * extrapolationTime,
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

  public triggerScoreChangeAnimation(playerId: string, change: number): void {
    if (!this.gameState) return;
    
    const player = this.gameState.players.find(p => p.id === playerId);
    if (!player) return;

    // Calculate position in leaderboard area for the animation
    const isMobile = this.isMobile;
    const baseWidth = isMobile ? 140 : 180;
    const padding = isMobile ? 6 : 8;
    const totalWidth = baseWidth + padding * 2;
    const x = this.canvas.width - totalWidth + totalWidth / 2;
    const y = 60; // Near the leaderboard header

    this.scoreChangeAnimations.push({
      playerId: playerId,
      change: change,
      startTime: Date.now(),
      duration: 2000,
      x: x,
      y: y
    });
  }

  public render(): void {
    if (!this.gameState) {
      console.log("[RENDER] No gameState available, skipping render");
      return;
    }

    const renderStart = performance.now();
    const currentTime = Date.now();

    // Update camera to follow player
    this.updateCamera();

    // Get current player for sight calculations
    const myPlayer = this.gameState.players.find(
      (p) => p.id === this.myPlayerId
    );

    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Debug: Log canvas dimensions and game state occasionally
    const aiPlayers = this.gameState.players.filter((p) => p.isAI);
    if (aiPlayers.length > 0 && Math.random() < 0.05) {
      // 5% of the time
      console.log(
        `[RENDER] Canvas dimensions: ${this.canvas.width}x${this.canvas.height}, AI players: ${aiPlayers.length}`
      );
      console.log(
        `[RENDER] About to draw AI players:`,
        aiPlayers.map((p) => `${p.name}@(${p.x},${p.y})`)
      );
    }

    // CIRCULAR SIGHT SYSTEM ENABLED
    // Render with sight restrictions based on current player's vision
    if (myPlayer) {
      console.log(
        `[RENDER] Rendering with sight system for ${myPlayer.name} (${myPlayer.id}), sight range: ${myPlayer.sightRange}`
      );
      
      // Draw background normally (always visible)
      this.drawBackground();

      // Apply fog of war - black out everything outside vision circle
      this.drawFogOfWar(myPlayer);

      // Draw world border AFTER fog of war so it remains visible
      this.drawWorldBorder();

      // Draw ALL game objects AFTER fog of war so they remain visible when in sight range
      this.drawObstacles(myPlayer);
      this.drawPowerUps(myPlayer);
      this.drawStars(myPlayer);
      this.drawStunOrbs(myPlayer);

      // Draw explosion effects (only visible ones) AFTER fog of war
      this.drawExplosionEffects(currentTime, myPlayer);

      // Draw players AFTER fog of war so they remain visible
      this.gameState.players.forEach((player) => {
        if (this.isPlayerVisible(player, myPlayer)) {
          this.drawPlayer(player, currentTime);
        }
      });

      // Draw stun pulse effects for visible IT players AFTER fog of war
      this.gameState.players.forEach((player) => {
        if (player.isIt && (player as any).isPerformingStunPulse && this.isPlayerVisible(player, myPlayer)) {
          this.drawStunPulseEffect(player);
        }
      });

      // Draw sight circle AFTER fog of war so it remains visible
      this.drawSightCircle(myPlayer);
    } else {
      // Fallback: draw everything if no player found
      console.log(`[RENDER] No myPlayer found, using fallback rendering`);
      this.drawBackground();
      
      // Apply fog of war in fallback mode too (if we can find any player)
      const anyPlayer = this.gameState.players.find(p => p.id === this.myPlayerId) || this.gameState.players[0];
      if (anyPlayer) {
        this.drawFogOfWar(anyPlayer);
      }

      // Draw world border AFTER fog of war in fallback mode
      this.drawWorldBorder();

      // Draw ALL game objects AFTER fog of war in fallback mode
      this.drawObstacles();
      this.drawPowerUps();
      this.drawStars();
      this.drawStunOrbs();
      this.drawExplosionEffects(currentTime);

      // Draw players AFTER fog of war
      this.gameState.players.forEach((player) => {
        this.drawPlayer(player, currentTime);
      });
      this.gameState.players.forEach((player) => {
        if (player.isIt && (player as any).isPerformingStunPulse) {
          this.drawStunPulseEffect(player);
        }
      });
    }

    // Draw UI elements (always visible)
    this.drawUI();

    // Draw score change animations (always visible, on top)
    this.drawScoreChangeAnimations(currentTime);

    // Draw virtual joystick for mobile devices
    if (
      this.isMobile &&
      (window as any).input &&
      (window as any).input.touchInput
    ) {
      (window as any).input.touchInput.renderVirtualJoystick(this.ctx);
    }

    // Track render time for debug stats
    this.lastRenderTime = performance.now() - renderStart;
  }

  private drawBackground(): void {
    // Draw a subtle grid pattern that scrolls with camera
    this.ctx.strokeStyle = "#e0e0e0";
    this.ctx.lineWidth = 1;
    this.ctx.globalAlpha = 0.3;

    const gridSize = 50;
    
    // Calculate the offset based on camera position
    const offsetX = (this.camera.x % gridSize);
    const offsetY = (this.camera.y % gridSize);
    
    // Draw vertical lines
    for (let x = -offsetX; x <= this.canvas.width + gridSize; x += gridSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, this.canvas.height);
      this.ctx.stroke();
    }

    // Draw horizontal lines  
    for (let y = -offsetY; y <= this.canvas.height + gridSize; y += gridSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(this.canvas.width, y);
      this.ctx.stroke();
    }

    this.ctx.globalAlpha = 1;
  }

  private drawFogOfWar(player: PlayerState): void {
    this.ctx.save();
    
    // Convert world coordinates to screen coordinates
    const screenPos = this.worldToScreen(player.x, player.y);
    
    // Create a mask that covers the entire canvas with black, except for the vision circle
    this.ctx.fillStyle = "rgba(0, 0, 0, 0.9)"; // Almost completely black
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Cut out the vision circle using composite operation
    this.ctx.globalCompositeOperation = "destination-out";
    this.ctx.beginPath();
    this.ctx.arc(screenPos.x, screenPos.y, player.sightRange, 0, Math.PI * 2);
    this.ctx.fill();
    
    // Reset composite operation
    this.ctx.globalCompositeOperation = "source-over";
    
    this.ctx.restore();
  }

  private drawSightCircle(player: PlayerState): void {
    this.ctx.save();
    
    // Convert world coordinates to screen coordinates
    const screenPos = this.worldToScreen(player.x, player.y);
    
    // Create animated effect for vision radius
    const time = Date.now() * 0.002;
    const pulseAlpha = 0.4 + Math.sin(time) * 0.2; // Pulsing opacity
    const pulseWidth = 3 + Math.sin(time * 1.5) * 1; // Pulsing line width
    
    // Draw main vision radius boundary - bright and visible
    this.ctx.strokeStyle = `rgba(0, 150, 255, ${pulseAlpha})`; // Bright blue with pulsing alpha
    this.ctx.lineWidth = pulseWidth;
    this.ctx.setLineDash([8, 4]); // Longer dashes for better visibility
    this.ctx.beginPath();
    this.ctx.arc(screenPos.x, screenPos.y, player.sightRange, 0, Math.PI * 2);
    this.ctx.stroke();
    
    // Draw secondary inner circle for enhanced visibility
    this.ctx.strokeStyle = `rgba(255, 255, 255, ${pulseAlpha * 0.8})`; // White inner circle
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([4, 8]); // Different dash pattern (inverted)
    this.ctx.beginPath();
    this.ctx.arc(screenPos.x, screenPos.y, player.sightRange - 2, 0, Math.PI * 2);
    this.ctx.stroke();
    
    // Add vision range indicator text (only if visible in the vision area)
    this.ctx.fillStyle = `rgba(255, 255, 255, ${pulseAlpha})`;
    this.ctx.font = "12px Arial";
    this.ctx.textAlign = "center";
    this.ctx.fillText(
      `Vision: ${player.sightRange}px`,
      screenPos.x,
      screenPos.y + player.sightRange + 20
    );
    
    // Reset line dash
    this.ctx.setLineDash([]);
    
    this.ctx.restore();
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

      // Convert world coordinates to screen coordinates
      const screenPos = this.worldToScreen(obstacle.x, obstacle.y);

      if (obstacle.type === "rectangle" && obstacle.width && obstacle.height) {
        // Draw rectangle obstacle
        const x = screenPos.x - obstacle.width / 2;
        const y = screenPos.y - obstacle.height / 2;

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
        this.ctx.arc(screenPos.x, screenPos.y, obstacle.radius, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();

        // Add inner circle for texture
        this.ctx.save();
        this.ctx.fillStyle = "#777777";
        this.ctx.beginPath();
        this.ctx.arc(
          screenPos.x,
          screenPos.y,
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

      // Convert world coordinates to screen coordinates
      const screenPos = this.worldToScreen(powerUp.x, powerUp.y);

      // Create a pulsing effect
      const time = Date.now() * 0.005;
      const pulseScale = 1 + Math.sin(time) * 0.1;
      const alpha = 0.8 + Math.sin(time * 2) * 0.2;

      this.ctx.globalAlpha = alpha;

      if (powerUp.type === "transparency") {
        // Draw transparency power-up with special effect
        const gradient = this.ctx.createRadialGradient(
          screenPos.x,
          screenPos.y,
          0,
          screenPos.x,
          screenPos.y,
          powerUp.radius * pulseScale
        );
        gradient.addColorStop(0, "rgba(173, 216, 230, 0.9)"); // Light blue center
        gradient.addColorStop(0.5, "rgba(135, 206, 250, 0.7)"); // Sky blue
        gradient.addColorStop(1, "rgba(70, 130, 180, 0.3)"); // Steel blue edge

        this.ctx.fillStyle = gradient;
        this.ctx.beginPath();
        this.ctx.arc(
          screenPos.x,
          screenPos.y,
          powerUp.radius * pulseScale,
          0,
          Math.PI * 2
        );
        this.ctx.fill();

        // Add sparkle effect
        this.ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
        this.ctx.beginPath();
        this.ctx.arc(screenPos.x - 3, screenPos.y - 3, 2, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.beginPath();
        this.ctx.arc(screenPos.x + 4, screenPos.y + 2, 1.5, 0, Math.PI * 2);
        this.ctx.fill();

        // Draw border
        this.ctx.strokeStyle = "rgba(70, 130, 180, 0.8)";
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.arc(
          screenPos.x,
          screenPos.y,
          powerUp.radius * pulseScale,
          0,
          Math.PI * 2
        );
        this.ctx.stroke();
      } else if (powerUp.type === "size") {
        // Draw size power-up with golden/orange gradient
        const gradient = this.ctx.createRadialGradient(
          screenPos.x,
          screenPos.y,
          0,
          screenPos.x,
          screenPos.y,
          powerUp.radius * pulseScale
        );
        gradient.addColorStop(0, "rgba(255, 215, 0, 0.9)"); // Gold center
        gradient.addColorStop(0.5, "rgba(255, 165, 0, 0.7)"); // Orange
        gradient.addColorStop(1, "rgba(255, 140, 0, 0.3)"); // Dark orange edge

        this.ctx.fillStyle = gradient;
        this.ctx.beginPath();
        this.ctx.arc(
          screenPos.x,
          screenPos.y,
          powerUp.radius * pulseScale,
          0,
          Math.PI * 2
        );
        this.ctx.fill();

        // Add size indicator rings
        this.ctx.strokeStyle = "rgba(255, 215, 0, 0.6)";
        this.ctx.lineWidth = 1.5;
        this.ctx.setLineDash([3, 3]);
        
        // Inner ring
        this.ctx.beginPath();
        this.ctx.arc(screenPos.x, screenPos.y, (powerUp.radius * 0.6) * pulseScale, 0, Math.PI * 2);
        this.ctx.stroke();
        
        // Outer ring
        this.ctx.beginPath();
        this.ctx.arc(screenPos.x, screenPos.y, (powerUp.radius * 1.3) * pulseScale, 0, Math.PI * 2);
        this.ctx.stroke();
        
        this.ctx.setLineDash([]); // Reset dash pattern

        // Add growth sparkles
        this.ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
        const sparkleCount = 4;
        for (let i = 0; i < sparkleCount; i++) {
          const angle = (time * 2 + (i * Math.PI * 2) / sparkleCount) % (Math.PI * 2);
          const sparkleRadius = powerUp.radius * 0.8;
          const sparkleX = screenPos.x + Math.cos(angle) * sparkleRadius;
          const sparkleY = screenPos.y + Math.sin(angle) * sparkleRadius;
          
          this.ctx.beginPath();
          this.ctx.arc(sparkleX, sparkleY, 1.5, 0, Math.PI * 2);
          this.ctx.fill();
        }

        // Draw border
        this.ctx.strokeStyle = "rgba(255, 140, 0, 0.8)";
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.arc(
          screenPos.x,
          screenPos.y,
          powerUp.radius * pulseScale,
          0,
          Math.PI * 2
        );
        this.ctx.stroke();
      } else if (powerUp.type === "speed") {
        // Draw speed power-up with green gradient and motion lines
        const gradient = this.ctx.createRadialGradient(
          screenPos.x,
          screenPos.y,
          0,
          screenPos.x,
          screenPos.y,
          powerUp.radius * pulseScale
        );
        gradient.addColorStop(0, "rgba(0, 255, 0, 0.9)"); // Bright green center
        gradient.addColorStop(0.5, "rgba(50, 205, 50, 0.7)"); // Lime green
        gradient.addColorStop(1, "rgba(34, 139, 34, 0.3)"); // Forest green edge

        this.ctx.fillStyle = gradient;
        this.ctx.beginPath();
        this.ctx.arc(
          screenPos.x,
          screenPos.y,
          powerUp.radius * pulseScale,
          0,
          Math.PI * 2
        );
        this.ctx.fill();

        // Add motion lines for speed effect
        this.ctx.strokeStyle = "rgba(144, 238, 144, 0.8)"; // Light green
        this.ctx.lineWidth = 2;
        const lineCount = 6;
        for (let i = 0; i < lineCount; i++) {
          const angle = (time * 4 + (i * Math.PI * 2) / lineCount) % (Math.PI * 2);
          const lineLength = powerUp.radius * 0.7;
          const startRadius = powerUp.radius * 0.3;
          
          const startX = screenPos.x + Math.cos(angle) * startRadius;
          const startY = screenPos.y + Math.sin(angle) * startRadius;
          const endX = screenPos.x + Math.cos(angle) * (startRadius + lineLength);
          const endY = screenPos.y + Math.sin(angle) * (startRadius + lineLength);
          
          this.ctx.beginPath();
          this.ctx.moveTo(startX, startY);
          this.ctx.lineTo(endX, endY);
          this.ctx.stroke();
        }

        // Add speed trails
        this.ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
        this.ctx.beginPath();
        this.ctx.arc(screenPos.x - 2, screenPos.y, 1, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.beginPath();
        this.ctx.arc(screenPos.x + 3, screenPos.y - 2, 1.2, 0, Math.PI * 2);
        this.ctx.fill();

        // Draw border
        this.ctx.strokeStyle = "rgba(34, 139, 34, 0.8)";
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.arc(
          screenPos.x,
          screenPos.y,
          powerUp.radius * pulseScale,
          0,
          Math.PI * 2
        );
        this.ctx.stroke();
      } else if (powerUp.type === "stun") {
        // Draw stun power-up with purple/electric effect (similar to stun orbs but different color)
        const gradient = this.ctx.createRadialGradient(
          screenPos.x,
          screenPos.y,
          0,
          screenPos.x,
          screenPos.y,
          powerUp.radius * pulseScale
        );
        gradient.addColorStop(0, "rgba(138, 43, 226, 0.9)"); // Blue violet center
        gradient.addColorStop(0.5, "rgba(147, 112, 219, 0.7)"); // Medium slate blue
        gradient.addColorStop(1, "rgba(75, 0, 130, 0.3)"); // Indigo edge

        this.ctx.fillStyle = gradient;
        this.ctx.beginPath();
        this.ctx.arc(
          screenPos.x,
          screenPos.y,
          powerUp.radius * pulseScale,
          0,
          Math.PI * 2
        );
        this.ctx.fill();

        // Add electrical sparks (similar to stun orbs but purple)
        this.ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
        this.ctx.lineWidth = 1.5;
        for (let i = 0; i < 4; i++) {
          const angle = (time * 3 + (i * Math.PI) / 2) % (Math.PI * 2);
          const sparkLength = powerUp.radius + Math.sin(time * 5) * 3;
          const startX = screenPos.x + Math.cos(angle) * (powerUp.radius * 0.7);
          const startY = screenPos.y + Math.sin(angle) * (powerUp.radius * 0.7);
          const endX = screenPos.x + Math.cos(angle) * sparkLength;
          const endY = screenPos.y + Math.sin(angle) * sparkLength;

          this.ctx.beginPath();
          this.ctx.moveTo(startX, startY);
          this.ctx.lineTo(endX, endY);
          this.ctx.stroke();
        }

        // Draw border
        this.ctx.strokeStyle = "rgba(138, 43, 226, 0.8)";
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.arc(
          screenPos.x,
          screenPos.y,
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

      // Convert world coordinates to screen coordinates
      const screenPos = this.worldToScreen(star.x, star.y);

      // Create a pulsing glow effect
      const time = Date.now() * 0.003;
      const pulseScale = 1 + Math.sin(time) * 0.15;
      const glowAlpha = 0.6 + Math.sin(time * 2) * 0.3;

      // Draw the glow background
      this.ctx.globalAlpha = glowAlpha;
      const glowGradient = this.ctx.createRadialGradient(
        screenPos.x,
        screenPos.y,
        0,
        screenPos.x,
        screenPos.y,
        star.radius * 2.5
      );
      glowGradient.addColorStop(0, "rgba(255, 215, 0, 0.8)"); // Gold center
      glowGradient.addColorStop(0.5, "rgba(255, 215, 0, 0.4)"); // Gold mid
      glowGradient.addColorStop(1, "rgba(255, 215, 0, 0)"); // Transparent edge

      this.ctx.fillStyle = glowGradient;
      this.ctx.beginPath();
      this.ctx.arc(screenPos.x, screenPos.y, star.radius * 2.5, 0, Math.PI * 2);
      this.ctx.fill();

      // Draw the star shape with rotation
      this.ctx.globalAlpha = 1;
      this.ctx.save();
      this.ctx.translate(screenPos.x, screenPos.y);
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

      // Convert world coordinates to screen coordinates
      const screenPos = this.worldToScreen(stunOrb.x, stunOrb.y);

      // Create electrical animation
      const time = Date.now() * 0.01;
      const electricPhase = stunOrb.electricPhase + time;
      const pulseScale = 1 + Math.sin(electricPhase * 3) * 0.2;
      const sparkAlpha = 0.7 + Math.sin(electricPhase * 5) * 0.3;

      this.ctx.globalAlpha = sparkAlpha;

      // Draw electric blue gradient
      const gradient = this.ctx.createRadialGradient(
        screenPos.x,
        screenPos.y,
        0,
        screenPos.x,
        screenPos.y,
        stunOrb.radius * pulseScale
      );
      gradient.addColorStop(0, "rgba(0, 191, 255, 0.9)"); // Deep sky blue center
      gradient.addColorStop(0.5, "rgba(30, 144, 255, 0.7)"); // Dodger blue
      gradient.addColorStop(1, "rgba(65, 105, 225, 0.3)"); // Royal blue edge

      this.ctx.fillStyle = gradient;
      this.ctx.beginPath();
      this.ctx.arc(
        screenPos.x,
        screenPos.y,
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
        const startX = screenPos.x + Math.cos(angle) * stunOrb.radius;
        const startY = screenPos.y + Math.sin(angle) * stunOrb.radius;
        const endX = screenPos.x + Math.cos(angle) * sparkLength;
        const endY = screenPos.y + Math.sin(angle) * sparkLength;

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
        screenPos.x,
        screenPos.y,
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

    // Convert world coordinates to screen coordinates
    const screenPos = this.worldToScreen(player.x, player.y);

    const elapsed = Date.now() - playerAny.stunPulseStartTime;
    const progress = elapsed / 3000; // 3 second duration
    const radius = 80 * progress; // Expanding radius
    const alpha = 1 - progress; // Fading out

    this.ctx.save();
    this.ctx.globalAlpha = alpha * 0.4;

    // Draw expanding electric circle
    const gradient = this.ctx.createRadialGradient(
      screenPos.x,
      screenPos.y,
      radius * 0.3,
      screenPos.x,
      screenPos.y,
      radius
    );
    gradient.addColorStop(0, "rgba(0, 191, 255, 0.8)");
    gradient.addColorStop(0.7, "rgba(30, 144, 255, 0.4)");
    gradient.addColorStop(1, "rgba(65, 105, 225, 0.1)");

    this.ctx.fillStyle = gradient;
    this.ctx.beginPath();
    this.ctx.arc(screenPos.x, screenPos.y, radius, 0, Math.PI * 2);
    this.ctx.fill();

    // Draw electric border
    this.ctx.strokeStyle = `rgba(0, 191, 255, ${alpha})`;
    this.ctx.lineWidth = 3;
    this.ctx.beginPath();
    this.ctx.arc(screenPos.x, screenPos.y, radius, 0, Math.PI * 2);
    this.ctx.stroke();

    this.ctx.restore();
  }

  // Helper method to draw a star shape
  private drawStar(
    x: number,
    y: number,
    radius: number,
    points: number,
    innerRadiusRatio: number
  ): void {
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
    // EXCEPTION: Always render AI players (even when transparent) so we can see them for debugging
    if (player.isTransparent && !isMyPlayer && !player.isAI) {
      console.log(
        `[DRAW_PLAYER] Skipping transparent non-AI player ${player.name}`
      );
      return;
    }

    // Always log AI player draw calls to debug the issue
    if (player.isAI) {
      console.log(
        `[DRAW_PLAYER] 🤖 Drawing AI player ${player.name} at (${player.x}, ${player.y}), transparent: ${player.isTransparent}, isMyPlayer: ${isMyPlayer}`
      );
    }

    // Get interpolated position for smooth movement
    const interpolatedPos = this.getInterpolatedPlayerPosition(
      player,
      currentTime
    );
    
    // Convert world coordinates to screen coordinates
    const screenPos = this.worldToScreen(interpolatedPos.x, interpolatedPos.y);
    const renderX = screenPos.x;
    const renderY = screenPos.y;

    if (player.isAI) {
      console.log(
        `[DRAW_PLAYER] AI player ${player.name} render position: (${renderX}, ${renderY})`
      );
    }

    // Initialize or update trail buffer separately from interpolation data
    if (!this.trailBuffer.has(player.id)) {
      this.trailBuffer.set(player.id, {
        positions: [],
        trail: [],
        lastUpdate: currentTime,
      });
    }

    const trailData = this.trailBuffer.get(player.id)!;

    // Add to trail if player moved significantly (use world coordinates for distance calculation)
    const lastTrailPos =
      trailData.trail && trailData.trail.length > 0
        ? trailData.trail[trailData.trail.length - 1]
        : { x: interpolatedPos.x, y: interpolatedPos.y, alpha: 1.0 };

    const dx = interpolatedPos.x - lastTrailPos.x;
    const dy = interpolatedPos.y - lastTrailPos.y;
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
          // Convert trail point to screen coordinates
          const trailScreenPos = this.worldToScreen(point.x, point.y);
          this.ctx.beginPath();
          this.ctx.arc(trailScreenPos.x, trailScreenPos.y, player.radius * 0.6, 0, Math.PI * 2);
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
    if (player.isAI) {
      console.log(
        `[DRAW_PLAYER] About to draw AI player ${player.name} circle at (${renderX}, ${renderY}) with radius ${player.currentRadius} and color ${player.color}`
      );
    }

    this.ctx.beginPath();
    this.ctx.arc(renderX, renderY, player.currentRadius, 0, Math.PI * 2);
    this.ctx.fillStyle = player.color;
    this.ctx.fill();

    if (player.isAI) {
      console.log(
        `[DRAW_PLAYER] Successfully drew AI player ${player.name} circle`
      );
    }

    // Add border - make AI players have bright red border for visibility
    if (player.isAI) {
      this.ctx.strokeStyle = "#FF0000"; // Bright red for AI players
      this.ctx.lineWidth = 4;
    } else {
      this.ctx.strokeStyle = isMyPlayer ? "#000" : "#333";
      this.ctx.lineWidth = isMyPlayer ? 3 : 2;
    }
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
      this.ctx.arc(renderX, renderY, player.currentRadius + glowSize, 0, Math.PI * 2);
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
      this.ctx.arc(renderX, renderY, player.currentRadius + 8, 0, Math.PI * 2);
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
      this.ctx.arc(renderX, renderY, player.currentRadius + 6, 0, Math.PI * 2);
      this.ctx.stroke();
      this.ctx.setLineDash([]);
      this.ctx.restore();
    }

    // Size boost effect - golden pulsing glow that intensifies with stacks
    if (player.hasSizeBoost) {
      this.ctx.save();
      const time = Date.now() / 1000;
      const stacks = player.sizeBoostStacks || 1;
      
      // More stacks = more intense effects
      const baseAlpha = 0.3 + (stacks * 0.1); // Brighter with more stacks
      const glowAlpha = baseAlpha + Math.sin(time * 4) * 0.2;
      const glowSize = 3 + Math.sin(time * 5) * 2 + (stacks * 2); // Larger glow per stack
      
      this.ctx.globalAlpha = Math.min(glowAlpha, 0.8); // Cap at 0.8
      this.ctx.strokeStyle = "#FFD700"; // Golden color
      this.ctx.lineWidth = 3 + stacks; // Thicker lines with more stacks
      this.ctx.setLineDash([3, 3]);
      
      // Draw multiple rings for higher stacks
      for (let i = 0; i < Math.min(stacks, 3); i++) {
        this.ctx.beginPath();
        this.ctx.arc(renderX, renderY, player.currentRadius + glowSize + (i * 3), 0, Math.PI * 2);
        this.ctx.stroke();
      }
      
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
    
    // Add size boost stack indicator
    if (player.hasSizeBoost && player.sizeBoostStacks > 0) {
      displayName = `${displayName} [SIZE x${player.sizeBoostStacks}]`;
      if (!player.isStunned) {
        this.ctx.fillStyle = "#FFD700"; // Golden text for size boost
      }
    }
    
    this.ctx.fillText(displayName, renderX, renderY - player.currentRadius - 10);

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
        renderY + player.currentRadius + 20
      );
    }
  }

  private drawExplosionEffects(
    currentTime: number,
    viewer?: PlayerState
  ): void {
    // Filter out expired explosions and draw active ones
    this.explosionEffects = this.explosionEffects.filter((explosion) => {
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
    // Convert world coordinates to screen coordinates
    const screenPos = this.worldToScreen(explosion.x, explosion.y);
    const { x, y } = screenPos;

    // Calculate massive circular shock wave that covers entire screen
    // Use fixed large radius to ensure screen coverage
    const maxScreenDistance = 1000; // Fixed large radius instead of calculation

    // Create expanding circular shock wave
    const currentRadius = maxScreenDistance * progress;
    const opacity = Math.pow(1 - progress, 0.4) * 0.9;

    // Initial bright flash
    if (progress < 0.1) {
      const flashIntensity = (1 - progress / 0.1) * 0.7;
      this.ctx.globalAlpha = flashIntensity;
      this.ctx.fillStyle = "#FFFFFF";
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    // Main expanding shock wave circle - make it massive and visible
    this.ctx.globalAlpha = opacity;
    this.ctx.strokeStyle = "#00FFFF"; // Bright cyan
    this.ctx.lineWidth = Math.max(8, 40 * (1 - progress * 0.6)); // Very thick, stays thick longer
    this.ctx.setLineDash([]);
    this.ctx.beginPath();
    this.ctx.arc(x, y, currentRadius, 0, Math.PI * 2);
    this.ctx.stroke();

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
    }

    // Reset context
    this.ctx.globalAlpha = 1.0;
    this.ctx.setLineDash([]);
  }

  private drawWorldBorder(): void {
    if (!this.gameState) return;

    // Get world dimensions
    const worldWidth = this.gameState.gameWidth;
    const worldHeight = this.gameState.gameHeight;

    // Convert world border corners to screen coordinates
    const topLeft = this.worldToScreen(0, 0);
    const bottomRight = this.worldToScreen(worldWidth, worldHeight);

    // Calculate border dimensions in screen space
    const borderWidth = bottomRight.x - topLeft.x;
    const borderHeight = bottomRight.y - topLeft.y;

    this.ctx.save();

    // Draw outer world border with dark color to match fog of war
    this.ctx.strokeStyle = "rgba(0, 0, 0, 0.9)"; // Dark border to match fog color
    this.ctx.lineWidth = 4;
    this.ctx.setLineDash([10, 5]); // Dashed line pattern
    this.ctx.strokeRect(topLeft.x, topLeft.y, borderWidth, borderHeight);

    // Draw inner border line for better contrast
    this.ctx.strokeStyle = "rgba(64, 64, 64, 0.8)"; // Slightly lighter dark gray
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([5, 5]); // Different dash pattern
    this.ctx.strokeRect(topLeft.x + 2, topLeft.y + 2, borderWidth - 4, borderHeight - 4);

    // Reset line dash
    this.ctx.setLineDash([]);

    this.ctx.restore();
  }

  private drawUI(): void {
    // Draw canvas boundaries (not the world boundaries)
    this.ctx.strokeStyle = "#333";
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Draw canvas-based leaderboard
    this.drawCanvasLeaderboard();
  }

  private drawCanvasLeaderboard(): void {
    if (!this.gameState || !this.gameState.players) return;

    // Sort players by score (descending)
    const sortedPlayers = [...this.gameState.players].sort((a, b) => b.score - a.score);
    
    // Mobile-responsive sizing
    const isMobile = this.isMobile;
    const baseWidth = isMobile ? 140 : 180;
    const baseHeight = isMobile ? 20 : 25;
    const fontSize = isMobile ? 10 : 12;
    const padding = isMobile ? 6 : 8;
    const margin = isMobile ? 4 : 6;
    
    // Calculate leaderboard dimensions
    const maxEntries = Math.min(sortedPlayers.length, isMobile ? 5 : 8);
    const headerHeight = baseHeight + margin;
    const entryHeight = baseHeight;
    const totalHeight = headerHeight + (maxEntries * (entryHeight + margin)) + padding * 2;
    const totalWidth = baseWidth + padding * 2;
    
    // Position in top-right corner
    const x = this.canvas.width - totalWidth - 10;
    const y = 10;
    
    this.ctx.save();
    
    // Draw background with semi-transparent overlay
    this.ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
    this.ctx.fillRect(x, y, totalWidth, totalHeight);
    
    // Draw border
    this.ctx.strokeStyle = "rgba(255, 215, 0, 0.6)";
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(x, y, totalWidth, totalHeight);
    
    // Draw header
    this.ctx.fillStyle = "#FFD700";
    this.ctx.font = `bold ${fontSize + 2}px Arial`;
    this.ctx.textAlign = "center";
    this.ctx.fillText("SCORES", x + totalWidth / 2, y + padding + fontSize + 4);
    
    // Draw player entries
    let currentY = y + headerHeight + padding;
    
    for (let i = 0; i < maxEntries; i++) {
      const player = sortedPlayers[i];
      if (!player) break;
      
      const isMyPlayer = player.id === this.myPlayerId;
      const isItPlayer = player.isIt;
      
      // Entry background
      let bgColor = "rgba(40, 40, 40, 0.7)";
      if (isMyPlayer) {
        bgColor = "rgba(255, 215, 0, 0.3)"; // Golden for current player
      } else if (isItPlayer) {
        bgColor = "rgba(255, 69, 0, 0.3)"; // Red-orange for IT player
      }
      
      this.ctx.fillStyle = bgColor;
      this.ctx.fillRect(x + padding, currentY - 2, totalWidth - padding * 2, entryHeight);
      
      // Rank and medal emojis
      let rankText = `${i + 1}.`;
      if (i === 0) rankText = "🥇";
      else if (i === 1) rankText = "🥈";
      else if (i === 2) rankText = "🥉";
      
      this.ctx.fillStyle = "#FFFFFF";
      this.ctx.font = `${fontSize}px Arial`;
      this.ctx.textAlign = "left";
      this.ctx.fillText(rankText, x + padding + 2, currentY + fontSize);
      
      // Player name with IT indicator
      let displayName = player.name;
      if (player.isAI) displayName = `[AI] ${displayName}`;
      if (isItPlayer) displayName = `🎯 ${displayName}`;
      
      // Truncate name if too long for mobile
      const maxNameLength = isMobile ? 8 : 12;
      if (displayName.length > maxNameLength) {
        displayName = displayName.substring(0, maxNameLength - 2) + "..";
      }
      
      this.ctx.fillText(displayName, x + padding + 22, currentY + fontSize);
      
      // Score
      this.ctx.fillStyle = isMyPlayer ? "#FFD700" : "#FFFFFF";
      this.ctx.textAlign = "right";
      this.ctx.fillText(player.score.toString(), x + totalWidth - padding - 2, currentY + fontSize);
      
      currentY += entryHeight + margin;
    }
    
    // Show "+" indicator if there are more players
    if (sortedPlayers.length > maxEntries) {
      this.ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
      this.ctx.font = `${fontSize - 1}px Arial`;
      this.ctx.textAlign = "center";
      this.ctx.fillText(
        `+${sortedPlayers.length - maxEntries} more`,
        x + totalWidth / 2,
        currentY + fontSize - 2
      );
    }
    
    this.ctx.restore();
  }

  private drawScoreChangeAnimations(currentTime: number): void {
    this.scoreChangeAnimations = this.scoreChangeAnimations.filter((animation) => {
      const elapsed = currentTime - animation.startTime;
      const progress = elapsed / animation.duration;

      if (progress >= 1) {
        return false; // Remove expired animation
      }

      // Calculate floating animation
      const floatY = animation.y - (progress * 40); // Float upward
      const alpha = Math.max(0, 1 - progress); // Fade out
      const scale = 1 + (progress * 0.5); // Slightly grow

      this.ctx.save();
      this.ctx.globalAlpha = alpha;
      
      // Style based on positive/negative change
      const isPositive = animation.change > 0;
      this.ctx.fillStyle = isPositive ? "#00FF00" : "#FF4444";
      this.ctx.font = `bold ${14 * scale}px Arial`;
      this.ctx.textAlign = "center";
      this.ctx.strokeStyle = "rgba(0, 0, 0, 0.8)";
      this.ctx.lineWidth = 2;

      const text = `${isPositive ? '+' : ''}${animation.change}`;
      
      // Draw text outline for better visibility
      this.ctx.strokeText(text, animation.x, floatY);
      this.ctx.fillText(text, animation.x, floatY);
      
      this.ctx.restore();
      return true; // Keep active animation
    });
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
          const variance =
            samples.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
            samples.length;
          const jitter = Math.sqrt(variance);

          // Stability score from 0 (unstable) to 1 (perfect)
          this.networkMetrics.stabilityScore = Math.max(0, 1 - jitter / 100);
        }
      }
    }
  }

  private adjustInterpolationBuffer(): void {
    if (!this.networkMetrics) return;

    const stability = this.networkMetrics.stabilityScore || 1.0;

    if (stability > 0.8) {
      // High stability - can use smaller buffer
      this.currentBufferTime =
        this.adaptiveMin +
        (this.baseInterpolationTime - this.adaptiveMin) * 0.5;
    } else if (stability < 0.4) {
      // Low stability - use larger buffer
      this.currentBufferTime = Math.min(
        this.adaptiveMax,
        this.baseInterpolationTime * 1.5
      );
    }
    // Medium stability uses base buffer time
  }

  // Visibility helper methods for circular sight system
  private isPlayerVisible(player: PlayerState, viewer: PlayerState): boolean {
    // Always show the viewer themselves
    if (player.id === viewer.id) return true;

    const result = SightUtils.isInSightRange(
      viewer.x,
      viewer.y,
      viewer.sightRange,
      player.x,
      player.y
    );
    return result.isVisible;
  }

  private isObstacleVisible(obstacle: Obstacle, viewer: PlayerState): boolean {
    const result = SightUtils.isInSightRange(
      viewer.x,
      viewer.y,
      viewer.sightRange,
      obstacle.x,
      obstacle.y
    );
    return result.isVisible;
  }

  private isPowerUpVisible(powerUp: PowerUp, viewer: PlayerState): boolean {
    const result = SightUtils.isInSightRange(
      viewer.x,
      viewer.y,
      viewer.sightRange,
      powerUp.x,
      powerUp.y
    );
    return result.isVisible;
  }

  private isStarVisible(star: Star, viewer: PlayerState): boolean {
    const result = SightUtils.isInSightRange(
      viewer.x,
      viewer.y,
      viewer.sightRange,
      star.x,
      star.y
    );
    return result.isVisible;
  }

  private isStunOrbVisible(stunOrb: StunOrb, viewer: PlayerState): boolean {
    const result = SightUtils.isInSightRange(
      viewer.x,
      viewer.y,
      viewer.sightRange,
      stunOrb.x,
      stunOrb.y
    );
    return result.isVisible;
  }

  private isExplosionVisible(
    explosion: ExplosionEffect,
    viewer: PlayerState
  ): boolean {
    const result = SightUtils.isInSightRange(
      viewer.x,
      viewer.y,
      viewer.sightRange,
      explosion.x,
      explosion.y
    );
    return result.isVisible;
  }
}
