import { NextResponse } from "next/server";
import { COOKIE_NAME, tokenForPassword } from "@/lib/auth";

export async function POST(request: Request) {
  const form = await request.formData();
  const password = String(form.get("password") || "");
  const configured = process.env.APP_ADMIN_PASSWORD || "";
  if (!configured || password !== configured) return NextResponse.redirect(new URL("/login?error=1", request.url), 303);

  const response = NextResponse.redirect(new URL("/dashboard", request.url), 303);
  response.cookies.set(COOKIE_NAME, tokenForPassword(password), {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 12,
  });
  return response;
}
