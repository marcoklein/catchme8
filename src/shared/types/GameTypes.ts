// Core game geometry types
export interface Position {
  x: number;
  y: number;
}

export interface Velocity {
  dx: number;
  dy: number;
}

// Player state interface
export interface PlayerState {
  id: string;
  name: string;
  x: number;
  y: number;
  isIt: boolean;
  isAI: boolean;
  score: number;
  isStunned: boolean;
  isTransparent: boolean;
  lastUpdate: number;
  radius: number;
  speed: number;
  color: string;
  becameItTime?: number;
  timeAsIt?: number;
  lastMovement?: number;
  // Circular sight properties (like light radius)
  sightRange: number;        // Circular sight radius in pixels
}

// Game world objects
export interface Obstacle {
  x: number;
  y: number;
  width?: number;
  height?: number;
  radius?: number;
  type: 'rectangle' | 'circle';
}

export interface PowerUp {
  id: string;
  x: number;
  y: number;
  type: 'transparency' | 'speed' | 'stun';
  radius: number;
  active: boolean;
  duration: number;
  respawnTime: number;
}

export interface Star {
  id: string;
  x: number;
  y: number;
  type: 'star';
  radius: number;
  active: boolean;
  spawnTime: number;
  rotationAngle: number;
}

export interface StunOrb {
  id: string;
  x: number;
  y: number;
  type: 'stunOrb';
  radius: number;
  active: boolean;
  spawnTime: number;
  electricPhase: number;
}

// Complete game state
export interface GameStateData {
  players: PlayerState[];
  gameActive: boolean;
  timeRemaining: number;
  gameWidth: number;
  gameHeight: number;
  obstacles: Obstacle[];
  powerUps: PowerUp[];
  stars: Star[];
  stunOrbs: StunOrb[];
}

// Input state from clients
export interface InputState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  isTouchActive: boolean;
  touchX?: number;
  touchY?: number;
  timestamp?: number;
}

// Movement calculation result
export interface MovementResult {
  dx: number;
  dy: number;
  isValid: boolean;
}

// AI behavior types
export interface AIDecision {
  targetX: number;
  targetY: number;
  priority: 'chase' | 'flee' | 'collect' | 'wander';
  confidence: number;
}

export type AIBehaviorState = 'aggressive' | 'defensive' | 'opportunistic' | 'random';

// Visibility system types
export interface VisibilityResult {
  isVisible: boolean;
  distance?: number;
  angle?: number;
}

// Utility functions for circular sight calculations
export const SightUtils = {
  // Check if a point is within circular sight range
  isInSightRange: (
    viewerX: number, viewerY: number, viewerSightRange: number,
    targetX: number, targetY: number
  ): VisibilityResult => {
    const distance = Math.sqrt(Math.pow(targetX - viewerX, 2) + Math.pow(targetY - viewerY, 2));
    
    return {
      isVisible: distance <= viewerSightRange,
      distance
    };
  },
  
  // Calculate distance between two points
  getDistance: (x1: number, y1: number, x2: number, y2: number): number => {
    return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
  }
};