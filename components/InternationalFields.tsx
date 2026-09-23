"use client";

import { useEffect, useMemo, useState } from "react";
import {
  COUNTRY_OPTIONS,
  SUPPORTED_LOCALES,
  citiesForCountry,
  personalDocumentTypesForCountry,
  taxIdTypesForCountry,
  timezonesForCountry,
} from "@/lib/international-catalog";

function useObservedCountry(elementId:string|undefined,fallback:string){
  const [country,setCountry]=useState(String(fallback||"CO").toUpperCase());
  useEffect(()=>{
    if(!elementId)return;
    const input=document.getElementById(elementId) as HTMLInputElement|HTMLSelectElement|null;
    if(!input)return;
    const sync=()=>setCountry(String(input.value||"CO").trim().toUpperCase());
    sync();
    input.addEventListener("input",sync);
    input.addEventListener("change",sync);
    return()=>{input.removeEventListener("input",sync);input.removeEventListener("change",sync);};
  },[elementId]);
  return country;
}

export function CountrySelect({
  id,name="country",label="País",defaultValue="CO",value,onChange,required=false,disabled=false,
}:{
  id?:string;name?:string;label?:string;defaultValue?:string;value?:string;onChange?:(value:string)=>void;required?:boolean;disabled?:boolean;
}){
  const controlled=value!==undefined;
  return <div className="field international-select-field">
    <label htmlFor={id}>{label}{required?" *":""}</label>
    <select id={id} name={name} value={controlled?value:undefined} defaultValue={controlled?undefined:defaultValue} onChange={event=>onChange?.(event.target.value)} required={required} disabled={disabled}>
      <option value="" disabled>Selecciona un país</option>
      {COUNTRY_OPTIONS.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  </div>;
}

export function CountryCityFields({
  countryId,countryName="country",cityId,cityName="city",countryLabel="País",cityLabel="Ciudad",
  defaultCountry="CO",defaultCity="",required=true,
}:{
  countryId:string;countryName?:string;cityId:string;cityName?:string;countryLabel?:string;cityLabel?:string;
  defaultCountry?:string|null;defaultCity?:string|null;required?:boolean;
}){
  const [country,setCountry]=useState(String(defaultCountry||"CO").toUpperCase());
  const [city,setCity]=useState(String(defaultCity||""));
  const cities=useMemo(()=>citiesForCountry(country),[country]);
  const legacy=Boolean(city&&!cities.includes(city));

  useEffect(()=>{
    if(city&&!cities.includes(city))return;
    if(city&&cities.includes(city))return;
    setCity("");
  },[country]);

  return <>
    <div className="field international-select-field">
      <label htmlFor={countryId}>{countryLabel}{required?" *":""}</label>
      <select id={countryId} name={countryName} value={country} onChange={event=>{setCountry(event.target.value);setCity("");}} required={required}>
        <option value="" disabled>Selecciona un país</option>
        {COUNTRY_OPTIONS.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </div>
    <div className="field international-select-field">
      <label htmlFor={cityId}>{cityLabel}{required?" *":""}</label>
      <select id={cityId} name={cityName} value={city} onChange={event=>setCity(event.target.value)} required={required} disabled={!country}>
        <option value="">Selecciona una ciudad</option>
        {legacy&&<option value={city}>{city} · registrada previamente</option>}
        {cities.map(item=><option key={item} value={item}>{item}</option>)}
      </select>
      <small>Las ciudades disponibles dependen del país seleccionado.</small>
    </div>
  </>;
}

export function TaxIdentificationTypeSelect({
  id,name="tax_id_type",countryInputId,countryCode="CO",defaultValue="",required=false,label="Tipo de identificación",
}:{
  id?:string;name?:string;countryInputId?:string;countryCode?:string|null;defaultValue?:string|null;required?:boolean;label?:string;
}){
  const country=useObservedCountry(countryInputId,String(countryCode||"CO"));
  const options=taxIdTypesForCountry(country);
  const [selected,setSelected]=useState(String(defaultValue||""));
  useEffect(()=>{
    if(options.some(option=>option.value===selected))return;
    setSelected(options[0]?.value||"");
  },[country]);
  const legacy=Boolean(selected&&!options.some(option=>option.value===selected));
  return <div className="field international-select-field">
    <label htmlFor={id}>{label}{required?" *":""}</label>
    <select id={id} name={name} value={selected} onChange={event=>setSelected(event.target.value)} required={required}>
      <option value="">Selecciona un tipo</option>
      {legacy&&<option value={selected}>{selected} · registrado previamente</option>}
      {options.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  </div>;
}

export function PersonalDocumentTypeSelect({
  id,name="identity_document_type",countryInputId,countryCode="CO",defaultValue="",value,onChange,required=false,label="Tipo de documento",
}:{
  id?:string;name?:string;countryInputId?:string;countryCode?:string|null;defaultValue?:string|null;value?:string;onChange?:(value:string)=>void;required?:boolean;label?:string;
}){
  const observed=useObservedCountry(countryInputId,String(countryCode||"CO"));
  const country=countryInputId ? observed : String(countryCode||observed||"CO").toUpperCase();
  const options=personalDocumentTypesForCountry(country);
  const current=value!==undefined?value:String(defaultValue||"");
  const legacy=Boolean(current&&!options.some(option=>option.value===current));
  return <div className="field international-select-field">
    <label htmlFor={id}>{label}{required?" *":""}</label>
    <select id={id} name={name} value={value!==undefined?value:undefined} defaultValue={value===undefined?current:undefined} onChange={event=>onChange?.(event.target.value)} required={required}>
      <option value="">Selecciona un tipo</option>
      {legacy&&<option value={current}>{current} · registrado previamente</option>}
      {options.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  </div>;
}

export function CountryTimezoneSelect({
  id,name="timezone",countryInputId,countryCode="CO",defaultValue="America/Bogota",required=true,label="Zona horaria",
}:{
  id?:string;name?:string;countryInputId?:string;countryCode?:string|null;defaultValue?:string|null;required?:boolean;label?:string;
}){
  const country=useObservedCountry(countryInputId,String(countryCode||"CO"));
  const zones=timezonesForCountry(country);
  const [selected,setSelected]=useState(String(defaultValue||""));
  useEffect(()=>{
    if(zones.includes(selected))return;
    setSelected(zones[0]||selected||"UTC");
  },[country]);
  const legacy=Boolean(selected&&!zones.includes(selected));
  return <div className="field international-select-field">
    <label htmlFor={id}>{label}{required?" *":""}</label>
    <select id={id} name={name} value={selected} onChange={event=>setSelected(event.target.value)} required={required}>
      {legacy&&<option value={selected}>{selected}</option>}
      {zones.map(zone=><option key={zone} value={zone}>{zone}</option>)}
    </select>
  </div>;
}

export function LocaleSelect({id,name="locale",defaultValue="es-CO",label="Idioma de la interfaz"}:{id?:string;name?:string;defaultValue?:string|null;label?:string}){
  return <div className="field international-select-field">
    <label htmlFor={id}>{label}</label>
    <select id={id} name={name} defaultValue={String(defaultValue||"es-CO")}>
      {SUPPORTED_LOCALES.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
    <small>La preferencia queda lista para el sistema de traducciones; mientras una pantalla no tenga diccionario específico continuará usando español.</small>
  </div>;
}
