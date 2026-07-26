import { apiCreatePage } from "../../../utils/dashboard-api";

/** Proxy POST /v1/tenants/:id/pages — tambah halaman baru. */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id")!;
  const body = await readBody(event);
  const page = await apiCreatePage(event, id, body);
  setResponseStatus(event, 201);
  return page;
});
