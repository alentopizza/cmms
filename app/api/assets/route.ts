import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { query } from "@/lib/db";
import { publicUrl } from "@/lib/urls";

export async function POST(request: Request) {
  if (!(await isAuthenticated())) return new NextResponse("Unauthorized", { status: 401 });
  const form = await request.formData();
  const siteId = String(form.get("site_id") || "");
  const code = String(form.get("code") || "").trim();
  const name = String(form.get("name") || "").trim();
  const criticality = String(form.get("criticality") || "medium");
  const manufacturer = String(form.get("manufacturer") || "").trim();
  const model = String(form.get("model") || "").trim();

  const site = await query<{organization_id:string}>("SELECT organization_id FROM sites WHERE id=$1 AND active=true", [siteId]);
  if (!site.rowCount || !code || !name) return new NextResponse("Datos incompletos", { status: 400 });

  await query(
    `INSERT INTO assets(organization_id,site_id,code,name,criticality,manufacturer,model)
     VALUES($1,$2,$3,$4,$5,$6,$7)`,
    [site.rows[0].organization_id,siteId,code,name,criticality,manufacturer||null,model||null]
  );
  return NextResponse.redirect(publicUrl("/dashboard/assets", request.url), 303);
}
