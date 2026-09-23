export const COUNTRY_CALLING_CODES: Record<string,string> = {
  AR:"54", BO:"591", BR:"55", CA:"1", CL:"56", CO:"57", CR:"506", CU:"53",
  DO:"1", EC:"593", SV:"503", GT:"502", HN:"504", MX:"52", NI:"505", PA:"507",
  PY:"595", PE:"51", PR:"1", US:"1", UY:"598", VE:"58",
  ES:"34", PT:"351", FR:"33", DE:"49", IT:"39", GB:"44", IE:"353",
};

export function callingCodeForCountry(countryCode:string|null|undefined){
  const code=String(countryCode||"").trim().toUpperCase();
  return COUNTRY_CALLING_CODES[code]||"";
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
