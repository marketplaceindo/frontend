import { apiRunWizard } from "../../../utils/dashboard-api";

/**
 * Proxy POST /v1/tenants/:id/wizard — materialisasi situs dari jawaban wizard,
 * balasannya memuat previewUrl (subdomain + ?preview=1) untuk ditampilkan langsung.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id")!;
  const body = await readBody(event);
  return apiRunWizard(event, id, body);
});
