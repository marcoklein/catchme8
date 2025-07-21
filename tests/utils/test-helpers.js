// Test helper utilities for creating mock objects and common test scenarios

class MockSocket {
  constructor() {
    this.id = "test-socket-" + Math.random().toString(36).substr(2, 9);
    this.events = {};
    this.emitted = [];
    this.rooms = new Set();
  }

  on(event, callback) {
    this.events[event] = callback;
  }

  emit(event, data) {
    this.emitted.push({ event, data });
  }

  join(room) {
    this.rooms.add(room);
  }

  leave(room) {
    this.rooms.delete(room);
  }

  to(room) {
    return {
      emit: (event, data) => {
        this.emitted.push({ event, data, room });
      },
    };
  }

  trigger(event, data) {
    if (this.events[event]) {
      this.events[event](data);
    }
  }
}

class MockIO {
  constructor() {
    this.events = {};
    this.emitted = [];
  }

  on(event, callback) {
    this.events[event] = callback;
  }

  to(room) {
    return {
      emit: (event, data) => {
        this.emitted.push({ event, data, room });
      },
    };
  }

  emit(event, data) {
    this.emitted.push({ event, data });
  }
}

// Helper function to create test players
function createTestPlayer(
  id = "test-player",
  name = "TestPlayer",
  x = 100,
  y = 100
) {
  const Player = require("../../server/game/Player");
  return new Player(id, name, x, y);
}

// Helper function to create test game state
function createTestGameState() {
  const GameState = require("../../server/game/GameState");
  return new GameState();
}

// Helper function to wait for async operations
function waitForNextTick() {
  return new Promise((resolve) => process.nextTick(resolve));
}

// Helper to advance timers and wait
function advanceTimersAndWait(ms) {
  jest.advanceTimersByTime(ms);
  return waitForNextTick();
}

module.exports = {
  MockSocket,
  MockIO,
  createTestPlayer,
  createTestGameState,
  waitForNextTick,
  advanceTimersAndWait,
};
