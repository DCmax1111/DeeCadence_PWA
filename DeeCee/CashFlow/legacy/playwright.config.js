const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests",
  timeout: 60000,
  fullyParallel: false,
  workers: 1,
  reporter: "line",
  use: {
    headless: true,
    screenshot: "only-on-failure",
    trace: "retain-on-failure"
  }
});
