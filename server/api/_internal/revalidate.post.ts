import { z } from "zod";
import { RENDER_CACHE_GROUP, isCacheKeyOfTenant } from "../../utils/render-cache-key";

/**
 * Kontrak §11 — `POST {NUXT_ORIGIN}/api/_internal/revalidate`.
 * Dipanggil backend saat publish, update collection item, atau suspend/reaktivasi
 * supaya perubahan muncul di situs publik seketika, tanpa menunggu TTL ISR.
 *
 * Autentikasi memakai `X-Service-Token` (shared secret antar-service), bukan JWT
 * user — endpoint ini tidak pernah dipanggil browser.
 */
const bodySchema = z.object({
  subdomain: z.string().min(1),
  paths: z.union([z.literal("*"), z.array(z.string())]).optional(),
});

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event);
  const token = getHeader(event, "x-service-token");

  // Tanpa token terkonfigurasi endpoint ditutup — lebih aman daripada terbuka
  // karena secret belum di-set (mis. env produksi salah konfigurasi).
  if (!config.renderServiceToken || token !== config.renderServiceToken) {
    throw createError({
      statusCode: 401,
      message: "Token layanan tidak valid",
      data: { error: { code: "UNAUTHORIZED", message: "Token layanan tidak valid" } },
    });
  }

  const parsed = bodySchema.safeParse(await readBody(event));
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      message: "Request tidak valid",
      data: { error: { code: "BAD_REQUEST", message: "Request tidak valid" } },
    });
  }
  const { subdomain, paths } = parsed.data;

  // Kunci cache render selalu diawali subdomain (lihat render-cache.ts), jadi
  // purge per-tenant = hapus semua key yang mengandung segmen subdomain itu.
  const storage = useStorage("cache");
  const keys = await storage.getKeys(RENDER_CACHE_GROUP);
  const target = keys.filter((key) => isCacheKeyOfTenant(key, subdomain));

  await Promise.all(target.map((key) => storage.removeItem(key)));

  // `paths` diterima demi kompatibilitas kontrak; cache di sini berbutir
  // per-tenant (site + tiap slug), jadi purge selalu mencakup path yang diminta.
  return { purged: target.length, subdomain, paths: paths ?? "*" };
});
