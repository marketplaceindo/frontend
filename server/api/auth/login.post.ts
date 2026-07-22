import { loginDashboard } from "../../utils/dashboard-auth";

/** Proxy login: browser → Nitro → (mock | NestJS /v1/auth/login). */
export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const user = await loginDashboard(event, body);
  return { user };
});
