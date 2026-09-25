import { LoadingPage } from "@/components/ui-kit/Feedback";

export default function DashboardLoading(){
  return <section className="section dashboard-route-loading">
    <LoadingPage label="Cargando módulo"/>
  </section>;
}
