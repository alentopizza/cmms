import type { ReactNode } from "react";
import UiIcon, { type UiIconName } from "@/components/UiIcon";

export type BadgeVariant="success"|"warning"|"danger"|"info"|"neutral"|"brand";

export function Badge({children,variant="neutral",icon,className=""}:{children:ReactNode;variant?:BadgeVariant;icon?:UiIconName;className?:string}){
  return <span className={["ds-badge","ds-badge-"+variant,className].filter(Boolean).join(" ")}>
    {icon&&<UiIcon name={icon} size={13}/>}<span>{children}</span>
  </span>;
}

export function StatusIndicator({label,variant="neutral",icon}:{label:string;variant?:BadgeVariant;icon?:UiIconName}){
  return <span className={["ds-status-indicator","ds-status-"+variant].join(" ")}>
    {icon?<UiIcon name={icon} size={14}/>:<span className="ds-status-dot" aria-hidden="true"/>}
    <span>{label}</span>
  </span>;
}
