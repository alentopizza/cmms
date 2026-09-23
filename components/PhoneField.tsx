"use client";

import { useEffect, useMemo, useState } from "react";
import { callingCodeForCountry, e164Phone, nationalPhonePart } from "@/lib/country-calling-codes";

export default function PhoneField({
  name,
  id,
  label="Teléfono / WhatsApp",
  countryCode,
  countryInputId,
  defaultValue="",
  value,
  onValueChange,
  placeholder="300 123 4567",
  required=false,
  disabled=false,
  help,
}:{
  name?:string;
  id?:string;
  label?:string;
  countryCode?:string|null;
  countryInputId?:string;
  defaultValue?:string|null;
  value?:string;
  onValueChange?:(value:string)=>void;
  placeholder?:string;
  required?:boolean;
  disabled?:boolean;
  help?:string;
}){
  const [country,setCountry]=useState(String(countryCode||"").toUpperCase());
  const sourceValue=value!==undefined?value:String(defaultValue||"");
  const [national,setNational]=useState(()=>nationalPhonePart(sourceValue,country));
  const controlled=value!==undefined;

  useEffect(()=>{
    if(!countryInputId)return;
    const input=document.getElementById(countryInputId) as HTMLInputElement|null;
    if(!input)return;
    const sync=()=>setCountry(String(input.value||"").trim().toUpperCase());
    sync();
    input.addEventListener("input",sync);
    input.addEventListener("change",sync);
    return()=>{input.removeEventListener("input",sync);input.removeEventListener("change",sync);};
  },[countryInputId]);

  useEffect(()=>{
    if(controlled)setNational(nationalPhonePart(value,country));
  },[controlled,value,country]);

  const calling=callingCodeForCountry(country);
  const full=useMemo(()=>e164Phone(country,national),[country,national]);
  const whatsapp=full?`https://wa.me/${full.replace(/\D/g,"")}`:"";
  const tel=full?`tel:${full}`:"";

  function change(raw:string){
    const next=raw.replace(/[^0-9\s().-]/g,"");
    setNational(next);
    onValueChange?.(e164Phone(country,next));
  }

  return <div className="field phone-field">
    <label htmlFor={id}>{label}{required?" *":""}</label>
    <div className="phone-field-row">
      <span className={`phone-country-code ${calling?"":"unknown"}`} title={calling?`Indicativo automático para ${country}`:"País sin indicativo configurado"}>
        {calling?`+${calling}`:"+—"}
      </span>
      <input
        id={id}
        type="tel"
        inputMode="tel"
        value={national}
        onChange={event=>change(event.target.value)}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        autoComplete="tel-national"
      />
      <div className="phone-quick-actions">
        <a
          className={`phone-action whatsapp ${whatsapp?"":"disabled"}`}
          href={whatsapp||undefined}
          target="_blank"
          rel="noreferrer"
          title="Abrir conversación en WhatsApp"
          data-tooltip="WhatsApp"
          aria-disabled={!whatsapp}
        >W</a>
        <a
          className={`phone-action call ${tel?"":"disabled"}`}
          href={tel||undefined}
          title="Iniciar una llamada telefónica"
          data-tooltip="Llamar"
          aria-disabled={!tel}
        >☎</a>
      </div>
    </div>
    {name&&<input type="hidden" name={name} value={full}/>}
    <small>{help||(
      calling
        ? `Indicativo +${calling} tomado de ${country}. Escribe solo el número restante.`
        : "Escribe el número con indicativo internacional si el país no está configurado."
    )}</small>
  </div>;
}
