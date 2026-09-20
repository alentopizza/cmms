import { NextResponse } from "next/server";
import { bootstrapSessionToken, COOKIE_NAME, userSessionToken } from "@/lib/auth";
import { query } from "@/lib/db";
import { verifyPassword } from "@/lib/passwords";
import { publicUrl } from "@/lib/urls";

const SESSION_MAX_AGE = 60 * 60 * 12;

export async function POST(request: Request) {
  const form = await request.formData();
  const email = String(form.get("email") || "").trim().toLowerCase();
  const password = String(form.get("password") || "");

  const configuredEmail = (process.env.APP_ADMIN_EMAIL || "").trim().toLowerCase();
  const configuredPassword = process.env.APP_ADMIN_PASSWORD || "";

  let token: string | null = null;

  if (configuredEmail && configuredPassword && email === configuredEmail && password === configuredPassword) {
    token = bootstrapSessionToken(SESSION_MAX_AGE);
  } else {
    const result = await query<{
      id: string;
      password_hash: string | null;
      password_salt: string | null;
      active: boolean;
    }>(
      "SELECT id,password_hash,password_salt,active FROM users WHERE lower(email)=lower($1) LIMIT 1",
      [email],
    );

    const user = result.rows[0];
    if (
      user?.active &&
      user.password_hash &&
      user.password_salt &&
      verifyPassword(password, user.password_salt, user.password_hash)
    ) {
      token = userSessionToken(user.id, SESSION_MAX_AGE);
      await query("UPDATE users SET last_login_at=now() WHERE id=$1", [user.id]);
    }
  }

  if (!token) {
    return NextResponse.redirect(publicUrl("/login?error=1", request.url), 303);
  }

  const response = NextResponse.redirect(publicUrl("/dashboard", request.url), 303);
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return response;
}
