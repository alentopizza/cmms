import Link from "next/link";
import { redirect } from "next/navigation";
import BrandPersonalization from "@/components/BrandPersonalization";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { getOrganizationBranding } from "@/lib/organization-branding";
import { Alert } from "@/components/ui-kit/Feedback";
import { Badge } from "@/components/ui-kit/Badge";
import UiIcon from "@/components/UiIcon";

export const dynamic="force-dynamic";

export default async function BrandPage({
  searchParams,
}:{
  searchParams:Promise<{branding_saved?:string;branding_error?:string;branding_reset?:string}>;
}){
  const session=await getSession();
  if(!session)redirect("/login");
  if(!session.organizationId||session.role!=="admin")redirect("/dashboard/settings");

  const params=await searchParams;
  const organization=await query<{name:string;has_logo:boolean;active:boolean;site_count:number;city:string|null}>(
    `SELECT o.name,(o.logo_data IS NOT NULL) has_logo,o.active,
            (SELECT count(*)::int FROM sites s WHERE s.organization_id=o.id) site_count,
            (SELECT s.city FROM sites s
             WHERE s.organization_id=o.id AND nullif(trim(s.city),'') IS NOT NULL
             ORDER BY s.created_at ASC LIMIT 1) city
     FROM organizations o WHERE o.id=$1 LIMIT 1`,
    [session.organizationId],
  );
  if(!organization.rowCount)redirect("/dashboard");

  const org=organization.rows[0];
  const branding=await getOrganizationBranding(session.organizationId);
  const proEnabled=session.planCode==="pro"&&session.whiteLabel;
  const brandingErrorMessage=params.branding_error==="image-type"
    ?"El logo debe ser PNG, JPG o WebP."
    :params.branding_error==="image-size"
      ?"El logo supera el tamaño máximo permitido de 2 MB."
      :params.branding_error==="image-invalid"
        ?"El archivo no contiene una imagen válida o sus dimensiones no son compatibles."
        :params.branding_error==="invalid"
          ?"Revisa los colores HEX y las opciones de apariencia seleccionadas."
          :params.branding_error
            ?"No fue posible guardar la identidad visual. Intenta nuevamente."
            :"";
  const logoFallbackSrc=org.has_logo
    ? `/api/organizations/${session.organizationId}/assets/logo`
    : "/brand/desweb-logo-dark.webp";
  const logoSrc=branding.hasLogoOnDark
    ? "/api/organization-branding/logo/dark"
    : branding.hasLogoOnLight
      ? "/api/organization-branding/logo/light"
      : logoFallbackSrc;

  return <div className="phase-brand-personalization">
    <header className="brand-page-header">
      <div className="brand-page-title">
        <span className="brand-page-icon"><UiIcon name="preferences" size={19}/></span>
        <div><span className="eyebrow">Configuración</span><div className="brand-title-row"><h1>Personalización de marca</h1><Badge variant="brand">PRO</Badge></div><p>Define la identidad visual de tu empresa en CMMS.</p></div>
      </div>
      <Link className="brand-settings-back" href="/dashboard/settings"><UiIcon name="chevron-left" size={15}/> Configuración</Link>
    </header>

    {params.branding_saved==="1"&&<Alert variant="success" title="Identidad visual actualizada">La configuración de marca de {org.name} quedó guardada.</Alert>}
    {params.branding_reset==="1"&&<Alert variant="success" title="Identidad restaurada">La empresa volvió a utilizar la identidad predeterminada de Desweb CMMS.</Alert>}
    {params.branding_error&&<Alert variant="danger" title="No fue posible guardar la identidad visual">{brandingErrorMessage}</Alert>}

    {!proEnabled?<section className="brand-upgrade-card">
      <span className="brand-upgrade-icon"><UiIcon name="company" size={24}/></span>
      <div><Badge variant="brand">PRO</Badge><h2>Personalización avanzada de marca</h2><p>Esta experiencia pertenece al Plan Pro. El plan actual de la empresa no habilita marca blanca; puedes revisar los planes existentes sin modificar la suscripción desde esta pantalla.</p></div>
      <Link className="ds-button ds-button-primary ds-button-md" href="/#planes"><span>Ver opciones de plan</span><UiIcon name="chevron-right" size={15}/></Link>
    </section>:<BrandPersonalization
      organizationName={org.name}
      logoSrc={logoSrc}
      logoFallbackSrc={logoFallbackSrc}
      previewData={{city:org.city,siteCount:org.site_count,active:org.active}}
      initial={{
        appName:branding.appName||`${org.name} CMMS`,
        primaryColor:branding.primaryColor,
        secondaryColor:branding.secondaryColor,
        accentColor:branding.accentColor,
        schemeKey:branding.schemeKey,
        autoPalette:branding.autoPalette,
        interfaceStyle:branding.interfaceStyle,
        interfaceDensity:branding.interfaceDensity,
        hasBrandLogo:branding.hasLogoOnDark||branding.hasLogoOnLight,
        hasCompanyLogo:org.has_logo,
      }}
    />}
  </div>;
}
