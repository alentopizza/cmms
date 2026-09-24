"use client";

import { FileUpload, type FileUploadProps } from "@/components/ui-kit/FileUpload";

export default function FileDropzone(props:FileUploadProps){
  return <FileUpload {...props}/>;
}
