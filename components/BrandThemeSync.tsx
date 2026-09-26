"use client";

import { useEffect } from "react";

type ThemePreference="light"|"dark"|"system";

function resolveTheme(preference:ThemePreference){
  if(preference!=="system")return preference;
  return window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";
}

export default function BrandThemeSync({organizationDefault}:{organizationDefault:ThemePreference}){
  useEffect(()=>{
    const saved=localStorage.getItem("desweb-theme");
    const hasPersonal=saved==="light"||saved==="dark"||saved==="system";
    const preference:ThemePreference=hasPersonal?saved as ThemePreference:organizationDefault;
    document.documentElement.dataset.themePreference=preference;
    document.documentElement.dataset.theme=resolveTheme(preference);

    if(preference!=="system")return;
    const media=window.matchMedia("(prefers-color-scheme: dark)");
    const update=()=>{
      const current=localStorage.getItem("desweb-theme");
      if(current&&current!=="system")return;
      document.documentElement.dataset.theme=media.matches?"dark":"light";
    };
    media.addEventListener("change",update);
    return()=>media.removeEventListener("change",update);
  },[organizationDefault]);

  return null;
}
