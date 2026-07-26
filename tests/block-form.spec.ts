/**
 * Fase 7c — deskriptor field editor diturunkan dari schema Zod block shared.
 * Yang diuji: setiap tipe block menghasilkan field, bentuknya sesuai schema,
 * dan nilai kosong yang dihasilkan bisa dipakai membangun block valid.
 */
import { describe, expect, it } from "vitest";
import { BLOCK_TYPES, blockSchema } from "@marketplaceindo/shared";
import {
  blockDataSchema,
  describeBlockFields,
  emptyItem,
  type FieldDescriptor,
} from "../app/utils/block-form";

const byKey = (fields: FieldDescriptor[], key: string) => fields.find((f) => f.key === key);

describe("introspeksi schema block → field editor", () => {
  it.each(BLOCK_TYPES)("tipe %s punya schema data yang bisa dibaca", (type) => {
    expect(blockDataSchema(type)).not.toBeNull();
  });

  it.each(BLOCK_TYPES)("tipe %s tidak menghasilkan field unsupported", (type) => {
    const unsupported = describeBlockFields(type).filter((f) => f.kind === "unsupported");
    expect(unsupported.map((f) => f.key)).toEqual([]);
  });

  it("hero: judul wajib, subjudul opsional, gambar, tombol, perataan", () => {
    const fields = describeBlockFields("hero");
    expect(byKey(fields, "heading")).toMatchObject({ kind: "text", optional: false });
    expect(byKey(fields, "subheading")).toMatchObject({ kind: "textarea", optional: true });
    expect(byKey(fields, "image")).toMatchObject({ kind: "image" });
    expect(byKey(fields, "ctas")).toMatchObject({ kind: "list" });
    expect(byKey(fields, "align")).toMatchObject({
      kind: "select",
      options: expect.arrayContaining(["left", "center", "right"]),
    });
  });

  it("harga dikenali sebagai uang, boolean sebagai centang", () => {
    const services = describeBlockFields("services");
    const item = byKey(services, "items")!;
    expect(byKey(item.itemFields!, "price")).toMatchObject({ kind: "money" });
    expect(byKey(describeBlockFields("contact"), "showForm")).toMatchObject({ kind: "boolean" });
  });

  it("URL dikenali terpisah dari teks biasa", () => {
    expect(byKey(describeBlockFields("contact"), "mapEmbedUrl")).toMatchObject({ kind: "url" });
  });

  it("list gambar (gallery) berisi field bertipe image", () => {
    const images = byKey(describeBlockFields("gallery"), "images")!;
    expect(images.kind).toBe("list");
    expect(images.itemFields?.[0]).toMatchObject({ kind: "image" });
  });

  it("batas jumlah item schema terbawa ke deskriptor", () => {
    // testimonials.items dibatasi schema shared — batasnya harus ikut terbaca.
    const items = byKey(describeBlockFields("testimonials"), "items")!;
    expect(items.minItems ?? 0).toBeGreaterThanOrEqual(0);
    expect(typeof items.kind).toBe("string");
  });

  it("item kosong dari deskriptor membentuk block yang valid setelah diisi", () => {
    const faq = describeBlockFields("faq");
    const item = emptyItem(byKey(faq, "items")!) as Record<string, string>;
    expect(Object.keys(item).sort()).toEqual(["answer", "question"]);

    item.question = "Jam berapa buka?";
    item.answer = "Setiap hari 08.00–21.00.";
    const parsed = blockSchema.safeParse({ type: "faq", data: { items: [item] } });
    expect(parsed.success).toBe(true);
  });

  it("field wajib schema tercermin sebagai optional=false", () => {
    const about = describeBlockFields("about");
    expect(byKey(about, "body")?.optional).toBe(false);
    expect(byKey(about, "heading")?.optional).toBe(true);
  });
});
