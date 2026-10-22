(function(root){"use strict";
const datePattern=/\b(?:20\d{2}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}|\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{2,4})\b/i;
const timePattern=/\b\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?\b/ig;
const amountPattern=/(?:(?<![A-Za-z0-9])(?:NGN|N|₦|USD|\$)\s*)?([+-]\s*\(?\d[\d,]*(?:\.\d{1,2})?\)?|\(?\d[\d,]*(?:\.\d{1,2})?\)?)/gi;

function normalizeDate(value,monthFirst){
  const input=String(value||"").trim(),match=input.match(datePattern);
  if(!match)return"";
  let year,month,day,pieces;
  if((pieces=match[0].match(/^(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})$/))){
    year=+pieces[1];month=+pieces[2];day=+pieces[3];
  }else if((pieces=match[0].match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/))){
    const first=+pieces[1],second=+pieces[2];year=+pieces[3];if(year<100)year+=2000;
    if(first>12){day=first;month=second;}else if(second>12||monthFirst){month=first;day=second;}else{day=first;month=second;}
  }else if((pieces=match[0].match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{2,4})$/))){
    const months={jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};
    day=+pieces[1];month=months[pieces[2].slice(0,3).toLowerCase()];year=+pieces[3];if(year<100)year+=2000;
  }
  if(!year||!month||!day||month>12||day>31)return"";
  const result=new Date(Date.UTC(year,month-1,day));
  return result.getUTCFullYear()===year&&result.getUTCMonth()===month-1&&result.getUTCDate()===day
    ?String(year).padStart(4,"0")+"-"+String(month).padStart(2,"0")+"-"+String(day).padStart(2,"0"):"";
}
function parseAmount(value){
  const text=String(value||"").trim(),negative=text.includes("-")||/^\(.*\)$/.test(text);
  let digits=text.replace(/[^\d.,]/g,"");
  if(digits.includes(".")&&digits.includes(",")){
    digits=digits.lastIndexOf(",")>digits.lastIndexOf(".")
      ?digits.replace(/\./g,"").replace(",",".")
      :digits.replace(/,/g,"");
  }else if((digits.match(/,/g)||[]).length>1||/,\d{3}$/.test(digits)){
    digits=digits.replace(/,/g,"");
  }else digits=digits.replace(",",".");
  const amount=Number(digits);
  return Number.isFinite(amount)&&amount>0?(negative?-amount:amount):0;
}
function transactionType(description,signedAmount){
  if(/(?:own account|between accounts|spend\s*&\s*save\s+(?:deposit|withdraw|transfer)|savings? (?:deposit|withdraw|transfer)|transfer (?:to|from) (?:my|own)|\btransfer\s+(?:to|from)\b|internal transfer|send to\b|auto-save to owealth|owealth withdrawal|safebox deposit)/i.test(description))return"transfer";
  if(/\b(?:debit|withdraw(?:al)?|money out|outflow|paid|purchase)\b/i.test(description))return"expense";
  if(/\b(?:credit|deposit|money in|inflow|received)\b/i.test(description))return"income";
  return signedAmount<0?"expense":"income";
}
function parseLines(lines,monthFirstOverride){
  const blocks=[];let current="",monthFirst=false;
  for(const line of lines||[]){
    const dates=String(line||"").match(/\b\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}\b/g)||[];
    for(const value of dates){const parts=value.split(/[-/.]/).map(Number);if(parts[0]<=12&&parts[1]>12)monthFirst=true;}
  }
  if(typeof monthFirstOverride==="boolean")monthFirst=monthFirstOverride;
  (lines||[]).forEach(line=>{
    const text=String(line||"").replace(/\s+/g," ").trim();if(!text)return;
    if(/statement period|total money in|total money out|account statement/i.test(text)){if(current)blocks.push(current);current="";return;}
    if(datePattern.test(text)){
      if(current)blocks.push(current);
      current=text;
    }else if(current&&!/^\d{1,8}$/.test(text)&&!/^(opening|closing|statement period|account number|transaction date|date\s+narration)/i.test(text)){
      current+=" "+text;
    }
  });
  if(current)blocks.push(current);
  return blocks.map(block=>{
    const match=block.match(datePattern);if(!match)return null;
    const date=normalizeDate(match[0],monthFirst);if(!date)return null;
    const normalizedBlock=block.replace(/(\d{1,2}:\d{2}(?::\d{2})?)\s*(AM|PM)/ig,"$1 $2 ");
    const time=(normalizedBlock.match(/\b\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?\b/i)||[""])[0].trim();
    let remainder=normalizedBlock.replace(match[0]," ").replace(timePattern," ").replace(/\s+/g," ").trim();
    let reference="";
    const attachedReference=remainder.match(/([+-]\s*\d[\d,]*\.\d{2})([A-Za-z0-9_-]{4,})(?=\s|$)/);
    if(attachedReference){reference=attachedReference[2];remainder=remainder.slice(0,attachedReference.index)+attachedReference[1]+remainder.slice(attachedReference.index+attachedReference[0].length);}
    const referenceMatch=remainder.match(/\s+([A-Za-z0-9_-]{9,})(?:\s+\d{1,2})*\s*$/);
    if(referenceMatch){reference=reference||referenceMatch[1];remainder=remainder.slice(0,referenceMatch.index).trim();}
    const directionHint=(remainder.match(/\s+(debit|credit|money in|money out)\s*$/i)||[])[1]||"";
    remainder=remainder.replace(/\s+(?:debit|credit|money in|money out)\s*$/i,"").trim();
    remainder=remainder.replace(/\s+\d{1,2}(?:\s+\d{1,2})*\s*$/,"").trim();
    const amounts=[...remainder.matchAll(amountPattern)].map(item=>({
      raw:item[0],value:Math.abs(parseAmount(item[1])),signed:/[+-]|\(/.test(item[1])
    })).filter(item=>item.value>0);
    if(!amounts.length)return null;
    const signedAmounts=amounts.filter(item=>item.signed);
    const selected=signedAmounts.length===1?signedAmounts[0]:amounts.length===1?amounts[0]:null;
    if(!selected)return null;
    const position=remainder.lastIndexOf(selected.raw);
    const description=(remainder.slice(0,position)+" "+remainder.slice(position+selected.raw.length))
      .replace(/\s+/g," ").trim().replace(/^[|,\s]+|[|,\s]+$/g,"");
    if(!description||description.length<2||/^(transaction date|transaction detail|opening balance|closing balance)$/i.test(description))return null;
    const signedAmount=/\(/.test(selected.raw)?-selected.value:/-/.test(selected.raw)?-selected.value:/\+/.test(selected.raw)?selected.value:selected.value;
    return{
      date,time,description:description.slice(0,180),amount:selected.value,
      type:transactionType(description+" "+directionHint,signedAmount),direction:/debit|money out/i.test(directionHint)||signedAmount<0?"out":"in",reference,currency:/₦|\bNGN\b/i.test(block)?"NGN":/\$|\bUSD\b/i.test(block)?"USD":"",
      raw:block,confidence:selected.signed ? .9 : .7
    };
  }).filter(Boolean);
}
function parseStatementSummary(lines){
  const text=(lines||[]).join(" ").replace(/\s+/g," ");
  const moneyIn=text.match(/(?:Total Money In|Total Credits|Total Credit)\s*[:₦N\s]*([\d,]+(?:\.\d{1,2})?)/i);
  const moneyOut=text.match(/(?:Total Money Out|Total Debits|Total Debit)\s*[:₦N\s]*([\d,]+(?:\.\d{1,2})?)/i);
  const period=text.match(/Statement Period\s+(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})\s*[-–]\s*(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})/i);
  return{
    moneyIn:moneyIn?parseAmount(moneyIn[1]):null,
    moneyOut:moneyOut?parseAmount(moneyOut[1]):null,
    period:period?{start:normalizeDate(period[1],true),end:normalizeDate(period[2],true)}:null
  };
}
function xmlAttribute(attributes,name){
  const escaped=name.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),match=attributes.match(new RegExp("(?:^|\\s)"+escaped+"\\s*=\\s*(['\"])(.*?)\\1","i"));
  return match?xmlDecode(match[2]):"";
}
function xmlDecode(value){
  return String(value||"").replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi,(entity,code)=>{
    if(code[0]==="#"){
      const number=code[1].toLowerCase()==="x"?parseInt(code.slice(2),16):parseInt(code.slice(1),10);
      return Number.isFinite(number)?String.fromCodePoint(number):entity;
    }
    return{amp:"&",lt:"<",gt:">",quot:'"',apos:"'"}[code.toLowerCase()];
  });
}
function xmlElements(xml,name){
  const escaped=name.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),pattern=new RegExp("<(?:[\\w.-]+:)?"+escaped+"\\b([^>]*?)(?:\\/\\s*>|>([\\s\\S]*?)<\\/(?:[\\w.-]+:)?"+escaped+"\\s*>)","gi"),items=[];
  let match;
  while((match=pattern.exec(xml)))items.push({attributes:match[1],body:match[2]||""});
  return items;
}
function xmlText(xml){
  return[...String(xml||"").matchAll(/<(?:[\w.-]+:)?t\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?t\s*>/gi)]
    .map(item=>xmlDecode(item[1])).join("");
}
function columnNumber(reference){
  const letters=(String(reference||"").match(/^[A-Z]+/i)||[""])[0].toUpperCase();let value=0;
  for(const letter of letters)value=value*26+letter.charCodeAt(0)-64;
  return value-1;
}
function excelDate(serial){
  const value=Number(serial);
  if(!Number.isFinite(value)||value<1||value>2958465)return"";
  const date=new Date(Date.UTC(1899,11,30)+Math.floor(value)*86400000);
  return date.toISOString().slice(0,10);
}
function dateStyles(styles){
  if(!styles)return new Set();
  const custom=new Map();
  for(const item of xmlElements(styles,"numFmt")){
    custom.set(+xmlAttribute(item.attributes,"numFmtId"),xmlAttribute(item.attributes,"formatCode"));
  }
  const builtIn=new Set([14,15,16,17,18,19,20,21,22,27,28,29,30,31,32,33,34,35,36,45,46,47,50,51,52,53,54,55,56,57,58]);
  const cellXfs=(xmlElements(styles,"cellXfs")[0]||{}).body||"";
  return new Set([...cellXfs.matchAll(/<(?:[\w.-]+:)?xf\b([^>]*)\/?>/gi)].map((item,index)=>{
    const id=+xmlAttribute(item[1],"numFmtId"),format=custom.get(id)||"";
    return builtIn.has(id)||/[ydhs]/i.test(format.replace(/"[^"]*"/g,"").replace(/\\./g,""))
      ?index:-1;
  }).filter(index=>index>=0));
}
function parseWorksheet(xml,sharedStrings,styles){
  const dateStyleIndices=dateStyles(styles),rows=[];
  for(const row of String(xml||"").matchAll(/<(?:[\w.-]+:)?row\b([^>]*)>([\s\S]*?)<\/(?:[\w.-]+:)?row\s*>/gi)){
    const rowNumber=+xmlAttribute(row[1],"r")||rows.length+1,cells=[];
    for(const cell of row[2].matchAll(/<(?:[\w.-]+:)?c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:[\w.-]+:)?c\s*>)/gi)){
      const reference=xmlAttribute(cell[1],"r"),column=columnNumber(reference);
      if(column<0)continue;
      const type=xmlAttribute(cell[1],"t"),style=+xmlAttribute(cell[1],"s")||0,body=cell[2]||"";
      const valueTag=body.match(/<(?:[\w.-]+:)?v\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?v\s*>/i);
      let value=type==="inlineStr"?xmlText(body):valueTag?xmlDecode(valueTag[1]):"";
      if(type==="s")value=sharedStrings[+value]??"";
      else if(type==="b")value=value==="1"?"TRUE":"FALSE";
      else if(type==="e")value="";
      if(type==="n"||(!type&&value&&Number.isFinite(Number(value)))){
        if(dateStyleIndices.has(style))value=excelDate(value)||value;
      }
      cells[column]=value;
    }
    cells.sourceRow=rowNumber;
    rows.push(cells);
  }
  if(!rows.length)throw Error("The first worksheet is empty.");
  const width=rows.reduce((maximum,row)=>Math.max(maximum,row.length),0),dateColumns=new Set();
  rows.forEach((row,index)=>{
    const sourceRow=row.sourceRow;rows[index]=Array.from({length:width},(_,column)=>row[column]??"");
    rows[index].sourceRow=sourceRow;
  });
  const headerIndex=rows.findIndex(row=>{
    const values=row.map(value=>String(value||"").trim().toLowerCase());
    return values.some(value=>/\bdate\b|posted|trans\.?\s*date/.test(value))
      &&values.some(value=>/narration|description|details|particular|remarks/.test(value))
      &&values.some(value=>/\bamount\b|\bdebit\b|\bcredit\b|money\s+(?:in|out)/.test(value));
  });
  if(headerIndex<0)throw Error("No transaction table with date, description, and amount columns was found in the first worksheet.");
  const table=[rows[headerIndex],...rows.slice(headerIndex+1).filter(row=>row.some(value=>String(value||"").trim()))];
  table[0].forEach((value,index)=>{if(/date|posted|value date|trans\.?\s*date/i.test(String(value||"")))dateColumns.add(index);});
  for(const row of table.slice(1)){
    dateColumns.forEach(index=>{
      const value=row[index];
      if(value!==undefined&&value!==""&&Number.isFinite(Number(value)))row[index]=excelDate(value)||value;
    });
  }
  const preamble=rows.slice(0,headerIndex).map(row=>row.map(value=>String(value||"")).join(" ")).join(" ");
  const debit=preamble.match(/Total Debit(?:s)?\s*:?\s*[₦N]?\s*([\d,]+(?:\.\d{1,2})?)/i);
  const credit=preamble.match(/Total Credit(?:s)?\s*:?\s*[₦N]?\s*([\d,]+(?:\.\d{1,2})?)/i);
  table.summary={moneyIn:credit?parseAmount(credit[1]):null,moneyOut:debit?parseAmount(debit[1]):null};
  return table;
}
function parseXlsxParts(parts){
  const workbook=parts["xl/workbook.xml"]||"",relations=parts["xl/_rels/workbook.xml.rels"]||"";
  const sheet=xmlElements(workbook,"sheet")[0],relationshipId=sheet&&xmlAttribute(sheet.attributes,"r:id");
  const relationship=xmlElements(relations,"Relationship").find(item=>xmlAttribute(item.attributes,"Id")===relationshipId);
  let target=relationship&&xmlAttribute(relationship.attributes,"Target")||"worksheets/sheet1.xml";
  target=target.replace(/^\/+/,"");
  if(!target.startsWith("xl/"))target="xl/"+target.replace(/^(?:\.\.\/)+/,"");
  const normalized=[];
  target.split("/").forEach(part=>{if(part==="..")normalized.pop();else if(part&&part!==".")normalized.push(part);});
  const sheetXml=parts[normalized.join("/")];
  if(!sheetXml)throw Error("The first worksheet could not be found in this Excel file.");
  const strings=(xmlElements(parts["xl/sharedStrings.xml"]||"","si")||[])
    .map(item=>xmlText(item.body));
  return parseWorksheet(sheetXml,strings,parts["xl/styles.xml"]||"");
}
function pdfBlocks(lines,startIndex,startPattern){
  const blocks=[];let current="";
  for(const line of lines.slice(startIndex)){
    const text=String(line||"").trim();if(!text)continue;
    const startsWithDate=/^\d{1,2}\s+[A-Za-z]{3,}\s+\d{4}\b/.test(text) || startPattern.test(text);
    const sawMoney=/\d[\d,]*\.\d{2}/.test(current+" "+text);
    if(!current){current=text;continue;}
    if(startsWithDate && sawMoney){blocks.push(current);current=text;continue;}
    current+=" "+text;
  }
  if(current)blocks.push(current);
  return blocks;
}
function walletPdfBlocks(lines,startIndex){
  const blocks=[];let current="",pending="";
  const narrative=/^(?:Transfer\s+(?:to|from)\b|Auto-save\b|OWealth\b|SafeBox\b|Interest\b|Cashback\b|Payment\b)/i;
  const date=/^\d{1,2}\s+[A-Za-z]{3,}\s+\d{4}\b/;
  for(const line of lines.slice(startIndex)){
    const text=String(line||"").trim();if(!text)continue;
    if(date.test(text)){
      if(current)blocks.push(current);
      current=[pending,text].filter(Boolean).join(" ");pending="";
    }else if(narrative.test(text)){
      if(current){blocks.push(current);current="";}
      pending=[pending,text].filter(Boolean).join(" ");
    }else if(pending)pending+=" "+text;
    else if(current)current+=" "+text;
  }
  if(current)blocks.push(current);
  return blocks;
}
function summaryAmounts(lines){
  const text=(lines||[]).join(" ").replace(/\s+/g," ");
  const sum=pattern=>{const values=[...text.matchAll(pattern)].map(match=>parseAmount(match[1]));return values.length?values.reduce((total,value)=>total+value,0):null;};
  const period=text.match(/(?:Date|Period)\s*:?\s*(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})\s*[-–]\s*(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})/i);
  return{
    moneyIn:sum(/(?:Total Money In|Total Credits|Total Credit)\s*[:₦N\s]*([\d,]+(?:\.\d{1,2})?)/gi),
    moneyOut:sum(/(?:Total Money Out|Total Debits|Total Debit)\s*[:₦N\s]*([\d,]+(?:\.\d{1,2})?)/gi),
    period:period?{start:normalizeDate(period[1]),end:normalizeDate(period[2])}:null
  };
}
function parseMoniepointPdf(lines){
  const headerIndex=lines.findIndex(line=>/date\s+narration\s+reference\s+debit\s*credit\s*balance/i.test(String(line||"").replace(/\s+/g," ").trim()));
  if(headerIndex<0)return null;
  const blocks=pdfBlocks(lines,headerIndex+1,/^20\d{2}-\d{2}-\d{2}T\d{1,2}:/);
  const rows=blocks.map(block=>{
    const normalized=block.replace(/T(\d{1,2}):\s*(\d{2}):(\d{2})/,"T$1:$2:$3");
    const timestamp=normalized.match(/\b(20\d{2}-\d{2}-\d{2})T(\d{1,2}:\d{2}:\d{2})(?!\d)/);
    const dateMatch=normalized.match(/\b20\d{2}-\d{2}-\d{2}(?!\d)/),hourMatch=normalized.match(/T(\d{1,2}):/);
    if(!dateMatch||!hourMatch)return null;
    let time=timestamp?timestamp[2]:"",confidence=.9,remainder=normalized.slice(dateMatch.index+dateMatch[0].length);
    remainder=remainder.replace(/^T\d{1,2}:\s*/,"");
    if(timestamp){remainder=remainder.replace(/^\d{2}:\d{2}/,"");}
    else{
      const fragments=[...remainder.matchAll(/(?<!\d)(\d{2}):(\d{2})(?!\d)/g)];
      if(fragments.length){
        const fragment=fragments[fragments.length-1];time=String(hourMatch[1]).padStart(2,"0")+":"+fragment[1]+":"+fragment[2];
        remainder=remainder.slice(0,fragment.index)+remainder.slice(fragment.index+fragment[0].length);
      }else{time="";confidence=.65;}
    }
    const date=normalizeDate(dateMatch[0]);
    const values=[...remainder.matchAll(/(?<!\d)(?:--|\d{1,3}(?:,\d{3})*\.\d{2})(?!\d)/g)];
    if(values.length<2)return null;
    const columns=values.slice(-3),first=columns[0],prefix=remainder.slice(0,first.index).trim();
    const refs=[...prefix.matchAll(/(?:TP\s+)?(?:TRF|MPT|ATP)\|[A-Za-z0-9_.|/-]+/gi)];
    const reference=refs.length?refs[refs.length-1][0].replace(/^\/+/,""):"";
    const description=(reference?prefix.slice(0,refs[0].index):prefix).replace(/[|/]+$/,"").trim();
    const debit=columns.length===3?parseAmount(columns[0][0]):0;
    const credit=columns.length===3?parseAmount(columns[1][0]):parseAmount(columns[0][0]);
    const amount=debit||credit;
    if(!date||!description||!amount)return null;
    const direction=debit?"out":"in";
    return{date,time,description:description.slice(0,180),amount,direction,type:transactionType(description,direction==="out"?-amount:amount),reference,currency:"NGN",raw:block,confidence};
  }).filter(Boolean);
  return{rows,summary:summaryAmounts(lines),layout:"moniepoint"};
}
function parseWalletPdf(lines){
  const headerIndex=lines.findIndex(line=>/trans\.?\s*time\s+value\s*date\s+description\s+debit/i.test(String(line||"").replace(/\s+/g," ").trim()));
  if(headerIndex<0)return null;
  const nextHeaderIndex=lines.findIndex((line,index)=>index>headerIndex&&/trans\.?\s*time\s+value\s*date\s+description\s+debit/i.test(String(line||"").replace(/\s+/g," ").trim()));
  const tableEnd=nextHeaderIndex<0?lines.length:nextHeaderIndex;
  const blocks=walletPdfBlocks(lines.slice(0,tableEnd),headerIndex+1);
  const rows=blocks.map(rawBlock=>{
    const block=rawBlock.replace(/\s+(?:(?:Credit Count|Total Credit|Closing Balance|Debit Count|Total Debit|Opening Balance)\b|Period:)[\s\S]*$/i,"").trim();
    const dateMatch=block.match(/\b\d{1,2}\s+[A-Za-z]{3,}\s+\d{4}\b/),timeMatch=block.match(/\b\d{1,2}:\d{2}:\d{2}\b/);
    if(!dateMatch||!timeMatch)return null;
    const date=normalizeDate(dateMatch[0]),time=timeMatch[0];
    const narrativePrefix=block.slice(0,dateMatch.index).trim();
    let remainder=block.slice(dateMatch.index+dateMatch[0].length).replace(timeMatch[0]," ");
    remainder=remainder.replace(/\b\d{1,2}\s+[A-Za-z]{3,}\s+\d{4}(?!\d)/g," ").replace(/\s+/g," ").trim();
    const channelRef=remainder.match(/\bMobile\s*([A-Za-z0-9]{12,})(?:\s+(\d{1,8}))?\s*$/i);
    const leadingRef=block.match(/\b(?:APT)?[A-Za-z0-9]{18,}\b/);
    const reference=channelRef?channelRef[1]+(channelRef[1].length>=24?channelRef[2]||"":""):leadingRef?leadingRef[0]:"";
    if(channelRef)remainder=remainder.slice(0,channelRef.index).trim();
    const values=[...remainder.matchAll(/(?<!\d)(?:--|\d{1,3}(?:,\d{3})*\.\d{2})(?!\d)/g)];
    if(values.length<2)return null;
    const columns=values.slice(0,3),first=columns[0];
    let description=[narrativePrefix,remainder.slice(0,first.index)].filter(Boolean).join(" ").trim();
    if(leadingRef&&description.includes(leadingRef[0]))description=description.replace(leadingRef[0]," ");
    description=description.replace(/--\s*$/,"").replace(/[|,\s]+$/,"").trim();
    const debit=columns.length===3?parseAmount(columns[0][0]):0;
    const credit=columns.length===3?parseAmount(columns[1][0]):parseAmount(columns[0][0]);
    const amount=debit||credit;
    if(!date||!amount)return null;
    const direction=debit?"out":"in";
    const hasDescription=description.length>=2;
    description=hasDescription?description:"Wallet transaction (description not extracted)";
    return{date,time,description:description.slice(0,180),amount,direction,type:transactionType(description,direction==="out"?-amount:amount),reference,currency:"NGN",raw:block,confidence:hasDescription&&reference?.length>=8?.9:.6};
  }).filter(Boolean);
  const summaryLines=lines.slice(0,headerIndex);
  const periodText=summaryLines.join(" ").replace(/\s+/g," ");
  const period=periodText.match(/Period:\s*[-–]?\s*(\d{1,2}\s+[A-Za-z]{3,}\s+\d{4})\s*[-–]?\s*(\d{1,2}\s+[A-Za-z]{3,}\s+\d{4})/i);
  const summary=summaryAmounts(summaryLines);
  const totalFor=label=>{
    const labelPattern=new RegExp("\\bTotal "+label+"\\b","i");
    for(let index=0;index<summaryLines.length;index++){
      const line=String(summaryLines[index]||"");
      if(!labelPattern.test(line))continue;
      const values=[...line.matchAll(/(?:₦|N)?\s*([\d,]+\.\d{2})/g)].map(match=>parseAmount(match[1]));
      if(values.length)return values[values.length-1];
      const nextValues=[...(summaryLines[index+1]||"").matchAll(/(?:₦|N)?\s*([\d,]+\.\d{2})/g)].map(match=>parseAmount(match[1]));
      if(nextValues.length)return /(?:Opening|Closing) Balance/i.test(line)?nextValues[1]??nextValues[0]:nextValues[0];
    }
    return null;
  };
  summary.moneyOut=totalFor("Debit")??summary.moneyOut;
  summary.moneyIn=totalFor("Credit")??summary.moneyIn;
  summary.period=period?{start:normalizeDate(period[1]),end:normalizeDate(period[2])}:null;
  if(summary.moneyIn===null||summary.moneyOut===null)rows.forEach(row=>{row.confidence=.65;});
  return{rows,summary,layout:"wallet"};
}
function findZipEntries(bytes){
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),minimum=Math.max(0,bytes.length-65557);let end=-1;
  for(let index=bytes.length-22;index>=minimum;index--){if(view.getUint32(index,true)===0x06054b50){end=index;break;}}
  if(end<0)throw Error("This is not a valid XLSX workbook.");
  const count=view.getUint16(end+10,true),centralOffset=view.getUint32(end+16,true),entries=new Map();let cursor=centralOffset;
  for(let index=0;index<count;index++){
    if(view.getUint32(cursor,true)!==0x02014b50)throw Error("The XLSX workbook directory is damaged.");
    const flags=view.getUint16(cursor+8,true),method=view.getUint16(cursor+10,true),compressedSize=view.getUint32(cursor+20,true),size=view.getUint32(cursor+24,true),nameLength=view.getUint16(cursor+28,true),extraLength=view.getUint16(cursor+30,true),commentLength=view.getUint16(cursor+32,true),localOffset=view.getUint32(cursor+42,true);
    const name=new TextDecoder().decode(bytes.subarray(cursor+46,cursor+46+nameLength));
    if(flags&1)throw Error("Encrypted Excel workbooks are not supported.");
    if(size===0xffffffff||compressedSize===0xffffffff||localOffset===0xffffffff)throw Error("Large ZIP64 Excel workbooks are not supported.");
    entries.set(name,{method,compressedSize,size,localOffset});
    cursor+=46+nameLength+extraLength+commentLength;
  }
  return entries;
}
async function readZipEntry(bytes,entry){
  if(entry.size>32*1024*1024)throw Error("An Excel workbook component is too large to read safely.");
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),offset=entry.localOffset;
  if(view.getUint32(offset,true)!==0x04034b50)throw Error("An Excel workbook component is damaged.");
  const start=offset+30+view.getUint16(offset+26,true)+view.getUint16(offset+28,true);
  const compressed=bytes.subarray(start,start+entry.compressedSize);
  if(entry.method===0)return compressed.slice();
  if(entry.method!==8)throw Error("This Excel workbook uses an unsupported compression method.");
  if(typeof root.DecompressionStream!=="function")throw Error("This browser cannot decompress XLSX files locally.");
  const stream=new Blob([compressed]).stream().pipeThrough(new root.DecompressionStream("deflate-raw"));
  const reader=stream.getReader(),chunks=[];let total=0;
  while(true){
    const part=await reader.read();if(part.done)break;
    total+=part.value.length;
    if(total>entry.size||total>32*1024*1024){await reader.cancel();throw Error("An Excel workbook component exceeded its declared size.");}
    chunks.push(part.value);
  }
  if(total!==entry.size)throw Error("An Excel workbook component failed its size check.");
  const result=new Uint8Array(total);let copyOffset=0;
  for(const chunk of chunks){result.set(chunk,copyOffset);copyOffset+=chunk.length;}
  return result;
}
async function readXlsx(file){
  const bytes=new Uint8Array(await file.arrayBuffer()),entries=findZipEntries(bytes),parts={};
  const workbook=entries.get("xl/workbook.xml"),relationships=entries.get("xl/_rels/workbook.xml.rels");
  if(!workbook||!relationships)throw Error("This file is not a supported XLSX workbook.");
  const workbookXml=new TextDecoder().decode(await readZipEntry(bytes,workbook));
  const relationshipsXml=new TextDecoder().decode(await readZipEntry(bytes,relationships));
  parts["xl/workbook.xml"]=workbookXml;parts["xl/_rels/workbook.xml.rels"]=relationshipsXml;
  const shared=entries.get("xl/sharedStrings.xml"),styles=entries.get("xl/styles.xml");
  if(shared)parts["xl/sharedStrings.xml"]=new TextDecoder().decode(await readZipEntry(bytes,shared));
  if(styles)parts["xl/styles.xml"]=new TextDecoder().decode(await readZipEntry(bytes,styles));
  const sheet=xmlElements(workbookXml,"sheet")[0],id=sheet&&xmlAttribute(sheet.attributes,"r:id");
  const relation=xmlElements(relationshipsXml,"Relationship").find(item=>xmlAttribute(item.attributes,"Id")===id);
  let target=relation&&xmlAttribute(relation.attributes,"Target")||"worksheets/sheet1.xml";
  target=target.replace(/^\/+/,"");
  if(!target.startsWith("xl/"))target="xl/"+target.replace(/^(?:\.\.\/)+/,"");
  const path=[];target.split("/").forEach(part=>{if(part==="..")path.pop();else if(part&&part!==".")path.push(part);});
  const sheetPath=path.join("/"),sheetEntry=entries.get(sheetPath);
  if(!sheetEntry)throw Error("The first worksheet could not be found in this Excel file.");
  parts[sheetPath]=new TextDecoder().decode(await readZipEntry(bytes,sheetEntry));
  const rows=parseXlsxParts(parts);
  return{rows,summary:rows.summary||null,sheet:xmlAttribute(sheet?.attributes||"","name")||"Sheet1"};
}
async function readPdf(file){
  if(!root.pdfjsLib||typeof root.pdfjsLib.getDocument!=="function")throw Error("The local PDF reader could not load.");
  const workerUrl=new URL("./legacy/Beta-v1/vendor/pdf.worker.bundle.js",document.baseURI).href;
  if(root.pdfjsLib.GlobalWorkerOptions)root.pdfjsLib.GlobalWorkerOptions.workerSrc=workerUrl;
  const workerPort=typeof root.Worker==="function"&&root.pdfjsLib.PDFWorker?new root.Worker(workerUrl):null;
  const worker=workerPort?new root.pdfjsLib.PDFWorker({port:workerPort}):null;
  const task=root.pdfjsLib.getDocument({data:new Uint8Array(await file.arrayBuffer()),worker,isEvalSupported:false,useWorkerFetch:false,disableAutoFetch:true,disableStream:true});
  const pdf=await task.promise,lines=[],pages=[];let textLength=0;
  try{
    for(let pageNo=1;pageNo<=pdf.numPages;pageNo++){
      const page=await pdf.getPage(pageNo),content=await page.getTextContent(),groups=[];
      content.items.filter(item=>item.str&&item.str.trim()).forEach(item=>{
        const y=item.transform&&item.transform[5]||0;let line=groups.find(row=>Math.abs(row.y-y)<2.5);
        if(!line){line={y,items:[]};groups.push(line);}
        line.items.push({x:item.transform&&item.transform[4]||0,text:item.str.replace(/\s+/g," ").trim()});textLength+=item.str.trim().length;
      });
      const pageLines=[];groups.sort((a,b)=>b.y-a.y).forEach(row=>pageLines.push(row.items.sort((a,b)=>a.x-b.x).map(item=>item.text).join(" ")));
      pages.push(pageLines);lines.push(...pageLines);
    }
  }finally{await pdf.cleanup?.();await pdf.destroy?.();workerPort?.terminate();}
  let monthFirst=false;
  for(const line of lines){const dates=String(line||"").match(/\b\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}\b/g)||[];for(const value of dates){const parts=value.split(/[-/.]/).map(Number);if(parts[0]<=12&&parts[1]>12)monthFirst=true;}}
  const parsedProvider=parseMoniepointPdf(lines)||parseWalletPdf(lines);
  const summary=parsedProvider?parsedProvider.summary:parseStatementSummary(lines);
  const rows=parsedProvider
    ?parsedProvider.rows.map(row=>Object.assign(row,{currency:row.currency||"NGN"}))
    :pages.flatMap((pageLines,index)=>parseLines(pageLines,monthFirst).map(row=>Object.assign(row,{page:index+1,currency:row.currency||"NGN"})));
  const extractedIn=rows.filter(row=>row.direction==="in").reduce((total,row)=>total+row.amount,0);
  const extractedOut=rows.filter(row=>row.direction==="out").reduce((total,row)=>total+row.amount,0);
  const hasTotals=summary.moneyIn!==null&&summary.moneyOut!==null;
  const reconciles=hasTotals
    ?Math.abs(extractedIn-summary.moneyIn)<.01&&Math.abs(extractedOut-summary.moneyOut)<.01
    :null;
  if(textLength<35&&rows.length===0)return{status:"pending-ocr",reason:"No selectable text was found. This looks like a scanned PDF. OCR is not enabled, so it is marked Pending OCR and no transactions were imported. The file is not stored; re-upload it after OCR is enabled or use CSV."};
  if(!rows.length)return{status:"pending-format",reason:"Text was readable, but no transaction rows could be safely extracted. No transactions were imported; use CSV or a supported statement format."};
  return{status:"ready",rows,summary,reconciles,extracted:{moneyIn:extractedIn,moneyOut:extractedOut},layout:parsedProvider?.layout||"generic",warnings:reconciles===false?"Extracted transactions do not match statement totals; rows need review.":rows.some(row=>row.confidence<.7)?"Some rows need checking.":""};
}
const api=Object.freeze({parseLines,parseAmount,normalizeDate,transactionType,parseStatementSummary,parseXlsxParts,pdfBlocks,parseMoniepointPdf,parseWalletPdf,readXlsx,readPdf});
root.StatementReader=api;if(typeof module!=="undefined"&&module.exports)module.exports=api;
})(typeof globalThis!=="undefined"?globalThis:this);
