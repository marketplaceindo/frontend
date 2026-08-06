/**
 * Fase 2 — konversi theme/style JSON → CSS vars (cascade + guard injection).
 */
import { describe, expect, it } from "vitest";
import {
  collectGoogleFontFamilies,
  googleFontsHref,
  sectionStyleToCss,
  selfHostedFontPlan,
  pickOnColor,
  themeClasses,
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
    // --color-on-primary ikut muncul karena primaryColor terisi: warnanya
    // diturunkan dari sana, bukan field terpisah yang dikosongkan tenant.
    expect(themeToVars({ primaryColor: "#123456" })).toEqual({
      "--color-primary": "#123456",
      "--color-on-primary": "#ffffff",
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

  it("href Google Fonts memuat subset weight per peran + display=swap", () => {
    expect(googleFontsHref({ fontHeading: "Plus Jakarta Sans", fontBody: "Inter" })).toBe(
      "https://fonts.googleapis.com/css2?family=Inter:wght@400;600&family=Plus+Jakarta+Sans:wght@600;700&display=swap",
    );
    // Family sama untuk dua peran → gabungan weight, satu entri family.
    expect(googleFontsHref({ fontHeading: "Poppins", fontBody: "Poppins" })).toBe(
      "https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap",
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

describe("font self-host (registry curated)", () => {
  it("family curated → @font-face lokal + preload woff2 heading weight teratas", () => {
    const plan = selfHostedFontPlan({ fontHeading: "Poppins", fontBody: "Inter" });
    expect(plan).not.toBeNull();
    expect(plan!.css).toContain('font-family:"Poppins"');
    expect(plan!.css).toContain("/fonts/poppins-700.woff2");
    expect(plan!.css).toContain("/fonts/inter-400.woff2");
    expect(plan!.css).toContain("font-display:swap");
    expect(plan!.preload).toEqual(["/fonts/poppins-700.woff2"]);
  });

  it("ada family di luar registry → null (fallback Google Fonts)", () => {
    expect(selfHostedFontPlan({ fontHeading: "Roboto Slab", fontBody: "Inter" })).toBeNull();
    expect(googleFontsHref({ fontHeading: "Roboto Slab", fontBody: "Inter" })).toContain(
      "Roboto+Slab",
    );
  });

  it("semua font sistem → null tanpa preload", () => {
    expect(selfHostedFontPlan({})).toBeNull();
    expect(selfHostedFontPlan({ fontBody: "system-ui" })).toBeNull();
  });
});

describe("kontras teks di atas warna utama (pickOnColor)", () => {
  /*
   * Regresi yang dijaga: tombol CTA dulu selalu `text-white`. Tenant yang
   * memilih warna utama pucat mendapat tombol putih-di-atas-terang yang ada di
   * DOM, lolos seluruh test berbasis HTML, dan tidak terbaca di layar — persis
   * pola bug §4.1 di REPORT-FRONTEND.
   */
  it("warna utama gelap → teks putih", () => {
    expect(pickOnColor("#1d4ed8")).toBe("#ffffff");
    expect(pickOnColor("#0b1120")).toBe("#ffffff");
    expect(pickOnColor("#000")).toBe("#ffffff");
  });

  it("warna utama terang → teks gelap", () => {
    expect(pickOnColor("#facc15")).toBe("#111827");
    expect(pickOnColor("#a3e635")).toBe("#111827");
    expect(pickOnColor("#ffffff")).toBe("#111827");
  });

  it("hex tak terbaca → putih (aman: pasangan token seed --color-primary)", () => {
    expect(pickOnColor("bukan-hex")).toBe("#ffffff");
  });

  it("onPrimaryColor pilihan tenant menang atas hasil hitung", () => {
    const vars = themeToVars({ primaryColor: "#facc15", onPrimaryColor: "#7c2d12" });
    expect(vars["--color-on-primary"]).toBe("#7c2d12");
  });
});

describe("themeClasses (lapisan bentuk)", () => {
  it("preset & gaya kartu jadi kelas, kerapatan selalu ada", () => {
    expect(themeClasses({ preset: "soft", cardStyle: "elevated", density: "roomy" })).toEqual([
      "mi-preset-soft",
      "mi-card-elevated",
      "mi-density-roomy",
    ]);
  });

  it("tanpa preset → hanya kerapatan default (tenant lama tidak berubah tampilan)", () => {
    expect(themeClasses({ primaryColor: "#123456" })).toEqual(["mi-density-normal"]);
  });

  it("theme invalid → tetap mengembalikan kerapatan, bukan kelas kosong", () => {
    expect(themeClasses(null)).toEqual(["mi-density-normal"]);
  });
});
