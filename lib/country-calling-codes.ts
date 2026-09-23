import { COUNTRIES, callingCodeForCountry as catalogCallingCodeForCountry } from "@/lib/international-catalog";

export const COUNTRY_CALLING_CODES:Record<string,string> = Object.fromEntries(
  COUNTRIES.map(country=>[country.code,country.callingCode]),
);

export function callingCodeForCountry(countryCode:string|null|undefined){
  return catalogCallingCodeForCountry(countryCode);
}

export function nationalPhonePart(value:string|null|undefined,countryCode:string|null|undefined){
  const digits=String(value||"").replace(/\D/g,"");
  const calling=callingCodeForCountry(countryCode);
  if(calling&&digits.startsWith(calling)&&digits.length>calling.length+5)return digits.slice(calling.length);
  return digits;
}

export function e164Phone(countryCode:string|null|undefined,national:string|null|undefined){
  const digits=String(national||"").replace(/\D/g,"");
  if(!digits)return "";
  const calling=callingCodeForCountry(countryCode);
  return calling?`+${calling}${digits}`:`+${digits}`;
}
