
/**
 * Background service worker for managing credentials and communication
 */
import * as storageUtil from './utils/storage.js';

// Active session state
let session = {
  unlocked: false,
  masterPassword: null,
  lastUnlockTime: null
};

// Listen for messages from content scripts and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { action, data } = message;
  
  switch (action) {
    case 'formDetected':
      handleFormDetected(data, sender.tab.id);
      sendResponse({ success: true });
      break;
    
    case 'saveCredentials':
      handleSaveCredentials(data);
      sendResponse({ success: true });
      break;
    
    case 'isUnlocked':
      checkAndRenewSession();
      sendResponse({ unlocked: session.unlocked });
      break;
    
    case 'unlockVault':
      unlockVault(data.masterPassword)
        .then(success => sendResponse({ success }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true; // Return true to indicate we'll respond asynchronously
    
    case 'lockVault':
      lockVault();
      sendResponse({ success: true });
      break;
    
    case 'setupMasterPassword':
      setupMasterPassword(data.masterPassword)
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
    
    case 'getCredentialsForDomain':
      getCredentialsForDomain(data.domain)
        .then(credentials => sendResponse({ credentials }))
        .catch(error => sendResponse({ error: error.message }));
      return true;
    
    case 'getAllCredentials':
      getAllCredentials()
        .then(credentials => sendResponse({ credentials }))
        .catch(error => sendResponse({ error: error.message }));
      return true;
    
    case 'saveCredential':
      saveCredential(data.credential)
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
    
    case 'deleteCredential':
      deleteCredential(data.domain, data.username)
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
    
    case 'changeMasterPassword':
      changeMasterPassword(data.currentPassword, data.newPassword)
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
    
    case 'getSettings':
      getSettings()
        .then(settings => sendResponse({ settings }))
        .catch(error => sendResponse({ error: error.message }));
      return true;
    
    case 'saveSettings':
      saveSettings(data.settings)
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
    
    case 'exportCredentials':
      exportCredentials()
        .then(data => sendResponse({ data }))
        .catch(error => sendResponse({ error: error.message }));
      return true;
    
    case 'importCredentials':
      importCredentials(data.importData)
        .then(count => sendResponse({ success: true, count }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
  }
  
  return true;
});

// Handle when a form is detected on a page
async function handleFormDetected(data, tabId) {
  // If the vault is locked, we can't do anything
  if (!session.unlocked) return;
  
  // Get settings
  const settings = await storageUtil.getSettings();
  
  // Check if auto-fill is enabled
  if (!settings.autoFill) return;
  
  // Check if we should skip non-HTTPS sites
  if (!data.url.startsWith('https://') && !settings.allowHttp) return;
  
  // Get credentials for this domain
  const credentials = await getCredentialsForDomain(data.domain);
  
  // If we found credentials, send them to the content script to auto-fill
  if (credentials.length > 0) {
    chrome.tabs.sendMessage(tabId, {
      action: 'fillCredentials',
      credentials: credentials[0]
    });
  }
}

// Handle saving credentials from a form submission
async function handleSaveCredentials(data) {
  // If the vault is locked, we can't do anything
  if (!session.unlocked) return;
  
  // Get settings
  const settings = await storageUtil.getSettings();
  
  // Check if auto-save is enabled
  if (!settings.autoSave) return;
  
  // Check if we should skip non-HTTPS sites
  if (!data.url.startsWith('https://') && !settings.allowHttp) return;
  
  // Get existing credentials for this domain
  const existingCredentials = await getCredentialsForDomain(data.domain);
  
  // Check if these credentials already exist
  const exists = existingCredentials.some(cred => 
    cred.username === data.username && cred.password === data.password
  );
  
  // If they don't exist, save them
  if (!exists) {
    const credential = {
      domain: data.domain,
      url: data.url,
      username: data.username,
      password: data.password,
      notes: '',
      dateAdded: new Date().toISOString()
    };
    
    await saveCredential(credential);
  }
}

// Check if the session is still valid and renew it if necessary
function checkAndRenewSession() {
  // If the session is not unlocked, there's nothing to renew
  if (!session.unlocked) return false;
  
  // Check if the session has expired (30 minutes of inactivity)
  const currentTime = new Date().getTime();
  const sessionTimeout = 30 * 60 * 1000; // 30 minutes
  
  if (currentTime - session.lastUnlockTime > sessionTimeout) {
    // Session has expired, lock the vault
    lockVault();
    return false;
  }
  
  // Renew the session
  session.lastUnlockTime = currentTime;
  return true;
}

// Unlock the vault with the master password
async function unlockVault(masterPassword) {
  try {
    // Verify the master password
    const isValid = await storageUtil.verifyMasterPassword(masterPassword);
    
    if (!isValid) {
      throw new Error('Incorrect password');
    }
    
    // Set up the session
    session.unlocked = true;
    session.masterPassword = masterPassword;
    session.lastUnlockTime = new Date().getTime();
    
    return true;
  } catch (error) {
    console.error('Error unlocking vault:', error);
    throw error;
  }
}

// Lock the vault (clear the session)
function lockVault() {
  session.unlocked = false;
  session.masterPassword = null;
  session.lastUnlockTime = null;
}

// Set up the master password for the first time
async function setupMasterPassword(masterPassword) {
  try {
    await storageUtil.setupMasterPassword(masterPassword);
    
    // Also unlock the vault
    session.unlocked = true;
    session.masterPassword = masterPassword;
    session.lastUnlockTime = new Date().getTime();
    
    return true;
  } catch (error) {
    console.error('Error setting up master password:', error);
    throw error;
  }
}

// Get credentials for a specific domain
async function getCredentialsForDomain(domain) {
  try {
    if (!session.unlocked) {
      throw new Error('Vault is locked');
    }
    
    const allCredentials = await storageUtil.getAllCredentials(session.masterPassword);
    
    // Filter credentials for this domain
    return allCredentials.filter(cred => {
      // Match the exact domain or subdomains
      return cred.domain === domain || 
             domain.endsWith('.' + cred.domain) ||
             cred.domain.endsWith('.' + domain);
    });
  } catch (error) {
    console.error('Error getting credentials for domain:', error);
    throw error;
  }
}

// Get all credentials
async function getAllCredentials() {
  try {
    if (!session.unlocked) {
      throw new Error('Vault is locked');
    }
    
    return await storageUtil.getAllCredentials(session.masterPassword);
  } catch (error) {
    console.error('Error getting all credentials:', error);
    throw error;
  }
}

// Save a credential
async function saveCredential(credential) {
  try {
    if (!session.unlocked) {
      throw new Error('Vault is locked');
    }
    
    await storageUtil.saveCredential(credential, session.masterPassword);
    return true;
  } catch (error) {
    console.error('Error saving credential:', error);
    throw error;
  }
}

// Delete a credential
async function deleteCredential(domain, username) {
  try {
    if (!session.unlocked) {
      throw new Error('Vault is locked');
    }
    
    await storageUtil.deleteCredential(domain, username, session.masterPassword);
    return true;
  } catch (error) {
    console.error('Error deleting credential:', error);
    throw error;
  }
}

// Change the master password
async function changeMasterPassword(currentPassword, newPassword) {
  try {
    await storageUtil.changeMasterPassword(currentPassword, newPassword);
    
    // Update the session
    session.masterPassword = newPassword;
    session.lastUnlockTime = new Date().getTime();
    
    return true;
  } catch (error) {
    console.error('Error changing master password:', error);
    throw error;
  }
}

// Get settings
async function getSettings() {
  try {
    return await storageUtil.getSettings();
  } catch (error) {
    console.error('Error getting settings:', error);
    throw error;
  }
}

// Save settings
async function saveSettings(settings) {
  try {
    await storageUtil.saveSettings(settings);
    return true;
  } catch (error) {
    console.error('Error saving settings:', error);
    throw error;
  }
}

// Export credentials
async function exportCredentials() {
  try {
    if (!session.unlocked) {
      throw new Error('Vault is locked');
    }
    
    return await storageUtil.exportCredentials(session.masterPassword);
  } catch (error) {
    console.error('Error exporting credentials:', error);
    throw error;
  }
}

// Import credentials
async function importCredentials(importData) {
  try {
    if (!session.unlocked) {
      throw new Error('Vault is locked');
    }
    
    return await storageUtil.importCredentials(importData, session.masterPassword);
  } catch (error) {
    console.error('Error importing credentials:', error);
    throw error;
  }
}

// Set up event listeners for browser events
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  if (session.unlocked) {
    chrome.tabs.sendMessage(activeInfo.tabId, { action: 'detectForms' }, (response) => {
      // Handle possible errors when the content script isn't loaded yet
      if (chrome.runtime.lastError) {
        console.log('Content script not ready yet');
      }
    });
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && session.unlocked) {
    chrome.tabs.sendMessage(tabId, { action: 'detectForms' }, (response) => {
      // Handle possible errors when the content script isn't loaded yet
      if (chrome.runtime.lastError) {
        console.log('Content script not ready yet');
      }
    });
  }
});
