const IMAGE_TYPES = new Set(["image/png","image/jpeg","image/webp"]);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export type UploadedImage = { data: Buffer; mime: string } | null;

export async function readImageUpload(form: FormData, key: string): Promise<UploadedImage> {
  const value=form.get(key);
  if(!(value instanceof File) || value.size===0) return null;
  if(!IMAGE_TYPES.has(value.type)) throw new Error("IMAGE_TYPE");
  if(value.size>MAX_IMAGE_BYTES) throw new Error("IMAGE_SIZE");
  return {data:Buffer.from(await value.arrayBuffer()),mime:value.type};
}

export function imageUploadMessage(error: unknown) {
  const code=(error as Error)?.message;
  if(code==="IMAGE_TYPE") return "Usa una imagen PNG, JPG o WEBP.";
  if(code==="IMAGE_SIZE") return "La imagen no puede superar 5 MB.";
  return "";
}
