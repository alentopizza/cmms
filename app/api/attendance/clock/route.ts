import { NextResponse } from "next/server";
import { canAccessSite, getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { cosineSimilarity, decryptEmbedding, finiteCoordinate, haversineMeters, validateEmbedding } from "@/lib/biometric";
import { pool } from "@/lib/db";
import { DEFAULT_ATTENDANCE_POLICY, attendanceRoleEnabled } from "@/lib/attendance-policy";

type Policy = {
  enabled:boolean;
  enabled_roles:string[];
  require_face:boolean;
  require_geolocation:boolean;
  max_location_accuracy_m:number;
  face_similarity_threshold:number;
  liveness_threshold:number;
};

// ── Server-authoritative presence verification ──────────────────────────────

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || !session.userId || !session.organizationId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  if (!can(session, "attendance.self")) return new NextResponse("Forbidden", { status: 403 });

  const body = await request.json().catch(() => null) as {
    action?: unknown;
    siteId?: unknown;
    latitude?: unknown;
    longitude?: unknown;
    accuracy?: unknown;
    embedding?: unknown;
    live?: unknown;
    real?: unknown;
  } | null;

  const action = body?.action === "check_out" ? "check_out" : body?.action === "check_in" ? "check_in" : null;
  const siteId = typeof body?.siteId === "string" ? body.siteId : "";
  if (!action || !siteId) return NextResponse.json({ message: "Registro incompleto." }, { status: 422 });
  if (!canAccessSite(session, siteId)) return new NextResponse("Forbidden", { status: 403 });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const policyResult = await client.query<Policy>(
      `SELECT enabled,enabled_roles,require_face,require_geolocation,max_location_accuracy_m,
              face_similarity_threshold,liveness_threshold
       FROM organization_attendance_policies
       WHERE organization_id=$1
       FOR UPDATE`,
      [session.organizationId],
    );
    const policy = policyResult.rows[0] || DEFAULT_ATTENDANCE_POLICY;
    if (!policy.enabled || !attendanceRoleEnabled(session, policy.enabled_roles)) {
      await client.query("ROLLBACK");
      return NextResponse.json({ message: "El control de asistencia no está habilitado para tu rol." }, { status: 409 });
    }

    const siteResult = await client.query<{
      latitude:number|null;
      longitude:number|null;
      geofence_radius_m:number;
      name:string;
      active:boolean;
    }>(
      `SELECT latitude,longitude,geofence_radius_m,name,active
       FROM sites WHERE id=$1 AND organization_id=$2`,
      [siteId, session.organizationId],
    );
    const site = siteResult.rows[0];
    if (!site?.active) {
      await client.query("ROLLBACK");
      return NextResponse.json({ message: "La ubicación seleccionada no está disponible." }, { status: 422 });
    }

    let latitude:number|null = null;
    let longitude:number|null = null;
    let accuracy:number|null = null;
    let distance:number|null = null;

    if (policy.require_geolocation) {
      latitude = finiteCoordinate(body?.latitude, -90, 90);
      longitude = finiteCoordinate(body?.longitude, -180, 180);
      accuracy = Number(body?.accuracy);
      if (latitude === null || longitude === null || !Number.isFinite(accuracy) || accuracy < 0) {
        await client.query("ROLLBACK");
        return NextResponse.json({ message: "No fue posible validar tu ubicación." }, { status: 422 });
      }
      if (accuracy > policy.max_location_accuracy_m) {
        await client.query("ROLLBACK");
        return NextResponse.json({
          message: `La precisión GPS actual es de ${Math.round(accuracy)} m. Se requieren ${policy.max_location_accuracy_m} m o menos.`,
        }, { status: 422 });
      }
      if (site.latitude === null || site.longitude === null) {
        await client.query("ROLLBACK");
        return NextResponse.json({ message: "La sede aún no tiene geocerca configurada." }, { status: 409 });
      }
      distance = haversineMeters(latitude, longitude, site.latitude, site.longitude);
      if (distance > site.geofence_radius_m) {
        await client.query("ROLLBACK");
        return NextResponse.json({
          message: `Estás a ${Math.round(distance)} m del punto registrado. La geocerca permite ${site.geofence_radius_m} m.`,
        }, { status: 422 });
      }
    }

    let similarity:number|null = null;
    const live = Number(body?.live);
    const real = Number(body?.real);

    if (policy.require_face) {
      const current = validateEmbedding(body?.embedding);
      if (!current) {
        await client.query("ROLLBACK");
        return NextResponse.json({ message: "No se recibió una verificación facial válida." }, { status: 422 });
      }

      const profileResult = await client.query<{ encrypted_embedding:Buffer }>(
        `SELECT encrypted_embedding FROM user_biometric_profiles
         WHERE user_id=$1 AND organization_id=$2
           AND revoked_at IS NULL
           AND encrypted_embedding IS NOT NULL
           AND enrollment_method='supervised_camera'
           AND identity_verified_at IS NOT NULL`,
        [session.userId, session.organizationId],
      );
      if (!profileResult.rowCount) {
        await client.query("ROLLBACK");
        return NextResponse.json({ message: "Tu biometría debe ser enrolada y verificada presencialmente por un Administrador o Manager." }, { status: 409 });
      }

      const enrolled = decryptEmbedding(profileResult.rows[0].encrypted_embedding);
      similarity = cosineSimilarity(enrolled, current);
      if (similarity < policy.face_similarity_threshold) {
        await client.query("ROLLBACK");
        return NextResponse.json({ message: "La verificación facial no coincide con el perfil registrado." }, { status: 422 });
      }
      if (!Number.isFinite(live) || live < policy.liveness_threshold || !Number.isFinite(real) || real < policy.liveness_threshold) {
        await client.query("ROLLBACK");
        return NextResponse.json({ message: "No se pudo validar presencia real frente a la cámara. Intenta nuevamente con buena iluminación." }, { status: 422 });
      }
    }

    const openResult = await client.query<{id:string;site_id:string}>(
      "SELECT id,site_id FROM attendance_shifts WHERE user_id=$1 AND status='open' FOR UPDATE",
      [session.userId],
    );

    if (action === "check_in") {
      if (openResult.rowCount) {
        await client.query("ROLLBACK");
        return NextResponse.json({ message: "Ya tienes una jornada abierta." }, { status: 409 });
      }

      const inserted = await client.query<{id:string;check_in_at:string}>(
        `INSERT INTO attendance_shifts(
           organization_id,user_id,site_id,status,
           check_in_latitude,check_in_longitude,check_in_accuracy_m,check_in_distance_m,
           check_in_face_similarity,check_in_liveness,check_in_antispoof
         ) VALUES($1,$2,$3,'open',$4,$5,$6,$7,$8,$9,$10)
         RETURNING id,check_in_at::text`,
        [session.organizationId,session.userId,siteId,latitude,longitude,accuracy,distance,similarity,
         Number.isFinite(live)?live:null,Number.isFinite(real)?real:null],
      );
      await client.query(
        "UPDATE user_biometric_profiles SET last_verified_at=now(),updated_at=now() WHERE user_id=$1",
        [session.userId],
      );
      await client.query("COMMIT");
      return NextResponse.json({ action:"check_in", shiftId:inserted.rows[0].id, at:inserted.rows[0].check_in_at, site:site.name });
    }

    if (!openResult.rowCount) {
      await client.query("ROLLBACK");
      return NextResponse.json({ message: "No tienes una jornada abierta para registrar salida." }, { status: 409 });
    }
    if (openResult.rows[0].site_id !== siteId) {
      await client.query("ROLLBACK");
      return NextResponse.json({ message: "La salida debe registrarse en la misma sede donde inició la jornada." }, { status: 422 });
    }

    const closed = await client.query<{check_out_at:string}>(
      `UPDATE attendance_shifts SET
         status='closed',check_out_at=now(),
         check_out_latitude=$1,check_out_longitude=$2,check_out_accuracy_m=$3,check_out_distance_m=$4,
         check_out_face_similarity=$5,check_out_liveness=$6,check_out_antispoof=$7,updated_at=now()
       WHERE id=$8
       RETURNING check_out_at::text`,
      [latitude,longitude,accuracy,distance,similarity,Number.isFinite(live)?live:null,Number.isFinite(real)?real:null,openResult.rows[0].id],
    );
    await client.query(
      "UPDATE user_biometric_profiles SET last_verified_at=now(),updated_at=now() WHERE user_id=$1",
      [session.userId],
    );
    await client.query("COMMIT");
    return NextResponse.json({ action:"check_out", at:closed.rows[0].check_out_at, site:site.name });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
