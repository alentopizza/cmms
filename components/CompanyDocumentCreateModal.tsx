"use client";

import { useState } from "react";
import FileDropzone from "@/components/FileDropzone";
import { ORGANIZATION_DOCUMENT_CATEGORIES } from "@/lib/organization-document-catalog";
import { Modal } from "@/components/ui-kit/Overlay";
import { Button } from "@/components/ui-kit/Button";

export default function CompanyDocumentCreateModal({
  organizationId,
  organizationName,
  returnTo,
  triggerLabel="Cargar documento",
}:{
  organizationId:string;
  organizationName:string;
  returnTo:string;
  triggerLabel?:string;
}){
  const [open,setOpen]=useState(false);
  return <>
    <Button iconLeft="upload" onClick={()=>setOpen(true)}>{triggerLabel}</Button>
    <Modal
      open={open}
      onClose={()=>setOpen(false)}
      title="Cargar documento"
      eyebrow="Expediente empresarial"
      description={"El documento quedará asociado directamente a "+organizationName+"."}
      size="lg"
    >
      <form className="form-grid company-document-create-form" method="post" action={"/api/organizations/"+organizationId+"/documents"} encType="multipart/form-data">
        <input type="hidden" name="return_to" value={returnTo}/>
        <div className="field"><label>Categoría</label>
          <select name="category" defaultValue="tax">
            {Object.entries(ORGANIZATION_DOCUMENT_CATEGORIES).map(([value,label])=><option key={value} value={value}>{label}</option>)}
          </select>
        </div>
        <div className="field"><label>Nivel</label>
          <select name="requirement_level" defaultValue="optional">
            <option value="required">Requerido</option>
            <option value="optional">Opcional</option>
            <option value="not_applicable">No aplica</option>
          </select>
        </div>
        <div className="field form-span-2"><label>Nombre del documento</label><input name="display_name" placeholder="Ej. RUT actualizado 2026"/></div>
        <div className="field"><label>Número / referencia</label><input name="reference"/></div>
        <div className="field"><label>Fecha de emisión</label><input name="issue_date" type="date"/></div>
        <div className="field"><label>Fecha de vencimiento</label><input name="expires_at" type="date"/></div>
        <div className="form-span-2"><FileDropzone name="file" label="Archivo del documento" description="Adjunta PDF o imagen del soporte corporativo." accept="application/pdf,image/png,image/jpeg,image/webp" maxSizeMb={10} kind="document"/></div>
        <div className="field form-span-2"><label>Observaciones</label><textarea name="notes" rows={3}/></div>
        <div className="form-span-2 form-actions">
          <Button type="button" variant="secondary" onClick={()=>setOpen(false)}>Cancelar</Button>
          <Button type="submit" iconLeft="upload">Guardar documento</Button>
        </div>
      </form>
    </Modal>
  </>;
}
