import type { LoginRequest, RegisterRequest, User } from "@marketplaceindo/shared";

/** State user sesi dashboard (dibagikan lintas komponen). */
export function useAuthUser() {
  return useState<User | null>("dashboard-user", () => null);
}

/**
 * Aksi auth dashboard — semua lewat proxy Nitro (/api/auth/*); token tak pernah
 * menyentuh JS browser (httpOnly cookie di sisi server). Error dibiarkan
 * dilempar supaya form memetakan fieldErrors §1.4 (lihat apiErrorOf).
 */
export function useAuth() {
  const user = useAuthUser();

  async function login(body: LoginRequest): Promise<User> {
    const { user: u } = await $fetch<{ user: User }>("/api/auth/login", {
      method: "POST",
      body,
    });
    user.value = u;
    return u;
  }

  async function register(body: RegisterRequest): Promise<User> {
    const { user: u } = await $fetch<{ user: User }>("/api/auth/register", {
      method: "POST",
      body,
    });
    user.value = u;
    return u;
  }

  async function logout(): Promise<void> {
    await $fetch("/api/auth/logout", { method: "POST" });
    user.value = null;
  }

  return { user, login, register, logout };
}
