const assert = require("node:assert/strict");
const {
  normalizePaymentStatus,
  publicCheckoutConfig,
  signWebhookPayload,
  verifyWebhookSignature
} = require("../server/paymentCore.cjs");

function test(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

test("sandbox checkout config is public and test-mode by default", () => {
  delete process.env.PAYMENT_PROVIDER;
  const config = publicCheckoutConfig("1500");
  assert.equal(config.provider, "sandbox_pay");
  assert.equal(config.mode, "sandbox");
  assert.equal(config.paymentMethods[0].id, "sandbox_card");
  assert.equal(JSON.stringify(config).includes("101019644"), false);
});

test("payment statuses normalize to the production vocabulary", () => {
  assert.equal(normalizePaymentStatus("succeeded"), "successful");
  assert.equal(normalizePaymentStatus("success"), "successful");
  assert.equal(normalizePaymentStatus("cancelled"), "abandoned");
  assert.equal(normalizePaymentStatus("refunded"), "refunded");
  assert.equal(normalizePaymentStatus("???"), "");
});

test("webhook signatures pass only for the exact payload and secret", () => {
  const body = JSON.stringify({ reference: "DC-TEST-ABCD", status: "successful" });
  const signature = signWebhookPayload(body, "secret-one");
  assert.equal(verifyWebhookSignature(body, signature, "secret-one"), true);
  assert.equal(verifyWebhookSignature(body.replace("successful", "failed"), signature, "secret-one"), false);
  assert.equal(verifyWebhookSignature(body, signature, "secret-two"), false);
});
