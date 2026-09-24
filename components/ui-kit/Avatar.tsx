import type { ReactNode } from "react";

export type AvatarSize="xs"|"sm"|"md"|"lg"|"xl";

export function Avatar({src,alt="",initials="D",size="md",status}:{src?:string|null;alt?:string;initials?:string;size?:AvatarSize;status?:ReactNode}){
  return <span className={["ds-avatar","ds-avatar-"+size].join(" ")}>
    {src?<img src={src} alt={alt}/>:<span aria-hidden={Boolean(alt)}>{initials.slice(0,2).toUpperCase()}</span>}
    {status&&<span className="ds-avatar-status">{status}</span>}
  </span>;
}
