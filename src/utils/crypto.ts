/**
 * Module 2: Generates Key A (Auth Hash) and Key B (Encryption Key) 
 * from a Master Password using the browser's native Web Crypto API.
 */
export async function deriveKeys(password: string, email: string): Promise<{ authHash: string; encryptionKey: CryptoKey }> {
  const encoder = new TextEncoder();
  const passwordBytes = encoder.encode(password);
  const saltBytes = encoder.encode(email.toLowerCase());

  const baseKey = await window.crypto.subtle.importKey(
    "raw",
    passwordBytes,
    "PBKDF2",
    false,
    ["deriveBits", "deriveKey"]
  );

  const derivedBits = await window.crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: saltBytes,
      iterations: 600000,
      hash: "SHA-256",
    },
    baseKey,
    512
  );

  const rawBits = new Uint8Array(derivedBits);
  const authHashBytes = rawBits.slice(0, 32);     
  const encryptionKeyBytes = rawBits.slice(32, 64); 

  const authHash = Array.from(authHashBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const encryptionKey = await window.crypto.subtle.importKey(
    "raw",
    encryptionKeyBytes,
    "AES-GCM",
    false,
    ["encrypt", "decrypt"]
  );

  return { authHash, encryptionKey };
}

/**
 * Module 3: Encrypts a plaintext string using Key B (AES-GCM)
 */
export async function encryptData(plaintext: string, key: CryptoKey): Promise<string> {
  const encoder = new TextEncoder();
  const dataBytes = encoder.encode(plaintext);

  // Generate a random 12-byte Initialization Vector (IV)
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  // Encrypt the data using the browser's hardware crypto suite
  const encryptedBuffer = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    key,
    dataBytes
  );

  // Convert the IV and Encrypted payload into basic arrays to combine them
  const encryptedBytes = new Uint8Array(encryptedBuffer);
  const combinedBytes = new Uint8Array(iv.length + encryptedBytes.length);
  
  combinedBytes.set(iv);
  combinedBytes.set(encryptedBytes, iv.length);

  // Convert the combined binary data into a single, clean Base64 text string for database storage
  return btoa(String.fromCharCode(...combinedBytes));
}

/**
 * Module 3: Decrypts a Base64 ciphertext string using Key B (AES-GCM)
 */
export async function decryptData(ciphertext: string, key: CryptoKey): Promise<string> {
  // Convert our Base64 database text back into a raw byte array
  const combinedBytes = new Uint8Array(
    atob(ciphertext).split("").map((c) => c.charCodeAt(0))
  );

  // Extract the original 12-byte IV from the front of the array
  const iv = combinedBytes.slice(0, 12);
  const encryptedBytes = combinedBytes.slice(12);

  // Decrypt the text using Key B and the extracted IV
  const decryptedBuffer = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv },
    key,
    encryptedBytes
  );

  const decoder = new TextDecoder();
  return decoder.decode(decryptedBuffer);
}