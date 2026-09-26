const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/webp", "image/jpeg"]);

export class ImageUploadError extends Error {
  constructor(
    public code: "image-type" | "image-size" | "image-required" | "image-invalid",
    message: string,
  ) {
    super(message);
  }
}

export type ImageUpload = {
  bytes: Buffer;
  mime: string;
  name: string;
  width: number;
  height: number;
};

function pngDimensions(bytes:Buffer){
  const signature=Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]);
  if(bytes.length<24||!bytes.subarray(0,8).equals(signature))return null;
  const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);
  return width>0&&height>0?{width,height}:null;
}

function jpegDimensions(bytes:Buffer){
  if(bytes.length<4||bytes[0]!==0xff||bytes[1]!==0xd8)return null;
  const sof=new Set([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf]);
  let offset=2;
  while(offset+3<bytes.length){
    while(offset<bytes.length&&bytes[offset]!==0xff)offset++;
    while(offset<bytes.length&&bytes[offset]===0xff)offset++;
    if(offset>=bytes.length)return null;
    const marker=bytes[offset++];
    if(marker===0xd9||marker===0xda)return null;
    if(marker===0x01||(marker>=0xd0&&marker<=0xd7))continue;
    if(offset+1>=bytes.length)return null;
    const length=bytes.readUInt16BE(offset);
    if(length<2||offset+length>bytes.length)return null;
    if(sof.has(marker)){
      if(length<7)return null;
      const height=bytes.readUInt16BE(offset+3);
      const width=bytes.readUInt16BE(offset+5);
      return width>0&&height>0?{width,height}:null;
    }
    offset+=length;
  }
  return null;
}

function readUInt24LE(bytes:Buffer,offset:number){
  return bytes[offset]|(bytes[offset+1]<<8)|(bytes[offset+2]<<16);
}

function webpDimensions(bytes:Buffer){
  if(
    bytes.length<30||
    bytes.toString("ascii",0,4)!=="RIFF"||
    bytes.toString("ascii",8,12)!=="WEBP"
  )return null;
  const chunk=bytes.toString("ascii",12,16);
  if(chunk==="VP8X"){
    const width=1+readUInt24LE(bytes,24);
    const height=1+readUInt24LE(bytes,27);
    return width>0&&height>0?{width,height}:null;
  }
  if(chunk==="VP8L"){
    if(bytes[20]!==0x2f||bytes.length<25)return null;
    const b1=bytes[21],b2=bytes[22],b3=bytes[23],b4=bytes[24];
    const width=1+(b1|((b2&0x3f)<<8));
    const height=1+((b2>>6)|(b3<<2)|((b4&0x0f)<<10));
    return width>0&&height>0?{width,height}:null;
  }
  if(chunk==="VP8 "){
    if(bytes.length<30||bytes[23]!==0x9d||bytes[24]!==0x01||bytes[25]!==0x2a)return null;
    const width=bytes.readUInt16LE(26)&0x3fff;
    const height=bytes.readUInt16LE(28)&0x3fff;
    return width>0&&height>0?{width,height}:null;
  }
  return null;
}

function imageDimensions(bytes:Buffer,mime:string){
  if(mime==="image/png")return pngDimensions(bytes);
  if(mime==="image/jpeg")return jpegDimensions(bytes);
  if(mime==="image/webp")return webpDimensions(bytes);
  return null;
}

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

  const bytes=Buffer.from(await value.arrayBuffer());
  const dimensions=imageDimensions(bytes,value.type);
  if(!dimensions||dimensions.width>12000||dimensions.height>12000){
    throw new ImageUploadError("image-invalid", `${options.label} no contiene una imagen válida o sus dimensiones no son compatibles.`);
  }

  return {
    bytes,
    mime: value.type,
    name: value.name.slice(0, 255),
    width: dimensions.width,
    height: dimensions.height,
  };
}
