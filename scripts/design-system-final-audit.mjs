import fs from "node:fs";
import path from "node:path";

function walk(root){
  const out=[];
  for(const entry of fs.readdirSync(root,{withFileTypes:true})){
    const full=path.join(root,entry.name);
    if(entry.name==="node_modules"||entry.name===".next"||entry.name===".git")continue;
    if(entry.isDirectory())out.push(...walk(full));
    else out.push(full.replaceAll("\\","/"));
  }
  return out;
}
function read(file){return fs.readFileSync(file,"utf8");}

const v2Css=[
  "app/business-ui.css","app/data-ui.css","app/phase6-modules.css","app/phase7-modules.css",
  "app/phase8-modules.css","app/phase9-modules.css","app/phase10-modules.css","app/shell-v2.css",
  "app/ui-kit-core.css","app/ui-kit/ui-kit.css",
];
for(const file of v2Css){
  const src=read(file);
  const hex=[...src.matchAll(/#[0-9a-fA-F]{3,8}\b/g)];
  if(hex.length)throw new Error(file+" contains "+hex.length+" hardcoded hex colors; V2 CSS must consume tokens");
}

const globals=read("app/globals.css");
const globalHex=[...globals.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map(match=>match[0].toLowerCase());
const uniqueGlobalHex=new Set(globalHex);
const globalImportant=(globals.match(/!important/g)||[]).length;
if(globalHex.length>1561)throw new Error("Legacy globals.css hex debt grew from audited baseline 1561 to "+globalHex.length);
if(uniqueGlobalHex.size>915)throw new Error("Legacy globals.css unique-hex debt grew from audited baseline 915 to "+uniqueGlobalHex.size);
if(globalImportant>190)throw new Error("Legacy globals.css !important debt grew from audited baseline 190 to "+globalImportant);

const sourceFiles=walk("app").concat(walk("components")).filter(file=>/\.(tsx|ts)$/.test(file));
const glyphPattern=/[▦◫⌂▣◎◉◌⌖◇▤▧✦◐◒☀↪↻⌕♕☎⌗]/g;
let legacyGlyphCount=0;
const glyphFiles=[];
for(const file of sourceFiles){
  const matches=read(file).match(glyphPattern)||[];
  if(matches.length){legacyGlyphCount+=matches.length;glyphFiles.push({file,count:matches.length});}
}

const packageJson=JSON.parse(read("package.json"));
const dependencies={...(packageJson.dependencies||{}),...(packageJson.devDependencies||{})};
for(const name of ["@mui/material","antd","@chakra-ui/react","bootstrap","semantic-ui-react"]){
  if(dependencies[name])throw new Error("Duplicate UI framework detected: "+name);
}

const wrapper=read("components/FileDropzone.tsx");
if(!wrapper.includes('FileUpload')||wrapper.length>450)throw new Error("FileDropzone compatibility wrapper has diverged instead of delegating to UI Kit");

const phase10=read("app/phase10-modules.css");
if(!phase10.includes("@media(prefers-reduced-motion:reduce)"))throw new Error("Phase 10 missing reduced-motion contract");
if(!phase10.includes(":focus-visible"))throw new Error("Phase 10 missing visible keyboard focus contract");
if(!phase10.includes("@media(max-width:700px)"))throw new Error("Phase 10 missing mobile responsive contract");

const reportPage=read("app/dashboard/reports/page.tsx");
if(/setInterval\(|fetch\(/.test(reportPage))throw new Error("Reports center introduced unnecessary client polling/network duplication");

console.log("DESWEB V2 FINAL AUDIT");
console.log("V2 hardcoded hex: 0 across "+v2Css.length+" owned stylesheets");
console.log("Legacy globals.css baseline: "+globalHex.length+" hex occurrences / "+uniqueGlobalHex.size+" unique / "+globalImportant+" !important");
console.log("Legacy decorative glyph inventory: "+legacyGlyphCount+" occurrences across "+glyphFiles.length+" TS/TSX files");
if(glyphFiles.length)console.log("Legacy glyph files: "+glyphFiles.slice(0,30).map(item=>item.file+"("+item.count+")").join(", "));
console.log("Duplicate external UI frameworks: 0");
console.log("Phase 10 accessibility/responsive/reduced-motion contracts: present");
