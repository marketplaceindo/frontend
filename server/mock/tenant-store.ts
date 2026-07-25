/**
 * Mock modul Tenants & Onboarding (Fase 7b) — in-memory, meniru NestJS
 * `/v1/tenants/*` (kontrak §3). Setiap tenant dimiliki satu user; wizard
 * memateralisasi konten nyata ke render-store sehingga situs preview langsung
 * ter-render lewat jalur publik yang sama.
 *
 * Bebas dependensi Nitro/h3 → bisa diuji unit murni.
 */
import {
  MAX_DRAFT_TENANTS_PER_USER,
  PLANS,
  checkSubdomainRequestSchema,
  isReservedSubdomain,
  subdomainSchema,
  updateSubdomainRequestSchema,
  wizardAnswersSchema,
  type CheckSubdomainResponse,
  type PublishResponse,
  type Tenant,
  type WizardAnswers,
  type WizardResponse,
} from "@marketplaceindo/shared";
import { MIN_SUBDOMAIN_LENGTH, normalizeSubdomain } from "../../shared/utils/subdomain";
import { materializeWizard, templateIdForBusinessType, themeForBusinessType } from "./materialize";
import { isSubdomainUsed, registerTenantSite, unregisterTenantSite } from "./render-store";

/** Error setara response error kontrak §1.4; dikonversi ke H3Error di dashboard-api. */
export class TenantApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "TenantApiError";
  }
}

interface StoredTenant extends Tenant {
  ownerId: string;
  /** Jawaban wizard terakhir — sumber re-materialisasi saat publish. */
  answers: WizardAnswers | null;
}

const tenants = new Map<string, StoredTenant>();

function nowIso(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

function publicTenant(t: StoredTenant): Tenant {
  const { ownerId: _owner, answers: _answers, ...rest } = t;
  return rest;
}

/** Ambil tenant milik user; 404 bila tidak ada, 403 bila bukan pemilik (§1.5). */
function ownedTenant(ownerId: string, tenantId: string): StoredTenant {
  const tenant = tenants.get(tenantId);
  if (!tenant) throw new TenantApiError(404, "NOT_FOUND", "Situs tidak ditemukan");
  if (tenant.ownerId !== ownerId) {
    throw new TenantApiError(403, "FORBIDDEN", "Kamu tidak punya akses ke situs ini");
  }
  return tenant;
}

/** GET /v1/tenants/me */
export function listTenants(ownerId: string): { items: Tenant[] } {
  const items = [...tenants.values()]
    .filter((t) => t.ownerId === ownerId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map(publicTenant);
  return { items };
}

/** POST /v1/tenants — draft kosong, dipanggil saat user memulai wizard. */
export function createTenant(ownerId: string): Tenant {
  const drafts = [...tenants.values()].filter(
    (t) => t.ownerId === ownerId && t.status === "draft",
  );
  if (drafts.length >= MAX_DRAFT_TENANTS_PER_USER) {
    throw new TenantApiError(
      409,
      "TENANT_LIMIT_REACHED",
      `Kamu sudah punya ${MAX_DRAFT_TENANTS_PER_USER} situs draft. Selesaikan atau hapus salah satunya dulu.`,
    );
  }
  const tenant: StoredTenant = {
    id: crypto.randomUUID(),
    ownerId,
    subdomain: null,
    status: "draft",
    templateId: null,
    themeJson: {},
    createdAt: nowIso(),
    publishedAt: null,
    answers: null,
  };
  tenants.set(tenant.id, tenant);
  return publicTenant(tenant);
}

/**
 * Saran subdomain alternatif saat pilihan user tidak tersedia — derivasi dari
 * input (kontrak §3), bukan angka acak murni supaya tetap mudah diingat.
 */
function suggestSubdomains(base: string): string[] {
  const clean = normalizeSubdomain(base) || "situs";
  const candidates = [
    `${clean}id`,
    `${clean}-official`,
    `${clean}${new Date().getFullYear()}`,
    `${clean}-store`,
  ];
  return candidates
    .filter((c) => subdomainSchema.safeParse(c).success && !isTaken(c))
    .slice(0, 3);
}

function isTaken(subdomain: string): boolean {
  if (isSubdomainUsed(subdomain)) return true;
  return [...tenants.values()].some((t) => t.subdomain === subdomain);
}

/** POST /v1/tenants/check-subdomain */
export function checkSubdomain(raw: unknown): CheckSubdomainResponse {
  const { subdomain } = checkSubdomainRequestSchema.parse(raw);
  const value = subdomain.toLowerCase();

  if (value.length < MIN_SUBDOMAIN_LENGTH || !subdomainSchema.safeParse(value).success) {
    return { available: false, reason: "INVALID_FORMAT", suggestions: suggestSubdomains(value) };
  }
  if (isReservedSubdomain(value)) {
    return { available: false, reason: "RESERVED", suggestions: suggestSubdomains(value) };
  }
  if (isTaken(value)) {
    return { available: false, reason: "TAKEN", suggestions: suggestSubdomains(value) };
  }
  return { available: true };
}

/** PATCH /v1/tenants/:id/subdomain */
export function updateSubdomain(ownerId: string, tenantId: string, raw: unknown): Tenant {
  const { subdomain } = updateSubdomainRequestSchema.parse(raw);
  const tenant = ownedTenant(ownerId, tenantId);
  const value = subdomain.toLowerCase();

  // Kebijakan MVP: setelah aktif, alamat situs terkunci (kontrak §3).
  if (tenant.status === "active" && tenant.subdomain !== value) {
    throw new TenantApiError(
      409,
      "SUBDOMAIN_LOCKED",
      "Alamat situs tidak bisa diubah setelah terbit",
    );
  }
  const check = checkSubdomain({ subdomain: value });
  if (!check.available && tenant.subdomain !== value) {
    if (check.reason === "RESERVED") {
      throw new TenantApiError(422, "SUBDOMAIN_RESERVED", "Alamat ini dipakai sistem, pilih yang lain");
    }
    if (check.reason === "TAKEN") {
      throw new TenantApiError(409, "SUBDOMAIN_TAKEN", "Alamat ini sudah dipakai situs lain");
    }
    throw new TenantApiError(422, "VALIDATION_ERROR", "Format alamat situs tidak valid");
  }

  const previous = tenant.subdomain;
  tenant.subdomain = value;
  // Pindahkan konten yang sudah dimaterialisasi ke alamat baru.
  if (previous && previous !== value && tenant.answers) {
    unregisterTenantSite(previous);
    registerTenantSite(value, materializeWizard(value, tenant.answers, tenant.status, tenant.publishedAt));
  }
  return publicTenant(tenant);
}

/**
 * POST /v1/tenants/:id/wizard — pilih template dari `businessType`, materialisasi
 * konten nyata, kembalikan tenant + previewUrl. Idempotent: dipanggil ulang =
 * re-materialisasi (kontrak §3).
 */
export function runWizard(
  ownerId: string,
  tenantId: string,
  raw: unknown,
  previewOrigin: (subdomain: string) => string,
): WizardResponse {
  const answers = wizardAnswersSchema.parse(raw);
  const tenant = ownedTenant(ownerId, tenantId);

  if (tenant.status === "active") {
    throw new TenantApiError(
      409,
      "TENANT_ALREADY_ACTIVE",
      "Situs sudah terbit — ubah lewat editor, bukan wizard",
    );
  }
  if (!tenant.subdomain) {
    throw new TenantApiError(422, "VALIDATION_ERROR", "Pilih alamat situs dulu sebelum lanjut", {
      fieldErrors: { subdomain: ["Alamat situs belum dipilih"] },
    });
  }

  tenant.answers = answers;
  tenant.templateId = templateIdForBusinessType(answers.businessType);
  tenant.themeJson = themeForBusinessType(answers.businessType);
  registerTenantSite(
    tenant.subdomain,
    materializeWizard(tenant.subdomain, answers, tenant.status, tenant.publishedAt),
  );

  return {
    tenant: publicTenant(tenant),
    previewUrl: `${previewOrigin(tenant.subdomain)}/?preview=1`,
  };
}

/**
 * POST /v1/tenants/:id/publish — **titik paywall** (kontrak §3).
 * Tanpa subscription aktif → 402 PAYWALL_REQUIRED + daftar plan.
 * `hasSubscription` di-inject pemanggil supaya modul ini tidak bergantung pada
 * billing-store (menghindari siklus impor).
 */
export function publishTenant(
  ownerId: string,
  tenantId: string,
  opts: { hasSubscription: boolean; liveOrigin: (subdomain: string) => string },
): PublishResponse {
  const tenant = ownedTenant(ownerId, tenantId);

  if (!opts.hasSubscription) {
    throw new TenantApiError(402, "PAYWALL_REQUIRED", "Pilih paket untuk menerbitkan situsmu", {
      plans: [PLANS.yearly, PLANS.monthly],
    });
  }

  const missing = missingContent(tenant);
  if (missing.length) {
    throw new TenantApiError(422, "CONTENT_INCOMPLETE", "Situs belum lengkap untuk diterbitkan", {
      missing,
    });
  }
  return { tenant: activate(tenant), url: opts.liveOrigin(tenant.subdomain!) };
}

/** Kelengkapan minimum sebelum terbit (kontrak §3: ≥1 halaman, section wajib terisi). */
function missingContent(tenant: StoredTenant): string[] {
  const missing: string[] = [];
  if (!tenant.subdomain) missing.push("subdomain");
  if (!tenant.answers) missing.push("konten wizard");
  if (!tenant.templateId) missing.push("template");
  return missing;
}

function activate(tenant: StoredTenant): Tenant {
  tenant.status = "active";
  tenant.publishedAt ??= nowIso();
  registerTenantSite(
    tenant.subdomain!,
    materializeWizard(tenant.subdomain!, tenant.answers!, "active", tenant.publishedAt),
  );
  return publicTenant(tenant);
}

/**
 * Auto-publish setelah invoice pertama lunas (kontrak §9: webhook Xendit paid →
 * aktifkan subscription → publish tenant). Dipanggil billing-store, bukan route.
 * Mengembalikan null bila tenant belum layak terbit — pembayaran tetap sah,
 * user tinggal menekan Publish lagi setelah melengkapi konten.
 */
export function activateTenantAfterPayment(tenantId: string): Tenant | null {
  const tenant = tenants.get(tenantId);
  if (!tenant || missingContent(tenant).length) return null;
  return activate(tenant);
}

/** Dipakai billing untuk memastikan tenant target memang milik user (§1.5). */
export function assertTenantOwned(ownerId: string, tenantId: string): void {
  ownedTenant(ownerId, tenantId);
}
