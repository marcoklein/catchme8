# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### TypeScript Development (Primary)
- `npm run dev` - Start TypeScript development with hot reloading (server + client)
- `PORT=3033 npm run dev` - Start development servers on custom ports (server: 3033, client: 3034)
- `npm run dev:server` - Start TypeScript server development mode only
- `npm run dev:client` - Start TypeScript client development mode only
- `npm run build` - Build complete TypeScript project (server + client)
- `npm run build:server` - Build TypeScript server code only
- `npm run build:client` - Build TypeScript client code and bundle with webpack
- `npm start` - Start production TypeScript server
- `npm run lint` - Run ESLint on TypeScript code
- `npm run lint:fix` - Run ESLint with auto-fix on TypeScript code
- `npm run type-check` - Run TypeScript type checking without compilation

#### Port Configuration
- **Default ports**: Server (3000), Client dev server (3001)  
- **Custom ports**: Set `PORT` environment variable - client will auto-use PORT+1
- **Manual override**: Set `CLIENT_PORT` environment variable for specific client port
- **Examples**:
  - `PORT=3033 npm run dev` → Server: 3033, Client: 3034
  - `PORT=8000 CLIENT_PORT=9000 npm run dev` → Server: 8000, Client: 9000

### Legacy JavaScript (Deprecated)
- `npm run start:legacy` - Start legacy JavaScript server
- `npm run dev:legacy` - Start legacy development with nodemon

### Testing & Deployment
- `npm test` - Run Jest test suite
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage report
- `npm run deploy` - Deploy to Dokku

## Architecture Overview

This is a real-time multiplayer 2D catch game built with **TypeScript**, Node.js, Express, Socket.IO, and HTML5 Canvas.

### TypeScript Server Architecture (Primary)

- **src/server/server.ts** - Main Express server and Socket.IO connection handler with type safety
- **src/server/game/GameManager.ts** - Core game orchestration with typed Socket.IO events
- **src/server/game/GameState.ts** - Game state management with typed collections and methods
- **src/server/game/Player.ts** - Player entity with complete type safety, includes color generation
- **src/server/game/MovementEngine.ts** - Server-authoritative movement validation with input types
- **src/shared/types/GameTypes.ts** - Core interfaces (PlayerState, GameStateData, Position, etc.)
- **src/shared/types/SocketEvents.ts** - Typed Socket.IO events (ServerToClientEvents, ClientToServerEvents)

### TypeScript Client Architecture (Primary)

The client uses server-authoritative approach with client-side prediction and TypeScript type safety:

- **src/client/components/Game.ts** - Main game class with client-side prediction and typed state management
- **src/client/components/Renderer.ts** - Canvas rendering with explosion effects and typed game objects
- **src/client/network/NetworkManager.ts** - Typed Socket.IO communication with server
- **src/client/utils/InputManager.ts** - Input handling with TypeScript interfaces
- **src/client/main.ts** - Entry point with global error handling
- **client/dist/bundle.js** - Webpack-bundled client code (generated)

### Legacy JavaScript Architecture (Deprecated)

- **server/** - Original JavaScript server files (kept for reference)
- **client/js/** - Original JavaScript client files (kept for reference)

### Key Game Systems

1. **Server-Authoritative Input System**: Clients send typed input states, server processes all movement and collision detection
2. **Anti-Cheat Measures**: Rate limiting, input validation, inactive player detection
3. **Points System**: Stars award 25/50 points, IT players lose 10 points/second, successful tags award 100 points
4. **Power-Up System**: Speed boost, transparency, stun orbs with enhanced area effects
5. **Enhanced Explosion Effects**: Massive circular shock waves with multiple layers and extended duration (3-5 second stuns)
6. **Player Color System**: Automatic unique color generation for visual distinction
7. **Type Safety**: Complete TypeScript coverage prevents runtime errors and improves maintainability

### Game Mechanics

- Players take turns being "IT" (the chaser)
- Collect stars for points (bonus points when IT)
- Power-ups provide temporary abilities
- **Enhanced Stun Orbs**: Create massive screen-wide circular shock wave explosions with extended 3-5 second stun effects
- **Visual Effects**: Multi-layered explosion animations with cyan, golden, and white shock waves
- **Player Colors**: Each player gets a unique randomly assigned color for easy identification
- Game enforces single IT player at all times
- Inactive/ghost player detection and cleanup

### Testing Structure

Tests are organized in `tests/` directory with Jest configuration:
- **tests/server/game/** - Game logic unit tests
- **tests/setup/jest.setup.js** - Test environment setup
- **tests/utils/test-helpers.js** - Test utilities
- Coverage thresholds: 70% overall, 80% for core game logic

### File Locations

#### TypeScript Source Code (Primary)
- **src/server/** - TypeScript server code
- **src/client/** - TypeScript client code  
- **src/shared/types/** - Shared TypeScript interfaces and types
- **dist/** - Compiled TypeScript output (generated, not committed)
- **client/dist/** - Webpack bundled client code (generated, not committed)

#### Static Assets & Configuration
- **client/** - HTML, CSS, and static assets
- **tests/** - Jest test files
- **docs/** - Implementation notes and plans (optional)

#### Legacy Code (Deprecated, kept for reference)
- **server/** - Original JavaScript server code
- **client/js/** - Original JavaScript client code

#### Configuration Files
- **tsconfig.json, tsconfig.server.json, tsconfig.client.json** - TypeScript configurations
- **webpack.config.js** - Webpack bundling configuration
- **.eslintrc.json** - ESLint configuration for TypeScript

### Socket.IO Events

All Socket.IO events are now **fully typed** using TypeScript interfaces:

#### Server to Client Events
- `gameJoined` - Player successfully joined with game state
- `gameState` - Updated game state with all players and objects  
- `playerTagged` - Player tagging event with new IT status
- `scoreUpdate` - Score changes with reasons and amounts
- `starCollected` - Star collection events with point awards
- `powerUpCollected` - Power-up activation events
- `stunOrbCollected` - Stun orb collection events
- `stunOrbExplosion` - **Enhanced explosion effects** with position and affected players
- `gameEnd` - Game termination events

#### Client to Server Events  
- `playerJoin` - Join game with player name
- `playerInput` - **Typed input states** (keyboard/touch with validation)

All events use TypeScript interfaces defined in `src/shared/types/SocketEvents.ts` for complete type safety.

## TypeScript Migration & Enhanced Features

This codebase has been **completely migrated to TypeScript** with the following improvements:

### ✅ Complete Type Safety
- **Shared Type Definitions**: `src/shared/types/` contains all interfaces used by both client and server
- **Socket.IO Type Safety**: All Socket.IO events are fully typed to prevent client-server mismatches
- **Game Object Types**: PlayerState, GameStateData, InputState, and all game entities are typed
- **Build-Time Error Prevention**: TypeScript catches errors before runtime

### ✅ Enhanced Build System
- **Webpack Bundling**: Client code is bundled with CSS support and source maps
- **Hot Reloading**: Development mode with automatic recompilation and browser refresh
- **ESLint Integration**: Code quality checking with TypeScript-specific rules
- **Dual Architecture**: TypeScript (primary) and legacy JavaScript (deprecated) side-by-side

### ✅ Visual & Gameplay Enhancements
- **Massive Explosion Effects**: Screen-wide circular shock waves with multi-layer animations
- **Extended Stun Duration**: Stun effects now last 3-5 seconds for more strategic gameplay
- **Player Color System**: Automatic unique color assignment for easy player identification
- **Enhanced Visual Effects**: Cyan, golden, and white shock wave layers with proper opacity transitions

### ✅ Development Experience Improvements
- **Type Checking**: `npm run type-check` validates all TypeScript without compilation
- **Linting**: `npm run lint` and `npm run lint:fix` for code quality
- **Hot Reload Development**: `npm run dev` starts both server and client with auto-restart
- **Build Verification**: Complete build process ensures all types are compatible

### 🚀 Migration Benefits
- **Reduced Runtime Errors**: Type safety catches issues at compile time
- **Better IDE Support**: Full IntelliSense, auto-completion, and refactoring
- **Maintainable Codebase**: Clear interfaces make the code self-documenting
- **Safer Refactoring**: TypeScript ensures changes don't break compatibility
- **Professional Development**: Modern toolchain with industry-standard practices

The game now provides the same great multiplayer experience with enhanced visual effects, better code quality, and a robust development environment that scales for future features.