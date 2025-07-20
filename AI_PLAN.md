# AI Player Implementation Plan for CatchMe Game

## Overview

This document outlines the implementation plan for adding AI (bot) players to the CatchMe multiplayer catch game. AI players will provide practice opportunities, fill games when there aren't enough human players, and add dynamic gameplay elements.

## Current Game Architecture Analysis

### Existing Player System

- **Player Class**: Located in `server/game/Player.js`
- **Properties**: id, name, position (x,y), isIt status, color, speed, power-ups
- **Movement**: Server-authoritative with obstacle collision detection
- **Speed**: 200 pixels/second (260 for "it" player with 30% boost)
- **Power-ups**: Transparency (5s duration, still catchable)
- **Obstacles**: Static rectangles and circles for strategic gameplay

### Game Management

- **GameManager**: Handles player join/disconnect, movement, collisions
- **GameState**: Manages game state, obstacles, power-ups, player validation
- **Socket.IO**: Real-time communication (not needed for AI players)

## AI Player Implementation Strategy

### Phase 1: Basic AI Infrastructure

#### 1.1 Create AIPlayer Class

**File**: `server/game/AIPlayer.js`

```javascript
class AIPlayer extends Player {
  constructor(id, name, x, y) {
    super(id, name, x, y);
    this.isAI = true;
    this.lastDecisionTime = Date.now();
    this.decisionInterval = 100; // Make decisions every 100ms
    this.targetPosition = null;
    this.currentBehavior = "wander"; // wander, chase, flee, collect_powerup
    this.pathfinding = null;
    this.personalityTraits = this.generatePersonality();
  }

  generatePersonality() {
    return {
      aggressiveness: Math.random(), // 0-1, affects chasing behavior
      fearfulness: Math.random(), // 0-1, affects fleeing behavior
      curiosity: Math.random(), // 0-1, affects power-up seeking
      intelligence: Math.random(), // 0-1, affects pathfinding quality
    };
  }
}
```

#### 1.2 Create AI Decision System

**File**: `server/game/AIBehavior.js`

```javascript
class AIBehavior {
  static decideAction(aiPlayer, gameState) {
    const decisions = {
      wander: () => this.wanderBehavior(aiPlayer, gameState),
      chase: () => this.chaseBehavior(aiPlayer, gameState),
      flee: () => this.fleeBehavior(aiPlayer, gameState),
      collect_powerup: () => this.collectPowerUpBehavior(aiPlayer, gameState),
    };

    // Behavior selection logic based on game state and personality
    const behavior = this.selectBehavior(aiPlayer, gameState);
    return decisions[behavior]();
  }
}
```

#### 1.3 Integrate AI into GameManager

**Modifications to**: `server/game/GameManager.js`

- Add AI player management methods
- Create AI update loop alongside existing game loop
- Handle AI decision making and movement
- Manage AI player lifecycle (spawn/despawn)

### Phase 2: AI Behaviors

#### 2.1 Core Behaviors

**Wandering Behavior**

- Random movement with tendency to explore uncovered areas
- Avoid getting stuck in corners
- Maintain minimum distance from obstacles
- Occasional direction changes for natural movement

**Chasing Behavior (When AI is "IT")**

- Target selection based on distance and catchability
- Simple pathfinding around obstacles
- Predict player movement for interception
- Switch targets if current target becomes unreachable

**Fleeing Behavior (When not "IT")**

- Detect proximity of "IT" player
- Calculate escape routes away from "IT"
- Use obstacles for cover and protection
- Balance between staying safe and collecting power-ups

**Power-up Collection Behavior**

- Scan for nearby active power-ups
- Evaluate risk vs reward of collecting power-ups
- Pathfinding to power-up locations
- Consider power-up strategic value

#### 2.2 Advanced Behaviors

**Ambush Behavior (For "IT" AI)**

- Hide behind obstacles
- Predict player movement patterns
- Set up ambush positions near power-ups
- Use transparency power-up strategically

**Cooperative Behavior**

- When multiple AIs are present, coordinate movements
- Block escape routes when one AI is chasing
- Share information about player positions (simulated)

### Phase 3: AI Intelligence Systems

#### 3.1 Pathfinding Implementation

**File**: `server/game/Pathfinding.js`

```javascript
class Pathfinding {
  static findPath(start, end, obstacles, gameWidth, gameHeight) {
    // A* pathfinding algorithm implementation
    // Consider obstacles as blocking nodes
    // Return array of waypoints from start to end
  }

  static avoidObstacles(currentPos, targetPos, obstacles) {
    // Simple obstacle avoidance for real-time movement
    // Use vector fields or potential fields approach
  }
}
```

#### 3.2 Game State Analysis

**File**: `server/game/AIAnalysis.js`

```javascript
class AIAnalysis {
  static analyzeGameState(gameState, aiPlayer) {
    return {
      nearestPlayer: this.findNearestPlayer(aiPlayer, gameState.players),
      nearestPowerUp: this.findNearestPowerUp(aiPlayer, gameState.powerUps),
      safeZones: this.identifySafeZones(gameState.obstacles, gameState.players),
      threatLevel: this.calculateThreatLevel(aiPlayer, gameState),
      strategicPositions: this.findStrategicPositions(gameState.obstacles),
    };
  }
}
```

#### 3.3 Learning System (Advanced)

**File**: `server/game/AILearning.js`

- Track successful strategies
- Adapt behavior based on player patterns
- Improve pathfinding efficiency
- Adjust personality traits based on performance

### Phase 4: AI Management

#### 4.1 AI Spawning System

**Modifications to**: `server/game/GameState.js`

```javascript
// Add AI management properties
this.aiPlayers = new Map();
this.maxAIPlayers = 4;
this.aiSpawnEnabled = true;
this.aiDifficultyLevel = 'medium'; // easy, medium, hard

// Methods to add
addAIPlayer(difficulty = 'medium') {
  // Create AI player with appropriate skill level
  // Find safe spawn position
  // Add to game state
}

removeAIPlayer(aiId) {
  // Remove AI player from game
  // Handle "IT" reassignment if needed
}

shouldSpawnAI() {
  // Logic to determine when to spawn AI players
  // Consider human player count, game settings
}
```

#### 4.2 Difficulty Levels

**Easy AI**

- Slower decision making (200ms intervals)
- Predictable movement patterns
- Poor pathfinding (often gets stuck)
- Rarely uses power-ups strategically
- Low aggressiveness when "IT"

**Medium AI**

- Standard decision making (100ms intervals)
- Balanced behavior selection
- Decent pathfinding with occasional mistakes
- Sometimes uses power-ups strategically
- Moderate pursuit when "IT"

**Hard AI**

- Fast decision making (50ms intervals)
- Advanced behavior prediction
- Excellent pathfinding and obstacle use
- Strategic power-up usage
- Aggressive and efficient when "IT"

### Phase 5: Client-Side Integration

#### 5.1 AI Player Visualization

**Modifications to**: `client/js/renderer.js`

- Add AI player visual indicators (different name style, bot icon)
- Distinguish AI players from human players in UI
- Optional: Show AI behavior state for debugging

#### 5.2 AI Configuration UI

**Modifications to**: `client/index.html` and related files

- Add AI settings panel for game host
- AI count slider (0-4 AI players)
- Difficulty selection dropdown
- Enable/disable AI option

### Phase 6: Advanced Features

#### 6.1 Named AI Personalities

Create distinct AI characters with unique behaviors:

- **Hunter**: Aggressive chaser, excellent at cornering players
- **Ninja**: Stealthy, uses transparency power-ups effectively
- **Guardian**: Defensive, good at avoiding being caught
- **Explorer**: Curious, always seeking power-ups
- **Strategist**: Calculates optimal moves, uses obstacles well

#### 6.2 AI Communication System

- Simulate AI "chat" messages during gameplay
- Contextual reactions to game events
- Personality-based communication styles

#### 6.3 AI Performance Analytics

- Track AI success rates
- Monitor behavior effectiveness
- Adjust AI parameters based on performance data
- Provide feedback for AI improvement

## Technical Implementation Details

### File Structure

```
server/game/
├── AIPlayer.js          # Extended Player class for AI
├── AIBehavior.js        # Behavior decision system
├── Pathfinding.js       # A* pathfinding implementation
├── AIAnalysis.js        # Game state analysis utilities
├── AILearning.js        # Learning and adaptation system
└── AIPersonalities.js   # Predefined AI personality types
```

### Integration Points

1. **GameManager.js**

   - Add `updateAIPlayers()` method to game loop
   - Handle AI player lifecycle
   - Process AI decisions and movements

2. **GameState.js**

   - Add AI player management methods
   - Configure AI spawning rules
   - Handle AI-specific game state

3. **Player.js**
   - Ensure compatibility with AI extension
   - Add AI identification properties

### Performance Considerations

- Limit AI decision frequency to prevent CPU overload
- Use efficient pathfinding algorithms (A\* with heuristics)
- Implement behavior caching to reduce calculations
- Monitor AI update performance and adjust as needed

### Testing Strategy

1. **Unit Tests**

   - Test individual AI behaviors
   - Validate pathfinding accuracy
   - Check decision making logic

2. **Integration Tests**

   - AI vs human player interactions
   - Multiple AI coordination
   - Performance under load

3. **Gameplay Tests**
   - AI entertainment value
   - Difficulty balance
   - Strategic depth

## Rollout Plan

### Phase 1 (Week 1-2): Foundation

- Implement basic AIPlayer class
- Create simple wandering behavior
- Integrate with existing game loop

### Phase 2 (Week 3-4): Core Behaviors

- Implement chase and flee behaviors
- Add basic pathfinding
- Power-up collection behavior

### Phase 3 (Week 5-6): Intelligence

- Advanced pathfinding with A\*
- Game state analysis system
- Behavior selection improvements

### Phase 4 (Week 7-8): Polish

- Multiple difficulty levels
- AI personalities
- Client-side integration and UI

### Phase 5 (Week 9-10): Advanced Features

- Learning system
- Performance optimization
- Comprehensive testing

## Success Metrics

- AI players provide engaging gameplay for solo practice
- AI behavior appears natural and human-like
- Performance impact is minimal (< 10% CPU increase)
- Players can't easily distinguish medium-difficulty AI from humans
- AI successfully fills lobbies when needed

## Future Enhancements

- Machine learning integration for behavior improvement
- Tournament mode with AI opponents
- AI coaching system for new players
- Cross-game AI personality persistence
- Community-contributed AI behaviors

This implementation plan provides a comprehensive roadmap for adding intelligent, engaging AI players to the CatchMe game while maintaining the existing game architecture and performance standards.
