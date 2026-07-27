/**
 * Penjaga regresi palet UI dashboard.
 *
 * `main.css` sengaja mereset SELURUH palet bawaan Tailwind (`--color-*: initial`)
 * supaya situs tenant hanya bisa memakai token theme. Efek sampingnya berbahaya
 * dan senyap: utility seperti `bg-teal-600` tidak menghasilkan CSS apa pun, jadi
 * tombol `bg-teal-600 text-white` tampil PUTIH DI ATAS PUTIH — ada di DOM,
 * lolos semua test berbasis HTML, tapi tidak terlihat user.
 *
 * Test ini gagal begitu ada komponen memakai shade warna yang belum didaftarkan
 * di `@theme`. Sumber file dibaca lewat `import.meta.glob` (Vite) sehingga tidak
 * perlu `node:fs` maupun @types/node.
 */
import { describe, expect, it } from "vitest";
import css from "../app/assets/css/main.css?raw";

/** Utility warna Tailwind berskala angka, mis. `bg-teal-600`, `text-slate-500`. */
const COLOR_UTILITY =
  /\b(?:bg|text|border|ring|divide|accent|placeholder|from|via|to|outline|shadow|caret|fill|stroke)-([a-z]+-\d{2,3})\b/g;

const sources = import.meta.glob("../app/**/*.{vue,ts}", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const definedShades = new Set(
  [...css.matchAll(/--color-([a-z]+-\d{2,3})\s*:/g)].map((m) => m[1]!),
);

/** Shade yang dipakai komponen → daftar file yang memakainya. */
const usage = new Map<string, Set<string>>();
for (const [path, content] of Object.entries(sources)) {
  const file = path.replace("../app/", "");
  for (const match of content.matchAll(COLOR_UTILITY)) {
    const shade = match[1]!;
    if (!usage.has(shade)) usage.set(shade, new Set());
    usage.get(shade)!.add(file);
  }
}

describe("palet warna UI dashboard", () => {
  it("mereset palet bawaan Tailwind (situs tenant wajib pakai token theme)", () => {
    expect(css).toContain("--color-*: initial");
  });

  it("memindai sumber komponen (guard tidak diam-diam kosong)", () => {
    expect(Object.keys(sources).length).toBeGreaterThan(20);
    expect(usage.size).toBeGreaterThan(10);
  });

  it("setiap shade warna yang dipakai komponen terdefinisi di @theme", () => {
    const missing = [...usage.entries()]
      .filter(([shade]) => !definedShades.has(shade))
      .map(([shade, files]) => `${shade} (dipakai: ${[...files].sort().join(", ")})`);

    expect(
      missing,
      `Shade berikut dipakai tapi tidak ada di @theme main.css, sehingga utility-nya
tidak menghasilkan CSS dan elemennya tampil tanpa warna (mis. tombol putih di
atas putih). Tambahkan --color-<shade> di blok "Palet UI dashboard":\n  ${missing.join("\n  ")}`,
    ).toEqual([]);
  });

  it("tidak ada shade terdaftar yang sudah tak terpakai (jaga CSS tetap ramping)", () => {
    const unused = [...definedShades].filter((shade) => !usage.has(shade));
    expect(unused, `Shade tak terpakai di @theme: ${unused.join(", ")}`).toEqual([]);
  });

  it("komponen situs tenant TIDAK memakai warna palet (harus lewat token theme)", () => {
    const tenantSurfaces = [...usage.entries()].flatMap(([shade, files]) =>
      [...files]
        .filter((f) => f.startsWith("components/blocks/") || f.startsWith("layouts/"))
        .map((f) => `${f}: ${shade}`),
    );
    expect(
      tenantSurfaces,
      `Block/layout situs tenant harus memakai token theme (bg-primary, text-text, …)
supaya ikut cascade theme_json tenant, bukan warna palet tetap:\n  ${tenantSurfaces.join("\n  ")}`,
    ).toEqual([]);
  });
});
