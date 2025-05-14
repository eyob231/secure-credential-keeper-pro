
/**
 * Popup UI script
 */

// Views
const lockedView = document.getElementById('locked-view');
const dashboardView = document.getElementById('dashboard-view');
const settingsView = document.getElementById('settings-view');
const detailView = document.getElementById('detail-view');

// Locked view elements
const masterPasswordInput = document.getElementById('master-password');
const unlockBtn = document.getElementById('unlock-btn');
const loginError = document.getElementById('login-error');
const setupMessage = document.getElementById('setup-message');

// Dashboard view elements
const lockBtn = document.getElementById('lock-btn');
const searchInput = document.getElementById('search-input');
const credentialsList = document.getElementById('credentials-list');
const emptyState = document.getElementById('empty-state');
const settingsBtn = document.getElementById('settings-btn');
const exportBtn = document.getElementById('export-btn');
const importBtn = document.getElementById('import-btn');

// Settings view elements
const backBtn = document.getElementById('back-btn');
const changePasswordBtn = document.getElementById('change-password-btn');
const autofillToggle = document.getElementById('autofill-toggle');
const autosaveToggle = document.getElementById('autosave-toggle');
const allowHttpToggle = document.getElementById('allow-http-toggle');

// Detail view elements
const backToListBtn = document.getElementById('back-to-list-btn');
const detailDomain = document.getElementById('detail-domain');
const detailUsername = document.getElementById('detail-username');
const detailPassword = document.getElementById('detail-password');
const detailNotes = document.getElementById('detail-notes');
const saveChangesBtn = document.getElementById('save-changes-btn');
const deleteCredentialBtn = document.getElementById('delete-credential-btn');

// Current state
let currentCredential = null;
let allCredentials = [];
let filteredCredentials = [];

// Initialize the popup
async function init() {
  // Check if the vault is unlocked
  const { unlocked } = await chrome.runtime.sendMessage({ action: 'isUnlocked' });
  
  if (unlocked) {
    showDashboard();
  } else {
    // Check if the master password is set
    const isMasterPasswordSet = await checkMasterPasswordSet();
    setupMessage.textContent = isMasterPasswordSet
      ? 'Enter your master password to unlock'
      : 'First time? Set a master password to get started.';
    
    showLockedView();
  }
  
  // Set up event listeners
  setupEventListeners();
}

// Check if master password is set
async function checkMasterPasswordSet() {
  try {
    const { settings } = await chrome.runtime.sendMessage({ action: 'getSettings' });
    return settings !== null;
  } catch (error) {
    return false;
  }
}

// Set up event listeners
function setupEventListeners() {
  // Locked view
  unlockBtn.addEventListener('click', handleUnlock);
  masterPasswordInput.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') handleUnlock();
  });
  
  // Dashboard view
  lockBtn.addEventListener('click', handleLock);
  searchInput.addEventListener('input', handleSearch);
  settingsBtn.addEventListener('click', showSettings);
  exportBtn.addEventListener('click', handleExport);
  importBtn.addEventListener('click', handleImport);
  
  // Settings view
  backBtn.addEventListener('click', showDashboard);
  changePasswordBtn.addEventListener('click', showChangePasswordDialog);
  autofillToggle.addEventListener('change', saveSettings);
  autosaveToggle.addEventListener('change', saveSettings);
  allowHttpToggle.addEventListener('change', saveSettings);
  
  // Detail view
  backToListBtn.addEventListener('click', showDashboard);
  saveChangesBtn.addEventListener('click', handleSaveChanges);
  deleteCredentialBtn.addEventListener('click', handleDeleteCredential);
  
  // Attach event listeners to copy buttons
  document.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', handleCopy);
  });
  
  // Attach event listeners to toggle visibility buttons
  document.querySelectorAll('.toggle-visibility-btn').forEach(btn => {
    btn.addEventListener('click', handleToggleVisibility);
  });
}

// Show the locked view
function showLockedView() {
  lockedView.classList.remove('hidden');
  dashboardView.classList.add('hidden');
  settingsView.classList.add('hidden');
  detailView.classList.add('hidden');
  
  masterPasswordInput.focus();
}

// Show the dashboard view
async function showDashboard() {
  lockedView.classList.add('hidden');
  dashboardView.classList.remove('hidden');
  settingsView.classList.add('hidden');
  detailView.classList.add('hidden');
  
  searchInput.value = '';
  await loadCredentials();
}

// Show the settings view
async function showSettings() {
  lockedView.classList.add('hidden');
  dashboardView.classList.add('hidden');
  settingsView.classList.remove('hidden');
  detailView.classList.add('hidden');
  
  await loadSettings();
}

// Show the detail view for a credential
function showDetailView(credential) {
  lockedView.classList.add('hidden');
  dashboardView.classList.add('hidden');
  settingsView.classList.add('hidden');
  detailView.classList.remove('hidden');
  
  currentCredential = credential;
  
  detailDomain.textContent = credential.domain;
  detailUsername.value = credential.username;
  detailPassword.value = credential.password;
  detailNotes.value = credential.notes || '';
}

// Handle unlock button click
async function handleUnlock() {
  const masterPassword = masterPasswordInput.value;
  
  if (!masterPassword) {
    showError('Please enter a master password');
    return;
  }
  
  // Check if the master password is set
  const isMasterPasswordSet = await checkMasterPasswordSet();
  
  try {
    if (isMasterPasswordSet) {
      // Try to unlock the vault
      const { success, error } = await chrome.runtime.sendMessage({
        action: 'unlockVault',
        data: { masterPassword }
      });
      
      if (success) {
        showDashboard();
      } else {
        showError(error || 'Invalid master password');
      }
    } else {
      // Set up the master password
      const { success, error } = await chrome.runtime.sendMessage({
        action: 'setupMasterPassword',
        data: { masterPassword }
      });
      
      if (success) {
        showDashboard();
      } else {
        showError(error || 'Failed to set master password');
      }
    }
  } catch (error) {
    showError('An error occurred: ' + error.message);
  }
}

// Handle lock button click
function handleLock() {
  chrome.runtime.sendMessage({ action: 'lockVault' });
  showLockedView();
}

// Show an error message in the locked view
function showError(message) {
  loginError.textContent = message;
  setTimeout(() => {
    loginError.textContent = '';
  }, 3000);
}

// Load all credentials
async function loadCredentials() {
  try {
    const { credentials, error } = await chrome.runtime.sendMessage({
      action: 'getAllCredentials'
    });
    
    if (error) {
      console.error('Error loading credentials:', error);
      return;
    }
    
    allCredentials = credentials || [];
    filteredCredentials = [...allCredentials];
    
    renderCredentialsList();
  } catch (error) {
    console.error('Error loading credentials:', error);
  }
}

// Load settings
async function loadSettings() {
  try {
    const { settings, error } = await chrome.runtime.sendMessage({
      action: 'getSettings'
    });
    
    if (error) {
      console.error('Error loading settings:', error);
      return;
    }
    
    autofillToggle.checked = settings.autoFill;
    autosaveToggle.checked = settings.autoSave;
    allowHttpToggle.checked = settings.allowHttp;
  } catch (error) {
    console.error('Error loading settings:', error);
  }
}

// Save settings
async function saveSettings() {
  try {
    const settings = {
      autoFill: autofillToggle.checked,
      autoSave: autosaveToggle.checked,
      allowHttp: allowHttpToggle.checked
    };
    
    await chrome.runtime.sendMessage({
      action: 'saveSettings',
      data: { settings }
    });
  } catch (error) {
    console.error('Error saving settings:', error);
  }
}

// Render the credentials list
function renderCredentialsList() {
  // Clear the list
  credentialsList.innerHTML = '';
  
  // Show or hide the empty state
  if (filteredCredentials.length === 0) {
    emptyState.classList.remove('hidden');
    
    // If we have credentials but none match the search
    if (allCredentials.length > 0 && searchInput.value) {
      emptyState.querySelector('p').textContent = 'No matching credentials found';
      emptyState.querySelector('.hint').textContent = 'Try a different search term';
    } else {
      emptyState.querySelector('p').textContent = 'No credentials saved yet';
      emptyState.querySelector('.hint').textContent = 'Credentials will appear here when you save them from websites';
    }
  } else {
    emptyState.classList.add('hidden');
    
    // Group credentials by domain
    const groupedCredentials = {};
    
    filteredCredentials.forEach(cred => {
      if (!groupedCredentials[cred.domain]) {
        groupedCredentials[cred.domain] = [];
      }
      groupedCredentials[cred.domain].push(cred);
    });
    
    // Sort domains alphabetically
    const sortedDomains = Object.keys(groupedCredentials).sort();
    
    // Create DOM elements for each domain and credential
    sortedDomains.forEach(domain => {
      const domainGroup = document.createElement('div');
      domainGroup.className = 'domain-group';
      
      const domainHeader = document.createElement('div');
      domainHeader.className = 'domain-header';
      domainHeader.textContent = domain;
      domainGroup.appendChild(domainHeader);
      
      groupedCredentials[domain].forEach(cred => {
        const credElement = document.createElement('div');
        credElement.className = 'credential-item';
        credElement.addEventListener('click', () => showDetailView(cred));
        
        const username = document.createElement('div');
        username.className = 'credential-username';
        username.textContent = cred.username;
        
        credElement.appendChild(username);
        domainGroup.appendChild(credElement);
      });
      
      credentialsList.appendChild(domainGroup);
    });
  }
}

// Handle search input
function handleSearch() {
  const searchTerm = searchInput.value.toLowerCase();
  
  if (searchTerm) {
    filteredCredentials = allCredentials.filter(cred => 
      cred.domain.toLowerCase().includes(searchTerm) || 
      cred.username.toLowerCase().includes(searchTerm)
    );
  } else {
    filteredCredentials = [...allCredentials];
  }
  
  renderCredentialsList();
}

// Handle save changes button click
async function handleSaveChanges() {
  try {
    if (!currentCredential) return;
    
    const updatedCredential = {
      ...currentCredential,
      notes: detailNotes.value
    };
    
    const { success, error } = await chrome.runtime.sendMessage({
      action: 'saveCredential',
      data: {
        credential: updatedCredential
      }
    });
    
    if (success) {
      // Update the credential in the local list
      const index = allCredentials.findIndex(c => 
        c.domain === currentCredential.domain && c.username === currentCredential.username
      );
      
      if (index >= 0) {
        allCredentials[index] = updatedCredential;
        filteredCredentials = [...allCredentials];
      }
      
      showDashboard();
    } else {
      console.error('Error saving credential:', error);
    }
  } catch (error) {
    console.error('Error saving credential:', error);
  }
}

// Handle delete credential button click
async function handleDeleteCredential() {
  try {
    if (!currentCredential) return;
    
    if (!confirm(`Are you sure you want to delete the credentials for ${currentCredential.username} on ${currentCredential.domain}?`)) {
      return;
    }
    
    const { success, error } = await chrome.runtime.sendMessage({
      action: 'deleteCredential',
      data: {
        domain: currentCredential.domain,
        username: currentCredential.username
      }
    });
    
    if (success) {
      // Remove the credential from the local list
      allCredentials = allCredentials.filter(c => 
        !(c.domain === currentCredential.domain && c.username === currentCredential.username)
      );
      filteredCredentials = [...allCredentials];
      
      showDashboard();
    } else {
      console.error('Error deleting credential:', error);
    }
  } catch (error) {
    console.error('Error deleting credential:', error);
  }
}

// Handle copy button click
function handleCopy(event) {
  const field = event.target.dataset.field;
  const value = field === 'username' ? detailUsername.value : detailPassword.value;
  
  navigator.clipboard.writeText(value).then(() => {
    const originalText = event.target.textContent;
    event.target.textContent = 'Copied!';
    
    setTimeout(() => {
      event.target.textContent = originalText;
    }, 1000);
  });
}

// Handle toggle visibility button click
function handleToggleVisibility(event) {
  const field = event.target.dataset.field;
  const input = field === 'password' ? detailPassword : detailUsername;
  
  if (input.type === 'password') {
    input.type = 'text';
    event.target.textContent = 'Hide';
  } else {
    input.type = 'password';
    event.target.textContent = 'Show';
  }
}

// Handle export button click
async function handleExport() {
  try {
    const { data, error } = await chrome.runtime.sendMessage({
      action: 'exportCredentials'
    });
    
    if (error) {
      console.error('Error exporting credentials:', error);
      return;
    }
    
    // Create a download link
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'secure-credentials-export.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error exporting credentials:', error);
  }
}

// Handle import button click
function handleImport() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  
  input.onchange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const importData = e.target.result;
        
        const { success, count, error } = await chrome.runtime.sendMessage({
          action: 'importCredentials',
          data: { importData }
        });
        
        if (success) {
          alert(`Successfully imported ${count} credentials.`);
          loadCredentials();
        } else {
          alert(`Error importing credentials: ${error}`);
        }
      } catch (error) {
        alert(`Error reading file: ${error.message}`);
      }
    };
    
    reader.readAsText(file);
  };
  
  input.click();
}

// Show change password dialog
function showChangePasswordDialog() {
  const currentPassword = prompt('Enter your current master password:');
  if (!currentPassword) return;
  
  const newPassword = prompt('Enter your new master password:');
  if (!newPassword) return;
  
  const confirmPassword = prompt('Confirm your new master password:');
  if (newPassword !== confirmPassword) {
    alert('New passwords do not match.');
    return;
  }
  
  changeMasterPassword(currentPassword, newPassword);
}

// Change master password
async function changeMasterPassword(currentPassword, newPassword) {
  try {
    const { success, error } = await chrome.runtime.sendMessage({
      action: 'changeMasterPassword',
      data: {
        currentPassword,
        newPassword
      }
    });
    
    if (success) {
      alert('Master password changed successfully.');
    } else {
      alert(`Failed to change master password: ${error}`);
    }
  } catch (error) {
    alert(`Error changing master password: ${error.message}`);
  }
}

// Initialize the popup when the DOM is loaded
document.addEventListener('DOMContentLoaded', init);
