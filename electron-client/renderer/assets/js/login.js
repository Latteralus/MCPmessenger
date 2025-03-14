// electron-client/renderer/assets/js/login.js

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('login-form');
  const loginButton = document.getElementById('login-button');
  const loginError = document.getElementById('login-error');
  const keyModal = document.getElementById('key-modal');
  const keyProgress = document.getElementById('key-progress');
  const keyStatus = document.getElementById('key-status');
  
  // Check if user is already logged in
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  
  if (token && user.id) {
    // Log navigation
    console.log('User already logged in, navigating to chat');
    
    // Redirect to chat.html if already logged in
    window.electronAPI.navigate({ page: 'chat.html' })
      .catch(error => {
        console.error('Navigation error:', error);
        showError('Failed to navigate to chat page. Please restart the application.');
      });
    return;
  }
  
  // Handle login form submission
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Clear previous error
    hideError();
    
    // Disable login button to prevent multiple submissions
    loginButton.disabled = true;
    loginButton.textContent = 'Logging in...';
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    try {
      console.log(`Attempting login for user: ${username}`);
      
      const response = await fetch(`${window.serverConfig.baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }
      
      console.log('Login successful');
      
      // Save token and user info
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      
      // Check if user has encryption keys
      console.log('Checking for existing encryption keys');
      const keysExist = await window.electronAPI.checkKeysExist({ userId: data.user.id });
      
      if (keysExist.success && keysExist.exists) {
        // If keys exist, proceed to chat
        console.log('Encryption keys exist, navigating to chat');
        window.electronAPI.navigate({ page: 'chat.html' });
      } else {
        // If keys don't exist, show key generation modal
        console.log('No encryption keys found, starting key generation');
        showKeyGenerationModal(data.user.id);
      }
      
    } catch (error) {
      console.error('Login error:', error);
      
      // Handle network errors
      if (!navigator.onLine) {
        showError('Network error. Please check your internet connection.');
      } else if (error.name === 'TypeError' && error.message.includes('fetch')) {
        showError('Unable to connect to server. Please check if the server is running.');
      } else {
        showError(error.message || 'Login failed. Please check your credentials.');
      }
      
      loginButton.disabled = false;
      loginButton.textContent = 'Login';
    }
  });
  
  // Generate encryption keys
  async function generateKeys(userId) {
    try {
      keyStatus.textContent = 'Generating encryption keys...';
      keyProgress.style.width = '30%';
      
      console.log('Starting encryption key generation');
      
      // Generate new key pair
      const keyPair = nacl.box.keyPair();
      
      // Convert keys to base64 for storage
      const publicKeyBase64 = nacl.util.encodeBase64(keyPair.publicKey);
      const privateKeyBase64 = nacl.util.encodeBase64(keyPair.secretKey);
      
      keyProgress.style.width = '60%';
      keyStatus.textContent = 'Saving encryption keys...';
      
      console.log('Keys generated, saving locally');
      
      // Save keys locally
      const saveResult = await window.electronAPI.saveKeys({
        userId,
        publicKey: publicKeyBase64,
        privateKey: privateKeyBase64
      });
      
      if (!saveResult.success) {
        throw new Error('Failed to save keys locally: ' + (saveResult.error || 'Unknown error'));
      }
      
      keyProgress.style.width = '80%';
      keyStatus.textContent = 'Registering public key with server...';
      
      console.log('Keys saved locally, registering with server');
      
      // Send public key to server
      const token = localStorage.getItem('token');
      const response = await fetch(`${window.serverConfig.baseUrl}/api/auth/public-key`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ publicKey: publicKeyBase64 })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to register public key with server');
      }
      
      keyProgress.style.width = '100%';
      keyStatus.textContent = 'Key generation complete!';
      
      console.log('Key generation and registration complete');
      
      // Wait a moment before navigating to chat
      setTimeout(() => {
        window.electronAPI.navigate({ page: 'chat.html' });
      }, 1000);
      
    } catch (error) {
      console.error('Key generation error:', error);
      
      keyProgress.style.width = '0%';
      keyStatus.textContent = `Error: ${error.message}`;
      
      // Add a retry button
      keyStatus.innerHTML += '<br><br><button id="retry-key-gen" class="btn btn-primary">Retry</button>';
      
      document.getElementById('retry-key-gen').addEventListener('click', () => {
        console.log('Retrying key generation');
        generateKeys(userId);
      });
    }
  }
  
  // Show key generation modal and start key generation
  function showKeyGenerationModal(userId) {
    keyModal.classList.remove('hidden');
    keyProgress.style.width = '10%';
    keyStatus.textContent = 'Preparing key generation...';
    
    // Start key generation process
    setTimeout(() => {
      generateKeys(userId);
    }, 500);
  }

        // After successful login:
if (data.user.isAdmin) {
  localStorage.setItem('userIsAdmin', 'true');
  window.electronAPI.updateAdminStatus({ isAdmin: true });
} else {
  localStorage.setItem('userIsAdmin', 'false');
  window.electronAPI.updateAdminStatus({ isAdmin: false });
}
  
  // Helper function to show error message
  function showError(message) {
    console.error('Login error:', message);
    loginError.textContent = message;
    loginError.classList.remove('hidden');
  }
  
  // Helper function to hide error message
  function hideError() {
    loginError.textContent = '';
    loginError.classList.add('hidden');
  }
});