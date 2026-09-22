import UserManual from "@/components/UserManual";

export const dynamic="force-dynamic";

export default function PublicManualPage(){
  return <main className="public-manual-shell">
    <UserManual initialRole="all" authenticated={false}/>
  </main>;
}
