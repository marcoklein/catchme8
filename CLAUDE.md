# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- `npm run dev` - Start development server with auto-restart (uses nodemon)
- `npm start` - Start production server
- `npm run deploy` - Deploy to Dokku
- `npm test` - Run Jest test suite
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage report

## Architecture Overview

This is a real-time multiplayer 2D catch game built with Node.js, Express, Socket.IO, and HTML5 Canvas.

### Server Architecture

- **server/server.js** - Main Express server and Socket.IO connection handler
- **server/game/GameManager.js** - Core game orchestration, handles all game events, player management, and the main game loop
- **server/game/GameState.js** - Manages game state, player positions, power-ups, stars, and collision detection
- **server/game/Player.js** - Player entity with position, stats, and game mechanics
- **server/game/AIPlayer.js** - AI-controlled players with automated behavior
- **server/game/AIBehavior.js** - AI decision-making logic
- **server/game/MovementEngine.js** - Server-authoritative movement validation and processing

### Client Architecture

The client uses a server-authoritative approach - no client-side prediction:

- **client/js/game.js** - Main game class, UI management, game state updates
- **client/js/renderer.js** - Canvas rendering, visual effects, animations
- **client/js/network.js** - Socket.IO communication with server
- **client/js/input.js** - Keyboard input handling
- **client/js/touch-input.js** - Touch/mobile input handling

### Key Game Systems

1. **Server-Authoritative Input System**: Clients send input states, server processes all movement and collision detection
2. **Anti-Cheat Measures**: Rate limiting, input validation, inactive player detection
3. **Points System**: Stars award 25/50 points, IT players lose 10 points/second, successful tags award 100 points
4. **Power-Up System**: Speed boost, transparency, stun orbs with area effects
5. **AI Management**: Automatic AI player addition/removal to maintain engaging gameplay

### Game Mechanics

- Players take turns being "IT" (the chaser)
- Collect stars for points (bonus points when IT)
- Power-ups provide temporary abilities
- Stun orbs create area-of-effect stunning when collected by IT players
- Game enforces single IT player at all times
- Inactive/ghost player detection and cleanup

### Testing Structure

Tests are organized in `tests/` directory with Jest configuration:
- **tests/server/game/** - Game logic unit tests
- **tests/setup/jest.setup.js** - Test environment setup
- **tests/utils/test-helpers.js** - Test utilities
- Coverage thresholds: 70% overall, 80% for core game logic

### File Locations

- Client code: `client/` (HTML, CSS, JavaScript)
- Server code: `server/` 
- Game logic: `server/game/`
- Tests: `tests/`
- Documentation: `docs/` (implementation notes and plans)

### Socket.IO Events

Key events include `playerJoin`, `playerInput`, `playerMove`, `gameState`, `playerTagged`, `scoreUpdate`, `starCollected`, `powerUpCollected`, `stunOrbCollected`.