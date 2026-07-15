/**
 * Fase 1 — resolusi Host header → mode dashboard vs tenant.
 */
import { describe, expect, it } from "vitest";
import {
  knownBaseDomains,
  resolveTenantFromHost,
} from "../server/utils/tenant-host";

const BASES = knownBaseDomains("marketindonesia.co.id");

describe("resolveTenantFromHost", () => {
  it("apex, app., dan www. → mode dashboard", () => {
    for (const host of [
      "marketindonesia.co.id",
      "app.marketindonesia.co.id",
      "www.marketindonesia.co.id",
      "lvh.me",
      "app.lvh.me:3000",
      "localhost:3000",
    ]) {
      expect(resolveTenantFromHost(host, BASES)).toEqual({ mode: "dashboard" });
    }
  });

  it("subdomain lain → mode tenant dengan subdomain ter-ekstrak", () => {
    expect(resolveTenantFromHost("warungbudi.marketindonesia.co.id", BASES)).toEqual({
      mode: "tenant",
      subdomain: "warungbudi",
    });
    expect(resolveTenantFromHost("demo.lvh.me:3000", BASES)).toEqual({
      mode: "tenant",
      subdomain: "demo",
    });
  });

  it("normalisasi: port dibuang, huruf besar diturunkan, trailing dot FQDN dibuang", () => {
    expect(resolveTenantFromHost("Demo.LVH.me:3000", BASES)).toEqual({
      mode: "tenant",
      subdomain: "demo",
    });
    expect(resolveTenantFromHost("demo.lvh.me.", BASES)).toEqual({
      mode: "tenant",
      subdomain: "demo",
    });
  });

  it("host di luar base domain (IP/domain asing) → dashboard", () => {
    expect(resolveTenantFromHost("127.0.0.1:3000", BASES)).toEqual({ mode: "dashboard" });
    expect(resolveTenantFromHost("evil.example.com", BASES)).toEqual({ mode: "dashboard" });
    expect(resolveTenantFromHost(undefined, BASES)).toEqual({ mode: "dashboard" });
  });

  it("subdomain bertingkat / format invalid → dashboard, bukan tenant palsu", () => {
    expect(resolveTenantFromHost("a.b.lvh.me", BASES)).toEqual({ mode: "dashboard" });
    expect(resolveTenantFromHost("-x.lvh.me", BASES)).toEqual({ mode: "dashboard" });
  });

  it("domain produksi tenant tidak bocor ke base dev (demo.lvh.me ≠ subdomain dari co.id)", () => {
    // sanity: hasil tidak tergantung urutan baseDomains
    expect(resolveTenantFromHost("demo.lvh.me", [...BASES].reverse())).toEqual({
      mode: "tenant",
      subdomain: "demo",
    });
  });
});

describe("knownBaseDomains", () => {
  it("berisi domain produksi + host dev, tanpa duplikat", () => {
    expect(BASES).toContain("marketindonesia.co.id");
    expect(BASES).toContain("lvh.me");
    expect(BASES).toContain("localhost");
    expect(new Set(BASES).size).toBe(BASES.length);
  });
});
