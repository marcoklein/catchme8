# CatchMe Game - Technical Specifications

## Project Overview

CatchMe is a real-time multiplayer 2D top-down catch game built with Node.js, Express, Socket.IO, and HTML5 Canvas. Players move around a game field trying to catch each other in a tag-like gameplay.

## Technology Stack

- **Backend**: Node.js with Express.js
- **Real-time Communication**: Socket.IO v4.7.2
- **Frontend**: HTML5 Canvas with vanilla JavaScript
- **Styling**: CSS3
- **Package Management**: npm

## Project Structure

```
catchme-8/
├── server/
│   ├── server.js              # Main Express server with Socket.IO setup
│   └── game/
│       ├── GameManager.js     # Core game logic and event handling
│       ├── GameState.js       # Game state management
│       └── Player.js          # Player class and movement logic
├── client/
│   ├── index.html             # Main game page
│   ├── css/
│   │   └── style.css          # Game styling and responsive design
│   └── js/
│       ├── game.js            # Main client game logic and state management
│       ├── network.js         # Socket.IO client communication
│       ├── input.js           # Keyboard input handling (WASD/Arrow keys)
│       └── renderer.js        # HTML5 Canvas rendering
├── package.json               # Dependencies and scripts
├── .gitignore                 # Git ignore rules (includes node_modules)
└── PLAN.md                    # Development roadmap and implementation plan
```

## Core Game Mechanics

### Game Configuration

- **Game Field**: 800x600 pixels
- **Player Size**: 20px radius circles
- **Movement Speed**: 200 pixels/second
- **Catch Distance**: 25px (player radius + small buffer)
- **Maximum Players**: 8
- **Minimum Players**: 2 (auto-start)
- **Game Duration**: 120 seconds (2 minutes)

### Player System

- **Unique Identification**: Socket.IO connection ID
- **Player Names**: 1-15 characters, required for joining
- **Visual Representation**: Colored circles with names
- **Random Colors**: 8 predefined colors assigned automatically
- **"IT" Player**: First player becomes "IT", indicated by golden glow effect

### Movement System

- **Input**: WASD keys or Arrow keys
- **Movement Type**: 8-directional with diagonal normalization (0.707 factor)
- **Update Frequency**: 60 FPS server updates, 30 FPS network broadcasts
- **Movement Model**: Server-authoritative (no client-side prediction)
- **Boundaries**: Players cannot move outside game field
- **Collision Detection**: Circle-based collision for tagging

## Server Architecture

### GameManager Class (`server/game/GameManager.js`)

- **Purpose**: Central game logic coordinator
- **Key Methods**:
  - `handlePlayerJoin(socket, playerName)`: Player connection handling
  - `handlePlayerMove(socket, movement)`: Real-time movement processing
  - `handlePlayerDisconnect(socket)`: Cleanup on player leave
  - `checkCollisions(playerId)`: Tag detection and handling
  - `gameLoop()`: 60 FPS game state updates

### GameState Class (`server/game/GameState.js`)

- **Purpose**: Game state management and validation
- **Key Properties**:
  - `players`: Map of active players
  - `gameActive`: Boolean game status
  - `gameStartTime`: Timestamp for timer
  - `gameDuration`: 120000ms (2 minutes)
- **Key Methods**:
  - `addPlayer(player)`: Add player with validation
  - `removePlayer(playerId)`: Remove player and reassign "IT"
  - `tagPlayer(taggerId, targetId)`: Handle tagging logic
  - `updatePlayer(playerId, movement, deltaTime)`: Movement validation

### Player Class (`server/game/Player.js`)

- **Purpose**: Individual player state and movement
- **Key Properties**:
  - `id`, `name`, `x`, `y`: Basic player data
  - `isIt`: Boolean "IT" status
  - `color`: Randomly assigned color
  - `speed`: 200 pixels/second
  - `velocity`: Current movement direction
- **Key Methods**:
  - `move(dx, dy, deltaTime, gameWidth, gameHeight)`: Position updates
  - `distanceTo(other)`: Distance calculation for collision
  - `canCatch(other)`: Collision detection logic

## Client Architecture

### Game Class (`client/js/game.js`)

- **Purpose**: Main client-side game controller
- **Key Properties**:
  - `gameState`: Current game state from server
  - `myPlayerId`: Local player identification
- **Key Methods**:
  - `onGameJoined(data)`: Handle successful join
  - `updateGameState(gameState)`: Process server updates
  - `gameLoop()`: 60 FPS client rendering loop

### NetworkManager Class (`client/js/network.js`)

- **Purpose**: Socket.IO client communication
- **Key Methods**:
  - `joinGame(playerName)`: Send join request
  - `sendMovement(movement)`: Send player input
  - `showMessage(text, type)`: UI notifications

### InputManager Class (`client/js/input.js`)

- **Purpose**: Keyboard input handling
- **Key Features**:
  - WASD and Arrow key support
  - Input field detection (prevents interference)
  - Movement normalization for diagonal movement
  - 30 FPS movement transmission rate

### Renderer Class (`client/js/renderer.js`)

- **Purpose**: HTML5 Canvas rendering
- **Key Features**:
  - Player circle rendering with colors
  - "IT" player glow effect with animation
  - Player name labels
  - Grid background pattern
  - Trail effects for moving players

## Socket.IO Events

### Client → Server Events

- `playerJoin`: `{playerName: string}` - Request to join game
- `playerMove`: `{dx: number, dy: number}` - Movement input (-1 to 1)
- `disconnect`: Automatic - Player disconnection

### Server → Client Events

- `gameJoined`: `{playerId: string, gameState: object}` - Successful join
- `gameState`: `{players: array, gameActive: boolean, timeRemaining: number}` - State updates
- `playerTagged`: `{tagger: string, tagged: string, newIt: string}` - Tag notifications
- `gameEnd`: `{reason: string}` - Game termination
- `joinError`: `{error: string}` - Join failure

## UI Components

### Join Form

- Name input (1-15 characters, required)
- Join button with validation
- Error message display
- Auto-focus and Enter key support

### Game Interface

- Player name display
- Game status (waiting/active/"You are IT!"/"Run!")
- Timer countdown (MM:SS format)
- Player count
- Control instructions

### Canvas Game Area

- 800x600 pixel game field
- Real-time player rendering
- Visual feedback for "IT" player
- Responsive design for mobile

## Development Scripts

- `npm start`: Start production server
- `npm run dev`: Start development server with nodemon
- Server runs on port 3000 (configurable via PORT env var)

## File Dependencies

### Server Dependencies

```javascript
// server/server.js
const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const GameManager = require("./game/GameManager");

// server/game/GameManager.js
const GameState = require("./GameState");
const Player = require("./Player");
```

### Client Dependencies

```html
<!-- client/index.html -->
<script src="/socket.io/socket.io.js"></script>
<script src="js/network.js"></script>
<script src="js/input.js"></script>
<script src="js/renderer.js"></script>
<script src="js/game.js"></script>
```

## Key Implementation Details

### Movement Synchronization

- Client sends movement input at 30 FPS
- Server processes movement at 60 FPS
- Server broadcasts authoritative state at 30 FPS
- Delta time calculations prevent frame rate dependencies
- Pure server-authoritative movement (no client-side prediction)

### Collision Detection

- Circle-to-circle collision using distance calculation
- Collision check only for "IT" player
- 25px collision distance (player radius + buffer)
- Immediate tag processing and broadcast

### Game State Management

- Auto-start with 2+ players
- Auto-assign "IT" player (first player, or reassign on disconnect)
- 2-minute game timer with automatic reset
- Player limit enforcement (2-8 players)

### Error Handling

- Join validation (name required, game capacity)
- Graceful disconnection handling
- Network error messaging
- Input validation and sanitization

## CSS Styling Features

- Gradient background design
- Semi-transparent UI elements with backdrop blur
- Responsive design for mobile devices
- Animated glow effects for "IT" player
- Toast-style notification messages
- Modern button and input styling

## Development Status

- ✅ Phase 1: Basic Infrastructure (Complete)
- ✅ Phase 2: Core Game Mechanics (Complete)
- 🔄 Phase 3: Enhanced Features (Planned - power-ups, game modes, etc.)

This codebase implements a fully functional multiplayer catch game with real-time synchronization, server-authoritative movement, and polished visual feedback.
