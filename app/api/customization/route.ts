import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { query } from "@/lib/db";
import { publicUrl } from "@/lib/urls";

const MAX_FILE_SIZE = 2 * 1024 * 1024;
const logoTypes = new Set(["image/png", "image/webp", "image/svg+xml", "image/jpeg"]);
const faviconTypes = new Set([
  "image/png",
  "image/webp",
  "image/svg+xml",
  "image/x-icon",
  "image/vnd.microsoft.icon",
]);

async function readFile(
  value: FormDataEntryValue | null,
  allowedTypes: Set<string>
): Promise<{ bytes: Buffer; mime: string; name: string } | null> {
  if (!(value instanceof File) || value.size === 0) return null;
  if (value.size > MAX_FILE_SIZE) throw new Error("El archivo supera el máximo de 2 MB.");
  if (!allowedTypes.has(value.type)) throw new Error("Formato de archivo no permitido.");

  return {
    bytes: Buffer.from(await value.arrayBuffer()),
    mime: value.type,
    name: value.name.slice(0, 255),
  };
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });
  if (!can(session, "personalization.manage")) return new NextResponse("Forbidden", { status: 403 });

  try {
    const form = await request.formData();
    const reset = String(form.get("reset") || "");

    if (reset === "logo-on-light") {
      await query("UPDATE app_customization SET logo_on_light=NULL,logo_on_light_mime=NULL,logo_on_light_name=NULL,updated_at=now() WHERE id=1");
    } else if (reset === "logo-on-dark") {
      await query("UPDATE app_customization SET logo_on_dark=NULL,logo_on_dark_mime=NULL,logo_on_dark_name=NULL,updated_at=now() WHERE id=1");
    } else if (reset === "favicon") {
      await query("UPDATE app_customization SET favicon=NULL,favicon_mime=NULL,favicon_name=NULL,updated_at=now() WHERE id=1");
    } else {
      const logoOnLight = await readFile(form.get("logo_on_light"), logoTypes);
      const logoOnDark = await readFile(form.get("logo_on_dark"), logoTypes);
      const favicon = await readFile(form.get("favicon"), faviconTypes);

      if (logoOnLight) {
        await query(
          "UPDATE app_customization SET logo_on_light=$1,logo_on_light_mime=$2,logo_on_light_name=$3,updated_at=now() WHERE id=1",
          [logoOnLight.bytes, logoOnLight.mime, logoOnLight.name]
        );
      }

      if (logoOnDark) {
        await query(
          "UPDATE app_customization SET logo_on_dark=$1,logo_on_dark_mime=$2,logo_on_dark_name=$3,updated_at=now() WHERE id=1",
          [logoOnDark.bytes, logoOnDark.mime, logoOnDark.name]
        );
      }

      if (favicon) {
        await query(
          "UPDATE app_customization SET favicon=$1,favicon_mime=$2,favicon_name=$3,updated_at=now() WHERE id=1",
          [favicon.bytes, favicon.mime, favicon.name]
        );
      }
    }

    return NextResponse.redirect(publicUrl("/dashboard/personalization?saved=1", request.url), 303);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo guardar la personalización.";
    const url = publicUrl("/dashboard/personalization", request.url);
    url.searchParams.set("error", message);
    return NextResponse.redirect(url, 303);
  }
}
