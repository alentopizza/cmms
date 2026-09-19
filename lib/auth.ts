import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "cmms_session";

function expectedToken() {
  const password = process.env.APP_ADMIN_PASSWORD || "";
  const secret = process.env.AUTH_SECRET || "";
  return createHmac("sha256", secret).update(password).digest("hex");
}

export function tokenForPassword(password: string) {
  const secret = process.env.AUTH_SECRET || "";
  return createHmac("sha256", secret).update(password).digest("hex");
}

export async function isAuthenticated() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return false;
  const expected = expectedToken();
  if (token.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(token), Buffer.from(expected));
}

export { COOKIE_NAME };
