// server/routes/admin.js
const express = require('express');
const bcrypt = require('bcrypt');
const { authenticateToken } = require('./auth');
const config = require('../config/config');

const router = express.Router();

// Middleware to check if user is an admin
function isAdmin(req, res, next) {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
  }
  next();
}

// Apply authentication and admin check middleware to all admin routes
router.use(authenticateToken);
router.use(isAdmin);

// Get all users
router.get('/users', (req, res) => {
  const db = req.app.locals.db;
  
  db.all(`
    SELECT id, username, is_admin, public_key IS NOT NULL as has_key, created_at
    FROM users
    ORDER BY username ASC
  `, (err, users) => {
    if (err) {
      console.error('Database error fetching users:', err.message);
      return res.status(500).json({ error: 'Internal server error' });
    }
    
    res.json(users);
  });
});

// Get a specific user
router.get('/users/:id', (req, res) => {
  const userId = parseInt(req.params.id);
  
  if (isNaN(userId)) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }
  
  const db = req.app.locals.db;
  
  db.get(`
    SELECT id, username, is_admin, public_key IS NOT NULL as has_key, created_at
    FROM users
    WHERE id = ?
  `, [userId], (err, user) => {
    if (err) {
      console.error('Database error fetching user:', err.message);
      return res.status(500).json({ error: 'Internal server error' });
    }
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(user);
  });
});

// Create a new user
router.post('/users', (req, res) => {
  const { username, password, isAdmin } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }
  
  const db = req.app.locals.db;
  
  // Check if username already exists
  db.get('SELECT id FROM users WHERE username = ?', [username], (err, existingUser) => {
    if (err) {
      console.error('Database error checking username:', err.message);
      return res.status(500).json({ error: 'Internal server error' });
    }
    
    if (existingUser) {
      return res.status(409).json({ error: 'Username already exists' });
    }
    
    // Hash the password
    bcrypt.hash(password, config.auth.saltRounds, (err, hash) => {
      if (err) {
        console.error('Error hashing password:', err.message);
        return res.status(500).json({ error: 'Internal server error' });
      }
      
      // Insert the new user
      db.run(`
        INSERT INTO users (username, password_hash, is_admin)
        VALUES (?, ?, ?)
      `, [username, hash, isAdmin ? 1 : 0], function(err) {
        if (err) {
          console.error('Database error creating user:', err.message);
          return res.status(500).json({ error: 'Internal server error' });
        }
        
        // Get the created user
        db.get(`
          SELECT id, username, is_admin, created_at
          FROM users
          WHERE id = ?
        `, [this.lastID], (err, user) => {
          if (err) {
            console.error('Error fetching created user:', err.message);
            return res.status(500).json({ error: 'User created but error retrieving details' });
          }
          
          res.status(201).json(user);
        });
      });
    });
  });
});

// Update a user
router.put('/users/:id', (req, res) => {
  const userId = parseInt(req.params.id);
  const { username, password, isAdmin } = req.body;
  
  if (isNaN(userId)) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }
  
  // Prevent the only admin from removing their admin rights
  if (userId === req.user.userId && isAdmin === false) {
    return res.status(400).json({ error: 'Cannot remove admin rights from yourself' });
  }
  
  const db = req.app.locals.db;
  
  // Check if user exists
  db.get('SELECT * FROM users WHERE id = ?', [userId], (err, user) => {
    if (err) {
      console.error('Database error checking user:', err.message);
      return res.status(500).json({ error: 'Internal server error' });
    }
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // If username is being changed, check if the new username already exists
    if (username && username !== user.username) {
      db.get('SELECT id FROM users WHERE username = ? AND id != ?', [username, userId], (err, existingUser) => {
        if (err) {
          console.error('Database error checking username:', err.message);
          return res.status(500).json({ error: 'Internal server error' });
        }
        
        if (existingUser) {
          return res.status(409).json({ error: 'Username already exists' });
        }
        
        updateUser(username, password, isAdmin);
      });
    } else {
      updateUser(username, password, isAdmin);
    }
  });
  
  // Helper function to update the user
  function updateUser(newUsername, newPassword, newIsAdmin) {
    if (newPassword) {
      // If password is being updated, hash it first
      bcrypt.hash(newPassword, config.auth.saltRounds, (err, hash) => {
        if (err) {
          console.error('Error hashing password:', err.message);
          return res.status(500).json({ error: 'Internal server error' });
        }
        
        performUpdate(newUsername, hash, newIsAdmin);
      });
    } else {
      performUpdate(newUsername, null, newIsAdmin);
    }
  }
  
  // Helper function to perform the database update
  function performUpdate(newUsername, newPasswordHash, newIsAdmin) {
    let sql = 'UPDATE users SET ';
    let params = [];
    
    if (newUsername) {
      sql += 'username = ?, ';
      params.push(newUsername);
    }
    
    if (newPasswordHash) {
      sql += 'password_hash = ?, ';
      params.push(newPasswordHash);
    }
    
    if (newIsAdmin !== undefined) {
      sql += 'is_admin = ?, ';
      params.push(newIsAdmin ? 1 : 0);
    }
    
    // Remove trailing comma and space
    sql = sql.slice(0, -2);
    
    // Add WHERE clause
    sql += ' WHERE id = ?';
    params.push(userId);
    
    db.run(sql, params, function(err) {
      if (err) {
        console.error('Database error updating user:', err.message);
        return res.status(500).json({ error: 'Internal server error' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      // Get the updated user
      db.get(`
        SELECT id, username, is_admin, public_key IS NOT NULL as has_key, created_at
        FROM users
        WHERE id = ?
      `, [userId], (err, user) => {
        if (err) {
          console.error('Error fetching updated user:', err.message);
          return res.status(500).json({ error: 'User updated but error retrieving details' });
        }
        
        res.json(user);
      });
    });
  }
});

// Delete a user
router.delete('/users/:id', (req, res) => {
  const userId = parseInt(req.params.id);
  
  if (isNaN(userId)) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }
  
  // Prevent admin from deleting themselves
  if (userId === req.user.userId) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }
  
  const db = req.app.locals.db;
  
  db.run('DELETE FROM users WHERE id = ?', [userId], function(err) {
    if (err) {
      console.error('Database error deleting user:', err.message);
      return res.status(500).json({ error: 'Internal server error' });
    }
    
    if (this.changes === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ message: 'User deleted successfully' });
  });
});

// Get all groups (for admin oversight)
router.get('/groups', (req, res) => {
  const db = req.app.locals.db;
  
  db.all(`
    SELECT g.id, g.name, g.created_at, u.username as created_by_name, COUNT(gm.user_id) as member_count
    FROM groups g
    LEFT JOIN group_members gm ON g.id = gm.group_id
    JOIN users u ON g.created_by = u.id
    GROUP BY g.id
    ORDER BY g.name ASC
  `, (err, groups) => {
    if (err) {
      console.error('Database error fetching groups:', err.message);
      return res.status(500).json({ error: 'Internal server error' });
    }
    
    res.json(groups);
  });
});

// Get members of a specific group
router.get('/groups/:id/members', (req, res) => {
  const groupId = parseInt(req.params.id);
  
  if (isNaN(groupId)) {
    return res.status(400).json({ error: 'Invalid group ID' });
  }
  
  const db = req.app.locals.db;
  
  // First check if the group exists
  db.get('SELECT * FROM groups WHERE id = ?', [groupId], (err, group) => {
    if (err) {
      console.error('Database error checking group:', err.message);
      return res.status(500).json({ error: 'Internal server error' });
    }
    
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }
    
    // Get group members
    db.all(`
      SELECT u.id, u.username, gm.joined_at
      FROM group_members gm
      JOIN users u ON gm.user_id = u.id
      WHERE gm.group_id = ?
      ORDER BY u.username ASC
    `, [groupId], (err, members) => {
      if (err) {
        console.error('Database error fetching group members:', err.message);
        return res.status(500).json({ error: 'Internal server error' });
      }
      
      res.json(members);
    });
  });
});

// Delete a group (including all messages and memberships)
router.delete('/groups/:id', (req, res) => {
  const groupId = parseInt(req.params.id);
  
  if (isNaN(groupId)) {
    return res.status(400).json({ error: 'Invalid group ID' });
  }
  
  const db = req.app.locals.db;
  
  // Start a transaction to ensure all related data is deleted
  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    
    // First check if the group exists
    db.get('SELECT * FROM groups WHERE id = ?', [groupId], (err, group) => {
      if (err) {
        console.error('Database error checking group:', err.message);
        db.run('ROLLBACK');
        return res.status(500).json({ error: 'Internal server error' });
      }
      
      if (!group) {
        db.run('ROLLBACK');
        return res.status(404).json({ error: 'Group not found' });
      }
      
      // Delete group messages
      db.run('DELETE FROM messages WHERE group_id = ?', [groupId], (err) => {
        if (err) {
          console.error('Database error deleting group messages:', err.message);
          db.run('ROLLBACK');
          return res.status(500).json({ error: 'Internal server error' });
        }
        
        // Delete group memberships
        db.run('DELETE FROM group_members WHERE group_id = ?', [groupId], (err) => {
          if (err) {
            console.error('Database error deleting group memberships:', err.message);
            db.run('ROLLBACK');
            return res.status(500).json({ error: 'Internal server error' });
          }
          
          // Delete the group itself
          db.run('DELETE FROM groups WHERE id = ?', [groupId], function(err) {
            if (err) {
              console.error('Database error deleting group:', err.message);
              db.run('ROLLBACK');
              return res.status(500).json({ error: 'Internal server error' });
            }
            
            if (this.changes === 0) {
              db.run('ROLLBACK');
              return res.status(404).json({ error: 'Group not found' });
            }
            
            // Commit the transaction
            db.run('COMMIT', (err) => {
              if (err) {
                console.error('Error committing transaction:', err.message);
                db.run('ROLLBACK');
                return res.status(500).json({ error: 'Internal server error' });
              }
              
              res.json({ message: 'Group deleted successfully' });
            });
          });
        });
      });
    });
  });
});

module.exports = router;