import { PlayerState, Position, InputState } from '@shared/types';

export class Player {
  public readonly id: string;
  public readonly name: string;
  public x: number;
  public y: number;
  public readonly isAI: boolean;
  public isIt: boolean = false;
  public score: number = 0;
  public isStunned: boolean = false;
  public isTransparent: boolean = false;
  public readonly radius: number = 15;
  public readonly speed: number = 100;
  public readonly color: string;
  public readonly sightRange: number = 200; // Circular sight radius
  
  // IT player tracking
  public becameItTime?: number;
  public timeAsIt: number = 0;
  public lastPointDeduction: number = 0;
  public catchTimeout: number = 0;
  
  // Activity tracking
  public lastMovement: number;
  public lastUpdate: number;
  
  // Power-up states
  public transparencyEndTime: number = 0;
  public stunEndTime: number = 0;
  public isPerformingStunPulse: boolean = false;
  
  // Input tracking for server-authoritative system
  public currentInput: InputState | null = null;
  public velocity: { dx: number; dy: number } = { dx: 0, dy: 0 };
  
  private stunTimeout: NodeJS.Timeout | null = null;
  private transparencyTimeout: NodeJS.Timeout | null = null;

  constructor(id: string, name: string, x: number, y: number, isAI: boolean = false) {
    this.id = id;
    this.name = name;
    this.x = x;
    this.y = y;
    this.isAI = isAI;
    this.color = this.generatePlayerColor();
    this.lastMovement = Date.now();
    this.lastUpdate = Date.now();
  }

  private generatePlayerColor(): string {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57',
      '#FF9FF3', '#54A0FF', '#5F27CD', '#00D2D3', '#FF9F43',
      '#EE5A24', '#009432', '#0652DD', '#9980FA', '#833471'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  // IT status management
  public becomeIt(): void {
    this.isIt = true;
    this.becameItTime = Date.now();
    this.timeAsIt = 0;
    this.lastPointDeduction = Date.now();
    console.log(`${this.name} became IT`);
  }

  public stopBeingIt(): void {
    this.isIt = false;
    this.becameItTime = undefined;
    console.log(`${this.name} stopped being IT`);
  }

  // Stun mechanics
  public stun(duration: number): void {
    this.isStunned = true;
    this.stunEndTime = Date.now() + duration;
    
    if (this.stunTimeout) {
      clearTimeout(this.stunTimeout);
    }
    
    this.stunTimeout = setTimeout(() => {
      this.isStunned = false;
      this.stunEndTime = 0;
    }, duration);
    
    console.log(`${this.name} stunned for ${duration}ms`);
  }

  // Transparency power-up
  public activateTransparency(duration: number): void {
    if (this.isAI) return; // AI players don't get transparency
    
    this.isTransparent = true;
    this.transparencyEndTime = Date.now() + duration;
    
    if (this.transparencyTimeout) {
      clearTimeout(this.transparencyTimeout);
    }
    
    this.transparencyTimeout = setTimeout(() => {
      this.isTransparent = false;
      this.transparencyEndTime = 0;
    }, duration);
    
    console.log(`${this.name} became transparent for ${duration}ms`);
  }

  // Stun pulse for IT players
  public startStunPulse(): void {
    this.isPerformingStunPulse = true;
    setTimeout(() => {
      this.isPerformingStunPulse = false;
    }, 1000);
  }

  // Catch timeout (prevents immediate re-tagging)
  public setCatchTimeout(duration: number): void {
    this.catchTimeout = Date.now() + duration;
  }

  public canCatch(target: Player): boolean {
    if (!this.isIt || this.isStunned) return false;
    if (Date.now() < this.catchTimeout) return false;
    if (target.isTransparent) return false;
    
    // Check distance
    const dx = this.x - target.x;
    const dy = this.y - target.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    return distance < (this.radius + target.radius);
  }

  // Scoring system
  public awardTagPoints(): void {
    this.score += 100;
    console.log(`${this.name} awarded 100 points for successful tag (total: ${this.score})`);
  }

  public awardStarPoints(): number {
    const points = this.isIt ? 50 : 25;
    this.score += points;
    console.log(`${this.name} awarded ${points} points for star collection (total: ${this.score})`);
    return points;
  }

  public deductItPoints(points: number): void {
    this.score = Math.max(0, this.score - points);
    this.lastPointDeduction = Date.now();
    console.log(`${this.name} lost ${points} points for being IT (total: ${this.score})`);
  }

  // Power-up management
  public updatePowerUps(currentTime: number): void {
    // Update transparency
    if (this.isTransparent && currentTime >= this.transparencyEndTime) {
      this.isTransparent = false;
      this.transparencyEndTime = 0;
    }
    
    // Update stun
    if (this.isStunned && currentTime >= this.stunEndTime) {
      this.isStunned = false;
      this.stunEndTime = 0;
    }
  }

  // Position utilities
  public getPosition(): Position {
    return { x: this.x, y: this.y };
  }

  public distanceTo(other: Player): number {
    const dx = this.x - other.x;
    const dy = this.y - other.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // Serialization for network transmission
  public toJSON(): PlayerState {
    return {
      id: this.id,
      name: this.name,
      x: this.x,
      y: this.y,
      isIt: this.isIt,
      isAI: this.isAI,
      score: this.score,
      isStunned: this.isStunned,
      isTransparent: this.isTransparent,
      lastUpdate: this.lastUpdate,
      radius: this.radius,
      speed: this.speed,
      color: this.color,
      becameItTime: this.becameItTime,
      timeAsIt: this.timeAsIt,
      lastMovement: this.lastMovement,
      sightRange: this.sightRange
    };
  }

  // Cleanup
  public destroy(): void {
    if (this.stunTimeout) {
      clearTimeout(this.stunTimeout);
      this.stunTimeout = null;
    }
    if (this.transparencyTimeout) {
      clearTimeout(this.transparencyTimeout);
      this.transparencyTimeout = null;
    }
  }
}