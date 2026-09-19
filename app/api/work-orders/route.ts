import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { query } from "@/lib/db";
import { publicUrl } from "@/lib/urls";

export async function POST(request: Request) {
  if (!(await isAuthenticated())) return new NextResponse("Unauthorized", { status: 401 });
  const form = await request.formData();
  const assetId = String(form.get("asset_id") || "");
  const title = String(form.get("title") || "").trim();
  const type = String(form.get("type") || "corrective");
  const priority = String(form.get("priority") || "medium");
  const asset = await query<{organization_id:string;site_id:string}>("SELECT organization_id,site_id FROM assets WHERE id=$1", [assetId]);
  if (!asset.rowCount || !title) return new NextResponse("Equipo o título inválido", { status: 400 });
  await query("INSERT INTO work_orders(organization_id,site_id,asset_id,title,type,priority) VALUES($1,$2,$3,$4,$5,$6)",
    [asset.rows[0].organization_id,asset.rows[0].site_id,assetId,title,type,priority]);
  return NextResponse.redirect(publicUrl("/dashboard/work-orders", request.url), 303);
}
