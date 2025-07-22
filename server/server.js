const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const path = require("path");
const GameManager = require("./game/GameManager");

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// Serve static files from client directory
app.use(express.static(path.join(__dirname, "../client")));

// Initialize game manager
const gameManager = new GameManager(io);

// Socket.IO connection handling
io.on("connection", (socket) => {
  console.log("New client connected:", socket.id);

  // Handle player joining
  socket.on("playerJoin", (playerName) => {
    gameManager.handlePlayerJoin(socket, playerName);
  });

  // Handle new input-based movement
  socket.on("playerInput", (inputState) => {
    try {
      gameManager.handlePlayerInput(socket, inputState);
    } catch (error) {
      console.error(`Error handling player input for ${socket.id}:`, error);
    }
  });


  // Handle ping for debug stats
  socket.on("ping", (timestamp) => {
    socket.emit("pong", timestamp);
  });

  // Handle disconnection
  socket.on("disconnect", () => {
    gameManager.handlePlayerDisconnect(socket);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`CatchMe game server running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} to play the game`);
});
