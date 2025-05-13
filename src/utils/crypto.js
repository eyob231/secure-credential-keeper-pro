
/**
 * Crypto utility functions for handling encryption and decryption
 */

// Derive a key from the master password
export async function deriveKeyFromPassword(password, salt = null) {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);
  
  // Generate a salt if not provided
  if (!salt) {
    salt = crypto.getRandomValues(new Uint8Array(16));
  } else if (typeof salt === 'string') {
    // Convert from base64 if it's a string
    salt = _base64ToArrayBuffer(salt);
  }
  
  // Import the password as a key
  const importedKey = await crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
  
  // Derive a key using PBKDF2
  const derivedKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    importedKey,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
  
  return { key: derivedKey, salt: _arrayBufferToBase64(salt) };
}

// Encrypt data using AES-GCM
export async function encrypt(data, key) {
  // Generate a random IV
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  // Convert data to ArrayBuffer if it's not already
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(JSON.stringify(data));
  
  // Encrypt the data
  const encryptedBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv
    },
    key,
    dataBuffer
  );
  
  // Return the IV and encrypted data as base64 strings
  return {
    iv: _arrayBufferToBase64(iv),
    encryptedData: _arrayBufferToBase64(encryptedBuffer)
  };
}

// Decrypt data using AES-GCM
export async function decrypt(encryptedData, iv, key) {
  // Convert base64 strings to ArrayBuffers
  const encryptedBuffer = _base64ToArrayBuffer(encryptedData);
  const ivBuffer = _base64ToArrayBuffer(iv);
  
  // Decrypt the data
  const decryptedBuffer = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: ivBuffer
    },
    key,
    encryptedBuffer
  );
  
  // Convert the decrypted data back to its original format
  const decoder = new TextDecoder();
  const decryptedText = decoder.decode(decryptedBuffer);
  
  return JSON.parse(decryptedText);
}

// Hash function for verifying master password
export async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return _arrayBufferToBase64(hashBuffer);
}

// Helper function to convert ArrayBuffer to Base64 string
function _arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Helper function to convert Base64 string to ArrayBuffer
function _base64ToArrayBuffer(base64) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}
