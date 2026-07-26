/**
 * Mock modul Billing (Fase 7b) — in-memory, meniru NestJS `/v1/billing/*`
 * (kontrak §9). Xendit tidak dipanggil: `invoiceUrl` menunjuk halaman checkout
 * simulasi di dashboard, dan `payMockInvoice` berdiri untuk webhook
 * `POST /v1/webhooks/xendit` (paid pertama → aktifkan subscription →
 * auto-publish tenant).
 *
 * Frontend TIDAK boleh menyimpulkan lunas dari redirect — sama seperti produksi,
 * satu-satunya sumber kebenaran adalah polling `GET /billing/status`.
 *
 * Bebas dependensi Nitro/h3 → bisa diuji unit murni.
 */
import {
  PLANS,
  subscribeRequestSchema,
  type BillingStatusResponse,
  type InvoiceSummary,
  type PlanId,
  type SubscribeResponse,
} from "@marketplaceindo/shared";
import { TenantApiError } from "./api-error";
import { activateTenantAfterPayment, assertTenantOwned } from "./tenant-store";

interface StoredInvoice extends InvoiceSummary {
  tenantId: string;
  ownerId: string;
  plan: PlanId;
  expiresAt: string;
}

interface StoredSubscription {
  tenantId: string;
  plan: PlanId;
  status: "active" | "past_due" | "canceled";
  periodEnd: string;
}

const invoices = new Map<string, StoredInvoice>();
const subscriptions = new Map<string, StoredSubscription>();

/** Umur invoice Xendit (kontrak tidak mengunci; 24 jam mengikuti default umum). */
const INVOICE_TTL_MS = 24 * 60 * 60 * 1000;

function iso(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

function periodEndFor(plan: PlanId, from: Date): string {
  const end = new Date(from);
  if (plan === "yearly") end.setFullYear(end.getFullYear() + 1);
  else end.setMonth(end.getMonth() + 1);
  return iso(end);
}

/** Subscription aktif untuk tenant? Dipakai paywall publish (kontrak §3). */
export function hasActiveSubscription(tenantId: string): boolean {
  return subscriptions.get(tenantId)?.status === "active";
}

/** POST /v1/billing/subscribe */
export function subscribe(
  ownerId: string,
  raw: unknown,
  checkoutUrl: (invoiceId: string) => string,
): SubscribeResponse {
  const body = subscribeRequestSchema.parse(raw);
  assertTenantOwned(ownerId, body.tenantId);

  if (hasActiveSubscription(body.tenantId)) {
    throw new TenantApiError(
      409,
      "SUBSCRIPTION_ALREADY_ACTIVE",
      "Situs ini sudah punya langganan aktif",
    );
  }

  const now = new Date();
  const id = crypto.randomUUID();
  const invoice: StoredInvoice = {
    id,
    tenantId: body.tenantId,
    ownerId,
    plan: body.plan,
    amount: PLANS[body.plan].price,
    status: "pending",
    paidAt: null,
    invoiceUrl: checkoutUrl(id),
    expiresAt: iso(new Date(now.getTime() + INVOICE_TTL_MS)),
  };
  invoices.set(id, invoice);
  return {
    invoiceId: invoice.id,
    invoiceUrl: invoice.invoiceUrl,
    amount: invoice.amount,
    expiresAt: invoice.expiresAt,
  };
}

/** GET /v1/billing/status?tenantId=uuid */
export function billingStatus(ownerId: string, tenantId: string): BillingStatusResponse {
  assertTenantOwned(ownerId, tenantId);
  const sub = subscriptions.get(tenantId);
  const items: InvoiceSummary[] = [...invoices.values()]
    .filter((i) => i.tenantId === tenantId)
    .map(({ tenantId: _t, ownerId: _o, plan: _p, expiresAt: _e, ...rest }) => rest);

  return {
    subscription: sub
      ? { plan: sub.plan, status: sub.status, periodEnd: sub.periodEnd }
      : null,
    invoices: items,
  };
}

/** Detail invoice untuk halaman checkout simulasi (mock saja, bukan kontrak). */
export function findInvoice(ownerId: string, invoiceId: string): StoredInvoice {
  const invoice = invoices.get(invoiceId);
  if (!invoice) throw new TenantApiError(404, "NOT_FOUND", "Invoice tidak ditemukan");
  if (invoice.ownerId !== ownerId) {
    throw new TenantApiError(403, "FORBIDDEN", "Invoice ini bukan milikmu");
  }
  return invoice;
}

/**
 * Berdiri untuk webhook Xendit `invoice.paid` (kontrak §9): tandai lunas,
 * aktifkan/perpanjang subscription, lalu auto-publish tenant. Di produksi ini
 * dipicu Xendit — di mock dipicu tombol "Bayar (simulasi)".
 */
export function payMockInvoice(ownerId: string, invoiceId: string): { paid: true } {
  const invoice = findInvoice(ownerId, invoiceId);
  if (invoice.status === "paid") return { paid: true }; // idempotent (§1.7)
  if (invoice.status === "expired") {
    throw new TenantApiError(409, "BAD_REQUEST", "Invoice sudah kedaluwarsa");
  }

  const now = new Date();
  invoice.status = "paid";
  invoice.paidAt = iso(now);

  const existing = subscriptions.get(invoice.tenantId);
  subscriptions.set(invoice.tenantId, {
    tenantId: invoice.tenantId,
    plan: invoice.plan,
    status: "active",
    // Perpanjangan menambah dari periodEnd berjalan; baru → dari sekarang.
    periodEnd: periodEndFor(
      invoice.plan,
      existing && existing.periodEnd > iso(now) ? new Date(existing.periodEnd) : now,
    ),
  });

  activateTenantAfterPayment(invoice.tenantId);
  return { paid: true };
}
