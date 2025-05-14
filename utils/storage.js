
/**
 * Storage utility functions for securely storing and retrieving data
 */
import * as crypto from './crypto.js';

// Default settings
const DEFAULT_SETTINGS = {
  autoFill: true,
  autoSave: true,
  allowHttp: false,
  sessionTimeout: 30 // minutes
};

// Check if the master password is set up
export async function isMasterPasswordSet() {
  const result = await chrome.storage.local.get('hashedMasterKey');
  return !!result.hashedMasterKey;
}

// Set up the master password for the first time
export async function setupMasterPassword(masterPassword) {
  // Check if master password is already set
  const isSet = await isMasterPasswordSet();
  if (isSet) {
    throw new Error('Master password is already set');
  }
  
  // Generate a salt for the master key derivation
  const masterKeySalt = crypto.generateRandomBytes(16);
  
  // Derive a key from the master password
  const masterKey = await crypto.deriveKey(masterPassword, masterKeySalt);
  
  // Hash the master key for verification
  const hashedMasterKey = await crypto.hashData(masterKey);
  
  // Generate an encryption key for the vault
  const encryptionKey = crypto.generateRandomBytes(32);
  
  // Encrypt the encryption key with the master key
  const encryptedEncryptionKey = await crypto.encryptData(encryptionKey, masterKey);
  
  // Store everything
  await chrome.storage.local.set({
    hashedMasterKey,
    masterKeySalt: Array.from(masterKeySalt),
    encryptedEncryptionKey: {
      ciphertext: Array.from(encryptedEncryptionKey.ciphertext),
      iv: Array.from(encryptedEncryptionKey.iv)
    },
    // Initialize empty credentials list
    encryptedCredentials: null,
    // Initialize with default settings
    settings: DEFAULT_SETTINGS
  });
  
  return true;
}

// Verify the master password
export async function verifyMasterPassword(masterPassword) {
  try {
    // Retrieve the stored master key salt and hashed master key
    const { masterKeySalt, hashedMasterKey } = await chrome.storage.local.get(['masterKeySalt', 'hashedMasterKey']);
    
    if (!masterKeySalt || !hashedMasterKey) {
      throw new Error('Master password not set up');
    }
    
    // Derive the master key from the provided password
    const derivedMasterKey = await crypto.deriveKey(masterPassword, new Uint8Array(masterKeySalt));
    
    // Hash the derived master key
    const hashedDerivedKey = await crypto.hashData(derivedMasterKey);
    
    // Compare the hashed keys
    return hashedDerivedKey === hashedMasterKey;
  } catch (error) {
    console.error('Error verifying master password:', error);
    return false;
  }
}

// Get the encryption key
async function getEncryptionKey(masterPassword) {
  // Retrieve the stored master key salt and encrypted encryption key
  const { masterKeySalt, encryptedEncryptionKey } = await chrome.storage.local.get([
    'masterKeySalt',
    'encryptedEncryptionKey'
  ]);
  
  if (!masterKeySalt || !encryptedEncryptionKey) {
    throw new Error('Master password not set up');
  }
  
  // Derive the master key from the provided password
  const masterKey = await crypto.deriveKey(masterPassword, new Uint8Array(masterKeySalt));
  
  // Decrypt the encryption key
  const encryptionKey = await crypto.decryptData(
    {
      ciphertext: new Uint8Array(encryptedEncryptionKey.ciphertext),
      iv: new Uint8Array(encryptedEncryptionKey.iv)
    },
    masterKey
  );
  
  return encryptionKey;
}

// Get all stored credentials
export async function getAllCredentials(masterPassword) {
  // Verify the master password is correct
  const isValid = await verifyMasterPassword(masterPassword);
  if (!isValid) {
    throw new Error('Invalid master password');
  }
  
  // Get the encryption key
  const encryptionKey = await getEncryptionKey(masterPassword);
  
  // Retrieve the encrypted credentials from storage
  const { encryptedCredentials } = await chrome.storage.local.get('encryptedCredentials');
  
  // If there are no credentials yet, return an empty array
  if (!encryptedCredentials) {
    return [];
  }
  
  // Decrypt the credentials
  const decrypted = await crypto.decryptData(
    {
      ciphertext: new Uint8Array(encryptedCredentials.ciphertext),
      iv: new Uint8Array(encryptedCredentials.iv)
    },
    encryptionKey
  );
  
  // Parse the decrypted JSON
  return JSON.parse(new TextDecoder().decode(decrypted));
}

// Save or update a credential
export async function saveCredential(credential, masterPassword) {
  // Verify the master password is correct
  const isValid = await verifyMasterPassword(masterPassword);
  if (!isValid) {
    throw new Error('Invalid master password');
  }
  
  // Get the encryption key
  const encryptionKey = await getEncryptionKey(masterPassword);
  
  // Get all existing credentials
  const credentials = await getAllCredentials(masterPassword);
  
  // Check if this credential already exists
  const existingIndex = credentials.findIndex(c => 
    c.domain === credential.domain && c.username === credential.username
  );
  
  // Update or add the credential
  if (existingIndex >= 0) {
    credentials[existingIndex] = credential;
  } else {
    credentials.push(credential);
  }
  
  // Encrypt the updated credentials list
  const credentialsJson = JSON.stringify(credentials);
  const encryptedCredentials = await crypto.encryptData(
    new TextEncoder().encode(credentialsJson),
    encryptionKey
  );
  
  // Store the encrypted credentials
  await chrome.storage.local.set({
    encryptedCredentials: {
      ciphertext: Array.from(encryptedCredentials.ciphertext),
      iv: Array.from(encryptedCredentials.iv)
    }
  });
  
  return true;
}

// Delete a credential
export async function deleteCredential(domain, username, masterPassword) {
  // Verify the master password is correct
  const isValid = await verifyMasterPassword(masterPassword);
  if (!isValid) {
    throw new Error('Invalid master password');
  }
  
  // Get the encryption key
  const encryptionKey = await getEncryptionKey(masterPassword);
  
  // Get all existing credentials
  const credentials = await getAllCredentials(masterPassword);
  
  // Filter out the credential to delete
  const updatedCredentials = credentials.filter(c => 
    !(c.domain === domain && c.username === username)
  );
  
  // If no credentials were removed, throw an error
  if (updatedCredentials.length === credentials.length) {
    throw new Error('Credential not found');
  }
  
  // Encrypt the updated credentials list
  const credentialsJson = JSON.stringify(updatedCredentials);
  const encryptedCredentials = await crypto.encryptData(
    new TextEncoder().encode(credentialsJson),
    encryptionKey
  );
  
  // Store the encrypted credentials
  await chrome.storage.local.set({
    encryptedCredentials: {
      ciphertext: Array.from(encryptedCredentials.ciphertext),
      iv: Array.from(encryptedCredentials.iv)
    }
  });
  
  return true;
}

// Change the master password
export async function changeMasterPassword(currentPassword, newPassword) {
  // Verify the current password is correct
  const isValid = await verifyMasterPassword(currentPassword);
  if (!isValid) {
    throw new Error('Invalid current password');
  }
  
  // Get all credentials using the current password
  const credentials = await getAllCredentials(currentPassword);
  
  // Generate a new salt for the master key derivation
  const newMasterKeySalt = crypto.generateRandomBytes(16);
  
  // Derive a key from the new master password
  const newMasterKey = await crypto.deriveKey(newPassword, newMasterKeySalt);
  
  // Hash the new master key for verification
  const newHashedMasterKey = await crypto.hashData(newMasterKey);
  
  // Generate a new encryption key
  const newEncryptionKey = crypto.generateRandomBytes(32);
  
  // Encrypt the new encryption key with the new master key
  const newEncryptedEncryptionKey = await crypto.encryptData(newEncryptionKey, newMasterKey);
  
  // Encrypt the credentials with the new encryption key
  const credentialsJson = JSON.stringify(credentials);
  const newEncryptedCredentials = await crypto.encryptData(
    new TextEncoder().encode(credentialsJson),
    newEncryptionKey
  );
  
  // Store everything
  await chrome.storage.local.set({
    hashedMasterKey: newHashedMasterKey,
    masterKeySalt: Array.from(newMasterKeySalt),
    encryptedEncryptionKey: {
      ciphertext: Array.from(newEncryptedEncryptionKey.ciphertext),
      iv: Array.from(newEncryptedEncryptionKey.iv)
    },
    encryptedCredentials: {
      ciphertext: Array.from(newEncryptedCredentials.ciphertext),
      iv: Array.from(newEncryptedCredentials.iv)
    }
  });
  
  return true;
}

// Get settings
export async function getSettings() {
  const { settings } = await chrome.storage.local.get('settings');
  return settings || DEFAULT_SETTINGS;
}

// Save settings
export async function saveSettings(newSettings) {
  // Merge with default settings to ensure all fields are present
  const settings = {
    ...DEFAULT_SETTINGS,
    ...newSettings
  };
  
  await chrome.storage.local.set({ settings });
  return true;
}

// Export credentials as encrypted JSON
export async function exportCredentials(masterPassword) {
  // Get all credentials
  const credentials = await getAllCredentials(masterPassword);
  
  // Create export object
  const exportData = {
    type: 'secure-credentials-export',
    version: 1,
    date: new Date().toISOString(),
    data: credentials
  };
  
  return JSON.stringify(exportData, null, 2);
}

// Import credentials from JSON
export async function importCredentials(importData, masterPassword) {
  try {
    // Parse the import data
    const parsed = JSON.parse(importData);
    
    // Validate the import format
    if (parsed.type !== 'secure-credentials-export') {
      throw new Error('Invalid import format');
    }
    
    // Get existing credentials
    const existingCredentials = await getAllCredentials(masterPassword);
    
    // Track new credentials
    let newCount = 0;
    
    // Process each credential in the import
    for (const credential of parsed.data) {
      // Check if this credential already exists
      const exists = existingCredentials.some(c => 
        c.domain === credential.domain && c.username === credential.username
      );
      
      // If it doesn't exist, add it
      if (!exists) {
        await saveCredential({
          ...credential,
          dateAdded: credential.dateAdded || new Date().toISOString()
        }, masterPassword);
        newCount++;
      }
    }
    
    return newCount;
  } catch (error) {
    console.error('Error importing credentials:', error);
    throw error;
  }
}
