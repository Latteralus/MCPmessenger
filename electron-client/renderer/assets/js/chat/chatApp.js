// electron-client/renderer/assets/js/chat/chatApp.js

import { renderContactList, renderGroupList, initializeTheme, showCreateGroupModal, hideCreateGroupModal, selectChat, updateConnectionStatusUI } from './chatUI.js';
import { loadDirectMessages, loadGroupMessages, sendMessage, handleCreateGroup } from './messageHandler.js';
import { loadUserKeys, preloadContactPublicKeys } from './encryption.js';
import { getUnreadMessages, getContactMessages } from './storage.js';
import { connectSocket, processMessageQueue } from './socketHandler.js';
import { connectionManager, ConnectionState } from './connectionManager.js';
import { messageQueue, MessageStatus } from './messageQueue.js';
import { syncManager } from './syncManager.js';

// State variables
let currentChat = null; // Currently selected chat
let contacts = []; // List of all contacts
let groups = []; // List of all groups
let user = null; // Current user info

// Initialize the chat application
async function initialize() {
  try {
    // Get user info
    user = JSON.parse(localStorage.getItem('user') || '{}');
    
    if (!user.id) {
      throw new Error('User not logged in');
    }
    
    // Load user's encryption keys
    await loadUserKeys(user.id);
    
    // Connect to the server via WebSocket
    connectSocket(user.id);
    
    // Listen for connection state changes
    connectionManager.addStateChangeListener((newState, oldState, data) => {
      // Update UI to reflect connection state
      updateConnectionStatusUI(newState, data);
      
      // If reconnected, process message queue
      if (oldState !== ConnectionState.CONNECTED && newState === ConnectionState.CONNECTED) {
        processMessageQueue();
      }
    });
    
    // Load contacts and groups
    await Promise.all([
      loadContacts(),
      loadGroups()
    ]);
    
    // Initialize unread messages tracking
    getUnreadMessages();
    getContactMessages();
    
    // Set up event listeners
    setupEventListeners();
    
    // Initialize theme
    initializeTheme();
    
    // Check admin status
    checkAdminStatus();
    
  } catch (error) {
    console.error('Initialization error:', error);
    alert('Failed to initialize chat: ' + error.message);
  }
}

// Load list of contacts (other users)
async function loadContacts() {
  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`${window.serverConfig.baseUrl}/api/messages/users`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to load contacts');
    }
    
    contacts = await response.json();
    
    // Save contacts to localStorage for persistence
    localStorage.setItem('contacts', JSON.stringify(contacts));
    
    // Update the UI
    renderContactList(contacts);
    
    // Preload public keys for all contacts
    preloadContactPublicKeys(contacts);
    
  } catch (error) {
    console.error('Error loading contacts:', error);
    throw error;
  }
}

// Load list of groups
async function loadGroups() {
  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`${window.serverConfig.baseUrl}/api/messages/groups`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to load groups');
    }
    
    groups = await response.json();
    
    // Save groups to localStorage for persistence
    localStorage.setItem('groups', JSON.stringify(groups));
    
    // Update the UI
    renderGroupList(groups);
    
  } catch (error) {
    console.error('Error loading groups:', error);
    throw error;
  }
}

// Set up event listeners
function setupEventListeners() {
  const sendButton = document.getElementById('send-button');
  const messageInput = document.getElementById('message-input');
  const createGroupBtn = document.getElementById('create-group-btn');
  const cancelCreateGroup = document.getElementById('cancel-create-group');
  const createGroupForm = document.getElementById('create-group-form');
  const reconnectButton = document.getElementById('reconnect-button');
  
  // Send message button
  if (sendButton) {
    sendButton.addEventListener('click', () => sendMessage());
  }
  
  // Send message on Enter key
  if (messageInput) {
    messageInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
  }
  
  // Create group button
  if (createGroupBtn) {
    createGroupBtn.addEventListener('click', () => showCreateGroupModal(contacts));
  }
  
  // Cancel create group button
  if (cancelCreateGroup) {
    cancelCreateGroup.addEventListener('click', hideCreateGroupModal);
  }
  
  // Create group form submission
  if (createGroupForm) {
    createGroupForm.addEventListener('submit', handleCreateGroup);
  }
  
  // Manual reconnect button
  if (reconnectButton) {
    reconnectButton.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('connection_reconnect_requested'));
    });
  }
  
  // Set up contact list click handlers
  setupContactListEventListeners();
  
  // Set up group list click handlers
  setupGroupListEventListeners();
  
  // Listen for unread message updates
  window.addEventListener('unreadMessagesUpdated', () => {
    renderContactList(contacts);
  });
  
  // Listen for unread group message updates
  window.addEventListener('groupUnreadMessagesUpdated', () => {
    renderGroupList(groups);
  });
  
  // Listen for new synced messages
  window.addEventListener('new_synced_messages', (event) => {
    const { chatType, chatId, messages } = event.detail;
    
    // If this is the current chat, reload messages
    if (currentChat && currentChat.type === chatType && currentChat.id === chatId) {
      if (chatType === 'direct') {
        loadDirectMessages(chatId);
      } else if (chatType === 'group') {
        loadGroupMessages(chatId);
      }
    }
    
    // Otherwise update unread counts and lists
    else {
      if (chatType === 'direct') {
        renderContactList(contacts);
      } else if (chatType === 'group') {
        renderGroupList(groups);
      }
    }
  });
}

// Set up event listeners for contact list items
function setupContactListEventListeners() {
  document.querySelectorAll('.contact-item[data-type="direct"]').forEach(item => {
    item.addEventListener('click', handleContactClick);
  });
}

// Set up event listeners for group list items
function setupGroupListEventListeners() {
  document.querySelectorAll('.group-item[data-type="group"]').forEach(item => {
    item.addEventListener('click', handleGroupClick);
  });
}

// Handle clicking on a contact
async function handleContactClick(e) {
  const contactItem = e.currentTarget;
  const contactId = parseInt(contactItem.dataset.id);
  
  // Select this contact
  currentChat = selectChat('direct', contactId);
  
  // Highlight the selected contact
  document.querySelectorAll('.contact-item, .group-item').forEach(item => {
    item.classList.remove('active');
  });
  contactItem.classList.add('active');
  
  // Mark messages as read
  markAsRead(contactId);
  
  // Load the conversation history
  await loadDirectMessages(contactId);
}

// Handle clicking on a group
async function handleGroupClick(e) {
  const groupItem = e.currentTarget;
  const groupId = parseInt(groupItem.dataset.id);
  
  // Select this group
  currentChat = selectChat('group', groupId);
  
  // Highlight the selected group
  document.querySelectorAll('.contact-item, .group-item').forEach(item => {
    item.classList.remove('active');
  });
  groupItem.classList.add('active');
  
  // Mark messages as read
  markAsRead(`group_${groupId}`);
  
  // Load the group chat history
  await loadGroupMessages(groupId);
}

// Check if user is admin and show admin link if needed
function checkAdminStatus() {
  const adminLink = document.getElementById('admin-link');
  if (!adminLink) return;
  
  // Get stored user data
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  
  if (user && user.isAdmin) {
    // User is admin, show the link
    adminLink.classList.remove('hidden');
    localStorage.setItem('userIsAdmin', 'true');
    
    // Add click event to admin link
    const adminDashboardLink = document.getElementById('admin-dashboard-link');
    if (adminDashboardLink) {
      adminDashboardLink.addEventListener('click', (e) => {
        e.preventDefault();
        console.log('Navigating to admin dashboard');
        window.electronAPI.navigate({ page: 'admin.html' })
          .catch(error => {
            console.error('Navigation error:', error);
            showErrorMessage('Failed to navigate to admin dashboard: ' + error.message);
          });
      });
    }
  } else {
    // User is not admin, hide the link
    adminLink.classList.add('hidden');
    localStorage.setItem('userIsAdmin', 'false');
  }
  
  // Update the menu in the main process
  window.electronAPI.updateAdminStatus({ 
    isAdmin: user && user.isAdmin 
  }).catch(error => {
    console.error('Error updating admin status:', error);
  });
}

// Mark messages as read
function markAsRead(chatId) {
  const unreadMessages = JSON.parse(localStorage.getItem('unreadMessages') || '{}');
  
  if (unreadMessages[chatId]) {
    unreadMessages[chatId] = 0;
    localStorage.setItem('unreadMessages', JSON.stringify(unreadMessages));
    
    // Update UI
    renderContactList(contacts);
    renderGroupList(groups);
  }
}

// Show error message
function showErrorMessage(message) {
  const errorNotification = document.createElement('div');
  errorNotification.className = 'error-notification';
  errorNotification.textContent = message;
  
  document.body.appendChild(errorNotification);
  
  setTimeout(() => {
    errorNotification.classList.add('fade-out');
    setTimeout(() => {
      errorNotification.remove();
    }, 500);
  }, 5000);
}

// Export functions and variables
export {
  initialize,
  loadContacts,
  loadGroups,
  currentChat,
  contacts,
  groups,
  user,
  handleContactClick,
  handleGroupClick,
  markAsRead,
  showErrorMessage
};