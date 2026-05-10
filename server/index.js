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
const rooms = {};

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('join_game', ({ roomId }) => {
    socket.join(roomId);
    console.log(`User ${socket.id} joined room ${roomId}`);
    
    if (!rooms[roomId]) {
      rooms[roomId] = { players: [] };
    }

    let assignedColor = 'spectator';
    if (rooms[roomId].players.length === 0) {
      assignedColor = 'w';
    } else if (rooms[roomId].players.length === 1) {
      assignedColor = 'b';
    }

    rooms[roomId].players.push({ id: socket.id, color: assignedColor });

    // Tell the specific user their color
    socket.emit('game_state', { color: assignedColor });

    // Notify the room that a user joined
    socket.to(roomId).emit('user_joined', { userId: socket.id });

    // If we have 2 players, emit game start
    if (rooms[roomId].players.length === 2) {
      io.to(roomId).emit('game_start', { message: 'Game started!' });
    }
  });

  socket.on('move', ({ roomId, move }) => {
    // Broadcast the move to the other player
    socket.to(roomId).emit('move_received', move);
  });

  socket.on('send_challenge', ({ targetId, fromId }) => {
    // Basic challenge feature for friends
    socket.to(targetId).emit('challenge_received', { fromId });
  });

  socket.on('chat_message', ({ roomId, targetId, message, fromName }) => {
    const payload = { fromId: socket.id, fromName: fromName || 'Unknown', message, timestamp: Date.now() };
    if (targetId) {
      // Send DM to specific friend
      socket.to(targetId).emit('chat_received', { ...payload, type: 'dm' });
    } else if (roomId) {
      // Send to room
      socket.to(roomId).emit('chat_received', { ...payload, type: 'room' });
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    // Cleanup room state if needed (simplified for now)
    for (const roomId in rooms) {
      rooms[roomId].players = rooms[roomId].players.filter(p => p.id !== socket.id);
    }
  });
});

app.get('/', (req, res) => {
  res.send('Chess Server is running');
});

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
