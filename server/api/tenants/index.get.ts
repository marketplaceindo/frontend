import { apiListTenants } from "../../utils/dashboard-api";

/** Proxy GET /v1/tenants/me — daftar situs milik user sesi berjalan. */
export default defineEventHandler((event) => apiListTenants(event));
