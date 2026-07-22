import { currentUser } from "../../utils/dashboard-auth";

/** Profil sesi berjalan dari cookie httpOnly (null bila belum login). */
export default defineEventHandler((event) => {
  return { user: currentUser(event) };
});
