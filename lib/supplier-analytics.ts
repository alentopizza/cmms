import { query } from "@/lib/db";

export type SupplierCommercialAnalytics={
  supplier_id:string;
  received_requisitions:number;
  completed_requisitions:number;
  partial_requisitions:number;
  quantity_fulfillment_pct:number|null;
  average_lead_time_days:number|null;
  on_time_complete_pct:number|null;
  on_time_sample:number;
  price_variance_pct:number|null;
  estimated_received_value:number;
  actual_received_value:number;
  price_sample_lines:number;
  latest_receipt_at:string|null;
};

export type SupplierCommercialTrend={
  supplier_id:string;
  month:string;
  received_requisitions:number;
  quantity_fulfillment_pct:number|null;
  average_lead_time_days:number|null;
  price_variance_pct:number|null;
  actual_received_value:number;
};

export type SupplierRequisitionPerformance={
  supplier_id:string;
  requisition_id:string;
  number:string;
  status:string;
  created_at:string;
  needed_by:string|null;
  first_receipt_at:string|null;
  last_receipt_at:string|null;
  requested_quantity:number;
  received_quantity:number;
  estimated_requested_value:number;
  estimated_received_value:number;
  actual_received_value:number;
  lead_time_days:number|null;
  quantity_fulfillment_pct:number|null;
  price_variance_pct:number|null;
  completed:boolean;
  completed_on_time:boolean|null;
};

const EMPTY:Omit<SupplierCommercialAnalytics,"supplier_id">={
  received_requisitions:0,
  completed_requisitions:0,
  partial_requisitions:0,
  quantity_fulfillment_pct:null,
  average_lead_time_days:null,
  on_time_complete_pct:null,
  on_time_sample:0,
  price_variance_pct:null,
  estimated_received_value:0,
  actual_received_value:0,
  price_sample_lines:0,
  latest_receipt_at:null,
};

export function emptySupplierCommercialAnalytics(supplierId:string):SupplierCommercialAnalytics{
  return {supplier_id:supplierId,...EMPTY};
}

/**
 * Procurement analytics are derived from physical receipt history, not mutable UI status.
 *
 * KPI population:
 * - requisitions whose first physical receipt occurred in the last 12 months;
 * - lead time = COALESCE(sent_at, created_at) -> first receipt;
 * - quantity fulfillment = received / requested for those requisitions;
 * - on-time completion = last receipt date <= needed_by, only for fully received requisitions with needed_by;
 * - price variance = weighted actual receipt cost vs the estimated cost for the same received quantities.
 */
export async function loadSupplierCommercialAnalytics(supplierIds:string[]){
  const ids=[...new Set(supplierIds)].filter(Boolean);
  if(!ids.length)return {
    summaries:[] as SupplierCommercialAnalytics[],
    trends:[] as SupplierCommercialTrend[],
    requisitions:[] as SupplierRequisitionPerformance[],
  };

  const performanceCte=`
    WITH item_totals AS (
      SELECT ri.requisition_id,
             COALESCE(sum(ri.quantity_requested),0)::float8 requested_quantity,
             COALESCE(sum(ri.quantity_received),0)::float8 received_quantity,
             COALESCE(sum(ri.quantity_requested*ri.unit_cost_estimated),0)::float8 estimated_requested_value
      FROM supplier_requisition_items ri
      JOIN supplier_requisitions r ON r.id=ri.requisition_id
      WHERE r.supplier_id=ANY($1::uuid[])
      GROUP BY ri.requisition_id
    ),
    receipt_totals AS (
      SELECT t.requisition_id,
             min(t.movement_at) first_receipt_at,
             max(t.movement_at) last_receipt_at,
             COALESCE(sum(abs(t.quantity)*ri.unit_cost_estimated),0)::float8 estimated_received_value,
             COALESCE(sum(abs(t.quantity)*COALESCE(t.unit_cost,ri.unit_cost_estimated)),0)::float8 actual_received_value,
             count(*) FILTER (WHERE ri.unit_cost_estimated>0)::int price_sample_lines
      FROM inventory_transactions t
      JOIN supplier_requisition_items ri ON ri.id=t.requisition_item_id
      JOIN supplier_requisitions rr ON rr.id=t.requisition_id AND rr.supplier_id=ANY($1::uuid[])
      WHERE t.requisition_id IS NOT NULL
        AND t.type='receipt'
        AND ri.requisition_id=t.requisition_id
      GROUP BY t.requisition_id
    ),
    perf AS (
      SELECT r.supplier_id,r.id requisition_id,r.number::text number,r.status,r.created_at,
             r.needed_by,COALESCE(r.sent_at,r.created_at) baseline_at,
             it.requested_quantity,it.received_quantity,it.estimated_requested_value,
             rt.first_receipt_at,rt.last_receipt_at,
             COALESCE(rt.estimated_received_value,0)::float8 estimated_received_value,
             COALESCE(rt.actual_received_value,0)::float8 actual_received_value,
             COALESCE(rt.price_sample_lines,0)::int price_sample_lines,
             CASE WHEN rt.first_receipt_at IS NULL THEN NULL
                  ELSE GREATEST(EXTRACT(EPOCH FROM (rt.first_receipt_at-COALESCE(r.sent_at,r.created_at)))/86400.0,0)::float8 END lead_time_days,
             CASE WHEN it.requested_quantity>0
                  THEN LEAST(100.0,(it.received_quantity/it.requested_quantity)*100.0)::float8 ELSE NULL END quantity_fulfillment_pct,
             CASE WHEN COALESCE(rt.estimated_received_value,0)>0
                  THEN ((rt.actual_received_value-rt.estimated_received_value)/rt.estimated_received_value*100.0)::float8 ELSE NULL END price_variance_pct,
             (it.requested_quantity>0 AND it.received_quantity+0.000001>=it.requested_quantity) completed,
             CASE WHEN it.requested_quantity>0
                        AND it.received_quantity+0.000001>=it.requested_quantity
                        AND r.needed_by IS NOT NULL
                        AND rt.last_receipt_at IS NOT NULL
                  THEN rt.last_receipt_at::date<=r.needed_by
                  ELSE NULL END completed_on_time
      FROM supplier_requisitions r
      JOIN item_totals it ON it.requisition_id=r.id
      LEFT JOIN receipt_totals rt ON rt.requisition_id=r.id
      WHERE r.supplier_id=ANY($1::uuid[])
    )
  `;

  const [summaryResult,trendResult,recentResult]=await Promise.all([
    query<SupplierCommercialAnalytics>(
      performanceCte+`
      SELECT supplier_id,
             count(*)::int received_requisitions,
             count(*) FILTER (WHERE completed)::int completed_requisitions,
             count(*) FILTER (WHERE NOT completed AND received_quantity>0)::int partial_requisitions,
             CASE WHEN sum(requested_quantity)>0
                  THEN LEAST(100.0,sum(received_quantity)/sum(requested_quantity)*100.0)::float8 ELSE NULL END quantity_fulfillment_pct,
             avg(lead_time_days)::float8 average_lead_time_days,
             CASE WHEN count(*) FILTER (WHERE completed_on_time IS NOT NULL)>0
                  THEN (100.0*count(*) FILTER (WHERE completed_on_time=true)
                        /count(*) FILTER (WHERE completed_on_time IS NOT NULL))::float8 ELSE NULL END on_time_complete_pct,
             count(*) FILTER (WHERE completed_on_time IS NOT NULL)::int on_time_sample,
             CASE WHEN sum(estimated_received_value)>0
                  THEN ((sum(actual_received_value)-sum(estimated_received_value))
                        /sum(estimated_received_value)*100.0)::float8 ELSE NULL END price_variance_pct,
             COALESCE(sum(estimated_received_value),0)::float8 estimated_received_value,
             COALESCE(sum(actual_received_value),0)::float8 actual_received_value,
             COALESCE(sum(price_sample_lines),0)::int price_sample_lines,
             max(last_receipt_at)::text latest_receipt_at
      FROM perf
      WHERE first_receipt_at>=now()-interval '12 months'
      GROUP BY supplier_id`,
      [ids],
    ),
    query<SupplierCommercialTrend>(
      performanceCte+`
      SELECT supplier_id,to_char(date_trunc('month',first_receipt_at),'YYYY-MM') AS "month",
             count(*)::int received_requisitions,
             CASE WHEN sum(requested_quantity)>0
                  THEN LEAST(100.0,sum(received_quantity)/sum(requested_quantity)*100.0)::float8 ELSE NULL END quantity_fulfillment_pct,
             avg(lead_time_days)::float8 average_lead_time_days,
             CASE WHEN sum(estimated_received_value)>0
                  THEN ((sum(actual_received_value)-sum(estimated_received_value))
                        /sum(estimated_received_value)*100.0)::float8 ELSE NULL END price_variance_pct,
             COALESCE(sum(actual_received_value),0)::float8 actual_received_value
      FROM perf
      WHERE first_receipt_at>=date_trunc('month',now())-interval '5 months'
      GROUP BY supplier_id,date_trunc('month',first_receipt_at)
      ORDER BY supplier_id,date_trunc('month',first_receipt_at)`,
      [ids],
    ),
    query<SupplierRequisitionPerformance>(
      performanceCte+`,
      ranked AS (
        SELECT perf.*,
               row_number() OVER(PARTITION BY supplier_id ORDER BY COALESCE(last_receipt_at,created_at) DESC,created_at DESC) rn
        FROM perf
        WHERE first_receipt_at IS NOT NULL
      )
      SELECT supplier_id,requisition_id,number,status,created_at::text,needed_by::text,
             first_receipt_at::text,last_receipt_at::text,requested_quantity,received_quantity,
             estimated_requested_value,estimated_received_value,actual_received_value,
             lead_time_days,quantity_fulfillment_pct,price_variance_pct,completed,completed_on_time
      FROM ranked
      WHERE rn<=12
      ORDER BY supplier_id,rn`,
      [ids],
    ),
  ]);

  return {
    summaries:summaryResult.rows,
    trends:trendResult.rows,
    requisitions:recentResult.rows,
  };
}
