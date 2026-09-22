import { redirect } from "next/navigation";
import UserManual from "@/components/UserManual";
import { getSession } from "@/lib/auth";
import { manualRoleFromSession } from "@/lib/user-manual";

export const dynamic="force-dynamic";

// ── Authenticated role-aware manual entry point ─────────────────────────────

export default async function DashboardHelpPage(){
  const session=await getSession();
  if(!session)redirect("/login");

  return <UserManual
    initialRole={manualRoleFromSession(session.platformRole,session.role)}
    authenticated
  />;
}
