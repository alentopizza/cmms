import fs from "node:fs";

const required=[
  "app/dashboard/companies/CompanyDirectory.tsx",
  "components/EntityProfileWorkspace.tsx",
  "components/CompanyDocumentWorkspace.tsx",
  "app/business-ui.css",
  "app/phase6-modules.css",
  "app/document-workspace.css",
];
for(const file of required)if(!fs.existsSync(file))throw new Error("Missing Company Documents layout file: "+file);

const companies=fs.readFileSync("app/dashboard/companies/CompanyDirectory.tsx","utf8");
if(!companies.includes('fullWidthTabIds={["documents"]}'))throw new Error("Company profile must mark only Documents as the full-width tab");
if((companies.match(/fullWidthTabIds=/g)||[]).length!==1)throw new Error("Company profile should have one explicit full-width tab configuration");

const profile=fs.readFileSync("components/EntityProfileWorkspace.tsx","utf8");
for(const marker of ["fullWidthTabIds = []","fullWidthTabIds.includes(active.id)","entity-profile-wide-tab","data-active-tab={active?.id||undefined}"]){
  if(!profile.includes(marker))throw new Error("Entity profile full-width contract missing "+marker);
}

const workspace=fs.readFileSync("components/CompanyDocumentWorkspace.tsx","utf8");
for(const marker of ["company-document-workspace-v2","function DocumentViewer","viewerDocumentId","openDocument(id:string)",'title="Ver documento"',"company-document-modal","<Modal",'mode="context"','mode="modal"',"Descargar documento","Imprimir documento","Más acciones"]){
  if(!workspace.includes(marker))throw new Error("Document workspace UX contract missing "+marker);
}
if((workspace.match(/<DocumentViewer/g)||[]).length<2)throw new Error("Context preview and full modal must reuse the same DocumentViewer");
for(const forbidden of ["Compartir documento","shareDocument","shareSelected","shareMessage","navigator.share"]){
  if(workspace.includes(forbidden))throw new Error("Removed Share action leaked into Company Documents: "+forbidden);
}
for(const marker of [
  "const [zoom,setZoom]=useState(100)",
  "const [fit,setFit]=useState(true)",
  "const [rotation,setRotation]=useState(0)",
  "const [previewLoading,setPreviewLoading]=useState(false)",
  "const [previewError,setPreviewError]=useState(false)",
]){
  if(!workspace.includes(marker))throw new Error("DocumentViewer local state contract missing "+marker);
}

const businessCss=fs.readFileSync("app/business-ui.css","utf8");
if(/#[0-9a-fA-F]{3,8}\b/.test(businessCss))throw new Error("Business UI CSS must remain token-only");

const phase6Css=fs.readFileSync("app/phase6-modules.css","utf8");
for(const marker of ["grid-template-columns:minmax(360px,40%) minmax(0,60%)","grid-template-columns:minmax(330px,45%) minmax(0,55%)","@media(max-width:900px)"]){
  if(!phase6Css.includes(marker))throw new Error("Company Documents full-width CSS missing "+marker);
}
if(/#[0-9a-fA-F]{3,8}\b/.test(phase6Css))throw new Error("Phase 6 CSS must remain token-only");

const documentCss=fs.readFileSync("app/document-workspace.css","utf8");
for(const marker of [".company-document-workspace-v2","grid-template-columns:minmax(360px,40%) minmax(0,60%)",".company-document-modal",".company-document-modal-body",".company-document-viewer-modal","@media(max-width:900px)",".company-document-list-panel{order:1",".company-document-preview-panel{order:2"]){
  if(!documentCss.includes(marker))throw new Error("Responsive document viewer contract missing "+marker);
}
if(documentCss.includes(".company-document-share-message"))throw new Error("Share-only CSS must be removed");
if(/#[0-9a-fA-F]{3,8}\b/.test(documentCss))throw new Error("Document workspace CSS must remain token-only");

console.log("Company Documents preview/list/modal UX checks passed.");
