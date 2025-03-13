// electron-client/renderer/assets/js/chat/messageQueue.js

// Message status types
const MessageStatus = {
    PENDING: 'pending',   // Message is waiting to be sent
    SENDING: 'sending',   // Message is being sent
    SENT: 'sent',         // Message was sent to server
    DELIVERED: 'delivered', // Server confirmed delivery
    FAILED: 'failed'      // Failed to send message
  };
  
  class MessageQueue {
    constructor() {
      // Initialize queue from localStorage if available
      this.queue = this.loadQueue();
      
      // Set up auto-save for queue changes
      this.setupAutoSave();
    }
    
    // Load the message queue from localStorage
    loadQueue() {
      try {
        const savedQueue = localStorage.getItem('messageQueue');
        return savedQueue ? JSON.parse(savedQueue) : [];
      } catch (error) {
        console.error('Error loading message queue from localStorage:', error);
        return [];
      }
    }
    
    // Save the current queue to localStorage
    saveQueue() {
      try {
        localStorage.setItem('messageQueue', JSON.stringify(this.queue));
      } catch (error) {
        console.error('Error saving message queue to localStorage:', error);
        // If quota exceeded, remove oldest messages
        if (error.name === 'QuotaExceededError' && this.queue.length > 0) {
          this.queue = this.queue.slice(Math.floor(this.queue.length / 2));
          this.saveQueue();
        }
      }
    }
    
    // Set up auto-save using a debounce approach
    setupAutoSave() {
      this.saveTimeout = null;
      
      // Override array mutation methods to trigger saves
      const originalPush = Array.prototype.push;
      const originalSplice = Array.prototype.splice;
      
      this.queue.push = (...args) => {
        const result = originalPush.apply(this.queue, args);
        this.triggerSave();
        return result;
      };
      
      this.queue.splice = (...args) => {
        const result = originalSplice.apply(this.queue, args);
        this.triggerSave();
        return result;
      };
    }
    
    // Trigger a save with debounce
    triggerSave() {
      if (this.saveTimeout) {
        clearTimeout(this.saveTimeout);
      }
      
      this.saveTimeout = setTimeout(() => {
        this.saveQueue();
      }, 300); // Debounce for 300ms
    }
    
    // Add a message to the queue
    enqueue(message) {
      // Add metadata for queue management
      const queuedMessage = {
        ...message,
        queuedAt: new Date().toISOString(),
        status: MessageStatus.PENDING,
        attempts: 0,
        id: `local_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`
      };
      
      this.queue.push(queuedMessage);
      return queuedMessage;
    }
    
    // Get the next pending message from the queue
    getNextPending() {
      return this.queue.find(msg => msg.status === MessageStatus.PENDING);
    }
    
    // Get all pending messages
    getAllPending() {
      return this.queue.filter(msg => msg.status === MessageStatus.PENDING);
    }
    
    // Update a message's status
    updateStatus(messageId, status, serverData = null) {
      const message = this.queue.find(msg => msg.id === messageId);
      
      if (message) {
        message.status = status;
        
        if (status === MessageStatus.SENDING) {
          message.attempts += 1;
          message.lastAttempt = new Date().toISOString();
        }
        
        if (status === MessageStatus.SENT || status === MessageStatus.DELIVERED) {
          message.sentAt = new Date().toISOString();
          
          // If we got server data (like a server-assigned ID), save it
          if (serverData) {
            message.serverData = serverData;
          }
        }
        
        if (status === MessageStatus.FAILED) {
          message.failedAt = new Date().toISOString();
        }
        
        this.triggerSave();
      }
      
      return message;
    }
    
    // Remove a message from the queue (e.g., after successful delivery)
    remove(messageId) {
      const index = this.queue.findIndex(msg => msg.id === messageId);
      
      if (index !== -1) {
        const [removedMessage] = this.queue.splice(index, 1);
        return removedMessage;
      }
      
      return null;
    }
    
    // Clear successfully sent messages that are older than a certain time
    clearOldSentMessages(maxAgeMs = 24 * 60 * 60 * 1000) { // Default: 24 hours
      const now = new Date();
      
      this.queue = this.queue.filter(msg => {
        // Keep all non-sent messages
        if (msg.status !== MessageStatus.SENT && msg.status !== MessageStatus.DELIVERED) {
          return true;
        }
        
        // Check age of sent messages
        const sentAt = new Date(msg.sentAt);
        return (now - sentAt) < maxAgeMs;
      });
      
      this.saveQueue();
      return this.queue;
    }
    
    // Reset failed messages to pending to try again
    resetFailedMessages() {
      const resetMessages = [];
      
      this.queue.forEach(msg => {
        if (msg.status === MessageStatus.FAILED) {
          msg.status = MessageStatus.PENDING;
          resetMessages.push(msg);
        }
      });
      
      if (resetMessages.length > 0) {
        this.triggerSave();
      }
      
      return resetMessages;
    }
  }
  
  // Create and export a singleton instance
  const messageQueue = new MessageQueue();
  
  export {
    messageQueue,
    MessageStatus
  };