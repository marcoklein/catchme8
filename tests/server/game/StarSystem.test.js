const GameState = require("../../../server/game/GameState");
const Player = require("../../../server/game/Player");
const GameManager = require("../../../server/game/GameManager");

describe("Star Collection System", () => {
  let gameState;
  let player1, player2;

  beforeEach(() => {
    gameState = new GameState();
    player1 = new Player("player1", "Alice", 100, 100);
    player2 = new Player("player2", "Bob", 200, 200);

    gameState.addPlayer(player1);
    gameState.addPlayer(player2);
  });

  describe("Star Generation", () => {
    test("should generate 3 initial stars", () => {
      expect(gameState.stars).toBeDefined();
      expect(gameState.stars.length).toBe(3);

      gameState.stars.forEach((star, index) => {
        expect(star.id).toBe(`star_${index}`);
        expect(star.type).toBe("star");
        expect(star.radius).toBe(12);
        expect(star.active).toBe(true);
        expect(star.rotationAngle).toBeDefined();
      });
    });

    test("should include stars in game state JSON", () => {
      const json = gameState.toJSON();
      expect(json.stars).toBeDefined();
      expect(json.stars.length).toBe(3);

      // Should only include active stars
      json.stars.forEach((star) => {
        expect(star.active).toBe(true);
      });
    });
  });

  describe("Star Collection", () => {
    test("should detect star collision when player is close enough", () => {
      const star = gameState.stars[0];

      // Position player close to star
      player1.x = star.x;
      player1.y = star.y;

      const collectedStar = gameState.checkStarCollision(player1);
      expect(collectedStar).toBeTruthy();
      expect(collectedStar.id).toBe(star.id);
      expect(star.active).toBe(false);
    });

    test("should not detect collision when player is far away", () => {
      const star = gameState.stars[0];

      // Position player far from star
      player1.x = star.x + 100;
      player1.y = star.y + 100;

      const collectedStar = gameState.checkStarCollision(player1);
      expect(collectedStar).toBeNull();
      expect(star.active).toBe(true);
    });

    test("should award correct points for non-IT player", () => {
      const star = gameState.stars[0];
      player1.isIt = false;

      // Position player close to star
      player1.x = star.x;
      player1.y = star.y;

      const initialScore = player1.score;
      gameState.checkStarCollision(player1);

      expect(player1.score).toBe(initialScore + 25);
      expect(player1.totalStarsCollected).toBe(1);
    });

    test("should award double points for IT player", () => {
      const star = gameState.stars[0];
      player1.becomeIt();

      // Position player close to star
      player1.x = star.x;
      player1.y = star.y;

      const initialScore = player1.score;
      gameState.checkStarCollision(player1);

      expect(player1.score).toBe(initialScore + 50);
      expect(player1.totalStarsCollected).toBe(1);
    });

    test("should set respawn timer when star is collected", () => {
      const star = gameState.stars[0];

      // Position player close to star
      player1.x = star.x;
      player1.y = star.y;

      gameState.checkStarCollision(player1);

      expect(star.active).toBe(false);
      expect(gameState.starRespawnTimer.has(star.id)).toBe(true);
    });
  });

  describe("Star Respawning", () => {
    test("should respawn star after timer expires", () => {
      const star = gameState.stars[0];

      // Collect the star
      player1.x = star.x;
      player1.y = star.y;
      gameState.checkStarCollision(player1);

      expect(star.active).toBe(false);

      // Simulate time passing (8 seconds + 1ms)
      const futureTime = Date.now() + gameState.starRespawnInterval + 1;
      jest.spyOn(Date, "now").mockReturnValue(futureTime);

      // Update stars (this should trigger respawn)
      gameState.updateStars();

      expect(star.active).toBe(true);
      expect(gameState.starRespawnTimer.has(star.id)).toBe(false);

      jest.restoreAllMocks();
    });

    test("should find safe position for respawn", () => {
      const safePosition = gameState.findSafeStarPosition();

      expect(safePosition).toBeDefined();
      expect(safePosition.x).toBeGreaterThanOrEqual(0);
      expect(safePosition.y).toBeGreaterThanOrEqual(0);
      expect(safePosition.x).toBeLessThanOrEqual(gameState.gameWidth);
      expect(safePosition.y).toBeLessThanOrEqual(gameState.gameHeight);
    });
  });

  describe("Star Animation", () => {
    test("should update star rotation angles", () => {
      const star = gameState.stars[0];
      const initialRotation = star.rotationAngle;

      gameState.updateStars();

      expect(star.rotationAngle).toBeGreaterThan(initialRotation);
    });

    test("should wrap rotation angle around 2π", () => {
      const star = gameState.stars[0];
      star.rotationAngle = Math.PI * 2 + 0.1; // Slightly over 2π

      gameState.updateStars();

      expect(star.rotationAngle).toBeLessThan(Math.PI * 2);
      expect(star.rotationAngle).toBeGreaterThan(0);
    });
  });

  describe("Player Star Points Method", () => {
    test("should return correct points for non-IT player", () => {
      player1.isIt = false;
      const points = player1.awardStarPoints();

      expect(points).toBe(25);
      expect(player1.score).toBe(25);
      expect(player1.totalStarsCollected).toBe(1);
    });

    test("should return correct points for IT player", () => {
      player1.becomeIt();
      const points = player1.awardStarPoints();

      expect(points).toBe(50);
      expect(player1.score).toBe(50);
      expect(player1.totalStarsCollected).toBe(1);
    });
  });

  describe("Game Balance", () => {
    test("IT player star collection should offset point loss", () => {
      player1.becomeIt();
      const initialScore = 100;
      player1.score = initialScore;

      // Simulate being IT for 5 seconds (50 points lost)
      player1.deductItPoints(50);
      expect(player1.score).toBe(50);

      // Collect a star (50 points gained for IT player)
      player1.awardStarPoints();
      expect(player1.score).toBe(100); // Back to original score
    });

    test("non-IT player needs 4 stars to equal one successful tag", () => {
      player1.isIt = false;
      const initialScore = 0;

      // Collect 4 stars
      for (let i = 0; i < 4; i++) {
        player1.awardStarPoints();
      }

      expect(player1.score).toBe(100); // Same as one successful tag
      expect(player1.totalStarsCollected).toBe(4);
    });
  });
});
