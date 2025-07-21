# Stunning Power-Up Feature Specification

## Overview

The Stunning Power-Up is a new collectible item that grants the IT player the ability to create a pulsating stun radius around themselves, stunning all nearby players for a short duration. This feature adds a strategic offensive capability for the IT player, creating new tactical opportunities in the catch-me gameplay.

## Feature Details

### 1. Stun Orb Power-Up

**Power-Up Properties**:

- **Appearance**: Electric blue orb with lightning spark effects
- **Size**: 15px radius (same as transparency power-ups)
- **Spawn Rate**: 1-2 stun orbs active on field at any time
- **Respawn**: 20 seconds after collection (longer than transparency)
- **Distribution**: Random positions avoiding obstacles, similar to existing power-ups

**Visual Design**:

- Electric blue gradient with white/cyan sparks
- Crackling lightning animation around the orb
- Distinct pulsing effect with electrical static
- Different color scheme from transparency (blue) and stars (gold)

### 2. Stun Ability Mechanics

**Automatic Activation**:

- Activates immediately when IT player collects stun orb
- No manual activation required
- Cannot be collected while stunned
- Automatic 3-second pulse effect begins instantly

**Stun Effect**:

- **Pulse Radius**: 80px from IT player center
- **Pulse Duration**: 3 seconds (visible pulsing animation)
- **Stun Duration**: 500ms for affected players
- **Visual Effect**: Expanding electric circle with lightning effects
- **Audio Feedback**: Electric zap sound effect

**Targeting Rules**:

- Affects all players within pulse radius
- Does not affect the IT player themselves
- Transparent players are still affected (but remain invisible)
- Players already stunned have their stun duration reset to 500ms

### 3. Strategic Impact

**IT Player Advantages**:

- Can temporarily immobilize nearby players for easier tagging
- Creates tactical opportunities in crowded areas
- Provides crowd control when multiple players are nearby
- Adds offensive capability beyond just speed boost
- Immediate effect upon collection creates surprise element

**Counterplay Options**:

- Limited power-up availability (1-2 active at a time)
- Long respawn timer (20 seconds)
- Short stun duration (500ms) allows quick recovery
- 3-second visual pulse animation gives players time to react after collection
- Players can avoid clustering to minimize stun effectiveness
- Power-up can be "blocked" by non-IT players collecting it first

## Technical Implementation

### 1. GameState Extensions

**Stun Orb Generation**:

```javascript
class GameState {
  constructor() {
    // ...existing properties...

    // Stun orbs system
    this.stunOrbs = this.generateStunOrbs();
    this.stunOrbRespawnTimer = new Map();
    this.maxActiveStunOrbs = 2;
    this.stunOrbRespawnInterval = 20000; // 20 seconds
  }

  generateStunOrbs() {
    const stunOrbs = [];
    const stunOrbPositions = [
      { x: 120, y: 200 },
      { x: 680, y: 200 },
      { x: 120, y: 400 },
      { x: 680, y: 400 },
      { x: 400, y: 120 },
      { x: 400, y: 480 },
      { x: 250, y: 300 },
      { x: 550, y: 300 },
    ];

    // Select 2 random positions for initial stun orbs
    const selectedPositions = [];
    const positionsCopy = [...stunOrbPositions];

    while (
      selectedPositions.length < this.maxActiveStunOrbs &&
      positionsCopy.length > 0
    ) {
      const randomIndex = Math.floor(Math.random() * positionsCopy.length);
      const pos = positionsCopy.splice(randomIndex, 1)[0];

      if (!this.checkObstacleCollision(pos.x, pos.y, 15)) {
        selectedPositions.push(pos);
      }
    }

    selectedPositions.forEach((pos, index) => {
      stunOrbs.push({
        id: `stunorb_${index}`,
        x: pos.x,
        y: pos.y,
        type: "stunOrb",
        radius: 15,
        active: true,
        spawnTime: Date.now(),
        electricPhase: Math.random() * Math.PI * 2, // For animation
      });
    });

    return stunOrbs;
  }

  checkStunOrbCollision(player) {
    for (const stunOrb of this.stunOrbs) {
      if (!stunOrb.active) continue;

      const dx = player.x - stunOrb.x;
      const dy = player.y - stunOrb.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < player.radius + stunOrb.radius) {
        this.collectStunOrb(player, stunOrb);
        return stunOrb;
      }
    }
    return null;
  }

  collectStunOrb(player, stunOrb) {
    // Deactivate the stun orb
    stunOrb.active = false;

    // Auto-activate stun pulse only for IT players
    if (player.isIt) {
      player.startStunPulse();
      // Execute immediate stun pulse effect
      const affectedPlayers = this.executeStunPulse(player);
      return affectedPlayers;
    }

    // Set respawn timer
    this.stunOrbRespawnTimer.set(
      stunOrb.id,
      Date.now() + this.stunOrbRespawnInterval
    );
    return [];
  }

  updateStunOrbs() {
    const now = Date.now();

    // Update electrical animation phase
    for (const stunOrb of this.stunOrbs) {
      if (stunOrb.active) {
        stunOrb.electricPhase += 0.15; // Fast electrical animation
        if (stunOrb.electricPhase > Math.PI * 2) {
          stunOrb.electricPhase -= Math.PI * 2;
        }
      }
    }

    // Check for stun orbs to respawn
    for (const stunOrb of this.stunOrbs) {
      if (!stunOrb.active) {
        const respawnTime = this.stunOrbRespawnTimer.get(stunOrb.id);
        if (respawnTime && now >= respawnTime) {
          // Find a new safe position for respawn
          const newPosition = this.findSafeStunOrbPosition();
          if (newPosition) {
            stunOrb.x = newPosition.x;
            stunOrb.y = newPosition.y;
            stunOrb.active = true;
            stunOrb.spawnTime = now;
            stunOrb.electricPhase = Math.random() * Math.PI * 2;
            this.stunOrbRespawnTimer.delete(stunOrb.id);
          }
        }
      }
    }
  }

  findSafeStunOrbPosition() {
    const stunOrbPositions = [
      { x: 120, y: 200 },
      { x: 680, y: 200 },
      { x: 120, y: 400 },
      { x: 680, y: 400 },
      { x: 400, y: 120 },
      { x: 400, y: 480 },
      { x: 250, y: 300 },
      { x: 550, y: 300 },
      { x: 300, y: 200 },
      { x: 500, y: 200 },
      { x: 300, y: 400 },
      { x: 500, y: 400 },
    ];

    // Shuffle positions for randomness
    for (let i = stunOrbPositions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [stunOrbPositions[i], stunOrbPositions[j]] = [
        stunOrbPositions[j],
        stunOrbPositions[i],
      ];
    }

    // Find first safe position
    for (const pos of stunOrbPositions) {
      if (!this.checkObstacleCollision(pos.x, pos.y, 15)) {
        // Also check if position is not too close to players
        let tooClose = false;
        for (const player of this.players.values()) {
          const dx = pos.x - player.x;
          const dy = pos.y - player.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance < 60) {
            // Minimum distance from players
            tooClose = true;
            break;
          }
        }
        if (!tooClose) {
          return pos;
        }
      }
    }

    // Fallback to random position
    return {
      x: 120 + Math.random() * 560,
      y: 120 + Math.random() * 360,
    };
  }

  // Process stun pulse effect
  executeStunPulse(itPlayer) {
    const stunRadius = 80;
    const stunDuration = 500;
    const affectedPlayers = [];

    for (const [playerId, player] of this.players) {
      if (player.id === itPlayer.id) continue; // Don't stun self

      const dx = player.x - itPlayer.x;
      const dy = player.y - itPlayer.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance <= stunRadius) {
        player.stun(stunDuration);
        affectedPlayers.push({
          id: player.id,
          name: player.name,
        });
      }
    }

    return affectedPlayers;
  }

  toJSON() {
    return {
      players: Array.from(this.players.values()).map((p) => p.toJSON()),
      gameActive: this.gameActive,
      timeRemaining: this.getTimeRemaining(),
      gameWidth: this.gameWidth,
      gameHeight: this.gameHeight,
      obstacles: this.obstacles,
      powerUps: this.powerUps.filter((p) => p.active),
      stars: this.stars.filter((s) => s.active),
      stunOrbs: this.stunOrbs.filter((s) => s.active), // Add stun orbs to game state
    };
  }
}
```

### 2. Player Extensions

**Stun Ability System**:

```javascript
class Player {
  constructor(id, name, x = 400, y = 300) {
    // ...existing properties...

    // Stun pulse properties
    this.isPerformingStunPulse = false;
    this.stunPulseStartTime = 0;
    this.stunPulseDuration = 3000; // 3 seconds
  }

  startStunPulse() {
    if (this.isIt && !this.isStunned && !this.isPerformingStunPulse) {
      this.isPerformingStunPulse = true;
      this.stunPulseStartTime = Date.now();
      return true;
    }
    return false;
  }

  updateStunPulse(currentTime) {
    // Check if stun pulse animation has finished
    if (this.isPerformingStunPulse) {
      if (currentTime >= this.stunPulseStartTime + this.stunPulseDuration) {
        this.isPerformingStunPulse = false;
        this.stunPulseStartTime = 0;
      }
    }
  }

  updatePowerUps(currentTime) {
    // ...existing power-up updates...

    // Update stun pulse animation
    this.updateStunPulse(currentTime);
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      x: this.x,
      y: this.y,
      isIt: this.isIt,
      color: this.color,
      radius: this.radius,
      isTransparent: this.isTransparent,
      isStunned: this.isStunned,
      score: this.score,
      isPerformingStunPulse: this.isPerformingStunPulse,
      stunPulseStartTime: this.stunPulseStartTime,
    };
  }
}
```

### 3. GameManager Integration

**Event Handling**:

```javascript
class GameManager {
  handlePlayerMove(socket, movement) {
    // ...existing movement handling...

    if (this.gameState.updatePlayer(socket.id, movement, deltaTime)) {
      const player = this.gameState.players.get(socket.id);
      if (player) {
        // Check for stun orb collection
        const collectedStunOrb = this.gameState.checkStunOrbCollision(player);
        if (collectedStunOrb) {
          const affectedPlayers = this.gameState.collectStunOrb(
            player,
            collectedStunOrb
          );

          this.io.to("game").emit("stunOrbCollected", {
            playerId: player.id,
            playerName: player.name,
            onlyForIt: !player.isIt, // Indicate if power-up was wasted
            stunActivated: player.isIt, // Whether stun was activated
            affectedPlayers: affectedPlayers,
          });

          // If stun was activated, notify about the pulse
          if (player.isIt && affectedPlayers.length > 0) {
            this.io.to("game").emit("stunPulseActivated", {
              itPlayerId: player.id,
              itPlayerName: player.name,
              stunRadius: 80,
              pulseDuration: 3000,
              affectedPlayers: affectedPlayers,
            });
          }
        }

        // ...existing collision checks...
      }
    }
  }

  checkGameEvents(player) {
    // ...existing event checks...

    // Check for stun orb collection
    const collectedStunOrb = this.gameState.checkStunOrbCollision(player);
    if (collectedStunOrb) {
      const affectedPlayers = this.gameState.collectStunOrb(
        player,
        collectedStunOrb
      );

      this.io.to("game").emit("stunOrbCollected", {
        playerId: player.id,
        playerName: player.name,
        stunOrbId: collectedStunOrb.id,
        onlyForIt: !player.isIt,
        stunActivated: player.isIt,
        affectedPlayers: affectedPlayers,
      });
    }
  }

  update() {
    // ...existing updates...

    // Update stun orbs
    this.gameState.updateStunOrbs();
  }
}
```

### 4. Client-Side Integration

**Input Handling**:

_Note: No manual input required - stun activates automatically upon collection_

**Renderer Updates**:

```javascript
// Add to renderer.js
class Renderer {
  drawStunOrbs() {
    if (!this.gameState.stunOrbs) return;

    this.ctx.save();

    this.gameState.stunOrbs.forEach((stunOrb) => {
      if (!stunOrb.active) return;

      // Create electrical animation
      const time = Date.now() * 0.01;
      const electricPhase = stunOrb.electricPhase + time;
      const pulseScale = 1 + Math.sin(electricPhase * 3) * 0.2;
      const sparkAlpha = 0.7 + Math.sin(electricPhase * 5) * 0.3;

      this.ctx.globalAlpha = sparkAlpha;

      // Draw electric blue gradient
      const gradient = this.ctx.createRadialGradient(
        stunOrb.x,
        stunOrb.y,
        0,
        stunOrb.x,
        stunOrb.y,
        stunOrb.radius * pulseScale
      );
      gradient.addColorStop(0, "rgba(0, 191, 255, 0.9)"); // Deep sky blue center
      gradient.addColorStop(0.5, "rgba(30, 144, 255, 0.7)"); // Dodger blue
      gradient.addColorStop(1, "rgba(65, 105, 225, 0.3)"); // Royal blue edge

      this.ctx.fillStyle = gradient;
      this.ctx.beginPath();
      this.ctx.arc(
        stunOrb.x,
        stunOrb.y,
        stunOrb.radius * pulseScale,
        0,
        Math.PI * 2
      );
      this.ctx.fill();

      // Draw electrical sparks
      this.ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
      this.ctx.lineWidth = 2;
      for (let i = 0; i < 6; i++) {
        const angle = (electricPhase + (i * Math.PI) / 3) % (Math.PI * 2);
        const sparkLength = stunOrb.radius + Math.sin(electricPhase * 4) * 5;
        const startX = stunOrb.x + Math.cos(angle) * stunOrb.radius;
        const startY = stunOrb.y + Math.sin(angle) * stunOrb.radius;
        const endX = stunOrb.x + Math.cos(angle) * sparkLength;
        const endY = stunOrb.y + Math.sin(angle) * sparkLength;

        this.ctx.beginPath();
        this.ctx.moveTo(startX, startY);
        this.ctx.lineTo(endX, endY);
        this.ctx.stroke();
      }

      // Draw border
      this.ctx.strokeStyle = "rgba(0, 191, 255, 0.8)";
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.arc(
        stunOrb.x,
        stunOrb.y,
        stunOrb.radius * pulseScale,
        0,
        Math.PI * 2
      );
      this.ctx.stroke();
    });

    this.ctx.restore();
  }

  drawStunPulseEffect(player) {
    if (!player.isPerformingStunPulse) return;

    const elapsed = Date.now() - player.stunPulseStartTime;
    const progress = elapsed / 3000; // 3 second duration
    const radius = 80 * progress; // Expanding radius
    const alpha = 1 - progress; // Fading out

    this.ctx.save();
    this.ctx.globalAlpha = alpha * 0.4;

    // Draw expanding electric circle
    const gradient = this.ctx.createRadialGradient(
      player.x,
      player.y,
      radius * 0.3,
      player.x,
      player.y,
      radius
    );
    gradient.addColorStop(0, "rgba(0, 191, 255, 0.8)");
    gradient.addColorStop(0.7, "rgba(30, 144, 255, 0.4)");
    gradient.addColorStop(1, "rgba(65, 105, 225, 0.1)");

    this.ctx.fillStyle = gradient;
    this.ctx.beginPath();
    this.ctx.arc(player.x, player.y, radius, 0, Math.PI * 2);
    this.ctx.fill();

    // Draw electric border
    this.ctx.strokeStyle = `rgba(0, 191, 255, ${alpha})`;
    this.ctx.lineWidth = 3;
    this.ctx.beginPath();
    this.ctx.arc(player.x, player.y, radius, 0, Math.PI * 2);
    this.ctx.stroke();

    this.ctx.restore();
  }

  render() {
    // ...existing render calls...
    this.drawStunOrbs();

    // Draw stun pulse effects for IT players
    this.gameState.players.forEach((player) => {
      if (player.isIt) {
        this.drawStunPulseEffect(player);
      }
    });
  }
}
```

**Network Event Handling**:

```javascript
// Add to network.js
socket.on("stunOrbCollected", (data) => {
  if (data.onlyForIt) {
    showToastMessage(
      `${data.playerName} collected stun orb (IT only!)`,
      "warning"
    );
  } else if (data.stunActivated) {
    showToastMessage(
      `${data.playerName} collected stun orb - pulse activated!`,
      "danger"
    );
  } else {
    showToastMessage(`${data.playerName} collected stun orb!`, "info");
  }
});

socket.on("stunPulseActivated", (data) => {
  showToastMessage(`${data.itPlayerName} activated stun pulse!`, "danger");

  // Show visual feedback for affected players
  data.affectedPlayers.forEach((affectedPlayer) => {
    if (affectedPlayer.id === socket.id) {
      showToastMessage("You were stunned!", "warning");
    }
  });
});
```

## UI/UX Enhancements

### 1. Visual Indicators

**Stun Effect Indicator**:

- Immediate visual feedback when IT player collects stun orb
- Automatic pulse animation begins instantly
- No ability icons or prompts needed

**Stun Status Effects**:

- Stunned players have electric static overlay
- Screen flash effect when player is stunned
- Paralysis animation (slight shake effect)

### 2. Audio Feedback

**Sound Effects**:

- Electric crackling for stun orb collection
- Thunder clap for stun pulse activation
- Electric zap for players getting stunned
- Static noise during stun effect

### 3. Tutorial Integration

**Help Text Updates**:

- "Collect blue stun orbs to automatically stun nearby players (IT only)"
- "Stun orbs activate immediately when collected by IT player"
- "Stun pulse affects all players within 80px radius for 3 seconds"
- "Stunned players cannot move for 0.5 seconds"

## Testing Strategy

### 1. Unit Tests

**GameState Tests**:

```javascript
describe("Stun Orb System", () => {
  test("should generate stun orbs at safe positions", () => {
    expect(gameState.stunOrbs.length).toBe(2);
    gameState.stunOrbs.forEach((stunOrb) => {
      expect(stunOrb.type).toBe("stunOrb");
      expect(stunOrb.radius).toBe(15);
    });
  });

  test("should only grant stun ability to IT players", () => {
    const itPlayer = createTestPlayer("it1", "ITPlayer");
    const normalPlayer = createTestPlayer("normal1", "NormalPlayer");
    itPlayer.isIt = true;

    const stunOrb = gameState.stunOrbs[0];
    itPlayer.x = stunOrb.x;
    itPlayer.y = stunOrb.y;

    gameState.checkStunOrbCollision(itPlayer);
    expect(itPlayer.hasStunAbility).toBe(true);

    normalPlayer.x = stunOrb.x;
    normalPlayer.y = stunOrb.y;
    gameState.checkStunOrbCollision(normalPlayer);
    expect(normalPlayer.hasStunAbility).toBe(false);
  });

  test("should stun players within pulse radius", () => {
    const itPlayer = createTestPlayer("it1", "ITPlayer", 400, 300);
    const nearPlayer = createTestPlayer("near1", "NearPlayer", 450, 300);
    const farPlayer = createTestPlayer("far1", "FarPlayer", 600, 300);

    itPlayer.isIt = true;
    itPlayer.hasStunAbility = true;

    gameState.addPlayer(itPlayer);
    gameState.addPlayer(nearPlayer);
    gameState.addPlayer(farPlayer);

    const affectedPlayers = gameState.executeStunPulse(itPlayer);

    expect(nearPlayer.isStunned).toBe(true);
    expect(farPlayer.isStunned).toBe(false);
    expect(affectedPlayers.length).toBe(1);
    expect(affectedPlayers[0].id).toBe(nearPlayer.id);
  });
});
```

**Player Tests**:

```javascript
describe("Player Stun Ability", () => {
  test("should only allow stun ability when IT", () => {
    player.isIt = false;
    player.hasStunAbility = true;
    expect(player.canUseStunAbility()).toBe(false);

    player.isIt = true;
    expect(player.canUseStunAbility()).toBe(true);
  });

  test("should prevent stun ability during stun", () => {
    player.isIt = true;
    player.hasStunAbility = true;
    player.stun(500);
    expect(player.canUseStunAbility()).toBe(false);
  });

  test("should consume stun ability on use", () => {
    player.isIt = true;
    player.hasStunAbility = true;

    const success = player.startStunPulse();
    expect(success).toBe(true);
    expect(player.hasStunAbility).toBe(false);
    expect(player.isPerformingStunPulse).toBe(true);
  });
});
```

### 2. Integration Tests

**GameManager Tests**:

```javascript
describe("Stun Orb Collection", () => {
  test("should handle stun orb collection by IT player", () => {
    gameManager.handlePlayerJoin(mockSocket, "ITPlayer");
    const player = gameManager.gameState.players.get(mockSocket.id);
    player.isIt = true;

    // Mock stun orb collision
    const mockStunOrb = {
      id: "test-stunorb",
      type: "stunOrb",
      x: player.x,
      y: player.y,
      active: true,
      radius: 15,
    };

    const originalCheck = gameManager.gameState.checkStunOrbCollision;
    gameManager.gameState.checkStunOrbCollision = jest.fn(() => mockStunOrb);

    gameManager.handlePlayerMove(mockSocket, { dx: 1, dy: 0 });

    const stunOrbEvent = mockIO.emitted.find(
      (e) => e.event === "stunOrbCollected"
    );
    expect(stunOrbEvent).toBeTruthy();
    expect(stunOrbEvent.data.onlyForIt).toBe(false);

    gameManager.gameState.checkStunOrbCollision = originalCheck;
  });
});
```

## Balancing Considerations

### 1. Power Level

**Stun Orb Availability**:

- Maximum 2 active stun orbs at any time
- 20-second respawn timer (longer than transparency)
- Only effective for IT players

**Stun Effect Limitations**:

- Short 500ms stun duration (enough for positioning, not guarantee)
- 3-second telegraph animation gives warning
- 80px radius is significant but not map-wide

### 2. Counterplay

**Positioning Strategy**:

- Players can spread out to minimize multi-stuns
- Visual telegraph allows for evasive movement
- Transparent players are still affected but harder to target

**Resource Management**:

- IT players must choose when to use limited stun orbs
- Cooldown prevents spam usage
- Power-up can be "wasted" if collected by non-IT players

## Future Expansions

### 1. Advanced Features

**Chain Lightning**:

- Stun effect jumps between nearby players
- Maximum 3 jumps with decreasing range
- Creates more dynamic area denial

**Stun Resistance**:

- Special power-up that provides temporary stun immunity
- 10-second duration, rare spawn rate
- Creates counter-meta gameplay

### 2. Achievement Integration

**Stun-Related Achievements**:

- "Thunder God": Stun 5 players with single pulse
- "Lightning Reflexes": Avoid 10 stun pulses in one match
- "Chain Reaction": Use stun ability 3 times as IT in one turn

### 3. Visual Polish

**Enhanced Effects**:

- Screen shake on stun pulse activation
- Particle system for electrical effects
- Dynamic lighting for stun pulse

**Animation Improvements**:

- Smooth expanding pulse animation
- Stunned player paralysis effects
- Electric afterglow on recently stunned players

This stunning power-up feature adds a new tactical dimension to the catch-me gameplay while maintaining balance through limited availability, clear counterplay options, and strategic resource management. The 500ms stun duration is sufficient to create opportunities without being overwhelming, and the visual telegraph provides fair warning to potential targets.
