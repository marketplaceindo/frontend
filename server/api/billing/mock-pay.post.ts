import { apiMockPay } from "../../utils/dashboard-api";

/**
 * Berdiri untuk webhook Xendit `invoice.paid` di mode mock: tandai lunas →
 * aktifkan langganan → auto-publish tenant. Tidak ada padanannya di produksi
 * (Xendit yang memanggil backend), karena itu 404 saat dashboardMock=false.
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<{ invoiceId?: string }>(event);
  return apiMockPay(event, String(body?.invoiceId ?? ""));
});
