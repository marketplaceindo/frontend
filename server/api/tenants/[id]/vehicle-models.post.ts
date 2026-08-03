import { apiCreateVehicleModel } from "../../../utils/dashboard-api";

/** Proxy POST /v1/tenants/:id/vehicle-models — model + minimal 1 varian. */
export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const model = await apiCreateVehicleModel(event, getRouterParam(event, "id")!, body);
  setResponseStatus(event, 201);
  return model;
});
