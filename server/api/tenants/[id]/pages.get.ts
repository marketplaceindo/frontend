import { apiListPages } from "../../../utils/dashboard-api";

/** Proxy GET /v1/tenants/:id/pages — daftar halaman untuk editor. */
export default defineEventHandler((event) => {
  const id = getRouterParam(event, "id")!;
  return apiListPages(event, id);
});
