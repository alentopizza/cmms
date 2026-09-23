import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import ReactionMap from "@/components/ReactionMap";

export const dynamic="force-dynamic";

export default async function ReactionPage(){
  const session=await getSession();
  if(!session)redirect("/login");
  if(!can(session,"reaction.view"))redirect("/dashboard");

  return <>
    <section className="reaction-workspace section">
      <ReactionMap />
    </section>
  </>;
}
