import { apiBillingStatus } from "../../utils/dashboard-api";

/**
 * Proxy GET /v1/billing/status?tenantId — sumber kebenaran status pembayaran.
 * Frontend mem-poll ini setelah subscribe; redirect dari kanal bayar TIDAK
 * pernah dianggap lunas (kontrak §9).
 */
export default defineEventHandler((event) => {
  const tenantId = String(getQuery(event).tenantId ?? "");
  return apiBillingStatus(event, tenantId);
});
