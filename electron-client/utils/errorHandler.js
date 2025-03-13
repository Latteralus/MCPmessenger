// electron-client/utils/errorHandler.js

const logger = require('./logger');

class ErrorHandler {
  constructor() {
    this.errorMessages = {
      // Network errors
      NETWORK_ERROR: 'Unable to connect to server. Please check your network connection.',
      SERVER_ERROR: 'Server error. Please try again later.',
      TIMEOUT_ERROR: 'Request timed out. Please try again.',
      
      // Authentication errors
      AUTH_ERROR: 'Authentication failed. Please log in again.',
      UNAUTHORIZED: 'You are not authorized to perform this action.',
      
      // Data errors
      INVALID_DATA: 'Invalid data provided.',
      NOT_FOUND: 'The requested resource was not found.',
      
      // Encryption errors
      ENCRYPTION_ERROR: 'Encryption error. Unable to secure the message.',
      DECRYPTION_ERROR: 'Unable to decrypt the message.',
      KEY_ERROR: 'Encryption key error. Please restart the application.',
      
      // File system errors
      FILE_ERROR: 'Error accessing file system.',
      PERMISSION_ERROR: 'Permission denied accessing file system.',
      
      // General errors
      UNKNOWN_ERROR: 'An unknown error occurred. Please try again.',
      APP_ERROR: 'Application error. Please restart the application.'
    };
    
    // Set up global uncaught exception handler
    process.on('uncaughtException', (error) => {
      this.handleError(error, 'UNCAUGHT_EXCEPTION');
    });
    
    // Set up unhandled rejection handler
    process.on('unhandledRejection', (reason, promise) => {
      this.handleError(reason, 'UNHANDLED_REJECTION');
    });
  }
  
  handleError(error, type = 'APP_ERROR', context = {}) {
    // Log the error
    logger.error(`${type}: ${error.message || error}`, {
      error,
      context,
      stack: error.stack
    });
    
    // Return user-friendly error message
    return this.getUserFriendlyMessage(error, type);
  }
  
  getUserFriendlyMessage(error, type) {
    // Determine error type from error object if not specified
    if (!type) {
      if (error.name === 'NetworkError' || error.message.includes('network')) {
        type = 'NETWORK_ERROR';
      } else if (error.message.includes('authentication') || error.status === 401) {
        type = 'AUTH_ERROR';
      } else if (error.message.includes('encryption')) {
        type = 'ENCRYPTION_ERROR';
      } else if (error.message.includes('decryption')) {
        type = 'DECRYPTION_ERROR';
      } else if (error.status === 500) {
        type = 'SERVER_ERROR';
      } else if (error.status === 404) {
        type = 'NOT_FOUND';
      } else {
        type = 'UNKNOWN_ERROR';
      }
    }
    
    // Return appropriate message
    return this.errorMessages[type] || this.errorMessages.UNKNOWN_ERROR;
  }
  
  parseApiError(response) {
    if (response.status === 401) {
      return this.errorMessages.AUTH_ERROR;
    } else if (response.status === 403) {
      return this.errorMessages.UNAUTHORIZED;
    } else if (response.status === 404) {
      return this.errorMessages.NOT_FOUND;
    } else if (response.status === 500) {
      return this.errorMessages.SERVER_ERROR;
    } else {
      return this.errorMessages.UNKNOWN_ERROR;
    }
  }
}

// Create a singleton instance
const errorHandler = new ErrorHandler();

module.exports = errorHandler;