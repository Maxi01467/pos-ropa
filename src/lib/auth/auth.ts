import { cookies } from "next/headers";
import { AUTH_COOKIE_NAME, verifySessionToken } from "@/lib/auth/auth-core";

export { AUTH_COOKIE_NAME, createSessionToken } from "@/lib/auth/auth-core";

export async function getServerSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  return verifySessionToken(token);
}
