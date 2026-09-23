import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { query } from "@/lib/db";
import { publicUrl } from "@/lib/urls";
import {
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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; documentId: string }> },
) {
  const session = await getSession();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });
  if (!can(session, "companies.manage")) return new NextResponse("Forbidden", { status: 403 });

  const { id, documentId } = await params;
  if (!UUID_PATTERN.test(id) || !UUID_PATTERN.test(documentId)) {
    return new NextResponse("Documento inválido", { status: 400 });
  }

  const result = await query<{ file_data: Buffer | null; file_mime_type: string | null; file_name: string | null }>(
    "SELECT file_data,file_mime_type,file_name FROM organization_documents " +
    "WHERE id=$1 AND organization_id=$2",
    [documentId, id],
  );
  const document = result.rows[0];
  if (!document?.file_data || !document.file_mime_type || !document.file_name) {
    return new NextResponse("Archivo no disponible", { status: 404 });
  }

  const safeName = document.file_name.replace(/[\r\n"]/g, "_");
  const inline = new URL(request.url).searchParams.get("inline") === "1";
  return new NextResponse(new Uint8Array(document.file_data), {
    headers: {
      "Content-Type": document.file_mime_type,
      "Content-Length": String(document.file_data.length),
      "Content-Disposition": (inline ? "inline" : "attachment") + "; filename=\"" + safeName + "\"; filename*=UTF-8''" + encodeURIComponent(safeName),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; documentId: string }> },
) {
  const session = await getSession();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });
  if (!can(session, "companies.manage")) return new NextResponse("Forbidden", { status: 403 });

  const { id, documentId } = await params;
  if (!UUID_PATTERN.test(id) || !UUID_PATTERN.test(documentId)) {
    return new NextResponse("Documento inválido", { status: 400 });
  }

  const current = await query<{ archived_at:string|null }>(
    "SELECT archived_at::text FROM organization_documents WHERE id=$1 AND organization_id=$2",
    [documentId, id],
  );
  if (!current.rowCount) return new NextResponse("Documento no encontrado", { status: 404 });

  const form = await request.formData();
  const intent = String(form.get("intent") || "update");

  if (intent === "archive") {
    if (current.rows[0].archived_at) {
      return redirectToCompany(id, request.url, "saved=document-archived");
    }
    await query(
      "UPDATE organization_documents SET archived_at=now(),archived_by=$1,updated_at=now() WHERE id=$2 AND organization_id=$3",
      [session.userId || null, documentId, id],
    );
    return redirectToCompany(id, request.url, "saved=document-archived");
  }

  if (intent === "restore") {
    await query(
      "UPDATE organization_documents SET archived_at=NULL,archived_by=NULL,updated_at=now() WHERE id=$1 AND organization_id=$2",
      [documentId, id],
    );
    return redirectToCompany(id, request.url, "saved=document-restored");
  }

  if (current.rows[0].archived_at) {
    return redirectToCompany(id, request.url, "error=document-archived");
  }

  try {
    const category = String(form.get("category") || "");
    const requirementLevel = String(form.get("requirement_level") || "optional");
    const displayName = String(form.get("display_name") || "").trim();
    const reference = String(form.get("reference") || "").trim();
    const issueDate = dateValue(form.get("issue_date"));
    const expiresAt = dateValue(form.get("expires_at"));
    const notes = String(form.get("notes") || "").trim();

    if (!displayName || !isOrganizationDocumentCategory(category) || !isOrganizationDocumentRequirement(requirementLevel)) {
      return redirectToCompany(id, request.url, "error=document-fields");
    }

    const file = await readOrganizationDocumentUpload(form.get("file"));
    if (requirementLevel === "not_applicable" && file) {
      return redirectToCompany(id, request.url, "error=document-not-applicable");
    }

    if (requirementLevel === "not_applicable") {
      await query(
        "UPDATE organization_documents SET " +
        "category=$1,requirement_level=$2,display_name=$3,reference=$4,issue_date=$5,expires_at=$6,notes=$7," +
        "file_data=NULL,file_mime_type=NULL,file_name=NULL,file_size_bytes=NULL,uploaded_by=$8,updated_at=now() " +
        "WHERE id=$9 AND organization_id=$10",
        [category, requirementLevel, displayName, reference || null, issueDate, expiresAt, notes || null, session.userId || null, documentId, id],
      );
    } else if (file) {
      await query(
        "UPDATE organization_documents SET " +
        "category=$1,requirement_level=$2,display_name=$3,reference=$4,issue_date=$5,expires_at=$6,notes=$7," +
        "file_data=$8,file_mime_type=$9,file_name=$10,file_size_bytes=$11,uploaded_by=$12,updated_at=now() " +
        "WHERE id=$13 AND organization_id=$14",
        [category, requirementLevel, displayName, reference || null, issueDate, expiresAt, notes || null,
         file.bytes, file.mime, file.name, file.size, session.userId || null, documentId, id],
      );
    } else {
      await query(
        "UPDATE organization_documents SET " +
        "category=$1,requirement_level=$2,display_name=$3,reference=$4,issue_date=$5,expires_at=$6,notes=$7,updated_at=now() " +
        "WHERE id=$8 AND organization_id=$9",
        [category, requirementLevel, displayName, reference || null, issueDate, expiresAt, notes || null, documentId, id],
      );
    }

    return redirectToCompany(id, request.url, "saved=document");
  } catch (error) {
    if (error instanceof OrganizationDocumentUploadError) {
      return redirectToCompany(id, request.url, "error=" + error.code);
    }
    throw error;
  }
}
