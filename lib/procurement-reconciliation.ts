import type { PoolClient } from "pg";
import { query } from "@/lib/db";

export type ProcurementDocumentType="purchase_order"|"delivery_note"|"invoice"|"credit_note"|"other";
export type ProcurementReviewStatus="pending"|"verified"|"exception_accepted"|"disputed";
export type ProcurementMatchState="matched"|"difference"|"pending_evidence"|"informational"|"voided";

export type ProcurementDocumentSummary={
  id:string;organization_id:string;supplier_id:string;requisition_id:string;document_type:ProcurementDocumentType;
  document_number:string;issue_date:string|null;currency_code:string|null;subtotal:string;tax_total:string;total:string;notes:string|null;
  file_mime_type:string;file_name:string;file_size_bytes:string;review_status:ProcurementReviewStatus;review_notes:string|null;
  reviewed_at:string|null;reviewed_by_name:string|null;voided_at:string|null;void_reason:string|null;created_at:string;created_by_name:string|null;
  line_count:number;document_quantity:string;document_value:string;receipt_count:number;receipt_ids:string[];receipt_quantity:string;receipt_value:string;
  return_count:number;return_ids:string[];return_quantity:string;return_value:string;requested_quantity:string;requested_value:string;
  match_state:ProcurementMatchState;expected_quantity:number|null;expected_value:number|null;quantity_difference:number|null;value_difference:number|null;
};

export type ProcurementDocumentLine={
  id:string;document_id:string;requisition_item_id:string;sku:string;description:string;unit:string;quantity:string;unit_cost:string;line_total:string;
  expected_quantity:number|null;expected_value:number|null;quantity_difference:number|null;value_difference:number|null;match_state:"matched"|"difference"|"pending_evidence"|"informational";
};

export type ProcurementDocumentEvent={
  id:string;document_id:string;action:"uploaded"|"verified"|"exception_accepted"|"disputed"|"voided";actor_label:string;notes:string|null;metadata:Record<string,unknown>;created_at:string;
};

const QTY_TOLERANCE=.001;
const VALUE_TOLERANCE=.01;

export function procurementDocumentTypeLabel(type:ProcurementDocumentType){
  return ({purchase_order:"Orden de compra",delivery_note:"Remisión / entrega",invoice:"Factura",credit_note:"Nota crédito",other:"Otro documento"} as Record<ProcurementDocumentType,string>)[type];
}

export function procurementReviewLabel(status:ProcurementReviewStatus){
  return ({pending:"Pendiente de revisión",verified:"Verificado",exception_accepted:"Excepción aceptada",disputed:"En disputa"} as Record<ProcurementReviewStatus,string>)[status];
}

export function procurementMatchLabel(state:ProcurementMatchState){
  return ({matched:"Coincide",difference:"Con diferencia",pending_evidence:"Pendiente de evidencia",informational:"Informativo",voided:"Anulado"} as Record<ProcurementMatchState,string>)[state];
}

export function deriveProcurementDocumentMatch(row:Omit<ProcurementDocumentSummary,"match_state"|"expected_quantity"|"expected_value"|"quantity_difference"|"value_difference">){
  if(row.voided_at)return {match_state:"voided" as const,expected_quantity:null,expected_value:null,quantity_difference:null,value_difference:null};
  const lineCount=Number(row.line_count||0);
  const documentQuantity=Number(row.document_quantity||0);
  const documentValue=Number(row.document_value||0);

  let expectedQuantity:number|null=null;
  let expectedValue:number|null=null;
  let evidenceReady=true;
  let compareValue=true;

  if(row.document_type==="purchase_order"){
    expectedQuantity=Number(row.requested_quantity||0);
    expectedValue=Number(row.requested_value||0);
  }else if(row.document_type==="delivery_note"){
    expectedQuantity=Number(row.receipt_quantity||0);
    expectedValue=null;
    evidenceReady=Number(row.receipt_count||0)>0;
    compareValue=false;
  }else if(row.document_type==="invoice"){
    expectedQuantity=Number(row.receipt_quantity||0);
    expectedValue=Number(row.receipt_value||0);
    evidenceReady=Number(row.receipt_count||0)>0;
  }else if(row.document_type==="credit_note"){
    expectedQuantity=Number(row.return_quantity||0);
    expectedValue=Number(row.return_value||0);
    evidenceReady=Number(row.return_count||0)>0;
  }else{
    return {match_state:"informational" as const,expected_quantity:null,expected_value:null,quantity_difference:null,value_difference:null};
  }

  if(!lineCount||!evidenceReady){
    return {
      match_state:"pending_evidence" as const,
      expected_quantity:expectedQuantity,expected_value:expectedValue,
      quantity_difference:expectedQuantity===null?null:documentQuantity-expectedQuantity,
      value_difference:expectedValue===null?null:documentValue-expectedValue,
    };
  }

  const quantityDifference=documentQuantity-(expectedQuantity||0);
  const valueDifference=expectedValue===null?null:documentValue-expectedValue;
  const quantityMatch=Math.abs(quantityDifference)<=QTY_TOLERANCE;
  const valueMatch=!compareValue||valueDifference===null||Math.abs(valueDifference)<=VALUE_TOLERANCE;
  return {
    match_state:quantityMatch&&valueMatch?"matched" as const:"difference" as const,
    expected_quantity:expectedQuantity,expected_value:expectedValue,
    quantity_difference:quantityDifference,value_difference:valueDifference,
  };
}

export async function loadProcurementReconciliation(requisitionId:string){
  const documents=await query<Omit<ProcurementDocumentSummary,"match_state"|"expected_quantity"|"expected_value"|"quantity_difference"|"value_difference">>(
    `SELECT pd.id,pd.organization_id,pd.supplier_id,pd.requisition_id,pd.document_type,pd.document_number,
            pd.issue_date::text,pd.currency_code,pd.subtotal::text,pd.tax_total::text,pd.total::text,pd.notes,
            pd.file_mime_type,pd.file_name,pd.file_size_bytes::text,pd.review_status,pd.review_notes,pd.reviewed_at::text,
            reviewer.full_name reviewed_by_name,pd.voided_at::text,pd.void_reason,pd.created_at::text,creator.full_name created_by_name,
            COALESCE((SELECT count(*) FROM procurement_document_lines l WHERE l.document_id=pd.id),0)::int line_count,
            COALESCE((SELECT sum(l.quantity) FROM procurement_document_lines l WHERE l.document_id=pd.id),0)::text document_quantity,
            COALESCE((SELECT sum(l.line_total) FROM procurement_document_lines l WHERE l.document_id=pd.id),0)::text document_value,
            COALESCE((SELECT count(*) FROM procurement_document_receipts pr WHERE pr.document_id=pd.id),0)::int receipt_count,
            COALESCE((SELECT array_agg(pr.receipt_transaction_id) FROM procurement_document_receipts pr WHERE pr.document_id=pd.id),ARRAY[]::uuid[]) receipt_ids,
            COALESCE((SELECT sum(abs(t.quantity)) FROM procurement_document_receipts pr JOIN inventory_transactions t ON t.id=pr.receipt_transaction_id WHERE pr.document_id=pd.id),0)::text receipt_quantity,
            COALESCE((SELECT sum(abs(t.quantity)*COALESCE(t.unit_cost,ri.unit_cost_estimated,0))
                      FROM procurement_document_receipts pr
                      JOIN inventory_transactions t ON t.id=pr.receipt_transaction_id
                      JOIN supplier_requisition_items ri ON ri.id=t.requisition_item_id
                      WHERE pr.document_id=pd.id),0)::text receipt_value,
            COALESCE((SELECT count(*) FROM procurement_document_returns pdr WHERE pdr.document_id=pd.id),0)::int return_count,
            COALESCE((SELECT array_agg(pdr.supplier_return_id) FROM procurement_document_returns pdr WHERE pdr.document_id=pd.id),ARRAY[]::uuid[]) return_ids,
            COALESCE((SELECT sum(sri.quantity)
                      FROM procurement_document_returns pdr
                      JOIN supplier_return_items sri ON sri.return_id=pdr.supplier_return_id
                      WHERE pdr.document_id=pd.id),0)::text return_quantity,
            COALESCE((SELECT sum(sri.quantity*sri.unit_cost)
                      FROM procurement_document_returns pdr
                      JOIN supplier_return_items sri ON sri.return_id=pdr.supplier_return_id
                      WHERE pdr.document_id=pd.id),0)::text return_value,
            COALESCE((SELECT sum(ri.quantity_requested) FROM supplier_requisition_items ri WHERE ri.requisition_id=pd.requisition_id),0)::text requested_quantity,
            COALESCE((SELECT sum(ri.quantity_requested*ri.unit_cost_estimated) FROM supplier_requisition_items ri WHERE ri.requisition_id=pd.requisition_id),0)::text requested_value
     FROM procurement_documents pd
     LEFT JOIN users creator ON creator.id=pd.created_by
     LEFT JOIN users reviewer ON reviewer.id=pd.reviewed_by
     WHERE pd.requisition_id=$1
     ORDER BY pd.voided_at NULLS FIRST,pd.created_at DESC`,
    [requisitionId],
  );

  const summaries:ProcurementDocumentSummary[]=documents.rows.map(row=>({...row,...deriveProcurementDocumentMatch(row)}));

  const lines=await query<{
    id:string;document_id:string;document_type:ProcurementDocumentType;requisition_item_id:string;sku:string;description:string;unit:string;
    quantity:string;unit_cost:string;line_total:string;requested_quantity:string;requested_value:string;receipt_quantity:string;receipt_value:string;
    return_quantity:string;return_value:string;receipt_count:number;return_count:number;
  }>(
    `SELECT l.id,l.document_id,pd.document_type,l.requisition_item_id,l.sku,l.description,l.unit,l.quantity::text,l.unit_cost::text,l.line_total::text,
            ri.quantity_requested::text requested_quantity,(ri.quantity_requested*ri.unit_cost_estimated)::text requested_value,
            COALESCE((SELECT sum(abs(t.quantity))
                      FROM procurement_document_receipts pr
                      JOIN inventory_transactions t ON t.id=pr.receipt_transaction_id
                      WHERE pr.document_id=pd.id AND t.requisition_item_id=l.requisition_item_id),0)::text receipt_quantity,
            COALESCE((SELECT sum(abs(t.quantity)*COALESCE(t.unit_cost,ri2.unit_cost_estimated,0))
                      FROM procurement_document_receipts pr
                      JOIN inventory_transactions t ON t.id=pr.receipt_transaction_id
                      JOIN supplier_requisition_items ri2 ON ri2.id=t.requisition_item_id
                      WHERE pr.document_id=pd.id AND t.requisition_item_id=l.requisition_item_id),0)::text receipt_value,
            COALESCE((SELECT sum(sri.quantity)
                      FROM procurement_document_returns pdr
                      JOIN supplier_return_items sri ON sri.return_id=pdr.supplier_return_id
                      WHERE pdr.document_id=pd.id AND sri.requisition_item_id=l.requisition_item_id),0)::text return_quantity,
            COALESCE((SELECT sum(sri.quantity*sri.unit_cost)
                      FROM procurement_document_returns pdr
                      JOIN supplier_return_items sri ON sri.return_id=pdr.supplier_return_id
                      WHERE pdr.document_id=pd.id AND sri.requisition_item_id=l.requisition_item_id),0)::text return_value,
            COALESCE((SELECT count(*) FROM procurement_document_receipts pr JOIN inventory_transactions t ON t.id=pr.receipt_transaction_id
                      WHERE pr.document_id=pd.id AND t.requisition_item_id=l.requisition_item_id),0)::int receipt_count,
            COALESCE((SELECT count(*) FROM procurement_document_returns pdr JOIN supplier_return_items sri ON sri.return_id=pdr.supplier_return_id
                      WHERE pdr.document_id=pd.id AND sri.requisition_item_id=l.requisition_item_id),0)::int return_count
     FROM procurement_document_lines l
     JOIN procurement_documents pd ON pd.id=l.document_id
     JOIN supplier_requisition_items ri ON ri.id=l.requisition_item_id
     WHERE pd.requisition_id=$1
     ORDER BY pd.created_at DESC,l.sku`,
    [requisitionId],
  );

  const mappedLines:ProcurementDocumentLine[]=lines.rows.map(row=>{
    let expectedQuantity:number|null=null;
    let expectedValue:number|null=null;
    let ready=true;
    let compareValue=true;
    if(row.document_type==="purchase_order"){
      expectedQuantity=Number(row.requested_quantity||0);
      expectedValue=Number(row.requested_value||0);
    }else if(row.document_type==="delivery_note"){
      expectedQuantity=Number(row.receipt_quantity||0);
      expectedValue=null;
      ready=Number(row.receipt_count||0)>0;
      compareValue=false;
    }else if(row.document_type==="invoice"){
      expectedQuantity=Number(row.receipt_quantity||0);
      expectedValue=Number(row.receipt_value||0);
      ready=Number(row.receipt_count||0)>0;
    }else if(row.document_type==="credit_note"){
      expectedQuantity=Number(row.return_quantity||0);
      expectedValue=Number(row.return_value||0);
      ready=Number(row.return_count||0)>0;
    }else{
      return {...row,expected_quantity:null,expected_value:null,quantity_difference:null,value_difference:null,match_state:"informational" as const};
    }
    const qtyDiff=Number(row.quantity||0)-(expectedQuantity||0);
    const valueDiff=expectedValue===null?null:Number(row.line_total||0)-expectedValue;
    const matched=ready&&Math.abs(qtyDiff)<=QTY_TOLERANCE&&(!compareValue||valueDiff===null||Math.abs(valueDiff)<=VALUE_TOLERANCE);
    return {
      ...row,
      expected_quantity:expectedQuantity,
      expected_value:expectedValue,
      quantity_difference:qtyDiff,
      value_difference:valueDiff,
      match_state:!ready?"pending_evidence" as const:matched?"matched" as const:"difference" as const,
    };
  });

  const events=await query<ProcurementDocumentEvent>(
    `SELECT id,document_id,action,actor_label,notes,metadata,created_at::text
     FROM procurement_document_events
     WHERE document_id IN (SELECT id FROM procurement_documents WHERE requisition_id=$1)
     ORDER BY created_at DESC`,
    [requisitionId],
  );

  return {documents:summaries,lines:mappedLines,events:events.rows};
}


export async function loadProcurementDocumentMatchForUpdate(client:PoolClient,documentId:string){
  const result=await client.query<Omit<ProcurementDocumentSummary,"match_state"|"expected_quantity"|"expected_value"|"quantity_difference"|"value_difference">>(
    `SELECT pd.id,pd.organization_id,pd.supplier_id,pd.requisition_id,pd.document_type,pd.document_number,
            pd.issue_date::text,pd.currency_code,pd.subtotal::text,pd.tax_total::text,pd.total::text,pd.notes,
            pd.file_mime_type,pd.file_name,pd.file_size_bytes::text,pd.review_status,pd.review_notes,pd.reviewed_at::text,
            reviewer.full_name reviewed_by_name,pd.voided_at::text,pd.void_reason,pd.created_at::text,creator.full_name created_by_name,
            COALESCE((SELECT count(*) FROM procurement_document_lines l WHERE l.document_id=pd.id),0)::int line_count,
            COALESCE((SELECT sum(l.quantity) FROM procurement_document_lines l WHERE l.document_id=pd.id),0)::text document_quantity,
            COALESCE((SELECT sum(l.line_total) FROM procurement_document_lines l WHERE l.document_id=pd.id),0)::text document_value,
            COALESCE((SELECT count(*) FROM procurement_document_receipts pr WHERE pr.document_id=pd.id),0)::int receipt_count,
            COALESCE((SELECT array_agg(pr.receipt_transaction_id) FROM procurement_document_receipts pr WHERE pr.document_id=pd.id),ARRAY[]::uuid[]) receipt_ids,
            COALESCE((SELECT sum(abs(t.quantity)) FROM procurement_document_receipts pr JOIN inventory_transactions t ON t.id=pr.receipt_transaction_id WHERE pr.document_id=pd.id),0)::text receipt_quantity,
            COALESCE((SELECT sum(abs(t.quantity)*COALESCE(t.unit_cost,ri.unit_cost_estimated,0))
                      FROM procurement_document_receipts pr
                      JOIN inventory_transactions t ON t.id=pr.receipt_transaction_id
                      JOIN supplier_requisition_items ri ON ri.id=t.requisition_item_id
                      WHERE pr.document_id=pd.id),0)::text receipt_value,
            COALESCE((SELECT count(*) FROM procurement_document_returns pdr WHERE pdr.document_id=pd.id),0)::int return_count,
            COALESCE((SELECT array_agg(pdr.supplier_return_id) FROM procurement_document_returns pdr WHERE pdr.document_id=pd.id),ARRAY[]::uuid[]) return_ids,
            COALESCE((SELECT sum(sri.quantity) FROM procurement_document_returns pdr JOIN supplier_return_items sri ON sri.return_id=pdr.supplier_return_id WHERE pdr.document_id=pd.id),0)::text return_quantity,
            COALESCE((SELECT sum(sri.quantity*sri.unit_cost) FROM procurement_document_returns pdr JOIN supplier_return_items sri ON sri.return_id=pdr.supplier_return_id WHERE pdr.document_id=pd.id),0)::text return_value,
            COALESCE((SELECT sum(ri.quantity_requested) FROM supplier_requisition_items ri WHERE ri.requisition_id=pd.requisition_id),0)::text requested_quantity,
            COALESCE((SELECT sum(ri.quantity_requested*ri.unit_cost_estimated) FROM supplier_requisition_items ri WHERE ri.requisition_id=pd.requisition_id),0)::text requested_value
     FROM procurement_documents pd
     LEFT JOIN users creator ON creator.id=pd.created_by
     LEFT JOIN users reviewer ON reviewer.id=pd.reviewed_by
     WHERE pd.id=$1
     FOR UPDATE OF pd`,
    [documentId],
  );
  if(!result.rowCount)return null;
  const row=result.rows[0];
  return {...row,...deriveProcurementDocumentMatch(row)} as ProcurementDocumentSummary;
}
