// electron-client/renderer/assets/js/chat/storage.js

// Get contact messages from localStorage
function getContactMessages() {
    return JSON.parse(localStorage.getItem('contactMessages') || '{}');
  }
  
  // Save message to local storage
  function saveMessage(chatId, message) {
    const contactMessages = getContactMessages();
    
    if (!contactMessages[chatId]) {
      contactMessages[chatId] = [];
    }
    
    // Add message
    contactMessages[chatId].push(message);
    
    // Keep only the most recent 100 messages per chat
    if (contactMessages[chatId].length > 100) {
      contactMessages[chatId] = contactMessages[chatId].slice(-100);
    }
    
    // Save to localStorage
    saveContactMessages(contactMessages);
    
    return contactMessages;
  }
  
  // Save contact messages to localStorage
  function saveContactMessages(contactMessages) {
    try {
      localStorage.setItem('contactMessages', JSON.stringify(contactMessages));
    } catch (error) {
      console.error('Error saving contact messages to localStorage:', error);
      // If localStorage is full, clear it and try again
      if (error.name === 'QuotaExceededError') {
        localStorage.clear();
        localStorage.setItem('contactMessages', JSON.stringify(contactMessages));
      }
    }
  }
  
  // Get last message for a chat
  function getLastMessage(chatId) {
    const contactMessages = getContactMessages();
    
    if (contactMessages[chatId] && contactMessages[chatId].length > 0) {
      const messages = contactMessages[chatId];
      return messages[messages.length - 1];
    }
    return null;
  }
  
  // Get unread messages from localStorage
  function getUnreadMessages() {
    return JSON.parse(localStorage.getItem('unreadMessages') || '{}');
  }
  
  // Increment unread message count
  function incrementUnreadCount(chatId) {
    const unreadMessages = getUnreadMessages();
    
    if (!unreadMessages[chatId]) {
      unreadMessages[chatId] = 0;
    }
    unreadMessages[chatId]++;
    
    // Save to localStorage
    localStorage.setItem('unreadMessages', JSON.stringify(unreadMessages));
    
    return unreadMessages;
  }
  
  // Get unread count for a chat
  function getUnreadCount(chatId) {
    const unreadMessages = getUnreadMessages();
    return unreadMessages[chatId] || 0;
  }
  
  // Clear old messages (optional, can be used to free up localStorage space)
  function clearOldMessages() {
    const contactMessages = getContactMessages();
    const now = new Date();
    
    // Only keep messages from the last 30 days
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    for (const chatId in contactMessages) {
      if (contactMessages.hasOwnProperty(chatId)) {
        contactMessages[chatId] = contactMessages[chatId].filter(message => {
          const messageDate = new Date(message.timestamp);
          return messageDate >= thirtyDaysAgo;
        });
      }
    }
    
    saveContactMessages(contactMessages);
    return contactMessages;
  }
  
  export {
    getContactMessages,
    saveMessage,
    saveContactMessages,
    getLastMessage,
    getUnreadMessages,
    incrementUnreadCount,
    getUnreadCount,
    clearOldMessages
  };