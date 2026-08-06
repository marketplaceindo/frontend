/**
 * Nilai desain tiap preset tampilan (shared 1.2.0 `theme.preset`).
 *
 * Repo shared sengaja hanya menyimpan NAMA preset; nilainya hidup di sini
 * supaya shared tetap murni schema. Pembagian kerjanya:
 *
 * - Lapisan BENTUK (bayangan, tebal garis, radius, bobot judul) ada di CSS
 *   sebagai kelas `.mi-preset-<nama>` — lihat app/assets/css/main.css.
 * - Lapisan WARNA & FONT ada di `palette` berikut. Saat tenant memilih preset
 *   di dashboard, palette ini DITULIS ke themeJson sebagai hex konkret, bukan
 *   dirujuk saat render. Konsekuensinya dua-duanya kita mau:
 *     1. render tidak pernah ambigu — situs hanya membaca hex yang tersimpan;
 *     2. tenant tetap bisa menimpa satu-satu warnanya setelah memilih preset,
 *        tanpa kehilangan lapisan bentuk yang menempel di nama preset.
 *
 * Menambah preset = tambah nama di shared (bump minor) + entri di sini + kelas
 * `.mi-preset-<nama>` di main.css. Ketiganya wajib, dijaga preset.spec.ts.
 */
import type { TenantTheme, ThemePreset } from "@marketplaceindo/shared";

export interface ThemePresetDef {
  /** Label di dashboard — bahasa Indonesia, schema tetap berbahasa Inggris. */
  label: string;
  /** Satu kalimat: untuk siapa preset ini, bukan deskripsi visualnya. */
  description: string;
  /** Ditulis ke themeJson saat dipilih; tenant bebas menimpanya sesudahnya. */
  palette: Partial<TenantTheme>;
}

export const THEME_PRESETS: Record<ThemePreset, ThemePresetDef> = {
  clean: {
    label: "Bersih",
    description: "Rapi dan netral. Aman untuk dealer resmi yang mengikuti panduan merk.",
    palette: {
      primaryColor: "#1d4ed8",
      secondaryColor: "#334155",
      accentColor: "#f59e0b",
      backgroundColor: "#ffffff",
      textColor: "#0f172a",
      fontHeading: "Inter",
      fontBody: "Inter",
      radius: "sm",
      cardStyle: "outlined",
      density: "normal",
    },
  },
  soft: {
    label: "Lembut",
    description: "Ramah dan modern. Pilihan aman kalau belum yakin mau ke arah mana.",
    palette: {
      primaryColor: "#0d9488",
      secondaryColor: "#334155",
      accentColor: "#f59e0b",
      backgroundColor: "#f8fafc",
      textColor: "#0f172a",
      fontHeading: "Plus Jakarta Sans",
      fontBody: "Inter",
      radius: "lg",
      cardStyle: "soft",
      density: "normal",
    },
  },
  bold: {
    label: "Tegas",
    description: "Kontras tinggi dan mencolok. Cocok untuk jualan lewat promo dan diskon.",
    palette: {
      primaryColor: "#dc2626",
      secondaryColor: "#111827",
      accentColor: "#facc15",
      backgroundColor: "#ffffff",
      textColor: "#0a0a0a",
      fontHeading: "Poppins",
      fontBody: "Inter",
      radius: "sm",
      cardStyle: "outlined",
      density: "compact",
    },
  },
  elegant: {
    label: "Elegan",
    description: "Tenang dan lapang. Untuk merk premium dan mobil bekas kelas atas.",
    palette: {
      primaryColor: "#1e3a5f",
      secondaryColor: "#57534e",
      accentColor: "#b08d57",
      backgroundColor: "#fbfaf8",
      textColor: "#1c1917",
      // Di luar registry self-host → dimuat dari Google Fonts (non-blocking).
      // Serif di judul yang membuat preset ini terbaca "premium".
      fontHeading: "Playfair Display",
      fontBody: "Inter",
      radius: "sm",
      cardStyle: "flat",
      density: "roomy",
    },
  },
  dark: {
    label: "Gelap",
    description: "Latar gelap dengan aksen terang. Kuat untuk mobil listrik dan performa.",
    palette: {
      primaryColor: "#22d3ee",
      secondaryColor: "#94a3b8",
      accentColor: "#a3e635",
      backgroundColor: "#0b1120",
      textColor: "#e2e8f0",
      fontHeading: "Plus Jakarta Sans",
      fontBody: "Inter",
      radius: "md",
      cardStyle: "elevated",
      density: "normal",
    },
  },
};

/** Urutan tampil di galeri dashboard & wizard (paling aman lebih dulu). */
export const THEME_PRESET_ORDER: ThemePreset[] = [
  "soft",
  "clean",
  "bold",
  "elegant",
  "dark",
];

/**
 * Terapkan preset ke draft tema: palette menimpa warna/font, sisanya (mis.
 * logoMediaId) dipertahankan. Dipakai dashboard & wizard.
 */
export function applyThemePreset(current: TenantTheme, preset: ThemePreset): TenantTheme {
  return { ...current, ...THEME_PRESETS[preset].palette, preset };
}
