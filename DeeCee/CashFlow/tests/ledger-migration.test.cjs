const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");

const source=fs.readFileSync(require.resolve("../app.js"),"utf8");
const declaration=source.match(/function normalizeState\(x\)\{[^\n]*\}/);
assert.ok(declaration,"app should expose its state migration function");

const setup=[
  'const fields=["accounts","tx","goals","plans","invoices","rules","imports"];',
  'const blank=()=>({accounts:[],tx:[],goals:[],plans:[],invoices:[],rules:[],imports:[]});',
  'const fresh=()=>({version:2,profile:{name:"",mode:"personal",ready:false,mixed:false},data:blank()});',
  declaration[0],
  'normalizeState'
].join("\n");
const normalize=vm.runInNewContext(setup);
const state=normalize({
  version:1,
  profile:{name:"Ada",mode:"business",ready:true},
  workspaces:{
    personal:{accounts:[{id:"a1",name:"Opay"}],tx:[{id:"t1",type:"expense",purpose:"Personal"}]},
    business:{accounts:[{id:"a2",name:"Moniepoint"}],tx:[{id:"t2",type:"expense",purpose:"Business"}]}
  }
});
assert.equal(state.version,2);
assert.equal(state.profile.mode,"business");
assert.equal(state.profile.mixed,true);
assert.equal(state.data.accounts.length,2);
assert.equal(state.data.tx.map(t=>t.purpose).join(","),"Personal,Business");
assert.ok(state.data.tx.every(t=>t.purposeSource==="workspace-default"));
const sameWorkspace=normalize({version:1,profile:{mode:"business"},workspaces:{personal:{},business:{tx:[{id:"p",purpose:"Personal"},{id:"b",purpose:"Business"}]}}});
assert.equal(sameWorkspace.profile.mixed,true);
console.log("Ledger migration tests passed.");