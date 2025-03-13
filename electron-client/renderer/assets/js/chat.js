// electron-client/renderer/assets/js/chat.js

// Import modules from the chat folder
import { initialize } from './chat/chatApp.js';

// When the DOM is loaded, initialize the chat application
document.addEventListener('DOMContentLoaded', () => {
  // Start the chat application
  initialize();
  
  // Listen for unread message updates
  window.addEventListener('unreadMessagesUpdated', () => {
    // Refresh contact list to show updated unread counts
    import('./chat/chatUI.js').then(({ renderContactList }) => {
      import('./chat/chatApp.js').then(({ contacts }) => {
        renderContactList(contacts);
      });
    });
  });
  
  // Listen for unread group message updates
  window.addEventListener('groupUnreadMessagesUpdated', () => {
    // Refresh group list to show updated unread counts
    import('./chat/chatUI.js').then(({ renderGroupList }) => {
      import('./chat/chatApp.js').then(({ groups }) => {
        renderGroupList(groups);
      });
    });
  });
});