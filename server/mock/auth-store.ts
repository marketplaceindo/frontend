/**
 * Mock auth backend (Fase 7a) — in-memory, meniru NestJS /v1/auth/*.
 * Cukup untuk menjalankan dashboard sebelum backend siap; mekanika cookie di
 * server/utils/dashboard-auth.ts identik untuk mock maupun backend nyata.
 *
 * Bebas dependensi Nitro/h3 → bisa diuji unit murni.
 */
import { registerStore } from "./persist";
import {
  loginRequestSchema,
  registerRequestSchema,
  type AuthResponse,
  type RegisterRequest,
  type User,
} from "@marketplaceindo/shared";

/** Error setara response error auth; dikonversi ke H3Error di dashboard-auth. */
export class AuthError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

interface StoredUser extends User {
  passwordHash: string;
}

/**
 * Hash mock (djb2) — BUKAN pengganti bcrypt/argon backend nyata, hanya agar
 * password tidak tersimpan plaintext di memori mock. `crypto.randomUUID` global
 * (Web Crypto) dipakai untuk token tanpa import node:crypto.
 */
function hash(password: string): string {
  let h = 5381;
  for (let i = 0; i < password.length; i++) h = ((h << 5) + h + password.charCodeAt(i)) | 0;
  return (h >>> 0).toString(16);
}
const randomUUID = () => crypto.randomUUID();

const usersByEmail = new Map<string, StoredUser>();
/** token akses → userId (untuk proxy dashboard di fase lanjut). */
const accessTokens = new Map<string, string>();
const refreshTokens = new Map<string, string>();

function publicUser(u: StoredUser): User {
  const { passwordHash: _omit, ...rest } = u;
  return rest;
}

function issueTokens(userId: string): { accessToken: string; refreshToken: string } {
  const accessToken = `mi_at_${randomUUID()}`;
  const refreshToken = `mi_rt_${randomUUID()}`;
  accessTokens.set(accessToken, userId);
  refreshTokens.set(refreshToken, userId);
  return { accessToken, refreshToken };
}

function seedUser(input: RegisterRequest): void {
  const id = randomUUID();
  usersByEmail.set(input.email.toLowerCase(), {
    id,
    email: input.email,
    name: input.name,
    ...(input.whatsapp ? { whatsapp: input.whatsapp } : {}),
    createdAt: "2026-07-01T00:00:00Z",
    passwordHash: hash(input.password),
  });
}

// Akun demo untuk mencoba dashboard tanpa registrasi (dev/mock saja).
seedUser({ email: "owner@demo.test", password: "password123", name: "Budi Owner" });

export function mockRegister(raw: unknown): AuthResponse {
  const body = registerRequestSchema.parse(raw);
  if (usersByEmail.has(body.email.toLowerCase())) {
    throw new AuthError(409, "EMAIL_TAKEN", "Email sudah terdaftar");
  }
  const user: StoredUser = {
    id: randomUUID(),
    email: body.email,
    name: body.name,
    ...(body.whatsapp ? { whatsapp: body.whatsapp } : {}),
    createdAt: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
    passwordHash: hash(body.password),
  };
  usersByEmail.set(body.email.toLowerCase(), user);
  return { user: publicUser(user), ...issueTokens(user.id) };
}

export function mockLogin(raw: unknown): AuthResponse {
  const body = loginRequestSchema.parse(raw);
  const user = usersByEmail.get(body.email.toLowerCase());
  if (!user || user.passwordHash !== hash(body.password)) {
    throw new AuthError(401, "INVALID_CREDENTIALS", "Email atau password salah");
  }
  return { user: publicUser(user), ...issueTokens(user.id) };
}

/** Validasi token akses → user (dipakai proxy dashboard fase lanjut). */
export function mockResolveAccess(token: string): User | null {
  const userId = accessTokens.get(token);
  if (!userId) return null;
  for (const u of usersByEmail.values()) if (u.id === userId) return publicUser(u);
  return null;
}

// --- Persistensi dev (lihat persist.ts) ------------------------------------
registerStore("auth", {
  dump: () => ({
    users: [...usersByEmail.entries()],
    access: [...accessTokens.entries()],
    refresh: [...refreshTokens.entries()],
  }),
  restore: (d: {
    users: [string, StoredUser][];
    access: [string, string][];
    refresh: [string, string][];
  }) => {
    usersByEmail.clear();
    for (const [k, v] of d.users) usersByEmail.set(k, v);
    accessTokens.clear();
    for (const [k, v] of d.access) accessTokens.set(k, v);
    refreshTokens.clear();
    for (const [k, v] of d.refresh) refreshTokens.set(k, v);
  },
});
