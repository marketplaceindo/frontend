/**
 * Penjaga regresi hidrasi SSR.
 *
 * Dua pola di bawah menghasilkan "Hydration completed but contains mismatches"
 * yang senyap: HTML tetap 200, test berbasis HTML tetap lolos, tapi di browser
 * Vue membuang hasil SSR dan — di dev — bisa berujung layar error.
 *
 * Keduanya pernah benar-benar terjadi di repo ini, karena itu dikunci test.
 */
import { describe, expect, it } from "vitest";

const sources = import.meta.glob("../app/**/*.vue", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

/** Buang komentar supaya penjelasan "jangan pakai X" tidak ikut tertangkap. */
function tanpaKomentar(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const files = Object.entries(sources).map(([path, content]) => ({
  file: path.replace("../app/", ""),
  content: tanpaKomentar(content),
}));

/** Isi blok `computed(...)` — dipakai mencari kode non-deterministik di render. */
function computedBodies(content: string): string[] {
  const bodies: string[] = [];
  const re = /computed\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content))) {
    let depth = 0;
    for (let i = m.index + m[0].length - 1; i < content.length; i++) {
      const ch = content[i];
      if (ch === "(") depth++;
      else if (ch === ")") {
        depth--;
        if (depth === 0) {
          bodies.push(content.slice(m.index, i + 1));
          break;
        }
      }
    }
  }
  return bodies;
}

describe("keamanan hidrasi SSR", () => {
  it("memindai komponen (guard tidak diam-diam kosong)", () => {
    expect(files.length).toBeGreaterThan(30);
  });

  it('tidak ada <Teleport to="body">', () => {
    // Nuxt menyerialkan isi teleport SSR ke <div id="teleports">, sedangkan di
    // klien `to="body"` menunjuk document.body → anchor tidak ketemu.
    // Elemen `position: fixed` tidak perlu jadi anak <body>.
    const offenders = files
      .filter(({ content }) => /<Teleport[^>]*to=["']body["']/.test(content))
      .map(({ file }) => file);
    expect(
      offenders,
      `Teleport ke "body" merusak hidrasi. Render di tempat saja (position: fixed
sudah cukup), atau teleport ke "#teleports":\n  ${offenders.join("\n  ")}`,
    ).toEqual([]);
  });

  it("tidak ada new Date() di dalam computed (zona waktu server ≠ klien)", () => {
    // `new Date()` saat render menghasilkan nilai berbeda antara server dan
    // perangkat user (zona waktu/jam), mis. atribut `min` input tanggal.
    // Hitung setelah mount, atau kirim nilainya dari server.
    const offenders = files
      .filter(({ content }) => computedBodies(content).some((b) => /new Date\s*\(\s*\)/.test(b)))
      .map(({ file }) => file);
    expect(
      offenders,
      `new Date() di dalam computed dievaluasi di server DAN di klien dengan hasil
berbeda. Pindahkan ke onMounted:\n  ${offenders.join("\n  ")}`,
    ).toEqual([]);
  });

  it("Math.random() tidak dipakai saat render", () => {
    const offenders = files
      .filter(({ content }) => /Math\.random\s*\(/.test(content))
      .map(({ file }) => file);
    expect(offenders, `Math.random() saat render selalu meleset di hidrasi`).toEqual([]);
  });
});
