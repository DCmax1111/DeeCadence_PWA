const assert = require("node:assert/strict");
const {
  isGmailEmail,
  isValidUsername,
  normalizeEmail,
  normalizeUsername,
  validatePassword
} = require("../server/authCore.cjs");

assert.equal(normalizeEmail("  User.Name@gmail.com "), "user.name@gmail.com");
assert.equal(isGmailEmail("person@gmail.com"), true);
assert.equal(isGmailEmail("person@yahoo.com"), false);
assert.equal(isGmailEmail("person@googlemail.com"), false);

assert.equal(normalizeUsername("@Dee_Cee24"), "dee_cee24");
assert.equal(isValidUsername("dc_user"), true);
assert.equal(isValidUsername("dc"), false);
assert.equal(isValidUsername("bad-name"), false);
assert.equal(isValidUsername("this_username_is_far_too_long_for_deecee"), false);

assert.equal(validatePassword("1234567"), "Password must be at least 8 characters.");
assert.equal(validatePassword("12345678"), "Password must include at least one letter.");
assert.equal(validatePassword("abcdefgh"), "Password must include at least one number.");
assert.equal(validatePassword("abcd1234"), "Password must include at least one symbol.");
assert.equal(validatePassword("abcd1234!"), "");

console.log("ok - account auth validation is strict and Gmail-only");
