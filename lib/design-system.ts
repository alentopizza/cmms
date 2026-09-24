/**
 * Token-name manifest for the live /ui-kit catalog.
 *
 * Values intentionally live only in app/design-system/tokens.css. This manifest
 * references CSS variables instead of duplicating the color system in TypeScript.
 */

export type DesignTokenReference={
  token:string;
  label:string;
};

export type DesignTokenGroup={
  title:string;
  description:string;
  tokens:DesignTokenReference[];
};

export const brandTokenGroups:DesignTokenGroup[]=[
  {
    title:"Brand",
    description:"ADN visual DESWEB. No se reemplaza por colores de módulo.",
    tokens:[
      {token:"--color-brand-primary",label:"Primary"},
      {token:"--color-brand-secondary",label:"Secondary"},
      {token:"--color-brand-dark",label:"Dark"},
    ],
  },
  {
    title:"Primary",
    description:"Escala de marca para focus, highlights y acciones derivadas.",
    tokens:[50,100,200,300,400,500,600,700,800,900].map(step=>({token:`--color-primary-${step}`,label:String(step)})),
  },
  {
    title:"Teal",
    description:"Escala estructural para navegación y acciones operativas.",
    tokens:[50,100,200,300,400,500,600,700,800,900].map(step=>({token:`--color-teal-${step}`,label:String(step)})),
  },
  {
    title:"Navy",
    description:"Escala neutral para títulos, sidebar, texto y modo oscuro.",
    tokens:[50,100,200,300,400,500,600,700,800,900,950].map(step=>({token:`--color-navy-${step}`,label:String(step)})),
  },
];

export const semanticTokenGroups:DesignTokenGroup[]=[
  {
    title:"Success",
    description:"Operativo, completado, aprobado, disponible, recibido.",
    tokens:[50,100,300,500,600,700,900].map(step=>({token:`--color-success-${step}`,label:String(step)})),
  },
  {
    title:"Warning",
    description:"Stock bajo, pendiente, revisión, próximo mantenimiento.",
    tokens:[50,100,300,500,600,700,900].map(step=>({token:`--color-warning-${step}`,label:String(step)})),
  },
  {
    title:"Danger",
    description:"Sin stock, fuera de servicio, error, rechazado, eliminación.",
    tokens:[50,100,300,500,600,700,900].map(step=>({token:`--color-danger-${step}`,label:String(step)})),
  },
  {
    title:"Info",
    description:"Información, ayuda, importación, sincronización, actualización.",
    tokens:[50,100,300,500,600,700,900].map(step=>({token:`--color-info-${step}`,label:String(step)})),
  },
];

export const chartTokens:DesignTokenReference[]=Array.from({length:10},(_,index)=>({
  token:`--color-chart-${index+1}`,
  label:`Serie ${index+1}`,
}));

export const spacingTokens:DesignTokenReference[]=[
  ["--space-1","4"],
  ["--space-2","8"],
  ["--space-3","12"],
  ["--space-4","16"],
  ["--space-5","20"],
  ["--space-6","24"],
  ["--space-8","32"],
  ["--space-10","40"],
  ["--space-12","48"],
  ["--space-16","64"],
].map(([token,label])=>({token,label:label+" px"}));

export const radiusTokens:DesignTokenReference[]=[
  ["--radius-xs","4"],
  ["--radius-sm","6"],
  ["--radius-md","8"],
  ["--radius-lg","10"],
  ["--radius-xl","12"],
  ["--radius-2xl","16"],
  ["--radius-3xl","20"],
].map(([token,label])=>({token,label:label+" px"}));

export const shadowTokens:DesignTokenReference[]=["xs","sm","md","lg"].map(size=>({
  token:`--shadow-${size}`,
  label:`Shadow ${size.toUpperCase()}`,
}));

export const motionTokens:DesignTokenReference[]=[
  {token:"--motion-fast",label:"Fast · 120 ms"},
  {token:"--motion-normal",label:"Normal · 180 ms"},
  {token:"--motion-medium",label:"Medium · 240 ms"},
  {token:"--motion-slow",label:"Slow · 320 ms"},
];
