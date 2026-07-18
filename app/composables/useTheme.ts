/**
 * Fase 2 — apply theme tenant (Level 2 cascade) + font loading dinamis.
 * Konversi murni ada di app/utils/theme-vars.ts (teruji unit);
 * composable ini hanya wiring reaktif ke inline style & useHead.
 */
import type { MaybeRefOrGetter } from "vue";

export function useTenantTheme(theme: MaybeRefOrGetter<unknown>) {
  /** Inline style untuk root wrapper tenant — ter-render di HTML SSR (anti-FOUC). */
  const themeStyle = computed(() => themeToVars(toValue(theme)));

  // Font curated → self-host: @font-face inline + preload woff2 heading
  // (same-origin, tanpa chain koneksi Google — LCP teks tidak tertahan).
  const fontPlan = computed(() => selfHostedFontPlan(toValue(theme)));
  // Family di luar registry → fallback Google Fonts (hanya yang dipakai tenant),
  // stylesheet non-blocking (preload + media=print → swap saat onload).
  const fontsHref = computed(() =>
    fontPlan.value ? null : googleFontsHref(toValue(theme)),
  );

  useHead({
    style: () =>
      fontPlan.value ? [{ innerHTML: fontPlan.value.css }] : [],
    link: () => {
      if (fontPlan.value) {
        // Tanpa <link preload>: fetch woff2 dimulai saat @font-face diproses —
        // preload font justru berebut bandwidth dengan CSS sebelum first paint.
        return [];
      }
      return fontsHref.value
        ? [
            { rel: "preconnect", href: "https://fonts.googleapis.com" },
            { rel: "preconnect", href: "https://fonts.gstatic.com", crossorigin: "" },
            { rel: "preload", as: "style", href: fontsHref.value },
            {
              rel: "stylesheet",
              href: fontsHref.value,
              media: "print",
              onload: "this.media='all'",
            },
          ]
        : [];
    },
    noscript: () =>
      fontsHref.value
        ? [{ innerHTML: `<link rel="stylesheet" href="${fontsHref.value}">` }]
        : [],
  });

  return { themeStyle, fontsHref };
}
