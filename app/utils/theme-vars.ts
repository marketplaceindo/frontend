/**
 * Konversi theme/style JSON → CSS custom properties (Fase 2).
 * Semua input divalidasi ulang dengan schema shared sebelum dipakai (guard
 * terhadap injection ke CSS) — nilai invalid dibuang, fallback ke token
 * Level 1 di app/assets/css/main.css.
 *
 * Cascade: Level 1 @theme (seed) → Level 2 themeToVars (root tenant)
 * → Level 3 sectionStyleToCss (wrapper section, menang karena terdekat).
 */
import {
  sectionStyleSchema,
  tenantThemeSchema,
  type SectionStyle,
  type TenantTheme,
} from "@marketplaceindo/shared";

export type CssVars = Record<string, string>;

/** Nama font yang boleh masuk ke value CSS & URL Google Fonts. */
const FONT_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9\- ]{0,79}$/;

/** Family generik/sistem — dipakai apa adanya, tidak di-load dari Google Fonts. */
const GENERIC_FONTS = new Set([
  "system-ui", "sans-serif", "serif", "monospace", "cursive",
  "arial", "helvetica", "helvetica neue", "georgia", "times new roman",
  "verdana", "tahoma", "segoe ui", "inherit",
]);

const RADIUS_MAP: Record<NonNullable<TenantTheme["radius"]>, string> = {
  none: "0",
  sm: "0.25rem",
  md: "0.5rem",
  lg: "1rem",
  full: "9999px",
};

const PADDING_Y_MAP: Record<NonNullable<SectionStyle["paddingY"]>, string> = {
  none: "var(--section-py-none)",
  sm: "var(--section-py-sm)",
  md: "var(--section-py-md)",
  lg: "var(--section-py-lg)",
};

const ALIGN_MAP: Record<NonNullable<SectionStyle["align"]>, string> = {
  left: "left",
  center: "center",
  right: "right",
};

/** Family valid → value font-family CSS ber-fallback; invalid → null (fallback token). */
function toFontFamilyValue(family: string, fallback: "heading" | "body"): string | null {
  if (!FONT_NAME_RE.test(family)) return null;
  const generic = GENERIC_FONTS.has(family.toLowerCase());
  return generic ? family : `"${family}", var(--font-${fallback}-fallback, sans-serif)`;
}

/**
 * Level 2: tenant.themeJson → CSS vars untuk root wrapper situs tenant.
 * Field yang tidak diisi tenant tidak menghasilkan var → fallback Level 1.
 */
export function themeToVars(theme: unknown): CssVars {
  const parsed = tenantThemeSchema.safeParse(theme);
  if (!parsed.success) return {};
  const t = parsed.data;
  const vars: CssVars = {};

  if (t.primaryColor) vars["--color-primary"] = t.primaryColor;
  if (t.secondaryColor) vars["--color-secondary"] = t.secondaryColor;
  if (t.accentColor) vars["--color-accent"] = t.accentColor;
  if (t.backgroundColor) vars["--color-bg"] = t.backgroundColor;
  if (t.textColor) vars["--color-text"] = t.textColor;
  if (t.radius) vars["--radius-theme"] = RADIUS_MAP[t.radius];

  if (t.fontHeading) {
    const v = toFontFamilyValue(t.fontHeading, "heading");
    if (v) vars["--font-heading"] = v;
  }
  if (t.fontBody) {
    const v = toFontFamilyValue(t.fontBody, "body");
    if (v) vars["--font-body"] = v;
  }
  return vars;
}

/**
 * Level 3: section.styleJson → CSS vars untuk wrapper satu section
 * (dikonsumsi class .section-shell). Menimpa Level 2 karena lebih dekat.
 */
export function sectionStyleToCss(style: unknown): CssVars {
  const parsed = sectionStyleSchema.safeParse(style);
  if (!parsed.success) return {};
  const s = parsed.data;
  const vars: CssVars = {};

  if (s.textColor) vars["--color-text"] = s.textColor;
  if (s.backgroundColor) vars["--color-bg"] = s.backgroundColor;
  if (s.align) vars["--section-align"] = ALIGN_MAP[s.align];
  if (s.paddingY) vars["--section-py"] = PADDING_Y_MAP[s.paddingY];
  if (s.fontFamily) {
    const v = toFontFamilyValue(s.fontFamily, "body");
    if (v) vars["--font-body"] = v;
  }
  return vars;
}

/**
 * Font curated yang di-self-host (public/fonts, subset latin — cukup untuk
 * Bahasa Indonesia). Same-origin → tanpa koneksi ke Google, woff2 heading bisa
 * di-preload (LCP teks tidak menunggu chain 2 origin). Family di luar daftar
 * ini fallback ke Google Fonts (googleFontsHref).
 */
export const SELF_HOSTED_FONTS: Record<string, Record<number, string>> = {
  Poppins: { 400: "/fonts/poppins-400.woff2", 600: "/fonts/poppins-600.woff2", 700: "/fonts/poppins-700.woff2" },
  Inter: { 400: "/fonts/inter-400.woff2", 600: "/fonts/inter-600.woff2", 700: "/fonts/inter-700.woff2" },
  "Plus Jakarta Sans": {
    400: "/fonts/plus-jakarta-sans-400.woff2",
    600: "/fonts/plus-jakarta-sans-600.woff2",
    700: "/fonts/plus-jakarta-sans-700.woff2",
  },
};

/** Weight per peran: heading dipakai 600/700, body 400/600 — subset seketat
 * mungkin supaya chain font (yang menahan LCP teks) tetap ringan. Family yang
 * dipakai dua peran memuat gabungan weight-nya. */
const HEADING_WEIGHTS = [600, 700];
const BODY_WEIGHTS = [400, 600];

export interface SelfHostedFontPlan {
  /** Kumpulan rule @font-face (display=swap) untuk di-inline ke <style>. */
  css: string;
  /** Path woff2 yang layak di-preload (weight teratas font heading — kandidat LCP). */
  preload: string[];
}

/**
 * Rencana font self-host bila SEMUA family non-generik theme ada di registry;
 * selain itu null → fallback Google Fonts.
 */
export function selfHostedFontPlan(theme: unknown): SelfHostedFontPlan | null {
  const parsed = tenantThemeSchema.safeParse(theme);
  if (!parsed.success) return null;

  const wanted: { family: string; weights: number[]; role: "heading" | "body" }[] = [];
  for (const [family, weights, role] of [
    [parsed.data.fontHeading, HEADING_WEIGHTS, "heading"],
    [parsed.data.fontBody, BODY_WEIGHTS, "body"],
  ] as const) {
    if (!family || !FONT_NAME_RE.test(family) || GENERIC_FONTS.has(family.toLowerCase())) continue;
    wanted.push({ family, weights: [...weights], role });
  }
  if (wanted.length === 0) return null;

  const faces = new Map<string, string>(); // key family|weight → rule
  const preload = new Set<string>();
  for (const { family, weights, role } of wanted) {
    const files = SELF_HOSTED_FONTS[family];
    if (!files) return null; // ada family di luar registry → serahkan ke Google
    for (const weight of weights) {
      const path = files[weight];
      if (!path) return null;
      faces.set(
        `${family}|${weight}`,
        `@font-face{font-family:"${family}";font-style:normal;font-weight:${weight};font-display:swap;src:url(${path}) format("woff2")}`,
      );
    }
    if (role === "heading") preload.add(files[Math.max(...weights)]!);
  }
  return { css: [...faces.values()].join("\n"), preload: [...preload] };
}

/** Kumpulkan family Google Fonts yang benar-benar dipakai theme (unik, tersortir). */
export function collectGoogleFontFamilies(theme: unknown): string[] {
  const parsed = tenantThemeSchema.safeParse(theme);
  if (!parsed.success) return [];
  const families = [parsed.data.fontHeading, parsed.data.fontBody]
    .filter((f): f is string => typeof f === "string")
    .filter((f) => FONT_NAME_RE.test(f))
    .filter((f) => !GENERIC_FONTS.has(f.toLowerCase()));
  return [...new Set(families)].sort();
}

/**
 * URL stylesheet Google Fonts untuk font yang dipakai tenant saja
 * (subset weight per peran, display=swap). Null bila semua font sistem.
 */
export function googleFontsHref(theme: unknown): string | null {
  const parsed = tenantThemeSchema.safeParse(theme);
  if (!parsed.success) return null;
  const weightsByFamily = new Map<string, Set<number>>();
  const add = (family: string | undefined, weights: number[]) => {
    if (!family || !FONT_NAME_RE.test(family) || GENERIC_FONTS.has(family.toLowerCase())) return;
    const set = weightsByFamily.get(family) ?? new Set<number>();
    for (const w of weights) set.add(w);
    weightsByFamily.set(family, set);
  };
  add(parsed.data.fontHeading, HEADING_WEIGHTS);
  add(parsed.data.fontBody, BODY_WEIGHTS);
  if (weightsByFamily.size === 0) return null;

  const query = [...weightsByFamily.keys()]
    .sort()
    .map((f) => {
      const weights = [...weightsByFamily.get(f)!].sort((a, b) => a - b).join(";");
      return `family=${f.replace(/ /g, "+")}:wght@${weights}`;
    })
    .join("&");
  return `https://fonts.googleapis.com/css2?${query}&display=swap`;
}
