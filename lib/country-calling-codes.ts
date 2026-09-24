import { COUNTRIES, callingCodeForCountry as catalogCallingCodeForCountry } from "@/lib/international-catalog";

export const COUNTRY_CALLING_CODES:Record<string,string> = Object.fromEntries(
  COUNTRIES.map(country=>[country.code,country.callingCode]),
);

export function callingCodeForCountry(countryCode:string|null|undefined){
  return catalogCallingCodeForCountry(countryCode);
}

export function nationalPhonePart(value:string|null|undefined,countryCode:string|null|undefined){
  const raw=String(value||"").trim();
  const digits=raw.replace(/\D/g,"");
  const calling=callingCodeForCountry(countryCode);
  if(!calling)return digits;

  // Values emitted by PhoneField are E.164 (+country + national). Strip the
  // country prefix immediately, even while the user has typed only one digit.
  // Legacy national-only values without "+" keep the conservative length
  // guard so numbers that merely begin with the same digits are not truncated.
  if(raw.startsWith("+")&&digits.startsWith(calling))return digits.slice(calling.length);
  if(digits.startsWith(calling)&&digits.length>calling.length+5)return digits.slice(calling.length);
  return digits;
}

export function e164Phone(countryCode:string|null|undefined,national:string|null|undefined){
  const digits=String(national||"").replace(/\D/g,"");
  if(!digits)return "";
  const calling=callingCodeForCountry(countryCode);
  return calling?`+${calling}${digits}`:`+${digits}`;
}
