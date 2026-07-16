/**
 * Fase 2 — apply theme tenant (Level 2 cascade) + font loading dinamis.
 * Konversi murni ada di app/utils/theme-vars.ts (teruji unit);
 * composable ini hanya wiring reaktif ke inline style & useHead.
 */
import type { MaybeRefOrGetter } from "vue";

export function useTenantTheme(theme: MaybeRefOrGetter<unknown>) {
  /** Inline style untuk root wrapper tenant — ter-render di HTML SSR (anti-FOUC). */
  const themeStyle = computed(() => themeToVars(toValue(theme)));

  const fontsHref = computed(() => googleFontsHref(toValue(theme)));

  // Hanya load font yang dipakai tenant; preconnect + display=swap (di URL).
  useHead({
    link: () =>
      fontsHref.value
        ? [
            { rel: "preconnect", href: "https://fonts.googleapis.com" },
            { rel: "preconnect", href: "https://fonts.gstatic.com", crossorigin: "" },
            { rel: "stylesheet", href: fontsHref.value },
          ]
        : [],
  });

  return { themeStyle, fontsHref };
}
