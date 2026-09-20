/** Database guards, not browser state, decide whether deletion is safe. */
export function isProtectedDeletion(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code;
  return code === "P2001" || code === "23503";
}
