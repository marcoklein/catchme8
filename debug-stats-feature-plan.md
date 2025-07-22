# Debug Stats Feature Plan

## Overview

Add a comprehensive debug stats panel to the client UI that allows developers to monitor real-time game performance, network conditions, and player state information for easier debugging and optimization.

## Current UI Structure Analysis

**Existing UI Elements:**
- Main game info panel (`#gameInfo`) with player name, score, status, time, and player count
- Leaderboard panel (`#leaderboard`) with player scores
- Controls instructions (`#controls`, `#mobileControls`) 
- Join form (`#joinForm`) for player entry
- Game canvas (`#gameCanvas`) for rendering
- Messages container (`#gameMessages`) for notifications

**Integration Points:**
- Add debug panel as collapsible overlay or sidebar
- Toggle visibility with keyboard shortcut or URL parameter
- Position to not interfere with core gameplay UI

## Debug Stats Panel Design

### Panel Structure
```
Debug Stats Panel (Collapsible)
├── Performance Metrics
├── Network Statistics  
├── Player State Information
├── Game State Data
├── Input & Movement Tracking
└── Server Statistics
```

### Data Categories

#### 1. Performance Metrics
- **Client FPS**: Real-time frame rate calculation
- **Frame Time**: Average milliseconds per frame
- **Render Time**: Time spent on canvas rendering
- **Memory Usage**: JavaScript heap size (if available)
- **Canvas Resolution**: Current canvas dimensions and scaling

#### 2. Network Statistics
- **Ping/RTT**: Round-trip time to server
- **Packet Loss**: Network reliability metrics
- **Update Rate**: Server broadcast frequency (actual vs expected 30 FPS)
- **Jitter Buffer**: Network timing variance data
- **Interpolation Time**: Current adaptive interpolation buffer
- **Connection Status**: Socket.IO connection state
- **Reconnection Count**: Number of reconnection attempts

#### 3. Player State Information
- **Position**: Current x,y coordinates (both server and predicted)
- **Velocity**: Movement direction and speed
- **Status Effects**: isStunned, isTransparent, isIt status and timers
- **Input State**: Current keyboard/touch input being processed
- **Movement Prediction**: Correction data and prediction accuracy
- **Score Details**: Points breakdown and recent changes

#### 4. Game State Data
- **Total Players**: Human + AI player counts
- **Game Phase**: Lobby, active, ended states
- **Time Remaining**: Precise millisecond countdown
- **Power-ups**: Active power-ups and spawn timers
- **Stars**: Available stars and collection rate
- **IT Player**: Current "IT" player and tag history

#### 5. Input & Movement Tracking
- **Input Rate**: Inputs per second being sent to server
- **Input Queue**: Pending inputs awaiting server confirmation
- **Movement Validation**: Server-side movement acceptance rate
- **Anti-cheat Flags**: Any rate limiting or validation failures
- **Touch Input**: Mobile touch state and calibration (if applicable)

#### 6. Server Statistics
- **Server Load**: Game loop performance indicators
- **AI Players**: AI behavior states and decision making
- **Physics Updates**: Movement engine processing stats
- **Event Processing**: Game events per second
- **Player Cleanup**: Inactive/ghost player detection status

## Technical Implementation Plan

### 1. Data Collection Architecture

#### Client-Side Metrics
```javascript
class DebugStats {
  constructor(game, renderer, network) {
    this.game = game;
    this.renderer = renderer;
    this.network = network;
    this.stats = {
      performance: {},
      network: {},
      player: {},
      gameState: {},
      input: {},
      server: {}
    };
    this.updateInterval = 100; // Update every 100ms
  }
}
```

#### Server-Side Debug Data
- Extend existing gameState broadcasts to include debug information
- Add optional debug channel for detailed server metrics
- Implement server performance monitoring hooks

### 2. UI Integration

#### Panel HTML Structure
```html
<div id="debugPanel" class="debug-panel hidden">
  <div class="debug-header">
    <h3>Debug Stats</h3>
    <button id="debugToggle" class="debug-toggle">×</button>
  </div>
  <div class="debug-content">
    <div class="debug-section" id="performance-stats"></div>
    <div class="debug-section" id="network-stats"></div>
    <div class="debug-section" id="player-stats"></div>
    <div class="debug-section" id="gamestate-stats"></div>
    <div class="debug-section" id="input-stats"></div>
    <div class="debug-section" id="server-stats"></div>
  </div>
</div>
```

#### CSS Styling
- Semi-transparent overlay design
- Monospace font for metrics
- Color-coded status indicators (green=good, yellow=warning, red=error)
- Collapsible sections for information density management
- Mobile-responsive layout considerations

### 3. Data Flow Implementation

#### Real-time Metrics Collection
1. **Performance Tracking**: Use `performance.now()` for frame timing
2. **Network Monitoring**: Track Socket.IO events and timing
3. **State Observation**: Monitor game object changes
4. **Input Analysis**: Track input frequency and validation

#### Update Mechanism
```javascript
class DebugStatsUpdater {
  startTracking() {
    setInterval(() => {
      this.collectPerformanceMetrics();
      this.collectNetworkStats();
      this.collectPlayerState();
      this.collectGameState();
      this.collectInputTracking();
      this.updateUI();
    }, this.updateInterval);
  }
}
```

### 4. Activation Methods

#### Toggle Mechanisms
- **Keyboard Shortcut**: `F3` or `Ctrl+Shift+D` to toggle
- **URL Parameter**: `?debug=1` to auto-enable on page load
- **Console Command**: `window.game.enableDebugStats()` for runtime activation
- **Local Storage**: Remember debug panel preference across sessions

#### Development vs Production
- Only enable in development builds or with explicit activation
- Add build-time flag to exclude debug code from production bundles
- Implement feature flag for controlled rollout

## Visual Design Specifications

### Panel Layout
- **Position**: Top-right corner overlay or left sidebar
- **Size**: 300px width, auto height with max-height scroll
- **Opacity**: 85% background with full opacity text
- **Z-index**: High enough to overlay game UI but not block controls

### Status Indicators
- **Green**: Optimal performance (FPS >50, ping <50ms)
- **Yellow**: Moderate issues (FPS 30-50, ping 50-100ms)  
- **Red**: Performance problems (FPS <30, ping >100ms)
- **Flashing**: Critical issues requiring attention

### Data Presentation
- **Numeric Values**: Right-aligned with units
- **Progress Bars**: For percentage-based metrics
- **Graphs**: Mini-charts for trending data (optional)
- **Tooltips**: Detailed explanations on hover

## Development Phases

### Phase 1: Foundation (MVP)
- Basic debug panel HTML/CSS structure
- Performance metrics (FPS, frame time)
- Network stats (ping, connection status)
- Panel toggle functionality

### Phase 2: Core Metrics
- Player state information
- Game state data
- Input tracking
- Basic server statistics

### Phase 3: Advanced Features
- Trending graphs and history
- Export/logging capabilities
- Advanced network analysis
- Performance recommendations

### Phase 4: Polish & Optimization
- Mobile optimization
- Visual enhancements
- Documentation
- Performance impact optimization

## File Structure

```
client/
├── js/
│   ├── debug-stats.js          # Main debug stats class
│   ├── debug-ui.js             # UI management and rendering
│   └── debug-collectors.js     # Data collection utilities
├── css/
│   └── debug-stats.css         # Debug panel styling
└── index.html                  # Updated with debug panel HTML
```

## Benefits for Developers

1. **Performance Optimization**: Identify frame rate issues and rendering bottlenecks
2. **Network Debugging**: Diagnose connection problems and latency issues
3. **Gameplay Balancing**: Monitor player behavior and game mechanics
4. **Bug Investigation**: Real-time state inspection for issue reproduction
5. **Feature Development**: Validate new feature performance impact
6. **Mobile Optimization**: Mobile-specific performance monitoring

## Implementation Considerations

### Performance Impact
- Minimize overhead of debug data collection
- Use efficient DOM updates for UI refresh
- Consider impact on mobile devices with limited resources
- Add toggle to disable specific expensive metrics

### Security & Privacy
- Avoid exposing sensitive server information
- Filter debug data in production environments
- Respect player privacy in multiplayer scenarios

### Maintenance
- Design for easy extension with new metrics
- Maintain compatibility with existing codebase
- Document metric meanings and thresholds
- Plan for metric evolution as game features change

## Success Criteria

1. **Functionality**: All planned metrics display accurately and update in real-time
2. **Performance**: Debug panel adds <5% performance overhead when enabled
3. **Usability**: Developers can quickly identify and diagnose common issues
4. **Integration**: Seamless integration with existing UI without gameplay disruption
5. **Compatibility**: Works across desktop and mobile platforms