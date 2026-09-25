import Link from "next/link";
import type { ReactNode } from "react";
import UiIcon, { type UiIconName } from "@/components/UiIcon";
import { Stepper } from "@/components/ui-kit/Navigation";
import { CircularProgress, StepProgress } from "@/components/ui-kit/TimelineProgress";

export type AttendanceSetupStep={
  id:string;
  label:string;
  description:string;
  progressLabel:string;
  progressDescription:string;
  completed:boolean;
  href:string;
};

export default function AttendanceSetupWorkspace({
  steps,
  activeId,
  title,
  description,
  icon,
  content,
  previousHref,
  nextHref,
  nextLabel="Siguiente",
  cancelHref,
  tip,
}:{
  steps:AttendanceSetupStep[];
  activeId:string;
  title:string;
  description:string;
  icon:UiIconName;
  content:ReactNode;
  previousHref?:string|null;
  nextHref?:string|null;
  nextLabel?:string;
  cancelHref:string;
  tip?:ReactNode;
}){
  const completedCount=steps.filter(step=>step.completed).length;
  const percent=steps.length?completedCount/steps.length*100:0;

  return <div className="attendance-setup-workspace">
    <Stepper
      activeId={activeId}
      label="Pasos de configuración de Asistencia"
      items={steps.map(step=>({
        id:step.id,
        label:step.label,
        description:step.description,
        completed:step.completed,
        href:step.href,
      }))}
    />

    <div className="attendance-setup-layout">
      <section className="attendance-setup-main">
        <header className="attendance-setup-step-head">
          <span className="attendance-setup-step-icon" aria-hidden="true"><UiIcon name={icon} size={21}/></span>
          <div>
            <h2>{title}</h2>
            <p>{description}</p>
          </div>
        </header>

        <div className="attendance-setup-step-body">{content}</div>

        <footer className="attendance-setup-actions">
          <Link className="ds-button ds-button-secondary ds-button-md" href={cancelHref}>Cancelar</Link>
          <div>
            {previousHref
              ?<Link className="ds-button ds-button-secondary ds-button-md" href={previousHref}><UiIcon name="chevron-left" size={15}/>Anterior</Link>
              :<span className="ds-button ds-button-secondary ds-button-md is-disabled" aria-disabled="true"><UiIcon name="chevron-left" size={15}/>Anterior</span>}
            {nextHref&&<Link className="ds-button ds-button-primary ds-button-md" href={nextHref}>{nextLabel}<UiIcon name="chevron-right" size={15}/></Link>}
          </div>
        </footer>
      </section>

      <aside className="attendance-setup-progress" aria-label="Progreso de configuración">
        <div className="attendance-setup-progress-head">
          <div>
            <span className="eyebrow">Progreso de configuración</span>
            <h3>Configuración inicial</h3>
            <p>Completa y revisa los pasos necesarios para operar Asistencia.</p>
          </div>
          <div className="attendance-setup-progress-ring">
            <CircularProgress value={percent} size={84}/>
            <strong>{completedCount}/{steps.length}</strong>
          </div>
        </div>

        <StepProgress
          label="Estado de los pasos de Asistencia"
          steps={steps.map(step=>({
            id:step.id,
            label:step.progressLabel,
            description:step.progressDescription,
            status:step.id===activeId?"current":step.completed?"complete":"upcoming",
          }))}
        />

        {tip&&<div className="attendance-setup-tip">
          <span aria-hidden="true"><UiIcon name="info" size={16}/></span>
          <div><strong>Tip</strong><div>{tip}</div></div>
        </div>}
      </aside>
    </div>
  </div>;
}
