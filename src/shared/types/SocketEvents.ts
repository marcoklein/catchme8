import { GameStateData, InputState, PlayerState, Level, LevelTransition } from './GameTypes';

// Score update data
export interface ScoreUpdateData {
  playerId: string;
  playerName: string;
  score: number;
  change: number;
  reason: 'successful_tag' | 'star_collection' | 'being_it';
}

// Star collection data
export interface StarCollectedData {
  playerId: string;
  playerName: string;
  starId: string;
  pointsAwarded: number;
  newScore: number;
}

// Power-up collection data
export interface PowerUpCollectedData {
  playerId: string;
  playerName: string;
  powerUpType: string;
}

// Stun orb collection data
export interface StunOrbCollectedData {
  playerId: string;
  playerName: string;
  stunOrbId: string;
  onlyForIt: boolean;
  stunActivated: boolean;
  affectedPlayers: Array<{
    id: string;
    name: string;
    distance: number;
    stunDuration: number;
  }>;
  explosionCenter: { x: number; y: number };
}

// Explosion event data
export interface ExplosionData {
  itPlayerId: string;
  itPlayerName: string;
  explosionX: number;
  explosionY: number;
  explosionRadius: number;
  stunDuration: number;
  affectedPlayers: Array<{
    id: string;
    name: string;
    distance: number;
    stunDuration: number;
  }>;
}

// Player tagged event data
export interface PlayerTaggedData {
  tagger: string;
  tagged: string;
  newIt: string;
}

// Game join response data
export interface GameJoinedData {
  playerId: string;
  gameState: GameStateData;
}

// Level transition events
export interface LevelTransitionData {
  fromLevel: Level | null;
  toLevel: Level;
  transitionType: 'fade' | 'slide' | 'zoom';
  duration: number;
  previewDuration: number;
}

export interface LevelPreviewData {
  level: Level;
  timeRemaining: number;
  previewDuration: number;
}

export interface RoundEndData {
  winner?: PlayerState;
  reason: 'time_limit' | 'point_threshold' | 'admin_trigger';
  finalScores: { playerId: string; playerName: string; score: number }[];
  nextLevelPreview: Level;
}

// Server to Client Events
export interface ServerToClientEvents {
  gameJoined: (data: GameJoinedData) => void;
  gameState: (gameState: GameStateData) => void;
  playerTagged: (data: PlayerTaggedData) => void;
  scoreUpdate: (data: ScoreUpdateData) => void;
  starCollected: (data: StarCollectedData) => void;
  powerUpCollected: (data: PowerUpCollectedData) => void;
  stunOrbCollected: (data: StunOrbCollectedData) => void;
  stunOrbExplosion: (data: ExplosionData) => void;
  stunPulseActivated: (data: {
    itPlayerName: string;
    affectedPlayers: Array<{ id: string; name: string }>;
  }) => void;
  levelTransitionStart: (data: LevelTransitionData) => void;
  levelPreview: (data: LevelPreviewData) => void;
  roundEnd: (data: RoundEndData) => void;
  gameEnd: (reason: string) => void;
  joinError: (error: string) => void;
}

// Client to Server Events
export interface ClientToServerEvents {
  playerJoin: (playerName: string) => void;
  playerInput: (inputState: InputState) => void;
}

// Inter-server events (if needed for future scaling)
export interface InterServerEvents {
  // Reserved for future use
}

// Socket data attached to each connection
export interface SocketData {
  playerId?: string;
  playerName?: string;
  joinTime?: number;
}