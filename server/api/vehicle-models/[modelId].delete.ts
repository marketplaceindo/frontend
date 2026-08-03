import { apiDeleteVehicleModel } from "../../utils/dashboard-api";

/** Proxy DELETE /v1/vehicle-models/:modelId → 204. */
export default defineEventHandler(async (event) => {
  await apiDeleteVehicleModel(event, getRouterParam(event, "modelId")!);
  setResponseStatus(event, 204);
  return null;
});
