"use client";

import { useEffect, useId, useRef, useState } from "react";
import UiIcon from "@/components/UiIcon";

export type FileUploadKind="image"|"document"|"file";
export type FileUploadProps={
  name?:string;
  id?:string;
  label:string;
  description?:string;
  accept:string;
  maxSizeMb:number;
  required?:boolean;
  disabled?:boolean;
  kind?:FileUploadKind;
  compact?:boolean;
  existingFileName?:string|null;
  existingPreviewUrl?:string|null;
  buttonLabel?:string;
  onFileChange?:(file:File|null)=>void;
};

function bytesLabel(bytes:number){
  if(bytes<1024)return `${bytes} B`;
  if(bytes<1024*1024)return `${(bytes/1024).toFixed(1)} KB`;
  return `${(bytes/1024/1024).toFixed(1)} MB`;
}
function acceptsFile(file:File,accept:string){
  const rules=accept.split(",").map(rule=>rule.trim().toLowerCase()).filter(Boolean);
  if(!rules.length)return true;
  const mime=file.type.toLowerCase(),name=file.name.toLowerCase();
  return rules.some(rule=>rule.startsWith(".")?name.endsWith(rule):rule.endsWith("/*")?mime.startsWith(rule.slice(0,-1)):mime===rule);
}
function typeLabel(accept:string){
  const values=accept.split(",").map(item=>item.trim().toLowerCase()).filter(Boolean).map(item=>{
    if(item.includes("pdf"))return "PDF";
    if(item.includes("png")||item===".png")return "PNG";
    if(item.includes("jpeg")||item===".jpg"||item===".jpeg")return "JPG";
    if(item.includes("webp")||item===".webp")return "WebP";
    if(item.includes("svg")||item===".svg")return "SVG";
    if(item.includes("icon")||item===".ico")return "ICO";
    return "";
  }).filter(Boolean);
  return [...new Set(values)].join(", ");
}

async function optimizeImageUpload(file:File){
  if(!file.type.startsWith("image/")||typeof createImageBitmap!=="function")return file;
  try{
    const bitmap=await createImageBitmap(file);
    const maxDimension=1600;
    const scale=Math.min(1,maxDimension/Math.max(bitmap.width,bitmap.height));
    const width=Math.max(1,Math.round(bitmap.width*scale));
    const height=Math.max(1,Math.round(bitmap.height*scale));
    const shouldOptimize=scale<1||file.size>900*1024;
    if(!shouldOptimize){bitmap.close();return file;}
    const canvas=document.createElement("canvas");
    canvas.width=width;
    canvas.height=height;
    const context=canvas.getContext("2d");
    if(!context){bitmap.close();return file;}
    context.imageSmoothingEnabled=true;
    context.imageSmoothingQuality="high";
    context.drawImage(bitmap,0,0,width,height);
    bitmap.close();
    const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,"image/webp",0.82));
    if(!blob||blob.size>=file.size)return file;
    const base=file.name.replace(/\.[^.]+$/,"")||"imagen";
    return new File([blob],base+".webp",{type:"image/webp",lastModified:file.lastModified});
  }catch{
    return file;
  }
}

export function FileUpload({
  name,id,label,description,accept,maxSizeMb,required=false,disabled=false,kind="file",compact=false,
  existingFileName,existingPreviewUrl,buttonLabel="Seleccionar archivo",onFileChange,
}:FileUploadProps){
  const generated=useId();
  const inputId=id||"ds-file-"+generated.replace(/:/g,"");
  const inputRef=useRef<HTMLInputElement>(null);
  const [selected,setSelected]=useState<File|null>(null);
  const [dragging,setDragging]=useState(false);
  const [error,setError]=useState("");
  const [preview,setPreview]=useState("");
  const [processing,setProcessing]=useState(false);

  useEffect(()=>{
    if(!selected||!selected.type.startsWith("image/")){setPreview("");return;}
    const url=URL.createObjectURL(selected);
    setPreview(url);
    return()=>URL.revokeObjectURL(url);
  },[selected]);

  function resetNative(){if(inputRef.current)inputRef.current.value="";}
  async function apply(file:File|null,assign=false){
    setError("");
    if(!file){setSelected(null);resetNative();onFileChange?.(null);return;}
    if(!acceptsFile(file,accept)){setSelected(null);resetNative();setError(`Formato no permitido. Usa: ${typeLabel(accept)||"un formato compatible"}.`);onFileChange?.(null);return;}
    if(file.size>maxSizeMb*1024*1024){setSelected(null);resetNative();setError(`El archivo supera el máximo permitido de ${maxSizeMb} MB.`);onFileChange?.(null);return;}
    setProcessing(kind==="image");
    const prepared=kind==="image"?await optimizeImageUpload(file):file;
    setProcessing(false);
    if(prepared.size>maxSizeMb*1024*1024){setSelected(null);resetNative();setError(`El archivo supera el máximo permitido de ${maxSizeMb} MB.`);onFileChange?.(null);return;}
    if((assign||prepared!==file)&&inputRef.current){
      const transfer=new DataTransfer();
      transfer.items.add(prepared);
      inputRef.current.files=transfer.files;
    }
    setSelected(prepared);onFileChange?.(prepared);
  }
  function drop(event:React.DragEvent<HTMLDivElement>){
    event.preventDefault();setDragging(false);if(disabled)return;void apply(event.dataTransfer.files?.[0]||null,true);
  }

  const savedName=selected?.name||existingFileName||"";
  const previewUrl=preview||(!selected?existingPreviewUrl||"":"");
  const formats=typeLabel(accept);

  return <div className={["ds-file-upload-field",compact?"compact":"",error?"has-error":""].filter(Boolean).join(" ")}>
    <div
      className={["ds-file-upload",dragging?"is-dragging":"",selected?"has-file":"",disabled?"is-disabled":""].filter(Boolean).join(" ")}
      role="button"
      tabIndex={disabled?-1:0}
      aria-disabled={disabled}
      aria-describedby={inputId+"-help"}
      onClick={()=>!disabled&&!processing&&inputRef.current?.click()}
      onKeyDown={event=>{if(!disabled&&!processing&&(event.key==="Enter"||event.key===" ")){event.preventDefault();inputRef.current?.click();}}}
      onDragEnter={event=>{event.preventDefault();if(!disabled)setDragging(true);}}
      onDragOver={event=>event.preventDefault()}
      onDragLeave={event=>{if(event.currentTarget===event.target)setDragging(false);}}
      onDrop={drop}
    >
      <input
        ref={inputRef}
        id={inputId}
        className="ds-file-upload-native"
        type="file"
        name={name}
        accept={accept}
        required={required}
        disabled={disabled}
        onChange={event=>{void apply(event.target.files?.[0]||null);}}
      />

      <span className={["ds-file-upload-preview",previewUrl?"has-preview":""].filter(Boolean).join(" ")} aria-hidden="true">
        {previewUrl?<img src={previewUrl} alt=""/>:<UiIcon name={kind==="image"?"asset":"file"} size={26}/>}
      </span>

      <div className="ds-file-upload-copy">
        <span>{required?"Archivo obligatorio":"Archivo opcional"}</span>
        <strong>{label}{required?" *":""}</strong>
        <p>{processing?"Optimizando imagen antes de subir…":selected?"Archivo reconocido y listo para guardar.":existingFileName?"Archivo guardado. Puedes reemplazarlo.":"Arrastra y suelta aquí o selecciona desde tu equipo."}</p>
        <div className="ds-file-upload-meta" id={inputId+"-help"}>
          {selected?<><span>{selected.name}</span><span>{bytesLabel(selected.size)}</span></>
            :existingFileName?<span>Actual: {existingFileName}</span>
            :<><span>{formats||"Archivo compatible"}</span><span>Máx. {maxSizeMb} MB</span></>}
        </div>
        {(selected||existingFileName)&&<div className="ds-file-upload-file">
          <div><UiIcon name="file" size={16}/><span><strong title={savedName}>{savedName}</strong><small>{selected?"Listo para guardar":"Guardado correctamente"}</small></span></div>
          <UiIcon name="check" size={16}/>
        </div>}
        {description&&<small>{description}</small>}
      </div>

      <div className="ds-file-upload-actions">
        <span>{processing?"Procesando…":selected?"Cambiar archivo":buttonLabel}</span>
        {selected&&!processing&&<button type="button" onClick={event=>{event.stopPropagation();void apply(null);}}>Quitar</button>}
      </div>
    </div>
    {error&&<small className="ds-field-feedback" role="alert"><UiIcon name="error" size={13}/><span>{error}</span></small>}
  </div>;
}
