import fs from "node:fs";

function read(path){return fs.readFileSync(path,"utf8");}
function expect(source,needle,label){if(!source.includes(needle))throw new Error(label+" missing: "+needle);}

const migration=read("db/migrations/999c_lead_followup_traceability.sql");
for(const needle of [
  "CREATE TABLE IF NOT EXISTS sales_lead_activities",
  "created_by uuid REFERENCES users(id)",
  "created_at timestamptz NOT NULL DEFAULT now()",
  "CREATE TABLE IF NOT EXISTS sales_lead_activity_attachments",
  "activity_id uuid NOT NULL REFERENCES sales_lead_activities(id)",
  "lead_id uuid NOT NULL REFERENCES sales_leads(id)",
])expect(migration,needle,"lead follow-up migration");

const activities=read("app/api/leads/[id]/activities/route.ts");
for(const needle of [
  'can(session,"leads.manage")',
  'form.get("note")',
  'form.getAll("files")',
  "MAX_FILES=5",
  "MAX_FILE_BYTES=10*1024*1024",
  "session.userId||null",
  "ORDER BY a.created_at DESC",
])expect(activities,needle,"lead activities API");

const attachment=read("app/api/leads/[id]/activities/attachments/[attachmentId]/route.ts");
for(const needle of ['can(session,"leads.manage")',"Content-Disposition","private, no-store"])expect(attachment,needle,"lead attachment protection");

const status=read("app/api/leads/[id]/status/route.ts");
expect(status,"INSERT INTO sales_lead_activities","status timeline event");
expect(status,"from_status,to_status","status before and after");

const drawer=read("components/LeadPreviewAction.tsx");
for(const needle of [
  "Agregar nota",
  'name="files"',
  "Agregar a trazabilidad",
  'fetch("/api/leads/"+encodeURIComponent(leadId)+"/activities"',
  "Nota de seguimiento",
  "Cambio de estado",
  "created_by_name",
])expect(drawer,needle,"lead drawer traceability");

const page=read("app/dashboard/leads/page.tsx");
expect(page,"<LeadPreviewAction leadId={lead.id}","lead id wiring");

console.log("Lead follow-up notes + attachments traceability smoke: OK");
