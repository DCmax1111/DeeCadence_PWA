const { test, expect } = require("@playwright/test");
const { pathToFileURL } = require("url");
const path = require("path");
const fs = require("fs");

const appUrl = pathToFileURL(path.resolve(__dirname, "..", "index.html")).href;

const baseState = {
  profile: {
    name: "FinMax Tester",
    username: "tester",
    currency: "NGN",
    mode: "everyday",
    theme: "light",
    accent: "green",
    privacy: false,
    density: 1,
    monthlyBudget: 350000,
    reserveTarget: 250000,
    fxUsdNgn: 1500,
    onboarded: true,
    tutorialDone: true
  },
  accounts: [
    { id: "a1", name: "Wallet One", institution: "Test Bank", kind: "Personal", type: "Bank", balance: 25000, color: "#176b5b" },
    { id: "a2", name: "Wallet Two", institution: "Test Wallet", kind: "Personal", type: "Mobile money", balance: 9000, color: "#356bd6" }
  ],
  transactions: [
    { id: "t1", date: "2026-07-09", name: "A deliberately long grocery description that must fold cleanly on a narrow phone", category: "Food", account: "Wallet One", accountId: "a1", type: "expense", amount: 2300 }
  ],
  reviewQueue: [
    { id: "r1", date: "2026-07-08", name: "Incoming wallet movement", rawDescription: "TRANSFER CREDIT FROM SECOND WALLET REF 88319", suggestedCategory: "Transfer Review", suggestedType: "transfer", accountId: "a1", amount: 5000, sourceFile: "wallet-one.pdf" },
    { id: "r2", date: "2026-07-08", name: "Different narration entirely", rawDescription: "OUTWARD PAYMENT REFERENCE 99102", suggestedCategory: "Transfer Review", suggestedType: "transfer", accountId: "a2", amount: 5000, sourceFile: "wallet-two.pdf" }
  ],
  goals: [{ id: "g1", name: "Emergency fund", type: "Safety", currency: "NGN", target: 100000, saved: 25000, due: "2026-12-31", priority: 1, editsUsed: 0, editLimit: 3 }],
  incomePaths: [{ id: "p1", name: "Design service", currency: "NGN", offer: 50000, plannedSales: 5, sold: 2, hoursPerSale: 4, monthlyCapacity: 5, status: "Selling", salesLog: [{ price: 50000 }] }],
  assets: [{ id: "asset1", name: "Investment", type: "Investment", value: 12000 }],
  liabilities: [{ id: "liability1", name: "Debt", type: "Loan", value: 4000 }],
  loans: [{ id: "loan1", name: "Loan", balance: 4000, original: 5000, payment: 1000 }],
  loansGiven: [{ id: "given1", name: "Receivable", balance: 2000, original: 3000, payment: 500 }],
  monthly: [{ m: "Jul", income: 10000, expense: 2300 }]
};

async function openApp(page, state = baseState) {
  await page.addInitScript(({ state }) => {
    localStorage.setItem("finmax_offline_v5", JSON.stringify(state));
    localStorage.setItem("finmax_user_database_v1", JSON.stringify({ users: [{ id: "u1", username: "tester", displayName: "FinMax Tester", passwordHash: "test" }] }));
    sessionStorage.setItem("finmax_session", "yes");
    sessionStorage.setItem("finmax_user_id", "u1");
  }, { state });
  await page.goto(appUrl);
  await expect(page.locator(".everyday-home")).toBeVisible();
}

test("Everyday Money hub and quick capture render", async ({ page }) => {
  await openApp(page);
  await page.locator('.sidebar [data-view="money"]').click();
  await expect(page.locator(".money-hub")).toBeVisible();
  await page.getByRole("button", { name: /Expense/ }).first().click();
  await expect(page.locator('form[data-form="transaction"] input[name="amount"]')).toBeFocused();
});

test("reset clears financial values but preserves structure", async ({ page }) => {
  await openApp(page);
  await page.getByRole("button", { name: "More" }).click();
  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "Reset financial values" }).click();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("finmax_offline_v5")));
  expect(saved.accounts.every(account => account.balance === 0)).toBeTruthy();
  expect(saved.transactions).toHaveLength(0);
  expect(saved.reviewQueue).toHaveLength(0);
  expect(saved.goals[0].saved).toBe(0);
  expect(saved.incomePaths[0].sold).toBe(0);
  expect(saved.assets[0].value).toBe(0);
  expect(saved.liabilities[0].value).toBe(0);
  expect(saved.loans[0].balance).toBe(0);
  expect(saved.loansGiven[0].balance).toBe(0);
  expect(saved.monthly[0].income).toBe(0);
  expect(saved.monthly[0].expense).toBe(0);
  expect(saved.incomePaths[0].name).toBe("Design service");
  expect(saved.profile.name).toBe("FinMax Tester");
});

test("simple and full exports have distinct scopes", async ({ page }) => {
  await openApp(page);
  await page.getByRole("button", { name: "More" }).click();
  const simpleDownload = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Simple ledger export" }).click()
  ]).then(([download]) => download);
  const simplePath = await simpleDownload.path();
  const simple = JSON.parse(fs.readFileSync(simplePath, "utf8"));
  expect(simple.kind).toBe("finmax-simple-ledger");
  expect(simple.transactions).toHaveLength(1);
  expect(simple.goals).toBeUndefined();

  const fullDownload = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Full workspace backup" }).click()
  ]).then(([download]) => download);
  const fullPath = await fullDownload.path();
  const full = JSON.parse(fs.readFileSync(fullPath, "utf8"));
  expect(full.kind).toBe("finmax-full-backup");
  expect(full.state.goals[0].name).toBe("Emergency fund");
  expect(full.state.incomePaths[0].name).toBe("Design service");
  expect(full.manifest.goals).toBe(1);
});

test("full backup restores the workspace after reset", async ({ page }) => {
  await openApp(page);
  await page.getByRole("button", { name: "More" }).click();
  const download = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Full workspace backup" }).click()
  ]).then(([item]) => item);
  const backupPath = await download.path();

  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "Reset financial values" }).click();
  await page.locator("#importFile").setInputFiles(backupPath);
  await expect(page.locator(".toast", { hasText: "Full workspace restored" })).toBeVisible();

  const restored = await page.evaluate(() => JSON.parse(localStorage.getItem("finmax_offline_v5")));
  expect(restored.accounts[0].balance).toBe(25000);
  expect(restored.goals[0].saved).toBe(25000);
  expect(restored.incomePaths[0].sold).toBe(2);
  expect(restored.transactions[0].name).toContain("grocery description");
  expect(restored.reviewQueue[0].rawDescription).toContain("TRANSFER CREDIT");
});

test("transfer matching ignores names and prioritizes amount and date", async ({ page }) => {
  await openApp(page);
  const result = await page.evaluate(() => {
    const pairs = transferMatches(5);
    return pairs.map(pair => pair.map(item => item.id));
  });
  expect(result).toContainEqual(["r1", "r2"]);
});

test("PDF narration survives preview serialization", async ({ page }) => {
  await openApp(page);
  const result = await page.evaluate(() => {
    const rows = statementRowsFromText("2026-07-02 Data bundle payment to MTN NGN 500.00", "a1", "sample.pdf");
    const csv = importRowsAsCsv(rows);
    const restored = parseImportRows(csv, "a1", "sample.pdf");
    return restored[0];
  });
  expect(result.name).toContain("Data bundle payment");
  expect(result.rawDescription).toContain("2026-07-02 Data bundle payment");
  expect(result.sourceFile).toBe("sample.pdf");
});

test("actual Moniepoint PDF produces review rows with narration", async ({ page }) => {
  await openApp(page);
  const statement = path.resolve(__dirname, "..", "Statements", "Moniepoint Personal and Business", "Moniepoint-Document-2026-06-29T01-09.pdf");
  await page.locator('.sidebar [data-view="money"]').click();
  await page.locator('.money-tool-list [data-open="importWizard"]').click();
  await page.locator("[data-statement-file]").setInputFiles(statement);
  await expect(page.locator("[data-import-status]")).toContainText(/[1-9]\d* possible transaction rows found/);
  const preview = await page.locator("[data-import-rows]").inputValue();
  expect(preview).toContain("rawDescription");
  expect(preview).toContain("Use this wisely");
  expect(preview.length).toBeGreaterThan(200);
});

test("Maxwell types its answer progressively without stretching the chat card", async ({ page }) => {
  await openApp(page);
  await page.locator('[data-view="advisor"]').first().click();
  const input = page.locator('form[data-form="maxwell"] input[name="question"]');
  await input.fill("Which account needs attention?");
  await page.locator('form[data-form="maxwell"] button').click();
  await expect(page.locator(".maxwell-message.typing .typing-dots")).toBeVisible();
  await expect(page.locator(".maxwell-message.typing .maxwell-typed-text")).toHaveText(/\S+/, { timeout: 2000 });
  await expect(page.locator(".maxwell-message.typing")).toHaveCount(0, { timeout: 8000 });
  const alignment = await page.locator(".maxwell-grid").evaluate(element => getComputedStyle(element).alignItems);
  expect(alignment).toBe("start");
});

test("Everyday and transaction history do not overflow a phone viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openApp(page);
  await page.locator('.mobile-nav [data-view="money"]').click();
  await page.getByRole("button", { name: /Transaction history/ }).click();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await expect(page.locator(".tx-card").first()).toBeVisible();
});
