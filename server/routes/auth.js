// server/routes/auth.js
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken'); // You'll need to install this: npm install jsonwebtoken
const config = require('../config/config');

const router = express.Router();

// Login route
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }
  
  const db = req.app.locals.db;
  
  db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
    if (err) {
      console.error('Database error during login:', err.message);
      return res.status(500).json({ error: 'Internal server error' });
    }
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    
    // Compare password with stored hash
    bcrypt.compare(password, user.password_hash, (err, match) => {
      if (err) {
        console.error('Error comparing passwords:', err.message);
        return res.status(500).json({ error: 'Internal server error' });
      }
      
      if (!match) {
        return res.status(401).json({ error: 'Invalid username or password' });
      }
      
      // Create JWT token
      const token = jwt.sign(
        { 
          userId: user.id, 
          username: user.username,
          isAdmin: user.is_admin === 1
        },
        config.auth.jwtSecret,
        { expiresIn: config.auth.jwtExpiresIn }
      );
      
      // Return token and user info (excluding password)
      const { password_hash, ...userWithoutPassword } = user;
      res.json({
        token,
        user: userWithoutPassword
      });
    });
  });
});

// Get user public key
router.get('/public-key/:userId', (req, res) => {
  const userId = req.params.userId;
  const db = req.app.locals.db;
  
  db.get('SELECT id, username, public_key FROM users WHERE id = ?', [userId], (err, user) => {
    if (err) {
      console.error('Database error fetching public key:', err.message);
      return res.status(500).json({ error: 'Internal server error' });
    }
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    if (!user.public_key) {
      return res.status(404).json({ error: 'User has not set up their encryption keys' });
    }
    
    res.json({
      userId: user.id,
      username: user.username,
      publicKey: user.public_key
    });
  });
});

// Store or update user's public key
router.post('/public-key', authenticateToken, (req, res) => {
  const { publicKey } = req.body;
  const userId = req.user.userId;
  
  if (!publicKey) {
    return res.status(400).json({ error: 'Public key is required' });
  }
  
  const db = req.app.locals.db;
  
  db.run('UPDATE users SET public_key = ? WHERE id = ?', [publicKey, userId], function(err) {
    if (err) {
      console.error('Error updating public key:', err.message);
      return res.status(500).json({ error: 'Internal server error' });
    }
    
    if (this.changes === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ message: 'Public key updated successfully' });
  });
});

// Get currently logged in user info
router.get('/me', authenticateToken, (req, res) => {
  const db = req.app.locals.db;
  
  db.get('SELECT id, username, is_admin, public_key, created_at FROM users WHERE id = ?', 
    [req.user.userId], 
    (err, user) => {
      if (err) {
        console.error('Database error fetching user info:', err.message);
        return res.status(500).json({ error: 'Internal server error' });
      }
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      res.json({
        id: user.id,
        username: user.username,
        isAdmin: user.is_admin === 1,
        hasPublicKey: !!user.public_key,
        createdAt: user.created_at
      });
    }
  );
});

// Middleware to authenticate JWT token
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN format
  
  if (!token) {
    return res.status(401).json({ error: 'Authentication token required' });
  }
  
  jwt.verify(token, config.auth.jwtSecret, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    
    req.user = user;
    next();
  });
}

// Export the middleware for use in other routes
module.exports = router;
module.exports.authenticateToken = authenticateToken;