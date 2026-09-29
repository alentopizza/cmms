import { createHash } from "crypto";
import { pool,query } from "@/lib/db";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type ManualInventoryMovementInput={
  organizationId:string;
  itemId:string;
  type:"receipt"|"issue"|"adjustment"|"return"|"transfer";
  quantity:number;
  unitCost:number|null;
  warehouseId:string;
  destinationWarehouseId:string|null;
  documentNumber:string|null;
  movementAt:string|null;
  createdBy:string|null;
  lotNumber:string|null;
  expiresAt:string|null;
  costCenter:string|null;
  notes:string|null;
  idempotencyKey:string;
};

export type ManualMovementResult={
  status:"created"|"replayed"|"conflict";
  transactionId:string|null;
};

export function readManualMovementIdempotencyKey(request:Request,form:FormData){
  const header=String(request.headers.get("idempotency-key")||"").trim();
  const field=String(form.get("idempotency_key")||"").trim();
  if(header&&field&&header.toLowerCase()!==field.toLowerCase())return null;
  const value=header||field;
  return UUID.test(value)?value.toLowerCase():null;
}

export function manualMovementPayloadHash(input:Omit<ManualInventoryMovementInput,"idempotencyKey">){
  return createHash("sha256").update(JSON.stringify({
    organization_id:input.organizationId,
    item_id:input.itemId,
    type:input.type,
    quantity:input.quantity,
    unit_cost:input.unitCost,
    warehouse_id:input.warehouseId,
    destination_warehouse_id:input.destinationWarehouseId,
    document_number:input.documentNumber,
    movement_at:input.movementAt,
    created_by:input.createdBy,
    lot_number:input.lotNumber,
    expires_at:input.expiresAt,
    cost_center:input.costCenter,
    notes:input.notes,
  })).digest("hex");
}

async function existingResult(organizationId:string,key:string,payloadHash:string):Promise<ManualMovementResult>{
  const existing=await query<{id:string;manual_payload_hash:string}>(
    `SELECT id,manual_payload_hash
     FROM inventory_transactions
     WHERE organization_id=$1 AND manual_idempotency_key=$2::uuid
     LIMIT 1`,
    [organizationId,key],
  );
  if(!existing.rowCount)return {status:"conflict",transactionId:null};
  const row=existing.rows[0];
  return row.manual_payload_hash===payloadHash
    ?{status:"replayed",transactionId:row.id}
    :{status:"conflict",transactionId:row.id};
}

export async function insertManualInventoryMovement(input:ManualInventoryMovementInput):Promise<ManualMovementResult>{
  const {idempotencyKey,...payload}=input;
  const payloadHash=manualMovementPayloadHash(payload);
  const client=await pool.connect();
  let committed=false;
  try{
    await client.query("BEGIN");
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
      [input.organizationId+"|manual_inventory|"+idempotencyKey],
    );

    const existing=await client.query<{id:string;manual_payload_hash:string}>(
      `SELECT id,manual_payload_hash
       FROM inventory_transactions
       WHERE organization_id=$1 AND manual_idempotency_key=$2::uuid
       LIMIT 1`,
      [input.organizationId,idempotencyKey],
    );
    if(existing.rowCount){
      const row=existing.rows[0];
      await client.query("COMMIT");
      committed=true;
      return row.manual_payload_hash===payloadHash
        ?{status:"replayed",transactionId:row.id}
        :{status:"conflict",transactionId:row.id};
    }

    const inserted=await client.query<{id:string}>(
      `INSERT INTO inventory_transactions(
         organization_id,item_id,type,quantity,unit_cost,warehouse_id,destination_warehouse_id,document_number,movement_at,
         created_by,lot_number,expires_at,cost_center,notes,manual_idempotency_key,manual_payload_hash
       ) VALUES(
         $1,$2,$3,$4,$5,$6,$7,$8,COALESCE($9::timestamptz,now()),
         $10,$11,$12,$13,$14,$15::uuid,$16
       ) RETURNING id`,
      [
        input.organizationId,input.itemId,input.type,input.quantity,input.unitCost,input.warehouseId,input.destinationWarehouseId,
        input.documentNumber,input.movementAt,input.createdBy,input.lotNumber,input.expiresAt,input.costCenter,input.notes,
        idempotencyKey,payloadHash,
      ],
    );

    await client.query("COMMIT");
    committed=true;
    return {status:"created",transactionId:inserted.rows[0].id};
  }catch(error){
    if(!committed)await client.query("ROLLBACK").catch(()=>{});
    if((error as {code?:string}).code==="23505"){
      return existingResult(input.organizationId,idempotencyKey,payloadHash);
    }
    throw error;
  }finally{
    client.release();
  }
}
