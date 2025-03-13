// electron-client/renderer/assets/js/chat/messageHandler.js

import { encryptMessage, encryptGroupMessage, decryptMessage } from './encryption.js';
import { saveMessage, getContactMessages } from './storage.js';
import { renderMessages, scrollToBottom, escapeHtml, formatTime } from './chatUI.js';
import { queueMessage, sendDirectMessage, sendGroupMessage, processMessageQueue } from './socketHandler.js';
import { connectionManager, ConnectionState } from './connectionManager.js';
import { messageQueue, MessageStatus } from './messageQueue.js';

// DOM elements
const messagesContainer = document.getElementById('messages-container');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');

// Send a message
async function sendMessage() {
  const content = messageInput.value.trim();
  const currentChat = JSON.parse(localStorage.getItem('currentChat') || 'null');
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  if (!content || !currentChat) {
    return;
  }

  try {
    // Disable the send button to prevent multiple sends
    sendButton.disabled = true;
    
    let encryptedContent, messageType, payload;
    
    if (currentChat.type === 'direct') {
      // Encrypt the message using the recipient's public key
      encryptedContent = encryptMessage(content, currentChat.id);
      messageType = 'direct';
      
      payload = {
        type: messageType,
        recipientId: currentChat.id,
        encryptedContent,
        content: content // Unencrypted content for local display
      };
    } else if (currentChat.type === 'group') {
      // For groups, we need to encrypt the message for all members
      encryptedContent = await encryptGroupMessage(content, currentChat.id);
      messageType = 'group';
      
      payload = {
        type: messageType,
        groupId: currentChat.id,
        encryptedContent,
        content: content // Unencrypted content for local display
      };
    }
    
    // Create a local message object for immediate display
    const localMessage = {
      sender_id: user.id,
      content: content,
      timestamp: new Date().toISOString(),
      isFromMe: true
    };
    
    // Save the message locally
    const chatId = currentChat.type === 'direct' ? 
      currentChat.id : `group_${currentChat.id}`;
    
    saveMessage(chatId, localMessage);
    
    // Add the message to the UI immediately
    const messageEl = document.createElement('div');
    messageEl.classList.add('message', 'sent');
    messageEl.innerHTML = `
      <div class="message-content">${escapeHtml(content)}</div>
      <div class="message-meta">
        <span class="message-time">${formatTime(new Date())}</span>
        <span class="message-status pending">Sending...</span>
      </div>
    `;
    messagesContainer.appendChild(messageEl);
    
    // Scroll to bottom
    scrollToBottom();
    
    // Clear the input
    messageInput.value = '';
    
    // Get the current connection state
    const connectionState = connectionManager.state;
    
    if (connectionState === ConnectionState.CONNECTED) {
      // If connected, send immediately
      try {
        // Queue the message first
        const queuedMessage = queueMessage(payload);
        
        // Attach the DOM element to the message for status updates
        queuedMessage.element = messageEl;
        
        // Try to send immediately
        if (messageType === 'direct') {
          await sendDirectMessage(queuedMessage);
        } else if (messageType === 'group') {
          await sendGroupMessage(queuedMessage);
        }
        
        // Update UI with sent status
        updateMessageUI(messageEl, 'sent');
      } catch (error) {
        console.error('Error sending message:', error);
        // Message stays in the queue and will be retried
        updateMessageUI(messageEl, 'failed');
      }
    } else {
      // If not connected, just queue it
      const queuedMessage = queueMessage(payload);
      queuedMessage.element = messageEl;
      
      // Update UI to show that message is queued
      updateMessageUI(messageEl, 'queued');
    }

  } catch (error) {
    console.error('Error sending message:', error);
    showErrorToast('Failed to send message: ' + error.message);
  } finally {
    // Re-enable the send button
    sendButton.disabled = false;
    
    // Focus the input
    messageInput.focus();
  }
}

// Load direct message history
async function loadDirectMessages(contactId) {
  try {
    // First make sure we have the recipient's public key
    const contactPublicKeys = JSON.parse(localStorage.getItem('contactPublicKeys') || '{}');
    if (!contactPublicKeys[contactId]) {
      throw new Error('Recipient public key not found');
    }
    
    // Show loading indicator
    messagesContainer.innerHTML = '<div class="loading-messages">Loading messages...</div>';
    
    // Check if we have cached messages
    let messages = [];
    const contactMessages = getContactMessages();
    if (contactMessages[contactId] && contactMessages[contactId].length > 0) {
      // Use cached messages
      messages = contactMessages[contactId];
      renderMessages(messages);
    } else {
      // Fetch from server
      const token = localStorage.getItem('token');
      const response = await fetch(`${window.serverConfig.baseUrl}/api/messages/direct/${contactId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load messages');
      }
      
      const serverMessages = await response.json();
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const contacts = JSON.parse(localStorage.getItem('contacts') || '[]');
      
      // Clear container
      messagesContainer.innerHTML = '';
      
      if (serverMessages.length === 0) {
        messagesContainer.innerHTML = '<div class="no-messages">No messages yet. Send the first message!</div>';
        return;
      }
      
      // Process and display messages
      processServerMessages(serverMessages, contactId, user, contacts);
    }
  } catch (error) {
    console.error('Error loading direct messages:', error);
    messagesContainer.innerHTML = `<div class="error-messages">Error: ${error.message}</div>`;
  }
}

// Load group message history
async function loadGroupMessages(groupId) {
  try {
    // Show loading indicator
    messagesContainer.innerHTML = '<div class="loading-messages">Loading messages...</div>';
    
    // Check if we have cached messages
    const groupChatId = `group_${groupId}`;
    let messages = [];
    const contactMessages = getContactMessages();
    if (contactMessages[groupChatId] && contactMessages[groupChatId].length > 0) {
      // Use cached messages
      messages = contactMessages[groupChatId];
      renderMessages(messages);
    } else {
      // Fetch from server
      const token = localStorage.getItem('token');
      const response = await fetch(`${window.serverConfig.baseUrl}/api/messages/group/${groupId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load group messages');
      }
      
      const serverMessages = await response.json();
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const contacts = JSON.parse(localStorage.getItem('contacts') || '[]');
      
      // Clear container
      messagesContainer.innerHTML = '';
      
      if (serverMessages.length === 0) {
        messagesContainer.innerHTML = '<div class="no-messages">No messages in this group yet. Send the first message!</div>';
        return;
      }
      
      // Process and display messages
      processGroupServerMessages(serverMessages, groupId, user, contacts);
    }
  } catch (error) {
    console.error('Error loading group messages:', error);
    messagesContainer.innerHTML = `<div class="error-messages">Error: ${error.message}</div>`;
  }
}

// Process server messages for direct chats
function processServerMessages(serverMessages, contactId, user, contacts) {
  let processedMessages = [];
  
  for (const message of serverMessages) {
    const isFromMe = message.sender_id === user.id;
    const senderId = isFromMe ? user.id : contactId;
    
    try {
      const content = decryptMessage(message.encrypted_content, senderId);
      
      // Save the processed message
      const processedMessage = {
        id: message.id,
        sender_id: senderId,
        content: content,
        timestamp: message.timestamp,
        isFromMe: isFromMe
      };
      
      // Add to messages array for display
      processedMessages.push(processedMessage);
      
      // Save to contact messages
      saveMessage(contactId, processedMessage);
    } catch (error) {
      console.error('Error decrypting message:', error);
      // Add error message instead
      processedMessages.push({
        id: message.id,
        sender_id: senderId,
        content: '[Encrypted message - unable to decrypt]',
        timestamp: message.timestamp,
        isFromMe: isFromMe
      });
    }
  }
  
  // Render messages
  renderMessages(processedMessages, contacts);
}

// Process server messages for group chats
function processGroupServerMessages(serverMessages, groupId, user, contacts) {
  let processedMessages = [];
  const groupChatId = `group_${groupId}`;
  
  for (const message of serverMessages) {
    const isFromMe = message.sender_id === user.id;
    
    try {
      const content = decryptMessage(message.encrypted_content, message.sender_id);
      
      // Save the processed message
      const processedMessage = {
        id: message.id,
        sender_id: message.sender_id,
        content: content,
        timestamp: message.timestamp,
        isFromMe: isFromMe
      };
      
      // Add to messages array for display
      processedMessages.push(processedMessage);
      
      // Save to contact messages
      saveMessage(groupChatId, processedMessage);
    } catch (error) {
      console.error('Error decrypting group message:', error);
      // Add error message instead
      processedMessages.push({
        id: message.id,
        sender_id: message.sender_id,
        content: '[Encrypted message - unable to decrypt]',
        timestamp: message.timestamp,
        isFromMe: isFromMe
      });
    }
  }
  
  // Render messages
  renderMessages(processedMessages, contacts);
}

// Handle create group form submission
async function handleCreateGroup(e) {
  e.preventDefault();
  
  const groupName = document.getElementById('group-name').value.trim();
  
  if (!groupName) {
    return;
  }
  
  // Get selected members
  const selectedMembers = Array.from(
    document.querySelectorAll('input[name="members"]:checked')
  ).map(checkbox => parseInt(checkbox.value));
  
  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`${window.serverConfig.baseUrl}/api/messages/groups`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        name: groupName,
        memberIds: selectedMembers
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to create group');
    }
    
    const newGroup = await response.json();
    
    // Hide the modal
    document.getElementById('create-group-modal').classList.add('hidden');
    
    // Add the new group to the local storage
    const groups = JSON.parse(localStorage.getItem('groups') || '[]');
    groups.push(newGroup);
    localStorage.setItem('groups', JSON.stringify(groups));
    
    // Update UI
    window.location.reload(); // Refresh to update the groups list
    
  } catch (error) {
    console.error('Error creating group:', error);
    showErrorToast('Failed to create group: ' + error.message);
  }
}

// Update the message UI based on status
function updateMessageUI(messageElement, status) {
  if (!messageElement) return;
  
  const statusElement = messageElement.querySelector('.message-status');
  if (!statusElement) return;
  
  // Remove all status classes
  statusElement.classList.remove('pending', 'queued', 'sent', 'delivered', 'failed');
  
  // Add the appropriate status class
  statusElement.classList.add(status);
  
  // Update the status text
  switch (status) {
    case 'pending':
      statusElement.textContent = 'Sending...';
      break;
    case 'queued':
      statusElement.textContent = 'Queued';
      break;
    case 'sent':
      statusElement.textContent = 'Sent';
      break;
    case 'delivered':
      statusElement.textContent = 'Delivered';
      break;
    case 'failed':
      statusElement.textContent = 'Failed';
      break;
    default:
      statusElement.textContent = status;
  }
}

// Show an error toast message
function showErrorToast(message) {
  const toast = document.createElement('div');
  toast.className = 'error-toast';
  toast.textContent = message;
  
  document.body.appendChild(toast);
  
  // Remove after a delay
  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 500);
  }, 5000);
}

// Export all necessary functions
export {
  sendMessage,
  loadDirectMessages,
  loadGroupMessages,
  handleCreateGroup,
  processServerMessages,
  processGroupServerMessages,
  updateMessageUI,
  showErrorToast
};