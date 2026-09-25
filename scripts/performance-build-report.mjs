import fs from "node:fs";
import path from "node:path";

function filesUnder(root){
  if(!fs.existsSync(root))return [];
  const output=[];
  for(const entry of fs.readdirSync(root,{withFileTypes:true})){
    const absolute=path.join(root,entry.name);
    if(entry.isDirectory())output.push(...filesUnder(absolute));
    else if(entry.isFile())output.push({path:absolute.replaceAll("\\","/"),bytes:fs.statSync(absolute).size});
  }
  return output;
}
function total(items){return items.reduce((sum,item)=>sum+item.bytes,0);}
function top(items,count=12){return [...items].sort((a,b)=>b.bytes-a.bytes).slice(0,count);}

const staticFiles=filesUnder(".next/static");
const js=staticFiles.filter(item=>item.path.endsWith(".js"));
const css=staticFiles.filter(item=>item.path.endsWith(".css"));
const biometric=[
  ...filesUnder("public/biometric-models"),
  ...filesUnder("public").filter(item=>item.path.endsWith("/biometric-human.js")),
];

const report={
  generatedAt:new Date().toISOString(),
  nextStatic:{files:staticFiles.length,bytes:total(staticFiles)},
  javascript:{files:js.length,bytes:total(js),largest:top(js)},
  css:{files:css.length,bytes:total(css),largest:top(css)},
  biometric:{files:biometric.length,bytes:total(biometric),largest:top(biometric)},
};

console.log("Performance build report");
console.log(JSON.stringify(report,null,2));
