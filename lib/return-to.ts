export function safeDashboardReturn(value: FormDataEntryValue | string | null | undefined, fallback: string) {
  const raw = String(value || "").trim();
  if (!raw.startsWith("/dashboard")) return fallback;
  if (raw.startsWith("//") || raw.includes("://")) return fallback;
  return raw;
}

export function appendFeedback(path: string, suffix: string) {
  if (!suffix) return path;
  if (!suffix.startsWith("?")) return path;
  return path + (path.includes("?") ? "&" + suffix.slice(1) : suffix);
}
