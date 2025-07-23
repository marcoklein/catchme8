import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

import { ServerToClientEvents, ClientToServerEvents, InterServerEvents, SocketData } from '@shared/types';
import { GameManager } from './game/GameManager';

// Server configuration
const PORT = process.env.PORT || 3000;
const app = express();
const server = createServer(app);

// Initialize Socket.IO with typed events
const io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Initialize game manager
const gameManager = new GameManager(io);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('client'));

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'client', 'index.html'));
});

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    players: gameManager.getPlayerCount(),
    uptime: process.uptime()
  });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);

  // Store connection time
  socket.data.joinTime = Date.now();

  // Handle player joining
  socket.on('playerJoin', (playerName: string) => {
    try {
      // Validate player name
      if (!playerName || typeof playerName !== 'string' || playerName.trim().length === 0) {
        socket.emit('joinError', 'Invalid player name');
        return;
      }

      if (playerName.length > 15) {
        socket.emit('joinError', 'Name must be 15 characters or less');
        return;
      }

      // Store player data
      socket.data.playerId = socket.id;
      socket.data.playerName = playerName.trim();

      // Handle join through game manager
      gameManager.handlePlayerJoin(socket, playerName.trim());
      
    } catch (error) {
      console.error('Error handling player join:', error);
      socket.emit('joinError', 'Failed to join game');
    }
  });

  // Handle player input
  socket.on('playerInput', (inputState) => {
    try {
      gameManager.handlePlayerInput(socket, inputState);
    } catch (error) {
      console.error('Error handling player input:', error);
    }
  });

  // Handle disconnection
  socket.on('disconnect', (reason) => {
    try {
      console.log(`Player disconnected: ${socket.id}, reason: ${reason}`);
      gameManager.handlePlayerDisconnect(socket);
    } catch (error) {
      console.error('Error handling player disconnect:', error);
    }
  });

  // Handle connection errors
  socket.on('error', (error) => {
    console.error(`Socket error for ${socket.id}:`, error);
  });
});

// Error handling
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`🚀 CatchMe game server running on port ${PORT}`);
  console.log(`🎮 Game accessible at http://localhost:${PORT}`);
  console.log(`📊 Health check at http://localhost:${PORT}/health`);
});