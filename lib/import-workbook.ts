import ExcelJS from "exceljs";

export type ImportCell=string|number|boolean|null;

export type ParsedSheetRow={
  rowNumber:number;
  values:Record<string,ImportCell>;
};

function clean(value:unknown):ImportCell{
  if(value===null||value===undefined)return null;
  if(value instanceof Date)return value.toISOString().slice(0,10);
  if(typeof value==="object"){
    const rich=value as {text?:unknown;result?:unknown};
    if(rich.result!==undefined)return clean(rich.result);
    if(rich.text!==undefined)return String(rich.text).trim();
  }
  if(typeof value==="string")return value.trim();
  if(typeof value==="number"||typeof value==="boolean")return value;
  return String(value).trim();
}

export function normalizedHeader(value:unknown){
  return String(clean(value)||"")
    .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g," ")
    .trim();
}

export function textValue(value:ImportCell){
  return value===null?"":String(value).trim();
}

export function numberValue(value:ImportCell){
  if(typeof value==="number")return Number.isFinite(value)?value:null;
  const cleaned=String(value??"").replace(/[$,%\s]/g,"").replace(/,/g,"");
  if(!cleaned)return null;
  const parsed=Number(cleaned);
  return Number.isFinite(parsed)?parsed:null;
}

export function boolValue(value:ImportCell,defaultValue=true){
  const text=normalizedHeader(value);
  if(!text)return defaultValue;
  if(["si","sí","yes","true","1","activo","activa"].includes(text))return true;
  if(["no","false","0","inactivo","inactiva"].includes(text))return false;
  return defaultValue;
}

export function isoDateValue(value:ImportCell){
  if(value===null||value==="")return "";
  if(typeof value==="number"){
    const epoch=new Date(Date.UTC(1899,11,30));
    epoch.setUTCDate(epoch.getUTCDate()+value);
    return epoch.toISOString().slice(0,10);
  }
  const text=String(value).trim();
  if(/^\d{4}-\d{2}-\d{2}$/.test(text))return text;
  const parsed=new Date(text);
  return Number.isNaN(parsed.valueOf())?"":parsed.toISOString().slice(0,10);
}

export async function loadWorkbook(buffer:Buffer){
  const workbook=new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  return workbook;
}

export function findWorksheet(workbook:ExcelJS.Workbook,candidates:string[]){
  const wanted=candidates.map(normalizedHeader);
  return workbook.worksheets.find(sheet=>wanted.includes(normalizedHeader(sheet.name)))||null;
}

export function parseSheet(
  worksheet:ExcelJS.Worksheet,
  aliases:Record<string,string[]>,
  requiredCanonical:string[]=[],
){
  const headerRow=worksheet.getRow(1);
  const headerMap=new Map<number,string>();
  const aliasLookup=new Map<string,string>();
  for(const [canonical,names] of Object.entries(aliases)){
    aliasLookup.set(normalizedHeader(canonical),canonical);
    for(const name of names)aliasLookup.set(normalizedHeader(name),canonical);
  }
  headerRow.eachCell({includeEmpty:false},(cell,col)=>{
    const canonical=aliasLookup.get(normalizedHeader(cell.value));
    if(canonical)headerMap.set(col,canonical);
  });
  const found=new Set(headerMap.values());
  const missing=requiredCanonical.filter(key=>!found.has(key));
  const rows:ParsedSheetRow[]=[];
  for(let rowNumber=2;rowNumber<=worksheet.rowCount;rowNumber++){
    const row=worksheet.getRow(rowNumber);
    const values:Record<string,ImportCell>={};
    let populated=false;
    for(const [col,key] of headerMap.entries()){
      const value=clean(row.getCell(col).value);
      values[key]=value;
      if(value!==null&&value!=="")populated=true;
    }
    if(populated)rows.push({rowNumber,values});
  }
  return {rows,missing,headers:[...found]};
}

export function stableCode(prefix:string,value:string){
  const normalized=normalizedHeader(value).toUpperCase().replace(/\s+/g,"-").replace(/[^A-Z0-9-]/g,"").slice(0,24);
  return (prefix+"-"+(normalized||"GENERAL")).slice(0,32);
}
