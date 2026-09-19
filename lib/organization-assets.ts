const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/webp", "image/jpeg"]);

export class ImageUploadError extends Error {
  constructor(
    public code: "image-type" | "image-size" | "image-required",
    message: string,
  ) {
    super(message);
  }
}

export type ImageUpload = {
  bytes: Buffer;
  mime: string;
  name: string;
};

export async function readImageUpload(
  value: FormDataEntryValue | null,
  options: { required?: boolean; maxBytes: number; label: string },
): Promise<ImageUpload | null> {
  if (!(value instanceof File) || value.size === 0) {
    if (options.required) {
      throw new ImageUploadError("image-required", `Debes cargar ${options.label}.`);
    }
    return null;
  }

  if (!ALLOWED_IMAGE_TYPES.has(value.type)) {
    throw new ImageUploadError("image-type", `${options.label} debe ser PNG, JPG o WebP.`);
  }

  if (value.size > options.maxBytes) {
    const limitMb = Math.round(options.maxBytes / 1024 / 1024);
    throw new ImageUploadError("image-size", `${options.label} supera el máximo de ${limitMb} MB.`);
  }

  return {
    bytes: Buffer.from(await value.arrayBuffer()),
    mime: value.type,
    name: value.name.slice(0, 255),
  };
}
