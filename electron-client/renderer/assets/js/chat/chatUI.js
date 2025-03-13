// electron-client/renderer/assets/js/chat/chatUI.js

import { getUnreadCount, getLastMessage } from './storage.js';

// DOM elements
const currentUsername = document.getElementById('current-username');
const contactList = document.getElementById('contact-list');
const groupList = document.getElementById('group-list');
const welcomeScreen = document.getElementById('welcome-screen');
const chatInterface = document.getElementById('chat-interface');
const chatTitle = document.getElementById('chat-title');
const chatInfo = document.getElementById('chat-info');
const messagesContainer = document.getElementById('messages-container');
const messageInput = document.getElementById('message-input');
const createGroupModal = document.getElementById('create-group-modal');
const groupMembersList = document.getElementById('group-members-list');

// Initialize theme settings
function initializeTheme() {
  const themeSwitch = document.getElementById('theme-switch');
  if (!themeSwitch) return;
  
  // Check if user has a saved preference
  const savedTheme = localStorage.getItem('theme');
  
  // Set initial state based on saved preference
  if (savedTheme === 'dark') {
    document.body.classList.add('dark-theme');
    themeSwitch.checked = true;
  }
  
  // Listen for theme toggle changes
  themeSwitch.addEventListener('change', function() {
    if (this.checked) {
      document.body.classList.add('dark-theme');
      localStorage.setItem('theme', 'dark');
    } else {
      document.body.classList.remove('dark-theme');
      localStorage.setItem('theme', 'light');
    }
  });
}

// Render the list of contacts in the UI
function renderContactList(contacts) {
  if (!contactList) return;
  
  if (contacts.length === 0) {
    contactList.innerHTML = '<li class="contact-item empty">No contacts available</li>';
    return;
  }
  
  const html = contacts.map(contact => {
    // Get last message for preview
    const lastMessage = getLastMessage(contact.id) || { content: '', timestamp: null };
    const previewText = lastMessage.content ? truncateText(lastMessage.content, 30) : 'No messages yet';
    const timeString = lastMessage.timestamp ? formatTimeAgo(new Date(lastMessage.timestamp)) : '';
    
    // Get unread count
    const unreadCount = getUnreadCount(contact.id);
    const unreadBadge = unreadCount > 0 ? 
      `<span class="unread-badge">${unreadCount > 99 ? '99+' : unreadCount}</span>` : '';
    
    return `
      <li class="contact-item ${unreadCount > 0 ? 'unread' : ''}" data-id="${contact.id}" data-type="direct">
        <div class="contact-info">
          <div class="contact-name">${escapeHtml(contact.username)}</div>
          <div class="message-preview">${escapeHtml(previewText)}</div>
        </div>
        <div class="contact-meta">
          ${timeString ? `<div class="timestamp">${timeString}</div>` : ''}
          ${unreadBadge}
          <div class="contact-status">
            ${contact.has_key ? 
              '<span class="status-indicator secure" title="Encrypted messaging enabled"></span>' : 
              '<span class="status-indicator insecure" title="Contact has not set up encryption"></span>'}
          </div>
        </div>
      </li>
    `;
  }).join('');
  
  contactList.innerHTML = html;
}

// Render the list of groups in the UI
function renderGroupList(groups) {
  if (!groupList) return;
  
  if (groups.length === 0) {
    groupList.innerHTML = '<li class="group-item empty">No groups available</li>';
    return;
  }
  
  const html = groups.map(group => {
    // Get last message for preview
    const groupId = `group_${group.id}`;
    const lastMessage = getLastMessage(groupId) || { content: '', timestamp: null };
    const previewText = lastMessage.content ? truncateText(lastMessage.content, 30) : 'No messages yet';
    const timeString = lastMessage.timestamp ? formatTimeAgo(new Date(lastMessage.timestamp)) : '';
    
    // Get unread count
    const unreadCount = getUnreadCount(groupId);
    const unreadBadge = unreadCount > 0 ? 
      `<span class="unread-badge">${unreadCount > 99 ? '99+' : unreadCount}</span>` : '';
    
    return `
      <li class="group-item ${unreadCount > 0 ? 'unread' : ''}" data-id="${group.id}" data-type="group">
        <div class="contact-info">
          <div class="contact-name">${escapeHtml(group.name)}</div>
          <div class="message-preview">${escapeHtml(previewText)}</div>
        </div>
        <div class="contact-meta">
          ${timeString ? `<div class="timestamp">${timeString}</div>` : ''}
          ${unreadBadge}
        </div>
      </li>
    `;
  }).join('');
  
  groupList.innerHTML = html;
}

// Add a message to the UI
function addMessageToUI(senderId, content, timestamp, isFromMe, contacts) {
  const messageEl = document.createElement('div');
  messageEl.classList.add('message');
  
  if (isFromMe) {
    messageEl.classList.add('sent');
    messageEl.innerHTML = `
      <div class="message-content">${escapeHtml(content)}</div>
      <div class="message-meta">
        <span class="message-time">${formatTime(timestamp)}</span>
        <span class="message-status sent">Sent</span>
      </div>
    `;
  } else {
    messageEl.classList.add('received');
    
    // Find the sender's username
    let senderName = 'Unknown User';
    const sender = contacts.find(c => c.id === senderId);
    if (sender) {
      senderName = sender.username;
    }
    
    messageEl.innerHTML = `
      <div class="message-sender">${senderName}</div>
      <div class="message-content">${escapeHtml(content)}</div>
      <div class="message-meta">${formatTime(timestamp)}</div>
    `;
  }
  
  messagesContainer.appendChild(messageEl);
  
  // Scroll to bottom if we're already near the bottom
  if (isNearBottom()) {
    scrollToBottom();
  }
  
  return messageEl;
}

// Show create group modal
function showCreateGroupModal(contacts) {
  // Populate the members list with all contacts
  let html = '';
  
  if (contacts.length === 0) {
    html = '<div class="no-contacts">No contacts available to add</div>';
  } else {
    html = contacts.map(contact => `
      <div class="checkbox-item">
        <input type="checkbox" id="member-${contact.id}" name="members" value="${contact.id}">
        <label for="member-${contact.id}">${escapeHtml(contact.username)}</label>
      </div>
    `).join('');
  }
  
  groupMembersList.innerHTML = html;
  
  // Show the modal
  createGroupModal.classList.remove('hidden');
  
  // Focus the group name input
  document.getElementById('group-name').focus();
}

// Hide create group modal
function hideCreateGroupModal() {
  createGroupModal.classList.add('hidden');
  document.getElementById('group-name').value = '';
  groupMembersList.innerHTML = '';
}

// Select a chat (direct or group)
function selectChat(type, id) {
  let currentChat = { type, id };
  
  // Show the chat interface, hide welcome screen
  welcomeScreen.classList.add('hidden');
  chatInterface.classList.remove('hidden');
  
  // Update the chat title and info
  if (type === 'direct') {
    const contacts = JSON.parse(localStorage.getItem('contacts') || '[]');
    const contact = contacts.find(c => c.id === id);
    if (contact) {
      chatTitle.textContent = contact.username;
      chatInfo.textContent = contact.has_key ? 'Messages are encrypted' : 'Encryption unavailable';
    }
  } else if (type === 'group') {
    const groups = JSON.parse(localStorage.getItem('groups') || '[]');
    const group = groups.find(g => g.id === id);
    if (group) {
      chatTitle.textContent = group.name;
      chatInfo.textContent = `Created by ${group.created_by_name}`;
    }
  }
  
  // Store the current chat in localStorage
  localStorage.setItem('currentChat', JSON.stringify(currentChat));
  
  // Clear the messages container
  messagesContainer.innerHTML = '';
  
  // Focus the message input
  messageInput.focus();
  
  return currentChat;
}

// Render messages in UI
function renderMessages(messages, contacts) {
  // Clear container
  messagesContainer.innerHTML = '';
  
  if (!messages || messages.length === 0) {
    messagesContainer.innerHTML = '<div class="no-messages">No messages yet. Send the first message!</div>';
    return;
  }
  
  // Display messages
  messages.forEach(message => {
    addMessageToUI(
      message.sender_id, 
      message.content, 
      new Date(message.timestamp), 
      message.isFromMe,
      contacts
    );
  });
  
  // Scroll to bottom
  scrollToBottom();
}

// Update the connection status UI
function updateConnectionStatusUI(state, data = {}) {
  const connectionStatusIndicator = document.getElementById('connection-status-indicator');
  const connectionStatusText = document.getElementById('connection-status-text');
  
  if (!connectionStatusIndicator || !connectionStatusText) return;
  
  // Remove all state classes
  connectionStatusIndicator.classList.remove(
    'connecting', 'connected', 'disconnected', 'reconnecting', 'error'
  );
  
  // Add the current state class
  connectionStatusIndicator.classList.add(state);
  
  // Update the status text
  switch (state) {
    case 'connecting':
      connectionStatusText.textContent = 'Connecting...';
      break;
    case 'connected':
      connectionStatusText.textContent = 'Connected';
      break;
    case 'disconnected':
      connectionStatusText.textContent = 'Disconnected';
      break;
    case 'reconnecting':
      connectionStatusText.textContent = `Reconnecting${data.attempt ? ' (' + data.attempt + ')' : ''}...`;
      break;
    case 'reconnect_failed':
      connectionStatusText.textContent = 'Reconnection failed';
      break;
    case 'error':
      connectionStatusText.textContent = 'Connection Error';
      break;
    default:
      connectionStatusText.textContent = state;
  }
}

// Helper function to check if we're near the bottom of the messages container
function isNearBottom() {
  const threshold = 100; // pixels
  const position = messagesContainer.scrollHeight - messagesContainer.scrollTop - messagesContainer.clientHeight;
  return position < threshold;
}

// Helper function to scroll to the bottom of the messages container
function scrollToBottom() {
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Helper function to format time for display
function formatTime(date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Helper function to format time ago
function formatTimeAgo(date) {
  const now = new Date();
  const diff = Math.floor((now - date) / 1000);
  
  if (diff < 60) return 'Just now';
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
  
  // For older messages, show the date
  if (date.toDateString() === now.toDateString()) {
    return formatTime(date);
  } else if (now - date < 7 * 86400 * 1000) {
    // Within the last week, show day name
    return date.toLocaleDateString(undefined, { weekday: 'short' });
  } else {
    // Older messages, show date
    return date.toLocaleDateString();
  }
}

// Helper function to truncate text
function truncateText(text, maxLength) {
  if (!text) return '';
  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}

// Helper function to escape HTML special characters
function escapeHtml(unsafe) {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Export all necessary functions
export {
  initializeTheme,
  renderContactList,
  renderGroupList,
  addMessageToUI,
  renderMessages,
  showCreateGroupModal,
  hideCreateGroupModal,
  selectChat,
  scrollToBottom,
  updateConnectionStatusUI,
  escapeHtml,
  formatTime,
  formatTimeAgo,
  truncateText,
  isNearBottom
};