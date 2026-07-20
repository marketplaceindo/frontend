import type { MaybeRefOrGetter } from "vue";

/** URL absolut dari nilai yang mungkin relatif (mis. ogImage), null-safe. */
export function toAbsoluteUrl(origin: string, value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (/^https?:\/\//.test(value)) return value;
  return `${origin}${value.startsWith("/") ? "" : "/"}${value}`;
}

interface TenantSeoInput {
  title: MaybeRefOrGetter<string | undefined>;
  description?: MaybeRefOrGetter<string | undefined>;
  /** URL gambar OG (relatif atau absolut) — dijadikan absolut terhadap origin. */
  ogImage?: MaybeRefOrGetter<string | undefined>;
  noindex: MaybeRefOrGetter<boolean>;
  ogType?: "website" | "article";
}

/**
 * SEO head terpusat untuk halaman tenant (Fase 6): title/description, robots,
 * canonical self-referencing (origin + path, tanpa query supaya varian filter
 * terkonsolidasi), Open Graph, dan Twitter card.
 */
export function useTenantSeo(input: TenantSeoInput) {
  const url = useRequestURL({ xForwardedHost: true });
  const route = useRoute();
  const origin = url.origin;
  const canonical = computed(() => `${origin}${route.path}`);

  useSeoMeta({
    title: () => toValue(input.title),
    description: () => toValue(input.description),
    robots: () => (toValue(input.noindex) ? "noindex, nofollow" : "index, follow"),
    ogTitle: () => toValue(input.title),
    ogDescription: () => toValue(input.description),
    ogType: input.ogType ?? "website",
    ogUrl: () => canonical.value,
    ogImage: () => toAbsoluteUrl(origin, toValue(input.ogImage)),
    twitterCard: () => (toValue(input.ogImage) ? "summary_large_image" : "summary"),
  });

  useHead({
    link: () => [{ rel: "canonical", href: canonical.value }],
  });

  return { origin, canonical };
}
