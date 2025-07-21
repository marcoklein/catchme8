# Ghost Player Detection and Cleanup System

## Problem

Sometimes players become "ghost players" who are still in the game state but are no longer actively connected or sending input. This causes issues where:

1. Players get stuck because they're not really reconnecting anymore
2. The game might not have a player who is "it" if the ghost player was the "it" player

## Solution Implemented

### 1. Inactive Player Detection (`removeInactivePlayers`)

**Location**: `server/game/GameManager.js`

- **Timeout**: 30 seconds of no input = ghost player
- **Detection Logic**:

  - Tracks last movement time (`player.lastMovement`)
  - Tracks last input state update time (`inputState.lastUpdated`)
  - Uses the most recent of these two timestamps
  - Also detects players who have no input state at all after 5 seconds

- **Cleanup**:
  - Removes player from game state
  - Cleans up input tracking maps
  - Broadcasts updated game state
  - Logs removal for monitoring

### 2. "It" Player Enforcement (`ensureItPlayer`)

**Location**: `server/game/GameState.js`

- **Validation**: Checks that exactly one player is "it"
- **No "It" Player**: Randomly assigns "it" status to a player
- **Multiple "It" Players**: Keeps only the first one, removes "it" status from others
- **Logging**: Reports when "it" status is assigned or fixed

### 3. Integration in Game Loop

**Location**: `server/game/GameManager.js`

- **Frequency**: Inactive player check runs every 5 seconds (not every frame for performance)
- **Order**:
  1. Remove inactive players
  2. Ensure "it" player exists
  3. Continue with normal game logic

### 4. Activity Tracking Improvements

- **Player Join**: Initialize `lastMovement` timestamp when player joins
- **Input Processing**: Update `lastMovement` on any input or movement
- **Game Events**: Update `lastMovement` during power-up collection and collisions

## Configuration

```javascript
const INACTIVE_TIMEOUT = 30000; // 30 seconds
const inactiveCheckInterval = 5000; // Check every 5 seconds
```

## Logging

The system logs:

- When inactive players are detected and removed
- When "it" status is assigned or corrected
- Player activity status including time since last activity

## Benefits

1. **Prevents Ghost Players**: Automatically removes players who have disconnected but weren't properly cleaned up
2. **Game Continuity**: Ensures the game always has a functional "it" player
3. **Performance**: Reduces unnecessary processing of inactive players
4. **Monitoring**: Provides clear logs for debugging connection issues
5. **Robustness**: Handles edge cases like multiple "it" players or no "it" player

## Testing

To test the system:

1. Join the game with a player
2. Disconnect the client without proper cleanup (e.g., close browser tab)
3. Wait 30+ seconds
4. The server should automatically remove the ghost player
5. If the ghost player was "it", a new "it" player should be assigned

## Future Improvements

- Configurable timeout values
- Different timeout values for different scenarios
- Player reconnection grace period
- More sophisticated activity detection (e.g., cursor movement)
