export type BrandSchemeKey =
  | "default"
  | "fresh"
  | "bright"
  | "blue"
  | "coffee"
  | "ectoplasm"
  | "midnight"
  | "ocean"
  | "sunrise"
  | "custom";

export type BrandScheme = {
  key:BrandSchemeKey;
  label:string;
  description:string;
  primary:string;
  secondary:string;
  accent:string;
};

export const BRAND_SCHEMES:BrandScheme[]=[
  {key:"default",label:"Predeterminado",description:"Desweb CMMS",primary:"#2C8780",secondary:"#1D1D2C",accent:"#72F1DC"},
  {key:"fresh",label:"Fresco",description:"Moderno y limpio",primary:"#0F766E",secondary:"#164E63",accent:"#67E8F9"},
  {key:"bright",label:"Luminoso",description:"Claro y profesional",primary:"#F97316",secondary:"#7C2D12",accent:"#FACC15"},
  {key:"blue",label:"Azul",description:"Corporativo",primary:"#2563EB",secondary:"#1E3A8A",accent:"#60A5FA"},
  {key:"coffee",label:"Café",description:"Cálido y natural",primary:"#8B5E3C",secondary:"#3E2723",accent:"#D97706"},
  {key:"ectoplasm",label:"Ectoplasma",description:"Creativo y distinto",primary:"#7C3AED",secondary:"#312E81",accent:"#A7F3D0"},
  {key:"midnight",label:"Medianoche",description:"Elegante y oscuro",primary:"#14B8A6",secondary:"#111827",accent:"#818CF8"},
  {key:"ocean",label:"Océano",description:"Calmado y moderno",primary:"#0E7490",secondary:"#164E63",accent:"#22D3EE"},
  {key:"sunrise",label:"Amanecer",description:"Energético y cálido",primary:"#DC2626",secondary:"#9A3412",accent:"#F59E0B"},
  {key:"custom",label:"Personalizado",description:"Crea tu propio esquema",primary:"#0F766E",secondary:"#0B3B46",accent:"#F59E0B"},
];

export const DEFAULT_BRAND_SCHEME=BRAND_SCHEMES[0];

export function isBrandSchemeKey(value:string):value is BrandSchemeKey{
  return BRAND_SCHEMES.some(item=>item.key===value);
}

export function isBrandInterfaceStyle(value:string):value is "light"|"dark"|"system"{
  return value==="light"||value==="dark"||value==="system";
}

export function isBrandDensity(value:string):value is "compact"|"normal"|"comfortable"{
  return value==="compact"||value==="normal"||value==="comfortable";
}

export function normalizeBrandHex(value:string,fallback:string){
  const normalized=value.trim().toUpperCase();
  return /^#[0-9A-F]{6}$/.test(normalized)?normalized:fallback.toUpperCase();
}

function parseHex(hex:string){
  const safe=normalizeBrandHex(hex,"#000000");
  return [Number.parseInt(safe.slice(1,3),16),Number.parseInt(safe.slice(3,5),16),Number.parseInt(safe.slice(5,7),16)] as const;
}

function toHex(value:number){
  return Math.max(0,Math.min(255,Math.round(value))).toString(16).padStart(2,"0").toUpperCase();
}

export function mixBrandHex(a:string,b:string,weight:number){
  const first=parseHex(a),second=parseHex(b),ratio=Math.max(0,Math.min(1,weight));
  return "#"+first.map((value,index)=>toHex(value*(1-ratio)+second[index]*ratio)).join("");
}

function relativeLuminance(hex:string){
  const rgb=parseHex(hex).map(value=>{
    const channel=value/255;
    return channel<=0.04045?channel/12.92:Math.pow((channel+0.055)/1.055,2.4);
  });
  return 0.2126*rgb[0]+0.7152*rgb[1]+0.0722*rgb[2];
}

function contrastRatio(a:string,b:string){
  const first=relativeLuminance(a),second=relativeLuminance(b);
  const lighter=Math.max(first,second),darker=Math.min(first,second);
  return (lighter+0.05)/(darker+0.05);
}

function readableBrandText(background:string){
  const light="#FFFFFF",dark="#1D1D2C";
  return contrastRatio(background,light)>=contrastRatio(background,dark)?light:dark;
}

function darkenForLightText(background:string,minRatio=4.5){
  let candidate=normalizeBrandHex(background,"#1D1D2C");
  if(contrastRatio(candidate,"#FFFFFF")>=minRatio)return candidate;
  for(let weight=0.08;weight<=0.84;weight+=0.08){
    candidate=mixBrandHex(background,"#000000",weight);
    if(contrastRatio(candidate,"#FFFFFF")>=minRatio)return candidate;
  }
  return "#1D1D2C";
}

export function brandSchemeByKey(key:string|undefined|null){
  return BRAND_SCHEMES.find(item=>item.key===key)||DEFAULT_BRAND_SCHEME;
}

export type BrandPaletteInput={
  primary:string;
  secondary:string;
  accent:string;
};

export type BrandPalette=BrandPaletteInput&{
  onPrimary:string;
  onAccent:string;
  onSidebar:string;
  onSidebarActive:string;
  primaryHover:string;
  primarySoft:string;
  secondaryHover:string;
  secondarySoft:string;
  accentSoft:string;
  sidebar:string;
  sidebarHover:string;
  sidebarActive:string;
  background:string;
  surface:string;
  border:string;
  text:string;
  textSecondary:string;
};

export function buildBrandPalette(input:BrandPaletteInput):BrandPalette{
  const primary=normalizeBrandHex(input.primary,DEFAULT_BRAND_SCHEME.primary);
  const secondary=normalizeBrandHex(input.secondary,DEFAULT_BRAND_SCHEME.secondary);
  const accent=normalizeBrandHex(input.accent,DEFAULT_BRAND_SCHEME.accent);
  const sidebar=darkenForLightText(mixBrandHex(secondary,"#000000",0.18),4.5);
  const sidebarActive=darkenForLightText(mixBrandHex(sidebar,primary,0.32),4.5);
  return {
    primary,
    secondary,
    accent,
    onPrimary:readableBrandText(primary),
    onAccent:readableBrandText(accent),
    onSidebar:"#FFFFFF",
    onSidebarActive:"#FFFFFF",
    primaryHover:mixBrandHex(primary,"#000000",0.12),
    primarySoft:mixBrandHex(primary,"#FFFFFF",0.88),
    secondaryHover:mixBrandHex(secondary,"#000000",0.10),
    secondarySoft:mixBrandHex(secondary,"#FFFFFF",0.90),
    accentSoft:mixBrandHex(accent,"#FFFFFF",0.84),
    sidebar,
    sidebarHover:darkenForLightText(mixBrandHex(sidebar,primary,0.16),4.5),
    sidebarActive,
    background:mixBrandHex(primary,"#FFFFFF",0.96),
    surface:"#FFFFFF",
    border:mixBrandHex(primary,"#FFFFFF",0.82),
    text:mixBrandHex(secondary,"#000000",0.16),
    textSecondary:mixBrandHex(secondary,"#FFFFFF",0.38),
  };
}

export function brandCssVariables(input:BrandPaletteInput,autoPalette=true):Record<string,string>{
  const palette=buildBrandPalette(input);
  const structural=autoPalette?palette:buildBrandPalette(DEFAULT_BRAND_SCHEME);
  return {
    "--brand-primary":palette.primary,
    "--brand-on-primary":palette.onPrimary,
    "--brand-on-accent":palette.onAccent,
    "--brand-on-sidebar":autoPalette?palette.onSidebar:structural.onSidebar,
    "--brand-on-sidebar-active":autoPalette?palette.onSidebarActive:structural.onSidebarActive,
    "--brand-primary-hover":autoPalette?palette.primaryHover:structural.primaryHover,
    "--brand-primary-soft":autoPalette?palette.primarySoft:structural.primarySoft,
    "--brand-secondary":palette.secondary,
    "--brand-secondary-hover":autoPalette?palette.secondaryHover:structural.secondaryHover,
    "--brand-secondary-soft":autoPalette?palette.secondarySoft:structural.secondarySoft,
    "--brand-accent":palette.accent,
    "--brand-accent-soft":autoPalette?palette.accentSoft:structural.accentSoft,
    "--brand-sidebar":autoPalette?palette.sidebar:structural.sidebar,
    "--brand-sidebar-hover":autoPalette?palette.sidebarHover:structural.sidebarHover,
    "--brand-sidebar-active":autoPalette?palette.sidebarActive:structural.sidebarActive,
    "--brand-background":autoPalette
      ? `color-mix(in srgb,${palette.primary} 5%,var(--color-bg))`
      : "var(--color-bg)",
    "--brand-surface":autoPalette
      ? `color-mix(in srgb,${palette.primary} 2%,var(--color-surface))`
      : "var(--color-surface)",
    "--brand-border":autoPalette
      ? `color-mix(in srgb,${palette.primary} 16%,var(--color-border-subtle))`
      : "var(--color-border-subtle)",
    "--brand-text":"var(--color-text-primary)",
    "--brand-text-secondary":"var(--color-text-secondary)",
    "--color-action-primary":palette.primary,
    "--color-action-primary-hover":autoPalette?palette.primaryHover:structural.primaryHover,
    "--color-action-primary-active":palette.secondary,
    "--color-action-accent":palette.accent,
    "--color-focus-ring":palette.accent,
    "--color-border-active":palette.primary,
    "--color-surface-teal":autoPalette
      ? `color-mix(in srgb,${palette.primary} 10%,var(--color-surface))`
      : "var(--color-surface-soft)",
    "--color-brand-secondary":palette.primary,
    "--color-brand-primary":palette.accent,
    "--brand-teal":palette.primary,
    "--brand-teal-hover":autoPalette?palette.primaryHover:structural.primaryHover,
    "--brand-mint":palette.accent,
  };
}
