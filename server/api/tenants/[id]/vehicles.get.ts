import { apiListCollection } from "../../../utils/dashboard-api";

/** Proxy GET /v1/tenants/:id/vehicles — daftar + filter §7 untuk editor koleksi. */
export default defineEventHandler((event) =>
  apiListCollection(event, "vehicles", getRouterParam(event, "id")!, getQuery(event)),
);
