// electron-client/renderer/assets/js/chat/syncManager.js

class SyncManager {
    constructor() {
      this.lastSyncTimestamp = this.getLastSyncTime();
      this.isSyncing = false;
      this.syncQueue = [];
    }
    
    // Get the last time we synced from localStorage
    getLastSyncTime() {
      const timestamp = localStorage.getItem('lastMessageSync');
      return timestamp ? new Date(timestamp).toISOString() : null;
    }
    
    // Save the current sync time to localStorage
    updateLastSyncTime() {
      const now = new Date().toISOString();
      localStorage.setItem('lastMessageSync', now);
      this.lastSyncTimestamp = now;
      return now;
    }
    
    // Queue a sync operation for a specific chat
    queueSync(chatType, chatId) {
      // Don't add duplicates
      const exists = this.syncQueue.some(item => 
        item.chatType === chatType && item.chatId === chatId
      );
      
      if (!exists) {
        this.syncQueue.push({ chatType, chatId });
      }
      
      return this.syncQueue;
    }
    
    // Process all queued sync operations
    async processQueue(token) {
      if (this.isSyncing || this.syncQueue.length === 0) {
        return;
      }
      
      this.isSyncing = true;
      
      try {
        // Process each sync item
        for (const item of [...this.syncQueue]) {
          await this.syncChat(item.chatType, item.chatId, token);
          
          // Remove from queue after successful sync
          const index = this.syncQueue.findIndex(queueItem => 
            queueItem.chatType === item.chatType && queueItem.chatId === item.chatId
          );
          
          if (index !== -1) {
            this.syncQueue.splice(index, 1);
          }
        }
      } catch (error) {
        console.error('Error processing sync queue:', error);
      } finally {
        this.isSyncing = false;
      }
    }
    
    // Sync a specific chat's messages
    async syncChat(chatType, chatId, token) {
      try {
        let endpoint;
        
        if (chatType === 'direct') {
          endpoint = `${window.serverConfig.baseUrl}/api/messages/direct/${chatId}`;
          if (this.lastSyncTimestamp) {
            endpoint += `?since=${encodeURIComponent(this.lastSyncTimestamp)}`;
          }
        } else if (chatType === 'group') {
          endpoint = `${window.serverConfig.baseUrl}/api/messages/group/${chatId}`;
          if (this.lastSyncTimestamp) {
            endpoint += `?since=${encodeURIComponent(this.lastSyncTimestamp)}`;
          }
        } else {
          throw new Error(`Unknown chat type: ${chatType}`);
        }
        
        const response = await fetch(endpoint, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Failed to sync ${chatType} chat ${chatId}`);
        }
        
        const messages = await response.json();
        
        // Process and integrate new messages
        if (messages.length > 0) {
          // Dispatch event to notify app of new messages
          window.dispatchEvent(new CustomEvent('new_synced_messages', {
            detail: {
              chatType,
              chatId,
              messages
            }
          }));
        }
        
        console.log(`Synced ${messages.length} messages for ${chatType} chat ${chatId}`);
        
        // Update sync timestamp after successful sync
        this.updateLastSyncTime();
        
        return messages;
      } catch (error) {
        console.error(`Error syncing ${chatType} chat ${chatId}:`, error);
        throw error;
      }
    }
    
    // Sync all active chats
    async syncAllActiveChats(token) {
      try {
        // Sync direct messages first
        const contacts = JSON.parse(localStorage.getItem('contacts') || '[]');
        for (const contact of contacts) {
          await this.syncChat('direct', contact.id, token);
        }
        
        // Then sync group chats
        const groups = JSON.parse(localStorage.getItem('groups') || '[]');
        for (const group of groups) {
          await this.syncChat('group', group.id, token);
        }
        
        return true;
      } catch (error) {
        console.error('Error syncing all active chats:', error);
        return false;
      }
    }
  }
  
  // Create and export a singleton instance
  const syncManager = new SyncManager();
  
  export { syncManager };