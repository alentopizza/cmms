import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { query } from "@/lib/db";
import { publicUrl } from "@/lib/urls";
import { canCreateSite } from "@/lib/resource-limits";
import { appendFeedback, safeDashboardReturn } from "@/lib/return-to";
import { readImageUpload, imageUploadMessage } from "@/lib/image-upload";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function targetUrl(id: string, requestUrl: string, returnTo: string, queryString = "") {
  const fallback = `/dashboard/companies/${id}`;
  return publicUrl(appendFeedback(safeDashboardReturn(returnTo, fallback), queryString), requestUrl);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });
  if (!can(session, "locations.manage")) return new NextResponse("Forbidden", { status: 403 });

  const { id } = await params;
  if (!UUID_PATTERN.test(id)) return new NextResponse("Empresa inválida", { status: 400 });
  if (session.platformRole === "user" && session.organizationId !== id) return new NextResponse("Forbidden", { status: 403 });
  if (session.platformRole === "user" && !session.accessAllSites) return new NextResponse("Forbidden", { status: 403 });

  const form = await request.formData();
  const name = String(form.get("name") || "").trim();
  const code = String(form.get("code") || "").trim().toUpperCase();
  const address = String(form.get("address") || "").trim();
  const city = String(form.get("city") || "").trim();
  const country = String(form.get("country") || "CO").trim().toUpperCase();
  const contactName = String(form.get("contact_name") || "").trim();
  const contactPhone = String(form.get("contact_phone") || "").trim();
  const contactEmail = String(form.get("contact_email") || "").trim().toLowerCase();
  const returnTo = String(form.get("return_to") || "");
  let image=null;
  try { image=await readImageUpload(form,"image"); }
  catch(error) {
    const message=imageUploadMessage(error);
    return NextResponse.redirect(targetUrl(id,request.url,returnTo,"?error="+(message.includes("5 MB")?"site-image-size":"site-image-type")),303);
  }

  if (!name) {
    return NextResponse.redirect(targetUrl(id, request.url, returnTo, "?error=site-required"), 303);
  }

  const organization = await query("SELECT 1 FROM organizations WHERE id=$1", [id]);
  if (!organization.rowCount) return new NextResponse("Empresa no encontrada", { status: 404 });
  if (!(await canCreateSite(id))) {
    return NextResponse.redirect(targetUrl(id, request.url, returnTo, "?error=site-limit"), 303);
  }

  try {
    await query(
      `INSERT INTO sites(
         organization_id,name,code,address,city,country,
         contact_name,contact_phone,contact_email,image_data,image_mime_type
       )
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        id,name,code||null,address||null,city||null,country||"CO",
        contactName||null,contactPhone||null,contactEmail||null,
        image?.data||null,image?.mime||null,
      ],
    );
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      return NextResponse.redirect(targetUrl(id, request.url, returnTo, "?error=site-code"), 303);
    }
    throw error;
  }

  return NextResponse.redirect(targetUrl(id, request.url, returnTo, "?created=site"), 303);
}
