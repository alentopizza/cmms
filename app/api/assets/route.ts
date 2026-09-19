import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { query } from "@/lib/db";

export async function POST(request: Request) {
  if (!(await isAuthenticated())) return new NextResponse("Unauthorized", { status: 401 });
  const form = await request.formData();
  const organizationId = String(form.get("organization_id") || "");
  const siteId = String(form.get("site_id") || "");
  const code = String(form.get("code") || "").trim();
  const name = String(form.get("name") || "").trim();
  const criticality = String(form.get("criticality") || "medium");
  const manufacturer = String(form.get("manufacturer") || "").trim();
  const model = String(form.get("model") || "").trim();
  if (!organizationId || !siteId || !code || !name) return new NextResponse("Datos incompletos", { status: 400 });
  await query(
    `INSERT INTO assets(organization_id,site_id,code,name,criticality,manufacturer,model)
     SELECT $1,$2,$3,$4,$5,$6,$7 WHERE EXISTS(SELECT 1 FROM sites WHERE id=$2 AND organization_id=$1)`,
    [organizationId,siteId,code,name,criticality,manufacturer||null,model||null]
  );
  return NextResponse.redirect(new URL("/dashboard/assets", request.url), 303);
}
