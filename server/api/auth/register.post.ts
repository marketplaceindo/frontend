import { registerDashboard } from "../../utils/dashboard-auth";

/** Proxy register: browser → Nitro → (mock | NestJS /v1/auth/register). */
export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const user = await registerDashboard(event, body);
  setResponseStatus(event, 201);
  return { user };
});
