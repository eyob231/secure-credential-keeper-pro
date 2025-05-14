
/**
 * Cryptography utility functions
 */

// Generate random bytes for keys, IVs, etc.
export function generateRandomBytes(length) {
  const array = new Uint8Array(length);
  window.crypto.getRandomValues(array);
  return array;
}

// Derive a key from a password and salt using PBKDF2
export async function deriveKey(password, salt) {
  // Convert the password string to an array buffer
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);
  
  // Import the password as a raw key
  const importedKey = await window.crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );
  
  // Derive a key using PBKDF2
  const derivedKey = await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000, // High iteration count for security
      hash: 'SHA-256'
    },
    importedKey,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
  
  // Export the key as raw bytes
  const rawKey = await window.crypto.subtle.exportKey('raw', derivedKey);
  return new Uint8Array(rawKey);
}

// Hash data using SHA-256
export async function hashData(data) {
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
  
  // Convert the hash to a hex string
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Encrypt data using AES-GCM
export async function encryptData(data, key) {
  // Generate a random IV
  const iv = generateRandomBytes(12); // 12 bytes is recommended for AES-GCM
  
  // Import the key
  const importedKey = await window.crypto.subtle.importKey(
    'raw',
    key,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );
  
  // Encrypt the data
  const encryptedBuffer = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv
    },
    importedKey,
    data
  );
  
  // Return the ciphertext and IV
  return {
    ciphertext: new Uint8Array(encryptedBuffer),
    iv: iv
  };
}

// Decrypt data using AES-GCM
export async function decryptData(encryptedData, key) {
  // Import the key
  const importedKey = await window.crypto.subtle.importKey(
    'raw',
    key,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );
  
  // Decrypt the data
  const decryptedBuffer = await window.crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: encryptedData.iv
    },
    importedKey,
    encryptedData.ciphertext
  );
  
  return new Uint8Array(decryptedBuffer);
}

// Generate a random password
export function generatePassword(length = 16, options = {}) {
  const defaults = {
    uppercase: true,
    lowercase: true,
    numbers: true,
    symbols: true
  };
  
  const config = { ...defaults, ...options };
  
  // Define character sets
  const charSets = {
    uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    lowercase: 'abcdefghijklmnopqrstuvwxyz',
    numbers: '0123456789',
    symbols: '!@#$%^&*()_-+={}[]|:;<>,.?/'
  };
  
  // Build the character set to use
  let chars = '';
  if (config.uppercase) chars += charSets.uppercase;
  if (config.lowercase) chars += charSets.lowercase;
  if (config.numbers) chars += charSets.numbers;
  if (config.symbols) chars += charSets.symbols;
  
  if (chars.length === 0) {
    throw new Error('At least one character type must be enabled');
  }
  
  // Generate random bytes
  const randomBytes = generateRandomBytes(length * 2); // Get extra bytes in case of modulo bias
  
  // Convert to password
  let password = '';
  for (let i = 0; i < randomBytes.length && password.length < length; i++) {
    const index = randomBytes[i] % chars.length;
    password += chars[index];
  }
  
  return password;
}
