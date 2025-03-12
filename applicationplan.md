Application Overview
This self-hosted, offline messenger is designed for use on a local network with the following core functionalities:

User Authentication:

Basic Login: Users log in using a username and password.
Admin-Managed Accounts: User accounts are created and managed solely by an admin via a web-based dashboard.
Messaging Features:

One-on-One Chats: Direct messaging between two users.
Group Chats: Ability to create and participate in multi-user chat sessions.
Security and Encryption:

End-to-End Encryption (E2EE): Messages are encrypted on the sender’s client and decrypted only on the recipient’s client using TweetNaCl.js.
Key Management: Upon account creation or first login, the client generates a public/private key pair. The public key is stored on the server, while the private key remains securely on the client.
Real-Time Communication:

WebSockets: The system leverages WebSockets (for example, via socket.io) to enable instant message delivery across the local network.
Desktop Client:

Built with Electron: A bare-bones Windows-only application that provides the chat interface, login screen, and handles encryption/decryption locally.
Notifications: Uses Electron’s Notification API to deliver native desktop alerts when new messages arrive.
Admin Dashboard:

Web-Based Interface: A simple HTML dashboard that allows an admin to log in and manage user accounts (create, update, delete) along with managing public keys.
Back-End and Database:

Server: A Node.js/Express server handles authentication, message routing, and user management.
Database: SQLite is used to persist user data, chat messages, and group information.
Proposed File Structure
Here’s an example of how you might organize the project:

arduino
Copy
project-root/
├── server/
│   ├── package.json                // Server dependencies & scripts
│   ├── index.js                    // Entry point for Express server
│   ├── config/
│   │   └── config.js               // Configuration (e.g., port, DB paths)
│   ├── models/                     // Database models
│   │   ├── user.js                 // User model (id, username, passwordHash, publicKey)
│   │   ├── message.js              // Message model (senderId, recipientId/groupId, timestamp, encryptedContent)
│   │   └── group.js                // Group model (id, groupName, etc.)
│   ├── routes/                     // API routes for various functionalities
│   │   ├── auth.js                 // Login & authentication endpoints
│   │   ├── messages.js             // Endpoints for sending/receiving messages
│   │   └── admin.js                // Endpoints for admin account management
│   └── database/                   
│       └── database.sqlite         // SQLite database file
│
├── electron-client/                
│   ├── package.json                // Electron client dependencies & scripts
│   ├── main.js                     // Main process (Electron app entry point)
│   ├── preload.js                  // (Optional) Preload scripts for secure renderer access
│   ├── renderer/                   // Renderer process (UI)
│   │   ├── index.html              // Main window for login or dashboard view
│   │   ├── login.html              // Login page UI
│   │   ├── chat.html               // Chat interface (one-on-one and group chats)
│   │   ├── assets/
│   │   │   ├── css/                // Stylesheets for the UI
│   │   │   └── js/                 // Client-side JavaScript (handling WebSocket, encryption via TweetNaCl.js, etc.)
│   └── encryption/
│       └── tweetnacl.min.js        // TweetNaCl.js library (or managed via npm)
│
├── admin-dashboard/                
│   ├── admin.html                  // Admin login and dashboard interface
│   ├── admin.js                    // JavaScript to handle admin functions (CRUD operations for user accounts)
│   └── admin.css                   // Styling for the admin dashboard
│
└── README.md                       // Project documentation and setup instructions
Detailed Functionality Breakdown
1. User Authentication and Account Management
Login Flow:
The Electron client displays a login form (login.html).
Credentials are sent to the Node.js/Express server (via /auth endpoint), where password hashes are compared.
Admin Dashboard:
A simple HTML page (admin.html) provides an admin login.
Once logged in, the admin can create, update, or delete user accounts via RESTful endpoints exposed by the server.
2. Messaging and Communication
One-on-One and Group Chats:
Messages are stored in the SQLite database with metadata including sender/recipient (or group IDs), timestamp, and encrypted content.
The server exposes endpoints (e.g., /messages) for sending and retrieving these messages.
Real-Time Updates:
Electron clients establish a WebSocket connection to the server.
When a message is sent, it’s encrypted on the client, relayed via the WebSocket, and then delivered to the intended recipient(s).
3. Encryption Implementation (E2EE)
Key Generation:
On first use, the Electron client uses TweetNaCl.js to generate a public/private key pair.
The public key is sent to the server (and stored in the user’s profile), while the private key remains securely on the client.
Encryption/Decryption:
Sending a Message:
The client retrieves the recipient’s public key from the server.
It then encrypts the message with TweetNaCl.js before sending it.
Receiving a Message:
The client receives the encrypted message and decrypts it using the locally stored private key.
4. Desktop Client with Electron
User Interface:
The Electron app provides a simple UI for login, one-on-one chat, and group chat views.
Minimal design ensures a focus on functionality over aesthetics.
Notifications:
The Electron Notification API is used to alert the user of incoming messages.
WebSocket Integration:
The Electron client maintains an active WebSocket connection for real-time message delivery and status updates.
5. Server-Side Functionality
Express Server:
Manages authentication, user management, and messaging endpoints.
Database Operations:
SQLite is used to store user credentials, keys, chat messages, and group data.
Security:
The server ensures that only authenticated users can access messaging endpoints and that the data relayed is strictly in its encrypted form.
This comprehensive plan—with detailed file structure, component breakdown, and functionality overview—should serve as a robust blueprint for developing your self-hosted, production-ready offline messenger.