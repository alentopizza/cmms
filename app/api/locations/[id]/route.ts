import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { query } from "@/lib/db";
import { publicUrl } from "@/lib/urls";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthenticated())) return new NextResponse("Unauthorized", { status: 401 });
  const { id } = await params;
  const form = await request.formData();
  const siteId = String(form.get("site_id") || "");
  if (!UUID.test(id) || !UUID.test(siteId)) return new NextResponse("Sububicación inválida", { status: 400 });
  const redirect = (suffix: string) => NextResponse.redirect(publicUrl(`/dashboard/locations/${siteId}${suffix}`, request.url), 303);

  const current = await query("SELECT 1 FROM locations WHERE id=$1 AND site_id=$2", [id, siteId]);
  if (!current.rowCount) return new NextResponse("Sububicación no encontrada", { status: 404 });
  const intent = String(form.get("intent") || "update");
  if (intent === "toggle") {
    await query("UPDATE locations SET active=NOT active,updated_at=now() WHERE id=$1 AND site_id=$2", [id, siteId]);
    return redirect("?saved=status");
  }

  const name = String(form.get("name") || "").trim();
  const code = String(form.get("code") || "").trim().toUpperCase();
  const type = String(form.get("type") || "area").trim().toLowerCase();
  const description = String(form.get("description") || "").trim();
  if (!name) return redirect("?error=required");
  try {
    await query(
      "UPDATE locations SET name=$1,code=$2,type=$3,description=$4,updated_at=now() WHERE id=$5 AND site_id=$6",
      [name, code || null, type, description || null, id, siteId],
    );
  } catch (error) {
    if ((error as { code?: string }).code === "23505") return redirect("?error=code");
    throw error;
  }
  return redirect("?saved=location");
}
