/**
 * Jembatan dashboard → modul Tenants/Billing (Fase 7b). Browser memanggil route
 * Nitro `/api/tenants/*` dan `/api/billing/*`; di sini dipilih antara mock
 * in-memory (default dev) dan proxy ke NestJS `/v1/*` dengan `Authorization:
 * Bearer` dari cookie httpOnly — token tidak pernah menyentuh JS browser
 * (keputusan terkunci CLAUDE.md).
 *
 * Semua error dinormalisasi ke H3Error ber-`data.error` sesuai kontrak §1.4.
 */
import type { H3Event } from "h3";
import { ZodError } from "zod";
import { FetchError } from "ofetch";
import type {
  BillingStatusResponse,
  CheckSubdomainResponse,
  PublishResponse,
  SubscribeResponse,
  Tenant,
  User,
  WizardResponse,
} from "@marketplaceindo/shared";
import {
  TenantApiError,
  checkSubdomain,
  createTenant,
  listTenants,
  publishTenant,
  runWizard,
  updateSubdomain,
} from "../mock/tenant-store";
import {
  billingStatus,
  findInvoice,
  hasActiveSubscription,
  payMockInvoice,
  subscribe,
} from "../mock/billing-store";
import { currentAccessToken, currentUser } from "./dashboard-auth";
import { knownBaseDomains } from "./tenant-host";

/** Sesi wajib untuk seluruh area dashboard; tanpa itu → 401 (kontrak §12). */
export function requireUser(event: H3Event): User {
  const user = currentUser(event);
  if (!user) {
    throw createError({
      statusCode: 401,
      message: "Silakan masuk dulu",
      data: { error: { code: "UNAUTHORIZED", message: "Silakan masuk dulu" } },
    });
  }
  return user;
}

/**
 * Origin absolut situs tenant (mis. `http://warungbudi.lvh.me:3000`), diturunkan
 * dari Host request supaya benar di dev (lvh.me + port) maupun produksi.
 */
export function tenantOrigin(event: H3Event, subdomain: string): string {
  const config = useRuntimeConfig(event);
  const proto = getRequestProtocol(event, { xForwardedProto: true });
  const [hostname = "", port] = getRequestHost(event, { xForwardedHost: true }).split(":");
  const base =
    knownBaseDomains(config.public.baseDomain).find(
      (b) => hostname === b || hostname.endsWith(`.${b}`),
    ) ?? config.public.baseDomain;
  return `${proto}://${subdomain}.${base}${port ? `:${port}` : ""}`;
}

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
  if (err instanceof TenantApiError) {
    // `fieldErrors` boleh ikut di details (§1.4) — angkat ke level error agar
    // form dashboard memetakannya sama seperti error validasi backend.
    const { fieldErrors, ...details } = (err.details ?? {}) as {
      fieldErrors?: Record<string, string[]>;
    };
    throw createError({
      statusCode: err.status,
      message: err.message,
      data: {
        error: {
          code: err.code,
          message: err.message,
          ...(fieldErrors ? { fieldErrors } : {}),
          ...(Object.keys(details).length ? { details } : {}),
        },
      },
    });
  }
  if (err instanceof FetchError) {
    const body = err.data as { error?: { code?: string; message?: string } } | undefined;
    throw createError({
      statusCode: err.statusCode ?? 502,
      message: body?.error?.message ?? "Layanan tidak dapat dihubungi",
      data: { error: body?.error ?? { code: "INTERNAL", message: "Dashboard API error" } },
    });
  }
  throw err;
}

/** Proxy ke NestJS dengan Bearer token sesi (dipakai saat dashboardMock=false). */
function proxy<T>(
  event: H3Event,
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  opts: { body?: unknown; query?: Record<string, unknown> } = {},
): Promise<T> {
  const config = useRuntimeConfig(event);
  const token = currentAccessToken(event);
  return $fetch(`${config.dashboardApiBase}${path}`, {
    method,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    ...(opts.body !== undefined ? { body: opts.body as Record<string, unknown> } : {}),
    ...(opts.query ? { query: opts.query } : {}),
  }) as Promise<T>;
}

const isMock = (event: H3Event) => useRuntimeConfig(event).dashboardMock;

// ---------------------------------------------------------------------------
// Tenants & onboarding (kontrak §3)
// ---------------------------------------------------------------------------

export async function apiListTenants(event: H3Event): Promise<{ items: Tenant[] }> {
  const user = requireUser(event);
  try {
    if (isMock(event)) return listTenants(user.id);
    return await proxy<{ items: Tenant[] }>(event, "GET", "/tenants/me");
  } catch (err) {
    toH3Error(err);
  }
}

export async function apiCreateTenant(event: H3Event): Promise<Tenant> {
  const user = requireUser(event);
  try {
    if (isMock(event)) return createTenant(user.id);
    return await proxy<Tenant>(event, "POST", "/tenants", { body: {} });
  } catch (err) {
    toH3Error(err);
  }
}

export async function apiCheckSubdomain(
  event: H3Event,
  body: unknown,
): Promise<CheckSubdomainResponse> {
  requireUser(event);
  try {
    if (isMock(event)) return checkSubdomain(body);
    return await proxy<CheckSubdomainResponse>(event, "POST", "/tenants/check-subdomain", { body });
  } catch (err) {
    toH3Error(err);
  }
}

export async function apiUpdateSubdomain(
  event: H3Event,
  tenantId: string,
  body: unknown,
): Promise<Tenant> {
  const user = requireUser(event);
  try {
    if (isMock(event)) return updateSubdomain(user.id, tenantId, body);
    return await proxy<Tenant>(event, "PATCH", `/tenants/${tenantId}/subdomain`, { body });
  } catch (err) {
    toH3Error(err);
  }
}

export async function apiRunWizard(
  event: H3Event,
  tenantId: string,
  body: unknown,
): Promise<WizardResponse> {
  const user = requireUser(event);
  try {
    if (isMock(event)) {
      return runWizard(user.id, tenantId, body, (sub) => tenantOrigin(event, sub));
    }
    return await proxy<WizardResponse>(event, "POST", `/tenants/${tenantId}/wizard`, { body });
  } catch (err) {
    toH3Error(err);
  }
}

export async function apiPublishTenant(
  event: H3Event,
  tenantId: string,
): Promise<PublishResponse> {
  const user = requireUser(event);
  try {
    if (isMock(event)) {
      return publishTenant(user.id, tenantId, {
        hasSubscription: hasActiveSubscription(tenantId),
        liveOrigin: (sub) => tenantOrigin(event, sub),
      });
    }
    return await proxy<PublishResponse>(event, "POST", `/tenants/${tenantId}/publish`, { body: {} });
  } catch (err) {
    toH3Error(err);
  }
}

// ---------------------------------------------------------------------------
// Billing (kontrak §9)
// ---------------------------------------------------------------------------

export async function apiSubscribe(event: H3Event, body: unknown): Promise<SubscribeResponse> {
  const user = requireUser(event);
  try {
    if (isMock(event)) {
      const origin = getRequestProtocol(event, { xForwardedProto: true });
      const host = getRequestHost(event, { xForwardedHost: true });
      return subscribe(user.id, body, (id) => `${origin}://${host}/bayar-simulasi?invoice=${id}`);
    }
    const idempotencyKey = getHeader(event, "idempotency-key");
    const config = useRuntimeConfig(event);
    const token = currentAccessToken(event);
    return await $fetch<SubscribeResponse>(`${config.dashboardApiBase}/billing/subscribe`, {
      method: "POST",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
      },
      body: body as Record<string, unknown>,
    });
  } catch (err) {
    toH3Error(err);
  }
}

export async function apiBillingStatus(
  event: H3Event,
  tenantId: string,
): Promise<BillingStatusResponse> {
  const user = requireUser(event);
  try {
    if (isMock(event)) return billingStatus(user.id, tenantId);
    return await proxy<BillingStatusResponse>(event, "GET", "/billing/status", {
      query: { tenantId },
    });
  } catch (err) {
    toH3Error(err);
  }
}

/**
 * Checkout simulasi (mock saja). Di produksi user membayar di halaman Xendit dan
 * status berubah lewat webhook — tidak ada padanan endpoint ini.
 */
export function apiMockCheckout(event: H3Event, invoiceId: string) {
  const user = requireUser(event);
  if (!isMock(event)) {
    throw createError({
      statusCode: 404,
      message: "Tidak tersedia",
      data: { error: { code: "NOT_FOUND", message: "Tidak tersedia" } },
    });
  }
  try {
    const invoice = findInvoice(user.id, invoiceId);
    return {
      id: invoice.id,
      amount: invoice.amount,
      status: invoice.status,
      plan: invoice.plan,
      expiresAt: invoice.expiresAt,
    };
  } catch (err) {
    toH3Error(err);
  }
}

export function apiMockPay(event: H3Event, invoiceId: string): { paid: true } {
  const user = requireUser(event);
  if (!isMock(event)) {
    throw createError({
      statusCode: 404,
      message: "Tidak tersedia",
      data: { error: { code: "NOT_FOUND", message: "Tidak tersedia" } },
    });
  }
  try {
    return payMockInvoice(user.id, invoiceId);
  } catch (err) {
    toH3Error(err);
  }
}
