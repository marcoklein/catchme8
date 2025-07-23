import { io, Socket } from 'socket.io-client';
import { ServerToClientEvents, ClientToServerEvents, InputState, GameStateData, ExplosionData } from '@shared/types';

export type MessageType = 'info' | 'error' | 'warning' | 'danger' | 'success' | 'star' | 'explosion' | 'tagged';

export class NetworkManager {
  private socket: Socket<ServerToClientEvents, ClientToServerEvents>;
  private playerId: string | null = null;
  private connected = false;

  constructor() {
    this.socket = io();
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.socket.on('connect', () => {
      this.connected = true;
      console.log('Connected to server');
    });

    this.socket.on('disconnect', () => {
      this.connected = false;
      console.log('Disconnected from server');
      this.showMessage('Disconnected from server', 'error');
    });

    this.socket.on('gameJoined', (data) => {
      this.playerId = data.playerId;
      const game = (window as any).game;
      if (game) {
        game.onGameJoined(data);
      }
    });

    this.socket.on('gameState', (gameState: GameStateData) => {
      const game = (window as any).game;
      if (game) {
        game.updateGameState(gameState);
      }
    });

    this.socket.on('playerTagged', (data) => {
      const game = (window as any).game;
      if (game) {
        game.onPlayerTagged(data);
      }
    });

    this.socket.on('scoreUpdate', (data) => {
      const game = (window as any).game;
      if (game) {
        game.onScoreUpdate(data);
      }
    });

    this.socket.on('starCollected', (data) => {
      const game = (window as any).game;
      if (game) {
        game.onStarCollected(data);
      }
    });

    this.socket.on('powerUpCollected', (data) => {
      const game = (window as any).game;
      if (game) {
        game.onPowerUpCollected(data);
      }
    });

    this.socket.on('stunOrbCollected', (data) => {
      if (data.onlyForIt) {
        this.showMessage(
          `${data.playerName} collected stun orb (IT only!)`,
          'warning'
        );
      } else if (data.stunActivated) {
        this.showMessage(
          `💥 ${data.playerName} triggered stun orb explosion!`,
          'danger'
        );
      } else {
        this.showMessage(`${data.playerName} collected stun orb!`, 'info');
      }
    });

    this.socket.on('stunOrbExplosion', (data: ExplosionData) => {
      console.log('RECEIVED stunOrbExplosion event:', data);
      
      // Trigger visual explosion effect at the specified location
      const rendererInstance = (window as any).renderer;
      if (rendererInstance) {
        console.log('Calling triggerExplosionEffect on renderer');
        rendererInstance.triggerExplosionEffect(
          data.explosionX,
          data.explosionY,
          data.explosionRadius
        );
      } else {
        console.error('No renderer available!');
      }
      
      // Show detailed message about affected players
      if (data.affectedPlayers.length > 0) {
        const playerNames = data.affectedPlayers.map(p => p.name).join(', ');
        this.showMessage(
          `⚡ Explosion stunned: ${playerNames}`,
          'explosion'
        );
      }
    });

    this.socket.on('stunPulseActivated', (data) => {
      this.showMessage(`${data.itPlayerName} activated stun pulse!`, 'danger');

      // Show visual feedback for affected players
      data.affectedPlayers.forEach((affectedPlayer) => {
        if (affectedPlayer.id === this.socket.id) {
          this.showMessage('You were stunned!', 'warning');
        }
      });
    });

    this.socket.on('gameEnd', (reason) => {
      const game = (window as any).game;
      if (game) {
        game.onGameEnd(reason);
      }
    });

    this.socket.on('joinError', (error) => {
      this.showError(error);
    });
  }

  public joinGame(playerName: string): void {
    if (this.connected) {
      this.socket.emit('playerJoin', playerName);
    } else {
      this.showError('Not connected to server');
    }
  }

  public sendInputState(inputState: InputState): void {
    if (this.connected && this.playerId) {
      this.socket.emit('playerInput', inputState);
    }
  }

  public showMessage(text: string, type: MessageType = 'info'): void {
    const messagesContainer = document.getElementById('gameMessages');
    if (!messagesContainer) return;

    const message = document.createElement('div');
    message.className = `message ${type}`;
    message.textContent = text;
    messagesContainer.appendChild(message);

    // Remove message after 3 seconds
    setTimeout(() => {
      if (message.parentNode) {
        message.parentNode.removeChild(message);
      }
    }, 3000);
  }

  public showError(text: string): void {
    const errorElement = document.getElementById('errorMessage');
    if (errorElement) {
      errorElement.textContent = text;
      setTimeout(() => {
        errorElement.textContent = '';
      }, 3000);
    }
  }

  public isConnected(): boolean {
    return this.connected;
  }

  public getPlayerId(): string | null {
    return this.playerId;
  }
}