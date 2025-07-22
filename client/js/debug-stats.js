class DebugStats {
  constructor(game, renderer, network, input) {
    this.game = game;
    this.renderer = renderer;
    this.network = network;
    this.input = input;
    
    this.isVisible = false;
    this.isEnabled = false;
    this.updateInterval = 100; // Update every 100ms
    this.updateTimer = null;
    
    // Performance tracking
    this.frameCount = 0;
    this.lastFrameTime = performance.now();
    this.frameTimes = [];
    this.renderTimes = [];
    this.fpsHistory = [];
    
    // Network tracking
    this.networkStats = {
      ping: 0,
      updateRate: 0,
      jitter: 0,
      lastUpdateTime: 0,
      updateTimes: [],
      connectionStatus: 'disconnected'
    };
    
    // Input tracking
    this.inputStats = {
      rate: 0,
      inputCount: 0,
      lastInputTime: 0,
      validationRate: 100,
      currentInput: 'None'
    };
    
    // Server tracking
    this.serverStats = {
      performance: 'Good',
      eventsPerSecond: 0,
      physicsUpdates: 30
    };
    
    this.initializeUI();
    this.setupEventListeners();
    this.checkAutoEnable();
  }
  
  initializeUI() {
    this.panel = document.getElementById('debugPanel');
    this.toggleButton = document.getElementById('debugToggle');
    this.hint = document.getElementById('debugHint');
    this.header = document.getElementById('debugHeader');
    
    // DOM element cache for performance
    this.elements = {
      // Performance
      fps: document.getElementById('fps-value'),
      frameTime: document.getElementById('frame-time-value'),
      renderTime: document.getElementById('render-time-value'),
      memory: document.getElementById('memory-value'),
      
      // Network
      connectionStatus: document.getElementById('connection-status'),
      connectionIndicator: document.getElementById('connection-indicator'),
      ping: document.getElementById('ping-value'),
      updateRate: document.getElementById('update-rate-value'),
      interpolation: document.getElementById('interpolation-value'),
      jitter: document.getElementById('jitter-value'),
      
      // Player
      position: document.getElementById('position-value'),
      velocity: document.getElementById('velocity-value'),
      playerStatus: document.getElementById('player-status-value'),
      playerScore: document.getElementById('player-score-value'),
      isIt: document.getElementById('is-it-value'),
      
      // Game State
      totalPlayers: document.getElementById('total-players-value'),
      aiPlayers: document.getElementById('ai-players-value'),
      gameActive: document.getElementById('game-active-value'),
      timeLeft: document.getElementById('time-left-value'),
      powerups: document.getElementById('powerups-value'),
      stars: document.getElementById('stars-value'),
      
      // Input
      inputRate: document.getElementById('input-rate-value'),
      currentInput: document.getElementById('current-input-value'),
      touchActive: document.getElementById('touch-active-value'),
      validationRate: document.getElementById('validation-rate-value'),
      
      // Server
      serverPerformance: document.getElementById('server-performance-value'),
      eventsPerSec: document.getElementById('events-per-sec-value'),
      physicsUpdates: document.getElementById('physics-updates-value')
    };
  }
  
  setupEventListeners() {
    // Toggle button
    this.toggleButton.addEventListener('click', () => {
      this.toggle();
    });
    
    // Header click to minimize/maximize
    this.header.addEventListener('click', (e) => {
      if (e.target !== this.toggleButton) {
        this.toggleMinimize();
      }
    });
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // F3 to toggle debug panel
      if (e.key === 'F3') {
        e.preventDefault();
        this.toggle();
      }
      // Ctrl+Shift+D to toggle debug panel
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        this.toggle();
      }
    });
    
    // Section collapse/expand
    document.querySelectorAll('.debug-section-title').forEach(title => {
      title.addEventListener('click', () => {
        const section = title.closest('.debug-section');
        section.classList.toggle('collapsed');
      });
    });
    
    // Network event listeners
    if (this.network && this.network.socket) {
      this.setupNetworkTracking();
    }
  }
  
  setupNetworkTracking() {
    const socket = this.network.socket;
    
    // Track connection status
    socket.on('connect', () => {
      this.networkStats.connectionStatus = 'connected';
    });
    
    socket.on('disconnect', () => {
      this.networkStats.connectionStatus = 'disconnected';
    });
    
    socket.on('connecting', () => {
      this.networkStats.connectionStatus = 'connecting';
    });
    
    // Track ping
    this.startPingTest();
    
    // Track game state updates for update rate
    const originalUpdateGameState = this.game.updateGameState.bind(this.game);
    this.game.updateGameState = (gameState) => {
      this.trackGameStateUpdate();
      return originalUpdateGameState(gameState);
    };
  }
  
  startPingTest() {
    if (!this.network || !this.network.socket) return;
    
    const pingTest = () => {
      if (!this.isEnabled) return;
      
      const start = performance.now();
      this.network.socket.emit('ping', start);
      
      const pongHandler = (timestamp) => {
        const ping = performance.now() - timestamp;
        this.networkStats.ping = Math.round(ping);
        this.network.socket.off('pong', pongHandler);
      };
      
      this.network.socket.on('pong', pongHandler);
      
      setTimeout(pingTest, 1000); // Test every second
    };
    
    // Add ping/pong handlers to server if they don't exist
    setTimeout(pingTest, 1000);
  }
  
  trackGameStateUpdate() {
    const now = performance.now();
    
    if (this.networkStats.lastUpdateTime > 0) {
      const interval = now - this.networkStats.lastUpdateTime;
      this.networkStats.updateTimes.push(interval);
      
      // Keep only last 10 intervals
      if (this.networkStats.updateTimes.length > 10) {
        this.networkStats.updateTimes.shift();
      }
      
      // Calculate update rate
      const avgInterval = this.networkStats.updateTimes.reduce((a, b) => a + b, 0) / this.networkStats.updateTimes.length;
      this.networkStats.updateRate = Math.round(1000 / avgInterval * 10) / 10;
      
      // Calculate jitter
      const variance = this.networkStats.updateTimes.reduce((sum, time) => {
        return sum + Math.pow(time - avgInterval, 2);
      }, 0) / this.networkStats.updateTimes.length;
      this.networkStats.jitter = Math.round(Math.sqrt(variance));
    }
    
    this.networkStats.lastUpdateTime = now;
  }
  
  checkAutoEnable() {
    // Check URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('debug') === '1') {
      this.enable();
    }
    
    // Check localStorage
    if (localStorage.getItem('debug-stats-enabled') === 'true') {
      this.enable();
    }
    
    // Show hint if debug is available
    if (!this.isVisible) {
      setTimeout(() => {
        this.showHint();
      }, 3000);
    }
  }
  
  showHint() {
    this.hint.classList.remove('hidden');
    setTimeout(() => {
      this.hint.classList.add('hidden');
    }, 5000);
  }
  
  enable() {
    this.isEnabled = true;
    this.show();
    this.startTracking();
    localStorage.setItem('debug-stats-enabled', 'true');
  }
  
  disable() {
    this.isEnabled = false;
    this.hide();
    this.stopTracking();
    localStorage.setItem('debug-stats-enabled', 'false');
  }
  
  toggle() {
    if (this.isEnabled) {
      this.disable();
    } else {
      this.enable();
    }
  }
  
  show() {
    this.isVisible = true;
    this.panel.classList.remove('hidden');
  }
  
  hide() {
    this.isVisible = false;
    this.panel.classList.add('hidden');
  }
  
  toggleMinimize() {
    this.panel.classList.toggle('minimized');
  }
  
  startTracking() {
    if (this.updateTimer) return;
    
    this.updateTimer = setInterval(() => {
      this.collectMetrics();
      this.updateUI();
    }, this.updateInterval);
    
    // Start frame tracking
    this.trackFrame();
  }
  
  stopTracking() {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }
  }
  
  trackFrame() {
    if (!this.isEnabled) return;
    
    const now = performance.now();
    const frameTime = now - this.lastFrameTime;
    
    this.frameTimes.push(frameTime);
    this.frameCount++;
    
    // Keep only last 60 frames
    if (this.frameTimes.length > 60) {
      this.frameTimes.shift();
    }
    
    // Calculate FPS every second
    if (this.frameCount % 60 === 0) {
      const avgFrameTime = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
      const fps = Math.round(1000 / avgFrameTime);
      this.fpsHistory.push(fps);
      
      if (this.fpsHistory.length > 10) {
        this.fpsHistory.shift();
      }
    }
    
    this.lastFrameTime = now;
    
    // Continue tracking
    requestAnimationFrame(() => this.trackFrame());
  }
  
  collectMetrics() {
    this.collectPerformanceMetrics();
    this.collectNetworkStats();
    this.collectPlayerStats();
    this.collectGameStateStats();
    this.collectInputStats();
    this.collectServerStats();
  }
  
  collectPerformanceMetrics() {
    // Initialize performanceStats if not exists
    if (!this.performanceStats) {
      this.performanceStats = {};
    }
    
    // FPS calculation
    if (this.fpsHistory.length > 0) {
      const currentFPS = this.fpsHistory[this.fpsHistory.length - 1];
      this.performanceStats.fps = currentFPS;
      this.performanceStats.frameTime = this.frameTimes.length > 0 ? 
        Math.round(this.frameTimes[this.frameTimes.length - 1] * 10) / 10 : 0;
      this.performanceStats.renderTime = this.renderer ? 
        Math.round((this.renderer.lastRenderTime || 0) * 10) / 10 : 0;
    } else {
      // Default values when no FPS history yet
      this.performanceStats.fps = 0;
      this.performanceStats.frameTime = 0;
      this.performanceStats.renderTime = 0;
    }
    
    // Memory usage (if available)
    if (performance.memory) {
      this.performanceStats.memory = {
        used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
        total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
        limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)
      };
    }
  }
  
  collectNetworkStats() {
    // Stats are updated in real-time by event listeners
    // Update connection indicator class
    if (this.elements.connectionIndicator) {
      this.elements.connectionIndicator.className = 
        `connection-status ${this.networkStats.connectionStatus}`;
    }
  }
  
  collectPlayerStats() {
    if (!this.playerStats) {
      this.playerStats = {};
    }
    
    if (!this.game || !this.game.gameState) {
      this.playerStats = {
        position: '0, 0',
        velocity: '0, 0',
        status: 'Disconnected',
        score: 0,
        isIt: 'No'
      };
      return;
    }
    
    const myPlayer = this.game.gameState.players?.find(p => p.id === this.game.myPlayerId);
    if (!myPlayer) {
      this.playerStats = {
        position: 'N/A',
        velocity: 'N/A',
        status: 'Not in game',
        score: 0,
        isIt: 'No'
      };
      return;
    }
    
    this.playerStats = {
      position: `${Math.round(myPlayer.x || 0)}, ${Math.round(myPlayer.y || 0)}`,
      velocity: myPlayer.velocity ? 
        `${Math.round(myPlayer.velocity.dx * 100) / 100}, ${Math.round(myPlayer.velocity.dy * 100) / 100}` : '0, 0',
      status: this.getPlayerStatusText(myPlayer),
      score: myPlayer.score || 0,
      isIt: myPlayer.isIt ? 'Yes' : 'No'
    };
  }
  
  getPlayerStatusText(player) {
    const statuses = [];
    if (player.isIt) statuses.push('IT');
    if (player.isStunned) statuses.push('Stunned');
    if (player.isTransparent) statuses.push('Transparent');
    return statuses.length > 0 ? statuses.join(', ') : 'Normal';
  }
  
  collectGameStateStats() {
    if (!this.gameStateStats) {
      this.gameStateStats = {};
    }
    
    if (!this.game || !this.game.gameState) {
      this.gameStateStats = {
        totalPlayers: 0,
        aiPlayers: 0,
        gameActive: 'No',
        timeLeft: '--',
        powerups: '0/0',
        stars: '0/0'
      };
      return;
    }
    
    const gameState = this.game.gameState;
    const humanPlayers = gameState.players?.filter(p => !p.isAI) || [];
    const aiPlayers = gameState.players?.filter(p => p.isAI) || [];
    
    this.gameStateStats = {
      totalPlayers: gameState.players?.length || 0,
      aiPlayers: aiPlayers.length,
      gameActive: gameState.gameActive ? 'Yes' : 'No',
      timeLeft: gameState.timeRemaining ? this.formatTime(gameState.timeRemaining) : '--',
      powerups: gameState.powerUps ? 
        `${gameState.powerUps.filter(p => p.active).length}/${gameState.powerUps.length}` : '0/0',
      stars: gameState.stars ? 
        `${gameState.stars.filter(s => s.active).length}/${gameState.stars.length}` : '0/0'
    };
  }
  
  collectInputStats() {
    if (!this.input) {
      this.inputStats.currentInput = 'N/A';
      this.inputStats.touchActive = 'N/A';
      return;
    }
    
    // Track input rate
    const now = performance.now();
    if (this.inputStats.lastInputTime > 0) {
      const timeDiff = (now - this.inputStats.lastInputTime) / 1000;
      this.inputStats.rate = timeDiff > 0 ? Math.round(this.inputStats.inputCount / timeDiff) : 0;
    }
    
    // Get current input state
    const inputState = this.input.inputState || {};
    const activeInputs = [];
    if (inputState.up) activeInputs.push('↑');
    if (inputState.down) activeInputs.push('↓');
    if (inputState.left) activeInputs.push('←');
    if (inputState.right) activeInputs.push('→');
    if (inputState.isTouchActive) activeInputs.push('Touch');
    
    this.inputStats.currentInput = activeInputs.length > 0 ? activeInputs.join('') : 'None';
    this.inputStats.touchActive = inputState.isTouchActive ? 'Yes' : 'No';
  }
  
  collectServerStats() {
    // Basic server stats - could be enhanced with server-side data
    this.serverStats = {
      performance: this.networkStats.ping < 50 ? 'Good' : 
                   this.networkStats.ping < 100 ? 'Fair' : 'Poor',
      eventsPerSecond: Math.round(this.networkStats.updateRate || 0),
      physicsUpdates: '30/s' // Server runs at 30 FPS
    };
  }
  
  updateUI() {
    this.updatePerformanceUI();
    this.updateNetworkUI();
    this.updatePlayerUI();
    this.updateGameStateUI();
    this.updateInputUI();
    this.updateServerUI();
  }
  
  updatePerformanceUI() {
    if (!this.performanceStats) return;
    
    const fps = this.performanceStats.fps || 0;
    const frameTime = this.performanceStats.frameTime || 0;
    const renderTime = this.performanceStats.renderTime || 0;
    
    this.elements.fps.textContent = fps;
    this.elements.fps.className = this.getPerformanceClass(fps, 50, 30);
    
    this.elements.frameTime.textContent = `${frameTime}ms`;
    this.elements.frameTime.className = this.getPerformanceClass(frameTime, 20, 33, true);
    
    this.elements.renderTime.textContent = `${renderTime}ms`;
    this.elements.renderTime.className = this.getPerformanceClass(renderTime, 10, 16, true);
    
    if (this.performanceStats.memory) {
      const mem = this.performanceStats.memory;
      this.elements.memory.textContent = `${mem.used}/${mem.total}MB`;
    }
  }
  
  updateNetworkUI() {
    this.elements.connectionStatus.textContent = 
      this.networkStats.connectionStatus.charAt(0).toUpperCase() + 
      this.networkStats.connectionStatus.slice(1);
    
    const ping = this.networkStats.ping;
    this.elements.ping.textContent = `${ping}ms`;
    this.elements.ping.className = this.getPerformanceClass(ping, 50, 100, true);
    
    this.elements.updateRate.textContent = `${this.networkStats.updateRate} Hz`;
    this.elements.updateRate.className = this.getPerformanceClass(this.networkStats.updateRate, 25, 15);
    
    this.elements.interpolation.textContent = `${this.renderer?.interpolationTime || 100}ms`;
    
    this.elements.jitter.textContent = `${this.networkStats.jitter}ms`;
    this.elements.jitter.className = this.getPerformanceClass(this.networkStats.jitter, 10, 25, true);
  }
  
  updatePlayerUI() {
    if (!this.playerStats) return;
    
    this.elements.position.textContent = this.playerStats.position;
    this.elements.velocity.textContent = this.playerStats.velocity;
    this.elements.playerStatus.textContent = this.playerStats.status;
    this.elements.playerScore.textContent = this.playerStats.score;
    this.elements.isIt.textContent = this.playerStats.isIt;
    this.elements.isIt.className = this.playerStats.isIt === 'Yes' ? 'status-warning' : '';
  }
  
  updateGameStateUI() {
    if (!this.gameStateStats) return;
    
    this.elements.totalPlayers.textContent = this.gameStateStats.totalPlayers;
    this.elements.aiPlayers.textContent = this.gameStateStats.aiPlayers;
    this.elements.gameActive.textContent = this.gameStateStats.gameActive;
    this.elements.timeLeft.textContent = this.gameStateStats.timeLeft;
    this.elements.powerups.textContent = this.gameStateStats.powerups;
    this.elements.stars.textContent = this.gameStateStats.stars;
  }
  
  updateInputUI() {
    this.elements.inputRate.textContent = `${this.inputStats.rate}/s`;
    this.elements.currentInput.textContent = this.inputStats.currentInput;
    this.elements.touchActive.textContent = this.inputStats.touchActive;
    this.elements.validationRate.textContent = `${this.inputStats.validationRate}%`;
  }
  
  updateServerUI() {
    this.elements.serverPerformance.textContent = this.serverStats.performance;
    this.elements.serverPerformance.className = 
      this.serverStats.performance === 'Good' ? 'status-good' :
      this.serverStats.performance === 'Fair' ? 'status-warning' : 'status-error';
    
    this.elements.eventsPerSec.textContent = this.serverStats.eventsPerSecond;
    this.elements.physicsUpdates.textContent = this.serverStats.physicsUpdates;
  }
  
  getPerformanceClass(value, goodThreshold, badThreshold, reversed = false) {
    if (reversed) {
      if (value <= goodThreshold) return 'debug-metric-value status-good';
      if (value <= badThreshold) return 'debug-metric-value status-warning';
      return 'debug-metric-value status-error';
    } else {
      if (value >= goodThreshold) return 'debug-metric-value status-good';
      if (value >= badThreshold) return 'debug-metric-value status-warning';
      return 'debug-metric-value status-error';
    }
  }
  
  formatTime(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
  
  // Public API for external access
  static getInstance() {
    return window.debugStats;
  }
  
  exportStats() {
    return {
      performance: this.performanceStats,
      network: this.networkStats,
      player: this.playerStats,
      gameState: this.gameStateStats,
      input: this.inputStats,
      server: this.serverStats,
      timestamp: Date.now()
    };
  }
  
  logStats() {
    console.log('Debug Stats:', this.exportStats());
  }
}

// Global access
window.DebugStats = DebugStats;