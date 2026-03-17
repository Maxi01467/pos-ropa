import type { SessionRole } from "@/lib/permissions";

export const AUTH_COOKIE_NAME = "pos_auth";
const AUTH_SECRET = process.env.AUTH_SECRET ?? "pos-ropa-local-dev-secret";

export type AuthSession = {
  userId: string;
  userName: string;
  role: SessionRole;
};

type AuthTokenPayload = AuthSession & {
  exp: number;
};

function bytesToBase64Url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlToBytes(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

async function getSigningKey() {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(AUTH_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function sign(value: string) {
  const key = await getSigningKey();
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(value),
  );

  return bytesToBase64Url(new Uint8Array(signature));
}

export async function createSessionToken(session: AuthSession) {
  const payload: AuthTokenPayload = {
    ...session,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 7,
  };
  const encodedPayload = bytesToBase64Url(
    new TextEncoder().encode(JSON.stringify(payload)),
  );
  const signature = await sign(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export async function verifySessionToken(token: string | undefined) {
  if (!token) {
    return null;
  }

  const [encodedPayload, providedSignature] = token.split(".");

  if (!encodedPayload || !providedSignature) {
    return null;
  }

  const expectedSignature = await sign(encodedPayload);

  if (providedSignature !== expectedSignature) {
    return null;
  }

  try {
    const payload = JSON.parse(
      new TextDecoder().decode(base64UrlToBytes(encodedPayload)),
    ) as AuthTokenPayload;

    if (
      !payload.userId ||
      !payload.userName ||
      (payload.role !== "ADMIN" && payload.role !== "STAFF") ||
      payload.exp <= Date.now()
    ) {
      return null;
    }

    return {
      userId: payload.userId,
      userName: payload.userName,
      role: payload.role,
    } satisfies AuthSession;
  } catch {
    return null;
  }
}
