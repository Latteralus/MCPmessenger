// electron-client/renderer/assets/js/chat/connectionManager.js

// Connection states
const ConnectionState = {
    CONNECTING: 'connecting',
    CONNECTED: 'connected',
    DISCONNECTED: 'disconnected',
    RECONNECTING: 'reconnecting',
    RECONNECT_FAILED: 'reconnect_failed',
    ERROR: 'error'
  };
  
  // Manages the connection state and reconnection logic
  class ConnectionManager {
    constructor() {
      this.state = ConnectionState.DISCONNECTED;
      this.listeners = [];
      this.reconnectAttempts = 0;
      this.maxReconnectAttempts = 10;
      this.reconnectBackoff = {
        initialDelay: 1000, // Start with 1 second
        maxDelay: 30000,    // Max 30 seconds
        factor: 1.5         // Multiply by this factor each attempt
      };
      
      // Handle browser online/offline events
      window.addEventListener('online', this.handleNetworkOnline.bind(this));
      window.addEventListener('offline', this.handleNetworkOffline.bind(this));
    }
    
    // Set the current connection state and notify listeners
    setState(newState, data = {}) {
      const oldState = this.state;
      this.state = newState;
      
      // Notify all listeners of the state change
      this.listeners.forEach(listener => {
        listener(newState, oldState, data);
      });
      
      // Log state changes for debugging
      console.log(`Connection state changed: ${oldState} -> ${newState}`, data);
      
      // Return the new state
      return newState;
    }
    
    // Add a listener for connection state changes
    addStateChangeListener(listener) {
      if (typeof listener === 'function') {
        this.listeners.push(listener);
      }
      return this;
    }
    
    // Remove a state change listener
    removeStateChangeListener(listener) {
      this.listeners = this.listeners.filter(l => l !== listener);
      return this;
    }
    
    // Reset reconnection attempts counter
    resetReconnectAttempts() {
      this.reconnectAttempts = 0;
      return this;
    }
    
    // Calculate delay for next reconnection attempt using exponential backoff
    getReconnectDelay() {
      const { initialDelay, maxDelay, factor } = this.reconnectBackoff;
      const delay = initialDelay * Math.pow(factor, this.reconnectAttempts);
      return Math.min(delay, maxDelay);
    }
    
    // Handle browser online event
    handleNetworkOnline() {
      console.log('Browser network online event detected');
      
      // Only trigger reconnection if we're in a disconnected state
      if (this.state === ConnectionState.DISCONNECTED) {
        this.setState(ConnectionState.RECONNECTING, {
          reason: 'network_online',
          message: 'Network connection restored'
        });
        
        // The actual reconnection will be handled by the socket handler
        window.dispatchEvent(new CustomEvent('connection_reconnect_requested'));
      }
    }
    
    // Handle browser offline event
    handleNetworkOffline() {
      console.log('Browser network offline event detected');
      
      // Mark as disconnected due to network
      this.setState(ConnectionState.DISCONNECTED, {
        reason: 'network_offline',
        message: 'Network connection lost'
      });
    }
    
    // Check if we can attempt a reconnection
    canAttemptReconnect() {
      // Don't try to reconnect if browser reports we're offline
      if (!navigator.onLine) {
        return false;
      }
      
      // Don't exceed max reconnect attempts
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        this.setState(ConnectionState.RECONNECT_FAILED, {
          attempts: this.reconnectAttempts,
          message: 'Maximum reconnection attempts reached'
        });
        return false;
      }
      
      return true;
    }
  }
  
  // Create and export a singleton instance
  const connectionManager = new ConnectionManager();
  
  export { 
    connectionManager, 
    ConnectionState 
  };