import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { query } from "@/lib/db";
import { publicUrl } from "@/lib/urls";

const ALLOWED=new Set(["new","contacted","qualified","closed","discarded"]);

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}) {
  const session=await getSession();
  if(!session || !can(session,"leads.manage")) return new NextResponse("Forbidden",{status:403});

  const {id}=await params;
  const form=await request.formData();
  const status=String(form.get("status")||"");
  if(!ALLOWED.has(status)) return new NextResponse("Invalid status",{status:422});

  await query("UPDATE sales_leads SET status=$1,updated_at=now() WHERE id=$2",[status,id]);
  return NextResponse.redirect(publicUrl("/dashboard/leads",request.url),303);
}
