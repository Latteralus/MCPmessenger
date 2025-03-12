// server/config/config.js
const path = require('path');

module.exports = {
  // Server configuration
  port: process.env.PORT || 3000,
  
  // Database configuration
  database: {
    path: path.join(__dirname, '..', 'database', 'database.sqlite')
  },
  
  // Authentication configuration
  auth: {
    jwtSecret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
    jwtExpiresIn: '24h',
    saltRounds: 10
  },
  
  // Admin user default credentials (only used if no admin exists)
  defaultAdmin: {
    username: 'admin',
    password: 'admin123' // Change this in production!
  },
  
  // Client application settings
  client: {
    url: process.env.CLIENT_URL || 'http://localhost:3000'
  }
};