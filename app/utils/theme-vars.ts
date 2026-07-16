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
 * (subset weight 400/600/700, display=swap). Null bila semua font sistem.
 */
export function googleFontsHref(theme: unknown): string | null {
  const families = collectGoogleFontFamilies(theme);
  if (families.length === 0) return null;
  const query = families
    .map((f) => `family=${f.replace(/ /g, "+")}:wght@400;600;700`)
    .join("&");
  return `https://fonts.googleapis.com/css2?${query}&display=swap`;
}
