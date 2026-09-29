import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { canAccessOrganization } from "@/lib/organization-scope";
import { pool, query } from "@/lib/db";
import { publicUrl } from "@/lib/urls";
import { isSupportedCountry, isTaxIdTypeForCountry } from "@/lib/international-catalog";
import { readImageUpload, imageUploadMessage } from "@/lib/image-upload";
import { loadSupplierCommercialAnalytics } from "@/lib/supplier-analytics";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function target(id:string,url:string,suffix:string){
  return publicUrl(`/dashboard/suppliers?supplier=${encodeURIComponent(id)}${suffix}`,url);
}
function normalizedCodes(form:FormData,name:string){
  return [...new Set(form.getAll(name).map(value=>String(value).trim()).filter(Boolean))];
}
function legacySupplierType(capabilities:string[]){
  const materials=capabilities.includes("materials");
  const services=capabilities.some(code=>code!=="materials");
  if(materials&&services)return "both";
  return materials?"materials":"services";
}

async function accessibleSupplier(id:string,session:NonNullable<Awaited<ReturnType<typeof getSession>>>){
  const result=await query<{id:string;organization_id:string}>(
    "SELECT id,organization_id FROM suppliers WHERE id=$1",
    [id],
  );
  const supplier=result.rows[0]||null;
  if(!supplier||!canAccessOrganization(session,supplier.organization_id))return null;
  return supplier;
}

export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
  const session=await getSession();
  if(!session)return new NextResponse("Unauthorized",{status:401});
  if(!can(session,"suppliers.manage"))return new NextResponse("Forbidden",{status:403});
  const {id}=await params;
  if(!UUID.test(id))return new NextResponse("Proveedor inválido",{status:400});
  const supplierScope=await accessibleSupplier(id,session);
  if(!supplierScope)return new NextResponse("Proveedor no encontrado",{status:404});
  const organizationId=supplierScope.organization_id;
  const view=new URL(request.url).searchParams.get("view")||"general";

  if(view==="general"){
    const result=await query(
      `SELECT s.id,s.organization_id,o.name organization_name,COALESCE(o.default_country,o.legal_country) organization_country,
              s.code,s.name,s.legal_name,s.tax_id,s.tax_id_type,s.country_code,s.city,s.address,s.website,s.supplier_type,
              s.service_category,s.contact_name,s.contact_title,s.email,s.phone,s.notes,s.active,(s.logo_data IS NOT NULL) has_logo,
              COALESCE(capabilities.codes,ARRAY[]::text[]) capability_codes,
              COALESCE(capabilities.labels,ARRAY[]::text[]) capability_labels,
              COALESCE(specialties.codes,ARRAY[]::text[]) specialty_codes,
              COALESCE(specialties.labels,ARRAY[]::text[]) specialty_labels,
              sf.bank_name,sf.account_type,sf.account_number,sf.account_holder,sf.account_holder_tax_id,sf.payment_terms_days,
              sf.currency_code,sf.payment_email,sf.payment_notes
       FROM suppliers s
       JOIN organizations o ON o.id=s.organization_id
       LEFT JOIN supplier_financial_profiles sf ON sf.supplier_id=s.id
       LEFT JOIN LATERAL (
         SELECT array_agg(sc.capability_code ORDER BY cc.sort_order,cc.label) codes,
                array_agg(cc.label ORDER BY cc.sort_order,cc.label) labels
         FROM supplier_capabilities sc
         JOIN supplier_capability_catalog cc ON cc.code=sc.capability_code
         WHERE sc.supplier_id=s.id
       ) capabilities ON true
       LEFT JOIN LATERAL (
         SELECT array_agg(ss.specialty_code ORDER BY cs.sort_order,cs.label) codes,
                array_agg(cs.label ORDER BY cs.sort_order,cs.label) labels
         FROM supplier_specialties ss
         JOIN supplier_specialty_catalog cs ON cs.code=ss.specialty_code
         WHERE ss.supplier_id=s.id
       ) specialties ON true
       WHERE s.id=$1 AND s.organization_id=$2`,
      [id,organizationId],
    );
    return NextResponse.json({supplier:result.rows[0]||null});
  }

  if(view==="statistics"){
    const [operational,commercial]=await Promise.all([
      query<{
        supplier_return_count:number;supplier_return_quantity:string;procurement_document_count:number;
        procurement_document_pending:number;procurement_document_disputed:number;
      }>(
        `SELECT
           (SELECT count(*)::int FROM supplier_returns sr WHERE sr.supplier_id=$1) supplier_return_count,
           COALESCE((SELECT sum(sri.quantity) FROM supplier_returns sr JOIN supplier_return_items sri ON sri.return_id=sr.id WHERE sr.supplier_id=$1),0)::text supplier_return_quantity,
           (SELECT count(*)::int FROM procurement_documents pd WHERE pd.supplier_id=$1 AND pd.voided_at IS NULL) procurement_document_count,
           (SELECT count(*)::int FROM procurement_documents pd WHERE pd.supplier_id=$1 AND pd.voided_at IS NULL AND pd.review_status='pending') procurement_document_pending,
           (SELECT count(*)::int FROM procurement_documents pd WHERE pd.supplier_id=$1 AND pd.voided_at IS NULL AND pd.review_status='disputed') procurement_document_disputed`,
        [id],
      ),
      loadSupplierCommercialAnalytics([id]),
    ]);
    return NextResponse.json({
      operational:operational.rows[0],
      commercial:commercial.summaries[0]||null,
      trends:commercial.trends,
      requisitions:commercial.requisitions,
    });
  }

  if(view==="activities"){
    const result=await query(
      `SELECT wt.id,wt.service_supplier_id supplier_id,w.id work_order_id,w.number::text order_number,w.title order_title,
              wt.description,wt.status,wt.due_date::text,site.name site_name,l.name location_name
       FROM work_order_tasks wt
       JOIN work_orders w ON w.id=wt.work_order_id
       JOIN sites site ON site.id=w.site_id
       LEFT JOIN assets a ON a.id=w.asset_id
       LEFT JOIN locations l ON l.id=COALESCE(w.location_id,a.location_id)
       WHERE wt.service_supplier_id=$1 AND w.organization_id=$2
       ORDER BY w.requested_at DESC,wt.sort_order`,
      [id,organizationId],
    );
    return NextResponse.json({activities:result.rows});
  }

  if(view==="inventory"){
    const limitedInventoryScope=session.platformRole==="user"&&!session.accessAllSites;
    const itemQuantitySql=limitedInventoryScope
      ?"COALESCE((SELECT sum(sl.quantity) FROM inventory_stock_levels sl JOIN inventory_warehouses sw ON sw.id=sl.warehouse_id WHERE sl.item_id=i.id AND sw.site_id=ANY($3::uuid[])),0)::text"
      :"i.quantity::text";
    const itemSql=`SELECT i.id,i.supplier_id,p.name supplier_name,i.sku,i.name,i.description,i.presentation,i.unit,i.unit_cost::text,
                ${itemQuantitySql} quantity,i.min_quantity::text,i.max_quantity::text,i.site_id,i.location_id,i.category_id,
                CASE WHEN warehouse.id IS NULL THEN NULL ELSE i.warehouse_id END warehouse_id,
                i.storage_location,c.name category_name,warehouse.name warehouse_name,site.name site_name,l.name location_name,
                i.active,(i.image_data IS NOT NULL) has_image
         FROM inventory_items i
         JOIN suppliers p ON p.id=i.supplier_id
         LEFT JOIN sites site ON site.id=i.site_id
         LEFT JOIN locations l ON l.id=i.location_id
         LEFT JOIN inventory_categories c ON c.id=i.category_id
         LEFT JOIN inventory_warehouses warehouse ON warehouse.id=i.warehouse_id${limitedInventoryScope?" AND warehouse.site_id=ANY($3::uuid[])":""}
         WHERE i.supplier_id=$1 AND i.organization_id=$2 AND p.active=true AND p.supplier_type IN ('materials','both')
           ${limitedInventoryScope?"AND (i.site_id IS NULL OR i.site_id=ANY($3::uuid[]))":""}
         ORDER BY i.name`;
    const [items,sites,locations,categories,warehouses]=await Promise.all([
      limitedInventoryScope?query(itemSql,[id,organizationId,session.siteIds]):query(itemSql,[id,organizationId]),
      limitedInventoryScope
        ?query("SELECT id,organization_id,name FROM sites WHERE organization_id=$1 AND active=true AND id=ANY($2::uuid[]) ORDER BY name",[organizationId,session.siteIds])
        :query("SELECT id,organization_id,name FROM sites WHERE organization_id=$1 AND active=true ORDER BY name",[organizationId]),
      limitedInventoryScope
        ?query(
          `SELECT l.id,l.organization_id,l.site_id,l.name,site.name||' · '||l.name label
           FROM locations l JOIN sites site ON site.id=l.site_id
           WHERE l.organization_id=$1 AND l.active=true AND l.site_id=ANY($2::uuid[]) ORDER BY site.name,l.name`,
          [organizationId,session.siteIds],
        )
        :query(
          `SELECT l.id,l.organization_id,l.site_id,l.name,site.name||' · '||l.name label
           FROM locations l JOIN sites site ON site.id=l.site_id
           WHERE l.organization_id=$1 AND l.active=true ORDER BY site.name,l.name`,
          [organizationId],
        ),
      query("SELECT id,organization_id,name FROM inventory_categories WHERE organization_id=$1 AND active=true ORDER BY name",[organizationId]),
      limitedInventoryScope
        ?query("SELECT id,organization_id,site_id,location_id,name FROM inventory_warehouses WHERE organization_id=$1 AND active=true AND site_id=ANY($2::uuid[]) ORDER BY name",[organizationId,session.siteIds])
        :query("SELECT id,organization_id,site_id,location_id,name FROM inventory_warehouses WHERE organization_id=$1 AND active=true ORDER BY name",[organizationId]),
    ]);
    return NextResponse.json({
      items:items.rows,sites:sites.rows,locations:locations.rows,categories:categories.rows,warehouses:warehouses.rows,
    });
  }

  if(view==="requisitions"){
    const [requisitions,items]=await Promise.all([
      query(
        `SELECT r.id,r.supplier_id,r.number::text,r.status,r.created_at::text,r.needed_by::text,r.approval_required,r.approval_state,
                count(ri.id)::int item_count,COALESCE(sum(ri.quantity_requested*ri.unit_cost_estimated),0)::text total_estimated,
                COALESCE(sum(ri.quantity_requested),0)::text quantity_requested,
                COALESCE(sum(ri.quantity_received),0)::text quantity_received,
                COALESCE((SELECT sum(sri.quantity) FROM supplier_return_items sri JOIN supplier_returns sr ON sr.id=sri.return_id WHERE sr.requisition_id=r.id),0)::text quantity_returned,
                (SELECT count(*)::int FROM supplier_returns sr WHERE sr.requisition_id=r.id) return_count,
                (SELECT count(*)::int FROM procurement_documents pd WHERE pd.requisition_id=r.id AND pd.voided_at IS NULL) document_count,
                (SELECT count(*)::int FROM procurement_documents pd WHERE pd.requisition_id=r.id AND pd.voided_at IS NULL AND pd.review_status='pending') document_pending_review,
                (SELECT count(*)::int FROM procurement_documents pd WHERE pd.requisition_id=r.id AND pd.voided_at IS NULL AND pd.review_status='disputed') document_disputed
         FROM supplier_requisitions r
         LEFT JOIN supplier_requisition_items ri ON ri.requisition_id=r.id
         WHERE r.supplier_id=$1 AND r.organization_id=$2
         GROUP BY r.id
         ORDER BY r.created_at DESC`,
        [id,organizationId],
      ),
      query(
        `SELECT i.id,i.supplier_id,p.name supplier_name,i.sku,i.name,i.description,i.presentation,i.unit,i.unit_cost::text,
                i.quantity::text,i.min_quantity::text,i.max_quantity::text,i.site_id,i.location_id,i.category_id,i.warehouse_id,
                i.storage_location,c.name category_name,warehouse.name warehouse_name,site.name site_name,l.name location_name,
                i.active,(i.image_data IS NOT NULL) has_image
         FROM inventory_items i
         JOIN suppliers p ON p.id=i.supplier_id
         LEFT JOIN sites site ON site.id=i.site_id
         LEFT JOIN locations l ON l.id=i.location_id
         LEFT JOIN inventory_categories c ON c.id=i.category_id
         LEFT JOIN inventory_warehouses warehouse ON warehouse.id=i.warehouse_id
         WHERE i.supplier_id=$1 AND i.organization_id=$2 AND p.active=true AND p.supplier_type IN ('materials','both')
         ORDER BY i.name`,
        [id,organizationId],
      ),
    ]);
    return NextResponse.json({requisitions:requisitions.rows,items:items.rows});
  }

  return new NextResponse("Vista no soportada",{status:400});
}

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  const session=await getSession();
  if(!session)return new NextResponse("Unauthorized",{status:401});
  if(!can(session,"suppliers.manage"))return new NextResponse("Forbidden",{status:403});
  const {id}=await params;
  if(!UUID.test(id))return new NextResponse("Not found",{status:404});

  const supplier=await query<{organization_id:string}>("SELECT organization_id FROM suppliers WHERE id=$1",[id]);
  if(!supplier.rowCount)return new NextResponse("Proveedor no encontrado",{status:404});
  const organizationId=supplier.rows[0].organization_id;
  if(!canAccessOrganization(session,organizationId))return new NextResponse("Forbidden",{status:403});

  const form=await request.formData();
  const intent=String(form.get("intent")||"update");

  if(intent==="delete"){
    const deps=await query<{inventory_count:number;activity_count:number;requisition_count:number}>(
      `SELECT
        (SELECT count(*)::int FROM inventory_items WHERE supplier_id=$1) inventory_count,
        (SELECT count(*)::int FROM work_order_tasks WHERE service_supplier_id=$1) activity_count,
        (SELECT count(*)::int FROM supplier_requisitions WHERE supplier_id=$1) requisition_count`,
      [id],
    );
    const row=deps.rows[0];
    if((row.inventory_count||0)+(row.activity_count||0)+(row.requisition_count||0)>0){
      return NextResponse.redirect(target(id,request.url,"&error=history"),303);
    }
    await query("DELETE FROM suppliers WHERE id=$1 AND organization_id=$2",[id,organizationId]);
    return NextResponse.redirect(publicUrl("/dashboard/suppliers?deleted=1",request.url),303);
  }

  if(intent==="toggle"){
    const active=String(form.get("active")||"")==="true";
    await query("UPDATE suppliers SET active=$1,updated_at=now() WHERE id=$2 AND organization_id=$3",[active,id,organizationId]);
    return NextResponse.redirect(target(id,request.url,"&updated=1"),303);
  }

  if(intent==="financial"){
    const bankName=String(form.get("bank_name")||"").trim();
    const accountType=String(form.get("account_type")||"").trim();
    const accountNumber=String(form.get("account_number")||"").trim();
    const accountHolder=String(form.get("account_holder")||"").trim();
    const accountHolderTaxId=String(form.get("account_holder_tax_id")||"").trim();
    const paymentTermsRaw=String(form.get("payment_terms_days")||"").trim();
    const paymentTerms=paymentTermsRaw?Number(paymentTermsRaw):null;
    const currencyCode=String(form.get("currency_code")||"COP").trim().toUpperCase();
    const paymentEmail=String(form.get("payment_email")||"").trim().toLowerCase();
    const paymentNotes=String(form.get("payment_notes")||"").trim();
    if(accountType&&!["savings","checking","other"].includes(accountType))return NextResponse.redirect(target(id,request.url,"&tab=financial&error=required"),303);
    if(paymentTerms!==null&&(!Number.isInteger(paymentTerms)||paymentTerms<0||paymentTerms>365))return NextResponse.redirect(target(id,request.url,"&tab=financial&error=required"),303);
    if(!/^[A-Z]{3}$/.test(currencyCode))return NextResponse.redirect(target(id,request.url,"&tab=financial&error=required"),303);
    await query(
      `INSERT INTO supplier_financial_profiles(
        supplier_id,organization_id,bank_name,account_type,account_number,account_holder,account_holder_tax_id,
        payment_terms_days,currency_code,payment_email,payment_notes,updated_by,updated_at
      ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,now())
      ON CONFLICT(supplier_id) DO UPDATE SET
        bank_name=EXCLUDED.bank_name,account_type=EXCLUDED.account_type,account_number=EXCLUDED.account_number,
        account_holder=EXCLUDED.account_holder,account_holder_tax_id=EXCLUDED.account_holder_tax_id,
        payment_terms_days=EXCLUDED.payment_terms_days,currency_code=EXCLUDED.currency_code,
        payment_email=EXCLUDED.payment_email,payment_notes=EXCLUDED.payment_notes,
        updated_by=EXCLUDED.updated_by,updated_at=now()`,
      [id,organizationId,bankName||null,accountType||null,accountNumber||null,accountHolder||null,accountHolderTaxId||null,paymentTerms,currencyCode,paymentEmail||null,paymentNotes||null,session.userId],
    );
    return NextResponse.redirect(target(id,request.url,"&tab=financial&updated=1"),303);
  }

  const name=String(form.get("name")||"").trim();
  const legalName=String(form.get("legal_name")||"").trim();
  const capabilityCodes=normalizedCodes(form,"capability_codes");
  const specialtyCodes=normalizedCodes(form,"specialty_codes");
  const countryCode=String(form.get("country_code")||"").trim().toUpperCase();
  const city=String(form.get("city")||"").trim();
  const address=String(form.get("address")||"").trim();
  const taxIdType=String(form.get("tax_id_type")||"").trim();
  const taxId=String(form.get("tax_id")||"").trim();
  const website=String(form.get("website")||"").trim();
  const contactName=String(form.get("contact_name")||"").trim();
  const contactTitle=String(form.get("contact_title")||"").trim();
  const email=String(form.get("email")||"").trim().toLowerCase();
  const phone=String(form.get("phone")||"").trim();
  const notes=String(form.get("notes")||"").trim();
  const active=String(form.get("active")||"on")==="on";

  if(!name||!legalName||!city||!address||!capabilityCodes.length||!isSupportedCountry(countryCode)){
    return NextResponse.redirect(target(id,request.url,"&error=required"),303);
  }
  if((taxId||taxIdType)&&(!taxId||!taxIdType||!isTaxIdTypeForCountry(countryCode,taxIdType))){
    return NextResponse.redirect(target(id,request.url,"&error=required"),303);
  }

  let logo=null;
  try{logo=await readImageUpload(form,"logo");}
  catch(error){return NextResponse.redirect(target(id,request.url,"&error="+encodeURIComponent(imageUploadMessage(error)||"logo")),303);}

  const client=await pool.connect();
  try{
    await client.query("BEGIN");
    const validCapabilities=await client.query<{code:string;label:string}>(
      "SELECT code,label FROM supplier_capability_catalog WHERE active=true AND code=ANY($1::text[]) ORDER BY sort_order,label",
      [capabilityCodes],
    );
    const validSpecialties=specialtyCodes.length
      ?await client.query<{code:string;label:string}>(
        "SELECT code,label FROM supplier_specialty_catalog WHERE active=true AND code=ANY($1::text[]) ORDER BY sort_order,label",
        [specialtyCodes],
      )
      :{rows:[],rowCount:0};
    if(validCapabilities.rowCount!==capabilityCodes.length||validSpecialties.rowCount!==specialtyCodes.length){
      await client.query("ROLLBACK");
      return NextResponse.redirect(target(id,request.url,"&error=required"),303);
    }
    const supplierType=legacySupplierType(capabilityCodes);
    const serviceCategory=validSpecialties.rows.map(row=>row.label).join(", ")||null;

    await client.query(
      `UPDATE suppliers SET
        name=$1,legal_name=$2,supplier_type=$3,country_code=$4,city=$5,address=$6,tax_id_type=$7,tax_id=$8,
        service_category=$9,website=$10,contact_name=$11,contact_title=$12,email=$13,phone=$14,notes=$15,active=$16,
        logo_data=COALESCE($17,logo_data),
        logo_mime_type=CASE WHEN $17 IS NULL THEN logo_mime_type ELSE $18 END,
        logo_file_name=CASE WHEN $17 IS NULL THEN logo_file_name ELSE $19 END,
        updated_at=now()
       WHERE id=$20 AND organization_id=$21`,
      [
        name,legalName,supplierType,countryCode,city,address,taxIdType||null,taxId||null,
        serviceCategory,website||null,contactName||null,contactTitle||null,email||null,phone||null,notes||null,active,
        logo?.data||null,logo?.mime||null,logo?"supplier-logo":null,id,organizationId,
      ],
    );
    await client.query("DELETE FROM supplier_capabilities WHERE supplier_id=$1",[id]);
    await client.query("DELETE FROM supplier_specialties WHERE supplier_id=$1",[id]);
    for(const code of capabilityCodes){
      await client.query("INSERT INTO supplier_capabilities(supplier_id,organization_id,capability_code) VALUES($1,$2,$3)",[id,organizationId,code]);
    }
    for(const code of specialtyCodes){
      await client.query("INSERT INTO supplier_specialties(supplier_id,organization_id,specialty_code) VALUES($1,$2,$3)",[id,organizationId,code]);
    }
    await client.query("COMMIT");
  }catch(error){
    await client.query("ROLLBACK");
    throw error;
  }finally{
    client.release();
  }

  return NextResponse.redirect(target(id,request.url,"&updated=1"),303);
}
