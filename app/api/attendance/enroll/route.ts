import { NextResponse } from "next/server";

/**
 * Legacy self-enrollment endpoint.
 *
 * Self enrollment was intentionally retired after supervised identity
 * verification became mandatory. Keep this route as an explicit compatibility
 * guard so old clients fail safely instead of silently creating unverified
 * biometric profiles.
 */

export async function POST() {
  return NextResponse.json(
    { message: "El autoenrolamiento fue deshabilitado. Solicita enrolamiento presencial a un Administrador o Manager." },
    { status: 409 },
  );
}

export async function DELETE() {
  return NextResponse.json(
    { message: "La revocación biométrica requiere supervisión administrativa." },
    { status: 409 },
  );
}
