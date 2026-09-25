import { ORGANIZATION_DOCUMENT_CATEGORIES, type OrganizationDocumentCategory, type OrganizationDocumentRequirement } from "@/lib/organization-document-catalog";
export { ORGANIZATION_DOCUMENT_CATEGORIES };
export type { OrganizationDocumentCategory, OrganizationDocumentRequirement };

const ALLOWED_DOCUMENT_MIME = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
]);

export class OrganizationDocumentUploadError extends Error {
  constructor(public code: "document-type" | "document-size") {
    super(code);
  }
}

export async function readOrganizationDocumentUpload(value: FormDataEntryValue | null, maxBytes = 10 * 1024 * 1024) {
  if (!(value instanceof File) || value.size === 0) return null;
  if (!ALLOWED_DOCUMENT_MIME.has(value.type)) throw new OrganizationDocumentUploadError("document-type");
  if (value.size > maxBytes) throw new OrganizationDocumentUploadError("document-size");
  return {
    bytes: Buffer.from(await value.arrayBuffer()),
    mime: value.type,
    name: value.name.slice(0, 240),
    size: value.size,
  };
}

export function isOrganizationDocumentCategory(value: string): value is OrganizationDocumentCategory {
  return Object.prototype.hasOwnProperty.call(ORGANIZATION_DOCUMENT_CATEGORIES, value);
}

export function isOrganizationDocumentRequirement(value: string): value is OrganizationDocumentRequirement {
  return value === "required" || value === "optional" || value === "not_applicable";
}
