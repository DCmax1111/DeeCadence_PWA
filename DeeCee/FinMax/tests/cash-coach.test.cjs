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
assert.match(answer("How much did I spend this month?",base),/No statement history has been imported/);

const stale={...base,imports:[{status:"imported",end:"2026-08-01"}]};
assert.match(answer("How much did I spend this month?",stale),/Latest imported statement ends 2026-08-01 .*records may be behind/);

const assumptions={
  ...base,
  transactions:[{date:"2026-10-04",amount:40000,type:"expense",cat:"Business",purpose:"Business",purposeSource:"workspace-default",status:"confirmed",desc:"Supplies"}]
};
assert.match(answer("How much did I spend personally vs for business this month?",assumptions),/1 transaction\(s\) still use the default purpose/);

assert.match(answer("What needs sorting?",assumptions),/default purpose/);
console.log("Cash Coach tests passed.");