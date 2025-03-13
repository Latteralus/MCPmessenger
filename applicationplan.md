# MCP Messenger Application Plan

## Project Overview
MCP Messenger is a self-hosted, offline messenger application with end-to-end encryption designed for secure communication on local networks. The application consists of an Electron-based client and a Node.js server with Socket.IO for real-time communication and SQLite for data storage. The application will be designed only for Microsoft Windows based operating systems. The application will not be ported for use on a phone or cellular device. The application should be HIPAA compliant.

## Current Status - March 12, 2025

### ✅ Completed Items

#### Server-side
- Express.js server implementation with Socket.IO integration
- SQLite database setup with proper schema
- User authentication system with JWT
- Message routing for direct and group communications
- End-to-end encryption support (public key storage and exchange)
- Admin API endpoints for user and group management
- Group members API endpoint for improved encryption

#### Client-side
- Electron application structure
- Login interface with key generation capabilities
- Chat interface for direct and group messaging
- End-to-end encryption implementation using TweetNaCl.js
- Properly implemented group message encryption with per-member encryption
- Admin dashboard for user and group management
- Build configuration using electron-builder
- Robust Socket.IO reconnection logic with exponential backoff
- Message queuing system for network disruptions
- Connection state management with user feedback
- UI/UX improvements:
  - Responsive design for different screen sizes
  - Dark mode with user preference saving
  - Message previews in contact/group lists
  - Unread message indicators and counts
  - Improved message storage and caching
  - Window size persistence
  - Message delivery status indicators
  - Connection status indicators

### 🚧 In Progress
- Application packaging and distribution
- Testing on different platforms (Windows, macOS, Linux)
- Performance optimization for large message histories

### 📋 Pending Tasks

#### Short-term
- Complete application packaging with electron-builder
- Implement comprehensive error handling throughout the application
- Create documentation for deployment and usage
- Add logging system for troubleshooting (partial implementation exists)
- Implement additional UI features:
  - Message formatting (bold, italic, links)
  - Emoji picker for easy emoji insertion
  - Link previews for shared URLs

#### Medium-term
- Implement message search functionality
- Add support for file transfers
- Enhance group chat features (admin controls, member management)
- Create backup and restore functionality
- Add support for message reactions and replies
- Implement database migration strategy for updates

#### Long-term
- Support for multiple servers in one client
- Plugin system for extensibility
- End-to-end encrypted file sharing
- Message expiration and self-destruct features
- Read receipts with privacy controls

## Technical Architecture

### Client Architecture
- Electron for cross-platform desktop application
- Main process for system interactions and encryption key management
- Renderer process for UI implementation
- TweetNaCl.js for cryptographic operations
- Socket.IO client for real-time communications
- Responsive UI with light/dark theme support
- Local message caching for improved performance
- Unread message tracking and notification system
- Connection management system with reconnection logic
- Message queuing for offline operation
- Synchronization manager for missed messages

### Server Architecture
- Node.js with Express for HTTP API
- Socket.IO for real-time messaging
- SQLite database for data storage
- JWT for authentication
- bcrypt for password hashing
- Group member API for secure group communications

### Security Features
- End-to-end encryption for all messages
- Individual message encryption for each group member
- Message signatures for sender verification
- Public/private key pairs for each user
- Authentication with JWT
- Password hashing with bcrypt
- Local storage of encryption keys
- Secure message queue handling
- Connection status with privacy considerations

## Development Environment
- Node.js v18+
- npm as package manager
- Electron v35.0.1
- Express v4.21.2
- Socket.IO v4.8.1
- SQLite3 v5.1.7
- electron-builder v25.1.8 for application packaging

## Deployment Strategy
- Self-hosted on local networks
- Installable desktop client for Windows
- Simple server setup with minimal configuration
- Default admin account for initial setup
- Documentation for secure deployment

## Future Development Roadmap

### Q2 2025
- Complete initial release
- Add file transfer capabilities
- Implement additional UI/UX features based on user feedback:
  - Custom themes and styling options
  - Message editing and deletion
  - Message reactions
  - Advanced search capabilities

### Q3 2025
- Implement message search and filtering
- Add advanced group features
- Develop backup and restore functionality
- Implement read receipts with privacy controls

### Q4 2025
- Develop server federation capabilities
- Implement plugin system for extensibility
- Add support for secure audio/video calls

## Recent Improvements
- Implemented robust Socket.IO reconnection logic with exponential backoff
- Created message queuing system for offline operation
- Added connection state management with visual indicators
- Enhanced group message encryption with per-member encryption
- Developed synchronization mechanism for missed messages
- Added message delivery status indicators
- Improved file structure with modular code organization
- Fixed various security issues in implementation

## Conclusion
MCP Messenger has made significant progress with core functionality implemented and recent improvements to network resilience and security. The application now demonstrates strong security features with its implementation of end-to-end encryption for all communications and robust handling of network disruptions. The current focus is on completing the build and distribution process, followed by testing and refinement to prepare for initial deployment.

# MCP Messenger Project Structure

```
project-root/
├── server/                                # Backend server
│   ├── index.js                           # Entry point for Express server
│   ├── config/                            # Configuration
│   │   └── config.js                      # Server configuration
│   ├── routes/                            # API endpoints
│   │   ├── auth.js                        # Authentication routes
│   │   ├── messages.js                    # Message handling routes
│   │   └── admin.js                       # Admin panel routes
│   └── database/                          # SQLite database
│       └── README.md                      # Database documentation
│
├── electron-client/                       # Desktop application
│   ├── main.js                            # Electron main process
│   ├── preload.js                         # Preload script
│   ├── utils/                             # Utilities
│   │   ├── logger.js                      # Logging utilities
│   │   └── errorHandler.js                # Error handling utilities
│   └── renderer/                          # UI components
│       ├── login.html                     # Login page
│       ├── chat.html                      # Main chat interface
│       ├── assets/                        # Static assets
│       │   ├── css/                       # Stylesheets
│       │   │   └── styles.css             # Main stylesheet
│       │   └── js/                        # JavaScript files
│       │       ├── chat/                  # Modularized chat components
│       │       │   ├── chatApp.js         # Main chat application
│       │       │   ├── chatUI.js          # UI rendering functions
│       │       │   ├── messageHandler.js  # Message handling
│       │       │   ├── socketHandler.js   # Socket connection management
│       │       │   ├── encryption.js      # Encryption functions
│       │       │   ├── storage.js         # Local storage management
│       │       │   ├── connectionManager.js # Connection state management
│       │       │   ├── messageQueue.js    # Message queue during disconnections
│       │       │   └── syncManager.js     # Sync missed messages
│       │       ├── login.js               # Login functionality
│       │       ├── tweetnacl.min.js       # Cryptography library
│       │       ├── tweetnacl-util.min.js  # Utilities for TweetNaCl
│       │       └── socket.io.min.js       # Socket.IO client
│       └── about.html                     # About page
│
├── admin-dashboard/                       # Web-based admin interface
│   ├── admin.html                         # Admin dashboard HTML
│   ├── admin.js                           # Admin dashboard JavaScript
│   └── admin.css                          # Admin dashboard styles
│
├── package.json                           # Project dependencies and scripts
├── README.md                              # Project documentation
├── applicationplan.md                     # Project planning document
├── .gitignore                             # Git ignore file
└── .gitattributes                         # Git attributes file
```

## Communication Flow

```
┌────────────────────┐       ┌─────────────────────┐       ┌─────────────────┐
│                    │       │                     │       │                 │
│   Electron Client  │◄─────►│   Express Server    │◄─────►│ SQLite Database │
│                    │       │                     │       │                 │
└─────────┬──────────┘       └─────────────────────┘       └─────────────────┘
          │
          │
┌─────────▼──────────┐
│                    │
│  Socket.IO Client  │
│                    │
└─────────┬──────────┘
          │
          │
┌─────────▼──────────┐       ┌─────────────────────┐
│                    │       │                     │
│  Connection Manager│◄─────►│    Message Queue    │
│                    │       │                     │
└─────────┬──────────┘       └─────────────────────┘
          │
          │
┌─────────▼──────────┐       ┌─────────────────────┐
│                    │       │                     │
│  Encryption Module │◄─────►│    Storage Module   │
│                    │       │                     │
└────────────────────┘       └─────────────────────┘
```

## Component Relationships

```
┌──────────────────────────────────────────┐
│               chatApp.js                 │
│                                          │
│  - Initializes the chat application      │
│  - Coordinates between other modules     │
│  - Manages application state             │
└───────────────┬───────────────┬──────────┘
                │               │
                │               │
┌───────────────▼───┐   ┌───────▼───────────┐
│     chatUI.js     │   │  messageHandler.js│
│                   │   │                   │
│ - Renders UI      │   │ - Handles sending │
│ - Updates lists   │   │   and receiving   │
│ - Handles events  │   │   messages        │
└───────┬───────────┘   └─────────┬─────────┘
        │                         │
        │                         │
┌───────▼───────────┐   ┌─────────▼─────────┐
│  socketHandler.js │   │   encryption.js   │
│                   │   │                   │
│ - Manages socket  │   │ - Encrypts and    │
│   connection      │   │   decrypts        │
│ - Handles events  │   │   messages        │
└───────┬───────────┘   └─────────┬─────────┘
        │                         │
        │                         │
┌───────▼───────────┐   ┌─────────▼─────────┐
│connectionManager.js│  │     storage.js    │
│                   │   │                   │
│ - Tracks state    │   │ - Manages local   │
│ - Handles network │   │   storage of      │
│   changes         │   │   messages        │
└───────┬───────────┘   └─────────┬─────────┘
        │                         │
        │                         │
┌───────▼───────────┐   ┌─────────▼─────────┐
│  messageQueue.js  │   │   syncManager.js  │
│                   │   │                   │
│ - Queues messages │   │ - Syncs missed    │
│   during outages  │   │   messages after  │
│ - Retries failed  │   │   reconnection    │
└───────────────────┘   └───────────────────┘
```

## Data Flow

```
1. User Authentication Flow:
┌──────────┐    ┌─────────┐    ┌─────────────┐    ┌───────────┐
│          │    │         │    │             │    │           │
│  login.js│───►│ Server  │───►│ Validation  │───►│ JWT Token │
│          │    │         │    │             │    │           │
└──────────┘    └─────────┘    └─────────────┘    └───────────┘

2. Message Sending Flow:
┌──────────────┐    ┌───────────────┐    ┌─────────────────┐    ┌──────────┐
│              │    │               │    │                 │    │          │
│ messageInput │───►│ encryption.js │───►│ socketHandler.js│───►│  Server  │
│              │    │               │    │                 │    │          │
└──────────────┘    └───────────────┘    └─────────────────┘    └──────────┘

3. Message Receiving Flow:
┌──────────┐    ┌─────────────────┐    ┌───────────────┐    ┌─────────┐
│          │    │                 │    │               │    │         │
│  Server  │───►│ socketHandler.js│───►│ encryption.js │───►│ chatUI.js│
│          │    │                 │    │               │    │         │
└──────────┘    └─────────────────┘    └───────────────┘    └─────────┘

4. Offline Message Flow:
┌──────────────┐    ┌───────────────┐    ┌─────────────────┐    ┌─────────────┐
│              │    │               │    │                 │    │             │
│ messageInput │───►│ encryption.js │───►│ messageQueue.js │───►│ localStorage │
│              │    │               │    │                 │    │             │
└──────────────┘    └───────────────┘    └──────┬──────────┘    └─────────────┘
                                                │
                                                │
                                         ┌──────▼──────┐
                                         │             │
                                         │ Reconnection│
                                         │             │
                                         └──────┬──────┘
                                                │
                                                │
                                         ┌──────▼──────┐
                                         │             │
                                         │   Server    │
                                         │             │
                                         └─────────────┘
```

This wireframe diagram provides a comprehensive overview of the current project structure, including file organization, component relationships, and data flow between different parts of the application. The modular structure enables better maintainability and allows for independent development of different features.