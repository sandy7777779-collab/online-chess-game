const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3001;

// Temporary in-memory game state and matchmaking
const games = {};

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('join_game', ({ roomId }) => {
    socket.join(roomId);
    console.log(`User ${socket.id} joined room ${roomId}`);
    
    // Notify the room that a user joined
    socket.to(roomId).emit('user_joined', { userId: socket.id });
  });

  socket.on('move', ({ roomId, move }) => {
    // Broadcast the move to the other player
    socket.to(roomId).emit('move_received', move);
  });

  socket.on('send_challenge', ({ targetId, fromId }) => {
    // Basic challenge feature for friends
    socket.to(targetId).emit('challenge_received', { fromId });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

app.get('/', (req, res) => {
  res.send('Chess Server is running');
});

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
