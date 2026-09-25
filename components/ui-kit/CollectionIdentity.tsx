import type { ReactNode } from "react";
import UiIcon, { type UiIconName } from "@/components/UiIcon";

export function EntityIdentityCell({
  imageSrc,
  imageAlt="",
  fallback,
  icon="file",
  title,
  subtitle,
  meta,
  variant="thumbnail",
}:{
  imageSrc?:string|null;
  imageAlt?:string;
  fallback?:string|null;
  icon?:UiIconName;
  title:ReactNode;
  subtitle?:ReactNode;
  meta?:ReactNode;
  variant?:"avatar"|"logo"|"thumbnail"|"icon";
}){
  return <span className="ds-list-identity">
    <span className={"ds-list-identity-media "+variant} aria-hidden={!imageAlt}>
      {imageSrc?<img src={imageSrc} alt={imageAlt} loading="lazy" decoding="async" width={44} height={44}/>:fallback?<b>{fallback}</b>:<UiIcon name={icon} size={20}/>}
    </span>
    <span className="ds-list-identity-copy">
      <strong>{title}</strong>
      {subtitle&&<small>{subtitle}</small>}
      {meta&&<em>{meta}</em>}
    </span>
  </span>;
}

export function ListQuickActions({children}:{children:ReactNode}){
  return <div className="ds-list-quick-actions">{children}</div>;
}
