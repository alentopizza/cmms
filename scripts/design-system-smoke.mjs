import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const tokensPath=path.join(root,"app/design-system/tokens.css");
const layoutPath=path.join(root,"app/layout.tsx");
const uiKitPagePath=path.join(root,"app/ui-kit/page.tsx");
const uiKitCssPath=path.join(root,"app/ui-kit/ui-kit.module.css");
const iconBridgePath=path.join(root,"components/ui/Icon.tsx");

for(const file of [tokensPath,layoutPath,uiKitPagePath,uiKitCssPath,iconBridgePath]){
  if(!fs.existsSync(file))throw new Error("Missing Phase 1 file: "+path.relative(root,file));
}

const tokens=fs.readFileSync(tokensPath,"utf8");
const layout=fs.readFileSync(layoutPath,"utf8");
const uiKitPage=fs.readFileSync(uiKitPagePath,"utf8");
const uiKitCss=fs.readFileSync(uiKitCssPath,"utf8");
const iconBridge=fs.readFileSync(iconBridgePath,"utf8");

const expected=[
  ["--color-brand-primary","#72F1DC"],
  ["--color-brand-secondary","#2C8780"],
  ["--color-brand-dark","#1D1D2C"],
  ["--color-bg","#F4F8F9"],
  ["--color-surface","#FFFFFF"],
  ["--color-text-primary","#1D1D2C"],
  ["--color-border-default","#D5E1E3"],
  ["--color-success-500","#10B981"],
  ["--color-warning-500","#F59E0B"],
  ["--color-danger-500","#EF4444"],
  ["--color-info-500","#3B82F6"],
  ["--color-module-analytics","#8B5CF6"],
  ["--color-module-logistics","#F97316"],
  ["--color-module-technology","#06B6D4"],
  ["--color-module-people","#EC4899"],
  ["--motion-fast","120ms"],
  ["--motion-normal","180ms"],
  ["--motion-medium","240ms"],
  ["--motion-slow","320ms"],
];
for(const [name,value] of expected){
  if(!tokens.includes(name+": "+value+";"))throw new Error("Missing or changed design token "+name+" = "+value);
}

for(const token of ["--space-1","--space-16","--radius-xs","--radius-3xl","--shadow-xs","--shadow-lg","--gradient-primary","--focus-ring"]){
  if(!tokens.includes(token+":"))throw new Error("Missing foundation token "+token);
}

if(!tokens.includes('html[data-theme="dark"]'))throw new Error("Dark semantic token mapping is missing");
if(!tokens.includes("@media (prefers-reduced-motion: reduce)"))throw new Error("Reduced-motion token handling is missing");

const tokenImport=layout.indexOf('import "./design-system/tokens.css";');
const legacyImport=layout.indexOf('import "./globals.css";');
if(tokenImport<0||legacyImport<0||tokenImport>legacyImport){
  throw new Error("Design tokens must load before legacy globals.css");
}

if(!uiKitPage.includes("UI Kit · Foundations"))throw new Error("/ui-kit foundation catalog is missing");
if(!uiKitPage.includes("index:false"))throw new Error("/ui-kit must remain no-index during foundation rollout");
if(!iconBridge.includes("@/components/UiIcon"))throw new Error("UI Kit Icon must bridge the existing UiIcon system");

const legacyPalette=["#293644","#38B2A9","#79CAC4","#BAE3E0"];
for(const value of legacyPalette){
  if(uiKitPage.toUpperCase().includes(value)||uiKitCss.toUpperCase().includes(value)){
    throw new Error("Legacy palette leaked into new UI Kit code: "+value);
  }
}

const uiKitHex=[...uiKitCss.matchAll(/#[0-9A-Fa-f]{3,8}\b/g)].map(match=>match[0]);
if(uiKitHex.length){
  throw new Error("UI Kit CSS must consume tokens instead of raw hex values: "+[...new Set(uiKitHex)].join(", "));
}

console.log("DESWEB Design System V2 foundation smoke checks passed.");
