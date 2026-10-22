const assert=require("node:assert/strict");
const {deflateRawSync}=require("node:zlib");
const {parseLines,parseAmount,normalizeDate,parseStatementSummary,parseXlsxParts,parseMoniepointPdf,parseWalletPdf,readXlsx,readPdf}=require("../statement-reader.js");

assert.equal(parseAmount("₦1,234,567.89"),1234567.89);
assert.equal(parseAmount("(1.234,56)"),-1234.56);
assert.equal(normalizeDate("16/10/2026"),"2026-10-16");
assert.equal(normalizeDate("09/16/2026",true),"2026-09-16");
assert.equal(normalizeDate("31/02/2026"),"");

function makeZip(files){
  const locals=[],central=[];let offset=0;
  for(const[name,text]of Object.entries(files)){
    const nameBytes=Buffer.from(name),data=Buffer.from(text),compressed=deflateRawSync(data),local=Buffer.alloc(30),directory=Buffer.alloc(46);
    local.writeUInt32LE(0x04034b50,0);local.writeUInt16LE(20,4);local.writeUInt16LE(0x0800,6);local.writeUInt16LE(8,8);local.writeUInt32LE(compressed.length,18);local.writeUInt32LE(data.length,22);local.writeUInt16LE(nameBytes.length,26);
    locals.push(local,nameBytes,compressed);
    directory.writeUInt32LE(0x02014b50,0);directory.writeUInt16LE(20,4);directory.writeUInt16LE(20,6);directory.writeUInt16LE(0x0800,8);directory.writeUInt16LE(8,10);directory.writeUInt32LE(compressed.length,20);directory.writeUInt32LE(data.length,24);directory.writeUInt16LE(nameBytes.length,28);directory.writeUInt32LE(offset,42);
    central.push(directory,nameBytes);offset+=local.length+nameBytes.length+compressed.length;
  }
  const centralSize=central.reduce((size,part)=>size+part.length,0),end=Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(Object.keys(files).length,8);end.writeUInt16LE(Object.keys(files).length,10);end.writeUInt32LE(centralSize,12);end.writeUInt32LE(offset,16);
  return Buffer.concat([...locals,...central,end]);
}
const xlsxParts={
  "xl/workbook.xml":'<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Statement" sheetId="1" r:id="rId1"/></sheets></workbook>',
  "xl/_rels/workbook.xml.rels":'<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>',
  "xl/sharedStrings.xml":'<sst><si><t>Date</t></si><si><t>Description</t></si><si><t>Amount</t></si><si><t>Direction</t></si><si><t>Reference</t></si><si><t>Client &amp; Co</t></si><si><t>Credit</t></si><si><t>ref-001</t></si></sst>',
  "xl/styles.xml":'<styleSheet><numFmts count="1"><numFmt numFmtId="164" formatCode="yyyy-mm-dd"/></numFmts><cellXfs count="2"><xf numFmtId="0"/><xf numFmtId="164"/></cellXfs></styleSheet>',
  "xl/worksheets/sheet1.xml":'<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Wallet Account Statement</t></is></c></row><row r="4"><c r="A4" t="inlineStr"><is><t>Total Debit</t></is></c><c r="B4"><v>1234.5</v></c><c r="C4" t="inlineStr"><is><t>Total Credit</t></is></c><c r="D4"><v>1234.5</v></c></row><row r="7"><c r="A7" t="s"><v>0</v></c><c r="B7" t="s"><v>1</v></c><c r="C7" t="s"><v>2</v></c><c r="D7" t="s"><v>3</v></c><c r="E7" t="s"><v>4</v></c></row><row r="8"><c r="A8" s="1"><v>46311</v></c><c r="B8" t="inlineStr"><is><t>Client &amp; Co</t></is></c><c r="C8"><v>1234.5</v></c><c r="D8" t="s"><v>6</v></c><c r="E8" t="s"><v>7</v></c></row><row r="9"></row></sheetData></worksheet>'
};
const parsedWorkbook=parseXlsxParts(xlsxParts);
assert.equal(parsedWorkbook[1][0],"2026-10-16");
assert.equal(parsedWorkbook[1][1],"Client & Co");
assert.equal(parsedWorkbook[1][2],"1234.5");
assert.equal(parsedWorkbook[1][3],"Credit");
assert.equal(parsedWorkbook[1][4],"ref-001");
assert.equal(parsedWorkbook[1].sourceRow,8);
assert.equal(parsedWorkbook.length,2);
assert.deepEqual(parsedWorkbook.summary,{moneyIn:1234.5,moneyOut:1234.5});

const sampleLines=[
  "Account Statement",
  "Total Money In ₦158,742.61 Statement Period 09/16/2026 - 10/16/2026",
  "Total Money Out ₦292,013.42",
  "Transaction Date Transaction Detail Money In (NGN) Money Out (NGN) Transaction ID",
  "10/16/2026 07:02:37 AM Trial Cash Interest +0.35 u83cem6z381d",
  "10/15/2026 03:09:11 PM Send to DOMINION CLINTON -500.00 033cde1xf301",
  "10/15/2026 03:08:52 PM Spend & Save Withdraw +500.00 v33cde1e7801",
  "10/13/2026 04:53:09 PM Send to DOMINION",
  "CHINECHEREM CLINTON-4,200.00 033c9tj7d101",
  "10/07/2026 09:18:24 AM Stamp Duty -50.002026",
  "6525172"
];
const rows=parseLines(sampleLines);
assert.equal(rows.length,5);
assert.deepEqual(rows.map(row=>row.date),[
  "2026-10-16","2026-10-15","2026-10-15","2026-10-13","2026-10-07"
]);
assert.equal(rows[0].time,"07:02:37 AM");
assert.equal(rows[0].description,"Trial Cash Interest");
assert.equal(rows[0].amount,.35);
assert.equal(rows[0].type,"income");
assert.equal(rows[0].reference,"u83cem6z381d");
assert.equal(rows[1].amount,500);
assert.equal(rows[1].type,"transfer");
assert.equal(rows[2].type,"transfer");
assert.equal(rows[3].description,"Send to DOMINION CHINECHEREM CLINTON");
assert.equal(rows[3].amount,4200);
assert.equal(rows[3].reference,"033c9tj7d101");
assert.equal(rows[4].amount,50);
assert.equal(rows[4].reference,"2026");
assert.equal(rows[4].type,"expense");
assert.equal(rows[4].description,"Stamp Duty");
assert.deepEqual(parseStatementSummary(sampleLines),{
  moneyIn:158742.61,
  moneyOut:292013.42,
  period:{start:"2026-09-16",end:"2026-10-16"}
});

const rowsWithAmbiguousDates=parseLines([
  "Transaction Date Narration Amount",
  "12/10/2026 Bolt ride NGN 3,500.00 Debit",
  "13/10/2026 Client payment NGN 120,000.00 Credit"
]);
assert.equal(rowsWithAmbiguousDates.length,2);
assert.equal(rowsWithAmbiguousDates[0].date,"2026-10-12");
assert.equal(rowsWithAmbiguousDates[0].amount,3500);
assert.equal(rowsWithAmbiguousDates[0].type,"expense");
assert.equal(rowsWithAmbiguousDates[0].direction,"out");
assert.equal(rowsWithAmbiguousDates[1].type,"income");
assert.match(rowsWithAmbiguousDates[1].description,/Client payment/);

function pdfWith(items){
  const page={getTextContent:async()=>({items}),cleanup:async()=>{}};
  return{numPages:1,getPage:async()=>page,cleanup:async()=>{},destroy:async()=>{}};
}
function item(str,x,y){return{str,transform:[1,0,0,1,x,y]};}

(async()=>{
  const archive=makeZip(xlsxParts);
  const workbook=await readXlsx({arrayBuffer:async()=>archive.buffer.slice(archive.byteOffset,archive.byteOffset+archive.byteLength)});
  assert.equal(workbook.sheet,"Statement");
  assert.deepEqual(workbook.rows[1].slice(0,5),parsedWorkbook[1].slice(0,5));
  assert.deepEqual(workbook.summary,{moneyIn:1234.5,moneyOut:1234.5});

  const moniepoint=parseMoniepointPdf([
    "Total Debits 30.00","Total Credits 5.00","Date 19/10/2026 - 19/10/2026",
    "Date Narration Reference DebitCreditBalance",
    "2026-10-19T12:","10:15TRANSFER TO MERCHANT TRF|MPT|debit-ref_DEBIT_0 10.00 0.00 90.00",
    "2026-10-19T16:TRANSFER TO MERCHANT TRF|MPT|split-ref_DEBIT_0 51:39 20.00 0.00 70.00",
    "2026-10-19T17:","12:00PAYMENT CREDIT MPT|MPT|credit-ref_CREDIT_0 0.00 5.00 75.00"
  ]);
  assert.equal(moniepoint.rows.length,3);
  assert.equal(moniepoint.rows[0].time,"12:10:15");
  assert.equal(moniepoint.rows[0].amount,10);
  assert.equal(moniepoint.rows[1].time,"16:51:39");
  assert.equal(moniepoint.rows[1].reference,"TRF|MPT|split-ref_DEBIT_0");
  assert.equal(moniepoint.rows[2].direction,"in");
  assert.deepEqual(moniepoint.summary,{moneyIn:5,moneyOut:30,period:{start:"2026-10-19",end:"2026-10-19"}});
  const moniepointShortTime=parseMoniepointPdf([
    "Date Narration Reference DebitCreditBalance",
    "2026-10-19T09: POS service TP TRF|2MPT|sample-ref 75.00 0.00 425.00"
  ]);
  assert.equal(moniepointShortTime.rows.length,1);
  assert.equal(moniepointShortTime.rows[0].amount,75);
  assert.equal(moniepointShortTime.rows[0].time,"");
  assert.equal(moniepointShortTime.rows[0].confidence,.65);

  const wallet=parseWalletPdf([
    "Total Credit","₦5.00","Total Debit","₦2,100.00","Period: - 19 Sep 2026 19 Oct 2026",
    "Trans. Time Value Date Description Debit (₦) Credit (₦) Balance After (₦) Channel Transaction Reference",
    "22 Sep 2026 11:09:18 22 Sep 2026Transfer from CLIENT | Zenith | SCHOOL-- 5.00 5.00 MobileAPT000000000001",
    "22 Sep 2026 11:10:19 22 Sep 2026Transfer to POS | MONIE POINT | 5702122882 | POS service2,100.00 -- 0.00 MobileAPT000000000002",
    "1234567"
  ]);
  assert.equal(wallet.rows.length,2);
  assert.equal(wallet.rows[0].date,"2026-09-22");
  assert.equal(wallet.rows[0].description,"Transfer from CLIENT | Zenith | SCHOOL");
  assert.equal(wallet.rows[0].amount,5);
  assert.equal(wallet.rows[0].reference,"APT000000000001");
  assert.equal(wallet.rows[1].amount,2100);
  assert.equal(wallet.rows[1].direction,"out");
  assert.equal(wallet.rows[1].reference,"APT000000000002");
  assert.deepEqual(wallet.summary,{moneyIn:5,moneyOut:2100,period:{start:"2026-09-19",end:"2026-10-19"}});
  const walletWithSecondAccount=parseWalletPdf([
    "Wallet Account Period: 19 Sep 2026 - 18 Oct 2026",
    "Opening Balance Total Debit Debit Count","₦ 0.00 ₦ 39,640.00 25",
    "Closing Balance Total Credit Credit Count","₦ 0.00 ₦ 39,640.00 25",
    "Trans. Time Value Date Description Debit (₦) Credit (₦) Balance After (₦) Channel Transaction Reference",
    "22 Sep 2026 11:09:18 22 Sep 2026 -- 2,000.00 2,000.00 Mobile",
    "Trailing statement totals 23.13 20,445.30 14.78 20,031.65",
    "Savings Account Period: 19 Sep 2026 - 18 Oct 2026",
    "Trans. Time Value Date Description Debit (₦) Credit (₦) Balance After (₦) Channel Transaction Reference",
    "19 Sep 2026 00:00:00 19 Sep 2026 Interest 0.00 0.09 0.09 Mobile"
  ]);
  assert.equal(walletWithSecondAccount.rows.length,1);
  assert.equal(walletWithSecondAccount.rows[0].amount,2000);
  assert.equal(walletWithSecondAccount.rows[0].direction,"in");
  assert.equal(walletWithSecondAccount.rows[0].confidence,.6);
  assert.deepEqual(walletWithSecondAccount.summary,{moneyIn:39640,moneyOut:39640,period:{start:"2026-09-19",end:"2026-10-18"}});
  const walletWithTrailingSummary=parseWalletPdf([
    "Credit Count","1","Total Credit","₦5.00","Closing Balance","₦5.00","Debit Count","0","Total Debit","₦0.00",
    "Period: - 19 Sep 2026 19 Oct 2026","Trans. Time Value Date Description Debit (₦) Credit (₦) Balance After (₦) Channel Transaction Reference",
    "22 Sep 2026 11:09:18 22 Sep 2026 Transfer from CLIENT -- 5.00 5.00 Mobile",
    "00001526092211091741073961","6592",
    "Credit Count","1","Total Credit","₦20.00","Closing Balance","₦14.78","Debit Count","1","Total Debit","₦20.00",
    "Period: - 19 Sep 2026 18 Oct 2026Savings Account"
  ]);
  assert.equal(walletWithTrailingSummary.rows.length,1);
  assert.equal(walletWithTrailingSummary.rows[0].confidence,.9);
  assert.equal(walletWithTrailingSummary.rows[0].type,"transfer");
  assert.equal(walletWithTrailingSummary.rows[0].reference,"000015260922110917410739616592");
  assert.doesNotMatch(walletWithTrailingSummary.rows[0].raw,/Savings Account|Credit Count/);
  assert.deepEqual(walletWithTrailingSummary.summary,{moneyIn:5,moneyOut:0,period:{start:"2026-09-19",end:"2026-10-19"}});
  const walletWithVisualPdfLines=parseWalletPdf([
    "Credit Count","1","Total Credit","₦2,000.00","Debit Count","0","Total Debit","₦0.00",
    "Period: - 19 Sep 2026 19 Oct 2026","Trans. Time Value Date Description Debit (₦) Credit (₦) Balance After (₦) Channel Transaction Reference",
    "Transfer from CLIENT NAME | 00001526092211091741073961",
    "22 Sep 2026 11:09:18 22 Sep 2026 -- 2,000.00 2,000.00 Mobile",
    "Zenith Bank | 221****592 | SCHOOL"
  ]);
  assert.equal(walletWithVisualPdfLines.rows.length,1);
  assert.equal(walletWithVisualPdfLines.rows[0].description,"Transfer from CLIENT NAME");
  assert.equal(walletWithVisualPdfLines.rows[0].type,"transfer");
  assert.equal(walletWithVisualPdfLines.rows[0].reference,"00001526092211091741073961");
  assert.deepEqual(walletWithVisualPdfLines.summary,{moneyIn:2000,moneyOut:0,period:{start:"2026-09-19",end:"2026-10-19"}});

  global.document={baseURI:"http://localhost/"};
  global.pdfjsLib={
    GlobalWorkerOptions:{},
    getDocument:()=>({promise:Promise.resolve(pdfWith([
      item("Total Money In ₦0.35 Total Money Out ₦500.00 Statement Period 10/16/2026 - 10/16/2026",10,150),
      item("10/16/2026 07:02:37 AM",10,100),
      item("Trial Cash Interest",160,100),
      item("+0.35",340,100),
      item("u83cem6z381d",450,100),
      item("10/15/2026 03:09:11 PMSend to DOMINION CLINTON-500.00 033cde1xf301",10,80)
    ]))})
  };
  const ready=await readPdf({arrayBuffer:async()=>new ArrayBuffer(1)});
  assert.equal(ready.status,"ready");
  assert.equal(ready.rows.length,2);
  assert.equal(ready.rows[0].date,"2026-10-16");
  assert.equal(ready.rows[0].time,"07:02:37 AM");
  assert.equal(ready.rows[0].amount,.35);
  assert.equal(ready.rows[0].reference,"u83cem6z381d");
  assert.equal(ready.rows[0].direction,"in");
  assert.equal(ready.rows[0].currency,"NGN");
  assert.equal(ready.rows[0].page,1);
  assert.equal(ready.summary.moneyIn,.35);
  assert.equal(ready.summary.moneyOut,500);
  assert.equal(ready.reconciles,true);
  assert.deepEqual(ready.extracted,{moneyIn:.35,moneyOut:500});
  assert.equal(ready.rows[1].time,"03:09:11 PM");
  assert.equal(ready.rows[1].description,"Send to DOMINION CLINTON");
  assert.equal(ready.rows[1].amount,500);
  assert.equal(ready.rows[1].direction,"out");
  assert.equal(ready.rows[1].reference,"033cde1xf301");

  global.pdfjsLib.getDocument=()=>({promise:Promise.resolve(pdfWith([]))});
  const scanned=await readPdf({arrayBuffer:async()=>new ArrayBuffer(1)});
  assert.equal(scanned.status,"pending-ocr");
  assert.match(scanned.reason,/OCR is not enabled/);
  console.log("Statement reader tests passed.");
})().catch(error=>{console.error(error);process.exitCode=1;});
