/**
 * Sesi dashboard (Fase 7a). Browser TIDAK PERNAH memegang token: setelah auth
 * berhasil, access + refresh token disimpan di cookie httpOnly (dipakai proxy
 * dashboard fase lanjut sebagai Authorization Bearer), dan profil user di cookie
 * httpOnly `mi_user` (sumber restore-session — kontrak §2 tak punya /auth/me,
 * jadi tidak menambah endpoint). Mock vs backend nyata via runtimeConfig.
 */
import type { H3Event } from "h3";
import { ZodError } from "zod";
import type { AuthResponse, User } from "@marketplaceindo/shared";
import { FetchError } from "ofetch";
import { AuthError, mockLogin, mockRegister } from "../mock/auth-store";

const ACCESS_COOKIE = "mi_access";
const REFRESH_COOKIE = "mi_refresh";
const USER_COOKIE = "mi_user";

function isSecure(event: H3Event): boolean {
  return getRequestProtocol(event, { xForwardedProto: true }) === "https";
}

function setSession(event: H3Event, auth: AuthResponse): void {
  const base = { httpOnly: true, sameSite: "lax" as const, secure: isSecure(event), path: "/" };
  setCookie(event, ACCESS_COOKIE, auth.accessToken, { ...base, maxAge: 60 * 60 });
  setCookie(event, REFRESH_COOKIE, auth.refreshToken, { ...base, maxAge: 60 * 60 * 24 * 30 });
  setCookie(event, USER_COOKIE, JSON.stringify(auth.user), { ...base, maxAge: 60 * 60 * 24 * 30 });
}

/** Nama dibedakan dari `clearSession` bawaan h3 (auto-import) agar tak bentrok. */
export function clearAuthSession(event: H3Event): void {
  for (const name of [ACCESS_COOKIE, REFRESH_COOKIE, USER_COOKIE]) {
    deleteCookie(event, name, { path: "/" });
  }
}

/** Profil user sesi berjalan dari cookie httpOnly (null bila belum login). */
export function currentUser(event: H3Event): User | null {
  const raw = getCookie(event, USER_COOKIE);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

/** Normalisasi error auth → H3Error ber-format kontrak §1.4. */
function toH3Error(err: unknown): never {
  if (err instanceof ZodError) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of err.issues) {
      const key = issue.path.join(".") || "_";
      (fieldErrors[key] ??= []).push(issue.message);
    }
    throw createError({
      statusCode: 422,
      message: "Data tidak valid",
      data: { error: { code: "VALIDATION_ERROR", message: "Data tidak valid", fieldErrors } },
    });
  }
  if (err instanceof AuthError) {
    throw createError({
      statusCode: err.status,
      message: err.message,
      data: { error: { code: err.code, message: err.message } },
    });
  }
  if (err instanceof FetchError) {
    const body = err.data as { error?: { code?: string; message?: string } } | undefined;
    throw createError({
      statusCode: err.statusCode ?? 502,
      message: body?.error?.message ?? "Layanan auth tidak dapat dihubungi",
      data: { error: body?.error ?? { code: "INTERNAL", message: "Auth API error" } },
    });
  }
  throw err;
}

function realAuth(event: H3Event, path: string, body: unknown): Promise<AuthResponse> {
  const config = useRuntimeConfig(event);
  return $fetch(`${config.dashboardApiBase}${path}`, {
    method: "POST",
    body: body as Record<string, unknown>,
  }) as Promise<AuthResponse>;
}

/** POST /auth/register → set sesi, kembalikan user (tanpa token ke browser). */
export async function registerDashboard(event: H3Event, body: unknown): Promise<User> {
  const config = useRuntimeConfig(event);
  try {
    const auth = config.dashboardMock
      ? mockRegister(body)
      : await realAuth(event, "/auth/register", body);
    setSession(event, auth);
    return auth.user;
  } catch (err) {
    toH3Error(err);
  }
}

/** POST /auth/login → set sesi, kembalikan user. */
export async function loginDashboard(event: H3Event, body: unknown): Promise<User> {
  const config = useRuntimeConfig(event);
  try {
    const auth = config.dashboardMock
      ? mockLogin(body)
      : await realAuth(event, "/auth/login", body);
    setSession(event, auth);
    return auth.user;
  } catch (err) {
    toH3Error(err);
  }
}
