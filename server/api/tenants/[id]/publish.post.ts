import { apiPublishTenant } from "../../../utils/dashboard-api";

/**
 * Proxy POST /v1/tenants/:id/publish — **titik paywall** (kontrak §3).
 * Tanpa langganan aktif balasannya 402 PAYWALL_REQUIRED + details.plans.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id")!;
  return apiPublishTenant(event, id);
});
