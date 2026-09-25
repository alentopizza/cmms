import type { SVGProps } from "react";

export type UiIconName =
  | "home"
  | "chevron-right"
  | "chevron-down"
  | "x"
  | "search"
  | "info"
  | "warning"
  | "error"
  | "eye"
  | "eye-off"
  | "menu"
  | "more"
  | "company"
  | "location"
  | "sublocation"
  | "user"
  | "edit"
  | "map"
  | "plus"
  | "user-plus"
  | "download"
  | "upload"
  | "file"
  | "trash"
  | "asset"
  | "work-order"
  | "whatsapp"
  | "phone"
  | "mail"
  | "activity"
  | "clock"
  | "check"
  | "power"
  | "chevron-left"
  | "chevron-up"
  | "dashboard"
  | "lead"
  | "supplier"
  | "crew"
  | "attendance"
  | "reaction"
  | "inventory"
  | "requisition"
  | "maintenance"
  | "settings"
  | "preferences"
  | "help"
  | "logout"
  | "reorder"
  | "reset";

export default function UiIcon({
  name,
  size = 18,
  className,
  ...props
}: {
  name: UiIconName;
  size?: number;
  className?: string;
} & Omit<SVGProps<SVGSVGElement>, "name">) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.9,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: ["ui-icon", className].filter(Boolean).join(" "),
    "aria-hidden": true,
    ...props,
  };

  if (name === "home") return <svg {...common}><path d="m3.8 10.5 8.2-6.3 8.2 6.3"/><path d="M5.8 9.3v9.2h12.4V9.3"/><path d="M9.4 18.5v-5.8h5.2v5.8"/></svg>;
  if (name === "chevron-right") return <svg {...common}><path d="m9 5 7 7-7 7"/></svg>;
  if (name === "chevron-down") return <svg {...common}><path d="m5 9 7 7 7-7"/></svg>;
  if (name === "x") return <svg {...common}><path d="M6 6l12 12M18 6 6 18"/></svg>;
  if (name === "search") return <svg {...common}><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 4 4"/></svg>;
  if (name === "info") return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="M12 10.5V17"/><path d="M12 7h.01"/></svg>;
  if (name === "warning") return <svg {...common}><path d="M12 3.8 21 20H3L12 3.8Z"/><path d="M12 9v5"/><path d="M12 17h.01"/></svg>;
  if (name === "error") return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="m9 9 6 6M15 9l-6 6"/></svg>;
  if (name === "eye") return <svg {...common}><path d="M3.5 12s3.2-5 8.5-5 8.5 5 8.5 5-3.2 5-8.5 5-8.5-5-8.5-5Z"/><circle cx="12" cy="12" r="2.4"/></svg>;
  if (name === "eye-off") return <svg {...common}><path d="m4 4 16 16"/><path d="M10.2 7.2A9 9 0 0 1 12 7c5.3 0 8.5 5 8.5 5a13 13 0 0 1-2.4 2.8M14.2 14.2a3 3 0 0 1-4.4-4.4M7.2 8.2A13.8 13.8 0 0 0 3.5 12s3.2 5 8.5 5c1.2 0 2.3-.3 3.3-.7"/></svg>;
  if (name === "menu") return <svg {...common}><path d="M4 7h16M4 12h16M4 17h16"/></svg>;
  if (name === "more") return <svg {...common}><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></svg>;
  if (name === "company") return <svg {...common}><path d="M4.5 20V5.5h7V20"/><path d="M11.5 8.5h8V20"/><path d="M7.5 8.5h1M7.5 12h1M7.5 15.5h1M14.5 12h1.5M14.5 15.5h1.5"/><path d="M3 20h18"/></svg>;
  if (name === "location") return <svg {...common}><path d="M20 10.2c0 5.4-8 11-8 11s-8-5.6-8-11a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.7"/></svg>;
  if (name === "sublocation") return <svg {...common}><rect x="4" y="4" width="6" height="6" rx="1.5"/><rect x="14" y="14" width="6" height="6" rx="1.5"/><path d="M10 7h3a4 4 0 0 1 4 4v3"/></svg>;
  if (name === "user") return <svg {...common}><circle cx="12" cy="8" r="3.5"/><path d="M5.5 20c.8-3.7 3.1-5.6 6.5-5.6s5.7 1.9 6.5 5.6"/></svg>;
  if (name === "edit") return <svg {...common}><path d="m4 20 4.2-1 10.4-10.4a2 2 0 0 0-2.8-2.8L5.4 16.2 4 20Z"/><path d="m13.9 7.7 2.8 2.8"/></svg>;
  if (name === "map") return <svg {...common}><path d="m3.5 6.5 5-2.5 7 2.5 5-2.5v13.5l-5 2.5-7-2.5-5 2.5V6.5Z"/><path d="M8.5 4v13.5M15.5 6.5V20"/></svg>;
  if (name === "plus") return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></svg>;
  if (name === "user-plus") return <svg {...common}><circle cx="9" cy="8" r="3"/><path d="M3.8 19c.7-3.3 2.5-5 5.2-5 1.3 0 2.4.3 3.3.9"/><path d="M17 10v7M13.5 13.5h7"/></svg>;
  if (name === "download") return <svg {...common}><path d="M12 3v11"/><path d="m8 10 4 4 4-4"/><path d="M5 18.5h14"/></svg>;
  if (name === "upload") return <svg {...common}><path d="M12 15V4"/><path d="m8 8 4-4 4 4"/><path d="M5 18.5h14"/></svg>;
  if (name === "file") return <svg {...common}><path d="M6 3.5h8l4 4V20H6V3.5Z"/><path d="M14 3.5V8h4"/><path d="M9 12h6M9 15h6"/></svg>;
  if (name === "trash") return <svg {...common}><path d="M4.5 7h15"/><path d="M9 7V4.5h6V7"/><path d="m7 7 .8 13h8.4L17 7"/><path d="M10 10.5v6M14 10.5v6"/></svg>;
  if (name === "asset") return <svg {...common}><path d="m4 8 8-4 8 4-8 4-8-4Z"/><path d="m4 8 8 4 8-4v8l-8 4-8-4V8Z"/><path d="M12 12v8"/></svg>;
  if (name === "work-order") return <svg {...common}><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4.5V3h6v1.5M8.5 9h7M8.5 13h7M8.5 17h4"/></svg>;
  if (name === "whatsapp") return <svg {...common}><path d="M20 11.5a8 8 0 0 1-11.8 7l-4.2 1.2 1.3-4A8 8 0 1 1 20 11.5Z"/><path d="M8.6 8.2c.4 2.5 2.2 4.5 4.8 5.3l1.2-1.3 2 .8c-.7 1.9-2 2.8-3.8 2.5-3.4-.6-6.7-3.9-7.2-7.3-.3-1.8.6-3.1 2.4-3.8l.8 2-1.2 1.2 1 0.6Z"/></svg>;
  if (name === "phone") return <svg {...common}><path d="M7 4.5 9.5 8l-1.7 1.8c1 2.1 2.5 3.6 4.6 4.6l1.8-1.7 3.3 2.6c-.8 2.2-2.4 3.6-4.4 3.1-4.7-1.1-8.5-4.9-9.6-9.6C3 6.8 4.5 5.2 7 4.5Z"/></svg>;
  if (name === "mail") return <svg {...common}><rect x="3.5" y="5.5" width="17" height="13" rx="2"/><path d="m4.5 7 7.5 6 7.5-6"/></svg>;
  if (name === "clock") return <svg {...common}><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>;
  if (name === "check") return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="m8 12 2.7 2.7L16.5 9"/></svg>;
  if (name === "power") return <svg {...common}><path d="M12 3.5v8"/><path d="M7.2 6.7a7.3 7.3 0 1 0 9.6 0"/></svg>;
  if (name === "chevron-left") return <svg {...common}><path d="m15 5-7 7 7 7"/></svg>;
  if (name === "chevron-up") return <svg {...common}><path d="m5 15 7-7 7 7"/></svg>;
  if (name === "dashboard") return <svg {...common}><rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/></svg>;
  if (name === "lead") return <svg {...common}><path d="m12 3 1.7 4.3L18 9l-4.3 1.7L12 15l-1.7-4.3L6 9l4.3-1.7L12 3Z"/><path d="m18.2 14.5.9 2.2 2.2.9-2.2.9-.9 2.2-.9-2.2-2.2-.9 2.2-.9.9-2.2Z"/></svg>;
  if (name === "supplier") return <svg {...common}><path d="M4 9h16l-1.2-4.5H5.2L4 9Z"/><path d="M5 9v10h14V9"/><path d="M8 19v-5h4v5M15 13h2"/><path d="M4 9c0 1.4 1.1 2.5 2.5 2.5S9 10.4 9 9c0 1.4 1.1 2.5 2.5 2.5S14 10.4 14 9c0 1.4 1.1 2.5 2.5 2.5S19 10.4 19 9"/></svg>;
  if (name === "crew") return <svg {...common}><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9.5" r="2.3"/><path d="M3.5 19c.7-3.5 2.6-5.3 5.5-5.3s4.8 1.8 5.5 5.3"/><path d="M14.7 14.2c.7-.5 1.5-.7 2.4-.7 2.1 0 3.4 1.3 3.9 3.8"/></svg>;
  if (name === "attendance") return <svg {...common}><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/><path d="m8.2 17 1.4 1.4 2.8-3"/></svg>;
  if (name === "reaction") return <svg {...common}><path d="M12 20s6-4.3 6-10a6 6 0 1 0-12 0c0 5.7 6 10 6 10Z"/><circle cx="12" cy="10" r="1.8"/><path d="M18.5 5.2c1.1 1.1 1.8 2.5 2 4M5.5 5.2c-1.1 1.1-1.8 2.5-2 4"/></svg>;
  if (name === "inventory") return <svg {...common}><path d="m4 8 8-4 8 4-8 4-8-4Z"/><path d="m4 8 8 4 8-4v8l-8 4-8-4V8Z"/><path d="M8.5 10.2v3.2l3.5 1.8 3.5-1.8v-3.2"/></svg>;
  if (name === "requisition") return <svg {...common}><rect x="5" y="4.5" width="14" height="16" rx="2"/><path d="M9 4.5V3h6v1.5M8.5 9h7M8.5 13h5"/><path d="m14.5 16 1.3 1.3 2.7-3"/></svg>;
  if (name === "maintenance") return <svg {...common}><path d="M5.2 7.2A8 8 0 0 1 18 5.8"/><path d="M18 3.5v4.2h-4.2"/><path d="M18.8 16.8A8 8 0 0 1 6 18.2"/><path d="M6 20.5v-4.2h4.2"/><path d="m10 14 4-4"/></svg>;
  if (name === "settings") return <svg {...common}><circle cx="12" cy="12" r="3"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4"/></svg>;
  if (name === "preferences") return <svg {...common}><path d="M5 7h14M5 12h14M5 17h14"/><circle cx="9" cy="7" r="1.8"/><circle cx="15" cy="12" r="1.8"/><circle cx="11" cy="17" r="1.8"/></svg>;
  if (name === "help") return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="M9.8 9.3a2.4 2.4 0 0 1 4.6 1c0 1.8-2.4 2-2.4 3.7"/><path d="M12 17h.01"/></svg>;
  if (name === "logout") return <svg {...common}><path d="M10 5H5v14h5"/><path d="M13 8l4 4-4 4M17 12H9"/></svg>;
  if (name === "reorder") return <svg {...common}><path d="M8 6h10M8 12h10M8 18h10"/><circle cx="4.5" cy="6" r=".8"/><circle cx="4.5" cy="12" r=".8"/><circle cx="4.5" cy="18" r=".8"/></svg>;
  if (name === "reset") return <svg {...common}><path d="M5 7V3.5M5 7h3.5"/><path d="M5.4 7A8 8 0 1 1 4.5 15"/></svg>;
  return <svg {...common}><path d="M4 17.5V12M9.3 17.5V8.5M14.7 17.5V5M20 17.5V10.5"/></svg>;
}
