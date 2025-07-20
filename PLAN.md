# CatchMe - 2D Top-Down Multiplayer Catch Game

## Project Overview

A real-time multiplayer 2D top-down game where players move around a game field and try to catch each other. One player is designated as "it" and must tag other players to pass the "it" status to them.

## Technology Stack

- **Backend**: Node.js with Express.js
- **Real-time Communication**: Socket.IO
- **Frontend**: HTML5 Canvas with vanilla JavaScript
- **Styling**: CSS3
- **Package Management**: npm

## Game Mechanics

### Core Gameplay

1. **Player Movement**: WASD or arrow key controls for smooth 8-directional movement
2. **Catching**: When the "it" player touches another player, they become "it"
3. **Visual Feedback**: Clear indication of who is "it" (different color/glow effect)
4. **Collision Detection**: Real-time collision detection between players
5. **Game Boundaries**: Players cannot move outside the game field

### Game States

1. **Waiting Room**: Players join and wait for minimum players (2+)
2. **Game Active**: One player is "it", others try to avoid being caught
3. **Game Over**: Timer expires or manual reset

### Player Features

- Unique player names/IDs
- Different colors for each player
- "It" player has special visual indicator
- Player position synchronization across all clients

## Technical Architecture

### Server Structure

```
server/
├── server.js           # Main server file with Express and Socket.IO setup
├── game/
│   ├── GameManager.js  # Core game logic and state management
│   ├── Player.js       # Player class definition
│   └── GameState.js    # Game state management
├── utils/
│   └── collision.js    # Collision detection utilities
└── package.json        # Dependencies and scripts
```

### Client Structure

```
client/
├── index.html          # Main game page
├── css/
│   └── style.css       # Game styling
├── js/
│   ├── game.js         # Main game client logic
│   ├── renderer.js     # Canvas rendering
│   ├── input.js        # Input handling
│   └── network.js      # Socket.IO client communication
└── assets/
    └── sounds/         # Game sound effects (optional)
```

## Implementation Plan

### Phase 1: Basic Infrastructure ✅ COMPLETED

1. **Project Setup** ✅

   - Initialize npm project
   - Install dependencies (express, socket.io)
   - Create basic file structure
   - Set up development scripts

2. **Basic Server** ✅

   - Express server setup
   - Socket.IO integration
   - Basic room management
   - Player connection/disconnection handling

3. **Basic Client** ✅
   - HTML5 Canvas setup
   - Socket.IO client connection
   - Basic player representation

### Phase 2: Core Game Mechanics ✅ COMPLETED

1. **Player Movement** ✅

   - Input handling (WASD/Arrow keys)
   - Smooth movement with interpolation
   - Position validation and boundaries
   - Real-time position sync
   - Client-side prediction for responsiveness
   - Enhanced movement frequency (30 FPS)

2. **Game State Management** ✅

   - Player join/leave logic
   - Game start/stop conditions
   - "It" player designation and switching
   - Game timer implementation

3. **Collision Detection** ✅
   - Circle-based collision detection
   - Real-time collision checking
   - Tag event handling and broadcasting

### Phase 3: Enhanced Features

1. **Visual Improvements**

   - Player sprites/avatars
   - "It" player special effects
   - Game field design
   - UI for player names and status

2. **Game Features**

   - Score tracking
   - Multiple rounds
   - Power-ups (speed boost, immunity, etc.)
   - Different game modes

3. **Polish**
   - Sound effects
   - Animations
   - Mobile responsiveness
   - Error handling and reconnection

## Key Socket.IO Events

### Client to Server

- `playerJoin`: Join game with player name
- `playerMove`: Send movement input
- `playerDisconnect`: Handle disconnection

### Server to Client

- `gameState`: Full game state update
- `playerUpdate`: Individual player position update
- `playerTagged`: Someone was tagged
- `gameStart`: Game has started
- `gameEnd`: Game has ended

## Game Configuration

- **Game Field**: 800x600 pixels
- **Player Size**: 20px radius circles
- **Movement Speed**: 200 pixels/second
- **Catch Distance**: 25px (player radius + small buffer)
- **Maximum Players**: 8
- **Minimum Players**: 2
- **Game Duration**: 120 seconds (configurable)

## Development Workflow

1. Start with local development server
2. Implement and test each feature incrementally
3. Use browser dev tools for debugging
4. Test with multiple browser windows for multiplayer
5. Add error handling and edge cases
6. Optimize performance and add polish

## Potential Extensions

- Spectator mode
- Multiple game rooms
- Player statistics and leaderboards
- Different game maps
- Team-based modes
- AI players for single-player practice

## Dependencies

```json
{
  "express": "^4.18.2",
  "socket.io": "^4.7.2",
  "cors": "^2.8.5"
}
```

## Getting Started

1. Run `npm install` to install dependencies
2. Start the server with `npm start`
3. Open browser to `http://localhost:3000`
4. Open multiple tabs/windows to test multiplayer
5. Enter player names and start catching!

This plan provides a solid foundation for building an engaging multiplayer catch game with room for future enhancements and improvements.
