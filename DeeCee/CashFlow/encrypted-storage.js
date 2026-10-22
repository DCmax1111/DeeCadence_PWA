"use strict";

(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CashflowEncryptedStorage = api;
})(typeof globalThis === "object" ? globalThis : this, function () {
  const FORMAT = "cashflow-encrypted-vault";
  const VERSION = 1;
  const ITERATIONS = 310000;
  const encoder = new TextEncoder();
  const UNLOCK_ERROR = "Could not unlock the data. Check the password or recovery key, or verify that the encrypted data is intact.";
  const AAD = {
    data: "cashflow:v1:data",
    password: "cashflow:v1:password-key",
    recovery: "cashflow:v1:recovery-key"
  };

  function cryptoApi() {
    const api = globalThis.crypto;
    if (!api || !api.subtle || typeof api.getRandomValues !== "function") {
      throw new Error("This browser does not support the cryptography required to protect Cashflow data.");
    }
    return api;
  }

  function bytesToBase64(bytes) {
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }

  function base64ToBytes(value) {
    if (typeof value !== "string" || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) {
      throw new Error("Encrypted data is invalid or unsupported.");
    }
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  function randomBytes(length) {
    return cryptoApi().getRandomValues(new Uint8Array(length));
  }

  function isPasswordValid(password) {
    return typeof password === "string" &&
      password.length >= 8 &&
      /[A-Za-z]/.test(password) &&
      /\d/.test(password) &&
      /[^A-Za-z0-9\s]/.test(password);
  }

  function recoveryKeyFromBytes(bytes) {
    const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("").toUpperCase();
    return hex.match(/.{1,8}/g).join("-");
  }

  function recoveryKeyToBytes(value) {
    if (typeof value !== "string" || !/^(?:[A-Fa-f0-9]{8}-){7}[A-Fa-f0-9]{8}$/.test(value)) {
      throw new Error("Enter the recovery key in its 8 groups of 8 characters.");
    }
    const hex = value.replace(/-/g, "");
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    return bytes;
  }

  async function passwordWrappingKey(password, salt) {
    const subtle = cryptoApi().subtle;
    const material = await subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveKey"]);
    return subtle.deriveKey(
      { name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" },
      material,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
  }

  async function recoveryWrappingKey(recoveryKey, salt) {
    const subtle = cryptoApi().subtle;
    const material = await subtle.importKey("raw", recoveryKeyToBytes(recoveryKey), "HKDF", false, ["deriveKey"]);
    return subtle.deriveKey(
      { name: "HKDF", hash: "SHA-256", salt, info: encoder.encode("cashflow:v1:recovery-wrap") },
      material,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
  }

  async function encrypt(key, value, additionalData) {
    const iv = randomBytes(12);
    const ciphertext = await cryptoApi().subtle.encrypt(
      { name: "AES-GCM", iv, additionalData: encoder.encode(additionalData), tagLength: 128 },
      key,
      value
    );
    return { iv: bytesToBase64(iv), ciphertext: bytesToBase64(new Uint8Array(ciphertext)) };
  }

  async function decrypt(key, wrapper, additionalData) {
    return cryptoApi().subtle.decrypt(
      { name: "AES-GCM", iv: base64ToBytes(wrapper.iv), additionalData: encoder.encode(additionalData), tagLength: 128 },
      key,
      base64ToBytes(wrapper.ciphertext)
    );
  }

  async function createWrapper(dataKey, wrappingKey, additionalData, salt) {
    const encrypted = await encrypt(wrappingKey, dataKey, additionalData);
    return Object.assign({ salt: bytesToBase64(salt) }, encrypted);
  }

  function validateEnvelope(envelope) {
    if (!envelope || envelope.format !== FORMAT || envelope.version !== VERSION ||
        !envelope.kdf || envelope.kdf.name !== "PBKDF2" ||
        envelope.kdf.hash !== "SHA-256" || envelope.kdf.iterations !== ITERATIONS ||
        !envelope.payload || envelope.payload.algorithm !== "AES-GCM" ||
        !envelope.keyWraps || !envelope.keyWraps.password || !envelope.keyWraps.recovery) {
      throw new Error("Encrypted data is invalid or unsupported.");
    }
    const payloadIv = base64ToBytes(envelope.payload.iv);
    const payloadCiphertext = base64ToBytes(envelope.payload.ciphertext);
    if (payloadIv.length !== 12 || payloadCiphertext.length < 16) throw new Error("Encrypted data is invalid or unsupported.");
    ["password", "recovery"].forEach(method => {
      const wrapper = envelope.keyWraps[method];
      const salt = base64ToBytes(wrapper.salt);
      const iv = base64ToBytes(wrapper.iv);
      const ciphertext = base64ToBytes(wrapper.ciphertext);
      if (salt.length !== 16 || iv.length !== 12 || ciphertext.length !== 48) {
        throw new Error("Encrypted data is invalid or unsupported.");
      }
    });
  }

  function isUnlockFailure(error) {
    return error && (error.name === "OperationError" || error.name === "DataError" || error instanceof SyntaxError);
  }

  async function createVaultInternal(data, password) {
    if (!isPasswordValid(password)) {
      throw new Error("Use at least 8 characters, including a letter, a number, and a symbol.");
    }
    const serialized = JSON.stringify(data);
    if (serialized === undefined) throw new Error("Cashflow data could not be serialized for encryption.");

    const subtle = cryptoApi().subtle;
    const dataKeyBytes = randomBytes(32);
    const dataKey = await subtle.importKey("raw", dataKeyBytes, "AES-GCM", false, ["encrypt", "decrypt"]);
    const recoveryKey = recoveryKeyFromBytes(randomBytes(32));
    const passwordSalt = randomBytes(16);
    const recoverySalt = randomBytes(16);
    const passwordKey = await passwordWrappingKey(password, passwordSalt);
    const recoveryKeyForWrap = await recoveryWrappingKey(recoveryKey, recoverySalt);
    const payload = await encrypt(dataKey, encoder.encode(serialized), AAD.data);
    const passwordWrap = await createWrapper(dataKeyBytes, passwordKey, AAD.password, passwordSalt);
    const recoveryWrap = await createWrapper(dataKeyBytes, recoveryKeyForWrap, AAD.recovery, recoverySalt);

    return {
      envelope: {
        format: FORMAT,
        version: VERSION,
        kdf: { name: "PBKDF2", hash: "SHA-256", iterations: ITERATIONS },
        payload: Object.assign({ algorithm: "AES-GCM" }, payload),
        keyWraps: { password: passwordWrap, recovery: recoveryWrap }
      },
      recoveryKey,
      dataKey,
      dataKeyBytes
    };
  }

  async function createVault(data, password) {
    const created = await createVaultInternal(data, password);
    return { envelope: created.envelope, recoveryKey: created.recoveryKey };
  }

  function createSession(dataKey, dataKeyBytes, initialEnvelope) {
    let active = true;
    let saveQueue = Promise.resolve();
    let envelope = initialEnvelope;
    return {
      async preparePasswordChange(password) {
        if (!active) throw new Error("The encrypted session is locked.");
        if (!isPasswordValid(password)) throw new Error("Use at least 8 characters, including a letter, a number, and a symbol.");
        const salt = randomBytes(16);
        const wrappingKey = await passwordWrappingKey(password, salt);
        const passwordWrap = await createWrapper(dataKeyBytes, wrappingKey, AAD.password, salt);
        return Object.assign({}, envelope, { keyWraps: Object.assign({}, envelope.keyWraps, { password: passwordWrap }) });
      },
      async prepareRecoveryRotation() {
        if (!active) throw new Error("The encrypted session is locked.");
        const recoveryKey = recoveryKeyFromBytes(randomBytes(32));
        const salt = randomBytes(16);
        const wrappingKey = await recoveryWrappingKey(recoveryKey, salt);
        const recoveryWrap = await createWrapper(dataKeyBytes, wrappingKey, AAD.recovery, salt);
        return {
          recoveryKey,
          envelope: Object.assign({}, envelope, { keyWraps: Object.assign({}, envelope.keyWraps, { recovery: recoveryWrap }) })
        };
      },
      adoptEnvelope(nextEnvelope) {
        if (!active) throw new Error("The encrypted session is locked.");
        validateEnvelope(nextEnvelope);
        envelope = nextEnvelope;
      },
      save(data) {
        if (!active) throw new Error("The encrypted session is locked.");
        const snapshot = JSON.stringify(data);
        if (snapshot === undefined) throw new Error("Cashflow data could not be serialized for encryption.");
        const operation = saveQueue.then(async () => {
          if (!active) throw new Error("The encrypted session is locked.");
          const payload = await encrypt(dataKey, encoder.encode(snapshot), AAD.data);
          if (!active) throw new Error("The encrypted session is locked.");
          envelope = Object.assign({}, envelope, { payload: Object.assign({ algorithm: "AES-GCM" }, payload) });
          return envelope;
        });
        saveQueue = operation.then(() => undefined, () => undefined);
        return operation;
      },
      lock() {
        active = false;
      }
    };
  }

  async function createVaultSession(data, password) {
    const created = await createVaultInternal(data, password);
    return {
      envelope: created.envelope,
      recoveryKey: created.recoveryKey,
      session: createSession(created.dataKey, created.dataKeyBytes, created.envelope)
    };
  }

  async function unlockVaultInternal(envelope, credential, method) {
    const unlockMethod = method || "password";
    if (unlockMethod !== "password" && unlockMethod !== "recovery") {
      throw new Error("Choose password or recovery-key unlock.");
    }
    validateEnvelope(envelope);
    if (typeof credential !== "string" || !credential) throw new Error(UNLOCK_ERROR);

    try {
      const wrapper = envelope.keyWraps[unlockMethod];
      const salt = base64ToBytes(wrapper.salt);
      const wrappingKey = unlockMethod === "password"
        ? await passwordWrappingKey(credential, salt)
        : await recoveryWrappingKey(credential, salt);
      const dataKeyBytes = await decrypt(wrappingKey, wrapper, AAD[unlockMethod]);
      const dataKey = await cryptoApi().subtle.importKey("raw", dataKeyBytes, "AES-GCM", false, ["encrypt", "decrypt"]);
      const plaintext = await decrypt(dataKey, envelope.payload, AAD.data);
      return { data: JSON.parse(new TextDecoder().decode(plaintext)), dataKey, dataKeyBytes };
    } catch (error) {
      if (isUnlockFailure(error)) throw new Error(UNLOCK_ERROR);
      throw error;
    }
  }

  async function unlockVault(envelope, credential, method) {
    const unlocked = await unlockVaultInternal(envelope, credential, method);
    return unlocked.data;
  }

  async function unlockVaultSession(envelope, credential, method) {
    const unlocked = await unlockVaultInternal(envelope, credential, method);
    return { data: unlocked.data, session: createSession(unlocked.dataKey, unlocked.dataKeyBytes, envelope) };
  }

  return Object.freeze({ createVault, unlockVault, createVaultSession, unlockVaultSession, isPasswordValid });
});
