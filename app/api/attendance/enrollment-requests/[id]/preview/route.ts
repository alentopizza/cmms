import { NextResponse } from "next/server";
import { canAccessSite, getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { decryptBiometricBlob } from "@/lib/biometric";
import { attendanceOrganizationId } from "@/lib/attendance-context";
import { query } from "@/lib/db";

// Authorized managers may view the pending preview only while it is valid.
// It is never exposed after approval/rejection/expiry and is never cached.
export async function GET(
  request:Request,
  context:{params:Promise<{id:string}>},
){
  const session=await getSession();
  if(!session)return new NextResponse("Unauthorized",{status:401});
  if(!can(session,"attendance.manage"))return new NextResponse("Forbidden",{status:403});

  const {id}=await context.params;
  const url=new URL(request.url);
  const organizationId=attendanceOrganizationId(session,url.searchParams.get("organization_id"));
  if(!organizationId)return new NextResponse("Not found",{status:404});

  const result=await query<{
    site_id:string;encrypted_preview:Buffer|null;preview_mime:string|null;status:string;preview_expires_at:string|null;
  }>(
    `SELECT site_id::text,encrypted_preview,preview_mime,status,preview_expires_at::text
     FROM biometric_enrollment_requests
     WHERE id=$1 AND organization_id=$2`,
    [id,organizationId],
  );
  const item=result.rows[0];
  if(!item||item.status!=="pending"||!item.encrypted_preview||!item.preview_mime)return new NextResponse("Not found",{status:404});
  if(!canAccessSite(session,item.site_id))return new NextResponse("Forbidden",{status:403});
  if(item.preview_expires_at&&new Date(item.preview_expires_at).getTime()<=Date.now())return new NextResponse("Expired",{status:410});

  const bytes=decryptBiometricBlob(item.encrypted_preview);
  return new NextResponse(new Uint8Array(bytes),{
    headers:{
      "Content-Type":item.preview_mime,
      "Cache-Control":"private, no-store, max-age=0",
      "X-Content-Type-Options":"nosniff",
      "Content-Security-Policy":"default-src 'none'; img-src 'self'",
    },
  });
}
