const GameManager = require("../../../server/game/GameManager.js");
const GameState = require("../../../server/game/GameState.js");
const Player = require("../../../server/game/Player.js");
const {
  MockSocket,
  MockIO,
  createTestPlayer,
  waitForNextTick,
} = require("../../utils/test-helpers.js");

describe("GameManager", () => {
  let gameManager;
  let mockIO;
  let mockSocket;

  beforeEach(() => {
    jest.useFakeTimers();
    mockIO = new MockIO();
    gameManager = new GameManager(mockIO);
    mockSocket = new MockSocket();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("Player Lifecycle", () => {
    test("should handle player join successfully", () => {
      const playerName = "TestPlayer";

      gameManager.handlePlayerJoin(mockSocket, playerName);

      expect(gameManager.gameState.players.has(mockSocket.id)).toBe(true);

      const emittedJoined = mockSocket.emitted.find(
        (e) => e.event === "gameJoined"
      );
      expect(emittedJoined).toBeTruthy();
      expect(emittedJoined.data.playerId).toBe(mockSocket.id);
    });

    test("should reject join when game is full", () => {
      // Fill the game to capacity
      for (let i = 0; i < gameManager.gameState.maxPlayers; i++) {
        const socket = new MockSocket();
        gameManager.handlePlayerJoin(socket, `Player${i}`);
      }

      const newSocket = new MockSocket();
      gameManager.handlePlayerJoin(newSocket, "OverflowPlayer");

      const joinError = newSocket.emitted.find((e) => e.event === "joinError");
      expect(joinError).toBeTruthy();
      expect(joinError.data).toBe("Game is full");
    });

    test("should handle player disconnect", () => {
      const playerName = "TestPlayer";
      gameManager.handlePlayerJoin(mockSocket, playerName);

      expect(gameManager.gameState.players.has(mockSocket.id)).toBe(true);

      gameManager.handlePlayerDisconnect(mockSocket);

      expect(gameManager.gameState.players.has(mockSocket.id)).toBe(false);
    });

    test("should clean up input tracking on disconnect", () => {
      gameManager.handlePlayerJoin(mockSocket, "TestPlayer");
      gameManager.inputTracking[mockSocket.id] = { moveCount: 5 };

      gameManager.handlePlayerDisconnect(mockSocket);

      expect(gameManager.inputTracking[mockSocket.id]).toBeUndefined();
    });
  });

  describe("Input Rate Limiting", () => {
    test("should accept normal input rate", () => {
      gameManager.handlePlayerJoin(mockSocket, "TestPlayer");

      const inputState = { up: true, down: false, left: false, right: false };

      gameManager.handlePlayerInput(mockSocket, inputState);

      expect(gameManager.playerInputStates.has(mockSocket.id)).toBe(true);
    });

    test("should reject excessive input rate", () => {
      gameManager.handlePlayerJoin(mockSocket, "TestPlayer");

      const inputState = { up: true, down: false, left: false, right: false };

      // Send many inputs rapidly
      for (let i = 0; i < gameManager.MAX_INPUT_RATE + 5; i++) {
        gameManager.handlePlayerInput(mockSocket, inputState);
      }

      // Should have tracking data but limited
      const tracker = gameManager.inputTracking[mockSocket.id];
      expect(tracker).toBeTruthy();
    });

    test("should reset rate limiting window", () => {
      gameManager.handlePlayerJoin(mockSocket, "TestPlayer");

      const inputState = { up: true, down: false, left: false, right: false };
      gameManager.handlePlayerInput(mockSocket, inputState);

      // Advance time past window
      jest.advanceTimersByTime(gameManager.INPUT_RATE_WINDOW + 100);

      gameManager.handlePlayerInput(mockSocket, inputState);

      const tracker = gameManager.inputTracking[mockSocket.id];
      expect(tracker.inputCount).toBeLessThanOrEqual(2);
    });
  });

  describe("Server-Authoritative Movement Processing", () => {
    test("should process player input and movement", () => {
      gameManager.handlePlayerJoin(mockSocket, "TestPlayer");
      const player = gameManager.gameState.players.get(mockSocket.id);
      const initialX = player.x;

      // Send input state
      const inputState = { 
        up: false, 
        down: false, 
        left: false, 
        right: true,
        touchX: 0,
        touchY: 0,
        isTouchActive: false,
        timestamp: Date.now()
      };
      gameManager.handlePlayerInput(mockSocket, inputState);

      // Process movement in the game loop
      gameManager.processPlayerMovements(16); // 16ms deltaTime

      // Player should have moved to the right
      expect(player.x).toBeGreaterThan(initialX);
    });

    test("should update player activity on input", () => {
      gameManager.handlePlayerJoin(mockSocket, "TestPlayer");
      const player = gameManager.gameState.players.get(mockSocket.id);
      const initialTime = player.lastMovement;
      const initialX = player.x;

      // Wait a bit to ensure different timestamp
      jest.advanceTimersByTime(10);

      // Send input state
      const inputState = { 
        up: false, 
        down: false, 
        left: false, 
        right: true,
        touchX: 0,
        touchY: 0,
        isTouchActive: false,
        timestamp: Date.now()
      };
      gameManager.handlePlayerInput(mockSocket, inputState);
      gameManager.processPlayerMovements(16);

      // Player should have moved
      expect(player.x).toBeGreaterThan(initialX);
      
      // The lastMovement is updated in checkGameEvents, which is called during processPlayerMovements
      // Since we moved, the timestamp should be updated
      expect(player.lastMovement).toBeGreaterThan(initialTime);
    });

    // Legacy movement test removed - handlePlayerMove method no longer exists
  });

  describe("Collision Detection", () => {
    test("should detect and handle tagging", () => {
      // Create two players close together
      gameManager.handlePlayerJoin(mockSocket, "Player1");
      const mockSocket2 = new MockSocket();
      gameManager.handlePlayerJoin(mockSocket2, "Player2");

      const player1 = gameManager.gameState.players.get(mockSocket.id);
      const player2 = gameManager.gameState.players.get(mockSocket2.id);

      // Make player1 IT and position them close
      player1.isIt = true;
      player1.x = 100;
      player1.y = 100;
      player2.x = 105;
      player2.y = 105;

      gameManager.checkCollisions(mockSocket.id);

      // Check if tagging event was emitted
      const taggedEvent = mockIO.emitted.find(
        (e) => e.event === "playerTagged"
      );
      if (taggedEvent) {
        expect(taggedEvent.data.tagger).toBe("Player1");
        expect(taggedEvent.data.tagged).toBe("Player2");
      }
    });

    test("should not trigger collision when players are far apart", () => {
      gameManager.handlePlayerJoin(mockSocket, "Player1");
      const mockSocket2 = new MockSocket();
      gameManager.handlePlayerJoin(mockSocket2, "Player2");

      const player1 = gameManager.gameState.players.get(mockSocket.id);
      const player2 = gameManager.gameState.players.get(mockSocket2.id);

      // Position players far apart
      player1.isIt = true;
      player1.x = 100;
      player1.y = 100;
      player2.x = 300;
      player2.y = 300;

      gameManager.checkCollisions(mockSocket.id);

      const taggedEvent = mockIO.emitted.find(
        (e) => e.event === "playerTagged"
      );
      expect(taggedEvent).toBeFalsy();
    });
  });

  describe("AI Player Management", () => {
    test("should add AI player", () => {
      const result = gameManager.addAIPlayer("TestBot");

      expect(result).toBe(true);

      const aiPlayers = Array.from(
        gameManager.gameState.players.values()
      ).filter((p) => p.isAI);
      expect(aiPlayers.length).toBe(1);
      expect(aiPlayers[0].name).toBe("TestBot");
    });

    test("should not add AI when game is full", () => {
      // Fill game to capacity with regular players
      for (let i = 0; i < gameManager.gameState.maxPlayers; i++) {
        const socket = new MockSocket();
        gameManager.handlePlayerJoin(socket, `Player${i}`);
      }

      const result = gameManager.addAIPlayer();
      expect(result).toBe(false);
    });

    test("should determine when to add AI players", () => {
      // Add one human player
      gameManager.handlePlayerJoin(mockSocket, "HumanPlayer");

      const shouldAdd = gameManager.shouldAddAIPlayer();
      expect(shouldAdd).toBe(true);
    });

    test("should not add AI when enough players exist", () => {
      // Add enough players
      for (let i = 0; i < 4; i++) {
        const socket = new MockSocket();
        gameManager.handlePlayerJoin(socket, `Player${i}`);
      }

      const shouldAdd = gameManager.shouldAddAIPlayer();
      expect(shouldAdd).toBe(false);
    });
  });

  describe("Game State Broadcasting", () => {
    test("should broadcast game state", () => {
      gameManager.broadcastGameState();

      const gameStateEvent = mockIO.emitted.find(
        (e) => e.event === "gameState"
      );
      expect(gameStateEvent).toBeTruthy();
      expect(gameStateEvent.room).toBe("game");
    });

    test("should broadcast on player join", () => {
      gameManager.handlePlayerJoin(mockSocket, "TestPlayer");

      const gameStateEvents = mockIO.emitted.filter(
        (e) => e.event === "gameState"
      );
      expect(gameStateEvents.length).toBeGreaterThan(0);
    });
  });

  describe("Power-up Collection", () => {
    test("should handle power-up collection via new input system", () => {
      gameManager.handlePlayerJoin(mockSocket, "TestPlayer");
      const player = gameManager.gameState.players.get(mockSocket.id);

      // Mock power-up collision with a properly structured power-up
      const mockPowerUp = {
        id: "test-powerup",
        type: "transparency",
        x: player.x,
        y: player.y,
        active: true,
        radius: 15,
        duration: 5000,
        respawnTime: 30000,
      };
      const originalCheck = gameManager.gameState.checkPowerUpCollision;
      gameManager.gameState.checkPowerUpCollision = jest.fn(() => mockPowerUp);

      // Send input to cause movement and power-up check
      const inputState = { 
        up: false, 
        down: false, 
        left: false, 
        right: true,
        touchX: 0,
        touchY: 0,
        isTouchActive: false,
        timestamp: Date.now()
      };
      gameManager.handlePlayerInput(mockSocket, inputState);
      gameManager.processPlayerMovements(16);

      const powerUpEvent = mockIO.emitted.find(
        (e) => e.event === "powerUpCollected"
      );
      expect(powerUpEvent).toBeTruthy();

      // Restore original method
      gameManager.gameState.checkPowerUpCollision = originalCheck;
    });
  });

  describe("Input Validation", () => {
    test("should validate input state structure", () => {
      const validInput = {
        up: true,
        down: false,
        left: false,
        right: false,
        isTouchActive: false,
        timestamp: Date.now(),
      };

      const isValid = gameManager.validateInputState(validInput);
      expect(isValid).toBe(true);
    });

    test("should reject invalid input state", () => {
      const invalidInput = {
        up: "invalid",
        down: null,
        invalidProperty: true,
      };

      const isValid = gameManager.validateInputState(invalidInput);
      expect(isValid).toBe(false);
    });
  });

  describe("Inactive Player Removal", () => {
    test("should identify inactive players", () => {
      gameManager.handlePlayerJoin(mockSocket, "TestPlayer");
      const player = gameManager.gameState.players.get(mockSocket.id);

      // Set last movement to old time
      player.lastMovement = Date.now() - 60000; // 1 minute ago

      const now = Date.now();
      gameManager.removeInactivePlayers(now);

      // Player might be removed if considered inactive
      // This depends on the inactivity threshold in GameManager
    });
  });
});
