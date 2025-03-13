// electron-client/utils/logger.js

const fs = require('fs');
const path = require('path');
const { app } = require('electron');

class Logger {
  constructor() {
    this.logDir = path.join(app.getPath('userData'), 'logs');
    this.logFile = path.join(this.logDir, `app-${this.getFormattedDate()}.log`);
    
    // Ensure log directory exists
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
    
    // Clean up old logs (keep last 7 days)
    this.cleanupOldLogs();
  }
  
  getFormattedDate() {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
  
  getTimestamp() {
    return new Date().toISOString();
  }
  
  cleanupOldLogs() {
    try {
      const files = fs.readdirSync(this.logDir);
      const now = new Date();
      
      files.forEach(file => {
        if (file.startsWith('app-') && file.endsWith('.log')) {
          const filePath = path.join(this.logDir, file);
          const stats = fs.statSync(filePath);
          const fileDate = new Date(stats.mtime);
          
          // Delete logs older than 7 days
          if ((now - fileDate) > 7 * 24 * 60 * 60 * 1000) {
            fs.unlinkSync(filePath);
          }
        }
      });
    } catch (error) {
      console.error('Error cleaning up old logs:', error);
    }
  }
  
  log(level, message, data = null) {
    try {
      const timestamp = this.getTimestamp();
      let logEntry = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
      
      if (data) {
        if (data instanceof Error) {
          logEntry += `\n  Error: ${data.message}\n  Stack: ${data.stack}`;
        } else {
          try {
            logEntry += `\n  Data: ${JSON.stringify(data)}`;
          } catch (e) {
            logEntry += `\n  Data: [Object cannot be stringified]`;
          }
        }
      }
      
      logEntry += '\n';
      
      // Write to log file
      fs.appendFileSync(this.logFile, logEntry);
      
      // Also output to console in development
      if (process.env.NODE_ENV === 'development') {
        console.log(`${level.toUpperCase()}: ${message}`, data || '');
      }
    } catch (error) {
      console.error('Error writing to log file:', error);
    }
  }
  
  info(message, data = null) {
    this.log('info', message, data);
  }
  
  warn(message, data = null) {
    this.log('warn', message, data);
  }
  
  error(message, data = null) {
    this.log('error', message, data);
  }
  
  debug(message, data = null) {
    if (process.env.DEBUG) {
      this.log('debug', message, data);
    }
  }
}

// Create a singleton instance
const logger = new Logger();

module.exports = logger;