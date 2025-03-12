# Database Directory

This directory contains the SQLite database file for the MCP Messenger application.

The database file (`database.sqlite`) will be automatically created when the server first starts up. It will also be automatically initialized with the necessary tables and a default admin user.

## Database Schema

The database includes the following tables:

1. **users** - Stores user account information
   - `id` - Unique identifier
   - `username` - Unique username
   - `password_hash` - Bcrypt hash of the user's password
   - `public_key` - User's public key for E2EE
   - `is_admin` - Boolean flag for admin privileges
   - `created_at` - Timestamp of account creation

2. **messages** - Stores encrypted messages
   - `id` - Unique identifier
   - `sender_id` - ID of the user who sent the message
   - `recipient_id` - ID of the recipient user (for direct messages)
   - `group_id` - ID of the recipient group (for group messages)
   - `encrypted_content` - Encrypted message content
   - `timestamp` - Timestamp of when the message was sent

3. **groups** - Stores information about group chats
   - `id` - Unique identifier
   - `name` - Group name
   - `created_by` - ID of the user who created the group
   - `created_at` - Timestamp of group creation

4. **group_members** - Stores group membership information
   - `group_id` - ID of the group
   - `user_id` - ID of the user who is a member
   - `joined_at` - Timestamp of when the user joined the group

## Default Admin Account

When the server is first started, a default admin account will be created with the following credentials:

- Username: `admin`
- Password: `admin123`

**Important**: Be sure to change the default admin password after first login!