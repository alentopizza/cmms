import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { imageUploadMessage, readImageUpload } from "@/lib/image-upload";
import { publicUrl } from "@/lib/urls";

const EMAIL=/^\S+@\S+\.\S+$/;

function redirectPreference(request:Request,queryString:string){
  return NextResponse.redirect(publicUrl("/dashboard/preferences"+queryString,request.url),303);
}

export async function POST(request:Request){
  const session=await getSession();
  if(!session)return new NextResponse("Unauthorized",{status:401});
  if(!session.userId)return redirectPreference(request,"?profile_error=managed");

  const form=await request.formData();
  const intent=String(form.get("intent")||"profile");
  if(intent!=="profile")return redirectPreference(request,"?profile_error=unsupported#profile");

  const fullName=String(form.get("full_name")||"").trim();
  const email=String(form.get("email")||"").trim().toLowerCase();
  const phone=String(form.get("phone")||"").trim();
  if(!fullName)return redirectPreference(request,"?profile_error=name#profile");
  if(!EMAIL.test(email))return redirectPreference(request,"?profile_error=email#profile");

  const duplicate=await query("SELECT 1 FROM users WHERE lower(email)=lower($1) AND id<>$2 LIMIT 1",[email,session.userId]);
  if(duplicate.rowCount)return redirectPreference(request,"?profile_error=duplicate#profile");

  let avatar=null;
  try{
    avatar=await readImageUpload(form,"avatar");
  }catch(error){
    const code=imageUploadMessage(error);
    return redirectPreference(request,`?profile_error=${encodeURIComponent(code||"avatar")}#profile`);
  }

  await query(
    `UPDATE users
     SET full_name=$1,email=$2,phone=$3,
         avatar_data=COALESCE($4,avatar_data),
         avatar_mime_type=CASE WHEN $4 IS NULL THEN avatar_mime_type ELSE $5 END,
         updated_at=now()
     WHERE id=$6`,
    [fullName,email,phone||null,avatar?.data||null,avatar?.mime||null,session.userId],
  );

  return redirectPreference(request,"?profile_saved=1#profile");
}
