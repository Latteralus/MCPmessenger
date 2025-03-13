// electron-client/renderer/assets/js/admin.js

document.addEventListener('DOMContentLoaded', () => {
  // DOM elements - Login
  const loginContainer = document.getElementById('login-container');
  const adminLoginForm = document.getElementById('admin-login-form');
  const loginError = document.getElementById('login-error');
  const loginButton = document.getElementById('login-button');

  // DOM elements - Dashboard
  const adminContainer = document.getElementById('admin-container');
  const logoutButton = document.getElementById('logout-button');
  const adminTabs = document.querySelectorAll('.admin-tab');
  const tabContents = document.querySelectorAll('.tab-content');

  // DOM elements - Users
  const usersTable = document.getElementById('users-table');
  const createUserBtn = document.getElementById('create-user-btn');
  const userModal = document.getElementById('user-modal');
  const userModalTitle = document.getElementById('user-modal-title');
  const userForm = document.getElementById('user-form');
  const userIdInput = document.getElementById('user-id');
  const userUsername = document.getElementById('user-username');
  const userPassword = document.getElementById('user-password');
  const userAdmin = document.getElementById('user-admin');
  const cancelUserModal = document.getElementById('cancel-user-modal');
  const userError = document.getElementById('user-error');

  // DOM elements - Groups
  const groupsTable = document.getElementById('groups-table');
  const membersModal = document.getElementById('members-modal');
  const groupNameTitle = document.getElementById('group-name-title');
  const membersTable = document.getElementById('members-table');
  const closeMembersModal = document.getElementById('close-members-modal');

  // DOM elements - System
  const refreshSystemBtn = document.getElementById('refresh-system-btn');
  const appVersion = document.getElementById('app-version');
  const appEnvironment = document.getElementById('app-environment');
  const appUptime = document.getElementById('app-uptime');
  const dbUserCount = document.getElementById('db-user-count');
  const dbGroupCount = document.getElementById('db-group-count');
  const dbMessageCount = document.getElementById('db-message-count');
  const serverNodeVersion = document.getElementById('server-node-version');
  const serverPlatform = document.getElementById('server-platform');
  const serverRequests = document.getElementById('server-requests');
  const logFilesList = document.getElementById('log-files-list');
  const clearLogsBtn = document.getElementById('clear-logs-btn');

  // DOM elements - Confirmation
  const confirmModal = document.getElementById('confirm-modal');
  const confirmMessage = document.getElementById('confirm-message');
  const cancelConfirm = document.getElementById('cancel-confirm');
  const confirmAction = document.getElementById('confirm-action');

  // State variables
  let currentTab = 'users';
  let token = localStorage.getItem('adminToken');
  let confirmCallback = null;
  let systemData = {};
  let startTime = Date.now();
  let uptimeInterval = null;
  const baseUrl = 'http://localhost:3000';

  // Initialize the dashboard
  function init() {
      // Check if logged in
      if (token) {
          // Verify token validity
          fetch(`${baseUrl}/api/auth/me`, {
              headers: {
                  'Authorization': `Bearer ${token}`
              }
          })
              .then(response => {
                  if (!response.ok) {
                      throw new Error('Authentication failed');
                  }
                  return response.json();
              })
              .then(data => {
                  // Check admin status
                  if (!data.isAdmin) {
                      throw new Error('Admin privileges required');
                  }
                  
                  // Show dashboard
                  loginContainer.classList.add('hidden');
                  adminContainer.classList.remove('hidden');
                  
                  // Load data for the current tab
                  loadData();
                  
                  // Start uptime counter for system tab
                  startUptimeCounter();
              })
              .catch(error => {
                  console.error('Token validation error:', error);
                  
                  // Clear token and show login
                  token = null;
                  localStorage.removeItem('adminToken');
                  loginContainer.classList.remove('hidden');
                  adminContainer.classList.add('hidden');
                  
                  showLoginError('Session expired. Please log in again.');
              });
      } else {
          // Show login
          loginContainer.classList.remove('hidden');
          adminContainer.classList.add('hidden');
      }

      // Setup event listeners
      setupEventListeners();
  }

  // Set up event listeners
  function setupEventListeners() {
      // Login form
      adminLoginForm.addEventListener('submit', handleLogin);

      // Logout button
      logoutButton.addEventListener('click', handleLogout);

      // Tab switching
      adminTabs.forEach(tab => {
          tab.addEventListener('click', () => {
              switchTab(tab.dataset.tab);
          });
      });

      // User management
      createUserBtn.addEventListener('click', () => showUserModal());
      cancelUserModal.addEventListener('click', hideUserModal);
      userForm.addEventListener('submit', handleUserSave);

      // Group management
      closeMembersModal.addEventListener('click', hideMembersModal);

      // System tab
      if (refreshSystemBtn) {
          refreshSystemBtn.addEventListener('click', () => {
              loadSystemInfo();
          });
      }

      if (clearLogsBtn) {
          clearLogsBtn.addEventListener('click', clearOldLogs);
      }

      // Confirmation modal
      cancelConfirm.addEventListener('click', hideConfirmModal);
      confirmAction.addEventListener('click', () => {
          if (confirmCallback) {
              confirmCallback();
          }
          hideConfirmModal();
      });

      // Network status
      window.addEventListener('online', updateNetworkStatus);
      window.addEventListener('offline', updateNetworkStatus);
  }

  // Update network status UI
  function updateNetworkStatus() {
      const isOnline = navigator.onLine;
      
      if (!isOnline && token) {
          showNotification('Network connection lost. Some features may not work properly.', 'error');
      }
  }

  // Show notification
  function showNotification(message, type = 'info') {
      const notification = document.createElement('div');
      notification.className = `notification ${type}`;
      notification.innerHTML = `
          <span>${message}</span>
          <span class="notification-close">&times;</span>
      `;
      
      const closeBtn = notification.querySelector('.notification-close');
      closeBtn.addEventListener('click', () => {
          notification.remove();
      });
      
      // Auto-remove after 5 seconds for non-error notifications
      if (type !== 'error') {
          setTimeout(() => {
              notification.remove();
          }, 5000);
      }
      
      // Add to notification area if it exists
      const notificationArea = document.getElementById('notification-area');
      if (notificationArea) {
          notificationArea.appendChild(notification);
      }
  }

  // Start uptime counter
  function startUptimeCounter() {
      if (uptimeInterval) {
          clearInterval(uptimeInterval);
      }
      
      startTime = Date.now();
      
      uptimeInterval = setInterval(() => {
          updateUptimeDisplay();
      }, 1000);
      
      updateUptimeDisplay();
  }

  // Update uptime display
  function updateUptimeDisplay() {
      if (!appUptime) return;
      
      const now = Date.now();
      const uptime = now - startTime;
      
      const hours = Math.floor(uptime / (1000 * 60 * 60));
      const minutes = Math.floor((uptime % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((uptime % (1000 * 60)) / 1000);
      
      appUptime.textContent = `${hours}h ${minutes}m ${seconds}s`;
  }

  // Handle login form submission
  async function handleLogin(e) {
      e.preventDefault();

      // Disable login button and show loading state
      loginButton.disabled = true;
      loginButton.textContent = 'Logging in...';
      hideLoginError();

      const username = document.getElementById('username').value;
      const password = document.getElementById('password').value;

      try {
          if (!navigator.onLine) {
              throw new Error('No network connection. Please check your internet connection.');
          }

          const response = await fetch(`${baseUrl}/api/auth/login`, {
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

          // Check if user is admin
          if (!data.user.isAdmin) {
              throw new Error('Access denied. Admin privileges required.');
          }

          // Save token
          token = data.token;
          localStorage.setItem('adminToken', token);

          // Show dashboard
          loginContainer.classList.add('hidden');
          adminContainer.classList.remove('hidden');

          // Load data
          loadData();
          
          // Start uptime counter
          startUptimeCounter();

      } catch (error) {
          console.error('Login error:', error);
          showLoginError(error.message);
      } finally {
          // Re-enable login button
          loginButton.disabled = false;
          loginButton.textContent = 'Login';
      }
  }

  // Handle logout
  function handleLogout() {
      // Confirm logout
      showConfirmModal('Are you sure you want to log out?', () => {
          // Clear token
          token = null;
          localStorage.removeItem('adminToken');

          // Stop uptime counter
          if (uptimeInterval) {
              clearInterval(uptimeInterval);
              uptimeInterval = null;
          }

          // Show login
          loginContainer.classList.remove('hidden');
          adminContainer.classList.add('hidden');
      });
  }

  // Switch between tabs
  function switchTab(tabName) {
      // Update active tab
      adminTabs.forEach(tab => {
          if (tab.dataset.tab === tabName) {
              tab.classList.add('active');
          } else {
              tab.classList.remove('active');
          }
      });

      // Update tab content
      tabContents.forEach(content => {
          if (content.id === `${tabName}-tab`) {
              content.classList.add('active');
          } else {
              content.classList.remove('active');
          }
      });

      // Update current tab
      currentTab = tabName;

      // Reload data
      loadData();
  }

  // Load data for the current tab
  function loadData() {
      if (currentTab === 'users') {
          loadUsers();
      } else if (currentTab === 'groups') {
          loadGroups();
      } else if (currentTab === 'system') {
          loadSystemInfo();
      }
  }

  // Generic API request handler with error handling
  async function apiRequest(url, options = {}) {
      try {
          if (!navigator.onLine) {
              throw new Error('No network connection');
          }

          const response = await fetch(url, {
              ...options,
              headers: {
                  ...options.headers,
                  'Authorization': `Bearer ${token}`
              }
          });

          if (response.status === 401 || response.status === 403) {
              // Handle authentication/authorization errors
              throw new Error('Session expired or access denied');
          }

          const data = await response.json();

          if (!response.ok) {
              throw new Error(data.error || `Request failed with status ${response.status}`);
          }

          return data;
      } catch (error) {
          // Handle authentication errors by logging out
          if (error.message.includes('Session expired') || error.message.includes('access denied')) {
              showNotification('Your session has expired. Please log in again.', 'error');
              setTimeout(() => {
                  handleLogout();
              }, 2000);
          } else if (error.message.includes('network')) {
              showNotification('Network error. Please check your connection.', 'error');
          } else {
              showNotification(`Error: ${error.message}`, 'error');
          }
          
          console.error('API Request Error:', error);
          throw error;
      }
  }

  // Load users data
  async function loadUsers() {
      try {
          usersTable.querySelector('tbody').innerHTML = '<tr><td colspan="6" class="loading-cell">Loading users...</td></tr>';

          const users = await apiRequest(`${baseUrl}/api/admin/users`);

          renderUsersTable(users);
      } catch (error) {
          console.error('Error loading users:', error);
          usersTable.querySelector('tbody').innerHTML = `<tr><td colspan="6" class="loading-cell">Error loading users. ${error.message}</td></tr>`;
      }
  }

  // Render users table
  function renderUsersTable(users) {
      if (!users || users.length === 0) {
          usersTable.querySelector('tbody').innerHTML = '<tr><td colspan="6" class="loading-cell">No users found</td></tr>';
          return;
      }

      const rows = users.map(user => {
          return `
              <tr>
                  <td>${user.id}</td>
                  <td>${escapeHtml(user.username)}</td>
                  <td>
                      <span class="status-badge ${user.is_admin ? 'admin' : 'user'}">
                          ${user.is_admin ? 'Yes' : 'No'}
                      </span>
                  </td>
                  <td>
                      <span class="status-badge ${user.has_key ? 'yes' : 'no'}">
                          ${user.has_key ? 'Yes' : 'No'}
                      </span>
                  </td>
                  <td>${formatDate(user.created_at)}</td>
                  <td>
                      <div class="action-buttons">
                          <button class="btn btn-warning btn-edit-user" data-id="${user.id}">Edit</button>
                          <button class="btn btn-danger btn-delete-user" data-id="${user.id}">Delete</button>
                      </div>
                  </td>
              </tr>
          `;
      }).join('');

      usersTable.querySelector('tbody').innerHTML = rows;

      // Add event listeners for edit and delete buttons
      document.querySelectorAll('.btn-edit-user').forEach(btn => {
          btn.addEventListener('click', () => {
              const userId = parseInt(btn.dataset.id);
              editUser(userId);
          });
      });

      document.querySelectorAll('.btn-delete-user').forEach(btn => {
          btn.addEventListener('click', () => {
              const userId = parseInt(btn.dataset.id);
              deleteUser(userId);
          });
      });
  }

  // Load groups data
  async function loadGroups() {
      try {
          groupsTable.querySelector('tbody').innerHTML = '<tr><td colspan="6" class="loading-cell">Loading groups...</td></tr>';

          const groups = await apiRequest(`${baseUrl}/api/admin/groups`);

          renderGroupsTable(groups);
      } catch (error) {
          console.error('Error loading groups:', error);
          groupsTable.querySelector('tbody').innerHTML = `<tr><td colspan="6" class="loading-cell">Error loading groups. ${error.message}</td></tr>`;
      }
  }

  // Render groups table
  function renderGroupsTable(groups) {
      if (!groups || groups.length === 0) {
          groupsTable.querySelector('tbody').innerHTML = '<tr><td colspan="6" class="loading-cell">No groups found</td></tr>';
          return;
      }

      const rows = groups.map(group => {
          return `
              <tr>
                  <td>${group.id}</td>
                  <td>${escapeHtml(group.name)}</td>
                  <td>${escapeHtml(group.created_by_name)}</td>
                  <td>${group.member_count}</td>
                  <td>${formatDate(group.created_at)}</td>
                  <td>
                      <div class="action-buttons">
                          <button class="btn btn-primary btn-view-members" data-id="${group.id}" data-name="${escapeHtml(group.name)}">Members</button>
                          <button class="btn btn-danger btn-delete-group" data-id="${group.id}">Delete</button>
                      </div>
                  </td>
              </tr>
          `;
      }).join('');

      groupsTable.querySelector('tbody').innerHTML = rows;

      // Add event listeners for view members and delete buttons
      document.querySelectorAll('.btn-view-members').forEach(btn => {
          btn.addEventListener('click', () => {
              const groupId = parseInt(btn.dataset.id);
              const groupName = btn.dataset.name;
              viewGroupMembers(groupId, groupName);
          });
      });

      document.querySelectorAll('.btn-delete-group').forEach(btn => {
          btn.addEventListener('click', () => {
              const groupId = parseInt(btn.dataset.id);
              deleteGroup(groupId);
          });
      });
  }

  // Load system information
  async function loadSystemInfo() {
      if (!appVersion || !appEnvironment) return;
      
      try {
          // Set loading state
          dbUserCount.textContent = 'Loading...';
          dbGroupCount.textContent = 'Loading...';
          dbMessageCount.textContent = 'Loading...';
          serverNodeVersion.textContent = 'Loading...';
          serverPlatform.textContent = 'Loading...';
          serverRequests.textContent = 'Loading...';
          logFilesList.innerHTML = '<div class="loading-cell">Loading log files...</div>';
          
          // Get application info
          appVersion.textContent = '1.0.0'; // This would come from your package.json
          appEnvironment.textContent = process.env.NODE_ENV || 'Production';
          
          // Get system info from API
          const systemInfo = await apiRequest(`${baseUrl}/api/admin/system-info`);
          
          // Update UI with system info
          if (systemInfo) {
              dbUserCount.textContent = systemInfo.userCount || '0';
              dbGroupCount.textContent = systemInfo.groupCount || '0';
              dbMessageCount.textContent = systemInfo.messageCount || '0';
              serverNodeVersion.textContent = systemInfo.nodeVersion || 'Unknown';
              serverPlatform.textContent = systemInfo.platform || 'Unknown';
              serverRequests.textContent = systemInfo.requestsServed || '0';
              
              // Render log files list
              renderLogFilesList(systemInfo.logFiles || []);
              
              // Save system data
              systemData = systemInfo;
          }
      } catch (error) {
          console.error('Error loading system info:', error);
          showNotification(`Error loading system information: ${error.message}`, 'error');
          
          // Update UI with default values
          dbUserCount.textContent = 'Error';
          dbGroupCount.textContent = 'Error';
          dbMessageCount.textContent = 'Error';
          logFilesList.innerHTML = '<div class="loading-cell">Error loading log files</div>';
      }
  }

  // Render log files list
  function renderLogFilesList(logFiles) {
      if (!logFilesList) return;
      
      if (!logFiles || logFiles.length === 0) {
          logFilesList.innerHTML = '<div class="loading-cell">No log files found</div>';
          return;
      }
      
      const logItems = logFiles.map(log => {
          const fileDate = formatDate(log.date);
          const fileSize = formatFileSize(log.size);
          
          return `
              <div class="log-item" data-path="${escapeHtml(log.path)}">
                  <span class="log-date">${fileDate}</span>
                  <span class="log-size">${fileSize}</span>
              </div>
          `;
      }).join('');
      
      logFilesList.innerHTML = logItems;
      
      // Add event listeners for log file viewing
      document.querySelectorAll('.log-item').forEach(item => {
          item.addEventListener('click', () => {
              const logPath = item.dataset.path;
              viewLogFile(logPath);
          });
      });
  }

  // View log file content
  async function viewLogFile(logPath) {
      try {
          const logData = await apiRequest(`${baseUrl}/api/admin/logs/${encodeURIComponent(logPath)}`);
          
          if (logData && logData.content) {
              // Show log content in modal
              logContent.textContent = logData.content;
              logModalTitle.textContent = `Log File: ${logPath.split('/').pop()}`;
              currentLogFile = logPath;
              
              // Show modal
              logModal.classList.remove('hidden');
          } else {
              showNotification('Log file is empty or could not be loaded', 'warning');
          }
      } catch (error) {
          console.error('Error viewing log file:', error);
          showNotification(`Error viewing log file: ${error.message}`, 'error');
      }
  }

  // Clear old log files
  async function clearOldLogs() {
      showConfirmModal('Are you sure you want to clear old log files? This will delete all logs older than 7 days.', async () => {
          try {
              await apiRequest(`${baseUrl}/api/admin/logs/cleanup`, { method: 'POST' });
              
              showNotification('Old log files have been deleted', 'success');
              
              // Reload system info to update the log files list
              loadSystemInfo();
          } catch (error) {
              console.error('Error clearing old logs:', error);
              showNotification(`Error clearing old logs: ${error.message}`, 'error');
          }
      });
  }

  // Show user modal for creating or editing a user
  function showUserModal(user = null) {
      // Clear previous form data
      userForm.reset();
      hideUserError();

      if (user) {
          // Edit mode
          userModalTitle.textContent = 'Edit User';
          userIdInput.value = user.id;
          userUsername.value = user.username;
          userAdmin.checked = user.is_admin;
          userPassword.required = false; // Password not required when editing
      } else {
          // Create mode
          userModalTitle.textContent = 'Create User';
          userIdInput.value = '';
          userUsername.value = '';
          userAdmin.checked = false;
          userPassword.required = true; // Password required when creating
      }

      // Show modal
      userModal.classList.remove('hidden');
  }

  // Hide user modal
  function hideUserModal() {
      userModal.classList.add('hidden');
  }

  // Show members modal
  async function viewGroupMembers(groupId, groupName) {
      try {
          groupNameTitle.textContent = groupName;
          membersTable.querySelector('tbody').innerHTML = '<tr><td colspan="3" class="loading-cell">Loading members...</td></tr>';
          
          // Show modal
          membersModal.classList.remove('hidden');

          const members = await apiRequest(`${baseUrl}/api/admin/groups/${groupId}/members`);

          if (!members || members.length === 0) {
              membersTable.querySelector('tbody').innerHTML = '<tr><td colspan="3" class="loading-cell">No members found</td></tr>';
              return;
          }

          const rows = members.map(member => {
              return `
                  <tr>
                      <td>${member.id}</td>
                      <td>${escapeHtml(member.username)}</td>
                      <td>${formatDate(member.joined_at)}</td>
                  </tr>
              `;
          }).join('');

          membersTable.querySelector('tbody').innerHTML = rows;

      } catch (error) {
          console.error('Error loading group members:', error);
          membersTable.querySelector('tbody').innerHTML = `<tr><td colspan="3" class="loading-cell">Error: ${error.message}</td></tr>`;
      }
  }

  // Hide members modal
  function hideMembersModal() {
      membersModal.classList.add('hidden');
  }

  // Show confirmation modal
  function showConfirmModal(message, callback) {
      confirmMessage.textContent = message;
      confirmCallback = callback;
      confirmModal.classList.remove('hidden');
  }

  // Hide confirmation modal
  function hideConfirmModal() {
      confirmModal.classList.add('hidden');
      confirmCallback = null;
  }

  // Edit a user
  async function editUser(userId) {
      try {
          const user = await apiRequest(`${baseUrl}/api/admin/users/${userId}`);
          showUserModal(user);

      } catch (error) {
          console.error('Error loading user data:', error);
          showNotification(`Error loading user data: ${error.message}`, 'error');
      }
  }

  // Delete a user
  function deleteUser(userId) {
      showConfirmModal('Are you sure you want to delete this user? This action cannot be undone.', async () => {
          try {
              await apiRequest(`${baseUrl}/api/admin/users/${userId}`, {
                  method: 'DELETE'
              });

              showNotification('User deleted successfully', 'success');
              
              // Reload users data
              loadUsers();

          } catch (error) {
              console.error('Error deleting user:', error);
              showNotification(`Error deleting user: ${error.message}`, 'error');
          }
      });
  }

  // Delete a group
  function deleteGroup(groupId) {
      showConfirmModal('Are you sure you want to delete this group? All messages will be permanently deleted. This action cannot be undone.', async () => {
          try {
              await apiRequest(`${baseUrl}/api/admin/groups/${groupId}`, {
                  method: 'DELETE'
              });

              showNotification('Group deleted successfully', 'success');
              
              // Reload groups data
              loadGroups();

          } catch (error) {
              console.error('Error deleting group:', error);
              showNotification(`Error deleting group: ${error.message}`, 'error');
          }
      });
  }

  // Handle user form submission
  async function handleUserSave(e) {
      e.preventDefault();

      const userId = userIdInput.value;
      const username = userUsername.value;
      const password = userPassword.value;
      const isAdmin = userAdmin.checked;

      try {
          let url, method;

          const userData = {
              username,
              isAdmin
          };

          if (password) {
              userData.password = password;
          }

          if (userId) {
              // Edit user
              url = `${baseUrl}/api/admin/users/${userId}`;
              method = 'PUT';
          } else {
              // Create user
              url = `${baseUrl}/api/admin/users`;
              method = 'POST';
          }

          await apiRequest(url, {
              method,
              headers: {
                  'Content-Type': 'application/json'
              },
              body: JSON.stringify(userData)
          });

          // Show success notification
          showNotification(
              userId ? 'User updated successfully' : 'User created successfully',
              'success'
          );

          // Hide modal
          hideUserModal();

          // Reload users data
          loadUsers();

      } catch (error) {
          console.error('Error saving user:', error);
          showUserError(error.message);
      }
  }

  // Show login error
  function showLoginError(message) {
      loginError.textContent = message;
      loginError.classList.remove('hidden');
  }

  // Hide login error
  function hideLoginError() {
      loginError.textContent = '';
      loginError.classList.add('hidden');
  }

  // Show user error
  function showUserError(message) {
      userError.textContent = message;
      userError.classList.remove('hidden');
  }

  // Hide user error
  function hideUserError() {
      userError.textContent = '';
      userError.classList.add('hidden');
  }

  // Format date for display
  function formatDate(dateString) {
      if (!dateString) return 'N/A';
      
      try {
          const date = new Date(dateString);
          return date.toLocaleString();
      } catch (e) {
          return dateString;
      }
  }

  // Format file size for display
  function formatFileSize(sizeInBytes) {
      if (sizeInBytes < 1024) {
          return sizeInBytes + ' B';
      } else if (sizeInBytes < 1024 * 1024) {
          return (sizeInBytes / 1024).toFixed(2) + ' KB';
      } else if (sizeInBytes < 1024 * 1024 * 1024) {
          return (sizeInBytes / (1024 * 1024)).toFixed(2) + ' MB';
      } else {
          return (sizeInBytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
      }
  }

  // Escape HTML to prevent XSS
  function escapeHtml(str) {
      if (!str) return '';
      return String(str)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#039;');
  }

  // Handle errors globally
  window.addEventListener('error', function(event) {
      console.error('Global error:', event.error);
      showNotification(`An error occurred: ${event.error.message}`, 'error');
  });

  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', function(event) {
      console.error('Unhandled promise rejection:', event.reason);
      showNotification(`An error occurred: ${event.reason.message || 'Unknown error'}`, 'error');
  });

  // Initialize the dashboard
  init();
});