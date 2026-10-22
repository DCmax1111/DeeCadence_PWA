const assert = require("node:assert/strict");
const { webcrypto } = require("node:crypto");
const { test } = require("node:test");

globalThis.crypto = webcrypto;
const vault = require("../encrypted-storage.js");

test("password policy requires length, letters, numbers, and symbols", () => {
  assert.equal(vault.isPasswordValid("Abcdef1!"), true);
  assert.equal(vault.isPasswordValid("abcdefg"), false);
  assert.equal(vault.isPasswordValid("Abcdefgh!"), false);
  assert.equal(vault.isPasswordValid("Abcdefg1"), false);
  assert.equal(vault.isPasswordValid("Abc 1234"), false);
});

test("vault encrypts ledger data and unlocks with password or recovery key", async () => {
  const password = "LedgerPass1!";
  const original = { profile: { name: "Example user" }, data: { accounts: [{ name: "Private account", balance: 125000 }] } };
  const { envelope, recoveryKey } = await vault.createVault(original, password);
  const serializedEnvelope = JSON.stringify(envelope);

  assert.match(recoveryKey, /^(?:[A-F0-9]{8}-){7}[A-F0-9]{8}$/);
  assert.equal(serializedEnvelope.includes("Private account"), false);
  assert.equal(serializedEnvelope.includes("125000"), false);
  assert.equal(serializedEnvelope.includes(password), false);
  assert.deepEqual(await vault.unlockVault(envelope, password, "password"), original);
  assert.deepEqual(await vault.unlockVault(envelope, recoveryKey, "recovery"), original);
});

test("wrong credentials, tampered ciphertext, and unsupported envelopes fail closed", async () => {
  const { envelope, recoveryKey } = await vault.createVault({ data: { tx: [] } }, "LedgerPass1!");
  await assert.rejects(vault.unlockVault(envelope, "WrongPass1!", "password"), /Could not unlock/);
  const wrongRecoveryKey = (recoveryKey[0] === "0" ? "1" : "0") + recoveryKey.slice(1);
  await assert.rejects(vault.unlockVault(envelope, wrongRecoveryKey, "recovery"), /Could not unlock/);

  const tampered = structuredClone(envelope);
  const payload = Buffer.from(tampered.payload.ciphertext, "base64");
  payload[0] ^= 1;
  tampered.payload.ciphertext = payload.toString("base64");
  await assert.rejects(vault.unlockVault(tampered, "LedgerPass1!", "password"), /Could not unlock/);

  const unsupported = structuredClone(envelope);
  unsupported.version = 99;
  await assert.rejects(vault.unlockVault(unsupported, "LedgerPass1!", "password"), /invalid or unsupported/);
});

test("vault creation rejects weak passwords", async () => {
  await assert.rejects(vault.createVault({ data: {} }, "weakpass"), /at least 8 characters/);
});

test("unlocked sessions save encrypted updates and reject writes after locking", async () => {
  const initial = { data: { tx: [] } };
  const created = await vault.createVaultSession(initial, "LedgerPass1!");
  const updated = { data: { tx: [{ description: "Private purchase", amount: 900 }] } };
  const updatedEnvelope = await created.session.save(updated);

  assert.equal(JSON.stringify(updatedEnvelope).includes("Private purchase"), false);
  assert.deepEqual(await vault.unlockVault(updatedEnvelope, "LedgerPass1!", "password"), updated);

  const reopened = await vault.unlockVaultSession(updatedEnvelope, created.recoveryKey, "recovery");
  assert.deepEqual(reopened.data, updated);
  const nextEnvelope = await reopened.session.save({ data: { tx: [] } });
  assert.deepEqual(await vault.unlockVault(nextEnvelope, "LedgerPass1!", "password"), { data: { tx: [] } });

  reopened.session.lock();
  assert.throws(() => reopened.session.save(updated), /session is locked/);
});

test("password reset and recovery-key rotation rewrap the data key without changing ledger data", async () => {
  const ledger = { profile: { name: "Credential test" }, data: { accounts: [{ balance: 4321 }] } };
  const created = await vault.createVaultSession(ledger, "OriginalPass1!");
  const changedPasswordEnvelope = await created.session.preparePasswordChange("ReplacementPass2!");

  assert.deepEqual(await vault.unlockVault(changedPasswordEnvelope, "ReplacementPass2!", "password"), ledger);
  await assert.rejects(vault.unlockVault(changedPasswordEnvelope, "OriginalPass1!", "password"), /Could not unlock/);
  assert.deepEqual(await vault.unlockVault(changedPasswordEnvelope, created.recoveryKey, "recovery"), ledger);

  created.session.adoptEnvelope(changedPasswordEnvelope);
  const rotation = await created.session.prepareRecoveryRotation();
  assert.deepEqual(await vault.unlockVault(rotation.envelope, rotation.recoveryKey, "recovery"), ledger);
  await assert.rejects(vault.unlockVault(rotation.envelope, created.recoveryKey, "recovery"), /Could not unlock/);
  assert.deepEqual(await vault.unlockVault(rotation.envelope, "ReplacementPass2!", "password"), ledger);

  created.session.adoptEnvelope(rotation.envelope);
  const saved = await created.session.save(ledger);
  assert.deepEqual(await vault.unlockVault(saved, rotation.recoveryKey, "recovery"), ledger);
});

test("credential rotation keeps the latest ledger payload", async () => {
  const first = { profile: { name: "Before" }, data: { accounts: [] } };
  const latest = { profile: { name: "After" }, data: { accounts: [{ balance: 111 }] } };
  const created = await vault.createVaultSession(first, "OriginalPass1!");
  await created.session.save(latest);
  const rotation = await created.session.prepareRecoveryRotation();
  assert.deepEqual(await vault.unlockVault(rotation.envelope, rotation.recoveryKey, "recovery"), latest);
});
