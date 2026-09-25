export const ORGANIZATION_DOCUMENT_CATEGORIES = {
  tax: "RUT / documento tributario",
  legal: "Existencia y representación legal",
  contract: "Contrato / acuerdo comercial",
  privacy: "Tratamiento de datos / privacidad",
  insurance: "Póliza / seguro",
  certification: "Certificación",
  other: "Otro documento corporativo",
} as const;

export type OrganizationDocumentCategory = keyof typeof ORGANIZATION_DOCUMENT_CATEGORIES;
export type OrganizationDocumentRequirement = "required" | "optional" | "not_applicable";
