const GameState = require("../../../server/game/GameState");
const Player = require("../../../server/game/Player");
const GameManager = require("../../../server/game/GameManager");

describe("Stun Orb System", () => {
  let gameState;
  let player1, player2, player3;

  beforeEach(() => {
    gameState = new GameState();
    player1 = new Player("player1", "Alice", 100, 100);
    player2 = new Player("player2", "Bob", 200, 200);
    player3 = new Player("player3", "Charlie", 300, 300);

    gameState.addPlayer(player1);
    gameState.addPlayer(player2);
    gameState.addPlayer(player3);
  });

  describe("Stun Orb Generation", () => {
    test("should generate 2 initial stun orbs", () => {
      expect(gameState.stunOrbs).toBeDefined();
      expect(gameState.stunOrbs.length).toBe(2);

      gameState.stunOrbs.forEach((stunOrb, index) => {
        expect(stunOrb.id).toBe(`stunorb_${index}`);
        expect(stunOrb.type).toBe("stunOrb");
        expect(stunOrb.radius).toBe(15);
        expect(stunOrb.active).toBe(true);
        expect(stunOrb.electricPhase).toBeDefined();
      });
    });

    test("should place stun orbs in safe positions", () => {
      gameState.stunOrbs.forEach((stunOrb) => {
        expect(stunOrb.x).toBeGreaterThanOrEqual(0);
        expect(stunOrb.y).toBeGreaterThanOrEqual(0);
        expect(stunOrb.x).toBeLessThanOrEqual(gameState.gameWidth);
        expect(stunOrb.y).toBeLessThanOrEqual(gameState.gameHeight);
      });
    });

    test("should include stun orbs in game state JSON", () => {
      const json = gameState.toJSON();
      expect(json.stunOrbs).toBeDefined();
      expect(json.stunOrbs.length).toBe(2);

      // Should only include active stun orbs
      json.stunOrbs.forEach((stunOrb) => {
        expect(stunOrb.active).toBe(true);
      });
    });
  });

  describe("Stun Orb Collection", () => {
    test("should detect stun orb collision when player is close enough", () => {
      const stunOrb = gameState.stunOrbs[0];

      // Position player close to stun orb
      player1.x = stunOrb.x;
      player1.y = stunOrb.y;

      const collectedStunOrb = gameState.checkStunOrbCollision(player1);
      expect(collectedStunOrb).toBeTruthy();
      expect(collectedStunOrb.id).toBe(stunOrb.id);
    });

    test("should not detect collision when player is far away", () => {
      const stunOrb = gameState.stunOrbs[0];

      // Position player far from stun orb
      player1.x = stunOrb.x + 100;
      player1.y = stunOrb.y + 100;

      const collectedStunOrb = gameState.checkStunOrbCollision(player1);
      expect(collectedStunOrb).toBeNull();
      expect(stunOrb.active).toBe(true);
    });

    test("should only grant stun ability to IT players", () => {
      const stunOrb = gameState.stunOrbs[0];
      player1.isIt = true;
      player2.isIt = false;

      // Position IT player close to stun orb
      player1.x = stunOrb.x;
      player1.y = stunOrb.y;

      const affectedPlayers1 = gameState.collectStunOrb(player1, stunOrb);
      expect(stunOrb.active).toBe(false);
      expect(player1.isPerformingStunPulse).toBe(true);
      expect(Array.isArray(affectedPlayers1)).toBe(true);

      // Reset stun orb for next test
      stunOrb.active = true;
      player1.isPerformingStunPulse = false;

      // Position non-IT player close to stun orb
      player2.x = stunOrb.x;
      player2.y = stunOrb.y;

      const affectedPlayers2 = gameState.collectStunOrb(player2, stunOrb);
      expect(stunOrb.active).toBe(false);
      expect(player2.isPerformingStunPulse).toBe(false);
      expect(affectedPlayers2).toEqual([]);
    });

    test("should set respawn timer when stun orb is collected", () => {
      const stunOrb = gameState.stunOrbs[0];

      // Position player close to stun orb
      player1.x = stunOrb.x;
      player1.y = stunOrb.y;
      player1.isIt = true;

      gameState.collectStunOrb(player1, stunOrb);

      expect(stunOrb.active).toBe(false);
      expect(gameState.stunOrbRespawnTimer.has(stunOrb.id)).toBe(true);
    });
  });

  describe("Stun Pulse Effect", () => {
    test("should stun players within pulse radius", () => {
      const itPlayer = player1;
      const nearPlayer = player2;
      const farPlayer = player3;

      // Set up positions
      itPlayer.x = 400;
      itPlayer.y = 300;
      itPlayer.isIt = true;

      nearPlayer.x = 450; // 50px away (within 80px radius)
      nearPlayer.y = 300;

      farPlayer.x = 600; // 200px away (outside 80px radius)
      farPlayer.y = 300;

      const affectedPlayers = gameState.executeStunPulse(itPlayer);

      expect(nearPlayer.isStunned).toBe(true);
      expect(farPlayer.isStunned).toBe(false);
      expect(affectedPlayers.length).toBe(1);
      expect(affectedPlayers[0].id).toBe(nearPlayer.id);
    });

    test("should not stun the IT player themselves", () => {
      const itPlayer = player1;
      itPlayer.x = 400;
      itPlayer.y = 300;
      itPlayer.isIt = true;

      const affectedPlayers = gameState.executeStunPulse(itPlayer);

      expect(itPlayer.isStunned).toBe(false);
      expect(affectedPlayers.find((p) => p.id === itPlayer.id)).toBeUndefined();
    });

    test("should stun multiple players within radius", () => {
      const itPlayer = player1;
      itPlayer.x = 400;
      itPlayer.y = 300;
      itPlayer.isIt = true;

      // Position both other players within range
      player2.x = 430;
      player2.y = 300;
      player3.x = 400;
      player3.y = 330;

      const affectedPlayers = gameState.executeStunPulse(itPlayer);

      expect(player2.isStunned).toBe(true);
      expect(player3.isStunned).toBe(true);
      expect(affectedPlayers.length).toBe(2);
    });
  });

  describe("Stun Orb Respawning", () => {
    test("should respawn stun orb after timer expires", () => {
      const stunOrb = gameState.stunOrbs[0];

      // Collect the stun orb
      player1.x = stunOrb.x;
      player1.y = stunOrb.y;
      player1.isIt = true;
      gameState.collectStunOrb(player1, stunOrb);

      expect(stunOrb.active).toBe(false);

      // Simulate time passing (20 seconds + 1ms)
      const futureTime = Date.now() + gameState.stunOrbRespawnInterval + 1;
      jest.spyOn(Date, "now").mockReturnValue(futureTime);

      // Update stun orbs (this should trigger respawn)
      gameState.updateStunOrbs();

      expect(stunOrb.active).toBe(true);
      expect(gameState.stunOrbRespawnTimer.has(stunOrb.id)).toBe(false);

      jest.restoreAllMocks();
    });

    test("should find safe position for respawn", () => {
      const safePosition = gameState.findSafeStunOrbPosition();

      expect(safePosition).toBeDefined();
      expect(safePosition.x).toBeGreaterThanOrEqual(0);
      expect(safePosition.y).toBeGreaterThanOrEqual(0);
      expect(safePosition.x).toBeLessThanOrEqual(gameState.gameWidth);
      expect(safePosition.y).toBeLessThanOrEqual(gameState.gameHeight);
    });
  });

  describe("Stun Orb Animation", () => {
    test("should update electrical animation phases", () => {
      const stunOrb = gameState.stunOrbs[0];
      const initialPhase = stunOrb.electricPhase;

      gameState.updateStunOrbs();

      expect(stunOrb.electricPhase).toBeGreaterThan(initialPhase);
    });

    test("should wrap electrical phase around 2π", () => {
      const stunOrb = gameState.stunOrbs[0];
      stunOrb.electricPhase = Math.PI * 2 + 0.1; // Slightly over 2π

      gameState.updateStunOrbs();

      expect(stunOrb.electricPhase).toBeLessThan(Math.PI * 2);
      expect(stunOrb.electricPhase).toBeGreaterThan(0);
    });
  });

  describe("Player Stun Pulse Methods", () => {
    test("should only allow stun pulse when IT", () => {
      player1.isIt = false;
      expect(player1.startStunPulse()).toBe(false);

      player1.isIt = true;
      expect(player1.startStunPulse()).toBe(true);
    });

    test("should prevent stun pulse during stun", () => {
      player1.isIt = true;
      player1.stun(500);
      expect(player1.startStunPulse()).toBe(false);
    });

    test("should prevent multiple simultaneous stun pulses", () => {
      player1.isIt = true;

      const success1 = player1.startStunPulse();
      expect(success1).toBe(true);
      expect(player1.isPerformingStunPulse).toBe(true);

      const success2 = player1.startStunPulse();
      expect(success2).toBe(false);
    });

    test("should end stun pulse after duration", () => {
      player1.isIt = true;
      player1.startStunPulse();

      expect(player1.isPerformingStunPulse).toBe(true);

      // Simulate time passing (3 seconds + 1ms)
      const futureTime = Date.now() + player1.stunPulseDuration + 1;
      player1.updateStunPulse(futureTime);

      expect(player1.isPerformingStunPulse).toBe(false);
      expect(player1.stunPulseStartTime).toBe(0);
    });

    test("should include stun pulse state in player JSON", () => {
      player1.isIt = true;
      player1.startStunPulse();

      const json = player1.toJSON();
      expect(json.isPerformingStunPulse).toBe(true);
      expect(json.stunPulseStartTime).toBeDefined();
    });
  });
});
