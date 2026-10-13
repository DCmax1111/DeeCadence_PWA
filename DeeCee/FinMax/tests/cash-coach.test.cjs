const assert=require("node:assert/strict");
const {answer}=require("../cash-coach.js");

const base={
  today:"2026-10-13",
  mode:"business",
  mixed:true,
  balance:300000,
  safeToSpend:180000,
  accountCount:2,
  transactions:[
    {date:"2026-10-02",amount:25000,type:"expense",cat:"Food",purpose:"Personal",status:"confirmed",desc:"Groceries"},
    {date:"2026-10-04",amount:40000,type:"expense",cat:"Business",purpose:"Business",status:"confirmed",desc:"Supplies"},
    {date:"2026-10-05",amount:12000,type:"expense",cat:"Needs sorting",purpose:"Needs sorting",status:"review",desc:"Unknown merchant"}
  ],
  goals:[{name:"Equipment",saved:100000,target:250000}]
};

assert.match(answer("How much did I spend personally vs for business this month?",base),/Business NGN 40,000; Personal NGN 25,000/);
assert.match(answer("How much did I spend personally this month?",base),/personal outflow: NGN 25,000/);
assert.match(answer("How much did the business spend this month?",base),/business outflow: NGN 40,000/);
assert.match(answer("What needs sorting?",base),/1 item.*Unknown merchant/);
assert.match(answer("Can I spend NGN 200,000?",base),/above the current NGN 180,000/);
assert.match(answer("How is my goal going?",base),/Equipment is at NGN 100,000 of NGN 250,000 \(40%\)/);
assert.match(answer("How much is left on my main goal?",{...base,goals:[base.goals[0],{name:"Tax reserve",saved:50000,target:200000,main:true}]}),/Tax reserve has NGN 150,000 left/);
assert.match(answer("What is my next goal checkpoint?",base),/next checkpoint for Equipment is NGN 125,000/);
assert.match(answer("How much did I spend this month?",base),/No statement history has been imported/);

const stale={...base,imports:[{status:"imported",end:"2026-08-01"}]};
assert.match(answer("How much did I spend this month?",stale),/Latest imported statement ends 2026-08-01 .*records may be behind/);

const assumptions={
  ...base,
  transactions:[{date:"2026-10-04",amount:40000,type:"expense",cat:"Business",purpose:"Business",purposeSource:"workspace-default",status:"confirmed",desc:"Supplies"}]
};
assert.match(answer("How much did I spend personally vs for business this month?",assumptions),/1 transaction\(s\) still use the default purpose/);

assert.match(answer("What needs sorting?",assumptions),/default purpose/);
const dollarGoalContext={...base,goals:[{name:"US course",saved:250,target:1000,currency:"USD",main:true,checkpoints:5}]};
assert.match(answer("How is my goal going?",dollarGoalContext),/US course is at USD 250 of USD 1,000 \(25%\)/);
assert.match(answer("How much is left on my main goal?",dollarGoalContext),/US course has USD 750 left/);
assert.match(answer("What is my next goal checkpoint?",dollarGoalContext),/next checkpoint for US course is USD 400; USD 150 to go/);

const questionContext = {
  ...base,
  today: "2026-10-13",
  accounts: [
    { id: "opay", name: "Opay", balance: 210000, asof: "2026-10-13" },
    { id: "moniepoint", name: "Moniepoint", balance: 90000 }
  ],
  goals: [
    { name: "Equipment", saved: 100000, target: 250000, main: true },
    { name: "Tax reserve", saved: 50000, target: 200000 }
  ],
  transactions: [
    { date: "2026-10-02", amount: 25000, type: "expense", cat: "Food", purpose: "Personal", status: "confirmed", desc: "Groceries", account: "opay" },
    { date: "2026-10-04", amount: 40000, type: "expense", cat: "Business", purpose: "Business", status: "confirmed", desc: "Supplies", account: "moniepoint" },
    { date: "2026-10-05", amount: 12000, type: "expense", cat: "Needs sorting", purpose: "Needs sorting", status: "review", desc: "Unknown merchant", account: "opay" },
    { date: "2026-10-07", amount: 80000, type: "income", cat: "Income", purpose: "Business", status: "confirmed", desc: "Client payment", account: "moniepoint" },
    { date: "2026-10-09", amount: 5000, type: "expense", cat: "Food", purpose: "Personal", status: "confirmed", desc: "Shoprite purchase", account: "opay" },
    { date: "2026-10-10", amount: 20000, type: "transfer", cat: "Transfer", purpose: "Transfer", status: "confirmed", desc: "Transfer between own accounts", account: "opay" },
    { date: "2026-10-11", amount: 7500, type: "expense", cat: "Transport", purpose: "Personal", status: "confirmed", desc: "Bolt ride", account: "opay" },
    { date: "2026-10-12", amount: 2000, type: "expense", cat: "Airtime & data", purpose: "Personal", status: "confirmed", desc: "Airtel data", account: "opay" },
    { date: "2026-09-12", amount: 10000, type: "expense", cat: "Bills", purpose: "Business", status: "confirmed", desc: "Office rent", account: "moniepoint" }
  ],
  plans: [
    { name: "Client retainer", amount: 100000, type: "income", date: "2026-10-18" },
    { name: "Office electricity", amount: 15000, type: "expense", date: "2026-10-20" }
  ],
  invoices: [
    { client: "Ayo Studio", amount: 120000, due: "2026-10-20", status: "sent" },
    { client: "Kemi Works", amount: 30000, due: "2026-10-01", status: "paid" }
  ],
  imports: [{ status: "imported", file: "Opay October.csv", start: "2026-10-01", end: "2026-10-12" }]
};

const likelyQuestions = [
  ["Hi...", /Hi! I can help/],
  ["Good morning", /Hi! I can help/],
  ["Thanks", /You're welcome/],
  ["Who are you?", /I'm Cash Coach/],
  ["What can you do?", /How many goals.*What did I spend/],
  ["Where is my data stored?", /local storage.*no login.*not encrypted/s],
  ["How do I import a statement?", /Choose Import statement.*Pending OCR/],
  ["Why did importing not update my balance?", /do not change account balances.*manually/],
  ["How does correcting a merchant teach sorting?", /Save & learn.*not new Coach skills/],
  ["Do you calculate how much tax I owe?", /Tax calculations are not implemented/],
  ["What does safe to spend mean?", /balances.*minus known bills.*Expected income is left out/],
  ["How many goals do I have?", /You have 2 of up to 3 goals.*Main goal: Equipment/],
  ["List my goals", /Equipment \(main\).*Tax reserve \(supporting\)/],
  ["How many more goals can I add?", /track up to 3 goals.*add 1 more/],
  ["How much is left on Tax reserve?", /Tax reserve has NGN 150,000 left/],
  ["What is my next goal checkpoint?", /next checkpoint for Equipment is NGN 125,000/],
  ["Why does the goal slider not update my savings?", /preview.*does not move money/],
  ["How many accounts do I have?", /You have 2 account\(s\).*Opay.*Moniepoint/],
  ["What is my Opay balance?", /Opay has an entered balance of NGN 210,000/],
  ["How much did I spend from Opay this month?", /Opay has NGN 0 in and NGN 39,500 out/],
  ["How much can I safely spend?", /balances less known bills.*NGN 180,000/],
  ["Can I afford NGN 200,000?", /NGN 200,000 is above the current NGN 180,000/],
  ["How much did I spend this month?", /NGN 80,000 in and NGN 79,500 out/],
  ["How much did I spend last month?", /last month.*NGN 10,000 out/],
  ["How much did I spend this week?", /this week.*NGN 0 in and NGN 2,000 out/],
  ["How much did I spend in the past 7 days?", /past 7 days.*NGN 80,000 in and NGN 14,500 out/],
  ["How many transactions this month?", /7 confirmed transaction\(s\).*1 more item/],
  ["What did I spend most on?", /largest spending category.*Business at NGN 40,000/],
  ["What was my biggest expense?", /largest confirmed expense.*Supplies at NGN 40,000/],
  ["How much did I spend at Shoprite?", /activity matching shoprite totals NGN 5,000/],
  ["Show my recent transactions", /Most recent confirmed activity.*Airtel data/],
  ["How much did I spend personally versus business this month?", /Business NGN 40,000; Personal NGN 39,500/],
  ["What expected income is coming this month?", /planned cash event\(s\) total NGN 100,000.*Client retainer/],
  ["What bills are coming up?", /planned cash event\(s\) total NGN 15,000.*Office electricity/],
  ["How many invoices are unpaid?", /1 unpaid invoice\(s\).*NGN 120,000/],
  ["Do I have any overdue invoices?", /no overdue unpaid invoices/],
  ["When was my last statement imported?", /Opay October.csv.*2026-10-12/],
  ["How up to date is my history?", /Latest imported statement ends 2026-10-12/],
  ["Do transfers count as spending?", /Transfers are kept separate from income and spending/],
  ["What strange question should I ask?", /do not have a reliable answer.*What can you do/]
];
for (const [question, expected] of likelyQuestions) {
  assert.match(answer(question, questionContext), expected, "Question: " + question);
}
assert.match(answer("How many goals do I have?", { ...questionContext, goals: [] }), /You have 0 of up to 3 goals/);
assert.match(answer("What needs sorting?", questionContext), /1 item.*Unknown merchant \(NGN 12,000\)/);
assert.match(answer("How much did I spend on food this month?", questionContext), /food outflow: NGN 30,000/);
const confusionQuestions = [
  ["How do I add a goal?", /Open Goals and choose Add goal/],
  ["How do I update goal progress?", /choose Add or Subtract.*Edit goal/],
  ["What does a checkpoint mean?", /progress marker.*3-6 evenly spaced stages.*last is always 100%/],
  ["Can I have more than 3 goals?", /track up to 3 goals at a time/],
  ["How do I add an account?", /Choose \+ Account.*current balance/],
  ["Why is my history behind?", /Latest imported statement ends 2026-10-12.*Import the missed statement/],
  ["What does Pending OCR mean?", /looks scanned.*OCR is not available yet/],
  ["Does Cash Coach learn from my chat?", /does not learn new language skills/],
  ["How does Personal vs Business work?", /Personal or Business sets the main view.*mixed-use sorting/],
  ["Why is expected income not in my account balance?", /Expected income is a plan.*not added to account balances/],
  ["Where does my money go?", /largest spending category.*Business at NGN 40,000/],
  ["Does Cashflow connect to my bank?", /does not connect to bank or wallet accounts/],
  ["Can I use USD?", /Goals can be set in NGN or USD.*does not convert/],
  ["How do I mark an invoice paid?", /choose Mark paid.*does not change an account balance/]
];
for (const [question, expected] of confusionQuestions) {
  assert.match(answer(question, questionContext), expected, "Confusion question: " + question);
}
console.log("Cash Coach tests passed: " + (likelyQuestions.length + confusionQuestions.length) + " likely questions plus edge cases.");