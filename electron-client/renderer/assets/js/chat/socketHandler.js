// electron-client/renderer/assets/js/chat/socketHandler.js

import { connectionManager, ConnectionState } from './connectionManager.js';
import { messageQueue, MessageStatus } from './messageQueue.js';
import { syncManager } from './syncManager.js';
import { decryptMessage } from './encryption.js';
import { saveMessage, incrementUnreadCount } from './storage.js';
import { addMessageToUI } from './chatUI.js';

let socket = null;
let heartbeatInterval = null;
let reconnectTimer = null;

// Socket.IO connection options
const connectionOptions = {
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 30000,
  timeout: 20000,
  autoConnect: true
};

// Connect to the server via WebSocket
function connectSocket(userId) {
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('No auth token found');
    }
    
    // Set state to connecting
    connectionManager.setState(ConnectionState.CONNECTING);
    
    // Create socket with reconnection options
    socket = io(window.serverConfig.socketUrl, connectionOptions);
    
    // Set up event handlers
    setupSocketEventHandlers(userId, token);
    
    return socket;
  } catch (error) {
    console.error('Socket connection error:', error);
    connectionManager.setState(ConnectionState.ERROR, {
      error,
      message: 'Failed to create socket connection'
    });
    throw error;
  }
}

// Set up socket event handlers
function setupSocketEventHandlers(userId, token) {
  if (!socket) return;
  
  // Connection established
  socket.on('connect', () => {
    console.log('Connected to server via WebSocket');
    
    // Reset reconnection attempt counter
    connectionManager.resetReconnectAttempts();
    
    // Set connection state to connected
    connectionManager.setState(ConnectionState.CONNECTED);
    
    // Authenticate the socket connection
    socket.emit('authenticate', token);
    
    // Join user's personal room
    socket.emit('join', `user_${userId}`);
    
    // Start heartbeat
    startHeartbeat();
    
    // Process any queued messages
    processMessageQueue();
    
    // Sync missed messages
    syncMissedMessages(token);
  });
  
  // Disconnection
  socket.on('disconnect', (reason) => {
    console.log('Disconnected from server:', reason);
    
    // Stop heartbeat
    stopHeartbeat();
    
    // Update connection state based on reason
    if (reason === 'io server disconnect') {
      // Server disconnected us, don't reconnect automatically
      connectionManager.setState(ConnectionState.DISCONNECTED, {
        reason,
        message: 'Disconnected by server'
      });
    } else {
      // Client-side disconnect, attempt to reconnect
      connectionManager.setState(ConnectionState.RECONNECTING, {
        reason,
        message: 'Connection lost, attempting to reconnect'
      });
    }
  });
  
  // Reconnect attempt
  socket.on('reconnect_attempt', (attemptNumber) => {
    console.log(`Reconnection attempt ${attemptNumber}`);
    
    connectionManager.reconnectAttempts = attemptNumber;
    connectionManager.setState(ConnectionState.RECONNECTING, {
      attempt: attemptNumber,
      message: `Reconnection attempt ${attemptNumber}`
    });
  });
  
  // Reconnect success
  socket.on('reconnect', (attemptNumber) => {
    console.log(`Reconnected after ${attemptNumber} attempts`);
    
    // Connection state will be set by 'connect' handler
    
    // Re-authenticate and re-join rooms
    socket.emit('authenticate', token);
    socket.emit('join', `user_${userId}`);
  });
  
  // Reconnect failure
  socket.on('reconnect_failed', () => {
    console.log('Failed to reconnect');
    
    connectionManager.setState(ConnectionState.RECONNECT_FAILED, {
      message: 'Failed to reconnect after multiple attempts'
    });
  });
  
  // Error
  socket.on('error', (error) => {
    console.error('Socket error:', error);
    
    connectionManager.setState(ConnectionState.ERROR, {
      error,
      message: 'Socket connection error'
    });
  });
  
  // New direct message
  socket.on('new_message', handleNewMessage);
  
  // New group message
  socket.on('new_group_message', handleNewGroupMessage);
  
  // Listen for custom reconnect requests
  window.addEventListener('connection_reconnect_requested', () => {
    if (socket && connectionManager.state === ConnectionState.DISCONNECTED) {
      console.log('Manual reconnection requested');
      socket.connect();
    }
  });
}

// Start heartbeat to detect silent disconnections
function startHeartbeat() {
  // Stop any existing heartbeat
  stopHeartbeat();
  
  // Start a new heartbeat
  heartbeatInterval = setInterval(() => {
    if (socket && socket.connected) {
      // Send a ping and expect a pong
      socket.emit('ping', Date.now(), (pongTimestamp) => {
        // Calculate latency
        const latency = Date.now() - pongTimestamp;
        console.log(`Socket heartbeat: ${latency}ms latency`);
      });
    } else {
      // If socket is not connected, try to reconnect
      attemptReconnect();
    }
  }, 30000); // 30-second interval
}

// Stop heartbeat
function stopHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

// Attempt to reconnect
function attemptReconnect() {
  // Clear any existing reconnect timer
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  
  // Check if we can attempt reconnection
  if (!connectionManager.canAttemptReconnect()) {
    return;
  }
  
  // Set state to reconnecting
  connectionManager.setState(ConnectionState.RECONNECTING, {
    attempt: connectionManager.reconnectAttempts + 1,
    message: 'Attempting to reconnect'
  });
  
  // Increment reconnection attempt counter
  connectionManager.reconnectAttempts++;
  
  // Calculate delay for this attempt
  const delay = connectionManager.getReconnectDelay();
  
  console.log(`Scheduling reconnection attempt in ${delay}ms`);
  
  // Schedule the reconnection attempt
  reconnectTimer = setTimeout(() => {
    if (socket) {
      console.log('Attempting to reconnect socket');
      socket.connect();
    }
  }, delay);
}

// Process any queued messages
async function processMessageQueue() {
  if (!socket || !socket.connected) {
    console.log('Cannot process message queue: Socket not connected');
    return;
  }
  
  const pendingMessages = messageQueue.getAllPending();
  
  if (pendingMessages.length === 0) {
    console.log('No pending messages to process');
    return;
  }
  
  console.log(`Processing ${pendingMessages.length} pending messages`);
  
  for (const message of pendingMessages) {
    try {
      // Mark as sending
      messageQueue.updateStatus(message.id, MessageStatus.SENDING);
      
      // Dispatch based on message type
      if (message.type === 'direct') {
        await sendDirectMessage(message);
      } else if (message.type === 'group') {
        await sendGroupMessage(message);
      }
    } catch (error) {
      console.error(`Error processing queued message ${message.id}:`, error);
      
      // Mark as failed if this was the third attempt
      if (message.attempts >= 3) {
        messageQueue.updateStatus(message.id, MessageStatus.FAILED);
      }
    }
  }
}

// Send a direct message (from queue or immediate)
async function sendDirectMessage(message) {
  return new Promise((resolve, reject) => {
    if (!socket || !socket.connected) {
      reject(new Error('Socket not connected'));
      return;
    }
    
    const payload = {
      recipientId: message.recipientId,
      encryptedContent: message.encryptedContent
    };
    
    // Set a timeout in case the server doesn't respond
    const timeoutId = setTimeout(() => {
      reject(new Error('Message send timeout'));
    }, 10000);
    
    // Emit the message to the server
    socket.emit('direct_message', payload, (response) => {
      clearTimeout(timeoutId);
      
      if (response.error) {
        reject(new Error(response.error));
      } else {
        // Update message status and save server data
        if (message.id) {
          messageQueue.updateStatus(message.id, MessageStatus.SENT, response);
          
          // After a delay, remove from queue
          setTimeout(() => {
            messageQueue.remove(message.id);
          }, 5000);
        }
        
        resolve(response);
      }
    });
  });
}

// Send a group message (from queue or immediate)
async function sendGroupMessage(message) {
  return new Promise((resolve, reject) => {
    if (!socket || !socket.connected) {
      reject(new Error('Socket not connected'));
      return;
    }
    
    const payload = {
      groupId: message.groupId,
      encryptedContent: message.encryptedContent
    };
    
    // Set a timeout in case the server doesn't respond
    const timeoutId = setTimeout(() => {
      reject(new Error('Message send timeout'));
    }, 10000);
    
    // Emit the message to the server
    socket.emit('group_message', payload, (response) => {
      clearTimeout(timeoutId);
      
      if (response.error) {
        reject(new Error(response.error));
      } else {
        // Update message status and save server data
        if (message.id) {
          messageQueue.updateStatus(message.id, MessageStatus.SENT, response);
          
          // After a delay, remove from queue
          setTimeout(() => {
            messageQueue.remove(message.id);
          }, 5000);
        }
        
        resolve(response);
      }
    });
  });
}

// Sync missed messages after reconnection
async function syncMissedMessages(token) {
  try {
    console.log('Syncing missed messages');
    
    // Sync currently active chat first
    const currentChat = JSON.parse(localStorage.getItem('currentChat') || 'null');
    
    if (currentChat) {
      await syncManager.syncChat(
        currentChat.type, 
        currentChat.id,
        token
      );
    }
    
    // Then queue syncs for all other chats
    const contacts = JSON.parse(localStorage.getItem('contacts') || '[]');
    contacts.forEach(contact => {
      if (!currentChat || currentChat.type !== 'direct' || currentChat.id !== contact.id) {
        syncManager.queueSync('direct', contact.id);
      }
    });
    
    const groups = JSON.parse(localStorage.getItem('groups') || '[]');
    groups.forEach(group => {
      if (!currentChat || currentChat.type !== 'group' || currentChat.id !== group.id) {
        syncManager.queueSync('group', group.id);
      }
    });
    
    // Process the sync queue in the background
    syncManager.processQueue(token);
    
  } catch (error) {
    console.error('Error syncing missed messages:', error);
  }
}

// Handle new direct message from socket
function handleNewMessage(message) {
  const currentChat = JSON.parse(localStorage.getItem('currentChat') || 'null');
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const contacts = JSON.parse(localStorage.getItem('contacts') || '[]');
  
  if (currentChat && 
      currentChat.type === 'direct' && 
      currentChat.id === message.sender_id) {
    // If we're currently chatting with the sender, decrypt and display the message
    try {
      const decryptedContent = decryptMessage(message.encrypted_content, message.sender_id);
      addMessageToUI(message.sender_id, decryptedContent, new Date(message.timestamp), false, contacts);
      
      // Save the message
      saveMessage(message.sender_id, {
        sender_id: message.sender_id,
        content: decryptedContent,
        timestamp: message.timestamp,
        isFromMe: false
      });
      
      // Mark as read since we're in this chat
      markAsRead(message.sender_id);
      
      // Send delivery receipt
      if (socket && socket.connected) {
        socket.emit('message_read', {
          messageId: message.id,
          senderId: message.sender_id
        });
      }
    } catch (error) {
      console.error('Error processing direct message:', error);
    }
  } else {
    // Otherwise, increment unread count and show notification
    try {
      const decryptedContent = decryptMessage(message.encrypted_content, message.sender_id);
      
      // Save the message
      saveMessage(message.sender_id, {
        sender_id: message.sender_id,
        content: decryptedContent,
        timestamp: message.timestamp,
        isFromMe: false
      });
      
      incrementUnreadCount(message.sender_id);
      showMessageNotification(message, decryptedContent, contacts);
      
      // Update UI to show new unread count
      window.dispatchEvent(new CustomEvent('unreadMessagesUpdated'));
    } catch (error) {
      console.error('Error processing new message:', error);
    }
  }
}

// Handle new group message from socket
function handleNewGroupMessage(message) {
  const currentChat = JSON.parse(localStorage.getItem('currentChat') || 'null');
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const contacts = JSON.parse(localStorage.getItem('contacts') || '[]');
  
  if (currentChat && 
      currentChat.type === 'group' && 
      currentChat.id === message.group_id) {
    // If we're currently in this group chat, decrypt and display the message
    try {
      const decryptedContent = decryptMessage(message.encrypted_content, message.sender_id);
      addMessageToUI(message.sender_id, decryptedContent, new Date(message.timestamp), message.sender_id === user.id, contacts);
      
      // Save the message
      saveMessage(`group_${message.group_id}`, {
        sender_id: message.sender_id,
        content: decryptedContent,
        timestamp: message.timestamp,
        isFromMe: message.sender_id === user.id
      });
      
      // Send delivery receipt
      if (socket && socket.connected) {
        socket.emit('message_read', {
          messageId: message.id,
          groupId: message.group_id
        });
      }
    } catch (error) {
      console.error('Error processing group message:', error);
    }
  } else {
    // Otherwise, increment unread count and show notification
    try {
      const decryptedContent = decryptMessage(message.encrypted_content, message.sender_id);
      
      // Save the message
      saveMessage(`group_${message.group_id}`, {
        sender_id: message.sender_id,
        content: decryptedContent,
        timestamp: message.timestamp,
        isFromMe: message.sender_id === user.id
      });
      
      incrementUnreadCount(`group_${message.group_id}`);
      showMessageNotification(message, decryptedContent, contacts);
      
      // Update UI to show new unread count
      window.dispatchEvent(new CustomEvent('groupUnreadMessagesUpdated'));
    } catch (error) {
      console.error('Error processing new group message:', error);
    }
  }
}

// Show a notification for a new message
function showMessageNotification(message, decryptedContent, contacts) {
  try {
    let title, body;
    
    if (message.group_id) {
      // Group message
      const groups = JSON.parse(localStorage.getItem('groups') || '[]');
      const group = groups.find(g => g.id === message.group_id);
      const sender = contacts.find(c => c.id === message.sender_id);
      
      if (!group || !sender) {
        return;
      }
      
      title =title = `New message in ${group.name}`;
      body = `${sender.username}: ${truncateText(decryptedContent, 50)}`;
      
    } else {
      // Direct message
      const sender = contacts.find(c => c.id === message.sender_id);
      
      if (!sender) {
        return;
      }
      
      title = `New message from ${sender.username}`;
      body = truncateText(decryptedContent, 50);
    }
    
    window.electronAPI.showNotification({ title, body });
    
  } catch (error) {
    console.error('Error showing notification:', error);
  }
}

// Mark a chat as read
function markAsRead(chatId) {
  const unreadMessages = JSON.parse(localStorage.getItem('unreadMessages') || '{}');
  
  if (unreadMessages[chatId]) {
    unreadMessages[chatId] = 0;
    localStorage.setItem('unreadMessages', JSON.stringify(unreadMessages));
  }
}

// Helper function to truncate text
function truncateText(text, maxLength) {
  if (!text) return '';
  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}

// Force a manual reconnection
function forceReconnect() {
  if (socket) {
    // Disconnect if connected
    if (socket.connected) {
      socket.disconnect();
    }
    
    // Reset reconnection counter
    connectionManager.resetReconnectAttempts();
    
    // Set state to reconnecting
    connectionManager.setState(ConnectionState.RECONNECTING, {
      message: 'Manual reconnection initiated'
    });
    
    // Connect socket
    socket.connect();
  }
}

// Add a message to the queue
function queueMessage(message) {
  return messageQueue.enqueue(message);
}

// Export functions and variables
export {
  connectSocket,
  setupSocketEventHandlers,
  showMessageNotification,
  markAsRead,
  forceReconnect,
  queueMessage,
  sendDirectMessage,
  sendGroupMessage,
  processMessageQueue
};