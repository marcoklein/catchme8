const GameState = require("../../../server/game/GameState");
const Player = require("../../../server/game/Player");
const GameManager = require("../../../server/game/GameManager");

describe("Points System", () => {
  let gameState;
  let player1, player2;

  beforeEach(() => {
    gameState = new GameState();
    player1 = new Player("player1", "Alice", 100, 100);
    player2 = new Player("player2", "Bob", 200, 200);

    gameState.addPlayer(player1);
    gameState.addPlayer(player2);
  });

  describe("Player Points Properties", () => {
    test("should initialize with score 0", () => {
      expect(player1.score).toBe(0);
      expect(player2.score).toBe(0);
    });

    test("should initialize with points tracking properties", () => {
      // Create a player without adding to game state to test initial state
      const testPlayer = new Player("test", "Test", 50, 50);
      expect(testPlayer.totalSuccessfulTags).toBe(0);
      expect(testPlayer.timeAsIt).toBe(0);
      expect(testPlayer.becameItTime).toBeNull();
      expect(testPlayer.lastPointDeduction).toBeNull();
    });
  });

  describe("IT Status Management", () => {
    test("should set becameItTime when becoming IT", () => {
      const beforeTime = Date.now();
      player1.becomeIt();
      const afterTime = Date.now();

      expect(player1.isIt).toBe(true);
      expect(player1.becameItTime).toBeGreaterThanOrEqual(beforeTime);
      expect(player1.becameItTime).toBeLessThanOrEqual(afterTime);
    });

    test("should track time as IT when stopping being IT", () => {
      const testPlayer = new Player("test", "Test", 50, 50);
      const startTime = Date.now();
      testPlayer.becomeIt();

      // Simulate being IT for 1 second by manually setting becameItTime
      testPlayer.becameItTime = startTime - 1000;

      testPlayer.stopBeingIt();

      expect(testPlayer.isIt).toBe(false);
      expect(testPlayer.becameItTime).toBeNull();
      expect(testPlayer.timeAsIt).toBeGreaterThanOrEqual(1000);
    });
  });

  describe("Points Awarding and Deduction", () => {
    test("should award 100 points for successful tag", () => {
      expect(player1.score).toBe(0);
      player1.awardTagPoints();
      expect(player1.score).toBe(100);
      expect(player1.totalSuccessfulTags).toBe(1);
    });

    test("should deduct points correctly", () => {
      player1.score = 150;
      player1.deductItPoints(30);
      expect(player1.score).toBe(120);
    });

    test("should not allow score to go below 0", () => {
      player1.score = 20;
      player1.deductItPoints(50);
      expect(player1.score).toBe(0);
    });
  });

  describe("Tag Player Integration", () => {
    test("should award points and transfer IT status when tagging", () => {
      // Make player1 IT
      player1.becomeIt();
      expect(player1.isIt).toBe(true);
      expect(player2.isIt).toBe(false);

      // Position players close to each other for tag
      player1.x = 100;
      player1.y = 100;
      player2.x = 105;
      player2.y = 105;

      // Mock canCatch to return true
      jest.spyOn(player1, "canCatch").mockReturnValue(true);

      // Perform tag
      const tagSuccess = gameState.tagPlayer("player1", "player2");

      expect(tagSuccess).toBe(true);
      expect(player1.isIt).toBe(false);
      expect(player2.isIt).toBe(true);
      expect(player1.score).toBe(100); // +100 for successful tag
      expect(player1.totalSuccessfulTags).toBe(1);

      jest.restoreAllMocks();
    });
  });

  describe("JSON Serialization", () => {
    test("should include score in JSON output", () => {
      player1.score = 250;
      const json = player1.toJSON();

      expect(json).toHaveProperty("score", 250);
      expect(json).toHaveProperty("id", "player1");
      expect(json).toHaveProperty("name", "Alice");
    });
  });
});
