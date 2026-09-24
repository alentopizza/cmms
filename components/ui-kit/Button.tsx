import type { ButtonHTMLAttributes, ReactNode } from "react";
import UiIcon, { type UiIconName } from "@/components/UiIcon";

export type ButtonVariant="primary"|"secondary"|"tertiary"|"ghost"|"success"|"danger";
export type ButtonSize="sm"|"md"|"lg";

export type ButtonProps=ButtonHTMLAttributes<HTMLButtonElement>&{
  variant?:ButtonVariant;
  size?:ButtonSize;
  iconLeft?:UiIconName;
  iconRight?:UiIconName;
  loading?:boolean;
  fullWidth?:boolean;
  children:ReactNode;
};

export function Button({
  variant="primary",
  size="md",
  iconLeft,
  iconRight,
  loading=false,
  fullWidth=false,
  disabled,
  className,
  children,
  type="button",
  ...props
}:ButtonProps){
  return <button
    {...props}
    type={type}
    disabled={disabled||loading}
    aria-busy={loading||undefined}
    className={[
      "ds-button",
      "ds-button-"+variant,
      "ds-button-"+size,
      fullWidth?"ds-button-full":"",
      className||"",
    ].filter(Boolean).join(" ")}
  >
    {loading?<span className="ds-spinner ds-spinner-sm" aria-hidden="true"/>:iconLeft?<UiIcon name={iconLeft} size={size==="sm"?14:size==="lg"?19:16}/>:null}
    <span>{children}</span>
    {!loading&&iconRight?<UiIcon name={iconRight} size={size==="sm"?14:size==="lg"?19:16}/>:null}
  </button>;
}

export function IconButton({
  icon,
  label,
  variant="secondary",
  size="md",
  className,
  loading=false,
  fullWidth=false,
  disabled,
  type="button",
  title,
  ...props
}:Omit<ButtonProps,"children"|"iconLeft"|"iconRight">&{icon:UiIconName;label:string}){
  return <button
    {...props}
    type={type}
    disabled={disabled||loading}
    aria-busy={loading||undefined}
    aria-label={label}
    title={title||label}
    className={[
      "ds-button","ds-icon-button","ds-button-"+variant,"ds-button-"+size,fullWidth?"ds-button-full":"",className||"",
    ].filter(Boolean).join(" ")}
  >{loading?<span className="ds-spinner ds-spinner-sm" aria-hidden="true"/>:<UiIcon name={icon} size={size==="sm"?14:size==="lg"?20:17}/>}</button>;
}

export function SplitButton({
  children,
  menuLabel="Más opciones",
  onMenuClick,
  disabled=false,
}:{
  children:ReactNode;
  menuLabel?:string;
  onMenuClick?:()=>void;
  disabled?:boolean;
}){
  return <div className="ds-split-button">
    <Button disabled={disabled}>{children}</Button>
    <IconButton icon="chevron-down" label={menuLabel} disabled={disabled} onClick={onMenuClick}/>
  </div>;
}
