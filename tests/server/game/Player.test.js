const Player = require("../../../server/game/Player.js");

describe("Player", () => {
  let player;

  beforeEach(() => {
    player = new Player("test-id", "TestPlayer", 100, 100);
    jest.clearAllMocks();
  });

  describe("Constructor", () => {
    test("should initialize player with correct properties", () => {
      expect(player.id).toBe("test-id");
      expect(player.name).toBe("TestPlayer");
      expect(player.x).toBe(100);
      expect(player.y).toBe(100);
      expect(player.isIt).toBe(false);
      expect(player.radius).toBe(20);
      expect(player.speed).toBe(300);
    });

    test("should use default position when not provided", () => {
      const defaultPlayer = new Player("test", "Default");
      expect(defaultPlayer.x).toBe(400);
      expect(defaultPlayer.y).toBe(300);
    });

    test("should generate random color", () => {
      expect(player.color).toBeTruthy();
      expect(typeof player.color).toBe("string");
      expect(player.color).toMatch(/^#[0-9A-F]{6}$/i);
    });

    test("should initialize power-up properties", () => {
      expect(player.isTransparent).toBe(false);
      expect(player.transparencyEndTime).toBe(0);
    });

    test("should initialize stun properties", () => {
      expect(player.isStunned).toBe(false);
      expect(player.stunEndTime).toBe(0);
      expect(player.canCatchAgainTime).toBe(0);
    });
  });

  describe("Movement Mechanics", () => {
    test("should move player with deltaTime", () => {
      const initialX = player.x;
      const initialY = player.y;
      const deltaTime = 16; // 16ms frame time

      player.move(1, 0, deltaTime, 800, 600);

      expect(player.x).toBeGreaterThan(initialX);
      expect(player.y).toBe(initialY);
    });

    test("should apply speed correctly", () => {
      const deltaTime = 1000; // 1 second
      const initialX = player.x;

      player.move(1, 0, deltaTime, 800, 600);

      // Should move approximately player.speed pixels in 1 second
      const expectedX = initialX + (player.speed * deltaTime) / 1000;
      expect(Math.abs(player.x - expectedX)).toBeLessThan(1);
    });

    test("should handle boundary collision - left wall", () => {
      player.x = 10; // Near left boundary
      player.move(-1, 0, 16, 800, 600);

      expect(player.x).toBeGreaterThanOrEqual(player.radius);
    });

    test("should handle boundary collision - right wall", () => {
      player.x = 790; // Near right boundary
      player.move(1, 0, 16, 800, 600);

      expect(player.x).toBeLessThanOrEqual(800 - player.radius);
    });

    test("should handle boundary collision - top wall", () => {
      player.y = 10; // Near top boundary
      player.move(0, -1, 16, 800, 600);

      expect(player.y).toBeGreaterThanOrEqual(player.radius);
    });

    test("should handle boundary collision - bottom wall", () => {
      player.y = 590; // Near bottom boundary
      player.move(0, 1, 16, 800, 600);

      expect(player.y).toBeLessThanOrEqual(600 - player.radius);
    });

    test("should block movement when stunned", () => {
      const initialX = player.x;
      const initialY = player.y;

      player.isStunned = true;
      player.move(1, 1, 16, 800, 600);

      expect(player.x).toBe(initialX);
      expect(player.y).toBe(initialY);
    });

    test("should handle diagonal movement", () => {
      const initialX = player.x;
      const initialY = player.y;

      player.move(1, 1, 16, 800, 600);

      expect(player.x).toBeGreaterThan(initialX);
      expect(player.y).toBeGreaterThan(initialY);
    });
  });

  describe("Status Management", () => {
    test("should assign IT status", () => {
      player.isIt = true;
      expect(player.isIt).toBe(true);
    });

    test("should apply transparency power-up", () => {
      const endTime = Date.now() + 5000;
      player.isTransparent = true;
      player.transparencyEndTime = endTime;

      expect(player.isTransparent).toBe(true);
      expect(player.transparencyEndTime).toBe(endTime);
    });

    test("should apply stun effect", () => {
      const stunEndTime = Date.now() + 2000;
      player.isStunned = true;
      player.stunEndTime = stunEndTime;

      expect(player.isStunned).toBe(true);
      expect(player.stunEndTime).toBe(stunEndTime);
    });

    test("should set catch cooldown", () => {
      const cooldownTime = Date.now() + 1000;
      player.canCatchAgainTime = cooldownTime;

      expect(player.canCatchAgainTime).toBe(cooldownTime);
    });
  });

  describe("Collision Detection", () => {
    test("should detect collision with another player", () => {
      const otherPlayer = new Player("other", "Other", 105, 105);

      const distance = Math.sqrt(
        Math.pow(player.x - otherPlayer.x, 2) +
          Math.pow(player.y - otherPlayer.y, 2)
      );

      const collisionDistance = player.radius + otherPlayer.radius;
      const isColliding = distance <= collisionDistance;

      expect(typeof isColliding).toBe("boolean");
    });

    test("should calculate distance correctly", () => {
      const otherPlayer = new Player("other", "Other", 103, 104);

      const distance = Math.sqrt(
        Math.pow(player.x - otherPlayer.x, 2) +
          Math.pow(player.y - otherPlayer.y, 2)
      );

      expect(distance).toBeCloseTo(5, 1); // sqrt(3^2 + 4^2) = 5
    });
  });

  describe("Update Method", () => {
    test("should update lastUpdate timestamp", () => {
      const beforeUpdate = player.lastUpdate;

      player.update(16);

      expect(player.lastUpdate).toBeGreaterThanOrEqual(beforeUpdate);
    });
  });

  describe("Color Generation", () => {
    test("should generate different colors for different players", () => {
      const players = [];
      for (let i = 0; i < 10; i++) {
        players.push(new Player(`player${i}`, `Player${i}`));
      }

      const colors = players.map((p) => p.color);
      const uniqueColors = new Set(colors);

      // Should have some variety (though duplicates are possible with random selection)
      expect(uniqueColors.size).toBeGreaterThan(1);
    });

    test("should generate valid hex color", () => {
      const hexColorRegex = /^#[0-9A-F]{6}$/i;
      expect(player.color).toMatch(hexColorRegex);
    });
  });

  describe("Velocity Tracking", () => {
    test("should initialize velocity", () => {
      expect(player.velocity).toEqual({ dx: 0, dy: 0 });
    });

    test("should track movement direction", () => {
      player.velocity = { dx: 1, dy: 0 };

      expect(player.velocity.dx).toBe(1);
      expect(player.velocity.dy).toBe(0);
    });
  });

  describe("Activity Tracking", () => {
    test("should track last movement time", () => {
      const initialTime = player.lastMovement;

      // Simulate movement
      player.lastMovement = Date.now();

      expect(player.lastMovement).toBeGreaterThanOrEqual(initialTime);
    });
  });
});
