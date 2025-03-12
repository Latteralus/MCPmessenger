// electron-client/renderer/assets/js/chat.js

document.addEventListener('DOMContentLoaded', () => {
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
    const sendButton = document.getElementById('send-button');
    const createGroupBtn = document.getElementById('create-group-btn');
    const createGroupModal = document.getElementById('create-group-modal');
    const createGroupForm = document.getElementById('create-group-form');
    const groupMembersList = document.getElementById('group-members-list');
    const cancelCreateGroup = document.getElementById('cancel-create-group');
  
    // Check if user is logged in
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || '{}');
  
    if (!token || !user.id) {
      // Redirect to login if not logged in
      window.electronAPI.navigate({ page: 'login.html' });
      return;
    }
  
    // Set current username
    currentUsername.textContent = user.username;
  
    // State variables
    let currentChat = null; // Currently selected chat
    let contacts = []; // List of all contacts
    let groups = []; // List of all groups
    let socket = null; // Socket.io connection
    let userKeys = { // User's encryption keys
      privateKey: null,
      publicKey: null
    };
    let contactPublicKeys = {}; // Maps user IDs to their public keys
  
    // Initialize the chat application
    async function initialize() {
      try {
        // Load user's encryption keys
        await loadUserKeys();
        
        // Connect to the server via WebSocket
        connectSocket();
        
        // Load contacts and groups
        await Promise.all([
          loadContacts(),
          loadGroups()
        ]);
        
        // Set up event listeners
        setupEventListeners();
        
      } catch (error) {
        console.error('Initialization error:', error);
        alert('Failed to initialize chat: ' + error.message);
      }
    }
  
    // Load user's encryption keys from disk
    async function loadUserKeys() {
      try {
        const result = await window.electronAPI.loadKeys({ userId: user.id });
        
        if (!result.success) {
          throw new Error('Failed to load encryption keys: ' + (result.error || 'Unknown error'));
        }
        
        userKeys.privateKey = result.privateKey;
        userKeys.publicKey = result.publicKey;
        
        console.log('Encryption keys loaded successfully');
      } catch (error) {
        console.error('Error loading encryption keys:', error);
        throw error;
      }
    }
  
    // Connect to the server via WebSocket
    function connectSocket() {
      try {
        socket = io(window.serverConfig.socketUrl);
        
        socket.on('connect', () => {
          console.log('Connected to server via WebSocket');
          
          // Authenticate the socket connection
          socket.emit('authenticate', token);
          
          // Join user's personal room
          socket.emit('join', `user_${user.id}`);
        });
        
        socket.on('disconnect', () => {
          console.log('Disconnected from server');
        });
        
        socket.on('new_message', (message) => {
          if (currentChat && 
              currentChat.type === 'direct' && 
              currentChat.id === message.sender_id) {
            // If we're currently chatting with the sender, decrypt and display the message
            const decryptedContent = decryptMessage(message.encrypted_content, message.sender_id);
            addMessageToUI(message.sender_id, decryptedContent, new Date(message.timestamp), false);
          } else {
            // Otherwise, show a notification
            showMessageNotification(message);
          }
        });
        
        socket.on('new_group_message', (message) => {
          if (currentChat && 
              currentChat.type === 'group' && 
              currentChat.id === message.group_id) {
            // If we're currently in this group chat, decrypt and display the message
            // For group messages, we need to know who sent it to decrypt
            const decryptedContent = decryptMessage(message.encrypted_content, message.sender_id);
            addMessageToUI(message.sender_id, decryptedContent, new Date(message.timestamp), false);
          } else {
            // Otherwise, show a notification
            showMessageNotification(message);
          }
        });
        
      } catch (error) {
        console.error('Socket connection error:', error);
        throw error;
      }
    }
  
    // Load list of contacts (other users)
    async function loadContacts() {
      try {
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
        
        // Update the UI
        renderContactList();
        
        // Preload public keys for all contacts
        preloadContactPublicKeys();
        
      } catch (error) {
        console.error('Error loading contacts:', error);
        contactList.innerHTML = `<li class="contact-item error">Error: ${error.message}</li>`;
        throw error;
      }
    }
  
    // Load list of groups
    async function loadGroups() {
      try {
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
        
        // Update the UI
        renderGroupList();
        
      } catch (error) {
        console.error('Error loading groups:', error);
        groupList.innerHTML = `<li class="group-item error">Error: ${error.message}</li>`;
        throw error;
      }
    }
  
    // Preload public keys for all contacts
    async function preloadContactPublicKeys() {
      const validContacts = contacts.filter(contact => contact.has_key);
      
      for (const contact of validContacts) {
        try {
          await loadContactPublicKey(contact.id);
        } catch (error) {
          console.error(`Error loading public key for contact ${contact.id}:`, error);
        }
      }
    }
  
    // Load public key for a specific contact
    async function loadContactPublicKey(contactId) {
      // Skip if we already have this contact's public key
      if (contactPublicKeys[contactId]) {
        return contactPublicKeys[contactId];
      }
      
      try {
        const response = await fetch(`${window.serverConfig.baseUrl}/api/auth/public-key/${contactId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to load public key');
        }
        
        const data = await response.json();
        contactPublicKeys[contactId] = data.publicKey;
        
        return data.publicKey;
      } catch (error) {
        console.error(`Error loading public key for contact ${contactId}:`, error);
        throw error;
      }
    }
  
    // Render the list of contacts in the UI
    function renderContactList() {
      if (contacts.length === 0) {
        contactList.innerHTML = '<li class="contact-item empty">No contacts available</li>';
        return;
      }
      
      const html = contacts.map(contact => `
        <li class="contact-item" data-id="${contact.id}" data-type="direct">
          <div class="contact-name">${contact.username}</div>
          <div class="contact-status">
            ${contact.has_key ? 
              '<span class="status-indicator secure" title="Encrypted messaging enabled"></span>' : 
              '<span class="status-indicator insecure" title="Contact has not set up encryption"></span>'}
          </div>
        </li>
      `).join('');
      
      contactList.innerHTML = html;
      
      // Add click event listeners
      document.querySelectorAll('.contact-item[data-type="direct"]').forEach(item => {
        item.addEventListener('click', handleContactClick);
      });
    }
  
    // Render the list of groups in the UI
    function renderGroupList() {
      if (groups.length === 0) {
        groupList.innerHTML = '<li class="group-item empty">No groups available</li>';
        return;
      }
      
      const html = groups.map(group => `
        <li class="group-item" data-id="${group.id}" data-type="group">
          <div class="group-name">${group.name}</div>
        </li>
      `).join('');
      
      groupList.innerHTML = html;
      
      // Add click event listeners
      document.querySelectorAll('.group-item[data-type="group"]').forEach(item => {
        item.addEventListener('click', handleGroupClick);
      });
    }
  
    // Set up event listeners
    function setupEventListeners() {
      // Send message button
      sendButton.addEventListener('click', sendMessage);
      
      // Send message on Enter key
      messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendMessage();
        }
      });
      
      // Create group button
      createGroupBtn.addEventListener('click', showCreateGroupModal);
      
      // Cancel create group button
      cancelCreateGroup.addEventListener('click', hideCreateGroupModal);
      
      // Create group form submission
      createGroupForm.addEventListener('submit', handleCreateGroup);
    }
  
    // Handle clicking on a contact
    async function handleContactClick(e) {
      const contactItem = e.currentTarget;
      const contactId = parseInt(contactItem.dataset.id);
      
      // Select this contact
      selectChat('direct', contactId);
      
      // Highlight the selected contact
      document.querySelectorAll('.contact-item, .group-item').forEach(item => {
        item.classList.remove('active');
      });
      contactItem.classList.add('active');
      
      // Load the conversation history
      await loadDirectMessages(contactId);
    }
  
    // Handle clicking on a group
    async function handleGroupClick(e) {
      const groupItem = e.currentTarget;
      const groupId = parseInt(groupItem.dataset.id);
      
      // Select this group
      selectChat('group', groupId);
      
      // Highlight the selected group
      document.querySelectorAll('.contact-item, .group-item').forEach(item => {
        item.classList.remove('active');
      });
      groupItem.classList.add('active');
      
      // Load the group chat history
      await loadGroupMessages(groupId);
    }
  
    // Select a chat (direct or group)
    function selectChat(type, id) {
      currentChat = { type, id };
      
      // Show the chat interface, hide welcome screen
      welcomeScreen.classList.add('hidden');
      chatInterface.classList.remove('hidden');
      
      // Update the chat title and info
      if (type === 'direct') {
        const contact = contacts.find(c => c.id === id);
        if (contact) {
          chatTitle.textContent = contact.username;
          chatInfo.textContent = contact.has_key ? 'Messages are encrypted' : 'Encryption unavailable';
        }
      } else if (type === 'group') {
        const group = groups.find(g => g.id === id);
        if (group) {
          chatTitle.textContent = group.name;
          chatInfo.textContent = `Created by ${group.created_by_name}`;
        }
      }
      
      // Clear the messages container
      messagesContainer.innerHTML = '';
      
      // Focus the message input
      messageInput.focus();
    }
  
    // Load direct message history
    async function loadDirectMessages(contactId) {
      try {
        // First make sure we have the recipient's public key
        if (!contactPublicKeys[contactId]) {
          await loadContactPublicKey(contactId);
        }
        
        // Show loading indicator
        messagesContainer.innerHTML = '<div class="loading-messages">Loading messages...</div>';
        
        const response = await fetch(`${window.serverConfig.baseUrl}/api/messages/direct/${contactId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to load messages');
        }
        
        const messages = await response.json();
        
        // Clear container
        messagesContainer.innerHTML = '';
        
        if (messages.length === 0) {
          messagesContainer.innerHTML = '<div class="no-messages">No messages yet. Send the first message!</div>';
          return;
        }
        
        // Display messages
        messages.forEach(message => {
          const isFromMe = message.sender_id === user.id;
          const senderId = isFromMe ? user.id : contactId;
          let content;
          
          try {
            content = decryptMessage(message.encrypted_content, senderId);
          } catch (error) {
            console.error('Error decrypting message:', error);
            content = '[Encrypted message - unable to decrypt]';
          }
          
          addMessageToUI(senderId, content, new Date(message.timestamp), isFromMe);
        });
        
        // Scroll to bottom
        scrollToBottom();
        
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
        
        const response = await fetch(`${window.serverConfig.baseUrl}/api/messages/group/${groupId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to load group messages');
        }
        
        const messages = await response.json();
        
        // Clear container
        messagesContainer.innerHTML = '';
        
        if (messages.length === 0) {
          messagesContainer.innerHTML = '<div class="no-messages">No messages in this group yet. Send the first message!</div>';
          return;
        }
        
        // Display messages
        for (const message of messages) {
          const isFromMe = message.sender_id === user.id;
          
          // For each message, make sure we have the sender's public key
          try {
            if (!isFromMe && !contactPublicKeys[message.sender_id]) {
              await loadContactPublicKey(message.sender_id);
            }
            
            let content;
            try {
              content = decryptMessage(message.encrypted_content, message.sender_id);
            } catch (error) {
              console.error('Error decrypting group message:', error);
              content = '[Encrypted message - unable to decrypt]';
            }
            
            addMessageToUI(message.sender_id, content, new Date(message.timestamp), isFromMe);
          } catch (error) {
            console.error('Error processing group message:', error);
            // Continue with next message
          }
        }
        
        // Scroll to bottom
        scrollToBottom();
        
      } catch (error) {
        console.error('Error loading group messages:', error);
        messagesContainer.innerHTML = `<div class="error-messages">Error: ${error.message}</div>`;
      }
    }
  
    // Send a message
    async function sendMessage() {
      const content = messageInput.value.trim();
      
      if (!content || !currentChat) {
        return;
      }
      
      try {
        // Disable the send button to prevent multiple sends
        sendButton.disabled = true;
        
        let encryptedContent, endpoint, payload;
        
        if (currentChat.type === 'direct') {
          // Encrypt the message using the recipient's public key
          encryptedContent = encryptMessage(content, currentChat.id);
          
          endpoint = `${window.serverConfig.baseUrl}/api/messages/direct`;
          payload = {
            recipientId: currentChat.id,
            encryptedContent
          };
        } else if (currentChat.type === 'group') {
          // For groups, we need to encrypt the message for all members
          encryptedContent = encryptGroupMessage(content, currentChat.id);
          
          endpoint = `${window.serverConfig.baseUrl}/api/messages/group`;
          payload = {
            groupId: currentChat.id,
            encryptedContent
          };
        }
        
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to send message');
        }
        
        // Clear the input
        messageInput.value = '';
        
        // Add the message to the UI
        addMessageToUI(user.id, content, new Date(), true);
        
        // Scroll to bottom
        scrollToBottom();
        
      } catch (error) {
        console.error('Error sending message:', error);
        alert('Failed to send message: ' + error.message);
      } finally {
        // Re-enable the send button
        sendButton.disabled = false;
        
        // Focus the input
        messageInput.focus();
      }
    }
  
    // Add a message to the UI
    function addMessageToUI(senderId, content, timestamp, isFromMe) {
      const messageEl = document.createElement('div');
      messageEl.classList.add('message');
      
      if (isFromMe) {
        messageEl.classList.add('sent');
        messageEl.innerHTML = `
          <div class="message-content">${escapeHtml(content)}</div>
          <div class="message-meta">${formatTime(timestamp)}</div>
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
    }
  
    // Show create group modal
    function showCreateGroupModal() {
      // Populate the members list with all contacts
      let html = '';
      
      if (contacts.length === 0) {
        html = '<div class="no-contacts">No contacts available to add</div>';
      } else {
        html = contacts.map(contact => `
          <div class="checkbox-item">
            <input type="checkbox" id="member-${contact.id}" name="members" value="${contact.id}">
            <label for="member-${contact.id}">${contact.username}</label>
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
        
        // Add the new group to the list
        groups.push(newGroup);
        
        // Update the UI
        renderGroupList();
        
        // Hide the modal
        hideCreateGroupModal();
        
        // Select the new group
        const newGroupItem = document.querySelector(`.group-item[data-id="${newGroup.id}"]`);
        if (newGroupItem) {
          newGroupItem.click();
        }
        
      } catch (error) {
        console.error('Error creating group:', error);
        alert('Failed to create group: ' + error.message);
      }
    }
  
    // Encrypt a message for a direct conversation
    function encryptMessage(message, recipientId) {
      try {
        // Get recipient's public key
        const recipientPublicKey = contactPublicKeys[recipientId];
        
        if (!recipientPublicKey) {
          throw new Error('Recipient public key not found');
        }
        
        // Decode keys from base64
        const publicKeyUint8 = nacl.util.decodeBase64(recipientPublicKey);
        const privateKeyUint8 = nacl.util.decodeBase64(userKeys.privateKey);
        
        // Encrypt the message
        const nonce = nacl.randomBytes(nacl.box.nonceLength);
        const messageUint8 = nacl.util.decodeUTF8(message);
        
        const encrypted = nacl.box(
          messageUint8,
          nonce,
          publicKeyUint8,
          privateKeyUint8
        );
        
        // Combine nonce and encrypted message
        const fullMessage = new Uint8Array(nonce.length + encrypted.length);
        fullMessage.set(nonce);
        fullMessage.set(encrypted, nonce.length);
        
        // Convert to base64 for transmission
        return nacl.util.encodeBase64(fullMessage);
        
      } catch (error) {
        console.error('Encryption error:', error);
        throw error;
      }
    }
  
    // Encrypt a message for a group (encrypt same message for each member individually)
    function encryptGroupMessage(message, groupId) {
      try {
        // For group messages, we encrypt the message once with our own key for storage
        // In a real implementation, you would encrypt individually for each member
        // For simplicity in this example, we're just encrypting with our own key
        
        const publicKeyUint8 = nacl.util.decodeBase64(userKeys.publicKey);
        const privateKeyUint8 = nacl.util.decodeBase64(userKeys.privateKey);
        
        // Encrypt the message
        const nonce = nacl.randomBytes(nacl.box.nonceLength);
        const messageUint8 = nacl.util.decodeUTF8(message);
        
        const encrypted = nacl.box(
          messageUint8,
          nonce,
          publicKeyUint8,
          privateKeyUint8
        );
        
        // Combine nonce and encrypted message
        const fullMessage = new Uint8Array(nonce.length + encrypted.length);
        fullMessage.set(nonce);
        fullMessage.set(encrypted, nonce.length);
        
        // Convert to base64 for transmission
        return nacl.util.encodeBase64(fullMessage);
        
      } catch (error) {
        console.error('Group encryption error:', error);
        throw error;
      }
    }
  
    // Decrypt a message
    function decryptMessage(encryptedBase64, senderId) {
      try {
        // For messages sent by the current user, use their own keys
        let publicKey;
        if (senderId === user.id) {
          publicKey = userKeys.publicKey;
        } else {
          // For messages from others, use their public key
          publicKey = contactPublicKeys[senderId];
          
          if (!publicKey) {
            throw new Error(`Public key not found for sender ${senderId}`);
          }
        }
        
        // Decode the full message from base64
        const fullMessage = nacl.util.decodeBase64(encryptedBase64);
        
        // Extract the nonce and the encrypted message
        const nonce = fullMessage.slice(0, nacl.box.nonceLength);
        const encryptedMessage = fullMessage.slice(nacl.box.nonceLength);
        
        // Decode keys from base64
        const publicKeyUint8 = nacl.util.decodeBase64(publicKey);
        const privateKeyUint8 = nacl.util.decodeBase64(userKeys.privateKey);
        
        // Decrypt the message
        const decrypted = nacl.box.open(
          encryptedMessage,
          nonce,
          publicKeyUint8,
          privateKeyUint8
        );
        
        if (!decrypted) {
          throw new Error('Decryption failed');
        }
        
        // Convert from Uint8Array to string
        return nacl.util.encodeUTF8(decrypted);
        
      } catch (error) {
        console.error('Decryption error:', error);
        throw error;
      }
    }
  
    // Show a notification for a new message
    function showMessageNotification(message) {
      try {
        let title, body;
        
        if (message.group_id) {
          // Group message
          const group = groups.find(g => g.id === message.group_id);
          const sender = contacts.find(c => c.id === message.sender_id);
          
          if (!group || !sender) {
            return;
          }
          
          title = `New message in ${group.name}`;
          body = `${sender.username}: ...`;
          
        } else {
          // Direct message
          const sender = contacts.find(c => c.id === message.sender_id);
          
          if (!sender) {
            return;
          }
          
          title = `New message from ${sender.username}`;
          body = '...';
        }
        
        window.electronAPI.showNotification({ title, body });
        
      } catch (error) {
        console.error('Error showing notification:', error);
      }
    }
  
    // Helper function to format time for display
    function formatTime(date) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
  
    // Helper function to escape HTML special characters
    function escapeHtml(unsafe) {
      return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }
  
    // Start the application
    initialize();
  });