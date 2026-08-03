import { apiListVehicleModels } from "../../../utils/dashboard-api";

/** Proxy GET /v1/tenants/:id/vehicle-models — daftar model untuk editor. */
export default defineEventHandler((event) =>
  apiListVehicleModels(event, getRouterParam(event, "id")!, getQuery(event)),
);
