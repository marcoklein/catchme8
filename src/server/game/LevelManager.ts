import { Level, LevelTheme, SpawnPoint, Obstacle, PowerUpConfiguration, BackgroundElement, Rectangle, PowerUpType } from '@shared/types/GameTypes';

export type LevelRotationType = 'sequential' | 'random' | 'voting';

export interface LevelManagerConfig {
  rotation: LevelRotationType;
  roundDuration: number; // ms
  transitionDuration: number; // ms
  previewDuration: number; // ms
}

export class LevelManager {
  private availableLevels: Level[] = [];
  private currentLevelIndex: number = 0;
  private config: LevelManagerConfig;
  private levelHistory: string[] = [];
  private readonly maxHistorySize = 3;

  constructor(config: LevelManagerConfig) {
    this.config = config;
    this.initializeLevels();
  }

  public getCurrentLevel(): Level {
    return this.availableLevels[this.currentLevelIndex] || this.getDefaultLevel();
  }

  public getNextLevel(): Level {
    switch (this.config.rotation) {
      case 'sequential':
        return this.getSequentialNext();
      case 'random':
        return this.getRandomNext();
      case 'voting':
        // For now, fallback to random until voting is implemented
        return this.getRandomNext();
      default:
        return this.getSequentialNext();
    }
  }

  public advanceToNextLevel(): Level {
    const nextLevel = this.getNextLevel();
    const currentLevel = this.getCurrentLevel();
    
    // Add current level to history
    if (currentLevel) {
      this.addToHistory(currentLevel.id);
    }
    
    // Find and set the next level index
    const nextIndex = this.availableLevels.findIndex(level => level.id === nextLevel.id);
    if (nextIndex !== -1) {
      this.currentLevelIndex = nextIndex;
    }
    
    return nextLevel;
  }

  public getLevelById(id: string): Level | null {
    return this.availableLevels.find(level => level.id === id) || null;
  }

  public getAvailableLevels(): Level[] {
    return [...this.availableLevels];
  }

  public getLevelPreviewOptions(count: number = 3): Level[] {
    const available = this.availableLevels.filter(level => 
      !this.levelHistory.includes(level.id) && level.id !== this.getCurrentLevel().id
    );
    
    // If we don't have enough unique levels, include some from history
    if (available.length < count) {
      const fromHistory = this.availableLevels.filter(level => 
        this.levelHistory.includes(level.id) && level.id !== this.getCurrentLevel().id
      );
      available.push(...fromHistory.slice(0, count - available.length));
    }
    
    // Shuffle and return requested count
    return this.shuffleArray(available).slice(0, count);
  }

  private getSequentialNext(): Level {
    const nextIndex = (this.currentLevelIndex + 1) % this.availableLevels.length;
    return this.availableLevels[nextIndex];
  }

  private getRandomNext(): Level {
    // Filter out recently played levels
    const available = this.availableLevels.filter(level => 
      !this.levelHistory.includes(level.id) && level.id !== this.getCurrentLevel().id
    );
    
    if (available.length === 0) {
      // If all levels are in history, clear it and try again
      this.levelHistory = [];
      return this.availableLevels[Math.floor(Math.random() * this.availableLevels.length)];
    }
    
    return available[Math.floor(Math.random() * available.length)];
  }

  private addToHistory(levelId: string): void {
    this.levelHistory.push(levelId);
    if (this.levelHistory.length > this.maxHistorySize) {
      this.levelHistory.shift();
    }
  }

  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  private initializeLevels(): void {
    this.availableLevels = [
      this.createClassicArenaLevel(),
      this.createMazeRunnerLevel(),
      this.createIslandHopperLevel(),
    ];
  }

  private createClassicArenaLevel(): Level {
    const gameWidth = 800;
    const gameHeight = 600;
    
    return {
      id: 'classic_arena',
      name: 'Classic Arena',
      theme: 'classic',
      description: 'The original arena with open spaces and balanced gameplay',
      boundaries: { x: 0, y: 0, width: gameWidth, height: gameHeight },
      obstacles: [],
      spawnPoints: this.generateClassicSpawnPoints(gameWidth, gameHeight),
      powerUpConfig: {
        spawnRate: 8000,
        maxActive: 3,
        types: ['transparency', 'speed', 'stun', 'size'],
        locations: 'random'
      },
      backgroundElements: [],
      difficulty: 1
    };
  }

  private createMazeRunnerLevel(): Level {
    const gameWidth = 800;
    const gameHeight = 600;
    
    return {
      id: 'maze_runner',
      name: 'Maze Runner',
      theme: 'maze',
      description: 'Navigate through complex maze corridors with strategic hiding spots',
      boundaries: { x: 0, y: 0, width: gameWidth, height: gameHeight },
      obstacles: this.generateMazeObstacles(gameWidth, gameHeight),
      spawnPoints: this.generateMazeSpawnPoints(gameWidth, gameHeight),
      powerUpConfig: {
        spawnRate: 10000,
        maxActive: 4,
        types: ['transparency', 'wallWalk', 'echoLocate', 'teleport'],
        locations: 'strategic'
      },
      backgroundElements: this.generateMazeBackground(),
      difficulty: 3
    };
  }

  private createIslandHopperLevel(): Level {
    const gameWidth = 800;
    const gameHeight = 600;
    
    return {
      id: 'island_hopper',
      name: 'Island Hopper',
      theme: 'islands',
      description: 'Jump between floating islands connected by bridges',
      boundaries: { x: 0, y: 0, width: gameWidth, height: gameHeight },
      obstacles: this.generateIslandObstacles(gameWidth, gameHeight),
      spawnPoints: this.generateIslandSpawnPoints(gameWidth, gameHeight),
      powerUpConfig: {
        spawnRate: 7000,
        maxActive: 5,
        types: ['superJump', 'bridgeBuilder', 'waterWalk', 'transparency'],
        locations: 'fixed'
      },
      backgroundElements: this.generateIslandBackground(),
      difficulty: 2
    };
  }

  private generateClassicSpawnPoints(width: number, height: number): SpawnPoint[] {
    const margin = 50;
    const points: SpawnPoint[] = [];
    
    // Corners
    points.push(
      { x: margin, y: margin, type: 'safe', visibility: 'open', nearbyFeatures: ['corner'] },
      { x: width - margin, y: margin, type: 'safe', visibility: 'open', nearbyFeatures: ['corner'] },
      { x: margin, y: height - margin, type: 'safe', visibility: 'open', nearbyFeatures: ['corner'] },
      { x: width - margin, y: height - margin, type: 'safe', visibility: 'open', nearbyFeatures: ['corner'] }
    );
    
    // Sides
    points.push(
      { x: width / 2, y: margin, type: 'safe', visibility: 'open', nearbyFeatures: ['wall'] },
      { x: width / 2, y: height - margin, type: 'safe', visibility: 'open', nearbyFeatures: ['wall'] },
      { x: margin, y: height / 2, type: 'safe', visibility: 'open', nearbyFeatures: ['wall'] },
      { x: width - margin, y: height / 2, type: 'safe', visibility: 'open', nearbyFeatures: ['wall'] }
    );
    
    return points;
  }

  private generateMazeObstacles(width: number, height: number): Obstacle[] {
    const obstacles: Obstacle[] = [];
    const wallThickness = 20;
    const cellSize = 80;
    
    // Create a simple maze pattern
    for (let x = cellSize; x < width - cellSize; x += cellSize * 2) {
      for (let y = cellSize; y < height - cellSize; y += cellSize) {
        if (Math.random() > 0.3) {
          obstacles.push({
            x: x,
            y: y,
            width: wallThickness,
            height: cellSize,
            type: 'rectangle'
          });
        }
      }
    }
    
    for (let y = cellSize; y < height - cellSize; y += cellSize * 2) {
      for (let x = cellSize; x < width - cellSize; x += cellSize) {
        if (Math.random() > 0.3) {
          obstacles.push({
            x: x,
            y: y,
            width: cellSize,
            height: wallThickness,
            type: 'rectangle'
          });
        }
      }
    }
    
    return obstacles;
  }

  private generateMazeSpawnPoints(width: number, height: number): SpawnPoint[] {
    const points: SpawnPoint[] = [];
    const cellSize = 80;
    
    // Spawn points in maze corridors
    for (let x = cellSize / 2; x < width; x += cellSize) {
      for (let y = cellSize / 2; y < height; y += cellSize) {
        if (Math.random() > 0.7) {
          points.push({
            x: x,
            y: y,
            type: 'strategic',
            visibility: 'hidden',
            nearbyFeatures: ['maze_corridor']
          });
        }
      }
    }
    
    // Ensure we have at least 8 spawn points
    while (points.length < 8) {
      points.push({
        x: Math.random() * (width - 100) + 50,
        y: Math.random() * (height - 100) + 50,
        type: 'safe',
        visibility: 'open',
        nearbyFeatures: ['maze_opening']
      });
    }
    
    return points;
  }

  private generateIslandObstacles(width: number, height: number): Obstacle[] {
    const obstacles: Obstacle[] = [];
    const numIslands = 6;
    
    for (let i = 0; i < numIslands; i++) {
      const x = (width / (numIslands / 2)) * (i % 3) + 100;
      const y = (height / 3) * Math.floor(i / 3) + 150;
      const radius = 60 + Math.random() * 40;
      
      obstacles.push({
        x: x,
        y: y,
        radius: radius,
        type: 'circle'
      });
    }
    
    return obstacles;
  }

  private generateIslandSpawnPoints(width: number, height: number): SpawnPoint[] {
    const points: SpawnPoint[] = [];
    const islands = this.generateIslandObstacles(width, height);
    
    // One spawn point per island
    islands.forEach((island, index) => {
      if (island.radius) {
        points.push({
          x: island.x,
          y: island.y,
          type: index === 0 ? 'strategic' : 'safe',
          visibility: 'elevated',
          nearbyFeatures: ['island', 'water']
        });
      }
    });
    
    return points;
  }

  private generateMazeBackground(): BackgroundElement[] {
    return [
      {
        x: 0,
        y: 0,
        type: 'ambient',
        color: '#2a2a2a',
        opacity: 0.1
      }
    ];
  }

  private generateIslandBackground(): BackgroundElement[] {
    const elements: BackgroundElement[] = [];
    
    // Water background
    elements.push({
      x: 0,
      y: 0,
      type: 'ambient',
      color: '#4a90e2',
      opacity: 0.3
    });
    
    // Floating particles
    for (let i = 0; i < 20; i++) {
      elements.push({
        x: Math.random() * 800,
        y: Math.random() * 600,
        radius: 2 + Math.random() * 3,
        type: 'particle',
        color: '#ffffff',
        opacity: 0.6
      });
    }
    
    return elements;
  }

  private getDefaultLevel(): Level {
    return this.createClassicArenaLevel();
  }
}