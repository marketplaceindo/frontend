import { apiUpdateVehicleModel } from "../../utils/dashboard-api";

/** Proxy PATCH /v1/vehicle-models/:modelId. */
export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  return apiUpdateVehicleModel(event, getRouterParam(event, "modelId")!, body);
});
