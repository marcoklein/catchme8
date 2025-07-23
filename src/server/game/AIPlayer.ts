import { Player } from './Player';
import { GameStateData, AIBehaviorState, AIDecision } from '@shared/types';

interface PersonalityTraits {
  aggressiveness: number;  // 0-1, affects chasing behavior
  fearfulness: number;     // 0-1, affects fleeing behavior  
  curiosity: number;       // 0-1, affects power-up seeking
  intelligence: number;    // 0-1, affects pathfinding quality
}

export class AIPlayer extends Player {
  public lastDecisionTime: number = Date.now();
  public readonly decisionInterval: number = 100; // Make decisions every 100ms
  public targetPosition: { x: number; y: number } | null = null;
  public currentBehavior: AIBehaviorState = 'random';
  public personalityTraits: PersonalityTraits;
  public lastAIMovement: { dx: number; dy: number } = { dx: 0, dy: 0 };
  public stuckCounter: number = 0;
  public lastPosition: { x: number; y: number };

  constructor(id: string, name: string, x: number = 400, y: number = 300) {
    super(id, name, x, y, true); // true for isAI
    this.lastPosition = { x: this.x, y: this.y };
    this.personalityTraits = this.generatePersonality();
  }

  private generatePersonality(): PersonalityTraits {
    return {
      aggressiveness: Math.random(),
      fearfulness: Math.random(),
      curiosity: Math.random(),
      intelligence: Math.random()
    };
  }

  // Make decision based on current game state
  public makeDecision(gameState: GameStateData): { dx: number; dy: number } {
    const now = Date.now();
    if (now - this.lastDecisionTime < this.decisionInterval) {
      return this.lastAIMovement;
    }

    this.lastDecisionTime = now;

    // Check if stuck (not moved much in last few updates)
    const distanceMoved = Math.sqrt(
      Math.pow(this.x - this.lastPosition.x, 2) + 
      Math.pow(this.y - this.lastPosition.y, 2)
    );

    if (distanceMoved < 2) {
      this.stuckCounter++;
    } else {
      this.stuckCounter = 0;
    }

    this.lastPosition = { x: this.x, y: this.y };

    // Get AI decision
    const decision = this.decideAction(gameState);
    
    // Calculate movement towards target
    const movement = this.calculateMovement(decision);
    
    this.lastAIMovement = movement;
    return movement;
  }

  private decideAction(gameState: GameStateData): AIDecision {
    if (this.isIt) {
      return this.chaseDecision(gameState);
    } else {
      return this.fleeOrWanderDecision(gameState);
    }
  }

  private chaseDecision(gameState: GameStateData): AIDecision {
    // Find nearest non-AI player to chase
    const humanPlayers = gameState.players.filter(p => !p.isAI && p.id !== this.id);
    
    if (humanPlayers.length === 0) {
      return this.wanderDecision();
    }

    // Find closest human player
    let closestPlayer = humanPlayers[0];
    let closestDistance = this.distanceToPlayer(closestPlayer);

    for (const player of humanPlayers) {
      const distance = this.distanceToPlayer(player);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestPlayer = player;
      }
    }

    return {
      targetX: closestPlayer.x,
      targetY: closestPlayer.y,
      priority: 'chase',
      confidence: Math.min(1, this.personalityTraits.aggressiveness + 0.3)
    };
  }

  private fleeOrWanderDecision(gameState: GameStateData): AIDecision {
    // Find IT player
    const itPlayer = gameState.players.find(p => p.isIt);
    
    if (!itPlayer) {
      return this.wanderDecision();
    }

    const distanceToIt = this.distanceToPlayer(itPlayer);
    const fleeThreshold = 150; // Start fleeing if IT is within 150 pixels

    if (distanceToIt < fleeThreshold) {
      // Flee: move away from IT player
      const fleeX = this.x + (this.x - itPlayer.x);
      const fleeY = this.y + (this.y - itPlayer.y);

      return {
        targetX: Math.max(50, Math.min(gameState.gameWidth - 50, fleeX)),
        targetY: Math.max(50, Math.min(gameState.gameHeight - 50, fleeY)),
        priority: 'flee',
        confidence: this.personalityTraits.fearfulness
      };
    } else {
      // Collect power-ups or wander
      const nearbyPowerUp = this.findNearbyPowerUp(gameState);
      if (nearbyPowerUp && this.personalityTraits.curiosity > 0.5) {
        return {
          targetX: nearbyPowerUp.x,
          targetY: nearbyPowerUp.y,
          priority: 'collect',
          confidence: this.personalityTraits.curiosity
        };
      }

      return this.wanderDecision();
    }
  }

  private wanderDecision(): AIDecision {
    // Random wandering with some intelligence to avoid edges
    const margin = 100;
    const targetX = margin + Math.random() * (800 - 2 * margin); // Assuming 800px width
    const targetY = margin + Math.random() * (600 - 2 * margin); // Assuming 600px height

    return {
      targetX,
      targetY,
      priority: 'wander',
      confidence: 0.3
    };
  }

  private findNearbyPowerUp(gameState: GameStateData) {
    const nearbyDistance = 200;
    
    for (const powerUp of gameState.powerUps) {
      if (!powerUp.active) continue;
      
      const distance = Math.sqrt(
        Math.pow(powerUp.x - this.x, 2) + 
        Math.pow(powerUp.y - this.y, 2)
      );
      
      if (distance < nearbyDistance) {
        return powerUp;
      }
    }

    for (const star of gameState.stars) {
      if (!star.active) continue;
      
      const distance = Math.sqrt(
        Math.pow(star.x - this.x, 2) + 
        Math.pow(star.y - this.y, 2)
      );
      
      if (distance < nearbyDistance) {
        return star;
      }
    }

    return null;
  }

  private distanceToPlayer(player: { x: number; y: number }): number {
    return Math.sqrt(
      Math.pow(player.x - this.x, 2) + 
      Math.pow(player.y - this.y, 2)
    );
  }

  private calculateMovement(decision: AIDecision): { dx: number; dy: number } {
    const speed = this.speed / 60; // Convert to per-frame movement (assuming 60 FPS)
    
    // Calculate direction to target
    const dx = decision.targetX - this.x;
    const dy = decision.targetY - this.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < 5) {
      // Very close to target, minimal movement
      return { dx: 0, dy: 0 };
    }

    // Normalize and apply speed
    const normalizedDx = (dx / distance) * speed;
    const normalizedDy = (dy / distance) * speed;

    // Add some randomness based on intelligence (lower intelligence = more random)
    const randomFactor = (1 - this.personalityTraits.intelligence) * 0.3;
    const randomDx = (Math.random() - 0.5) * randomFactor * speed;
    const randomDy = (Math.random() - 0.5) * randomFactor * speed;

    // Handle stuck situation
    if (this.stuckCounter > 10) {
      // Add more randomness when stuck
      const stuckRandomDx = (Math.random() - 0.5) * speed * 2;
      const stuckRandomDy = (Math.random() - 0.5) * speed * 2;
      this.stuckCounter = 0;
      return { dx: stuckRandomDx, dy: stuckRandomDy };
    }

    return {
      dx: normalizedDx + randomDx,
      dy: normalizedDy + randomDy
    };
  }

  // Override toJSON to include AI-specific properties
  public toJSON() {
    const playerData = super.toJSON();
    return {
      ...playerData,
      currentBehavior: this.currentBehavior
    };
  }
}