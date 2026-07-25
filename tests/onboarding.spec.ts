/**
 * Fase 7b — wizard onboarding: materialisasi konten nyata, ketersediaan
 * subdomain, paywall di publish, dan alur bayar → auto-publish (kontrak §3 & §9).
 */
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  MAX_DRAFT_TENANTS_PER_USER,
  PLANS,
  renderPageResponseSchema,
  renderTenantResponseSchema,
  type WizardAnswers,
} from "@marketplaceindo/shared";
import { materializeWizard } from "../server/mock/materialize";
import {
  TenantApiError,
  checkSubdomain,
  createTenant,
  listTenants,
  publishTenant,
  runWizard,
  updateSubdomain,
} from "../server/mock/tenant-store";
import { billingStatus, hasActiveSubscription, payMockInvoice, subscribe } from "../server/mock/billing-store";
import { RenderApiError, getMockPage, getMockSite } from "../server/mock/render-store";

const fixtureSchema = z.object({
  site: renderTenantResponseSchema,
  pages: z.record(z.string(), renderPageResponseSchema),
});

function answersFor(type: WizardAnswers["businessType"]): WizardAnswers {
  return {
    businessName: "Warung Budi",
    businessType: type,
    address: "Jl. Melati No. 5, Bandung",
    whatsapp: "6281234567890",
    openingHours: [{ days: "Senin–Sabtu", open: "08:00", close: "21:00" }],
    highlights: [
      { name: "Nasi Goreng Spesial", price: 25000 },
      { name: "Es Teh Manis" },
    ],
    tagline: "Masakan rumahan sejak 2010",
  };
}

const uniqueOwner = () => crypto.randomUUID();
let subdomainSeq = 0;
const uniqueSubdomain = () => `wizard-test-${++subdomainSeq}`;

/** Draft tenant siap wizard: dibuat + subdomain terkunci. */
function draftWithSubdomain(ownerId: string, subdomain = uniqueSubdomain()) {
  const tenant = createTenant(ownerId);
  updateSubdomain(ownerId, tenant.id, { subdomain });
  return { tenantId: tenant.id, subdomain };
}

function expectApiError(fn: () => unknown, status: number, code: string) {
  try {
    fn();
    expect.unreachable(`harus melempar ${code}`);
  } catch (err) {
    expect(err).toBeInstanceOf(TenantApiError);
    const e = err as TenantApiError;
    expect(e.status).toBe(status);
    expect(e.code).toBe(code);
  }
}

// ---------------------------------------------------------------------------

describe("materialisasi wizard → konten situs", () => {
  it.each(["bisnis_jasa", "katalog", "kuliner", "otomotif"] as const)(
    "jenis usaha %s menghasilkan situs valid terhadap schema shared",
    (type) => {
      const result = fixtureSchema.safeParse(materializeWizard("contoh", answersFor(type)));
      expect(result.success, result.success ? "" : z.prettifyError(result.error)).toBe(true);
    },
  );

  it("konten berasal dari jawaban user — bukan lorem ipsum (DoD 7b.4)", () => {
    const site = materializeWizard("contoh", answersFor("kuliner"));
    const json = JSON.stringify(site);

    expect(json).toContain("Warung Budi");
    expect(json).toContain("Jl. Melati No. 5, Bandung");
    expect(json).toContain("6281234567890");
    expect(json).toContain("Nasi Goreng Spesial");
    expect(json).toContain("Masakan rumahan sejak 2010");
    expect(json.toLowerCase()).not.toContain("lorem");
  });

  it("harga andalan opsional — andalan tanpa harga tetap ter-render", () => {
    const site = materializeWizard("contoh", {
      ...answersFor("katalog"),
      highlights: [{ name: "Jasa Servis AC" }],
    });
    const items = JSON.stringify(site.pages.home!.sections);
    expect(items).toContain("Jasa Servis AC");
  });

  it("kuliner mendapat halaman menu terpisah; jenis lain hanya beranda", () => {
    expect(Object.keys(materializeWizard("a", answersFor("kuliner")).pages).sort()).toEqual([
      "home",
      "menu",
    ]);
    expect(Object.keys(materializeWizard("b", answersFor("katalog")).pages)).toEqual(["home"]);
  });

  it("template + tema mengikuti jenis usaha", () => {
    const kuliner = materializeWizard("a", answersFor("kuliner")).site;
    const otomotif = materializeWizard("b", answersFor("otomotif")).site;
    expect(kuliner.template.slug).toBe("kuliner");
    expect(otomotif.template.slug).toBe("otomotif");
    expect(kuliner.theme).not.toEqual(otomotif.theme);
  });

  it("jam buka dilewati bila user tidak mengisinya", () => {
    const { openingHours: _skip, ...tanpaJam } = answersFor("bisnis_jasa");
    const keys = materializeWizard("c", tanpaJam).pages.home!.sections.map((s) => s.sectionKey);
    expect(keys).not.toContain("opening_hours");
  });
});

describe("ketersediaan subdomain (kontrak §3)", () => {
  it("nama tersedia → available", () => {
    expect(checkSubdomain({ subdomain: "warungbudibaru" })).toEqual({ available: true });
  });

  it("nama sistem → RESERVED + saran alternatif", () => {
    const result = checkSubdomain({ subdomain: "admin" });
    expect(result.available).toBe(false);
    expect(result.reason).toBe("RESERVED");
    expect(result.suggestions?.length).toBeGreaterThan(0);
  });

  it("subdomain fixture yang sudah ada → TAKEN", () => {
    expect(checkSubdomain({ subdomain: "otojaya" }).reason).toBe("TAKEN");
  });

  it("terlalu pendek / format salah → INVALID_FORMAT", () => {
    expect(checkSubdomain({ subdomain: "ab" }).reason).toBe("INVALID_FORMAT");
    expect(checkSubdomain({ subdomain: "-awal" }).reason).toBe("INVALID_FORMAT");
  });

  it("subdomain yang sudah dipakai tenant lain → TAKEN", () => {
    const sub = uniqueSubdomain();
    draftWithSubdomain(uniqueOwner(), sub);
    expect(checkSubdomain({ subdomain: sub }).reason).toBe("TAKEN");
  });
});

describe("draft tenant & kepemilikan", () => {
  it("batas draft per user ditegakkan (anti-abuse)", () => {
    const owner = uniqueOwner();
    for (let i = 0; i < MAX_DRAFT_TENANTS_PER_USER; i++) createTenant(owner);
    expectApiError(() => createTenant(owner), 409, "TENANT_LIMIT_REACHED");
  });

  it("tenant user lain tidak terlihat & tidak bisa disentuh (§1.5)", () => {
    const owner = uniqueOwner();
    const { tenantId } = draftWithSubdomain(owner);
    const penyusup = uniqueOwner();

    expect(listTenants(penyusup).items).toHaveLength(0);
    expectApiError(
      () => runWizard(penyusup, tenantId, answersFor("kuliner"), () => "http://x.test"),
      403,
      "FORBIDDEN",
    );
  });

  it("subdomain yang sudah diambil ditolak saat dikunci", () => {
    const sub = uniqueSubdomain();
    draftWithSubdomain(uniqueOwner(), sub);
    const lain = uniqueOwner();
    const tenant = createTenant(lain);
    expectApiError(() => updateSubdomain(lain, tenant.id, { subdomain: sub }), 409, "SUBDOMAIN_TAKEN");
  });
});

describe("wizard → situs preview", () => {
  it("wizard tanpa subdomain ditolak", () => {
    const owner = uniqueOwner();
    const tenant = createTenant(owner);
    expectApiError(
      () => runWizard(owner, tenant.id, answersFor("kuliner"), () => "http://x.test"),
      422,
      "VALIDATION_ERROR",
    );
  });

  it("wizard memateralisasi situs & mengembalikan previewUrl", () => {
    const owner = uniqueOwner();
    const { tenantId, subdomain } = draftWithSubdomain(owner);

    const result = runWizard(
      owner,
      tenantId,
      answersFor("kuliner"),
      (sub) => `http://${sub}.lvh.me:3000`,
    );

    expect(result.previewUrl).toBe(`http://${subdomain}.lvh.me:3000/?preview=1`);
    expect(result.tenant.status).toBe("draft");
    expect(result.tenant.templateId).not.toBeNull();
    expect(result.tenant.themeJson.primaryColor).toBeTruthy();
  });

  it("situs draft: terlihat lewat ?preview=1, tidak terlihat dari luar (DoD 7b.4)", () => {
    const owner = uniqueOwner();
    const { tenantId, subdomain } = draftWithSubdomain(owner);
    runWizard(owner, tenantId, answersFor("kuliner"), () => "http://x.test");

    expect(getMockSite(subdomain, true).tenant.status).toBe("draft");
    expect(getMockPage(subdomain, "home", true).sections.length).toBeGreaterThan(0);

    // Tanpa preview, situs yang belum terbit tidak boleh terlihat ada.
    expect(() => getMockSite(subdomain)).toThrow(RenderApiError);
  });

  it("dipanggil ulang = re-materialisasi (idempotent, kontrak §3)", () => {
    const owner = uniqueOwner();
    const { tenantId, subdomain } = draftWithSubdomain(owner);

    runWizard(owner, tenantId, answersFor("kuliner"), () => "http://x.test");
    runWizard(
      owner,
      tenantId,
      { ...answersFor("kuliner"), businessName: "Warung Ganti Nama" },
      () => "http://x.test",
    );

    expect(JSON.stringify(getMockPage(subdomain, "home", true))).toContain("Warung Ganti Nama");
  });

  it("ganti subdomain memindahkan konten yang sudah dimaterialisasi", () => {
    const owner = uniqueOwner();
    const { tenantId, subdomain } = draftWithSubdomain(owner);
    runWizard(owner, tenantId, answersFor("katalog"), () => "http://x.test");

    const baru = uniqueSubdomain();
    updateSubdomain(owner, tenantId, { subdomain: baru });

    expect(getMockSite(baru, true).tenant.subdomain).toBe(baru);
    expect(() => getMockSite(subdomain, true)).toThrow(RenderApiError);
  });
});

describe("paywall di publish (kontrak §3) & alur bayar (§9)", () => {
  const liveOrigin = (sub: string) => `https://${sub}.marketindonesia.co.id`;

  function siapPublish() {
    const owner = uniqueOwner();
    const { tenantId, subdomain } = draftWithSubdomain(owner);
    runWizard(owner, tenantId, answersFor("kuliner"), () => "http://x.test");
    return { owner, tenantId, subdomain };
  }

  it("publish tanpa langganan → 402 PAYWALL_REQUIRED + daftar plan", () => {
    const { owner, tenantId } = siapPublish();
    try {
      publishTenant(owner, tenantId, { hasSubscription: false, liveOrigin });
      expect.unreachable("harus melempar PAYWALL_REQUIRED");
    } catch (err) {
      const e = err as TenantApiError;
      expect(e.status).toBe(402);
      expect(e.code).toBe("PAYWALL_REQUIRED");
      const plans = e.details?.plans as { id: string; hero: boolean; price: number }[];
      // Tahunan = hero plan (keputusan terkunci), bulanan sekunder.
      expect(plans.find((p) => p.hero)?.id).toBe("yearly");
      expect(plans.find((p) => p.id === "yearly")?.price).toBe(300000);
    }
  });

  it("konten belum lengkap → 422 CONTENT_INCOMPLETE + details.missing", () => {
    const owner = uniqueOwner();
    const { tenantId } = draftWithSubdomain(owner); // belum jalankan wizard
    try {
      publishTenant(owner, tenantId, { hasSubscription: true, liveOrigin });
      expect.unreachable("harus melempar CONTENT_INCOMPLETE");
    } catch (err) {
      const e = err as TenantApiError;
      expect(e.status).toBe(422);
      expect(e.code).toBe("CONTENT_INCOMPLETE");
      expect(e.details?.missing).toContain("konten wizard");
    }
  });

  it("bayar → langganan aktif → tenant auto-publish → situs live tanpa preview", () => {
    const { owner, tenantId, subdomain } = siapPublish();

    const invoice = subscribe(owner, { tenantId, plan: "yearly" }, (id) => `https://bayar.test/${id}`);
    expect(invoice.amount).toBe(PLANS.yearly.price);
    expect(billingStatus(owner, tenantId).subscription).toBeNull();
    expect(hasActiveSubscription(tenantId)).toBe(false);

    // Berdiri untuk webhook Xendit invoice.paid.
    payMockInvoice(owner, invoice.invoiceId);

    const status = billingStatus(owner, tenantId);
    expect(status.subscription?.status).toBe("active");
    expect(status.subscription?.plan).toBe("yearly");
    expect(status.invoices[0]?.status).toBe("paid");

    // Auto-publish: situs kini terlihat TANPA ?preview=1.
    expect(getMockSite(subdomain).tenant.status).toBe("active");
    expect(getMockSite(subdomain).tenant.publishedAt).toBeTruthy();
  });

  it("publish setelah berlangganan mengembalikan URL situs live", () => {
    const { owner, tenantId, subdomain } = siapPublish();
    const result = publishTenant(owner, tenantId, { hasSubscription: true, liveOrigin });
    expect(result.tenant.status).toBe("active");
    expect(result.url).toBe(`https://${subdomain}.marketindonesia.co.id`);
  });

  it("pembayaran ganda idempotent; langganan aktif menolak subscribe ulang (§1.7)", () => {
    const { owner, tenantId } = siapPublish();
    const invoice = subscribe(owner, { tenantId, plan: "monthly" }, (id) => `https://bayar.test/${id}`);

    payMockInvoice(owner, invoice.invoiceId);
    const periodEnd = billingStatus(owner, tenantId).subscription?.periodEnd;
    payMockInvoice(owner, invoice.invoiceId);
    expect(billingStatus(owner, tenantId).subscription?.periodEnd).toBe(periodEnd);

    expectApiError(
      () => subscribe(owner, { tenantId, plan: "yearly" }, (id) => `https://bayar.test/${id}`),
      409,
      "SUBSCRIPTION_ALREADY_ACTIVE",
    );
  });

  it("alamat situs terkunci setelah terbit (kebijakan MVP)", () => {
    const { owner, tenantId } = siapPublish();
    publishTenant(owner, tenantId, { hasSubscription: true, liveOrigin });
    expectApiError(
      () => updateSubdomain(owner, tenantId, { subdomain: uniqueSubdomain() }),
      409,
      "SUBDOMAIN_LOCKED",
    );
  });

  it("wizard ditolak setelah situs terbit (pakai editor, bukan wizard)", () => {
    const { owner, tenantId } = siapPublish();
    publishTenant(owner, tenantId, { hasSubscription: true, liveOrigin });
    expectApiError(
      () => runWizard(owner, tenantId, answersFor("kuliner"), () => "http://x.test"),
      409,
      "TENANT_ALREADY_ACTIVE",
    );
  });

  it("invoice/billing tenant orang lain tidak bisa diakses (§1.5)", () => {
    const { tenantId } = siapPublish();
    expectApiError(() => billingStatus(uniqueOwner(), tenantId), 403, "FORBIDDEN");
  });
});
