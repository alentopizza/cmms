"use client";

import {
  forwardRef,
  useId,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import UiIcon from "@/components/UiIcon";

type FieldMeta={
  label?:string;
  required?:boolean;
  helperText?:string;
  errorMessage?:string;
  successMessage?:string;
};

function FieldShell({
  id,
  label,
  required,
  helperText,
  errorMessage,
  successMessage,
  children,
  className="",
}:FieldMeta&{id:string;children:ReactNode;className?:string}){
  const feedback=errorMessage||successMessage||helperText;
  const feedbackId=feedback?id+"-feedback":undefined;
  return <div className={["ds-field",errorMessage?"ds-field-error":"",successMessage?"ds-field-success":"",className].filter(Boolean).join(" ")}>
    {label&&<label className="ds-field-label" htmlFor={id}>{label}{required&&<span aria-hidden="true"> *</span>}</label>}
    {children}
    {feedback&&<small id={feedbackId} className="ds-field-feedback" role={errorMessage?"alert":undefined}>
      {errorMessage&&<UiIcon name="error" size={13}/>}
      {!errorMessage&&successMessage&&<UiIcon name="check" size={13}/>}
      <span>{feedback}</span>
    </small>}
  </div>;
}

export type InputProps=InputHTMLAttributes<HTMLInputElement>&FieldMeta&{
  icon?:ReactNode;
  trailing?:ReactNode;
};

export const Input=forwardRef<HTMLInputElement,InputProps>(function Input({
  id:providedId,
  label,
  required,
  helperText,
  errorMessage,
  successMessage,
  icon,
  trailing,
  className,
  ...props
},ref){
  const generated=useId();
  const id=providedId||"ds-input-"+generated.replace(/:/g,"");
  const feedback=errorMessage||successMessage||helperText;
  return <FieldShell {...{id,label,required,helperText,errorMessage,successMessage}}>
    <div className={["ds-input-wrap",icon?"has-leading":"",trailing?"has-trailing":""].filter(Boolean).join(" ")}>
      {icon&&<span className="ds-input-leading" aria-hidden="true">{icon}</span>}
      <input
        {...props}
        ref={ref}
        id={id}
        required={required}
        aria-invalid={errorMessage?true:undefined}
        aria-describedby={feedback?id+"-feedback":props["aria-describedby"]}
        className={["ds-input",className||""].filter(Boolean).join(" ")}
      />
      {trailing&&<span className="ds-input-trailing">{trailing}</span>}
    </div>
  </FieldShell>;
});

export function SearchInput(props:Omit<InputProps,"type"|"icon">){
  return <Input {...props} type="search" icon={<UiIcon name="search" size={16}/>} />;
}

export function NumberInput(props:Omit<InputProps,"type">){
  return <Input {...props} type="number"/>;
}

export function CurrencyInput({currency="COP",...props}:Omit<InputProps,"type">&{currency?:string}){
  return <Input {...props} type="number" inputMode="decimal" trailing={<span className="ds-input-affix">{currency}</span>}/>;
}

export function PasswordInput(props:Omit<InputProps,"type"|"trailing">){
  const [visible,setVisible]=useState(false);
  return <Input {...props} type={visible?"text":"password"} trailing={
    <button className="ds-input-action" type="button" onClick={()=>setVisible(value=>!value)} aria-label={visible?"Ocultar contraseña":"Mostrar contraseña"}>
      <UiIcon name={visible?"eye-off":"eye"} size={16}/>
    </button>
  }/>;
}

export type TextareaProps=TextareaHTMLAttributes<HTMLTextAreaElement>&FieldMeta;

export const Textarea=forwardRef<HTMLTextAreaElement,TextareaProps>(function Textarea({
  id:providedId,label,required,helperText,errorMessage,successMessage,className,...props
},ref){
  const generated=useId();
  const id=providedId||"ds-textarea-"+generated.replace(/:/g,"");
  const feedback=errorMessage||successMessage||helperText;
  return <FieldShell {...{id,label,required,helperText,errorMessage,successMessage}}>
    <textarea
      {...props}
      ref={ref}
      id={id}
      required={required}
      aria-invalid={errorMessage?true:undefined}
      aria-describedby={feedback?id+"-feedback":props["aria-describedby"]}
      className={["ds-input","ds-textarea",className||""].filter(Boolean).join(" ")}
    />
  </FieldShell>;
});

export type SelectOption={value:string;label:string;disabled?:boolean};
export type SelectProps=SelectHTMLAttributes<HTMLSelectElement>&FieldMeta&{
  options:SelectOption[];
  placeholder?:string;
};

export const Select=forwardRef<HTMLSelectElement,SelectProps>(function Select({
  id:providedId,label,required,helperText,errorMessage,successMessage,options,placeholder="Selecciona…",className,...props
},ref){
  const generated=useId();
  const id=providedId||"ds-select-"+generated.replace(/:/g,"");
  const feedback=errorMessage||successMessage||helperText;
  return <FieldShell {...{id,label,required,helperText,errorMessage,successMessage}}>
    <div className="ds-select-wrap">
      <select
        {...props}
        ref={ref}
        id={id}
        required={required}
        aria-invalid={errorMessage?true:undefined}
        aria-describedby={feedback?id+"-feedback":props["aria-describedby"]}
        className={["ds-input","ds-select",className||""].filter(Boolean).join(" ")}
      >
        {placeholder&&<option value="">{placeholder}</option>}
        {options.map(option=><option key={option.value} value={option.value} disabled={option.disabled}>{option.label}</option>)}
      </select>
      <UiIcon name="chevron-down" size={15}/>
    </div>
  </FieldShell>;
});

type ChoiceProps=Omit<InputHTMLAttributes<HTMLInputElement>,"type">&{
  label:string;
  description?:string;
};

export const Checkbox=forwardRef<HTMLInputElement,ChoiceProps>(function Checkbox({label,description,className,...props},ref){
  return <label className={["ds-choice",className||""].filter(Boolean).join(" ")}>
    <input {...props} ref={ref} type="checkbox"/>
    <span className="ds-choice-control" aria-hidden="true"><UiIcon name="check" size={12}/></span>
    <span className="ds-choice-copy"><strong>{label}</strong>{description&&<small>{description}</small>}</span>
  </label>;
});

export const Radio=forwardRef<HTMLInputElement,ChoiceProps>(function Radio({label,description,className,...props},ref){
  return <label className={["ds-choice","ds-radio",className||""].filter(Boolean).join(" ")}>
    <input {...props} ref={ref} type="radio"/>
    <span className="ds-choice-control" aria-hidden="true"/>
    <span className="ds-choice-copy"><strong>{label}</strong>{description&&<small>{description}</small>}</span>
  </label>;
});

export const Switch=forwardRef<HTMLInputElement,ChoiceProps>(function Switch({label,description,className,...props},ref){
  return <label className={["ds-switch",className||""].filter(Boolean).join(" ")}>
    <input {...props} ref={ref} type="checkbox" role="switch"/>
    <span className="ds-switch-track" aria-hidden="true"><span/></span>
    <span className="ds-choice-copy"><strong>{label}</strong>{description&&<small>{description}</small>}</span>
  </label>;
});
