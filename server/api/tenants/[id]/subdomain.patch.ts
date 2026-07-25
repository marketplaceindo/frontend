import { apiUpdateSubdomain } from "../../../utils/dashboard-api";

/** Proxy PATCH /v1/tenants/:id/subdomain — kunci alamat situs pilihan user. */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id")!;
  const body = await readBody(event);
  return apiUpdateSubdomain(event, id, body);
});
