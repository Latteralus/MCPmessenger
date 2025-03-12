// admin-dashboard/admin.js

document.addEventListener('DOMContentLoaded', () => {
    // DOM elements - Login
    const loginContainer = document.getElementById('login-container');
    const adminLoginForm = document.getElementById('admin-login-form');
    const loginError = document.getElementById('login-error');
  
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
  
    // DOM elements - Confirmation
    const confirmModal = document.getElementById('confirm-modal');
    const confirmMessage = document.getElementById('confirm-message');
    const cancelConfirm = document.getElementById('cancel-confirm');
    const confirmAction = document.getElementById('confirm-action');
  
    // State variables
    let currentTab = 'users';
    let token = localStorage.getItem('adminToken');
    let confirmCallback = null;
    const baseUrl = 'http://localhost:3000';
  
    // Initialize the dashboard
    function init() {
      // Check if logged in
      if (token) {
        // Show dashboard
        loginContainer.classList.add('hidden');
        adminContainer.classList.remove('hidden');
        loadData();
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
  
      // Confirmation modal
      cancelConfirm.addEventListener('click', hideConfirmModal);
      confirmAction.addEventListener('click', () => {
        if (confirmCallback) {
          confirmCallback();
        }
        hideConfirmModal();
      });
    }
  
    // Handle login form submission
    async function handleLogin(e) {
      e.preventDefault();
  
      const username = document.getElementById('username').value;
      const password = document.getElementById('password').value;
  
      try {
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
  
      } catch (error) {
        showLoginError(error.message);
      }
    }
  
    // Handle logout
    function handleLogout() {
      // Clear token
      token = null;
      localStorage.removeItem('adminToken');
  
      // Show login
      loginContainer.classList.remove('hidden');
      adminContainer.classList.add('hidden');
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
  
      // Reload data if needed
      loadData();
    }
  
    // Load data for the current tab
    function loadData() {
      if (currentTab === 'users') {
        loadUsers();
      } else if (currentTab === 'groups') {
        loadGroups();
      }
    }
  
    // Load users data
    async function loadUsers() {
      try {
        usersTable.querySelector('tbody').innerHTML = '<tr><td colspan="6">Loading users...</td></tr>';
  
        const response = await fetch(`${baseUrl}/api/admin/users`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
  
        if (!response.ok) {
          throw new Error('Failed to load users');
        }
  
        const users = await response.json();
  
        renderUsersTable(users);
      } catch (error) {
        console.error('Error loading users:', error);
        usersTable.querySelector('tbody').innerHTML = `<tr><td colspan="6">Error: ${error.message}</td></tr>`;
      }
    }
  
    // Render users table
    function renderUsersTable(users) {
      if (users.length === 0) {
        usersTable.querySelector('tbody').innerHTML = '<tr><td colspan="6">No users found</td></tr>';
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
        groupsTable.querySelector('tbody').innerHTML = '<tr><td colspan="6">Loading groups...</td></tr>';
  
        const response = await fetch(`${baseUrl}/api/admin/groups`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
  
        if (!response.ok) {
          throw new Error('Failed to load groups');
        }
  
        const groups = await response.json();
  
        renderGroupsTable(groups);
      } catch (error) {
        console.error('Error loading groups:', error);
        groupsTable.querySelector('tbody').innerHTML = `<tr><td colspan="6">Error: ${error.message}</td></tr>`;
      }
    }
  
    // Render groups table
    function renderGroupsTable(groups) {
      if (groups.length === 0) {
        groupsTable.querySelector('tbody').innerHTML = '<tr><td colspan="6">No groups found</td></tr>';
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
        membersTable.querySelector('tbody').innerHTML = '<tr><td colspan="3">Loading members...</td></tr>';
        
        // Show modal
        membersModal.classList.remove('hidden');
  
        const response = await fetch(`${baseUrl}/api/admin/groups/${groupId}/members`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
  
        if (!response.ok) {
          throw new Error('Failed to load group members');
        }
  
        const members = await response.json();
  
        if (members.length === 0) {
          membersTable.querySelector('tbody').innerHTML = '<tr><td colspan="3">No members found</td></tr>';
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
        membersTable.querySelector('tbody').innerHTML = `<tr><td colspan="3">Error: ${error.message}</td></tr>`;
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
        const response = await fetch(`${baseUrl}/api/admin/users/${userId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
  
        if (!response.ok) {
          throw new Error('Failed to load user data');
        }
  
        const user = await response.json();
        showUserModal(user);
  
      } catch (error) {
        console.error('Error loading user data:', error);
        alert(`Error: ${error.message}`);
      }
    }
  
    // Delete a user
    function deleteUser(userId) {
      showConfirmModal('Are you sure you want to delete this user? This action cannot be undone.', async () => {
        try {
          const response = await fetch(`${baseUrl}/api/admin/users/${userId}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
  
          if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'Failed to delete user');
          }
  
          // Reload users data
          loadUsers();
  
        } catch (error) {
          console.error('Error deleting user:', error);
          alert(`Error: ${error.message}`);
        }
      });
    }
  
    // Delete a group
    function deleteGroup(groupId) {
      showConfirmModal('Are you sure you want to delete this group? All messages will be permanently deleted. This action cannot be undone.', async () => {
        try {
          const response = await fetch(`${baseUrl}/api/admin/groups/${groupId}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
  
          if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'Failed to delete group');
          }
  
          // Reload groups data
          loadGroups();
  
        } catch (error) {
          console.error('Error deleting group:', error);
          alert(`Error: ${error.message}`);
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
  
        const response = await fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(userData)
        });
  
        const data = await response.json();
  
        if (!response.ok) {
          throw new Error(data.error || 'Failed to save user');
        }
  
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
      if (!dateString) return '';
      const date = new Date(dateString);
      return date.toLocaleString();
    }
  
    // Escape HTML to prevent XSS
    function escapeHtml(str) {
      if (!str) return '';
      return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }
  
    // Initialize the dashboard
    init();
  });