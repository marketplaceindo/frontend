/**
 * Mode pratinjau harus menempel saat berpindah halaman.
 *
 * Bug yang ditangkap: dari beranda `?preview=1`, kartu mobil menaut ke
 * `/mobil/m6` tanpa membawa `preview=1`. Situs `draft` hanya bisa diakses
 * dengan flag itu, jadi user yang mengklik kartunya sendiri mendarat di
 * "404 — Situs tidak ditemukan", persis saat ia sedang memeriksa situsnya.
 */
import { describe, expect, it } from "vitest";
import { withPreview } from "../app/utils/tenant-link";

describe("withPreview", () => {
  it("menambahkan preview=1 pada tautan internal saat pratinjau", () => {
    expect(withPreview("/mobil/m6", true)).toBe("/mobil/m6?preview=1");
    expect(withPreview("/", true)).toBe("/?preview=1");
  });

  it("tidak mengubah apa pun saat bukan pratinjau", () => {
    expect(withPreview("/mobil/m6", false)).toBe("/mobil/m6");
  });

  it("mempertahankan query yang sudah ada", () => {
    const hasil = withPreview("/mobil?body=suv", true);
    expect(hasil.startsWith("/mobil?")).toBe(true);
    expect(hasil).toContain("body=suv");
    expect(hasil).toContain("preview=1");
  });

  it("tidak menggandakan preview yang sudah ada", () => {
    expect(withPreview("/mobil?preview=1", true)).toBe("/mobil?preview=1");
  });

  it("membiarkan tautan eksternal apa adanya", () => {
    // Menempeli query di deep link WhatsApp akan merusak pesan ter-prefill.
    for (const href of [
      "https://wa.me/628123?text=halo",
      "mailto:sales@dealer.test",
      "tel:+628123",
    ]) {
      expect(withPreview(href, true)).toBe(href);
    }
  });

  it("membiarkan anchor dalam halaman apa adanya", () => {
    expect(withPreview("#simulasi-kredit", true)).toBe("#simulasi-kredit");
  });
});
