/**
 * Fase 2 — konversi theme/style JSON → CSS vars (cascade + guard injection).
 */
import { describe, expect, it } from "vitest";
import {
  collectGoogleFontFamilies,
  googleFontsHref,
  sectionStyleToCss,
  themeToVars,
} from "../app/utils/theme-vars";

describe("themeToVars (Level 2)", () => {
  it("memetakan semua field theme ke token CSS", () => {
    const vars = themeToVars({
      primaryColor: "#c2410c",
      secondaryColor: "#475569",
      accentColor: "#f59e0b",
      backgroundColor: "#fff7ed",
      textColor: "#1c1917",
      fontHeading: "Poppins",
      fontBody: "Inter",
      radius: "md",
    });
    expect(vars["--color-primary"]).toBe("#c2410c");
    expect(vars["--color-bg"]).toBe("#fff7ed");
    expect(vars["--color-text"]).toBe("#1c1917");
    expect(vars["--font-heading"]).toContain('"Poppins"');
    expect(vars["--font-body"]).toContain('"Inter"');
    expect(vars["--radius-theme"]).toBe("0.5rem");
  });

  it("field kosong tidak menghasilkan var (fallback ke Level 1)", () => {
    expect(themeToVars({ primaryColor: "#123456" })).toEqual({
      "--color-primary": "#123456",
    });
    expect(themeToVars({})).toEqual({});
  });

  it("theme invalid (hex rusak / bukan objek) → {} — tidak ada injection ke CSS", () => {
    expect(themeToVars({ primaryColor: "red; } body { display:none" })).toEqual({});
    expect(themeToVars({ primaryColor: "#12345g" })).toEqual({});
    expect(themeToVars(null)).toEqual({});
    expect(themeToVars("bukan objek")).toEqual({});
  });

  it("nama font berkarakter ilegal dibuang, field lain tetap dipakai", () => {
    const vars = themeToVars({
      primaryColor: "#000000",
      fontHeading: 'Poppins"); } @import url(evil',
    });
    expect(vars["--color-primary"]).toBe("#000000");
    expect(vars["--font-heading"]).toBeUndefined();
  });

  it("font generik dipakai apa adanya tanpa kutip", () => {
    expect(themeToVars({ fontBody: "system-ui" })["--font-body"]).toBe("system-ui");
  });
});

describe("sectionStyleToCss (Level 3)", () => {
  it("memetakan override section ke var yang sama → menang atas Level 2", () => {
    const vars = sectionStyleToCss({
      backgroundColor: "#1c1917",
      textColor: "#fef3c7",
      align: "center",
      paddingY: "lg",
      fontFamily: "Lora",
    });
    expect(vars["--color-bg"]).toBe("#1c1917");
    expect(vars["--color-text"]).toBe("#fef3c7");
    expect(vars["--section-align"]).toBe("center");
    expect(vars["--section-py"]).toBe("var(--section-py-lg)");
    expect(vars["--font-body"]).toContain('"Lora"');
  });

  it("styleJson kosong → {} (mewarisi theme)", () => {
    expect(sectionStyleToCss({})).toEqual({});
  });

  it("style invalid → {} — tidak ada injection", () => {
    expect(sectionStyleToCss({ backgroundColor: "url(javascript:x)" })).toEqual({});
    expect(sectionStyleToCss({ align: "justify" })).toEqual({});
  });
});

describe("font loading dinamis", () => {
  it("hanya font non-generik yang dikumpulkan, unik & tersortir", () => {
    expect(
      collectGoogleFontFamilies({ fontHeading: "Poppins", fontBody: "Inter" }),
    ).toEqual(["Inter", "Poppins"]);
    expect(
      collectGoogleFontFamilies({ fontHeading: "Poppins", fontBody: "Poppins" }),
    ).toEqual(["Poppins"]);
    expect(
      collectGoogleFontFamilies({ fontHeading: "system-ui", fontBody: "sans-serif" }),
    ).toEqual([]);
  });

  it("href Google Fonts memuat subset weight + display=swap", () => {
    expect(googleFontsHref({ fontHeading: "Plus Jakarta Sans", fontBody: "Inter" })).toBe(
      "https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Plus+Jakarta+Sans:wght@400;600;700&display=swap",
    );
  });

  it("semua font sistem → null (tidak ada request font)", () => {
    expect(googleFontsHref({})).toBeNull();
    expect(googleFontsHref({ fontBody: "system-ui" })).toBeNull();
  });

  it("nama font berbahaya tidak pernah masuk URL", () => {
    expect(googleFontsHref({ fontBody: "Inter&family=Evil@../../x" })).toBeNull();
  });
});
