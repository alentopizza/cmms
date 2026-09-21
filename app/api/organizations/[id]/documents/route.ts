import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { query } from "@/lib/db";
import { publicUrl } from "@/lib/urls";
import {
  ORGANIZATION_DOCUMENT_CATEGORIES,
  OrganizationDocumentUploadError,
  isOrganizationDocumentCategory,
  isOrganizationDocumentRequirement,
  readOrganizationDocumentUpload,
} from "@/lib/organization-documents";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function redirectToCompany(id: string, requestUrl: string, queryString: string) {
  return NextResponse.redirect(publicUrl("/dashboard/companies/" + id + "?" + queryString + "#documents", requestUrl), 303);
}

function dateValue(value: FormDataEntryValue | null) {
  const text = String(value || "").trim();
  return text && DATE_PATTERN.test(text) ? text : null;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });
  if (!can(session, "companies.manage")) return new NextResponse("Forbidden", { status: 403 });

  const { id } = await params;
  if (!UUID_PATTERN.test(id)) return new NextResponse("Empresa inválida", { status: 400 });

  const organization = await query("SELECT 1 FROM organizations WHERE id=$1", [id]);
  if (!organization.rowCount) return new NextResponse("Empresa no encontrada", { status: 404 });

  try {
    const form = await request.formData();
    const category = String(form.get("category") || "");
    const requirementLevel = String(form.get("requirement_level") || "optional");
    const displayName = String(form.get("display_name") || "").trim();
    const reference = String(form.get("reference") || "").trim();
    const issueDate = dateValue(form.get("issue_date"));
    const expiresAt = dateValue(form.get("expires_at"));
    const notes = String(form.get("notes") || "").trim();

    if (!isOrganizationDocumentCategory(category) || !isOrganizationDocumentRequirement(requirementLevel)) {
      return redirectToCompany(id, request.url, "error=document-fields");
    }

    const resolvedName = displayName || ORGANIZATION_DOCUMENT_CATEGORIES[category];
    const file = await readOrganizationDocumentUpload(form.get("file"));

    if (requirementLevel === "not_applicable" && file) {
      return redirectToCompany(id, request.url, "error=document-not-applicable");
    }

    await query(
      "INSERT INTO organization_documents(" +
      "organization_id,category,requirement_level,display_name,reference,issue_date,expires_at,notes," +
      "file_data,file_mime_type,file_name,file_size_bytes,uploaded_by" +
      ") VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)",
      [
        id, category, requirementLevel, resolvedName, reference || null, issueDate, expiresAt, notes || null,
        file?.bytes || null, file?.mime || null, file?.name || null, file?.size || null, session.userId || null,
      ],
    );

    return redirectToCompany(id, request.url, "saved=document");
  } catch (error) {
    if (error instanceof OrganizationDocumentUploadError) {
      return redirectToCompany(id, request.url, "error=" + error.code);
    }
    throw error;
  }
}
