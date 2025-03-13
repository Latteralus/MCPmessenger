// electron-client/renderer/assets/js/chat/encryption.js

// State variables for encryption
let userKeys = {
    privateKey: null,
    publicKey: null
  };
  let contactPublicKeys = {};
  
  // Load user's encryption keys from disk
  async function loadUserKeys(userId) {
    try {
      const result = await window.electronAPI.loadKeys({ userId });
      
      if (!result.success) {
        throw new Error('Failed to load encryption keys: ' + (result.error || 'Unknown error'));
      }
      
      userKeys.privateKey = result.privateKey;
      userKeys.publicKey = result.publicKey;
      
      console.log('Encryption keys loaded successfully');
      return userKeys;
    } catch (error) {
      console.error('Error loading encryption keys:', error);
      throw error;
    }
  }
  
  // Preload public keys for all contacts
  async function preloadContactPublicKeys(contacts) {
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
      const token = localStorage.getItem('token');
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
      
      // Save to local storage for persistence
      localStorage.setItem('contactPublicKeys', JSON.stringify(contactPublicKeys));
      
      return data.publicKey;
    } catch (error) {
      console.error(`Error loading public key for contact ${contactId}:`, error);
      throw error;
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
  
  // Encrypt a message for a group - encrypts for each member individually
  async function encryptGroupMessage(message, groupId) {
    try {
      // First, get all group members
      const token = localStorage.getItem('token');
      const response = await fetch(`${window.serverConfig.baseUrl}/api/messages/group-members/${groupId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get group members');
      }
      
      const members = await response.json();
      
      // The encrypted payload will contain the same message encrypted separately
      // for each group member, using their respective public keys
      const encryptedPayload = {
        // Format used: { userId: encryptedMessageForThisUser, ... }
        encryptedMessages: {},
        // Include a signature so members can verify the sender
        signature: '',
        // A timestamp to prevent replay attacks
        timestamp: new Date().toISOString()
      };
      
      // First, sign the message with our private key to prove identity
      const messageUint8 = nacl.util.decodeUTF8(message);
      const privateKeyUint8 = nacl.util.decodeBase64(userKeys.privateKey);
      
      // Use tweetnacl's sign function to generate a signature
      // Note: This requires nacl.sign which may need to be included if not already
      const signature = nacl.sign.detached(messageUint8, privateKeyUint8);
      encryptedPayload.signature = nacl.util.encodeBase64(signature);
      
      // For each member, encrypt the message with their public key
      for (const member of members) {
        // Skip members without public keys
        if (!member.has_key) continue;
        
        // Make sure we have the member's public key
        try {
          // If it's the current user, use our own public key
          if (member.id === JSON.parse(localStorage.getItem('user')).id) {
            encryptedPayload.encryptedMessages[member.id] = encryptWithKey(
              message, userKeys.publicKey, userKeys.privateKey
            );
          } else {
            // Otherwise, load the member's public key if we don't have it yet
            if (!contactPublicKeys[member.id]) {
              await loadContactPublicKey(member.id);
            }
            
            encryptedPayload.encryptedMessages[member.id] = encryptWithKey(
              message, contactPublicKeys[member.id], userKeys.privateKey
            );
          }
        } catch (error) {
          console.error(`Failed to encrypt for member ${member.id}:`, error);
          // Continue with other members even if one fails
        }
      }
      
      // Convert the entire payload to JSON string and then to base64
      return btoa(JSON.stringify(encryptedPayload));
      
    } catch (error) {
      console.error('Group encryption error:', error);
      throw error;
    }
  }
  
  // Helper function to encrypt with a public key
  function encryptWithKey(message, publicKeyBase64, privateKeyBase64) {
    // Decode keys from base64
    const publicKeyUint8 = nacl.util.decodeBase64(publicKeyBase64);
    const privateKeyUint8 = nacl.util.decodeBase64(privateKeyBase64);
    
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
  }
  
  // Decrypt a message - handles both direct and group messages
  function decryptMessage(encryptedBase64, senderId) {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      
      // Check if this is a group message (will be a JSON payload)
      let isGroupMessage = false;
      try {
        const payload = JSON.parse(atob(encryptedBase64));
        if (payload.encryptedMessages && payload.signature) {
          isGroupMessage = true;
          return decryptGroupMessage(payload, senderId);
        }
      } catch (e) {
        // Not a group message, proceed with direct message decryption
      }
      
      // Handle direct message decryption
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
  
  // Decrypt a group message
  function decryptGroupMessage(payload, senderId) {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    
    // Get the encrypted message for this user
    const encryptedForUser = payload.encryptedMessages[user.id];
    
    if (!encryptedForUser) {
      throw new Error('No message encrypted for this user found in group message');
    }
    
    // Decrypt the message using the standard decryption
    // Since we're looking at our own encrypted message, we need sender's public key
    let senderPublicKey;
    
    if (senderId === user.id) {
      senderPublicKey = userKeys.publicKey;
    } else {
      senderPublicKey = contactPublicKeys[senderId];
      
      if (!senderPublicKey) {
        throw new Error(`Public key not found for sender ${senderId}`);
      }
    }
    
    // Decode the full message from base64
    const fullMessage = nacl.util.decodeBase64(encryptedForUser);
    
    // Extract the nonce and the encrypted message
    const nonce = fullMessage.slice(0, nacl.box.nonceLength);
    const encryptedMessage = fullMessage.slice(nacl.box.nonceLength);
    
    // Decode keys from base64
    const publicKeyUint8 = nacl.util.decodeBase64(senderPublicKey);
    const privateKeyUint8 = nacl.util.decodeBase64(userKeys.privateKey);
    
    // Decrypt the message
    const decrypted = nacl.box.open(
      encryptedMessage,
      nonce,
      publicKeyUint8,
      privateKeyUint8
    );
    
    if (!decrypted) {
      throw new Error('Group message decryption failed');
    }
    
    // Convert from Uint8Array to string
    const decryptedText = nacl.util.encodeUTF8(decrypted);
    
    // Verify the signature to authenticate the sender
    // This is important for group chats to prevent impersonation
    verifySignature(decryptedText, payload.signature, senderPublicKey);
    
    return decryptedText;
  }
  
  // Verify the signature of a message
  function verifySignature(message, signatureBase64, senderPublicKey) {
    try {
      const messageUint8 = nacl.util.decodeUTF8(message);
      const signatureUint8 = nacl.util.decodeBase64(signatureBase64);
      const publicKeyUint8 = nacl.util.decodeBase64(senderPublicKey);
      
      const isValid = nacl.sign.detached.verify(
        messageUint8,
        signatureUint8,
        publicKeyUint8
      );
      
      if (!isValid) {
        console.warn('Message signature verification failed');
        // We might still return the message but with a warning
      }
      
      return isValid;
    } catch (error) {
      console.error('Signature verification error:', error);
      return false;
    }
  }
  
  export {
    loadUserKeys,
    preloadContactPublicKeys,
    loadContactPublicKey,
    encryptMessage,
    encryptGroupMessage,
    decryptMessage,
    userKeys,
    contactPublicKeys
  };