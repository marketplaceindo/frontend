import { knownBaseDomains, resolveTenantFromHost } from "../utils/tenant-host";

/**
 * Baca header Host di setiap request, ekstrak subdomain, dan set
 * `event.context.tenant` ({ mode: "dashboard" } | { mode: "tenant", subdomain }).
 * Konsumen: route /api/_render/* dan pages (via useRequestEvent).
 */
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook("request", (event) => {
    const config = useRuntimeConfig(event);
    event.context.tenant = resolveTenantFromHost(
      getRequestHost(event, { xForwardedHost: true }),
      knownBaseDomains(config.public.baseDomain),
    );
  });
});
