import { apiUpdateTheme } from "../../../utils/dashboard-api";

/** Proxy PATCH /v1/tenants/:id/theme — tema global tenant (cascade Level 2). */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id")!;
  const body = await readBody(event);
  return apiUpdateTheme(event, id, body);
});
