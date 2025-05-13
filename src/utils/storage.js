
/**
 * Storage utility functions for managing credentials
 */
import * as cryptoUtil from './crypto.js';

// Key names for different storage items
const STORAGE_KEYS = {
  MASTER_PASSWORD_HASH: 'masterPasswordHash',
  SALT: 'masterPasswordSalt',
  ENCRYPTED_CREDENTIALS: 'encryptedCredentials',
  SETTINGS: 'settings'
};

// Default settings
const DEFAULT_SETTINGS = {
  autoFill: true,
  autoSave: true,
  allowHttp: false
};

// Initialize or get settings
export async function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(STORAGE_KEYS.SETTINGS, (result) => {
      resolve(result[STORAGE_KEYS.SETTINGS] || DEFAULT_SETTINGS);
    });
  });
}

// Save settings
export async function saveSettings(settings) {
  return new Promise((resolve) => {
    chrome.storage.sync.set({ [STORAGE_KEYS.SETTINGS]: settings }, () => {
      resolve();
    });
  });
}

// Check if master password exists
export async function hasMasterPassword() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(STORAGE_KEYS.MASTER_PASSWORD_HASH, (result) => {
      resolve(!!result[STORAGE_KEYS.MASTER_PASSWORD_HASH]);
    });
  });
}

// Set up the master password for the first time
export async function setupMasterPassword(password) {
  // Generate a hash of the password to verify it later
  const hash = await cryptoUtil.hashPassword(password);
  
  // Derive a key from the password and save the salt
  const { salt } = await cryptoUtil.deriveKeyFromPassword(password);
  
  // Save the password hash and salt
  return new Promise((resolve) => {
    chrome.storage.sync.set({
      [STORAGE_KEYS.MASTER_PASSWORD_HASH]: hash,
      [STORAGE_KEYS.SALT]: salt,
      [STORAGE_KEYS.ENCRYPTED_CREDENTIALS]: {
        iv: '',
        encryptedData: ''
      }
    }, () => {
      resolve();
    });
  });
}

// Verify the master password
export async function verifyMasterPassword(password) {
  // Get the stored hash
  return new Promise((resolve) => {
    chrome.storage.sync.get(STORAGE_KEYS.MASTER_PASSWORD_HASH, async (result) => {
      const storedHash = result[STORAGE_KEYS.MASTER_PASSWORD_HASH];
      const inputHash = await cryptoUtil.hashPassword(password);
      resolve(storedHash === inputHash);
    });
  });
}

// Change the master password
export async function changeMasterPassword(oldPassword, newPassword) {
  // Verify the old password first
  const isValid = await verifyMasterPassword(oldPassword);
  if (!isValid) {
    throw new Error('Incorrect password');
  }
  
  // Get the stored credentials
  const credentials = await getAllCredentials(oldPassword);
  
  // Generate a new hash and key
  const newHash = await cryptoUtil.hashPassword(newPassword);
  const { salt } = await cryptoUtil.deriveKeyFromPassword(newPassword);
  
  // Re-encrypt all credentials with the new key
  await saveAllCredentials(credentials, newPassword);
  
  // Save the new password hash and salt
  return new Promise((resolve) => {
    chrome.storage.sync.set({
      [STORAGE_KEYS.MASTER_PASSWORD_HASH]: newHash,
      [STORAGE_KEYS.SALT]: salt
    }, () => {
      resolve();
    });
  });
}

// Get all stored credentials
export async function getAllCredentials(masterPassword) {
  // Get the salt and encrypted credentials
  return new Promise((resolve, reject) => {
    chrome.storage.sync.get([STORAGE_KEYS.SALT, STORAGE_KEYS.ENCRYPTED_CREDENTIALS], async (result) => {
      const salt = result[STORAGE_KEYS.SALT];
      const encryptedData = result[STORAGE_KEYS.ENCRYPTED_CREDENTIALS];
      
      // If there are no credentials yet, return an empty array
      if (!encryptedData || !encryptedData.encryptedData) {
        resolve([]);
        return;
      }
      
      try {
        // Derive the key from the master password
        const { key } = await cryptoUtil.deriveKeyFromPassword(masterPassword, salt);
        
        // Decrypt the credentials
        const credentials = await cryptoUtil.decrypt(
          encryptedData.encryptedData,
          encryptedData.iv,
          key
        );
        
        resolve(credentials);
      } catch (error) {
        reject(new Error('Could not decrypt credentials. The password might be incorrect.'));
      }
    });
  });
}

// Save all credentials
export async function saveAllCredentials(credentials, masterPassword) {
  // Get the salt
  return new Promise((resolve, reject) => {
    chrome.storage.sync.get(STORAGE_KEYS.SALT, async (result) => {
      const salt = result[STORAGE_KEYS.SALT];
      
      try {
        // Derive the key from the master password
        const { key } = await cryptoUtil.deriveKeyFromPassword(masterPassword, salt);
        
        // Encrypt the credentials
        const encryptedData = await cryptoUtil.encrypt(credentials, key);
        
        // Save the encrypted credentials
        chrome.storage.sync.set({
          [STORAGE_KEYS.ENCRYPTED_CREDENTIALS]: encryptedData
        }, () => {
          resolve();
        });
      } catch (error) {
        reject(new Error('Could not encrypt credentials'));
      }
    });
  });
}

// Add or update a credential
export async function saveCredential(credential, masterPassword) {
  // Get all credentials
  const credentials = await getAllCredentials(masterPassword);
  
  // Check if this credential already exists
  const index = credentials.findIndex(c => c.domain === credential.domain && c.username === credential.username);
  
  if (index >= 0) {
    // Update existing credential
    credentials[index] = credential;
  } else {
    // Add new credential
    credentials.push(credential);
  }
  
  // Save all credentials
  return saveAllCredentials(credentials, masterPassword);
}

// Delete a credential
export async function deleteCredential(domain, username, masterPassword) {
  // Get all credentials
  const credentials = await getAllCredentials(masterPassword);
  
  // Filter out the credential to delete
  const newCredentials = credentials.filter(c => !(c.domain === domain && c.username === username));
  
  // Save the updated credentials
  return saveAllCredentials(newCredentials, masterPassword);
}

// Export credentials as an encrypted file
export async function exportCredentials(masterPassword) {
  const credentials = await getAllCredentials(masterPassword);
  return JSON.stringify(credentials);
}

// Import credentials from a file
export async function importCredentials(data, masterPassword) {
  try {
    const importedCredentials = JSON.parse(data);
    
    // Validate the imported data
    if (!Array.isArray(importedCredentials)) {
      throw new Error('Invalid import format');
    }
    
    // Get existing credentials
    const existingCredentials = await getAllCredentials(masterPassword);
    
    // Merge the credentials (overwrite existing ones)
    const mergedCredentials = [...existingCredentials];
    
    importedCredentials.forEach(imported => {
      const index = mergedCredentials.findIndex(
        c => c.domain === imported.domain && c.username === imported.username
      );
      
      if (index >= 0) {
        mergedCredentials[index] = imported;
      } else {
        mergedCredentials.push(imported);
      }
    });
    
    // Save the merged credentials
    await saveAllCredentials(mergedCredentials, masterPassword);
    
    return mergedCredentials.length;
  } catch (error) {
    throw new Error('Failed to import credentials: ' + error.message);
  }
}
