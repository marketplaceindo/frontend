import { clearAuthSession } from "../../utils/dashboard-auth";

/** Hapus cookie sesi (access/refresh/user). */
export default defineEventHandler((event) => {
  clearAuthSession(event);
  return { ok: true };
});
