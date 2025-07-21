# Points System Feature Specification

## Overview

This document outlines the implementation of a comprehensive points-based scoring system for the CatchMe game that introduces strategic depth through risk/reward mechanics, alternative objectives for tagged players, and competitive star collection missions.

## Core Points Mechanics

### 1. Tagged Player Point Deduction

**Feature**: Continuous point loss while being "IT"

- **Rate**: -10 points per second while tagged as "IT"
- **Purpose**: Creates urgency to tag someone else quickly
- **Implementation**: Server-side timer that deducts points every second

**Technical Details**:

- Points deduction starts immediately when player becomes "IT"
- Timer resets when "IT" status is transferred
- Points cannot go below 0 (minimum floor)
- Deduction pauses during stun periods (fair play)

### 2. Successful Tag Bonus

**Feature**: Reward for successfully tagging another player

- **Reward**: +100 points for tagging someone
- **Purpose**: High reward for successful catches, offsetting the deduction period
- **Timing**: Points awarded immediately when tag is confirmed

**Balance Calculation**:

- At -10 points/second, player loses 100 points in 10 seconds
- One successful tag (+100) cancels out 10 seconds of being "IT"
- Creates natural incentive to tag quickly rather than chase forever

### 3. Strategic Implications

**Risk/Reward Balance**:

- Being "IT" is now genuinely undesirable (point loss)
- Players want to be tagged to stop losing points
- But they also want to avoid being tagged to maintain positive score
- Creates dynamic tension and strategic gameplay

## Star Collection Mission System

### 1. Star Object Implementation

**Star Properties**:

- **Appearance**: 5-pointed star shape, golden color
- **Size**: 12px radius (smaller than power-ups)
- **Spawn Rate**: 2-3 stars active on field at any time
- **Respawn**: 8-10 seconds after collection
- **Distribution**: Random positions avoiding obstacles

**Visual Design**:

- Animated rotation (slow spin)
- Pulsing glow effect
- Distinct from power-ups (different color/shape)
- Sparkle particle effects when collected

### 2. Star Collection Rules

**For Non-IT Players**:

- **Points**: +25 points per star collected
- **Purpose**: Standard bonus collection objective
- **Accessibility**: All non-IT players can collect

**For IT Players**:

- **Points**: +50 points per star collected (double bonus)
- **Purpose**: Alternative objective while being "IT"
- **Strategy**: Provides option other than chasing players

**Competition Mechanic**:

- Stars disappear when collected by any player
- Creates direct competition between players
- IT players get higher reward but also lose 10 points/second
- Risk/reward calculation: IT player needs to collect star within 5 seconds to break even

### 3. Star Mission Types

**Basic Collection**:

- Collect individual stars for immediate points
- No special requirements or combinations

**Future Expansion Potential**:

- **Star Chains**: Collect 3 stars within 10 seconds for bonus multiplier
- **Color Variants**: Different colored stars with varying point values
- **Special Stars**: Rare stars that grant temporary abilities
- **Star Patterns**: Collect stars in specific order for combo bonuses

## Technical Implementation

### 1. Database Schema Extensions

**Player Score Tracking**:

```javascript
class Player {
  constructor(id, name, x, y) {
    // ...existing properties...

    // Points system
    this.score = 0;
    this.totalStarsCollected = 0;
    this.totalSuccessfulTags = 0;
    this.timeAsIt = 0; // Total time spent being "IT" (for statistics)

    // IT status tracking for points
    this.becameItTime = null; // When player became "IT"
    this.lastPointDeduction = null; // Last time points were deducted
  }
}
```

**Star Object Structure**:

```javascript
class Star {
  constructor(id, x, y) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.type = "star";
    this.radius = 12;
    this.active = true;
    this.spawnTime = Date.now();
    this.respawnTime = 10000; // 10 seconds
    this.rotationAngle = 0; // For animation
  }
}
```

### 2. GameState Extensions

**Star Management**:

```javascript
class GameState {
  constructor() {
    // ...existing properties...

    // Stars system
    this.stars = this.generateStars();
    this.starRespawnTimer = new Map();
    this.maxActiveStars = 3;
    this.starRespawnInterval = 8000; // 8 seconds base respawn

    // Points system
    this.pointDeductionInterval = 1000; // 1 second
    this.lastPointUpdate = Date.now();
  }

  generateStars() {
    // Create 3 initial stars at safe positions
    // Similar to power-up generation but different positioning
  }

  checkStarCollision(player) {
    // Check if player collides with any active star
    // Return collected star if found
  }

  collectStar(player, star) {
    // Award points based on player IT status
    // Deactivate star and set respawn timer
    // Update player statistics
  }

  updatePointSystem() {
    // Process point deductions for IT players
    // Handle respawn timers for stars
  }
}
```

### 3. Game Manager Integration

**Points Processing Loop**:

```javascript
class GameManager {
  gameLoop() {
    // ...existing game loop...

    // Update points system
    this.updatePlayerPoints();

    // Update stars
    this.gameState.updateStars();

    // Check star collections
    this.checkStarCollections();
  }

  updatePlayerPoints() {
    const now = Date.now();

    for (const player of this.gameState.players.values()) {
      if (player.isIt && player.becameItTime) {
        // Calculate time since last deduction
        const lastDeduction = player.lastPointDeduction || player.becameItTime;
        const timeSinceDeduction = now - lastDeduction;

        // Deduct points every second
        if (timeSinceDeduction >= 1000) {
          const secondsToDeduct = Math.floor(timeSinceDeduction / 1000);
          const pointsToDeduct = secondsToDeduct * 10;

          player.score = Math.max(0, player.score - pointsToDeduct);
          player.timeAsIt += timeSinceDeduction;
          player.lastPointDeduction = now;

          // Broadcast point update
          this.broadcastPlayerScore(player);
        }
      }
    }
  }

  handlePlayerTagged(taggerId, targetId) {
    // ...existing tag logic...

    // Award points for successful tag
    const tagger = this.gameState.players.get(taggerId);
    if (tagger) {
      tagger.score += 100;
      tagger.totalSuccessfulTags++;
      tagger.becameItTime = null; // No longer IT
      tagger.lastPointDeduction = null;
    }

    // Set new IT player timing
    const newItPlayer = this.gameState.players.get(targetId);
    if (newItPlayer) {
      newItPlayer.becameItTime = Date.now();
      newItPlayer.lastPointDeduction = null;
    }

    // Broadcast score updates
    this.broadcastGameState();
  }
}
```

### 4. Client-Side Integration

**UI Components**:

```html
<!-- Score Display -->
<div id="scoreDisplay">
  <div id="playerScore">Score: <span id="scoreValue">0</span></div>
  <div id="scoreChange" class="score-animation"></div>
</div>

<!-- Leaderboard -->
<div id="leaderboard">
  <h3>Scores</h3>
  <div id="playerScores"></div>
</div>

<!-- Star Collection Feedback -->
<div id="starCollection" class="collection-popup"></div>
```

**Renderer Updates**:

```javascript
class Renderer {
  renderStars(gameState) {
    for (const star of gameState.stars) {
      if (!star.active) continue;

      // Draw rotating star with glow effect
      this.drawStar(star.x, star.y, star.rotationAngle);
    }
  }

  drawStar(x, y, rotation) {
    // Draw 5-pointed star with rotation animation
    // Add pulsing glow effect
    // Include sparkle particles
  }

  updateScoreDisplay(player) {
    // Update score in UI
    // Show score change animations (+/- points)
    // Update leaderboard positions
  }
}
```

### 5. Network Protocol Extensions

**New Socket Events**:

```javascript
// Server to Client
socket.emit("starCollected", {
  playerId: player.id,
  playerName: player.name,
  starId: star.id,
  pointsAwarded: points,
  newScore: player.score,
});

socket.emit("scoreUpdate", {
  playerId: player.id,
  score: player.score,
  change: pointChange, // positive or negative
});

socket.emit("leaderboardUpdate", {
  players: rankedPlayers, // sorted by score
});

// Client to Server
// (No new client events needed - collection is automatic)
```

## Game Balance Considerations

### 1. Point Values Tuning

**Current Proposal**:

- IT deduction: -10 points/second
- Successful tag: +100 points
- Star (non-IT): +25 points
- Star (IT): +50 points

**Balance Rationale**:

- 10 seconds as IT = -100 points
- One tag = +100 points (breaks even)
- IT collecting 2 stars = +100 points in ~5 seconds (viable alternative)
- Non-IT collecting 4 stars = +100 points (encourages active play)

### 2. Strategic Depth

**Player Behaviors**:

- **IT Players**: Must choose between chasing players or collecting stars
- **Non-IT Players**: Can safely collect stars but must avoid being tagged
- **Risk Assessment**: Players evaluate whether to approach contested stars

**Gameplay Dynamics**:

- Creates "hot zones" around stars where players compete
- IT players might use stars as bait to catch other players
- Non-IT players must decide if star is worth the risk of getting close to IT player

### 3. Match Duration Impact

**Scoring Progression**:

- 2-minute games provide ~120 seconds total time
- Multiple tag exchanges during game
- Star collection provides consistent point opportunities
- Prevents single-tag victories (requires sustained performance)

## Future Expansion Features

### 1. Power-Up Integration

- Stars that grant temporary power-ups when collected
- Special "Golden Stars" worth extra points but only spawn rarely
- Star multiplier power-ups that double next star collection

### 2. Team Variants

- Team-based star collection competitions
- Relay tagging with shared team scores
- Protected star zones for specific teams

### 3. Achievement System

- "Star Hunter": Collect 50 stars in a match
- "Escape Artist": Avoid being IT for entire match while collecting stars
- "Quick Draw": Tag someone within 3 seconds of becoming IT

### 4. Advanced Statistics

- Points per minute
- Average time as IT
- Star collection efficiency
- Tag success rate

## Implementation Timeline

### Phase 1 (Week 1-2): Core Points System

- Implement basic scoring for IT deduction and successful tags
- Add score display to UI
- Test balance with existing gameplay

### Phase 2 (Week 3-4): Star Collection

- Implement star objects and collision detection
- Add star rendering and animations
- Test star placement and respawn mechanics

### Phase 3 (Week 5-6): Polish and Balance

- Fine-tune point values based on playtesting
- Add score animations and visual feedback
- Implement leaderboard system

### Phase 4 (Week 7-8): Advanced Features

- Add achievement system
- Implement match statistics
- Performance optimization

## Success Metrics

**Engagement Indicators**:

- Increased average game session length
- More strategic movement patterns (less random wandering)
- Balanced distribution of final scores (not winner-take-all)
- Positive player feedback on strategic depth

**Balance Verification**:

- IT players spending 30-50% of time collecting stars vs chasing
- No single strategy dominating (tagging vs star collection)
- Score differences between players staying within reasonable range (2-3x max)
- All players having viable paths to points throughout match

**Technical Performance**:

- No impact on game performance (60 FPS maintained)
- Accurate point calculations with no edge cases
- Smooth star animations and collision detection
- Reliable network synchronization for point updates

This points system transforms CatchMe from a simple tag game into a strategic competition where players must balance risk and reward, creating more engaging and replayable gameplay while maintaining the core fun of the chase mechanic.
