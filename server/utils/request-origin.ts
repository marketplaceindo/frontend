import type { H3Event } from "h3";

/**
 * Origin absolut request tenant (mis. https://otojaya.marketindonesia.co.id),
 * dipakai membangun URL absolut di sitemap. Menghormati header proxy
 * (x-forwarded-host/proto) supaya benar di belakang reverse proxy produksi.
 */
export function requestOrigin(event: H3Event): string {
  const host = getRequestHost(event, { xForwardedHost: true });
  const proto = getRequestProtocol(event, { xForwardedProto: true });
  return `${proto}://${host}`;
}
