import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { encryptEmbedding, validateEmbedding } from "@/lib/biometric";
import { query } from "@/lib/db";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || !session.userId || !session.organizationId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  if (!can(session, "attendance.self")) return new NextResponse("Forbidden", { status: 403 });

  const policy = await query<{ enabled:boolean; enabled_roles:string[] }>(
    "SELECT enabled,enabled_roles FROM organization_attendance_policies WHERE organization_id=$1",
    [session.organizationId],
  );
  const row = policy.rows[0];
  if (!row?.enabled || !session.role || !row.enabled_roles.includes(session.role)) {
    return NextResponse.json({ message: "El control biométrico no está habilitado para tu rol." }, { status: 409 });
  }

  const body = await request.json().catch(() => null) as {
    embedding?: unknown;
    consent?: unknown;
  } | null;
  const embedding = validateEmbedding(body?.embedding);
  if (!embedding) return NextResponse.json({ message: "No se recibió una plantilla facial válida." }, { status: 422 });
  if (body?.consent !== true) {
    return NextResponse.json({ message: "Debes aceptar el consentimiento para registrar la plantilla biométrica." }, { status: 422 });
  }

  const encrypted = encryptEmbedding(embedding);
  await query(
    `INSERT INTO user_biometric_profiles(user_id,organization_id,encrypted_embedding,consented_at,enrolled_at,revoked_at,updated_at)
     VALUES($1,$2,$3,now(),now(),NULL,now())
     ON CONFLICT(user_id)
     DO UPDATE SET organization_id=EXCLUDED.organization_id,
                   encrypted_embedding=EXCLUDED.encrypted_embedding,
                   consented_at=now(),
                   enrolled_at=now(),
                   revoked_at=NULL,
                   updated_at=now()`,
    [session.userId, session.organizationId, encrypted],
  );

  return NextResponse.json({ enrolled: true });
}

export async function DELETE() {
  const session = await getSession();
  if (!session || !session.userId || !session.organizationId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  if (!can(session, "attendance.self")) return new NextResponse("Forbidden", { status: 403 });

  await query(
    "UPDATE user_biometric_profiles SET revoked_at=now(),updated_at=now() WHERE user_id=$1 AND organization_id=$2",
    [session.userId, session.organizationId],
  );
  return NextResponse.json({ revoked: true });
}
