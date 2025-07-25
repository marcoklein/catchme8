import { GameStateData, Obstacle, PowerUp, Star, StunOrb, Position } from '@shared/types';
import { Player } from './Player';

export class GameState {
  private players = new Map<string, Player>();
  public gameActive = false;
  public gameStartTime: number | null = null;
  public readonly gameDuration = 120000; // 2 minutes
  public readonly gameWidth = 800;
  public readonly gameHeight = 600;
  public readonly minPlayers = 2;
  public readonly maxPlayers = 8;
  
  public readonly obstacles: Obstacle[] = [];
  private powerUps: PowerUp[] = [];
  private powerUpRespawnTimer = new Map<string, number>();
  
  // Stars system
  private stars: Star[] = [];
  private starRespawnTimer = new Map<string, number>();
  private readonly maxActiveStars = 3;
  private readonly starRespawnInterval = 8000; // 8 seconds
  
  // Stun orbs system
  private stunOrbs: StunOrb[] = [];
  private stunOrbRespawnTimer = new Map<string, number>();
  private readonly maxActiveStunOrbs = 2;
  private readonly stunOrbRespawnInterval = 20000; // 20 seconds

  constructor() {
    this.initializeObstacles();
    this.initializePowerUps();
    this.initializeStars();
    this.initializeStunOrbs();
  }

  // Player management
  public addPlayer(player: Player): boolean {
    if (this.players.size >= this.maxPlayers) {
      return false;
    }

    this.players.set(player.id, player);

    // If this is the first player, make them "it"
    if (this.players.size === 1) {
      player.becomeIt();
    }

    // Start game if we have minimum players
    if (this.players.size >= this.minPlayers && !this.gameActive) {
      this.startGame();
    }

    return true;
  }

  public removePlayer(playerId: string): boolean {
    const player = this.players.get(playerId);
    if (!player) return false;

    const wasIt = player.isIt;
    player.destroy(); // Clean up timeouts
    this.players.delete(playerId);

    // If the "it" player left, assign new "it" player
    if (wasIt && this.players.size > 0) {
      const newItPlayer = this.players.values().next().value;
      if (newItPlayer) {
        newItPlayer.becomeIt();
      }
    }

    // Stop game if not enough players
    if (this.players.size < this.minPlayers) {
      this.stopGame();
    }

    return true;
  }

  public getPlayer(playerId: string): Player | undefined {
    return this.players.get(playerId);
  }

  public getPlayerCount(): number {
    return this.players.size;
  }

  public getPlayers(): Map<string, Player> {
    return this.players;
  }

  public forEachPlayer(callback: (player: Player, playerId: string) => void): void {
    this.players.forEach(callback);
  }

  // Game state management
  private startGame(): void {
    this.gameActive = true;
    this.gameStartTime = Date.now();
    console.log('Game started with', this.players.size, 'players');
  }

  private stopGame(): void {
    this.gameActive = false;
    this.gameStartTime = null;
    console.log('Game stopped');
  }

  public isGameOver(): boolean {
    if (!this.gameActive || !this.gameStartTime) return false;
    return Date.now() - this.gameStartTime > this.gameDuration;
  }

  public getTimeRemaining(): number {
    if (!this.gameActive || !this.gameStartTime) return 0;
    const elapsed = Date.now() - this.gameStartTime;
    return Math.max(0, this.gameDuration - elapsed);
  }

  // Ensure there's always exactly one "it" player
  public ensureItPlayer(): void {
    if (this.players.size === 0) return;

    const itPlayers = Array.from(this.players.values()).filter(p => p.isIt);

    if (itPlayers.length === 0) {
      // No "it" player - assign one randomly
      const playerIds = Array.from(this.players.keys());
      const randomId = playerIds[Math.floor(Math.random() * playerIds.length)];
      const newItPlayer = this.players.get(randomId)!;
      newItPlayer.becomeIt();
    } else if (itPlayers.length > 1) {
      // Multiple "it" players - keep only one
      for (let i = 1; i < itPlayers.length; i++) {
        itPlayers[i].stopBeingIt();
      }
      console.log(`Fixed multiple "it" players, kept: ${itPlayers[0].name}`);
    }
  }

  // Game world initialization
  private initializeObstacles(): void {
    this.obstacles.push(
      // Corner obstacles
      { x: 150, y: 150, width: 60, height: 60, type: 'rectangle' },
      { x: 650, y: 150, width: 60, height: 60, type: 'rectangle' },
      { x: 150, y: 450, width: 60, height: 60, type: 'rectangle' },
      { x: 650, y: 450, width: 60, height: 60, type: 'rectangle' },
      // Circular obstacles
      { x: 200, y: 300, radius: 30, type: 'circle' },
      { x: 600, y: 300, radius: 30, type: 'circle' }
    );
  }

  private initializePowerUps(): void {
    const powerUpPositions = [
      { x: 80, y: 80 },
      { x: 720, y: 80 },
      { x: 80, y: 520 },
      { x: 720, y: 520 },
      { x: 300, y: 150 },
      { x: 500, y: 150 },
      { x: 300, y: 450 },
      { x: 500, y: 450 },
    ];

    powerUpPositions.forEach((pos, index) => {
      if (!this.checkObstacleCollision(pos.x, pos.y, 15)) {
        this.powerUps.push({
          id: `powerup_${index}`,
          x: pos.x,
          y: pos.y,
          type: Math.random() < 0.5 ? 'transparency' : 'size',
          radius: 15,
          active: true,
          duration: 5000,
          respawnTime: 15000,
        });
      }
    });
  }

  private initializeStars(): void {
    const starPositions = [
      { x: 200, y: 150 },
      { x: 600, y: 150 },
      { x: 200, y: 450 },
      { x: 600, y: 450 },
      { x: 400, y: 200 },
      { x: 150, y: 300 },
      { x: 650, y: 300 },
      { x: 300, y: 350 },
      { x: 500, y: 350 },
    ];

    // Select random positions for initial stars
    const selectedPositions: Position[] = [];
    const positionsCopy = [...starPositions];

    while (selectedPositions.length < this.maxActiveStars && positionsCopy.length > 0) {
      const randomIndex = Math.floor(Math.random() * positionsCopy.length);
      const pos = positionsCopy.splice(randomIndex, 1)[0];

      if (!this.checkObstacleCollision(pos.x, pos.y, 12)) {
        selectedPositions.push(pos);
      }
    }

    selectedPositions.forEach((pos, index) => {
      this.stars.push({
        id: `star_${index}`,
        x: pos.x,
        y: pos.y,
        type: 'star',
        radius: 12,
        active: true,
        spawnTime: Date.now(),
        rotationAngle: Math.random() * Math.PI * 2,
      });
    });
  }

  private initializeStunOrbs(): void {
    const stunOrbPositions = [
      { x: 120, y: 200 },
      { x: 680, y: 200 },
      { x: 120, y: 400 },
      { x: 680, y: 400 },
      { x: 400, y: 120 },
      { x: 400, y: 480 },
      { x: 250, y: 300 },
      { x: 550, y: 300 },
    ];

    // Select random positions for initial stun orbs
    const selectedPositions: Position[] = [];
    const positionsCopy = [...stunOrbPositions];

    while (selectedPositions.length < this.maxActiveStunOrbs && positionsCopy.length > 0) {
      const randomIndex = Math.floor(Math.random() * positionsCopy.length);
      const pos = positionsCopy.splice(randomIndex, 1)[0];

      if (!this.checkObstacleCollision(pos.x, pos.y, 15)) {
        selectedPositions.push(pos);
      }
    }

    selectedPositions.forEach((pos, index) => {
      this.stunOrbs.push({
        id: `stunorb_${index}`,
        x: pos.x,
        y: pos.y,
        type: 'stunOrb',
        radius: 15,
        active: true,
        spawnTime: Date.now(),
        electricPhase: Math.random() * Math.PI * 2,
      });
    });
  }

  // Item collision detection methods
  public checkPowerUpCollision(player: Player): PowerUp | null {
    for (const powerUp of this.powerUps) {
      if (!powerUp.active) continue;

      const dx = player.x - powerUp.x;
      const dy = player.y - powerUp.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < player.currentRadius + powerUp.radius) {
        // Deactivate the power-up and schedule respawn
        powerUp.active = false;
        this.powerUpRespawnTimer.set(powerUp.id, Date.now() + powerUp.respawnTime);
        return powerUp;
      }
    }
    return null;
  }

  public checkStarCollision(player: Player): Star | null {
    for (const star of this.stars) {
      if (!star.active) continue;

      const dx = player.x - star.x;
      const dy = player.y - star.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < player.currentRadius + star.radius) {
        // Deactivate the star and schedule respawn
        star.active = false;
        this.starRespawnTimer.set(star.id, Date.now() + this.starRespawnInterval);
        return star;
      }
    }
    return null;
  }

  public checkStunOrbCollision(player: Player): StunOrb | null {
    for (const stunOrb of this.stunOrbs) {
      if (!stunOrb.active) continue;

      const dx = player.x - stunOrb.x;
      const dy = player.y - stunOrb.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < player.currentRadius + stunOrb.radius) {
        return stunOrb;
      }
    }
    return null;
  }

  public collectStunOrb(player: Player, stunOrb: StunOrb): Array<{id: string; name: string; distance: number; stunDuration: number}> {
    // Deactivate the stun orb
    stunOrb.active = false;

    // Create explosion effect only for IT players
    if (player.isIt) {
      // Execute explosion at the stun orb location instead of around the player
      const affectedPlayers = this.executeStunOrbExplosion(stunOrb, player);

      // Set respawn timer
      this.stunOrbRespawnTimer.set(stunOrb.id, Date.now() + this.stunOrbRespawnInterval);

      return affectedPlayers;
    }

    // Set respawn timer for non-IT collection
    this.stunOrbRespawnTimer.set(stunOrb.id, Date.now() + this.stunOrbRespawnInterval);
    return [];
  }

  public executeStunOrbExplosion(stunOrb: StunOrb, itPlayer: Player): Array<{id: string; name: string; distance: number; stunDuration: number}> {
    // Screen-wide explosion - covers entire game field regardless of distance  
    const explosionRadius = Math.sqrt(this.gameWidth * this.gameWidth + this.gameHeight * this.gameHeight); // Diagonal coverage
    const affectedPlayers: Array<{id: string; name: string; distance: number; stunDuration: number}> = [];

    console.log(`Screen-wide stun orb explosion at (${stunOrb.x}, ${stunOrb.y}) affecting entire game field`);

    this.forEachPlayer((player) => {
      if (player.id === itPlayer.id) return; // Don't stun the IT player who collected it

      // Calculate distance from player to the stun orb explosion center for duration scaling
      const dx = player.x - stunOrb.x;
      const dy = player.y - stunOrb.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Distance-based stun duration: closer players get shorter stun, farther players get longer stun
      let stunDuration: number;
      if (distance <= 100) {
        stunDuration = 3000; // Close range: 3.0 seconds
      } else if (distance <= 200) {
        stunDuration = 4000; // Medium range: 4.0 seconds  
      } else {
        stunDuration = 5000; // Far range: 5.0 seconds
      }

      player.stun(stunDuration);
      affectedPlayers.push({
        id: player.id,
        name: player.name,
        distance: Math.round(distance),
        stunDuration: stunDuration
      });
      console.log(`Player ${player.name} stunned for ${stunDuration}ms at distance ${Math.round(distance)}px`);
    });

    return affectedPlayers;
  }

  // Collision detection
  public checkObstacleCollision(x: number, y: number, radius: number): boolean {
    for (const obstacle of this.obstacles) {
      if (obstacle.type === 'rectangle' && obstacle.width && obstacle.height) {
        const closestX = Math.max(
          obstacle.x - obstacle.width / 2,
          Math.min(x, obstacle.x + obstacle.width / 2)
        );
        const closestY = Math.max(
          obstacle.y - obstacle.height / 2,
          Math.min(y, obstacle.y + obstacle.height / 2)
        );

        const distanceX = x - closestX;
        const distanceY = y - closestY;
        const distanceSquared = distanceX * distanceX + distanceY * distanceY;

        if (distanceSquared < radius * radius) {
          return true;
        }
      } else if (obstacle.type === 'circle' && obstacle.radius) {
        const dx = x - obstacle.x;
        const dy = y - obstacle.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < radius + obstacle.radius) {
          return true;
        }
      }
    }
    return false;
  }

  // Safe spawn position
  public findSafeSpawnPosition(): Position {
    const playerRadius = 20;
    const safePositions = [
      { x: 100, y: 100 },
      { x: 700, y: 100 },
      { x: 100, y: 500 },
      { x: 700, y: 500 },
      { x: 400, y: 100 },
      { x: 400, y: 500 },
      { x: 100, y: 300 },
      { x: 700, y: 300 },
    ];

    for (const pos of safePositions) {
      if (!this.checkObstacleCollision(pos.x, pos.y, playerRadius)) {
        let tooClose = false;
        for (const player of this.players.values()) {
          const dx = pos.x - player.x;
          const dy = pos.y - player.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance < playerRadius * 3) {
            tooClose = true;
            break;
          }
        }
        if (!tooClose) {
          return pos;
        }
      }
    }

    return { x: 400, y: 300 }; // Fallback to center
  }

  // Player movement update (for AI players)
  public updatePlayer(playerId: string, movement: { dx: number; dy: number }, deltaTime: number): boolean {
    const player = this.getPlayer(playerId);
    if (!player) return false;

    const { dx, dy } = movement;

    // Server-side movement validation to prevent cheating
    const magnitude = Math.sqrt(dx * dx + dy * dy);
    const maxAllowedSpeed = 1.1; // Allow slight tolerance for floating point precision

    if (magnitude > maxAllowedSpeed) {
      // Log suspicious movement for monitoring
      console.warn(
        `Player ${player.name} (${playerId}) attempted invalid movement: magnitude ${magnitude.toFixed(3)}`
      );

      // Normalize the movement to maximum allowed speed
      const normalizedDx = magnitude > 0 ? dx / magnitude : 0;
      const normalizedDy = magnitude > 0 ? dy / magnitude : 0;

      this.applyMovementToPlayer(player, normalizedDx, normalizedDy, deltaTime);
    } else {
      // Movement is within valid range
      this.applyMovementToPlayer(player, dx, dy, deltaTime);
    }

    return true;
  }

  private applyMovementToPlayer(player: Player, dx: number, dy: number, deltaTime: number): void {
    // Check if player is stunned - if so, don't allow movement
    if (player.isStunned) {
      return;
    }

    // Store current velocity for prediction
    player.velocity = { dx, dy };

    // Adjust speed based on whether player is "it" (catcher gets speed boost)
    const currentSpeed = player.isIt ? player.speed * 1.3 : player.speed; // 30% speed boost for catcher
    const moveDistance = currentSpeed * (deltaTime / 1000);

    // Calculate new position
    let newX = player.x + dx * moveDistance;
    let newY = player.y + dy * moveDistance;

    // Keep player within bounds
    newX = Math.max(player.currentRadius, Math.min(this.gameWidth - player.currentRadius, newX));
    newY = Math.max(player.currentRadius, Math.min(this.gameHeight - player.currentRadius, newY));

    // Check for obstacle collisions
    const wouldCollide = this.checkObstacleCollision(newX, newY, player.currentRadius);

    if (!wouldCollide) {
      player.x = newX;
      player.y = newY;
    } else {
      // Try moving only in X direction
      if (!this.checkObstacleCollision(newX, player.y, player.currentRadius)) {
        player.x = newX;
      }
      // Try moving only in Y direction
      else if (!this.checkObstacleCollision(player.x, newY, player.currentRadius)) {
        player.y = newY;
      }
      // If both directions would cause collision, don't move
    }

    player.lastUpdate = Date.now();
  }

  // Game update loop
  public update(deltaTime: number): void {
    const now = Date.now();
    
    // Update all players
    this.players.forEach(player => {
      player.updatePowerUps(now);
      player.lastUpdate = now;
    });

    // Update power-ups
    this.updatePowerUps(now);
    
    // Update stars
    this.updateStars(now);
    
    // Update stun orbs
    this.updateStunOrbs(now);
  }

  private updatePowerUps(now: number): void {
    // Check for power-ups to respawn
    for (const powerUp of this.powerUps) {
      if (!powerUp.active) {
        const respawnTime = this.powerUpRespawnTimer.get(powerUp.id);
        if (respawnTime && now >= respawnTime) {
          powerUp.active = true;
          this.powerUpRespawnTimer.delete(powerUp.id);
        }
      }
    }
  }

  private updateStars(now: number): void {
    // Update star rotation animations
    for (const star of this.stars) {
      if (star.active) {
        star.rotationAngle += 0.02;
        if (star.rotationAngle > Math.PI * 2) {
          star.rotationAngle -= Math.PI * 2;
        }
      }
    }

    // Check for stars to respawn
    for (const star of this.stars) {
      if (!star.active) {
        const respawnTime = this.starRespawnTimer.get(star.id);
        if (respawnTime && now >= respawnTime) {
          const newPosition = this.findSafeStarPosition();
          if (newPosition) {
            star.x = newPosition.x;
            star.y = newPosition.y;
            star.active = true;
            star.spawnTime = now;
            star.rotationAngle = Math.random() * Math.PI * 2;
            this.starRespawnTimer.delete(star.id);
          }
        }
      }
    }
  }

  private updateStunOrbs(now: number): void {
    // Update electrical animation phase
    for (const stunOrb of this.stunOrbs) {
      if (stunOrb.active) {
        stunOrb.electricPhase += 0.15;
        if (stunOrb.electricPhase > Math.PI * 2) {
          stunOrb.electricPhase -= Math.PI * 2;
        }
      }
    }

    // Check for stun orbs to respawn
    for (const stunOrb of this.stunOrbs) {
      if (!stunOrb.active) {
        const respawnTime = this.stunOrbRespawnTimer.get(stunOrb.id);
        if (respawnTime && now >= respawnTime) {
          const newPosition = this.findSafeStunOrbPosition();
          if (newPosition) {
            stunOrb.x = newPosition.x;
            stunOrb.y = newPosition.y;
            stunOrb.active = true;
            stunOrb.spawnTime = now;
            stunOrb.electricPhase = Math.random() * Math.PI * 2;
            this.stunOrbRespawnTimer.delete(stunOrb.id);
          }
        }
      }
    }
  }

  private findSafeStarPosition(): Position | null {
    const starPositions = [
      { x: 200, y: 150 },
      { x: 600, y: 150 },
      { x: 200, y: 450 },
      { x: 600, y: 450 },
      { x: 400, y: 200 },
      { x: 150, y: 300 },
      { x: 650, y: 300 },
      { x: 300, y: 350 },
      { x: 500, y: 350 },
    ];

    const shuffled = [...starPositions].sort(() => Math.random() - 0.5);
    
    for (const pos of shuffled) {
      if (!this.checkObstacleCollision(pos.x, pos.y, 12)) {
        let tooClose = false;
        for (const player of this.players.values()) {
          const dx = pos.x - player.x;
          const dy = pos.y - player.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance < 50) {
            tooClose = true;
            break;
          }
        }
        if (!tooClose) {
          return pos;
        }
      }
    }

    return null;
  }

  private findSafeStunOrbPosition(): Position | null {
    const stunOrbPositions = [
      { x: 120, y: 200 },
      { x: 680, y: 200 },
      { x: 120, y: 400 },
      { x: 680, y: 400 },
      { x: 400, y: 120 },
      { x: 400, y: 480 },
      { x: 250, y: 300 },
      { x: 550, y: 300 },
    ];

    const shuffled = [...stunOrbPositions].sort(() => Math.random() - 0.5);
    
    for (const pos of shuffled) {
      if (!this.checkObstacleCollision(pos.x, pos.y, 15)) {
        let tooClose = false;
        for (const player of this.players.values()) {
          const dx = pos.x - player.x;
          const dy = pos.y - player.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance < 60) {
            tooClose = true;
            break;
          }
        }
        if (!tooClose) {
          return pos;
        }
      }
    }

    return null;
  }

  // Serialization for network transmission
  public toJSON(): GameStateData {
    return {
      players: Array.from(this.players.values()).map(p => p.toJSON()),
      gameActive: this.gameActive,
      timeRemaining: this.getTimeRemaining(),
      gameWidth: this.gameWidth,
      gameHeight: this.gameHeight,
      obstacles: this.obstacles,
      powerUps: this.powerUps.filter(p => p.active),
      stars: this.stars.filter(s => s.active),
      stunOrbs: this.stunOrbs.filter(s => s.active),
    };
  }
}