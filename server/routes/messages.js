// server/routes/messages.js
const express = require('express');
const { authenticateToken } = require('./auth');

const router = express.Router();

// Apply authentication middleware to all message routes
router.use(authenticateToken);

// Get conversation history (direct messages between two users)
router.get('/direct/:userId', (req, res) => {
  const currentUserId = req.user.userId;
  const otherUserId = parseInt(req.params.userId);
  
  if (isNaN(otherUserId)) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }
  
  const db = req.app.locals.db;
  
  // Get messages where current user is either sender or recipient, and other user is the opposite
  const query = `
    SELECT * FROM messages 
    WHERE (sender_id = ? AND recipient_id = ?) 
       OR (sender_id = ? AND recipient_id = ?)
    ORDER BY timestamp ASC
  `;
  
  db.all(query, [currentUserId, otherUserId, otherUserId, currentUserId], (err, messages) => {
    if (err) {
      console.error('Database error fetching direct messages:', err.message);
      return res.status(500).json({ error: 'Internal server error' });
    }
    
    res.json(messages);
  });
});

// Get group chat messages
router.get('/group/:groupId', (req, res) => {
  const currentUserId = req.user.userId;
  const groupId = parseInt(req.params.groupId);
  
  if (isNaN(groupId)) {
    return res.status(400).json({ error: 'Invalid group ID' });
  }
  
  const db = req.app.locals.db;
  
  // First check if user is a member of the group
  db.get('SELECT * FROM group_members WHERE group_id = ? AND user_id = ?', 
    [groupId, currentUserId], 
    (err, membership) => {
      if (err) {
        console.error('Database error checking group membership:', err.message);
        return res.status(500).json({ error: 'Internal server error' });
      }
      
      if (!membership) {
        return res.status(403).json({ error: 'You are not a member of this group' });
      }
      
      // Get all messages for the group
      db.all('SELECT * FROM messages WHERE group_id = ? ORDER BY timestamp ASC', 
        [groupId], 
        (err, messages) => {
          if (err) {
            console.error('Database error fetching group messages:', err.message);
            return res.status(500).json({ error: 'Internal server error' });
          }
          
          res.json(messages);
        }
      );
    }
  );
});

// Get group members with public keys
router.get('/group-members/:groupId', authenticateToken, (req, res) => {
  const currentUserId = req.user.userId;
  const groupId = parseInt(req.params.groupId);
  
  if (isNaN(groupId)) {
    return res.status(400).json({ error: 'Invalid group ID' });
  }
  
  const db = req.app.locals.db;
  
  // First check if user is a member of the group
  db.get('SELECT * FROM group_members WHERE group_id = ? AND user_id = ?', 
    [groupId, currentUserId], 
    (err, membership) => {
      if (err) {
        console.error('Database error checking group membership:', err.message);
        return res.status(500).json({ error: 'Internal server error' });
      }
      
      if (!membership) {
        return res.status(403).json({ error: 'You are not a member of this group' });
      }
      
      // Get all members of the group with their public key status
      db.all(`
        SELECT u.id, u.username, u.public_key IS NOT NULL as has_key 
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
    }
  );
});

// Send a direct message
router.post('/direct', (req, res) => {
  const senderId = req.user.userId;
  const { recipientId, encryptedContent } = req.body;
  
  if (!recipientId || !encryptedContent) {
    return res.status(400).json({ error: 'Recipient ID and encrypted content are required' });
  }
  
  const db = req.app.locals.db;
  
  // Check if recipient exists
  db.get('SELECT id FROM users WHERE id = ?', [recipientId], (err, user) => {
    if (err) {
      console.error('Database error checking recipient:', err.message);
      return res.status(500).json({ error: 'Internal server error' });
    }
    
    if (!user) {
      return res.status(404).json({ error: 'Recipient not found' });
    }
    
    // Save the message
    db.run(`
      INSERT INTO messages (sender_id, recipient_id, encrypted_content)
      VALUES (?, ?, ?)
    `, [senderId, recipientId, encryptedContent], function(err) {
      if (err) {
        console.error('Database error saving message:', err.message);
        return res.status(500).json({ error: 'Internal server error' });
      }
      
      // Get the inserted message
      db.get('SELECT * FROM messages WHERE id = ?', [this.lastID], (err, message) => {
        if (err) {
          console.error('Database error fetching new message:', err.message);
          return res.status(500).json({ error: 'Message sent but error retrieving details' });
        }
        
        // Notify the recipient through WebSocket (will be handled by the Socket.IO integration)
        const io = req.app.get('io');
        if (io) {
          io.to(`user_${recipientId}`).emit('new_message', message);
        }
        
        res.status(201).json(message);
      });
    });
  });
});

// Send a group message
router.post('/group', (req, res) => {
  const senderId = req.user.userId;
  const { groupId, encryptedContent } = req.body;
  
  if (!groupId || !encryptedContent) {
    return res.status(400).json({ error: 'Group ID and encrypted content are required' });
  }
  
  const db = req.app.locals.db;
  
  // Check if user is a member of the group
  db.get('SELECT * FROM group_members WHERE group_id = ? AND user_id = ?', 
    [groupId, senderId], 
    (err, membership) => {
      if (err) {
        console.error('Database error checking group membership:', err.message);
        return res.status(500).json({ error: 'Internal server error' });
      }
      
      if (!membership) {
        return res.status(403).json({ error: 'You are not a member of this group' });
      }
      
      // Save the message
      db.run(`
        INSERT INTO messages (sender_id, group_id, encrypted_content)
        VALUES (?, ?, ?)
      `, [senderId, groupId, encryptedContent], function(err) {
        if (err) {
          console.error('Database error saving group message:', err.message);
          return res.status(500).json({ error: 'Internal server error' });
        }
        
        // Get the inserted message
        db.get('SELECT * FROM messages WHERE id = ?', [this.lastID], (err, message) => {
          if (err) {
            console.error('Database error fetching new group message:', err.message);
            return res.status(500).json({ error: 'Message sent but error retrieving details' });
          }
          
          // Notify all group members through WebSocket
          const io = req.app.get('io');
          if (io) {
            io.to(`group_${groupId}`).emit('new_group_message', message);
          }
          
          res.status(201).json(message);
        });
      });
    }
  );
});

// Get list of users to start conversations with
router.get('/users', (req, res) => {
  const currentUserId = req.user.userId;
  const db = req.app.locals.db;
  
  db.all(`
    SELECT id, username, public_key IS NOT NULL as has_key 
    FROM users 
    WHERE id != ? 
    ORDER BY username ASC
  `, [currentUserId], (err, users) => {
    if (err) {
      console.error('Database error fetching users:', err.message);
      return res.status(500).json({ error: 'Internal server error' });
    }
    
    res.json(users);
  });
});

// Get user's groups
router.get('/groups', (req, res) => {
  const currentUserId = req.user.userId;
  const db = req.app.locals.db;
  
  db.all(`
    SELECT g.id, g.name, g.created_at, u.username as created_by_name
    FROM groups g
    JOIN group_members gm ON g.id = gm.group_id
    JOIN users u ON g.created_by = u.id
    WHERE gm.user_id = ?
    ORDER BY g.name ASC
  `, [currentUserId], (err, groups) => {
    if (err) {
      console.error('Database error fetching groups:', err.message);
      return res.status(500).json({ error: 'Internal server error' });
    }
    
    res.json(groups);
  });
});

// Create a new group
router.post('/groups', (req, res) => {
  const currentUserId = req.user.userId;
  const { name, memberIds } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Group name is required' });
  }
  
  // Ensure current user is included in the members
  const members = Array.isArray(memberIds) ? memberIds : [];
  if (!members.includes(currentUserId)) {
    members.push(currentUserId);
  }
  
  const db = req.app.locals.db;
  
  // Start a transaction
  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    
    // Create the group
    db.run('INSERT INTO groups (name, created_by) VALUES (?, ?)', 
      [name, currentUserId], 
      function(err) {
        if (err) {
          console.error('Database error creating group:', err.message);
          db.run('ROLLBACK');
          return res.status(500).json({ error: 'Internal server error' });
        }
        
        const groupId = this.lastID;
        let membersAdded = 0;
        let errors = [];
        
        // Add all members to the group
        members.forEach((memberId) => {
          db.run('INSERT INTO group_members (group_id, user_id) VALUES (?, ?)', 
            [groupId, memberId], 
            function(err) {
              if (err) {
                console.error(`Error adding member ${memberId} to group:`, err.message);
                errors.push(err.message);
              } else {
                membersAdded++;
              }
              
              // Check if all members have been processed
              if (membersAdded + errors.length === members.length) {
                if (errors.length > 0) {
                  db.run('ROLLBACK');
                  return res.status(500).json({ error: 'Error adding some members to group' });
                }
                
                // Commit the transaction
                db.run('COMMIT', (err) => {
                  if (err) {
                    console.error('Error committing transaction:', err.message);
                    db.run('ROLLBACK');
                    return res.status(500).json({ error: 'Internal server error' });
                  }
                  
                  // Get the created group
                  db.get(`
                    SELECT g.id, g.name, g.created_at, u.username as created_by_name
                    FROM groups g
                    JOIN users u ON g.created_by = u.id
                    WHERE g.id = ?
                  `, [groupId], (err, group) => {
                    if (err) {
                      console.error('Error fetching created group:', err.message);
                      return res.status(500).json({ 
                        error: 'Group created but error retrieving details' 
                      });
                    }
                    
                    res.status(201).json(group);
                  });
                });
              }
            }
          );
        });
      }
    );
  });
});

module.exports = router;