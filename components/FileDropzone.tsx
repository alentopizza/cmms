"use client";

import { useEffect, useId, useRef, useState } from "react";

type FileDropzoneKind = "image" | "document" | "file";

type Props = {
  name?: string;
  id?: string;
  label: string;
  description?: string;
  accept: string;
  maxSizeMb: number;
  required?: boolean;
  disabled?: boolean;
  kind?: FileDropzoneKind;
  compact?: boolean;
  existingFileName?: string | null;
  buttonLabel?: string;
  onFileChange?: (file: File | null) => void;
};

function bytesLabel(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function acceptsFile(file: File, accept: string) {
  const rules = accept.split(",").map(rule => rule.trim().toLowerCase()).filter(Boolean);
  if (!rules.length) return true;

  const mime = file.type.toLowerCase();
  const name = file.name.toLowerCase();

  return rules.some(rule => {
    if (rule.startsWith(".")) return name.endsWith(rule);
    if (rule.endsWith("/*")) return mime.startsWith(rule.slice(0, -1));
    return mime === rule;
  });
}

function fileTypeLabel(accept: string) {
  const values = accept
    .split(",")
    .map(item => item.trim().toLowerCase())
    .filter(item => item.startsWith(".") || item.includes("/"))
    .map(item => {
      if (item.includes("pdf")) return "PDF";
      if (item.includes("png") || item === ".png") return "PNG";
      if (item.includes("jpeg") || item === ".jpg" || item === ".jpeg") return "JPG";
      if (item.includes("webp") || item === ".webp") return "WebP";
      if (item.includes("svg") || item === ".svg") return "SVG";
      if (item.includes("icon") || item === ".ico") return "ICO";
      return "";
    })
    .filter(Boolean);

  return [...new Set(values)].join(", ");
}

export default function FileDropzone({
  name,
  id,
  label,
  description,
  accept,
  maxSizeMb,
  required = false,
  disabled = false,
  kind = "file",
  compact = false,
  existingFileName,
  buttonLabel = "Seleccionar archivo",
  onFileChange,
}: Props) {
  const generatedId = useId();
  const inputId = id || `file-dropzone-${generatedId.replace(/:/g, "")}`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");

  useEffect(() => {
    if (!selectedFile || !selectedFile.type.startsWith("image/")) {
      setPreviewUrl("");
      return;
    }
    const url = URL.createObjectURL(selectedFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [selectedFile]);

  function clearNativeInput() {
    if (inputRef.current) inputRef.current.value = "";
  }

  function applyFile(file: File | null, assignToInput = false) {
    setError("");

    if (!file) {
      setSelectedFile(null);
      clearNativeInput();
      onFileChange?.(null);
      return;
    }

    if (!acceptsFile(file, accept)) {
      setSelectedFile(null);
      clearNativeInput();
      setError(`Formato no permitido. Usa: ${fileTypeLabel(accept) || "un formato compatible"}.`);
      onFileChange?.(null);
      return;
    }

    if (file.size > maxSizeMb * 1024 * 1024) {
      setSelectedFile(null);
      clearNativeInput();
      setError(`El archivo supera el máximo permitido de ${maxSizeMb} MB.`);
      onFileChange?.(null);
      return;
    }

    if (assignToInput && inputRef.current) {
      const transfer = new DataTransfer();
      transfer.items.add(file);
      inputRef.current.files = transfer.files;
    }

    setSelectedFile(file);
    onFileChange?.(file);
  }

  function handleInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    applyFile(event.target.files?.[0] || null);
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    if (disabled) return;
    applyFile(event.dataTransfer.files?.[0] || null, true);
  }

  function clearSelection(event: React.MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    applyFile(null);
  }

  const typeLabel = fileTypeLabel(accept);
  const selectedName = selectedFile?.name || existingFileName || "";
  const hasSelected = Boolean(selectedFile);

  return <div className={`file-dropzone-field ${compact ? "compact" : ""} ${error ? "has-error" : ""}`}>
    <div
      className={`file-dropzone ${dragging ? "is-dragging" : ""} ${hasSelected ? "has-file" : ""} ${disabled ? "is-disabled" : ""}`}
      onDragEnter={event => {
        event.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragOver={event => event.preventDefault()}
      onDragLeave={event => {
        if (event.currentTarget === event.target) setDragging(false);
      }}
      onDrop={handleDrop}
      onClick={() => !disabled && inputRef.current?.click()}
      role="button"
      tabIndex={disabled ? -1 : 0}
      onKeyDown={event => {
        if (!disabled && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          inputRef.current?.click();
        }
      }}
      aria-disabled={disabled}
      aria-describedby={`${inputId}-help`}
    >
      <input
        ref={inputRef}
        id={inputId}
        className="file-dropzone-native"
        type="file"
        name={name}
        accept={accept}
        required={required}
        disabled={disabled}
        onChange={handleInputChange}
      />

      <div className={`file-dropzone-visual ${previewUrl ? "has-preview" : ""}`} aria-hidden="true">
        {previewUrl
          ? <img src={previewUrl} alt="" />
          : kind === "image"
            ? <svg viewBox="0 0 32 32"><rect x="5" y="7" width="22" height="18" rx="3"/><circle cx="12" cy="13" r="2.2"/><path d="m7.5 22 6-6 4 4 3-3 4 5"/></svg>
            : kind === "document"
              ? <svg viewBox="0 0 32 32"><path d="M9 4h10l5 5v19H9z"/><path d="M19 4v6h6"/><path d="M12 16h9M12 20h9M12 24h6"/></svg>
              : <svg viewBox="0 0 32 32"><path d="M8 5h10l6 6v16H8z"/><path d="M18 5v7h7"/></svg>}
      </div>

      <div className="file-dropzone-copy">
        <span className="file-dropzone-kicker">{required ? "Archivo obligatorio" : "Archivo opcional"}</span>
        <strong>{label}{required ? " *" : ""}</strong>
        <p>{hasSelected ? "Archivo listo para guardar." : "Arrastra y suelta aquí o selecciónalo desde tu equipo."}</p>
        <div className="file-dropzone-meta" id={`${inputId}-help`}>
          {selectedFile
            ? <><span>{selectedFile.name}</span><span>{bytesLabel(selectedFile.size)}</span></>
            : existingFileName
              ? <span>Actual: {existingFileName}</span>
              : <><span>{typeLabel || "Archivo compatible"}</span><span>Máx. {maxSizeMb} MB</span></>}
        </div>
        {description && <small>{description}</small>}
      </div>

      <div className="file-dropzone-actions">
        <span className="file-dropzone-button">{hasSelected ? "Cambiar archivo" : buttonLabel}</span>
        {hasSelected && <button type="button" onClick={clearSelection}>Quitar</button>}
      </div>
    </div>
    {error && <small className="file-dropzone-error">{error}</small>}
  </div>;
}
