import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { query } from "@/lib/db";
import { attendanceOrganizationId } from "@/lib/attendance-context";

const ROLE_SET = new Set(["admin","manager","technician","provider","external"]);

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });
  if (!can(session, "attendance.manage")) return new NextResponse("Forbidden", { status: 403 });

  const form = await request.formData();
  const organizationId = attendanceOrganizationId(session, form.get("organization_id"));
  if (!organizationId) {
    return NextResponse.json({ message: "Selecciona una empresa para administrar la asistencia." }, { status: 422 });
  }
  const organization = await query("SELECT 1 FROM organizations WHERE id=$1 AND active=true", [organizationId]);
  if (!organization.rowCount) return new NextResponse("Not found", { status: 404 });
  const enabled = form.get("enabled") === "true";
  const requireFace = form.get("require_face") === "true";
  const requireGeolocation = form.get("require_geolocation") === "true";
  const maxAccuracy = Math.max(10, Math.min(1000, Number(form.get("max_location_accuracy_m") || 120)));
  const faceThreshold = Math.max(0.3, Math.min(0.95, Number(form.get("face_similarity_threshold") || 0.55)));
  const livenessThreshold = Math.max(0.3, Math.min(0.99, Number(form.get("liveness_threshold") || 0.60)));
  const roles = form.getAll("enabled_roles").map(String).filter(role => ROLE_SET.has(role));
  const returnStep = ["1","2","3","4","5"].includes(String(form.get("return_step") || "")) ? String(form.get("return_step")) : "";

  if (!roles.length) {
    const target = new URL("/dashboard/attendance", request.url);
    target.searchParams.set("organization_id", organizationId);
    target.searchParams.set("error", "roles");
    target.searchParams.set("view", "setup");
    if (returnStep) target.searchParams.set("step", returnStep);
    return NextResponse.redirect(target, 303);
  }

  await query(
    `INSERT INTO organization_attendance_policies(
       organization_id,enabled,enabled_roles,require_face,require_geolocation,max_location_accuracy_m,
       face_similarity_threshold,liveness_threshold,updated_by,updated_at
     ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,now())
     ON CONFLICT(organization_id)
     DO UPDATE SET enabled=EXCLUDED.enabled,
                   enabled_roles=EXCLUDED.enabled_roles,
                   require_face=EXCLUDED.require_face,
                   require_geolocation=EXCLUDED.require_geolocation,
                   max_location_accuracy_m=EXCLUDED.max_location_accuracy_m,
                   face_similarity_threshold=EXCLUDED.face_similarity_threshold,
                   liveness_threshold=EXCLUDED.liveness_threshold,
                   updated_by=EXCLUDED.updated_by,
                   updated_at=now()`,
    [organizationId,enabled,roles,requireFace,requireGeolocation,maxAccuracy,faceThreshold,livenessThreshold,session.userId],
  );

  const target = new URL("/dashboard/attendance", request.url);
  target.searchParams.set("organization_id", organizationId);
  target.searchParams.set("saved", "policy");
  target.searchParams.set("view", "setup");
  if (returnStep) target.searchParams.set("step", returnStep);
  return NextResponse.redirect(target, 303);
}
