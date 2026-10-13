const assert=require("node:assert/strict");
const {parseLines,readPdf}=require("../statement-reader.js");

const rows=parseLines([
  "Transaction Date Narration Amount",
  "12/10/2026 Bolt ride NGN 3,500.00 Debit",
  "13/10/2026 Client payment NGN 120,000.00 Credit"
]);
assert.equal(rows.length,2);
assert.equal(rows[0].amount,3500);
assert.equal(rows[0].type,"expense");
assert.equal(rows[1].type,"income");
assert.match(rows[1].description,/Client payment/);

function pdfWith(items){
  const page={
    getTextContent:async()=>({items}),
    cleanup:async()=>{}
  };
  return {
    numPages:1,
    getPage:async()=>page,
    cleanup:async()=>{},
    destroy:async()=>{}
  };
}
function item(str,x,y){return{str,transform:[1,0,0,1,x,y]};}

(async()=>{
  global.document={baseURI:"http://localhost/"};
  global.pdfjsLib={
    GlobalWorkerOptions:{},
    getDocument:()=>({promise:Promise.resolve(pdfWith([
      item("12/10/2026",10,100),
      item("Bolt ride",80,100),
      item("NGN 3,500.00",220,100)
    ]))})
  };
  const ready=await readPdf({arrayBuffer:async()=>new ArrayBuffer(1)});
  assert.equal(ready.status,"ready");
  assert.equal(ready.rows.length,1);
  assert.equal(ready.rows[0].amount,3500);
  assert.match(ready.rows[0].description,/Bolt ride/);

  global.pdfjsLib.getDocument=()=>({promise:Promise.resolve(pdfWith([]))});
  const scanned=await readPdf({arrayBuffer:async()=>new ArrayBuffer(1)});
  assert.equal(scanned.status,"pending-ocr");
  assert.match(scanned.reason,/OCR is not enabled/);
  console.log("Statement reader tests passed.");
})().catch(error=>{console.error(error);process.exitCode=1;});