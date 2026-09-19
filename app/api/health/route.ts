import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET() {
  try {
    await query("SELECT 1");
    return NextResponse.json({ status: "ok", database: "ok", service: "cmms" });
  } catch {
    return NextResponse.json({ status: "error", database: "unavailable", service: "cmms" }, { status: 503 });
  }
}
