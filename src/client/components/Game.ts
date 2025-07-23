import { GameStateData, PlayerState, InputState, Position } from '@shared/types';
import { NetworkManager } from '../network/NetworkManager';
import { Renderer } from './Renderer';
import { InputManager } from '../utils/InputManager';

interface PredictedPlayerState {
  x: number;
  y: number;
  lastUpdate: number;
}

interface CorrectionState {
  startTime: number;
  duration: number;
  startPos: Position;
  targetPos: Position;
  needsCorrection: boolean;
}

export class Game {
  private gameState: GameStateData | null = null;
  private myPlayerId: string | null = null;
  private gameActive = false;
  private lastUpdate = Date.now();
  
  // Client-side prediction state
  private localPlayerState: PlayerState | null = null;
  private predictedPlayerState: PredictedPlayerState | null = null;
  private lastServerUpdate = Date.now();
  
  // Correction system
  private correction: CorrectionState = {
    startTime: 0,
    duration: 50,
    startPos: { x: 0, y: 0 },
    targetPos: { x: 0, y: 0 },
    needsCorrection: false
  };
  
  // Adaptive correction thresholds
  private baseCorrectionThreshold = 15;
  private maxCorrectionThreshold = 50;
  private lastCorrectionTime = 0;
  private correctionCooldown = 500;
  private consecutiveCorrections = 0;
  private maxConsecutiveCorrections = 2;
  private correctionsDisabled = false;
  private correctionDisableTimeout = 0;

  // Game components
  private network: NetworkManager;
  private renderer: Renderer | null = null;
  private input: InputManager | null = null;

  constructor() {
    this.network = new NetworkManager();
    this.initializeUI();
    this.setupCanvas();
    this.initializeInput();
    this.gameLoop();
  }

  private initializeUI(): void {
    const joinButton = document.getElementById('joinButton') as HTMLButtonElement;
    const nameInput = document.getElementById('nameInput') as HTMLInputElement;

    if (!joinButton || !nameInput) {
      console.error('UI elements not found!');
      return;
    }

    // Focus the name input for better UX
    nameInput.focus();

    joinButton.addEventListener('click', () => {
      this.joinGame();
    });

    nameInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.joinGame();
      }
    });

    nameInput.addEventListener('input', () => {
      // Clear any error messages when typing
      const errorElement = document.getElementById('errorMessage');
      if (errorElement) {
        errorElement.textContent = '';
      }
    });
  }

  private setupCanvas(): void {
    const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
    if (!canvas) {
      console.error('Game canvas not found!');
      return;
    }

    this.renderer = new Renderer(canvas);
    (window as any).renderer = this.renderer; // Make globally available
  }

  private initializeInput(): void {
    this.input = new InputManager();
  }

  private joinGame(): void {
    const nameInput = document.getElementById('nameInput') as HTMLInputElement;
    const playerName = nameInput.value.trim();

    if (!playerName) {
      this.network.showError('Please enter your name');
      return;
    }

    if (playerName.length > 15) {
      this.network.showError('Name must be 15 characters or less');
      return;
    }

    const joinButton = document.getElementById('joinButton') as HTMLButtonElement;
    joinButton.disabled = true;
    joinButton.textContent = 'Joining...';

    this.network.joinGame(playerName);
  }

  public onGameJoined(data: { playerId: string; gameState: GameStateData }): void {
    this.myPlayerId = data.playerId;
    if (this.renderer) {
      this.renderer.setMyPlayerId(this.myPlayerId);
    }

    // Hide join form and show game
    const joinForm = document.getElementById('joinForm');
    const gameCanvas = document.getElementById('gameCanvas');
    
    if (joinForm) joinForm.classList.add('hidden');
    if (gameCanvas) gameCanvas.classList.add('visible');

    // Update UI
    const player = data.gameState.players.find((p) => p.id === this.myPlayerId);
    const playerNameText = document.getElementById('playerNameText');
    if (playerNameText) {
      playerNameText.textContent = player ? player.name : 'Unknown';
    }

    this.updateGameState(data.gameState);
    this.network.showMessage('Welcome to CatchMe!', 'info');
  }

  public updateGameState(gameState: GameStateData): void {
    this.gameState = gameState;
    this.lastServerUpdate = Date.now();

    // Handle server reconciliation for local player
    if (this.myPlayerId && gameState.players) {
      const serverPlayer = gameState.players.find(
        (p) => p.id === this.myPlayerId
      );
      if (serverPlayer) {
        this.localPlayerState = { ...serverPlayer };
        
        // Initialize or reconcile prediction
        if (!this.predictedPlayerState) {
          // First time - initialize prediction with server state
          this.predictedPlayerState = { 
            x: serverPlayer.x, 
            y: serverPlayer.y,
            lastUpdate: Date.now()
          };
        } else {
          // Check if we need correction with adaptive threshold and cooldown
          const now = Date.now();
          const timeSinceLastCorrection = now - this.lastCorrectionTime;
          
          // Check if corrections are temporarily disabled
          if (this.correctionsDisabled && now < this.correctionDisableTimeout) {
            // Skip correction check
          } else if (now >= this.correctionDisableTimeout) {
            this.correctionsDisabled = false;
            this.consecutiveCorrections = 0;
          }
          
          // Reset consecutive counter after enough time has passed
          if (timeSinceLastCorrection > 1000) {
            this.consecutiveCorrections = 0;
          }
          
          // Only check for corrections if not in cooldown and not disabled
          if (!this.correctionsDisabled && 
              timeSinceLastCorrection >= this.correctionCooldown && 
              this.consecutiveCorrections < this.maxConsecutiveCorrections) {
            
            const distanceError = Math.sqrt(
              Math.pow(this.predictedPlayerState.x - serverPlayer.x, 2) + 
              Math.pow(this.predictedPlayerState.y - serverPlayer.y, 2)
            );
            
            // Calculate adaptive correction threshold
            const timeSinceLastUpdate = now - this.lastServerUpdate;
            const adaptiveThreshold = this.calculateAdaptiveCorrectionThreshold(timeSinceLastUpdate);
            
            // Only start correction if error is significant
            if (distanceError > adaptiveThreshold && !this.correction.needsCorrection) {
              const timeSinceServerUpdate = now - this.lastServerUpdate;
              
              if (timeSinceServerUpdate < 100) { // Recent server update
                console.log(`Starting correction: error=${distanceError.toFixed(1)}px`);
                this.startCorrection(serverPlayer);
                this.lastCorrectionTime = now;
                this.consecutiveCorrections++;
              }
            }
          } else if (this.consecutiveCorrections >= this.maxConsecutiveCorrections && !this.correctionsDisabled) {
            // Hit consecutive limit, disable temporarily
            this.correctionsDisabled = true;
            this.correctionDisableTimeout = now + 3000;
            console.warn(`Too many consecutive corrections, disabling for 3 seconds`);
          }
        }
      }
    }

    // Create modified game state with predicted local player position
    const modifiedGameState = { ...gameState };
    if (this.predictedPlayerState && this.localPlayerState && this.myPlayerId) {
      const predictedPos = this.getCurrentPredictedPosition();
      if (predictedPos && !isNaN(predictedPos.x) && !isNaN(predictedPos.y)) {
        modifiedGameState.players = gameState.players.map(player => {
          if (player.id === this.myPlayerId) {
            return { 
              ...player, 
              x: predictedPos.x,
              y: predictedPos.y
            };
          }
          return player;
        });
      } else {
        modifiedGameState.players = gameState.players;
      }
    } else {
      modifiedGameState.players = gameState.players;
    }

    // Pass modified state to renderer
    if (this.renderer) {
      this.renderer.setGameState(modifiedGameState);
    }

    // Update UI elements
    this.updateUI(gameState);
    this.gameActive = gameState.gameActive;
  }

  private updateUI(gameState: GameStateData): void {
    const playerCountText = document.getElementById('playerCountText');
    if (playerCountText) {
      playerCountText.textContent = gameState.players.length.toString();
    }

    const timeRemainingText = document.getElementById('timeRemainingText');
    if (timeRemainingText && this.renderer) {
      timeRemainingText.textContent = gameState.gameActive 
        ? this.renderer.formatTime(gameState.timeRemaining) 
        : '-';
    }

    const myPlayer = gameState.players.find((p) => p.id === this.myPlayerId);
    if (myPlayer) {
      const gameStatusText = document.getElementById('gameStatusText');
      if (gameStatusText) {
        gameStatusText.textContent = gameState.gameActive
          ? myPlayer.isIt ? 'You are IT!' : 'Run!'
          : 'Waiting for players...';
      }

      const playerScoreText = document.getElementById('playerScoreText');
      if (playerScoreText) {
        playerScoreText.textContent = (myPlayer.score || 0).toString();
      }
    }

    // Update leaderboard
    this.updateLeaderboard(gameState.players);
  }

  private updateLeaderboard(players: PlayerState[]): void {
    const leaderboardDiv = document.getElementById('playerScores');
    if (!leaderboardDiv) return;

    // Sort players by score (descending)
    const sortedPlayers = [...players].sort(
      (a, b) => (b.score || 0) - (a.score || 0)
    );

    // Generate leaderboard HTML
    const leaderboardHTML = sortedPlayers
      .map((player, index) => {
        const isMyPlayer = player.id === this.myPlayerId;
        const isItPlayer = player.isIt;
        const classes = [];

        if (isMyPlayer) classes.push('my-score');
        if (isItPlayer) classes.push('it-player');

        const rank = index + 1;
        const rankEmoji =
          rank === 1 ? '🥇' :
          rank === 2 ? '🥈' :
          rank === 3 ? '🥉' :
          `${rank}.`;
        const itIndicator = isItPlayer ? ' 🎯' : '';

        return `
        <div class="score-entry ${classes.join(' ')}">
          <span>${rankEmoji} ${player.name}${itIndicator}</span>
          <span>${player.score || 0}</span>
        </div>
      `;
      })
      .join('');

    leaderboardDiv.innerHTML = leaderboardHTML;
  }

  // Event handlers
  public onScoreUpdate(data: any): void {
    this.showScoreChangeAnimation(data);

    if (data.reason === 'successful_tag') {
      this.network.showMessage(
        `+${data.change} points for tagging ${data.playerName}!`,
        'success'
      );
    } else if (data.reason === 'star_collection') {
      const points = data.change;
      const bonus = points === 50 ? ' (IT bonus!)' : '';
      if (data.playerId === this.myPlayerId) {
        this.network.showMessage(`⭐ +${points} points${bonus}`, 'star');
      }
    }
  }

  public onStarCollected(data: any): void {
    const bonus = data.pointsAwarded === 50 ? ' (IT bonus!)' : '';
    this.network.showMessage(
      `⭐ ${data.playerName} collected a star! +${data.pointsAwarded} points${bonus}`,
      'star'
    );
  }

  public onPowerUpCollected(data: any): void {
    const powerUpName = data.powerUpType === 'transparency' ? 'transparency' : data.powerUpType;
    this.network.showMessage(
      `⚡ ${data.playerName} collected ${powerUpName} power-up!`,
      'info'
    );
  }

  public onPlayerTagged(data: any): void {
    const message = `${data.tagged} was tagged by ${data.tagger}!`;
    this.network.showMessage(message, 'tagged');

    if (data.newIt === this.myPlayerId) {
      this.network.showMessage('You are now IT!', 'tagged');
    }
  }

  public onGameEnd(reason: string): void {
    this.gameActive = false;
    this.network.showMessage(`Game Over: ${reason}`, 'info');
    const gameStatusText = document.getElementById('gameStatusText');
    if (gameStatusText) {
      gameStatusText.textContent = 'Game Over';
    }
  }

  private showScoreChangeAnimation(data: any): void {
    if (data.playerId !== this.myPlayerId) return;

    const changeElement = document.createElement('div');
    changeElement.className = `score-change ${data.change > 0 ? 'positive' : 'negative'}`;
    changeElement.textContent = `${data.change > 0 ? '+' : ''}${data.change}`;

    const scoreElement = document.getElementById('playerScore');
    if (scoreElement) {
      const rect = scoreElement.getBoundingClientRect();
      changeElement.style.left = `${rect.right + 10}px`;
      changeElement.style.top = `${rect.top}px`;
      document.body.appendChild(changeElement);

      setTimeout(() => {
        if (changeElement.parentNode) {
          changeElement.parentNode.removeChild(changeElement);
        }
      }, 2000);
    }
  }

  // Client-side prediction helpers
  private startCorrection(serverPlayer: PlayerState): void {
    if (!this.predictedPlayerState) return;

    this.correction.needsCorrection = true;
    this.correction.startTime = Date.now();
    this.correction.startPos = { 
      x: this.predictedPlayerState.x, 
      y: this.predictedPlayerState.y 
    };
    this.correction.targetPos = { 
      x: serverPlayer.x, 
      y: serverPlayer.y 
    };
  }

  private getCurrentPredictedPosition(): Position | null {
    if (!this.predictedPlayerState) return null;
    
    // If we're in the middle of a correction, interpolate
    if (this.correction.needsCorrection) {
      const now = Date.now();
      const elapsed = now - this.correction.startTime;
      const progress = Math.min(1, elapsed / this.correction.duration);
      
      if (progress >= 1) {
        // Correction complete
        this.correction.needsCorrection = false;
        this.predictedPlayerState.x = this.correction.targetPos.x;
        this.predictedPlayerState.y = this.correction.targetPos.y;
        return { x: this.correction.targetPos.x, y: this.correction.targetPos.y };
      } else {
        // Smooth interpolation during correction
        const easedProgress = this.easeOutCubic(progress);
        const correctedX = this.correction.startPos.x + 
          (this.correction.targetPos.x - this.correction.startPos.x) * easedProgress;
        const correctedY = this.correction.startPos.y + 
          (this.correction.targetPos.y - this.correction.startPos.y) * easedProgress;
        return { x: correctedX, y: correctedY };
      }
    }
    
    return { x: this.predictedPlayerState.x, y: this.predictedPlayerState.y };
  }

  private easeOutCubic(t: number): number {
    return 1 - Math.pow(1 - t, 3);
  }

  private calculateAdaptiveCorrectionThreshold(timeSinceLastUpdate: number): number {
    let threshold = this.baseCorrectionThreshold;
    
    if (timeSinceLastUpdate > 50) {
      const delayFactor = Math.min(timeSinceLastUpdate / 50, 3);
      threshold *= delayFactor;
    }
    
    if (this.consecutiveCorrections > 0) {
      threshold *= (1 + this.consecutiveCorrections * 0.5);
    }
    
    return Math.min(threshold, this.maxCorrectionThreshold);
  }

  private gameLoop(): void {
    const now = Date.now();
    const deltaTime = now - this.lastUpdate;

    // Handle input with immediate client-side prediction
    if (this.gameActive && this.myPlayerId && this.input) {
      const inputState = this.input.update();
      
      // Send input to server
      if (inputState && this.network.isConnected()) {
        this.network.sendInputState(inputState);
      }
    }

    // Render the game
    if (this.renderer) {
      this.renderer.render();
    }

    this.lastUpdate = now;
    requestAnimationFrame(() => this.gameLoop());
  }
}