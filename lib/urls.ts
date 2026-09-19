export function publicUrl(path: string, requestUrl: string) {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const base = configured || new URL(requestUrl).origin;
  return new URL(path, base.endsWith("/") ? base : base + "/");
}
