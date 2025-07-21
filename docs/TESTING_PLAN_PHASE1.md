# Testing Plan - Phase 1: Unit Testing Foundation

## Overview

This document outlines the first iteration testing strategy for the CatchMe game, focusing on establishing a solid unit testing foundation for both server and client components. The goal is to create reliable, fast-running tests that validate core game logic and enable confident refactoring.

## Testing Framework Setup

### Server-Side Testing (Node.js)

- **Framework**: Jest
- **Additional Tools**:
  - `socket.io-client` for testing socket communications
  - `supertest` for HTTP endpoint testing (if needed)

### Client-Side Testing

- **Framework**: Jest with jsdom environment
- **Additional Tools**:
  - `@testing-library/dom` for DOM testing utilities
  - Canvas mocking for renderer tests

## Server-Side Unit Tests Priority

### 1. Core Game Logic Classes (HIGH PRIORITY)

#### GameState Class Tests (`server/game/GameState.test.js`)

**Test Categories:**

- **Player Management**

  - ✅ Adding players within max limit
  - ✅ Rejecting players when game is full
  - ✅ Removing players and reassigning "IT" status
  - ✅ Ensuring exactly one "IT" player exists

- **Game Flow**

  - ✅ Starting game with minimum players
  - ✅ Stopping game conditions
  - ✅ Game timer functionality
  - ✅ Game over detection

- **Position Validation**

  - ✅ Safe spawn position generation
  - ✅ Obstacle collision detection
  - ✅ Boundary validation

- **Power-ups System**
  - ✅ Power-up generation and positioning
  - ✅ Collision detection with players
  - ✅ Power-up respawn timers

**Key Test Cases:**

```javascript
describe("GameState", () => {
  describe("Player Management", () => {
    test("should add first player as IT");
    test("should reject player when game is full");
    test("should reassign IT when IT player leaves");
    test("should ensure exactly one IT player");
  });

  describe("Movement Validation", () => {
    test("should validate movement within speed limits");
    test("should normalize excessive movement");
    test("should prevent movement through obstacles");
  });
});
```

#### Player Class Tests (`server/game/Player.test.js`)

**Test Categories:**

- **Movement Mechanics**

  - ✅ Basic movement with deltaTime
  - ✅ Boundary collision handling
  - ✅ Obstacle collision prevention
  - ✅ Stunned state movement blocking

- **Status Management**

  - ✅ IT status assignment
  - ✅ Power-up effect application
  - ✅ Stun state management
  - ✅ Transparency effect timing

- **Anti-cheat Validation**
  - ✅ Speed limit enforcement
  - ✅ Position validation
  - ✅ Movement distance calculations

#### GameManager Class Tests (`server/game/GameManager.test.js`)

**Test Categories:**

- **Player Lifecycle**

  - ✅ Player join handling
  - ✅ Player disconnect cleanup
  - ✅ Input rate limiting
  - ✅ Anti-cheat enforcement

- **Game Events**

  - ✅ Collision detection and tagging
  - ✅ Power-up collection
  - ✅ AI player management
  - ✅ Inactive player removal

- **Network Communication**
  - ✅ Socket event handling
  - ✅ Game state broadcasting
  - ✅ Error handling for malformed input

### 2. Movement and Physics (MEDIUM PRIORITY)

#### MovementEngine Tests (`server/game/MovementEngine.test.js`)

**Test Categories:**

- **Movement Calculation**

  - ✅ Input state to movement conversion
  - ✅ Diagonal movement normalization
  - ✅ Speed consistency across directions
  - ✅ Delta time integration

- **Physics Integration**
  - ✅ Collision response
  - ✅ Boundary enforcement
  - ✅ Velocity calculations

### 3. AI System (LOW PRIORITY - Future Iterations)

#### AIBehavior Tests (`server/game/AIBehavior.test.js`)

- Basic decision making
- Target selection logic
- Movement pattern validation

## Client-Side Unit Tests Priority

### 1. Core Game Classes (HIGH PRIORITY)

#### Game Class Tests (`client/js/Game.test.js`)

**Test Categories:**

- **State Management**

  - ✅ Game state updates from server
  - ✅ Player ID management
  - ✅ UI synchronization

- **Event Handling**

  - ✅ Join game validation
  - ✅ Player tagged events
  - ✅ Game end handling

- **Input Processing**
  - ✅ Name validation
  - ✅ Error message display

#### NetworkManager Tests (`client/js/NetworkManager.test.js`)

**Test Categories:**

- **Socket Communication**

  - ✅ Connection handling
  - ✅ Event emission
  - ✅ Message routing to game

- **Error Handling**
  - ✅ Connection failures
  - ✅ Invalid server responses
  - ✅ Reconnection logic

### 2. Input System (MEDIUM PRIORITY)

#### InputManager Tests (`client/js/InputManager.test.js`)

**Test Categories:**

- **Input Capture**

  - ✅ Keyboard input detection
  - ✅ Touch input handling
  - ✅ Input field interference prevention

- **Input Processing**
  - ✅ Movement normalization
  - ✅ Rate limiting
  - ✅ Mobile vs desktop handling

### 3. Rendering System (LOWER PRIORITY)

#### Renderer Tests (`client/js/Renderer.test.js`)

**Test Categories:**

- **State Processing**

  - ✅ Game state interpolation
  - ✅ Player position calculations
  - ✅ Mobile optimization detection

- **Utility Functions**
  - ✅ Time formatting
  - ✅ Mobile detection
  - ✅ Animation timing

## Recommended Refactoring for Testability

### Server-Side Improvements

1. **Dependency Injection in GameManager**

   ```javascript
   class GameManager {
     constructor(io, gameState = new GameState()) {
       this.io = io;
       this.gameState = gameState; // Allow injection for testing
     }
   }
   ```

2. **Extract Pure Functions**

   - Movement validation logic
   - Collision detection algorithms
   - Distance calculations

3. **Separate Concerns**
   - Extract timer logic from GameState
   - Create dedicated classes for power-up management
   - Separate input validation from GameManager

### Client-Side Improvements

1. **Remove DOM Dependencies from Core Logic**

   ```javascript
   class Game {
     constructor(domInterface = new DOMInterface()) {
       this.dom = domInterface; // Mockable DOM operations
     }
   }
   ```

2. **Extract Canvas Operations**

   - Create CanvasWrapper for mockable canvas operations
   - Separate rendering calculations from canvas API calls

3. **Modular Event Handling**
   - Extract UI event handlers to separate classes
   - Create testable event processing logic

## Testing Infrastructure Setup

### File Structure

```
tests/
├── setup/
│   ├── jest.config.js
│   ├── dom-setup.js
│   └── socket-mock.js
├── server/
│   ├── game/
│   │   ├── GameState.test.js
│   │   ├── Player.test.js
│   │   ├── GameManager.test.js
│   │   └── MovementEngine.test.js
│   └── utils/
│       └── test-helpers.js
├── client/
│   ├── Game.test.js
│   ├── NetworkManager.test.js
│   ├── InputManager.test.js
│   └── Renderer.test.js
└── integration/
    └── game-flow.test.js (Future iteration)
```

### Package.json Updates

```json
{
  "devDependencies": {
    "jest": "^29.0.0",
    "socket.io-client": "^4.7.2",
    "@testing-library/dom": "^9.0.0",
    "canvas": "^2.11.0"
  },
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  }
}
```

## Test Coverage Goals

### Phase 1 Targets

- **Server Core Classes**: 80% line coverage
- **Client Core Classes**: 70% line coverage
- **Critical Paths**: 95% coverage (player join, movement, tagging)

### Priority Order

1. GameState class (foundation for all game logic)
2. Player class (core entity)
3. Game class (client controller)
4. GameManager class (server controller)
5. NetworkManager class (communication layer)

## Implementation Timeline

### Week 1: Foundation

- Set up Jest testing framework
- Create test infrastructure and mocks
- Implement GameState and Player tests
- Target: Core game logic tests working

### Week 2: Controllers

- GameManager server tests
- Game class client tests
- NetworkManager tests
- Target: Main controller classes tested

### Week 3: Input and Validation

- InputManager tests
- Movement validation tests
- Anti-cheat system tests
- Target: User input and security features tested

### Week 4: Polish and Coverage

- Renderer utility tests
- Edge case coverage
- Performance test foundations
- Target: 80% overall test coverage

## Benefits of This Approach

1. **Confidence in Refactoring**: Well-tested core logic enables safe code improvements
2. **Bug Prevention**: Early detection of regressions in critical game mechanics
3. **Documentation**: Tests serve as living documentation of expected behavior
4. **Development Speed**: Fast feedback loop for new features
5. **Quality Assurance**: Consistent validation of game rules and mechanics

## Next Iterations

- **Phase 2**: Integration tests for client-server communication
- **Phase 3**: End-to-end tests for complete game flows
- **Phase 4**: Performance and stress testing
- **Phase 5**: Cross-browser and mobile device testing

This plan focuses on building a solid foundation of unit tests that will support the game's continued development and ensure reliable gameplay mechanics.
