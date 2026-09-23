import { NextResponse } from "next/server";
import { COOKIE_NAME, getSession } from "@/lib/auth";
import { publicUrl } from "@/lib/urls";
import { query } from "@/lib/db";

// ── Logout also closes any active Reaction tracking session ─────────────────

export async function POST(request: Request) {
  const session=await getSession();
  if(session?.userId){
    await query(
      `UPDATE technician_tracking_sessions
       SET status='closed',disconnected_at=now(),last_seen_at=now()
       WHERE user_id=$1 AND status='active'`,
      [session.userId],
    ).catch(()=>undefined);
  }

  const response = NextResponse.redirect(publicUrl("/login", request.url), 303);
  response.cookies.set(COOKIE_NAME, "", { httpOnly: true, path: "/", maxAge: 0 });
  return response;
}
