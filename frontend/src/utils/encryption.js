/**
 * Encryption Utility for DocMatrix DMS
 * AES-256 encryption at rest, encrypted previews/thumbnails
 */

// Encryption configuration
const ENCRYPTION_CONFIG = {
  ALGORITHM: 'AES-GCM',
  KEY_LENGTH: 256,
  IV_LENGTH: 12,
  SALT_LENGTH: 16,
  ITERATIONS: 100000,
  HASH: 'SHA-256'
};

// Generate a random encryption key
export const generateKey = async () => {
  const key = await crypto.subtle.generateKey(
    { name: ENCRYPTION_CONFIG.ALGORITHM, length: ENCRYPTION_CONFIG.KEY_LENGTH },
    true,
    ['encrypt', 'decrypt']
  );
  return key;
};

// Derive key from password using PBKDF2
export const deriveKeyFromPassword = async (password, salt = null) => {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);
  
  // Generate or use provided salt
  const useSalt = salt || crypto.getRandomValues(new Uint8Array(ENCRYPTION_CONFIG.SALT_LENGTH));
  
  // Import password as key material
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );
  
  // Derive key using PBKDF2
  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: useSalt,
      iterations: ENCRYPTION_CONFIG.ITERATIONS,
      hash: ENCRYPTION_CONFIG.HASH
    },
    keyMaterial,
    { name: ENCRYPTION_CONFIG.ALGORITHM, length: ENCRYPTION_CONFIG.KEY_LENGTH },
    true,
    ['encrypt', 'decrypt']
  );
  
  return { key, salt: useSalt };
};

// Export key to storable format
export const exportKey = async (key) => {
  const exported = await crypto.subtle.exportKey('raw', key);
  return new Uint8Array(exported);
};

// Import key from stored format
export const importKey = async (keyData) => {
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: ENCRYPTION_CONFIG.ALGORITHM, length: ENCRYPTION_CONFIG.KEY_LENGTH },
    true,
    ['encrypt', 'decrypt']
  );
  return key;
};

// Encrypt data with AES-256-GCM
export const encrypt = async (data, key) => {
  try {
    // Convert data to ArrayBuffer if needed
    let dataBuffer;
    if (typeof data === 'string') {
      dataBuffer = new TextEncoder().encode(data);
    } else if (data instanceof ArrayBuffer) {
      dataBuffer = new Uint8Array(data);
    } else if (data instanceof Uint8Array) {
      dataBuffer = data;
    } else if (data instanceof Blob) {
      dataBuffer = new Uint8Array(await data.arrayBuffer());
    } else {
      dataBuffer = new TextEncoder().encode(JSON.stringify(data));
    }
    
    // Generate random IV
    const iv = crypto.getRandomValues(new Uint8Array(ENCRYPTION_CONFIG.IV_LENGTH));
    
    // Encrypt
    const encrypted = await crypto.subtle.encrypt(
      { name: ENCRYPTION_CONFIG.ALGORITHM, iv },
      key,
      dataBuffer
    );
    
    // Combine IV + encrypted data
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encrypted), iv.length);
    
    return {
      success: true,
      data: combined,
      ivLength: iv.length
    };
  } catch (error) {
    console.error('Encryption failed:', error);
    return { success: false, error: error.message };
  }
};

// Decrypt data with AES-256-GCM
export const decrypt = async (encryptedData, key) => {
  try {
    const data = encryptedData instanceof Uint8Array 
      ? encryptedData 
      : new Uint8Array(encryptedData);
    
    // Extract IV and encrypted content
    const iv = data.slice(0, ENCRYPTION_CONFIG.IV_LENGTH);
    const content = data.slice(ENCRYPTION_CONFIG.IV_LENGTH);
    
    // Decrypt
    const decrypted = await crypto.subtle.decrypt(
      { name: ENCRYPTION_CONFIG.ALGORITHM, iv },
      key,
      content
    );
    
    return {
      success: true,
      data: new Uint8Array(decrypted)
    };
  } catch (error) {
    console.error('Decryption failed:', error);
    return { success: false, error: error.message };
  }
};

// Encrypt string and return base64
export const encryptToBase64 = async (text, key) => {
  const result = await encrypt(text, key);
  if (!result.success) return result;
  
  return {
    success: true,
    data: arrayBufferToBase64(result.data)
  };
};

// Decrypt from base64 string
export const decryptFromBase64 = async (base64Data, key) => {
  try {
    const data = base64ToArrayBuffer(base64Data);
    const result = await decrypt(new Uint8Array(data), key);
    if (!result.success) return result;
    
    return {
      success: true,
      data: new TextDecoder().decode(result.data)
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Encrypt file with metadata
export const encryptFile = async (file, key, options = {}) => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const encrypted = await encrypt(new Uint8Array(arrayBuffer), key);
    
    if (!encrypted.success) return encrypted;
    
    // Create encrypted package with metadata
    const metadata = {
      name: file.name,
      type: file.type,
      size: file.size,
      lastModified: file.lastModified,
      encryptedAt: new Date().toISOString(),
      ...options.metadata
    };
    
    const metadataEncrypted = await encrypt(JSON.stringify(metadata), key);
    if (!metadataEncrypted.success) return metadataEncrypted;
    
    return {
      success: true,
      encryptedData: encrypted.data,
      encryptedMetadata: metadataEncrypted.data,
      originalSize: file.size
    };
  } catch (error) {
    console.error('File encryption failed:', error);
    return { success: false, error: error.message };
  }
};

// Decrypt file
export const decryptFile = async (encryptedData, encryptedMetadata, key) => {
  try {
    // Decrypt metadata
    const metadataResult = await decrypt(encryptedMetadata, key);
    if (!metadataResult.success) return metadataResult;
    
    const metadata = JSON.parse(new TextDecoder().decode(metadataResult.data));
    
    // Decrypt file data
    const dataResult = await decrypt(encryptedData, key);
    if (!dataResult.success) return dataResult;
    
    // Create blob with original type
    const blob = new Blob([dataResult.data], { type: metadata.type });
    
    return {
      success: true,
      blob,
      metadata
    };
  } catch (error) {
    console.error('File decryption failed:', error);
    return { success: false, error: error.message };
  }
};

// Generate encrypted thumbnail/preview
export const generateEncryptedThumbnail = async (imageData, key, maxSize = 150) => {
  try {
    // Create canvas for thumbnail generation
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // Load image
    const img = await loadImage(imageData);
    
    // Calculate thumbnail dimensions
    const ratio = Math.min(maxSize / img.width, maxSize / img.height);
    canvas.width = img.width * ratio;
    canvas.height = img.height * ratio;
    
    // Draw scaled image
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    
    // Get thumbnail as blob
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.7));
    const arrayBuffer = await blob.arrayBuffer();
    
    // Encrypt thumbnail
    const encrypted = await encrypt(new Uint8Array(arrayBuffer), key);
    
    return {
      success: true,
      encryptedThumbnail: encrypted.data,
      width: canvas.width,
      height: canvas.height
    };
  } catch (error) {
    console.error('Thumbnail generation failed:', error);
    return { success: false, error: error.message };
  }
};

// Decrypt and display thumbnail
export const decryptThumbnail = async (encryptedThumbnail, key) => {
  try {
    const decrypted = await decrypt(encryptedThumbnail, key);
    if (!decrypted.success) return decrypted;
    
    const blob = new Blob([decrypted.data], { type: 'image/jpeg' });
    const url = URL.createObjectURL(blob);
    
    return {
      success: true,
      url,
      revoke: () => URL.revokeObjectURL(url)
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Generate encrypted preview for documents
export const generateEncryptedPreview = async (content, key, previewLength = 500) => {
  try {
    // Get preview text
    let previewText;
    if (typeof content === 'string') {
      previewText = content.substring(0, previewLength);
    } else if (content instanceof Uint8Array) {
      previewText = new TextDecoder().decode(content).substring(0, previewLength);
    } else {
      previewText = String(content).substring(0, previewLength);
    }
    
    // Encrypt preview
    const encrypted = await encrypt(previewText, key);
    
    return {
      success: true,
      encryptedPreview: encrypted.data,
      length: previewText.length
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Decrypt preview
export const decryptPreview = async (encryptedPreview, key) => {
  try {
    const decrypted = await decrypt(encryptedPreview, key);
    if (!decrypted.success) return decrypted;
    
    return {
      success: true,
      preview: new TextDecoder().decode(decrypted.data)
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Secure key storage in memory (with basic protection)
class SecureKeyStore {
  constructor() {
    this.keys = new Map();
    this.masterKeyHash = null;
  }
  
  async setMasterPassword(password) {
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(password));
    this.masterKeyHash = Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    const { key, salt } = await deriveKeyFromPassword(password);
    this.keys.set('master', { key, salt });
    
    return true;
  }
  
  async verifyMasterPassword(password) {
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(password));
    const hash = Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    return hash === this.masterKeyHash;
  }
  
  getMasterKey() {
    return this.keys.get('master')?.key;
  }
  
  hasMasterKey() {
    return this.keys.has('master');
  }
  
  async addKey(keyId, key) {
    this.keys.set(keyId, { key });
  }
  
  getKey(keyId) {
    return this.keys.get(keyId)?.key;
  }
  
  removeKey(keyId) {
    this.keys.delete(keyId);
  }
  
  clearAll() {
    this.keys.clear();
    this.masterKeyHash = null;
  }
}

// Singleton key store
export const keyStore = new SecureKeyStore();

// Helper: Load image from various sources
const loadImage = (source) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    
    if (source instanceof Blob) {
      img.src = URL.createObjectURL(source);
    } else if (source instanceof ArrayBuffer || source instanceof Uint8Array) {
      const blob = new Blob([source]);
      img.src = URL.createObjectURL(blob);
    } else if (typeof source === 'string') {
      img.src = source;
    }
  });
};

// Helper: ArrayBuffer to Base64
const arrayBufferToBase64 = (buffer) => {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

// Helper: Base64 to ArrayBuffer
const base64ToArrayBuffer = (base64) => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
};

// Encryption status check
export const isEncryptionAvailable = () => {
  return typeof crypto !== 'undefined' && 
         typeof crypto.subtle !== 'undefined' &&
         typeof crypto.getRandomValues === 'function';
};

export default {
  generateKey,
  deriveKeyFromPassword,
  exportKey,
  importKey,
  encrypt,
  decrypt,
  encryptToBase64,
  decryptFromBase64,
  encryptFile,
  decryptFile,
  generateEncryptedThumbnail,
  decryptThumbnail,
  generateEncryptedPreview,
  decryptPreview,
  keyStore,
  isEncryptionAvailable,
  ENCRYPTION_CONFIG
};
