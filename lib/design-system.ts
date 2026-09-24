export type DesignTokenSample={
  token:string;
  label:string;
  description?:string;
};

export const brandTokens:DesignTokenSample[]=[
  {token:"--color-brand-primary",label:"Primary",description:"Acciones destacadas, foco e indicador activo"},
  {token:"--color-brand-secondary",label:"Secondary",description:"Navegación y acciones operativas principales"},
  {token:"--color-brand-dark",label:"Dark",description:"Sidebar, títulos y estructura"},
];

export const semanticTokens:DesignTokenSample[]=[
  {token:"--color-success-500",label:"Success",description:"Operativo, completado, aprobado"},
  {token:"--color-warning-500",label:"Warning",description:"Pendiente, stock bajo, en revisión"},
  {token:"--color-danger-500",label:"Danger",description:"Error, sin stock, fuera de servicio"},
  {token:"--color-info-500",label:"Info",description:"Información, importación, ayuda"},
];

export const functionalTokens:DesignTokenSample[]=[
  {token:"--color-module-analytics",label:"Analytics"},
  {token:"--color-module-procurement",label:"Compras / logística"},
  {token:"--color-module-technology",label:"Tecnología"},
  {token:"--color-module-people",label:"Personas / comunicación"},
];

export const chartTokens=Array.from({length:10},(_,index)=>({
  token:`--chart-${index+1}`,
  label:`Gráfico ${index+1}`,
}));

export const spacingTokens=[
  ["--space-1","4"],["--space-2","8"],["--space-3","12"],["--space-4","16"],
  ["--space-5","20"],["--space-6","24"],["--space-8","32"],["--space-10","40"],
  ["--space-12","48"],["--space-16","64"],
] as const;

export const radiusTokens=[
  ["--radius-xs","4"],["--radius-sm","6"],["--radius-md","8"],["--radius-lg","10"],
  ["--radius-xl","12"],["--radius-2xl","16"],["--radius-3xl","20"],
] as const;

export const shadowTokens=["--shadow-xs","--shadow-sm","--shadow-md","--shadow-lg"] as const;

export const motionTokens=[
  ["--motion-fast","120"],["--motion-normal","180"],["--motion-medium","240"],["--motion-slow","320"],
] as const;

export const typographySamples=[
  {className:"ds-type-display",label:"Display",meta:"40 / Bold"},
  {className:"ds-type-h1",label:"H1",meta:"32 / Bold"},
  {className:"ds-type-h2",label:"H2",meta:"24 / Semibold"},
  {className:"ds-type-h3",label:"H3",meta:"20 / Semibold"},
  {className:"ds-type-h4",label:"H4",meta:"18 / Semibold"},
  {className:"ds-type-body-lg",label:"Body Large",meta:"16 / Medium"},
  {className:"ds-type-body",label:"Body",meta:"14 / Regular"},
  {className:"ds-type-body-sm",label:"Body Small",meta:"12 / Regular"},
  {className:"ds-type-caption",label:"Caption",meta:"12 / Medium"},
  {className:"ds-type-label",label:"Label",meta:"12 / Semibold"},
] as const;
