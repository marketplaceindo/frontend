import { apiCheckSubdomain } from "../../utils/dashboard-api";

/** Proxy POST /v1/tenants/check-subdomain — cek ketersediaan real-time di wizard. */
export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  return apiCheckSubdomain(event, body);
});
