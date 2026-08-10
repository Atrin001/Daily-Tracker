import { headers } from "next/headers";
import { redirect } from "next/navigation";

export type ChatGPTUser = {
  displayName: string;
  email: string;
  fullName: string | null;
};

const USER_EMAIL_HEADER = "oai-authenticated-user-email";
const USER_FULL_NAME_HEADER = "oai-authenticated-user-full-name";
const USER_FULL_NAME_ENCODING_HEADER =
  "oai-authenticated-user-full-name-encoding";
const PERCENT_ENCODED_UTF8 = "percent-encoded-utf-8";
const ACCESS_JWT_HEADER = "cf-access-jwt-assertion";
const SIGN_IN_PATH = "/signin-with-chatgpt";
const SIGN_OUT_PATH = "/signout-with-chatgpt";
const CALLBACK_PATH = "/callback";

type AccessEnv = {
  CF_ACCESS_TEAM_DOMAIN?: string;
  CF_ACCESS_AUD?: string;
};

type AccessClaims = {
  aud?: string | string[];
  email?: string;
  exp?: number;
  iat?: number;
  iss?: string;
  nbf?: number;
};

type JsonWebKeyWithKid = JsonWebKey & { kid?: string };

type AccessCerts = {
  keys?: JsonWebKeyWithKid[];
};

export async function getChatGPTUser(): Promise<ChatGPTUser | null> {
  const requestHeaders = await headers();
  return getAuthenticatedUserFromHeaders(requestHeaders);
}

export async function getAuthenticatedUserFromRequest(
  request: Request,
): Promise<ChatGPTUser | null> {
  return getAuthenticatedUserFromHeaders(request.headers);
}

export async function getAuthenticatedUserFromHeaders(
  requestHeaders: Headers,
): Promise<ChatGPTUser | null> {
  const sitesUser = getSitesUser(requestHeaders);
  if (sitesUser) return sitesUser;

  const accessToken = requestHeaders.get(ACCESS_JWT_HEADER);
  if (!accessToken) return null;

  const accessClaims = await verifyCloudflareAccessToken(accessToken);
  if (!accessClaims?.email) return null;

  const email = accessClaims.email.trim().toLowerCase();
  return {
    displayName: email.split("@")[0] || email,
    email,
    fullName: null,
  };
}

export async function requireChatGPTUser(
  returnTo: string,
): Promise<ChatGPTUser> {
  const user = await getChatGPTUser();
  if (user) return user;

  // On an independent Cloudflare deployment, Access should protect the whole
  // application before this code runs. If no Access token is present, fall
  // back to the dispatch-owned ChatGPT Sites sign-in route so the same source
  // remains compatible with the existing chatgpt.site deployment.
  redirect(chatGPTSignInPath(returnTo));
}

export function chatGPTSignInPath(returnTo: string): string {
  const safeReturnTo = safeRelativeReturnPath(returnTo);
  return `${SIGN_IN_PATH}?return_to=${encodeURIComponent(safeReturnTo)}`;
}

export function chatGPTSignOutPath(returnTo = "/"): string {
  const safeReturnTo = safeRelativeReturnPath(returnTo);
  return `${SIGN_OUT_PATH}?return_to=${encodeURIComponent(safeReturnTo)}`;
}

function getSitesUser(requestHeaders: Headers): ChatGPTUser | null {
  const email = requestHeaders.get(USER_EMAIL_HEADER)?.trim().toLowerCase();
  if (!email) return null;

  const encodedFullName = requestHeaders.get(USER_FULL_NAME_HEADER);
  const fullName =
    encodedFullName &&
    requestHeaders.get(USER_FULL_NAME_ENCODING_HEADER) === PERCENT_ENCODED_UTF8
      ? safeDecodeURIComponent(encodedFullName)
      : null;

  return {
    displayName: fullName ?? email,
    email,
    fullName,
  };
}

async function verifyCloudflareAccessToken(
  token: string,
): Promise<AccessClaims | null> {
  const accessEnv = await getAccessEnv();
  const teamDomain = normalizeTeamDomain(accessEnv.CF_ACCESS_TEAM_DOMAIN);
  const expectedAud = accessEnv.CF_ACCESS_AUD?.trim();
  if (!teamDomain || !expectedAud) return null;

  const parts = token.split(".");
  if (parts.length !== 3) return null;

  let header: { alg?: string; kid?: string };
  let claims: AccessClaims;
  try {
    header = JSON.parse(decodeBase64UrlText(parts[0]));
    claims = JSON.parse(decodeBase64UrlText(parts[1]));
  } catch {
    return null;
  }

  if (header.alg !== "RS256" || !header.kid || !claims.email) return null;

  const expectedIssuer = `https://${teamDomain}`;
  if (claims.iss !== expectedIssuer) return null;

  const audiences = Array.isArray(claims.aud) ? claims.aud : claims.aud ? [claims.aud] : [];
  if (!audiences.includes(expectedAud)) return null;

  const now = Math.floor(Date.now() / 1000);
  if (typeof claims.exp !== "number" || claims.exp <= now) return null;
  if (typeof claims.nbf === "number" && claims.nbf > now + 60) return null;

  let certs: AccessCerts;
  try {
    const certResponse = await fetch(`https://${teamDomain}/cdn-cgi/access/certs`, { headers: { Accept: "application/json" } });
    if (!certResponse.ok) return null;
    certs = (await certResponse.json()) as AccessCerts;
  } catch {
    return null;
  }

  const jwk = certs.keys?.find((key) => key.kid === header.kid);
  if (!jwk) return null;

  try {
    const publicKey = await crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const signedData = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
    const signature = decodeBase64UrlBytes(parts[2]);
    const valid = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      publicKey,
      signature,
      signedData,
    );
    return valid ? claims : null;
  } catch {
    return null;
  }
}

async function getAccessEnv(): Promise<AccessEnv> {
  try {
    const workers = (await import("cloudflare:workers")) as unknown as {
      env?: AccessEnv;
    };
    if (workers.env) return workers.env;
  } catch {
    // Local/non-Workers fallback below.
  }

  return {
    CF_ACCESS_TEAM_DOMAIN: process.env.CF_ACCESS_TEAM_DOMAIN,
    CF_ACCESS_AUD: process.env.CF_ACCESS_AUD,
  };
}

function normalizeTeamDomain(value?: string): string | null {
  if (!value?.trim()) return null;
  return value.trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
}

function decodeBase64UrlText(value: string): string {
  return new TextDecoder().decode(decodeBase64UrlBytes(value));
}

function decodeBase64UrlBytes(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function safeRelativeReturnPath(value: string): string {
  if (!value.startsWith("/") || value.startsWith("//")) return "/";

  let url: URL;
  try {
    url = new URL(value, "https://app.local");
  } catch {
    return "/";
  }
  if (url.origin !== "https://app.local") return "/";
  if (isReservedAuthPath(url.pathname)) return "/";

  return `${url.pathname}${url.search}${url.hash}`;
}

function isReservedAuthPath(pathname: string): boolean {
  return (
    pathname === SIGN_IN_PATH ||
    pathname === SIGN_OUT_PATH ||
    pathname === CALLBACK_PATH
  );
}

function safeDecodeURIComponent(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}
