import type {
  BillingStatusResponse,
  CheckSubdomainResponse,
  PlanId,
  PublishResponse,
  SubscribeResponse,
  Tenant,
  WizardAnswers,
  WizardResponse,
} from "@marketplaceindo/shared";

/**
 * Aksi Tenants & Billing dashboard — semua lewat proxy Nitro (`/api/tenants/*`,
 * `/api/billing/*`); browser tidak pernah memanggil NestJS langsung. Error
 * dibiarkan dilempar supaya pemanggil memetakan `fieldErrors`/`details` §1.4
 * (lihat `apiErrorOf`).
 */
export function useTenants() {
  // Saat SSR, $fetch polos tidak membawa cookie sesi ke route internal →
  // /api/tenants akan 401. useRequestFetch meneruskan header request asli.
  const fetchApi = useRequestFetch();

  const listTenants = () => fetchApi<{ items: Tenant[] }>("/api/tenants");

  const createTenant = () => fetchApi<Tenant>("/api/tenants", { method: "POST" });

  const checkSubdomain = (subdomain: string) =>
    fetchApi<CheckSubdomainResponse>("/api/tenants/check-subdomain", {
      method: "POST",
      body: { subdomain },
    });

  const setSubdomain = (tenantId: string, subdomain: string) =>
    fetchApi<Tenant>(`/api/tenants/${tenantId}/subdomain`, {
      method: "PATCH",
      body: { subdomain },
    });

  const runWizard = (tenantId: string, answers: WizardAnswers) =>
    fetchApi<WizardResponse>(`/api/tenants/${tenantId}/wizard`, {
      method: "POST",
      body: answers,
    });

  /** Melempar 402 PAYWALL_REQUIRED (details.plans) bila belum berlangganan. */
  const publish = (tenantId: string) =>
    fetchApi<PublishResponse>(`/api/tenants/${tenantId}/publish`, { method: "POST" });

  const subscribe = (tenantId: string, plan: PlanId) =>
    fetchApi<SubscribeResponse>("/api/billing/subscribe", {
      method: "POST",
      body: { tenantId, plan },
    });

  const billingStatus = (tenantId: string) =>
    fetchApi<BillingStatusResponse>("/api/billing/status", { query: { tenantId } });

  return {
    listTenants,
    createTenant,
    checkSubdomain,
    setSubdomain,
    runWizard,
    publish,
    subscribe,
    billingStatus,
  };
}
