/**
 * Hasil resolusi Host header → mode aplikasi.
 * `dashboard` = domain utama / app. / www. (dashboard & onboarding, Fase 7).
 * `tenant`    = subdomain tenant ([user].marketindonesia.co.id).
 *
 * Augmentasi tipe `event.context.tenant` ada di server/types/h3-context.d.ts
 * (module h3 hanya resolvable dari project server).
 */
export type TenantRouting =
  | { mode: "dashboard" }
  | { mode: "tenant"; subdomain: string };
