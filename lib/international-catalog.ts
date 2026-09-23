export type CatalogOption = { value:string; label:string };

export type CountryDefinition = {
  code:string;
  name:string;
  callingCode:string;
  defaultLocale:string;
  currency:string;
  timezones:string[];
  taxIdTypes:CatalogOption[];
  personalDocumentTypes:CatalogOption[];
  cities:string[];
};

export const SUPPORTED_LOCALES:CatalogOption[] = [
  {value:"es-CO",label:"Español · Colombia"},
  {value:"es-MX",label:"Español · México"},
  {value:"es-PE",label:"Español · Perú"},
  {value:"es-EC",label:"Español · Ecuador"},
  {value:"es-CL",label:"Español · Chile"},
  {value:"es-AR",label:"Español · Argentina"},
  {value:"es-ES",label:"Español · España"},
  {value:"en-US",label:"English · United States"},
  {value:"pt-BR",label:"Português · Brasil"},
];

const passport={value:"passport",label:"Pasaporte"};

export const COUNTRIES:CountryDefinition[] = [
  {code:"CO",name:"Colombia",callingCode:"57",defaultLocale:"es-CO",currency:"COP",timezones:["America/Bogota"],
    taxIdTypes:[{value:"NIT",label:"NIT · Número de Identificación Tributaria"}],
    personalDocumentTypes:[{value:"CC",label:"Cédula de ciudadanía"},{value:"CE",label:"Cédula de extranjería"},{value:"PPT",label:"Permiso por Protección Temporal"},passport],
    cities:["Bogotá","Medellín","Cali","Barranquilla","Cartagena","Bucaramanga","Cúcuta","Pereira","Manizales","Armenia","Santa Marta","Villavicencio","Ibagué","Neiva","Pasto","Montería","Sincelejo","Valledupar","Tunja","Popayán","Florencia","Riohacha","Quibdó","Yopal","Arauca","San José del Guaviare","Mocoa","Leticia","Inírida","Mitú","Puerto Carreño","San Andrés","Soacha","Bello","Envigado","Itagüí","Palmira","Buenaventura","Dosquebradas"]},
  {code:"PE",name:"Perú",callingCode:"51",defaultLocale:"es-PE",currency:"PEN",timezones:["America/Lima"],
    taxIdTypes:[{value:"RUC",label:"RUC · Registro Único de Contribuyentes"}],
    personalDocumentTypes:[{value:"DNI",label:"DNI · Documento Nacional de Identidad"},{value:"CE",label:"Carné de extranjería"},passport],
    cities:["Lima","Arequipa","Trujillo","Chiclayo","Piura","Cusco","Iquitos","Huancayo","Tacna","Puno","Chimbote","Ica","Cajamarca","Ayacucho","Pucallpa","Tarapoto","Juliaca","Huánuco"]},
  {code:"EC",name:"Ecuador",callingCode:"593",defaultLocale:"es-EC",currency:"USD",timezones:["America/Guayaquil","Pacific/Galapagos"],
    taxIdTypes:[{value:"RUC",label:"RUC · Registro Único de Contribuyentes"}],
    personalDocumentTypes:[{value:"CI",label:"Cédula de identidad"},passport],
    cities:["Quito","Guayaquil","Cuenca","Santo Domingo","Machala","Manta","Portoviejo","Ambato","Riobamba","Loja","Ibarra","Esmeraldas","Quevedo","Latacunga"]},
  {code:"MX",name:"México",callingCode:"52",defaultLocale:"es-MX",currency:"MXN",timezones:["America/Mexico_City","America/Cancun","America/Monterrey","America/Tijuana","America/Chihuahua"],
    taxIdTypes:[{value:"RFC",label:"RFC · Registro Federal de Contribuyentes"}],
    personalDocumentTypes:[{value:"INE",label:"Credencial para votar · INE"},{value:"CURP",label:"CURP"},passport],
    cities:["Ciudad de México","Guadalajara","Monterrey","Puebla","Tijuana","León","Ciudad Juárez","Querétaro","Mérida","San Luis Potosí","Aguascalientes","Mexicali","Cancún","Chihuahua","Toluca","Morelia","Veracruz","Hermosillo"]},
  {code:"CL",name:"Chile",callingCode:"56",defaultLocale:"es-CL",currency:"CLP",timezones:["America/Santiago","Pacific/Easter"],
    taxIdTypes:[{value:"RUT",label:"RUT · Rol Único Tributario"}],
    personalDocumentTypes:[{value:"RUN",label:"RUN / Cédula de identidad"},passport],
    cities:["Santiago","Valparaíso","Viña del Mar","Concepción","Antofagasta","Temuco","Rancagua","Talca","Puerto Montt","La Serena","Coquimbo","Iquique","Arica","Chillán"]},
  {code:"AR",name:"Argentina",callingCode:"54",defaultLocale:"es-AR",currency:"ARS",timezones:["America/Argentina/Buenos_Aires"],
    taxIdTypes:[{value:"CUIT",label:"CUIT · Clave Única de Identificación Tributaria"}],
    personalDocumentTypes:[{value:"DNI",label:"DNI · Documento Nacional de Identidad"},passport],
    cities:["Buenos Aires","Córdoba","Rosario","Mendoza","La Plata","San Miguel de Tucumán","Mar del Plata","Salta","Santa Fe","San Juan","Neuquén","Resistencia","Posadas","Bahía Blanca"]},
  {code:"BR",name:"Brasil",callingCode:"55",defaultLocale:"pt-BR",currency:"BRL",timezones:["America/Sao_Paulo","America/Manaus","America/Recife","America/Cuiaba"],
    taxIdTypes:[{value:"CNPJ",label:"CNPJ · Cadastro Nacional da Pessoa Jurídica"}],
    personalDocumentTypes:[{value:"CPF",label:"CPF"},{value:"RG",label:"RG · Registro Geral"},passport],
    cities:["São Paulo","Rio de Janeiro","Brasília","Salvador","Fortaleza","Belo Horizonte","Manaus","Curitiba","Recife","Goiânia","Porto Alegre","Belém","Campinas","Florianópolis"]},
  {code:"PA",name:"Panamá",callingCode:"507",defaultLocale:"es-CO",currency:"PAB",timezones:["America/Panama"],
    taxIdTypes:[{value:"RUC",label:"RUC · Registro Único de Contribuyente"}],
    personalDocumentTypes:[{value:"CEDULA",label:"Cédula de identidad personal"},passport],
    cities:["Ciudad de Panamá","San Miguelito","Colón","David","La Chorrera","Santiago","Chitré","Penonomé","Aguadulce"]},
  {code:"CR",name:"Costa Rica",callingCode:"506",defaultLocale:"es-CO",currency:"CRC",timezones:["America/Costa_Rica"],
    taxIdTypes:[{value:"CJ",label:"Cédula jurídica"}],
    personalDocumentTypes:[{value:"CEDULA",label:"Cédula de identidad"},{value:"DIMEX",label:"DIMEX"},passport],
    cities:["San José","Alajuela","Cartago","Heredia","Liberia","Puntarenas","Limón","San Ramón","Grecia"]},
  {code:"UY",name:"Uruguay",callingCode:"598",defaultLocale:"es-AR",currency:"UYU",timezones:["America/Montevideo"],
    taxIdTypes:[{value:"RUT",label:"RUT · Registro Único Tributario"}],
    personalDocumentTypes:[{value:"CI",label:"Cédula de identidad"},passport],
    cities:["Montevideo","Salto","Paysandú","Las Piedras","Rivera","Maldonado","Tacuarembó","Melo","Mercedes"]},
  {code:"PY",name:"Paraguay",callingCode:"595",defaultLocale:"es-AR",currency:"PYG",timezones:["America/Asuncion"],
    taxIdTypes:[{value:"RUC",label:"RUC · Registro Único del Contribuyente"}],
    personalDocumentTypes:[{value:"CI",label:"Cédula de identidad"},passport],
    cities:["Asunción","Ciudad del Este","San Lorenzo","Luque","Capiatá","Fernando de la Mora","Encarnación","Mariano Roque Alonso"]},
  {code:"BO",name:"Bolivia",callingCode:"591",defaultLocale:"es-PE",currency:"BOB",timezones:["America/La_Paz"],
    taxIdTypes:[{value:"NIT",label:"NIT · Número de Identificación Tributaria"}],
    personalDocumentTypes:[{value:"CI",label:"Cédula de identidad"},passport],
    cities:["La Paz","Santa Cruz de la Sierra","Cochabamba","Sucre","El Alto","Oruro","Tarija","Potosí","Trinidad"]},
  {code:"VE",name:"Venezuela",callingCode:"58",defaultLocale:"es-CO",currency:"VES",timezones:["America/Caracas"],
    taxIdTypes:[{value:"RIF",label:"RIF · Registro de Información Fiscal"}],
    personalDocumentTypes:[{value:"CI",label:"Cédula de identidad"},passport],
    cities:["Caracas","Maracaibo","Valencia","Barquisimeto","Maracay","Ciudad Guayana","Maturín","San Cristóbal","Barcelona","Puerto La Cruz"]},
  {code:"GT",name:"Guatemala",callingCode:"502",defaultLocale:"es-MX",currency:"GTQ",timezones:["America/Guatemala"],
    taxIdTypes:[{value:"NIT",label:"NIT · Número de Identificación Tributaria"}],
    personalDocumentTypes:[{value:"DPI",label:"DPI · Documento Personal de Identificación"},passport],
    cities:["Ciudad de Guatemala","Mixco","Villa Nueva","Quetzaltenango","Escuintla","Cobán","Antigua Guatemala"]},
  {code:"DO",name:"República Dominicana",callingCode:"1",defaultLocale:"es-CO",currency:"DOP",timezones:["America/Santo_Domingo"],
    taxIdTypes:[{value:"RNC",label:"RNC · Registro Nacional de Contribuyentes"}],
    personalDocumentTypes:[{value:"CEDULA",label:"Cédula de identidad y electoral"},passport],
    cities:["Santo Domingo","Santiago de los Caballeros","La Romana","San Pedro de Macorís","Puerto Plata","San Cristóbal","Higüey"]},
  {code:"US",name:"Estados Unidos",callingCode:"1",defaultLocale:"en-US",currency:"USD",timezones:["America/New_York","America/Chicago","America/Denver","America/Los_Angeles","America/Phoenix"],
    taxIdTypes:[{value:"EIN",label:"EIN · Employer Identification Number"}],
    personalDocumentTypes:[{value:"STATE_ID",label:"State ID"},{value:"DRIVER_LICENSE",label:"Driver license"},passport],
    cities:["New York","Los Angeles","Chicago","Houston","Phoenix","Philadelphia","San Antonio","San Diego","Dallas","Miami","Austin","Orlando","Denver","Seattle","Boston","Atlanta"]},
  {code:"ES",name:"España",callingCode:"34",defaultLocale:"es-ES",currency:"EUR",timezones:["Europe/Madrid","Atlantic/Canary"],
    taxIdTypes:[{value:"NIF",label:"NIF · Número de Identificación Fiscal"}],
    personalDocumentTypes:[{value:"DNI",label:"DNI · Documento Nacional de Identidad"},{value:"NIE",label:"NIE · Número de Identidad de Extranjero"},passport],
    cities:["Madrid","Barcelona","Valencia","Sevilla","Zaragoza","Málaga","Murcia","Palma","Bilbao","Alicante","Córdoba","Valladolid","Vigo","Las Palmas de Gran Canaria"]},
];

export const COUNTRY_OPTIONS:CatalogOption[] = COUNTRIES.map(country=>({value:country.code,label:country.name}));

export function countryDefinition(code:string|null|undefined){
  const normalized=String(code||"").trim().toUpperCase();
  return COUNTRIES.find(country=>country.code===normalized)||null;
}
export function countryName(code:string|null|undefined){
  return countryDefinition(code)?.name || String(code||"");
}
export function citiesForCountry(code:string|null|undefined){
  return countryDefinition(code)?.cities || [];
}
export function callingCodeForCountry(code:string|null|undefined){
  return countryDefinition(code)?.callingCode || "";
}
export function timezonesForCountry(code:string|null|undefined){
  return countryDefinition(code)?.timezones || [];
}
export function taxIdTypesForCountry(code:string|null|undefined){
  return countryDefinition(code)?.taxIdTypes || [];
}
export function personalDocumentTypesForCountry(code:string|null|undefined){
  return countryDefinition(code)?.personalDocumentTypes || [];
}
export function defaultLocaleForCountry(code:string|null|undefined){
  return countryDefinition(code)?.defaultLocale || "es-CO";
}
export function isSupportedCountry(code:string|null|undefined){
  return Boolean(countryDefinition(code));
}
export function isSupportedLocale(locale:string|null|undefined){
  return SUPPORTED_LOCALES.some(option=>option.value===String(locale||""));
}
export function isTaxIdTypeForCountry(country:string|null|undefined,value:string|null|undefined){
  const type=String(value||"");
  return taxIdTypesForCountry(country).some(option=>option.value===type);
}
export function isPersonalDocumentTypeForCountry(country:string|null|undefined,value:string|null|undefined){
  const type=String(value||"");
  return personalDocumentTypesForCountry(country).some(option=>option.value===type);
}
