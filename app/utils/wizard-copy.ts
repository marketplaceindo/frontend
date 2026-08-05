/**
 * Salinan teks step "andalan" di wizard onboarding, per jenis usaha.
 *
 * Placeholder "Nasi Goreng Spesial" untuk dealer mobil membuat user ragu apakah
 * ia salah memilih jenis usaha — pertanyaan wizard harus memakai kata yang
 * dipakai user sendiri. Dipisah dari komponen supaya bisa diuji dan supaya
 * menambah jenis usaha baru gagal keras kalau salinannya lupa ditulis.
 */
import type { BusinessType } from "@marketplaceindo/shared";

export interface AndalanCopy {
  /** Judul step, menggantikan judul generik. */
  judul: string;
  petunjuk: string;
  /** Label tiap baris, mis. "Menu 1" / "Unit 1". */
  label: string;
  placeholder: string;
  labelHarga: string;
  placeholderHarga: string;
  tambah: string;
}

export const ANDALAN_COPY: Record<BusinessType, AndalanCopy> = {
  kuliner: {
    judul: "Apa 3 menu andalanmu?",
    petunjuk: "Menu yang paling sering dipesan pelanggan. Minimal satu.",
    label: "Menu",
    placeholder: "Nasi Goreng Spesial",
    labelHarga: "Harga",
    placeholderHarga: "25000",
    tambah: "+ Tambah menu",
  },
  otomotif: {
    judul: "Apa 3 unit andalanmu?",
    petunjuk: "Unit yang paling sering ditanyakan calon pembeli. Minimal satu.",
    label: "Unit",
    placeholder: "Toyota Avanza 1.5 G CVT",
    labelHarga: "Harga OTR",
    placeholderHarga: "290000000",
    tambah: "+ Tambah unit",
  },
  katalog: {
    judul: "Apa 3 produk andalanmu?",
    petunjuk: "Produk yang paling laris. Minimal satu.",
    label: "Produk",
    placeholder: "Sepatu Kulit Pria",
    labelHarga: "Harga",
    placeholderHarga: "450000",
    tambah: "+ Tambah produk",
  },
  bisnis_jasa: {
    judul: "Apa 3 layanan andalanmu?",
    petunjuk: "Layanan yang paling sering diminta pelanggan. Minimal satu.",
    label: "Layanan",
    placeholder: "Servis AC Rumah",
    labelHarga: "Tarif",
    placeholderHarga: "85000",
    tambah: "+ Tambah layanan",
  },
};

/** Salinan untuk jenis usaha; sebelum user memilih, pakai kuliner sebagai netral. */
export function andalanCopyFor(type: BusinessType | ""): AndalanCopy {
  return ANDALAN_COPY[(type || "kuliner") as BusinessType];
}
