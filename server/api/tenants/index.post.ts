import { apiCreateTenant } from "../../utils/dashboard-api";

/** Proxy POST /v1/tenants — draft kosong saat user memulai wizard. */
export default defineEventHandler(async (event) => {
  setResponseStatus(event, 201);
  return await apiCreateTenant(event);
});
