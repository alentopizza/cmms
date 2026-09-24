"use client";

import { MultiSelect, type AdvancedSelectOption } from "@/components/ui-kit/AdvancedSelect";

export type MultiSelectOption=AdvancedSelectOption;

export default function MultiSelectDropdown({
  name,label,options,defaultValues=[],placeholder="Selecciona una o varias opciones",required=false,help,
}:{
  name:string;
  label:string;
  options:MultiSelectOption[];
  defaultValues?:string[];
  placeholder?:string;
  required?:boolean;
  help?:string;
}){
  return <MultiSelect
    name={name}
    label={label}
    options={options}
    defaultValues={defaultValues}
    placeholder={placeholder}
    required={required}
    helperText={help}
  />;
}
