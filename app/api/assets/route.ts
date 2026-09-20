import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { query } from "@/lib/db";
import { publicUrl } from "@/lib/urls";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });
  if (!can(session, "assets.write")) return new NextResponse("Forbidden", { status: 403 });

  const form = await request.formData();
  const siteId = String(form.get("site_id") || "");
  const code = String(form.get("code") || "").trim();
  const name = String(form.get("name") || "").trim();
  const criticality = String(form.get("criticality") || "medium");
  const manufacturer = String(form.get("manufacturer") || "").trim();
  const model = String(form.get("model") || "").trim();

  const site = session.platformRole === "superadmin"
    ? await query<{organization_id:string}>("SELECT organization_id FROM sites WHERE id=$1 AND active=true", [siteId])
    : await query<{organization_id:string}>("SELECT organization_id FROM sites WHERE id=$1 AND organization_id=$2 AND active=true", [siteId, session.organizationId]);

  if (!site.rowCount || !code || !name) return new NextResponse("Datos incompletos o sede no autorizada", { status: 400 });

  await query(
    `INSERT INTO assets(organization_id,site_id,code,name,criticality,manufacturer,model)
     VALUES($1,$2,$3,$4,$5,$6,$7)`,
    [site.rows[0].organization_id,siteId,code,name,criticality,manufacturer||null,model||null],
  );
  return NextResponse.redirect(publicUrl("/dashboard/assets", request.url), 303);
}
