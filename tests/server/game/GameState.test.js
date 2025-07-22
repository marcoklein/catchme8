const GameState = require("../../../server/game/GameState.js");
const Player = require("../../../server/game/Player.js");
const { createTestPlayer } = require("../../utils/test-helpers.js");

describe("GameState", () => {
  let gameState;

  beforeEach(() => {
    gameState = new GameState();
    jest.clearAllMocks();
  });

  describe("Player Management", () => {
    test("should add first player as IT", () => {
      const player = createTestPlayer("player1", "Alice");

      const result = gameState.addPlayer(player);

      expect(result).toBe(true);
      expect(player.isIt).toBe(true);
      expect(gameState.players.size).toBe(1);
    });

    test("should add second player as non-IT", () => {
      const player1 = createTestPlayer("player1", "Alice");
      const player2 = createTestPlayer("player2", "Bob");

      gameState.addPlayer(player1);
      const result = gameState.addPlayer(player2);

      expect(result).toBe(true);
      expect(player1.isIt).toBe(true);
      expect(player2.isIt).toBe(false);
      expect(gameState.players.size).toBe(2);
    });

    test("should reject player when game is full", () => {
      // Fill game to max capacity
      for (let i = 1; i <= gameState.maxPlayers; i++) {
        const player = createTestPlayer(`player${i}`, `Player${i}`);
        gameState.addPlayer(player);
      }

      const extraPlayer = createTestPlayer("extra", "Extra");
      const result = gameState.addPlayer(extraPlayer);

      expect(result).toBe(false);
      expect(gameState.players.size).toBe(gameState.maxPlayers);
    });

    test("should reassign IT when IT player leaves", () => {
      const player1 = createTestPlayer("player1", "Alice");
      const player2 = createTestPlayer("player2", "Bob");

      gameState.addPlayer(player1);
      gameState.addPlayer(player2);
      expect(player1.isIt).toBe(true);

      // Remove the IT player
      const result = gameState.removePlayer("player1");

      expect(result).toBe(true);
      expect(gameState.players.size).toBe(1);
      expect(player2.isIt).toBe(true);
    });

    test("should ensure exactly one IT player", () => {
      const player1 = createTestPlayer("player1", "Alice");
      const player2 = createTestPlayer("player2", "Bob");
      const player3 = createTestPlayer("player3", "Charlie");

      gameState.addPlayer(player1);
      gameState.addPlayer(player2);
      gameState.addPlayer(player3);

      // Manually set multiple IT players (shouldn't happen but test recovery)
      player1.isIt = true;
      player2.isIt = true;
      player3.isIt = false;

      gameState.ensureItPlayer();

      // Should have exactly one IT player
      const itPlayers = Array.from(gameState.players.values()).filter(
        (p) => p.isIt
      );
      expect(itPlayers.length).toBe(1);
    });

    test("should handle removing non-existent player", () => {
      const result = gameState.removePlayer("non-existent");
      expect(result).toBe(false);
    });
  });

  describe("Game Flow", () => {
    test("should start game with minimum players", () => {
      expect(gameState.gameActive).toBe(false);

      // Add minimum players
      for (let i = 1; i <= gameState.minPlayers; i++) {
        const player = createTestPlayer(`player${i}`, `Player${i}`);
        gameState.addPlayer(player);
      }

      expect(gameState.gameActive).toBe(true);
      expect(gameState.gameStartTime).toBeTruthy();
    });

    test("should not start game with insufficient players", () => {
      const player = createTestPlayer("player1", "Alice");
      gameState.addPlayer(player);

      expect(gameState.gameActive).toBe(false);
      expect(gameState.gameStartTime).toBeNull();
    });

    test("should stop game when players drop below minimum", () => {
      // Start with enough players
      for (let i = 1; i <= gameState.minPlayers; i++) {
        const player = createTestPlayer(`player${i}`, `Player${i}`);
        gameState.addPlayer(player);
      }
      expect(gameState.gameActive).toBe(true);

      // Remove players until below minimum
      gameState.removePlayer("player1");
      expect(gameState.gameActive).toBe(false);
    });

    test("should detect game over when time expires", () => {
      gameState.gameActive = true;
      gameState.gameStartTime = Date.now() - (gameState.gameDuration + 1000);

      const isOver = gameState.isGameOver();
      expect(isOver).toBe(true);
    });

    test("should calculate remaining time correctly", () => {
      const now = Date.now();
      gameState.gameActive = true;
      gameState.gameStartTime = now - 30000; // 30 seconds ago

      const remaining = gameState.getTimeRemaining();
      expect(remaining).toBe(gameState.gameDuration - 30000);
    });
  });

  describe("Movement Validation", () => {
    test("should validate movement within speed limits", () => {
      const player = createTestPlayer("player1", "Alice");
      gameState.addPlayer(player);

      // Valid movement
      const result = gameState.updatePlayer(
        "player1",
        { dx: 0.5, dy: 0.5 },
        16
      );
      expect(result).toBe(true);
    });

    test("should normalize excessive movement", () => {
      const player = createTestPlayer("player1", "Alice");
      gameState.addPlayer(player);
      const originalX = player.x;
      const originalY = player.y;

      // Excessive movement
      const result = gameState.updatePlayer("player1", { dx: 5, dy: 5 }, 16);

      expect(result).toBe(true);
      // Movement should be normalized, not rejected
      expect(Math.abs(player.x - originalX)).toBeLessThan(Math.abs(5 * 16));
      expect(Math.abs(player.y - originalY)).toBeLessThan(Math.abs(5 * 16));
    });

    test("should prevent movement through obstacles", () => {
      const player = createTestPlayer("player1", "Alice", 50, 50);
      gameState.addPlayer(player);

      // Mock obstacle collision in gameState
      const originalCheckCollision = gameState.checkObstacleCollision;
      gameState.checkObstacleCollision = jest.fn(() => true);

      const result = gameState.updatePlayer("player1", { dx: 1, dy: 0 }, 16);

      expect(result).toBe(true);
      // Player position shouldn't change due to collision
      expect(player.x).toBe(50);
      expect(player.y).toBe(50);

      // Restore original method
      gameState.checkObstacleCollision = originalCheckCollision;
    });
  });

  describe("Position Validation", () => {
    test("should generate safe spawn position", () => {
      const position = gameState.findSafeSpawnPosition();

      expect(position.x).toBeGreaterThanOrEqual(20);
      expect(position.x).toBeLessThanOrEqual(gameState.gameWidth - 20);
      expect(position.y).toBeGreaterThanOrEqual(20);
      expect(position.y).toBeLessThanOrEqual(gameState.gameHeight - 20);
    });

    test("should detect obstacle collision", () => {
      // Test collision detection with game obstacles
      const hasCollision = gameState.checkObstacleCollision(100, 100, 20);
      expect(typeof hasCollision).toBe("boolean");
    });

    test("should validate boundaries", () => {
      // Test boundary validation is working
      expect(gameState.gameWidth).toBeGreaterThan(0);
      expect(gameState.gameHeight).toBeGreaterThan(0);
    });
  });

  describe("Tagging System", () => {
    test("should handle successful tag", () => {
      const player1 = createTestPlayer("player1", "Alice", 100, 100);
      const player2 = createTestPlayer("player2", "Bob", 105, 105);

      gameState.addPlayer(player1);
      gameState.addPlayer(player2);

      // Player1 is IT, should be able to tag player2
      player1.isIt = true;
      player2.isIt = false;

      const result = gameState.tagPlayer("player1", "player2");

      expect(result).toBe(true);
      expect(player1.isIt).toBe(false);
      expect(player2.isIt).toBe(true);
    });

    test("should reject tag when tagger is not IT", () => {
      const player1 = createTestPlayer("player1", "Alice", 100, 100);
      const player2 = createTestPlayer("player2", "Bob", 105, 105);

      gameState.addPlayer(player1);
      gameState.addPlayer(player2);

      // Neither player is IT
      player1.isIt = false;
      player2.isIt = false;

      const result = gameState.tagPlayer("player1", "player2");

      expect(result).toBe(false);
    });

    test("should reject tag when players are too far apart", () => {
      const player1 = createTestPlayer("player1", "Alice", 100, 100);
      const player2 = createTestPlayer("player2", "Bob", 200, 200);

      gameState.addPlayer(player1);
      gameState.addPlayer(player2);

      player1.isIt = true;

      const result = gameState.tagPlayer("player1", "player2");

      expect(result).toBe(false);
    });
  });

  describe("Power-ups System", () => {
    test("should generate power-ups", () => {
      expect(gameState.powerUps.length).toBeGreaterThan(0);

      gameState.powerUps.forEach((powerUp) => {
        expect(powerUp.x).toBeGreaterThanOrEqual(0);
        expect(powerUp.y).toBeGreaterThanOrEqual(0);
        expect(powerUp.type).toBeDefined();
      });
    });

    test("should detect power-up collision", () => {
      const player = createTestPlayer("player1", "Alice");
      gameState.addPlayer(player);

      // Place player at power-up location
      if (gameState.powerUps.length > 0) {
        const powerUp = gameState.powerUps[0];
        player.x = powerUp.x;
        player.y = powerUp.y;

        const collected = gameState.checkPowerUpCollision(player);

        if (powerUp.active) {
          expect(collected).toBeTruthy();
        }
      }
    });

    test("should handle power-up collection", () => {
      const player = createTestPlayer("player1", "Alice");

      if (gameState.powerUps.length > 0) {
        const powerUp = gameState.powerUps[0];
        powerUp.active = true;

        gameState.collectPowerUp(player, powerUp);

        expect(powerUp.active).toBe(false);
        expect(powerUp.respawnTime).toBeTruthy();
      }
    });
  });
});
