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
  hasSizeBoost: boolean;
  sizeBoostStacks: number;
  sizeBoostEndTime: number;
  lastUpdate: number;
  radius: number;
  currentRadius: number;
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

// Level system types
export interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SpawnPoint {
  x: number;
  y: number;
  type: 'safe' | 'risky' | 'strategic';
  visibility: 'open' | 'hidden' | 'elevated';
  nearbyFeatures: string[];
}

export interface BackgroundElement {
  x: number;
  y: number;
  width?: number;
  height?: number;
  radius?: number;
  type: 'decoration' | 'particle' | 'ambient';
  color?: string;
  opacity?: number;
}

export interface PowerUpConfiguration {
  spawnRate: number; // ms between spawns
  maxActive: number;
  types: PowerUpType[];
  locations: 'random' | 'fixed' | 'strategic';
}

export type PowerUpType = 'transparency' | 'speed' | 'stun' | 'size' | 'wallWalk' | 'echoLocate' | 'teleport' | 'superJump' | 'bridgeBuilder' | 'waterWalk' | 'conveyorControl' | 'platformLock' | 'industrialShield' | 'treeClimb' | 'camouflage' | 'naturesCall';

export type LevelTheme = 'classic' | 'maze' | 'islands' | 'factory' | 'forest';

export interface Level {
  id: string;
  name: string;
  theme: LevelTheme;
  boundaries: Rectangle;
  obstacles: Obstacle[];
  spawnPoints: SpawnPoint[];
  powerUpConfig: PowerUpConfiguration;
  backgroundElements: BackgroundElement[];
  difficulty: number;
  description: string;
}

export interface LevelTransition {
  fromLevel: string | null;
  toLevel: string;
  transitionType: 'fade' | 'slide' | 'zoom';
  duration: number;
  previewDuration: number;
}

export interface PowerUp {
  id: string;
  x: number;
  y: number;
  type: PowerUpType;
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
  currentLevel: Level;
  levelTransition?: LevelTransition;
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