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

function routeReferences(){
  const manifests=filesUnder(".next/server/app").filter(item=>item.path.endsWith("_client-reference-manifest.js"));
  const output=[];
  for(const manifest of manifests){
    const raw=fs.readFileSync(manifest.path,"utf8");
    const refs=[...raw.matchAll(/static\/chunks\/[^"'\\]+?\.(?:js|css)/g)].map(match=>match[0]);
    const unique=[...new Set(refs)];
    const jsRefs=unique.filter(ref=>ref.endsWith(".js")).map(ref=>".next/"+ref).filter(fs.existsSync);
    const cssRefs=unique.filter(ref=>ref.endsWith(".css")).map(ref=>".next/"+ref).filter(fs.existsSync);
    const route=manifest.path
      .replace(/^\.next\/server\/app/,"")
      .replace(/\/page_client-reference-manifest\.js$/,"")
      .replace(/\/route_client-reference-manifest\.js$/,"")
      ||"/";
    output.push({
      route,
      javascriptBytes:jsRefs.reduce((sum,file)=>sum+fs.statSync(file).size,0),
      cssBytes:cssRefs.reduce((sum,file)=>sum+fs.statSync(file).size,0),
      javascriptFiles:jsRefs.length,
      cssFiles:cssRefs.length,
    });
  }
  return output.sort((a,b)=>b.javascriptBytes-a.javascriptBytes);
}

const staticFiles=filesUnder(".next/static");
const js=staticFiles.filter(item=>item.path.endsWith(".js"));
const css=staticFiles.filter(item=>item.path.endsWith(".css"));
const biometric=[
  ...filesUnder("public/biometric-models"),
  ...filesUnder("public").filter(item=>item.path.endsWith("/biometric-human.js")),
];

const routeBundles=routeReferences();

const report={
  generatedAt:new Date().toISOString(),
  nextStatic:{files:staticFiles.length,bytes:total(staticFiles)},
  javascript:{files:js.length,bytes:total(js),largest:top(js)},
  css:{files:css.length,bytes:total(css),largest:top(css)},
  biometric:{files:biometric.length,bytes:total(biometric),largest:top(biometric)},
  routes:{
    measured:routeBundles.length,
    largestJavascript:routeBundles.slice(0,20),
    largestCss:[...routeBundles].sort((a,b)=>b.cssBytes-a.cssBytes).slice(0,20),
  },
};

console.log("Performance build report");
console.log(JSON.stringify(report,null,2));
