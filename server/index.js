// server/index.js
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const config = require('./config/config');

// Initialize Express app
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*", // In production, specify your Electron app's URL
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Database setup
const dbPath = config.database.path;
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to the SQLite database.');
    initializeDatabase();
  }
});

// Initialize database tables if they don't exist
function initializeDatabase() {
  // Users table
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    public_key TEXT,
    is_admin INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`, (err) => {
    if (err) {
      console.error('Error creating users table:', err.message);
    } else {
      console.log('Users table initialized.');
      // Create default admin if it doesn't exist
      createDefaultAdmin();
    }
  });

  // Messages table
  db.run(`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id INTEGER NOT NULL,
    recipient_id INTEGER,
    group_id INTEGER,
    encrypted_content TEXT NOT NULL,
    timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_id) REFERENCES users (id),
    FOREIGN KEY (recipient_id) REFERENCES users (id),
    FOREIGN KEY (group_id) REFERENCES groups (id)
  )`, (err) => {
    if (err) {
      console.error('Error creating messages table:', err.message);
    } else {
      console.log('Messages table initialized.');
    }
  });

  // Groups table
  db.run(`CREATE TABLE IF NOT EXISTS groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    created_by INTEGER NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users (id)
  )`, (err) => {
    if (err) {
      console.error('Error creating groups table:', err.message);
    } else {
      console.log('Groups table initialized.');
    }
  });

  // Group members table
  db.run(`CREATE TABLE IF NOT EXISTS group_members (
    group_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    joined_at TEXT DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (group_id, user_id),
    FOREIGN KEY (group_id) REFERENCES groups (id),
    FOREIGN KEY (user_id) REFERENCES users (id)
  )`, (err) => {
    if (err) {
      console.error('Error creating group_members table:', err.message);
    } else {
      console.log('Group members table initialized.');
    }
  });
}

// Create default admin user if none exists
function createDefaultAdmin() {
  const defaultAdminUsername = config.defaultAdmin.username;
  const defaultAdminPassword = config.defaultAdmin.password; // Change this in production!
  
  db.get('SELECT * FROM users WHERE is_admin = 1 LIMIT 1', [], (err, row) => {
    if (err) {
      console.error('Error checking for admin user:', err.message);
      return;
    }

    if (!row) {
      bcrypt.hash(defaultAdminPassword, config.auth.saltRounds, (err, hash) => {
        if (err) {
          console.error('Error hashing password:', err.message);
          return;
        }

        db.run('INSERT INTO users (username, password_hash, is_admin) VALUES (?, ?, 1)', 
          [defaultAdminUsername, hash], 
          function(err) {
            if (err) {
              console.error('Error creating default admin:', err.message);
            } else {
              console.log('Default admin user created with username:', defaultAdminUsername);
            }
          }
        );
      });
    } else {
      console.log('Admin user already exists.');
    }
  });
}

// Make the database available to routes
app.locals.db = db;

// Import routes
const authRoutes = require('./routes/auth');
const messageRoutes = require('./routes/messages');
const adminRoutes = require('./routes/admin');

// Make io available to routes
app.set('io', io);

// Apply routes
app.use('/api/auth', authRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/admin', adminRoutes);

// WebSocket connection handler
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);
  
  // Authenticate the socket connection
  socket.on('authenticate', (token) => {
    // In a real implementation, verify the token and associate the socket with a user
    // For now, just log it
    console.log('Socket authenticated:', socket.id);
  });

  // Handle user joining a room (for direct messages or group chats)
  socket.on('join', (roomId) => {
    socket.join(roomId);
    console.log(`Socket ${socket.id} joined room: ${roomId}`);
  });

  // Handle new messages
  socket.on('message', (message) => {
    // In a real implementation, validate and save the message to the database
    // Then broadcast to all relevant users
    console.log('New message received:', message);
    
    // For direct messages, emit to recipient
    if (message.recipientId) {
      io.to(`user_${message.recipientId}`).emit('message', message);
    }
    
    // For group messages, emit to everyone in the group
    if (message.groupId) {
      io.to(`group_${message.groupId}`).emit('message', message);
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Basic route for checking if server is running
app.get('/', (req, res) => {
  res.send('MCP Messenger Server is Running');
});

// Set the server to listen on port from config
const PORT = config.port;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down server...');
  
  // Close the database connection
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err.message);
    } else {
      console.log('Database connection closed.');
    }
    process.exit(0);
  });
});

module.exports = { app, server, io };