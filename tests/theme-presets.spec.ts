/**
 * Preset tampilan — konsistensi tiga tempat yang harus selalu sejalan:
 * nama di schema shared, definisi palet di theme-presets.ts, dan kelas
 * `.mi-preset-<nama>` di main.css. Preset yang punya nama tapi tidak punya
 * kelas CSS akan tersimpan rapi di themeJson dan tidak berefek apa pun —
 * persis jenis kegagalan senyap yang lolos typecheck & test HTML.
 */
import { describe, expect, it } from "vitest";
import { themePresetSchema, tenantThemeSchema } from "@marketplaceindo/shared";
import css from "../app/assets/css/main.css?raw";
import {
  applyThemePreset,
  THEME_PRESETS,
  THEME_PRESET_ORDER,
} from "../shared/utils/theme-presets";

const NAMA = themePresetSchema.options;

describe("konsistensi preset", () => {
  it("setiap nama di schema shared punya definisi palet", () => {
    for (const nama of NAMA) {
      expect(THEME_PRESETS[nama], `preset "${nama}" tanpa definisi`).toBeDefined();
      expect(THEME_PRESETS[nama].label.length).toBeGreaterThan(0);
    }
  });

  it("setiap nama punya kelas .mi-preset-* di main.css", () => {
    for (const nama of NAMA) {
      expect(css, `kelas .mi-preset-${nama} hilang`).toContain(`.mi-preset-${nama}`);
    }
  });

  it("urutan galeri memuat seluruh preset tanpa duplikat", () => {
    expect([...THEME_PRESET_ORDER].sort()).toEqual([...NAMA].sort());
  });

  it("setiap palet lolos schema tema (hex & enum valid)", () => {
    for (const nama of NAMA) {
      const hasil = tenantThemeSchema.safeParse(THEME_PRESETS[nama].palette);
      expect(hasil.success, `palet "${nama}" tidak valid`).toBe(true);
    }
  });

  it("gaya kartu tiap preset punya kelas .mi-card-* padanannya", () => {
    for (const nama of NAMA) {
      const gaya = THEME_PRESETS[nama].palette.cardStyle;
      if (gaya) expect(css).toContain(`.mi-card-${gaya}`);
    }
  });
});

describe("applyThemePreset", () => {
  it("menulis palet sebagai hex konkret + mencatat nama presetnya", () => {
    const hasil = applyThemePreset({}, "dark");
    expect(hasil.preset).toBe("dark");
    expect(hasil.backgroundColor).toBe("#0b1120");
    expect(tenantThemeSchema.safeParse(hasil).success).toBe(true);
  });

  it("field di luar palet dipertahankan (logo tidak hilang saat ganti gaya)", () => {
    const logoMediaId = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
    expect(applyThemePreset({ logoMediaId }, "bold").logoMediaId).toBe(logoMediaId);
  });

  it("ganti preset menimpa warna preset sebelumnya, tidak menumpuk", () => {
    const soft = applyThemePreset({}, "soft");
    const bold = applyThemePreset(soft, "bold");
    expect(bold.primaryColor).toBe(THEME_PRESETS.bold.palette.primaryColor);
    expect(bold.preset).toBe("bold");
  });
});
