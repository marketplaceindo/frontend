/**
 * Deskriptor field editor yang **diturunkan dari schema Zod block** shared
 * (PLAN-FRONTEND §7c.2) — bukan daftar field yang ditulis ulang per block.
 * Konsekuensinya: menambah field di repo shared langsung memunculkan input
 * baru di editor tanpa perubahan di sini, dan tidak ada bentuk data yang
 * didefinisikan ulang di repo ini.
 *
 * Cakupan sengaja terbatas pada bentuk yang benar-benar dipakai `blockSchema`:
 * string, angka, boolean, enum, referensi gambar, dan array (objek/string).
 * Bentuk di luar itu ditandai `unsupported` supaya editor menampilkannya
 * sebagai read-only, bukan diam-diam menghilangkan data.
 */
import { z } from "zod";
import { blockSchema, type BlockType } from "@marketplaceindo/shared";

export type FieldKind =
  | "text"
  | "textarea"
  | "url"
  | "number"
  | "money"
  | "boolean"
  | "select"
  | "image"
  | "list"
  | "unsupported";

export interface FieldDescriptor {
  key: string;
  label: string;
  kind: FieldKind;
  optional: boolean;
  /** Pilihan untuk `select`. */
  options?: string[];
  /** Bentuk item untuk `list`; kosong bila item berupa string biasa. */
  itemFields?: FieldDescriptor[];
  minItems?: number;
  maxItems?: number;
}

/** Label Bahasa Indonesia untuk key yang sering muncul di schema block. */
const LABELS: Record<string, string> = {
  heading: "Judul",
  subheading: "Subjudul",
  body: "Isi teks",
  text: "Teks",
  description: "Deskripsi",
  title: "Judul",
  name: "Nama",
  label: "Label",
  href: "Tautan",
  url: "URL",
  price: "Harga",
  image: "Gambar",
  images: "Gambar",
  logos: "Logo",
  photo: "Foto",
  avatar: "Foto",
  items: "Daftar",
  groups: "Grup",
  links: "Tautan",
  socials: "Media sosial",
  ctas: "Tombol",
  cta: "Tombol",
  align: "Perataan",
  sticky: "Menempel di atas",
  whatsapp: "Nomor WhatsApp",
  defaultMessage: "Pesan otomatis",
  position: "Posisi",
  address: "Alamat",
  email: "Email",
  mapEmbedUrl: "URL peta Google",
  showForm: "Tampilkan formulir",
  hours: "Jam buka",
  days: "Hari",
  open: "Buka",
  close: "Tutup",
  question: "Pertanyaan",
  answer: "Jawaban",
  quote: "Testimoni",
  role: "Jabatan",
  rating: "Rating",
  value: "Angka",
  steps: "Langkah",
  members: "Anggota",
  categories: "Kategori",
  category: "Kategori",
  limit: "Jumlah tampil",
  sort: "Urutan",
  brand: "Merek",
  until: "Berlaku sampai",
  platform: "Platform",
  icon: "Ikon",
  alt: "Teks alternatif",
  mediaId: "ID media",
  vehicleSlugs: "Slug unit",
  vehicleSlug: "Slug unit",
  sales: "Sales",
  bungaDefault: "Bunga default (%)",
  tenorOptions: "Pilihan tenor (bulan)",
  metodeDefault: "Metode default",
  dpMin: "DP minimum (rasio)",
};

/** Field yang lebih enak diisi lewat textarea daripada input satu baris. */
const MULTILINE = new Set(["body", "description", "answer", "quote", "text", "subheading"]);

function humanize(key: string): string {
  return (
    LABELS[key] ??
    key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase())
  );
}

type AnySchema = z.ZodType & { def: Record<string, unknown> };

/** Buang pembungkus optional/default/nullable sampai ke tipe intinya. */
function unwrap(schema: z.ZodType): { inner: AnySchema; optional: boolean } {
  let current = schema as AnySchema;
  let optional = false;
  for (let i = 0; i < 10; i++) {
    const type = current.def.type as string;
    if (type === "optional" || type === "nullable" || type === "default" || type === "prefault") {
      optional = true;
      current = current.def.innerType as AnySchema;
      continue;
    }
    break;
  }
  return { inner: current, optional };
}

const shapeOf = (schema: AnySchema): Record<string, z.ZodType> =>
  (schema.def.shape ?? {}) as Record<string, z.ZodType>;

/** Objek `{ mediaId?, url?, alt? }` = referensi gambar shared. */
function isImageRef(schema: AnySchema): boolean {
  if (schema.def.type !== "object") return false;
  const keys = Object.keys(shapeOf(schema));
  return keys.includes("mediaId") && keys.includes("url") && keys.length <= 3;
}

function describeField(key: string, schema: z.ZodType): FieldDescriptor {
  const { inner, optional } = unwrap(schema);
  const type = inner.def.type as string;
  const base = { key, label: humanize(key), optional };

  if (isImageRef(inner)) return { ...base, kind: "image" };

  switch (type) {
    case "string": {
      const format = inner.def.format as string | undefined;
      if (format === "url") return { ...base, kind: "url" };
      return { ...base, kind: MULTILINE.has(key) ? "textarea" : "text" };
    }
    case "number":
    case "int":
      return { ...base, kind: key === "price" ? "money" : "number" };
    case "boolean":
      return { ...base, kind: "boolean" };
    case "enum":
      return { ...base, kind: "select", options: Object.values(inner.def.entries as object) as string[] };
    case "array": {
      const item = unwrap(inner.def.element as z.ZodType).inner;
      const checks = (inner.def.checks ?? []) as { _zod?: { def?: { minimum?: number; maximum?: number } } }[];
      const bounds: { minItems?: number; maxItems?: number } = {};
      for (const check of checks) {
        const def = check._zod?.def;
        if (def?.minimum !== undefined) bounds.minItems = def.minimum;
        if (def?.maximum !== undefined) bounds.maxItems = def.maximum;
      }
      const itemFields = isImageRef(item)
        ? [{ key: "", label: "Gambar", kind: "image" as const, optional: false }]
        : item.def.type === "object"
          ? describeShape(shapeOf(item))
          : [describeField("", inner.def.element as z.ZodType)];
      return { ...base, kind: "list", itemFields, ...bounds };
    }
    case "object":
      // Objek bersarang non-gambar (mis. `cta`) diratakan jadi satu grup field.
      return { ...base, kind: "list", itemFields: describeShape(shapeOf(inner)), minItems: 1, maxItems: 1 };
    default:
      return { ...base, kind: "unsupported" };
  }
}

function describeShape(shape: Record<string, z.ZodType>): FieldDescriptor[] {
  return Object.entries(shape).map(([key, schema]) => describeField(key, schema));
}

/** Schema `data` untuk satu tipe block (dari union terdiskriminasi shared). */
export function blockDataSchema(type: BlockType): z.ZodObject | null {
  const options = (blockSchema.def.options ?? []) as unknown as AnySchema[];
  for (const option of options) {
    const shape = shapeOf(option);
    const literal = shape.type as AnySchema | undefined;
    const values = literal?.def.values as unknown[] | undefined;
    if (values?.[0] === type) return shape.data as z.ZodObject;
  }
  return null;
}

/** Daftar field editor untuk satu tipe block. */
export function describeBlockFields(type: BlockType): FieldDescriptor[] {
  const schema = blockDataSchema(type);
  return schema ? describeSchemaFields(schema) : [];
}

/**
 * Daftar field editor untuk sembarang ZodObject shared — dipakai editor koleksi
 * (`vehicleInputSchema`/`productInputSchema`) dengan mekanisme yang sama.
 */
export function describeSchemaFields(schema: z.ZodObject): FieldDescriptor[] {
  return describeShape(shapeOf(schema as unknown as AnySchema));
}

/** Nilai kosong yang valid untuk satu field (dipakai saat menambah item list). */
export function emptyValue(field: FieldDescriptor): unknown {
  switch (field.kind) {
    case "boolean":
      return false;
    case "number":
    case "money":
      return undefined;
    case "select":
      return field.options?.[0];
    case "image":
      return {};
    case "list":
      return [];
    default:
      return "";
  }
}

/** Item baru untuk sebuah list, terisi nilai kosong sesuai bentuk itemnya. */
export function emptyItem(field: FieldDescriptor): unknown {
  const fields = field.itemFields ?? [];
  if (fields.length === 1 && fields[0]!.key === "") return emptyValue(fields[0]!);
  const item: Record<string, unknown> = {};
  for (const sub of fields) {
    if (!sub.optional) item[sub.key] = emptyValue(sub);
  }
  return item;
}
