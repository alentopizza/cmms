"use client";

import { useState } from "react";
import UiIcon from "@/components/UiIcon";
import { Button, IconButton, SplitButton } from "@/components/ui-kit/Button";
import { Input, SearchInput, NumberInput, CurrencyInput, PasswordInput, Textarea, Select, Checkbox, Radio, Switch } from "@/components/ui-kit/FormControls";
import { MultiSelect, SearchSelect, AsyncSelect, type AdvancedSelectOption } from "@/components/ui-kit/AdvancedSelect";
import { Badge, StatusIndicator } from "@/components/ui-kit/Badge";
import { Card } from "@/components/ui-kit/Card";
import { Avatar } from "@/components/ui-kit/Avatar";
import { Alert, Toast, EmptyState, EmptyStateAction, Spinner, Skeleton, LoadingCard, LoadingTable } from "@/components/ui-kit/Feedback";
import { Breadcrumb, ModuleNavigation, Pills, SegmentedControl, Stepper, Tabs } from "@/components/ui-kit/Navigation";
import { Modal, Drawer } from "@/components/ui-kit/Overlay";
import { Dropdown, Tooltip } from "@/components/ui-kit/TooltipDropdown";
import { FileUpload } from "@/components/ui-kit/FileUpload";

const selectOptions=[
  {value:"operativo",label:"Operativo"},
  {value:"gestion",label:"En gestión"},
  {value:"fuera",label:"Fuera de servicio"},
];
const supplierOptions=[
  {value:"prov-1",label:"Proveedor Andino"},
  {value:"prov-2",label:"Servicios Técnicos"},
  {value:"prov-3",label:"Suministros Central"},
];

export function CorePrimitivesPreview(){
  const [modalOpen,setModalOpen]=useState(false);
  const [drawerOpen,setDrawerOpen]=useState(false);
  const [segment,setSegment]=useState("grid");
  const [toastVisible,setToastVisible]=useState(true);

  async function loadSuppliers(query:string):Promise<AdvancedSelectOption[]>{
    await new Promise(resolve=>window.setTimeout(resolve,260));
    return supplierOptions.filter(option=>option.label.toLocaleLowerCase("es").includes(query.toLocaleLowerCase("es")));
  }

  return <div className="ds-core-preview">
    <section className="ds-preview-section" id="buttons">
      <div className="ds-preview-heading">
        <span>UI Core</span><h2>Buttons</h2>
        <p>Una acción principal por superficie; variantes semánticas para estados y acciones destructivas.</p>
      </div>
      <div className="ds-demo-grid">
        <div className="ds-demo-block"><strong>Variantes</strong><div className="ds-demo-row">
          <Button iconLeft="plus">Principal</Button>
          <Button variant="secondary">Secundario</Button>
          <Button variant="tertiary">Terciario</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="success" iconLeft="check">Guardar</Button>
          <Button variant="danger" iconLeft="trash">Eliminar</Button>
        </div></div>
        <div className="ds-demo-block"><strong>Estados y tamaños</strong><div className="ds-demo-row">
          <Button size="sm">Small</Button>
          <Button>Medium</Button>
          <Button size="lg">Large</Button>
          <Button loading>Cargando</Button>
          <Button disabled>Disabled</Button>
          <IconButton icon="edit" label="Editar"/>
          <SplitButton onMenuClick={()=>setToastVisible(true)}>Exportar</SplitButton>
        </div></div>
      </div>
    </section>

    <section className="ds-preview-section" id="forms">
      <div className="ds-preview-heading">
        <span>UI Core</span><h2>Forms</h2>
        <p>Labels, ayuda, errores y éxito forman parte del control; no se resuelven con CSS local por módulo.</p>
      </div>
      <div className="ds-form-preview-grid">
        <Input label="Nombre" required placeholder="Escribe el nombre" helperText="Nombre visible en el ERP."/>
        <SearchInput label="Búsqueda" placeholder="Buscar activos…"/>
        <Input label="Campo válido" defaultValue="Dato correcto" successMessage="Dato válido."/>
        <Input label="Campo con error" defaultValue="Valor inválido" errorMessage="Revisa este campo."/>
        <NumberInput label="Cantidad" defaultValue={12} min={0}/>
        <CurrencyInput label="Costo unitario" defaultValue={36500} currency="COP"/>
        <PasswordInput label="Contraseña" defaultValue="desweb-demo"/>
        <Select label="Estado" options={selectOptions} defaultValue="operativo"/>
        <Textarea label="Observaciones" placeholder="Escribe un comentario…" helperText="Máximo según la regla del formulario."/>
        <Input label="Solo lectura" value="No editable" readOnly/>
        <Input label="Deshabilitado" placeholder="No disponible" disabled/>
      </div>

      <div className="ds-demo-grid">
        <div className="ds-demo-block"><strong>Selección</strong><div className="ds-choice-preview">
          <Checkbox label="Notificar cambios" description="Envía avisos cuando el proceso cambie." defaultChecked/>
          <Radio name="priority-demo" label="Prioridad media" defaultChecked/>
          <Radio name="priority-demo" label="Prioridad alta"/>
          <Switch label="Automatización activa" description="Permite ejecutar la regla configurada." defaultChecked/>
        </div></div>
        <div className="ds-demo-block"><strong>Select avanzado</strong><div className="ds-select-preview">
          <SearchSelect label="Proveedor" options={supplierOptions} defaultValue="prov-1"/>
          <MultiSelect label="Especialidades" options={[{value:"elec",label:"Eléctrico"},{value:"mec",label:"Mecánico"},{value:"civil",label:"Civil"}]} defaultValues={["elec","mec"]}/>
          <AsyncSelect label="Proveedor remoto" loadOptions={loadSuppliers} helperText="Escribe al menos 2 caracteres."/>
        </div></div>
      </div>

      <FileUpload label="Evidencia opcional" description="PNG, JPG o PDF. El servidor conserva la validación final." accept=".png,.jpg,.jpeg,.pdf,image/png,image/jpeg,application/pdf" maxSizeMb={8}/>
    </section>

    <section className="ds-preview-section" id="cards">
      <div className="ds-preview-heading">
        <span>UI Core</span><h2>Cards, badges y avatar</h2>
        <p>La card base es neutral; estado y jerarquía usan color de forma funcional.</p>
      </div>
      <div className="ds-card-preview-grid">
        <Card header={<strong>Card básica</strong>} footer={<span className="ds-demo-muted">Metadatos del registro</span>}>
          <p>Contenido empresarial sin decoración innecesaria.</p>
        </Card>
        <Card variant="elevated" header={<strong>Card elevada</strong>}><p>Reservada para superficies que realmente necesitan elevación.</p></Card>
        <Card variant="interactive" tabIndex={0} header={<strong>Card interactiva</strong>}><p>Hover y focus indican que se puede accionar.</p></Card>
        <Card variant="selected" header={<strong>Card seleccionada</strong>}><p>El borde activo comunica selección actual.</p></Card>
      </div>
      <div className="ds-demo-row">
        <Badge variant="success" icon="check">Operativo</Badge>
        <Badge variant="warning" icon="warning">Stock bajo</Badge>
        <Badge variant="danger" icon="error">Fuera de servicio</Badge>
        <Badge variant="info" icon="info">En gestión</Badge>
        <Badge variant="brand">DESWEB</Badge>
        <StatusIndicator variant="success" label="Disponible"/>
        <StatusIndicator variant="warning" label="Pendiente"/>
        <Avatar initials="PD" size="lg" status={<span aria-label="Conectado"/>}/>
      </div>
    </section>

    <section className="ds-preview-section" id="navigation">
      <div className="ds-preview-heading">
        <span>UI Core</span><h2>Navigation</h2>
        <p>Tabs y navegación secundaria comparten una misma gramática visual y accesible.</p>
      </div>
      <Breadcrumb items={[{label:"Inicio",href:"/dashboard"},{label:"Activos",href:"/dashboard/assets"},{label:"Activo TR-SIE-2500"}]}/>
      <ModuleNavigation activeHref="/dashboard/assets" items={[{label:"Lista de activos",href:"/dashboard/assets"},{label:"Tipos",href:"/dashboard/assets"},{label:"Categorías",href:"/dashboard/assets"},{label:"Mantenimientos",href:"/dashboard/maintenance"}]}/>
      <Stepper
        activeId="sites"
        items={[
          {id:"general",label:"Configuración",description:"Datos generales",completed:true,href:"#navigation"},
          {id:"sites",label:"Sedes",description:"Geocercas",href:"#navigation"},
          {id:"enrollment",label:"Enrolamiento",description:"Biometría",href:"#navigation"},
          {id:"policy",label:"Política",description:"Reglas y roles",href:"#navigation"},
          {id:"summary",label:"Resumen",description:"Confirmación",href:"#navigation"},
        ]}
      />
      <Tabs items={[{id:"general",label:"Información general",content:<p>Contenido de la pestaña activa.</p>},{id:"history",label:"Historial",content:<p>Historial del registro.</p>},{id:"disabled",label:"Deshabilitada",disabled:true}]}/>
      <Pills items={[{id:"all",label:"Todos"},{id:"active",label:"Activos"},{id:"inactive",label:"Inactivos"}]}/>
      <SegmentedControl value={segment} onChange={setSegment} items={[{value:"grid",label:"Tarjetas"},{value:"table",label:"Tabla"}]}/>
    </section>

    <section className="ds-preview-section" id="overlays">
      <div className="ds-preview-heading">
        <span>UI Core</span><h2>Overlays y acciones contextuales</h2>
        <p>Modal y Drawer gestionan Escape, restauración de foco y focus trap.</p>
      </div>
      <div className="ds-demo-row">
        <Button variant="secondary" onClick={()=>setModalOpen(true)}>Abrir modal</Button>
        <Button variant="secondary" onClick={()=>setDrawerOpen(true)}>Abrir drawer</Button>
        <Tooltip content="Información complementaria de la acción"><IconButton icon="info" label="Ayuda"/></Tooltip>
        <Dropdown
          trigger={<span className="ds-dropdown-demo-trigger"><UiIcon name="more" size={18}/> Acciones</span>}
          items={[
            {label:"Ver detalle",icon:"eye"},
            {label:"Editar",icon:"edit"},
            {label:"Eliminar",icon:"trash",danger:true},
          ]}
        />
      </div>
      <Modal open={modalOpen} onClose={()=>setModalOpen(false)} title="Modal de formulario" description="Ejemplo del overlay oficial." footer={<><Button variant="secondary" onClick={()=>setModalOpen(false)}>Cancelar</Button><Button onClick={()=>setModalOpen(false)}>Guardar</Button></>}>
        <div className="ds-form-preview-grid"><Input label="Nombre" defaultValue="Activo demo"/><Select label="Estado" options={selectOptions} defaultValue="operativo"/></div>
      </Modal>
      <Drawer open={drawerOpen} onClose={()=>setDrawerOpen(false)} title="Detalle contextual" description="Usa Drawer para información auxiliar, filtros o edición contextual." footer={<Button fullWidth onClick={()=>setDrawerOpen(false)}>Cerrar</Button>}>
        <Alert variant="info" title="Patrón contextual">Los perfiles completos continúan navegando en página cuando el dominio así lo exige.</Alert>
      </Drawer>
    </section>

    <section className="ds-preview-section" id="feedback">
      <div className="ds-preview-heading">
        <span>UI Core</span><h2>Feedback y estados vacíos</h2>
        <p>El estado nunca depende solo del color y los mensajes indican la siguiente acción.</p>
      </div>
      <div className="ds-feedback-grid">
        <Alert variant="success" title="Completado">El registro fue guardado correctamente.</Alert>
        <Alert variant="warning" title="Revisión requerida">Faltan datos antes de continuar.</Alert>
        <Alert variant="danger" title="No fue posible guardar">Corrige los campos indicados.</Alert>
        <Alert variant="info" title="Información">La importación será validada antes del commit.</Alert>
      </div>
      {toastVisible&&<Toast variant="success" title="Actualizado" message="Los cambios quedaron listos para continuar." onClose={()=>setToastVisible(false)}/>}
      {!toastVisible&&<Button variant="secondary" onClick={()=>setToastVisible(true)}>Mostrar toast</Button>}
      <div className="ds-demo-grid">
        <EmptyState icon="file" title="Aún no hay documentos" description="Adjunta la primera evidencia para construir el expediente." action={<EmptyStateAction>Agregar documento</EmptyStateAction>}/>
        <div className="ds-demo-block"><strong>Loading</strong><div className="ds-loading-preview"><Spinner/><Skeleton width="70%" height={18}/><LoadingCard/></div></div>
      </div>
      <LoadingTable rows={3}/>
    </section>
  </div>;
}
