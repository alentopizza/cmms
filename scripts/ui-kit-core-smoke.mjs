import fs from "node:fs";

const requiredFiles=[
  "components/ui-kit/Button.tsx",
  "components/ui-kit/FormControls.tsx",
  "components/ui-kit/AdvancedSelect.tsx",
  "components/ui-kit/Badge.tsx",
  "components/ui-kit/Card.tsx",
  "components/ui-kit/Avatar.tsx",
  "components/ui-kit/Feedback.tsx",
  "components/ui-kit/Navigation.tsx",
  "components/ui-kit/Overlay.tsx",
  "components/ui-kit/TooltipDropdown.tsx",
  "components/ui-kit/FileUpload.tsx",
  "components/ui-kit/CorePrimitivesPreview.tsx",
  "app/ui-kit-core.css",
];
for(const file of requiredFiles){
  if(!fs.existsSync(file))throw new Error("Missing UI Core file: "+file);
}

const barrel=fs.readFileSync("components/ui-kit/index.ts","utf8");
for(const symbol of [
  "Button","IconButton","SplitButton","Input","SearchInput","NumberInput","CurrencyInput","PasswordInput",
  "Textarea","Select","Checkbox","Radio","Switch","MultiSelect","SearchSelect","AsyncSelect","Badge",
  "StatusIndicator","Card","Avatar","Alert","Toast","EmptyState","Spinner","Skeleton","LoadingCard",
  "LoadingTable","LoadingPage","Tabs","Pills","SegmentedControl","Breadcrumb","ModuleNavigation","Stepper",
  "Modal","Drawer","Tooltip","Dropdown","FileUpload",
]){
  if(!barrel.includes(symbol))throw new Error("UI Kit barrel does not export "+symbol);
}

const componentSources=requiredFiles.filter(file=>file.endsWith(".tsx")).map(file=>[file,fs.readFileSync(file,"utf8")]);
for(const [file,source] of componentSources){
  const hex=source.match(/#[0-9a-fA-F]{3,8}\b/g);
  if(hex?.length)throw new Error(file+" contains hardcoded hexadecimal colors: "+hex.join(", "));
}

const coreCss=fs.readFileSync("app/ui-kit-core.css","utf8");
for(const selector of [".ds-button",".ds-input",".ds-card",".ds-modal",".ds-drawer",".ds-tabs",".ds-stepper",".ds-alert",".ds-file-upload"]){
  if(!coreCss.includes(selector))throw new Error("Missing UI Core style selector "+selector);
}
if(/#[0-9a-fA-F]{3,8}\b/.test(coreCss))throw new Error("UI Core CSS must consume Design Tokens instead of hardcoded hex colors");
if(!coreCss.includes(":focus-visible"))throw new Error("UI Core focus-visible styles are required");
if(!coreCss.includes("@media(prefers-reduced-motion:reduce)"))throw new Error("UI Core reduced-motion support is required");

const overlay=fs.readFileSync("components/ui-kit/Overlay.tsx","utf8");
for(const behavior of ['event.key==="Escape"','event.key!=="Tab"',"previous.focus()"]){
  if(!overlay.includes(behavior))throw new Error("Overlay accessibility contract missing "+behavior);
}

const wrappers={
  "components/ConfirmDialog.tsx":"@/components/ui-kit/Overlay",
  "components/CreateRecordModal.tsx":"@/components/ui-kit/Overlay",
  "components/MultiSelectDropdown.tsx":"@/components/ui-kit/AdvancedSelect",
  "components/FileDropzone.tsx":"@/components/ui-kit/FileUpload",
};
for(const [file,dependency] of Object.entries(wrappers)){
  const source=fs.readFileSync(file,"utf8");
  if(!source.includes(dependency))throw new Error(file+" no longer delegates to "+dependency);
}

const page=fs.readFileSync("app/ui-kit/page.tsx","utf8");
for(const anchor of ["#buttons","#forms","#cards","#navigation","#overlays","#feedback","CorePrimitivesPreview"]){
  if(!page.includes(anchor))throw new Error("/ui-kit missing Phase 2 catalog section "+anchor);
}

const layout=fs.readFileSync("app/layout.tsx","utf8");
const tokensIndex=layout.indexOf('import "./design-tokens.css";');
const coreIndex=layout.indexOf('import "./ui-kit-core.css";');
if(tokensIndex<0||coreIndex<0||coreIndex<tokensIndex)throw new Error("UI Core CSS must load after Design Tokens");

console.log("DESWEB UI Kit Phase 2 core primitive checks passed.");
