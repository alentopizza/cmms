import type { HTMLAttributes, ReactNode } from "react";

export type CardVariant="basic"|"elevated"|"interactive"|"selected"|"warning"|"error";

export function Card({
  variant="basic",header,children,footer,className="",...props
}:HTMLAttributes<HTMLElement>&{variant?:CardVariant;header?:ReactNode;footer?:ReactNode;children:ReactNode}){
  return <article {...props} className={["ds-card","ds-card-"+variant,className].filter(Boolean).join(" ")}>
    {header&&<header className="ds-card-header">{header}</header>}
    <div className="ds-card-content">{children}</div>
    {footer&&<footer className="ds-card-footer">{footer}</footer>}
  </article>;
}
