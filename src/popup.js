
/**
 * Popup script for managing the extension's user interface
 */

// DOM elements
const lockedView = document.getElementById('locked-view');
const dashboardView = document.getElementById('dashboard-view');
const settingsView = document.getElementById('settings-view');
const detailView = document.getElementById('detail-view');

const masterPasswordInput = document.getElementById('master-password');
const unlockBtn = document.getElementById('unlock-btn');
const loginError = document.getElementById('login-error');
const setupMessage = document.getElementById('setup-message');

const lockBtn = document.getElementById('lock-btn');
const searchInput = document.getElementById('search-input');
const credentialsList = document.getElementById('credentials-list');
const emptyState = document.getElementById('empty-state');

const settingsBtn = document.getElementById('settings-btn');
const exportBtn = document.getElementById('export-btn');
const importBtn = document.getElementById('import-btn');
const backBtn = document.getElementById('back-btn');

const autofillToggle = document.getElementById('autofill-toggle');
const autosaveToggle = document.getElementById('autosave-toggle');
const allowHttpToggle = document.getElementById('allow-http-toggle');
const changePasswordBtn = document.getElementById('change-password-btn');

const backToListBtn = document.getElementById('back-to-list-btn');
const deleteCredentialBtn = document.getElementById('delete-credential-btn');
const detailDomain = document.getElementById('detail-domain');
const detailUsername = document.getElementById('detail-username');
const detailPassword = document.getElementById('detail-password');
const detailNotes = document.getElementById('detail-notes');
const saveChangesBtn = document.getElementById('save-changes-btn');

// State
let currentCredentials = [];
let selectedCredential = null;
let currentSettings = null;

// Initialize the popup
async function init() {
  // Check if the vault is unlocked
  chrome.runtime.sendMessage({ action: 'isUnlocked' }, async (response) => {
    if (response.unlocked) {
      // Load credentials and settings
      await loadCredentials();
      await loadSettings();
      showView(dashboardView);
    } else {
      // Check if a master password has been set up
      const hasMasterPassword = await checkHasMasterPassword();
      setupMessage.style.display = hasMasterPassword ? 'none' : 'block';
      showView(lockedView);
    }
  });
  
  // Set up event listeners
  setupEventListeners();
}

// Set up all event listeners
function setupEventListeners() {
  // Unlock/setup button
  unlockBtn.addEventListener('click', handleUnlockOrSetup);
  masterPasswordInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      handleUnlockOrSetup();
    }
  });
  
  // Lock button
  lockBtn.addEventListener('click', lockVault);
  
  // Search input
  searchInput.addEventListener('input', filterCredentials);
  
  // Settings buttons
  settingsBtn.addEventListener('click', () => showView(settingsView));
  backBtn.addEventListener('click', () => showView(dashboardView));
  
  // Settings toggles
  autofillToggle.addEventListener('change', saveSettings);
  autosaveToggle.addEventListener('change', saveSettings);
  allowHttpToggle.addEventListener('change', saveSettings);
  
  // Change password button
  changePasswordBtn.addEventListener('click', showChangePasswordDialog);
  
  // Detail view
  backToListBtn.addEventListener('click', () => showView(dashboardView));
  deleteCredentialBtn.addEventListener('click', deleteSelectedCredential);
  saveChangesBtn.addEventListener('click', saveCredentialChanges);
  
  // Toggle password visibility buttons
  document.querySelectorAll('.toggle-visibility-btn').forEach(btn => {
    btn.addEventListener('click', togglePasswordVisibility);
  });
  
  // Copy buttons
  document.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', copyToClipboard);
  });
  
  // Export/Import buttons
  exportBtn.addEventListener('click', exportCredentials);
  importBtn.addEventListener('click', importCredentials);
}

// Show a specific view
function showView(view) {
  // Hide all views
  lockedView.classList.add('hidden');
  dashboardView.classList.add('hidden');
  settingsView.classList.add('hidden');
  detailView.classList.add('hidden');
  
  // Show the specified view
  view.classList.remove('hidden');
  
  // If showing the dashboard, focus the search input
  if (view === dashboardView) {
    searchInput.focus();
  }
}

// Handle unlock or setup action
async function handleUnlockOrSetup() {
  const password = masterPasswordInput.value;
  
  if (!password) {
    showError('Please enter a master password');
    return;
  }
  
  const hasMasterPassword = await checkHasMasterPassword();
  
  try {
    if (hasMasterPassword) {
      // Unlock the vault
      const response = await unlockVault(password);
      
      if (response.success) {
        await loadCredentials();
        await loadSettings();
        showView(dashboardView);
        masterPasswordInput.value = '';
      } else {
        showError('Incorrect master password');
      }
    } else {
      // Set up a new master password
      if (password.length < 8) {
        showError('Password must be at least 8 characters');
        return;
      }
      
      const response = await setupMasterPassword(password);
      
      if (response.success) {
        await loadCredentials();
        await loadSettings();
        showView(dashboardView);
        masterPasswordInput.value = '';
      } else {
        showError('Failed to set up master password');
      }
    }
  } catch (error) {
    showError(error.message);
  }
}

// Show an error message
function showError(message) {
  loginError.textContent = message;
  setTimeout(() => {
    loginError.textContent = '';
  }, 3000);
}

// Check if a master password has been set up
async function checkHasMasterPassword() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: 'hasMasterPassword' }, (response) => {
      resolve(response.exists);
    });
  });
}

// Unlock the vault
async function unlockVault(masterPassword) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ 
      action: 'unlockVault', 
      data: { masterPassword } 
    }, (response) => {
      resolve(response);
    });
  });
}

// Set up a new master password
async function setupMasterPassword(masterPassword) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ 
      action: 'setupMasterPassword', 
      data: { masterPassword } 
    }, (response) => {
      resolve(response);
    });
  });
}

// Lock the vault
function lockVault() {
  chrome.runtime.sendMessage({ action: 'lockVault' }, () => {
    masterPasswordInput.value = '';
    showView(lockedView);
  });
}

// Load all credentials
async function loadCredentials() {
  chrome.runtime.sendMessage({ action: 'getAllCredentials' }, (response) => {
    if (response.error) {
      console.error('Error loading credentials:', response.error);
      return;
    }
    
    currentCredentials = response.credentials || [];
    renderCredentialsList();
  });
}

// Render the credentials list
function renderCredentialsList(searchTerm = '') {
  // Clear the current list
  while (credentialsList.firstChild && credentialsList.firstChild !== emptyState) {
    credentialsList.removeChild(credentialsList.firstChild);
  }
  
  // Filter credentials by search term
  const filteredCredentials = searchTerm 
    ? currentCredentials.filter(cred => 
        cred.domain.includes(searchTerm) || 
        cred.username.includes(searchTerm))
    : currentCredentials;
  
  // Sort credentials alphabetically by domain
  filteredCredentials.sort((a, b) => a.domain.localeCompare(b.domain));
  
  // Show or hide the empty state
  emptyState.style.display = filteredCredentials.length === 0 ? 'block' : 'none';
  
  // Create an element for each credential
  filteredCredentials.forEach(credential => {
    const credentialItem = document.createElement('div');
    credentialItem.className = 'credential-item';
    credentialItem.dataset.domain = credential.domain;
    credentialItem.dataset.username = credential.username;
    
    const domainElement = document.createElement('div');
    domainElement.className = 'credential-domain';
    domainElement.textContent = credential.domain;
    
    const usernameElement = document.createElement('div');
    usernameElement.className = 'credential-username';
    usernameElement.textContent = credential.username;
    
    credentialItem.appendChild(domainElement);
    credentialItem.appendChild(usernameElement);
    
    // Add click event to show credential details
    credentialItem.addEventListener('click', () => {
      showCredentialDetails(credential);
    });
    
    credentialsList.appendChild(credentialItem);
  });
}

// Filter credentials based on search input
function filterCredentials() {
  const searchTerm = searchInput.value.toLowerCase();
  renderCredentialsList(searchTerm);
}

// Show credential details
function showCredentialDetails(credential) {
  selectedCredential = credential;
  
  detailDomain.textContent = credential.domain;
  detailUsername.value = credential.username;
  detailPassword.value = credential.password;
  detailNotes.value = credential.notes || '';
  
  showView(detailView);
}

// Save changes to a credential
function saveCredentialChanges() {
  if (!selectedCredential) return;
  
  const updatedCredential = {
    ...selectedCredential,
    notes: detailNotes.value
  };
  
  chrome.runtime.sendMessage({
    action: 'saveCredential',
    data: { credential: updatedCredential }
  }, (response) => {
    if (response.success) {
      // Update the credential in the list
      const index = currentCredentials.findIndex(c => 
        c.domain === selectedCredential.domain && c.username === selectedCredential.username
      );
      
      if (index >= 0) {
        currentCredentials[index] = updatedCredential;
      }
      
      // Go back to the dashboard
      showView(dashboardView);
    } else {
      alert('Failed to save changes: ' + (response.error || 'Unknown error'));
    }
  });
}

// Delete the selected credential
function deleteSelectedCredential() {
  if (!selectedCredential) return;
  
  if (!confirm(`Are you sure you want to delete the credential for ${selectedCredential.username} on ${selectedCredential.domain}?`)) {
    return;
  }
  
  chrome.runtime.sendMessage({
    action: 'deleteCredential',
    data: {
      domain: selectedCredential.domain,
      username: selectedCredential.username
    }
  }, (response) => {
    if (response.success) {
      // Remove the credential from the list
      currentCredentials = currentCredentials.filter(c => 
        !(c.domain === selectedCredential.domain && c.username === selectedCredential.username)
      );
      
      // Go back to the dashboard and update the list
      showView(dashboardView);
      renderCredentialsList(searchInput.value.toLowerCase());
    } else {
      alert('Failed to delete credential: ' + (response.error || 'Unknown error'));
    }
  });
}

// Toggle password visibility
function togglePasswordVisibility(event) {
  const btn = event.target;
  const field = btn.dataset.field;
  const input = document.getElementById(`detail-${field}`);
  
  if (input.type === 'password') {
    input.type = 'text';
    btn.textContent = 'Hide';
  } else {
    input.type = 'password';
    btn.textContent = 'Show';
  }
}

// Copy a field to the clipboard
function copyToClipboard(event) {
  const btn = event.target;
  const field = btn.dataset.field;
  const input = document.getElementById(`detail-${field}`);
  
  navigator.clipboard.writeText(input.value).then(() => {
    // Show a brief "Copied!" message
    const originalText = btn.textContent;
    btn.textContent = 'Copied!';
    setTimeout(() => {
      btn.textContent = originalText;
    }, 1000);
  });
}

// Load settings
async function loadSettings() {
  chrome.runtime.sendMessage({ action: 'getSettings' }, (response) => {
    if (response.error) {
      console.error('Error loading settings:', response.error);
      return;
    }
    
    currentSettings = response.settings;
    
    // Update toggle states
    autofillToggle.checked = currentSettings.autoFill;
    autosaveToggle.checked = currentSettings.autoSave;
    allowHttpToggle.checked = currentSettings.allowHttp;
  });
}

// Save settings
function saveSettings() {
  const settings = {
    autoFill: autofillToggle.checked,
    autoSave: autosaveToggle.checked,
    allowHttp: allowHttpToggle.checked
  };
  
  chrome.runtime.sendMessage({
    action: 'saveSettings',
    data: { settings }
  }, (response) => {
    if (response.success) {
      currentSettings = settings;
    } else {
      // Revert toggle states
      autofillToggle.checked = currentSettings.autoFill;
      autosaveToggle.checked = currentSettings.autoSave;
      allowHttpToggle.checked = currentSettings.allowHttp;
      
      alert('Failed to save settings: ' + (response.error || 'Unknown error'));
    }
  });
}

// Show change password dialog
function showChangePasswordDialog() {
  const currentPassword = prompt('Enter your current master password:');
  if (!currentPassword) return;
  
  const newPassword = prompt('Enter your new master password (min 8 characters):');
  if (!newPassword) return;
  
  if (newPassword.length < 8) {
    alert('New password must be at least 8 characters');
    return;
  }
  
  const confirmPassword = prompt('Confirm your new master password:');
  if (newPassword !== confirmPassword) {
    alert('Passwords do not match');
    return;
  }
  
  chrome.runtime.sendMessage({
    action: 'changeMasterPassword',
    data: {
      currentPassword,
      newPassword
    }
  }, (response) => {
    if (response.success) {
      alert('Master password changed successfully');
    } else {
      alert('Failed to change master password: ' + (response.error || 'Unknown error'));
    }
  });
}

// Export credentials
function exportCredentials() {
  chrome.runtime.sendMessage({ action: 'exportCredentials' }, (response) => {
    if (response.error) {
      alert('Failed to export credentials: ' + response.error);
      return;
    }
    
    // Create a download for the exported data
    const blob = new Blob([response.data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'secure-credentials-export.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
}

// Import credentials
function importCredentials() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  
  input.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const importData = e.target.result;
      
      chrome.runtime.sendMessage({
        action: 'importCredentials',
        data: { importData }
      }, (response) => {
        if (response.success) {
          alert(`Successfully imported ${response.count} credentials`);
          loadCredentials();
        } else {
          alert('Failed to import credentials: ' + (response.error || 'Unknown error'));
        }
      });
    };
    
    reader.readAsText(file);
  });
  
  input.click();
}

// Initialize the popup when DOM is ready
document.addEventListener('DOMContentLoaded', init);
