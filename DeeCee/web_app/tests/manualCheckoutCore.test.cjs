const assert = require("node:assert/strict");
const {
  BANK_ACCOUNTS,
  PLANS,
  amountFor,
  futureExpiry,
  isExpired,
  metadataFor,
  normalizeProof,
  paymentView,
  publicConfig,
  randomCode,
  safeUsdNgnRate,
  validatePlanAndAccount
} = require("../server/manualCheckoutCore.cjs");

function test(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

test("public config exposes only plans/accounts, not owner secrets", () => {
  const config = publicConfig("1500");
  assert.equal(config.paymentWindowMinutes, 30);
  assert.equal(config.usdNgnRate, 1500);
  assert.equal(config.accounts.length, 1);
  assert.deepEqual(config.plans.map((plan) => plan.amountUsd), [0.99, 3.99, 39.99, 99.99]);
  assert.equal(JSON.stringify(config).includes("OWNER_ADMIN_TOKEN"), false);
});

test("other currency accounts are only exposed when explicitly requested", () => {
  assert.deepEqual(publicConfig("1500").accounts.map((account) => account.currency), ["USD"]);
  assert.deepEqual(publicConfig("1500", { includeOtherCurrency: true }).accounts.map((account) => account.currency), ["USD", "NGN", "NGN"]);
});

test("USD/NGN rate is clamped and never NaN", () => {
  assert.equal(safeUsdNgnRate("bad"), 1500);
  assert.equal(safeUsdNgnRate("-5"), 100);
  assert.equal(safeUsdNgnRate("500000"), 10000);
});

test("amount conversion keeps USD accounts in USD and converts NGN accounts", () => {
  assert.equal(amountFor(PLANS.monthly, BANK_ACCOUNTS.lead_usd, "1500"), 3.99);
  assert.equal(amountFor(PLANS.monthly, BANK_ACCOUNTS.moniepoint_ngn, "1500"), 5985);
});

test("OTP is alphanumeric, fixed length, and avoids ambiguous characters", () => {
  const code = randomCode(8);
  assert.match(code, /^[A-HJ-NP-Z2-9]{8}$/);
  assert.throws(() => randomCode(3), /Invalid code length/);
});

test("proof input is normalized and truncated against payload abuse", () => {
  const proof = normalizeProof("  abc\u0000\n\t def  ".repeat(80));
  assert.equal(proof.length, 220);
  assert.equal(proof.includes("\u0000"), false);
  assert.equal(/\s{2,}/.test(proof), false);
});

test("expiry and pending state survive as data, not browser memory", () => {
  const now = Date.UTC(2026, 4, 25, 12, 0, 0);
  const expiresAt = futureExpiry(now);
  assert.equal(isExpired({ metadata: { expires_at: expiresAt } }, now + 29 * 60 * 1000), false);
  assert.equal(isExpired({ metadata: { expires_at: expiresAt } }, now + 31 * 60 * 1000), true);
});

test("metadata uses DeeCee narration and can render a safe payment view", () => {
  const metadata = metadataFor({
    plan: PLANS.six_day,
    account: BANK_ACCOUNTS.lead_usd,
    reference: "DC-TEST-ABCD",
    otp: "A2B3C4D5",
    expiresAt: "2026-05-25T12:30:00.000Z",
    rawRate: "1500"
  });
  assert.equal(metadata.payment_note, "DCEE A2B3C4D5 DC-TEST-ABCD");

  const view = paymentView({
    id: "payment-1",
    provider_transaction_id: "DC-TEST-ABCD",
    status: "pending",
    amount: "0.99",
    currency: "USD",
    created_at: "2026-05-25T12:00:00.000Z",
    metadata
  });
  assert.equal(view.reference, "DC-TEST-ABCD");
  assert.equal(view.amount, 0.99);
  assert.equal(view.paymentNote, "DCEE A2B3C4D5 DC-TEST-ABCD");
});

test("unknown plans/accounts fail closed", () => {
  assert.deepEqual(validatePlanAndAccount("bad", "lead_usd"), { error: "Invalid plan" });
  assert.deepEqual(validatePlanAndAccount("six_day", "bad"), { error: "Invalid payment account" });
});
