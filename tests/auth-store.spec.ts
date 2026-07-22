/**
 * Fase 7a — mock auth store (register/login/resolve token).
 */
import { describe, expect, it } from "vitest";
import {
  AuthError,
  mockLogin,
  mockRegister,
  mockResolveAccess,
} from "../server/mock/auth-store";

describe("mockRegister", () => {
  it("email baru → user + token; tanpa membocorkan passwordHash", () => {
    const res = mockRegister({
      email: "budi@toko.test",
      password: "rahasia123",
      name: "Budi",
      whatsapp: "6281234567890",
    });
    expect(res.user.email).toBe("budi@toko.test");
    expect(res.user).not.toHaveProperty("passwordHash");
    expect(res.accessToken).toMatch(/^mi_at_/);
    expect(res.refreshToken).toMatch(/^mi_rt_/);
  });

  it("email sudah ada → 409 EMAIL_TAKEN (case-insensitive)", () => {
    mockRegister({ email: "dupe@toko.test", password: "rahasia123", name: "A" });
    try {
      mockRegister({ email: "DUPE@toko.test", password: "rahasia123", name: "B" });
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(AuthError);
      expect((err as AuthError).status).toBe(409);
      expect((err as AuthError).code).toBe("EMAIL_TAKEN");
    }
  });

  it("payload invalid (password pendek) → ZodError", () => {
    expect(() => mockRegister({ email: "x@y.test", password: "short", name: "X" })).toThrow();
  });
});

describe("mockLogin", () => {
  it("akun demo seed → sukses", () => {
    const res = mockLogin({ email: "owner@demo.test", password: "password123" });
    expect(res.user.name).toBe("Budi Owner");
  });

  it("password salah / email tak dikenal → 401 INVALID_CREDENTIALS", () => {
    for (const body of [
      { email: "owner@demo.test", password: "salah" },
      { email: "tidakada@demo.test", password: "password123" },
    ]) {
      try {
        mockLogin(body);
        expect.unreachable();
      } catch (err) {
        expect((err as AuthError).status).toBe(401);
        expect((err as AuthError).code).toBe("INVALID_CREDENTIALS");
      }
    }
  });
});

describe("mockResolveAccess", () => {
  it("token akses valid → user; token asing → null", () => {
    const { accessToken, user } = mockRegister({
      email: "resolve@toko.test",
      password: "rahasia123",
      name: "Resolver",
    });
    expect(mockResolveAccess(accessToken)?.id).toBe(user.id);
    expect(mockResolveAccess("mi_at_tidakvalid")).toBeNull();
  });
});
