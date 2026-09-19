import { NextResponse } from "next/server";
import { COOKIE_NAME } from "@/lib/auth";
import { publicUrl } from "@/lib/urls";

export async function POST(request: Request) {
  const response = NextResponse.redirect(publicUrl("/login", request.url), 303);
  response.cookies.set(COOKIE_NAME, "", { httpOnly: true, path: "/", maxAge: 0 });
  return response;
}
