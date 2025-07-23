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