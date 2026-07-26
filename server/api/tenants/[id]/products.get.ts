import { apiListCollection } from "../../../utils/dashboard-api";

/** Proxy GET /v1/tenants/:id/products — daftar + filter §7 untuk editor koleksi. */
export default defineEventHandler((event) =>
  apiListCollection(event, "products", getRouterParam(event, "id")!, getQuery(event)),
);
