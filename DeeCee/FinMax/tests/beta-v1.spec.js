const { test, expect } = require("@playwright/test");
const { pathToFileURL } = require("url");
const path = require("path");

const appUrl = pathToFileURL(path.resolve(__dirname, "..", "Beta-v1", "index.html")).href;

async function seed(page, overrides = {}) {
  const state = {
    version: 1,
    profile: { name: "Ada", currency: "NGN", theme: "light", fxRate: 1600, onboarded: true, tutorialDone: true },
    accounts: [{ id: "a1", name: "Daily wallet", institution: "Moniepoint", type: "Mobile wallet", balance: 25000 }],
    transactions: [], reviewQueue: [], rules: [], goal: null, payment: null,
    meta: { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    ...overrides
  };
  await page.addInitScript(value => localStorage.setItem("finmax_beta_v1", JSON.stringify(value)), state);
  await page.goto(appUrl);
}

test("onboarding creates first account and completes tutorial", async ({ page }) => {
  await page.goto(appUrl);
  await page.getByLabel("What should we call you?").fill("Ada");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Account name").fill("Main wallet");
  await page.getByLabel("Bank, fintech, or provider").fill("PalmPay");
  await page.getByLabel("Current balance").fill("12000");
  await page.getByRole("button", { name: "Show me how it works" }).click();
  await expect(page.getByText("Bring money in")).toBeVisible();
  await page.getByRole("button", { name: "Skip" }).click();
  await expect(page.getByText("Estimated total across 1 account")).toBeVisible();
});

test("manual income updates account and dashboard", async ({ page }) => {
  await seed(page);
  await page.getByRole("button", { name: /Log money/ }).first().click();
  await page.getByLabel("What happened?").selectOption("income");
  await page.getByLabel("Amount").fill("5000");
  await page.getByLabel("Category").fill("Income");
  await page.getByLabel("Description").fill("Client deposit");
  await page.getByRole("button", { name: "Save transaction" }).click();
  await expect(page.getByText("NGN 30,000", { exact: false }).first()).toBeVisible();
  await expect(page.getByText("Client deposit")).toBeVisible();
});

test("review confirmation preserves narration and reaches activity", async ({ page }) => {
  await seed(page, { reviewQueue: [{ id: "r1", date: "2026-07-18", description: "NETFLIX PAYMENT", rawDescription: "NETFLIX.COM MONTHLY CARD PAYMENT REF 8821", amount: 3200, accountId: "a1", type: "expense", category: "", sourceFile: "statement.csv", fingerprint: "one" }] });
  await page.getByRole("button", { name: /Review/ }).first().click();
  await expect(page.getByText(/NETFLIX.COM MONTHLY/)).toBeHidden();
  await page.getByText("NETFLIX PAYMENT").click();
  await expect(page.getByText(/NETFLIX.COM MONTHLY/)).toBeVisible();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await page.getByRole("button", { name: "Activity" }).first().click();
  await expect(page.getByText("NETFLIX PAYMENT")).toBeVisible();
});

test("goal and payment remain explicit and local", async ({ page }) => {
  await seed(page);
  await page.getByRole("button", { name: "Goal" }).first().click();
  await page.getByRole("button", { name: /Create/ }).first().click();
  await page.getByLabel("Goal name").fill("Emergency reserve");
  await page.getByLabel("Target amount").fill("100000");
  await page.getByLabel("Already saved").fill("10000");
  await page.getByRole("button", { name: "Save goal" }).click();
  await expect(page.getByText("Emergency reserve")).toBeVisible();
  await page.getByRole("button", { name: "More" }).first().click();
  await page.getByRole("button", { name: "Choose Clear Month" }).click();
  await expect(page.getByText("$1.77", { exact: false }).first()).toBeVisible();
  await page.getByRole("button", { name: /Other currency/ }).click();
  await expect(page.getByText("8085318908")).toBeVisible();
  await expect(page.getByText(/NGN 2,478/)).toBeVisible();
  await expect(page.getByLabel(/USD to NGN estimate/)).toHaveCount(0);
  await page.getByRole("button", { name: "I have made the transfer" }).click();
  await expect(page.getByText(/pending verification/i).first()).toBeVisible();
  await expect(page.getByText(/cannot notify the owner or verify payment yet/i)).toBeVisible();
});

test("mobile viewport stays within the screen", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await seed(page);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await expect(page.locator(".mobile-nav")).toBeVisible();
});

test("cash accounts do not ask for an institution", async ({ page }) => {
  await page.goto(appUrl);
  await page.getByLabel("What should we call you?").fill("Ada");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Where is the money?").selectOption("Cash");
  await expect(page.getByLabel("Bank, fintech, or provider")).toBeHidden();
  await page.getByLabel("Account name").fill("Pocket cash");
  await page.getByLabel("Current balance").fill("5000");
  await page.getByRole("button", { name: "Show me how it works" }).click();
  await page.getByRole("button", { name: "Skip" }).click();
  await expect(page.getByText("Cash on hand / Cash")).toBeVisible();
});

test("CSV import waits in review and retains its narration", async ({ page }) => {
  await seed(page);
  await page.getByRole("button", { name: "Import statement" }).first().click();
  await page.getByLabel("Statement file").setInputFiles({
    name: "moniepoint-july.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("date,description,amount,type\n2026-07-19,Client transfer for poster design,7500,income")
  });
  await page.getByRole("button", { name: "Read file privately" }).click();
  await expect(page.getByText("Client transfer for poster design").first()).toBeVisible();
  await expect(page.getByText(/1 matching item/)).toBeVisible();
});

test("offline PDF worker bootstraps from file URLs", async ({ page }) => {
  await seed(page);
  const ready = await page.evaluate(async () => {
    await ensurePdfWorker();
    return Boolean(globalThis.pdfjsWorker?.WorkerMessageHandler);
  });
  expect(ready).toBeTruthy();
});

test("offline PDF reader opens the personal statement", async ({ page }) => {
  await seed(page);
  await page.getByRole("button", { name: "Import statement" }).first().click();
  const statement = path.resolve(__dirname, "..", "Statements", "Moniepoint Personal and Business", "Moniepoint-Document-2026-06-29T01-09.pdf");
  await page.getByLabel("Statement file").setInputFiles(statement);
  const pages = await page.evaluate(async () => {
    await ensurePdfWorker();
    const file = document.querySelector('input[name="file"]').files[0];
    const task = pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false, useWorkerFetch: false });
    const pdfDocument = await Promise.race([task.promise, new Promise((_, reject) => setTimeout(() => reject(new Error("PDF open timeout")), 20000))]);
    return pdfDocument.numPages;
  });
  expect(pages).toBe(5);
});

test("offline PDF parser extracts personal statement rows", async ({ page }) => {
  await seed(page);
  await page.getByRole("button", { name: "Import statement" }).first().click();
  const statement = path.resolve(__dirname, "..", "Statements", "Moniepoint Personal and Business", "Moniepoint-Document-2026-06-29T01-09.pdf");
  await page.getByLabel("Statement file").setInputFiles(statement);
  const parsed = await page.evaluate(async () => {
    const file = document.querySelector('input[name="file"]').files[0];
    const rows = await Promise.race([parseStatement(file, "a1"), new Promise((_, reject) => setTimeout(() => reject(new Error("PDF parse timeout")), 30000))]);
    return { count: rows.length, hasNarration: rows.some(row => row.rawDescription && row.description) };
  });
  expect(parsed.count).toBeGreaterThan(10);
  expect(parsed.hasNarration).toBeTruthy();
});

test("offline PDF parser extracts business statement rows", async ({ page }) => {
  test.setTimeout(120000);
  await seed(page);
  await page.getByRole("button", { name: "Import statement" }).first().click();
  const statement = path.resolve(__dirname, "..", "Statements", "Moniepoint Personal and Business", "Moniepoint-Document-2026-06-29T01-39.pdf");
  await page.getByLabel("Statement file").setInputFiles(statement);
  const parsed = await page.evaluate(async () => {
    const file = document.querySelector('input[name="file"]').files[0];
    const rows = await parseStatement(file, "a1");
    return { count: rows.length, narrated: rows.filter(row => row.rawDescription && row.description).length };
  });
  expect(parsed.count).toBeGreaterThan(100);
  expect(parsed.narrated).toBe(parsed.count);
});

test("full backup contains the complete beta state", async ({ page }) => {
  await seed(page, { goal: { id: "g1", name: "Reserve", currency: "NGN", target: 50000, saved: 5000, due: "2026-12-31" } });
  await page.getByRole("button", { name: "More" }).first().click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Full backup" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toContain("finmax-full-backup");
  const stateValue = await page.evaluate(() => JSON.parse(localStorage.getItem("finmax_beta_v1")));
  expect(stateValue.goal.name).toBe("Reserve");
  expect(stateValue.accounts).toHaveLength(1);
});

test("visual surfaces render in desktop dark and mobile light", async ({ page }) => {
  await seed(page, { transactions: [{ id: "t1", date: "2026-07-19", description: "Design deposit", category: "Income", accountId: "a1", type: "income", amount: 12000, source: "Manual" }] });
  await page.screenshot({ path: "test-results/beta-v1-desktop-light.png", fullPage: true });
  await page.getByRole("button", { name: "Dark" }).first().click();
  await page.screenshot({ path: "test-results/beta-v1-desktop-dark.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Light" }).first().click();
  await page.screenshot({ path: "test-results/beta-v1-mobile-light.png", fullPage: true });
});

test("transfer integrity requires a different destination account", async ({ page }) => {
  await seed(page, { accounts: [
    { id: "a1", name: "Daily", institution: "Moniepoint", type: "Fintech account", currency: "NGN", balance: 25000 },
    { id: "a2", name: "Reserve", institution: "Bank", type: "Bank account", currency: "NGN", balance: 5000 }
  ] });
  await page.getByRole("button", { name: /Log money/ }).first().click();
  await page.getByLabel("What happened?").selectOption("transfer");
  await page.getByLabel("Amount").fill("1000");
  await page.getByLabel("Category").fill("Own transfer");
  await page.getByLabel("Description").fill("Move to reserve");
  await page.getByRole("button", { name: "Save transaction" }).click();
  await expect(page.getByText("Choose the account receiving this transfer")).toBeVisible();
  await page.getByLabel(/Destination account/).selectOption("a2");
  await page.getByRole("button", { name: "Save transaction" }).click();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("finmax_beta_v1")));
  expect(saved.accounts.find(account => account.id === "a1").balance).toBe(24000);
  expect(saved.accounts.find(account => account.id === "a2").balance).toBe(6000);
});

test("learned categorization uses a stable narration signature", async ({ page }) => {
  await seed(page, { reviewQueue: [
    { id: "r1", date: "2026-07-18", description: "ACME SCHOOL TRANSPORT", rawDescription: "NIP TRANSFER ACME SCHOOL TRANSPORT REF 123456789", amount: 1200, accountId: "a1", type: "expense", category: "", sourceFile: "statement.pdf", fingerprint: "one" },
    { id: "r2", date: "2026-07-19", description: "ACME SCHOOL TRANSPORT", rawDescription: "NIP TRANSFER ACME SCHOOL TRANSPORT REF 987654321", amount: 1500, accountId: "a1", type: "expense", category: "", sourceFile: "statement.pdf", fingerprint: "two" }
  ] });
  await page.getByRole("button", { name: /Review/ }).first().click();
  await page.getByText("ACME SCHOOL TRANSPORT").first().click();
  await page.getByRole("button", { name: "Change" }).first().click();
  await page.getByLabel("Category").fill("Transport");
  await page.getByRole("button", { name: "Save suggestion" }).click();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("finmax_beta_v1")));
  expect(saved.rules[0].signature).toEqual(expect.arrayContaining(["acme", "school", "transport"]));
  await expect(page.getByText(/Transport \/ 96%/).first()).toBeVisible();
});
