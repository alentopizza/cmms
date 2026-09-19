import { NextResponse } from "next/server";
import { COOKIE_NAME, tokenForPassword } from "@/lib/auth";
import { publicUrl } from "@/lib/urls";

export async function POST(request: Request) {
  const form = await request.formData();
  const password = String(form.get("password") || "");
  const configured = process.env.APP_ADMIN_PASSWORD || "";
  if (!configured || password !== configured) return NextResponse.redirect(publicUrl("/login?error=1", request.url), 303);

  const response = NextResponse.redirect(publicUrl("/dashboard", request.url), 303);
  response.cookies.set(COOKIE_NAME, tokenForPassword(password), {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 12,
  });
  return response;
}
