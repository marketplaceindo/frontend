/**
 * Fase 6 — builder JSON-LD structured data (fungsi murni).
 */
import { describe, expect, it } from "vitest";
import type { Product, VehicleUnit } from "@marketplaceindo/shared";
import {
  businessName,
  carJsonLd,
  faqPageJsonLd,
  localBusinessJsonLd,
  productJsonLd,
  restaurantJsonLd,
  serializeJsonLd,
} from "../app/utils/jsonld";

const business = {
  name: "Otojaya Motor",
  url: "https://otojaya.example.com",
  whatsapp: "6281299988877",
  address: "Jl. Raya Serpong KM 7",
};

describe("businessName", () => {
  it("ambil bagian sebelum pemisah em-dash/pipe", () => {
    expect(businessName("Otojaya Motor — Jual Beli Mobil", "otojaya")).toBe("Otojaya Motor");
    expect(businessName("Toko Berkah | Oleh-oleh", "tokoberkah")).toBe("Toko Berkah");
  });
  it("fallback subdomain (title-case) bila title kosong", () => {
    expect(businessName(undefined, "warungbudi")).toBe("Warungbudi");
  });
});

describe("localBusinessJsonLd", () => {
  it("punya @context, @type, name, telephone +62, address PostalAddress", () => {
    const ld = localBusinessJsonLd(business);
    expect(ld["@context"]).toBe("https://schema.org");
    expect(ld["@type"]).toBe("LocalBusiness");
    expect(ld.telephone).toBe("+6281299988877");
    expect((ld.address as Record<string, unknown>)["@type"]).toBe("PostalAddress");
  });
});

describe("restaurantJsonLd", () => {
  it("@type Restaurant + hasMenu dari groups menu", () => {
    const ld = restaurantJsonLd({ ...business, name: "Warung Demo" }, {
      groups: [
        { title: "Makanan", items: [{ name: "Nasi Timbel", price: 35000 }] },
      ],
    });
    expect(ld["@type"]).toBe("Restaurant");
    const menu = ld.hasMenu as Record<string, unknown>;
    expect(menu["@type"]).toBe("Menu");
    const section = (menu.hasMenuSection as Record<string, unknown>[])[0]!;
    expect(section.name).toBe("Makanan");
    const item = (section.hasMenuItem as Record<string, unknown>[])[0]!;
    expect((item.offers as Record<string, unknown>).price).toBe(35000);
    expect((item.offers as Record<string, unknown>).priceCurrency).toBe("IDR");
  });
  it("tanpa menu → tidak ada hasMenu", () => {
    expect(restaurantJsonLd(business).hasMenu).toBeUndefined();
  });
});

const vehicle: VehicleUnit = {
  id: "00000000-0000-4000-8000-000000000002",
  slug: "honda-brio-2023",
  name: "Honda Brio RS",
  brand: "Honda",
  model: "Brio",
  year: 2023,
  price: 189000000,
  transmission: "cvt",
  fuelType: "bensin",
  mileageKm: 12000,
  color: "Kuning",
  createdAt: "2026-07-12T02:00:00Z",
  updatedAt: "2026-07-16T04:00:00Z",
};

describe("carJsonLd", () => {
  it("Car dengan brand, offers IDR, InStock, mileage KMT", () => {
    const ld = carJsonLd(vehicle, "https://otojaya.example.com/mobil/honda-brio-2023");
    expect(ld["@type"]).toBe("Car");
    expect((ld.brand as Record<string, unknown>).name).toBe("Honda");
    expect(ld.vehicleTransmission).toBe("CVT");
    expect(ld.fuelType).toBe("Gasoline");
    expect((ld.mileageFromOdometer as Record<string, unknown>).unitCode).toBe("KMT");
    const offer = ld.offers as Record<string, unknown>;
    expect(offer.price).toBe(189000000);
    expect(offer.availability).toBe("https://schema.org/InStock");
  });
  it("unit terjual → availability SoldOut", () => {
    const ld = carJsonLd({ ...vehicle, sold: true }, "https://x/mobil/x");
    expect((ld.offers as Record<string, unknown>).availability).toBe("https://schema.org/SoldOut");
  });
});

const product: Product = {
  id: "00000000-0000-4000-8000-000000000011",
  slug: "kopi-arabika-gayo-250g",
  name: "Kopi Arabika Gayo 250g",
  category: "Kopi",
  price: 85000,
  createdAt: "2026-07-01T03:00:00Z",
  updatedAt: "2026-07-16T04:00:00Z",
  inStock: true,
};

describe("productJsonLd", () => {
  it("Product dengan offers IDR + InStock", () => {
    const ld = productJsonLd(product, "https://tokoberkah.example.com/produk/kopi-arabika-gayo-250g");
    expect(ld["@type"]).toBe("Product");
    expect(ld.category).toBe("Kopi");
    expect((ld.offers as Record<string, unknown>).availability).toBe("https://schema.org/InStock");
  });
  it("stok habis → OutOfStock", () => {
    const ld = productJsonLd({ ...product, inStock: false }, "https://x/produk/x");
    expect((ld.offers as Record<string, unknown>).availability).toBe("https://schema.org/OutOfStock");
  });
});

describe("faqPageJsonLd", () => {
  it("FAQPage dengan mainEntity Question/Answer", () => {
    const ld = faqPageJsonLd([{ question: "Berapa lama?", answer: "2 minggu." }]);
    expect(ld["@type"]).toBe("FAQPage");
    const q = (ld.mainEntity as Record<string, unknown>[])[0]!;
    expect(q["@type"]).toBe("Question");
    expect((q.acceptedAnswer as Record<string, unknown>).text).toBe("2 minggu.");
  });
});

describe("serializeJsonLd", () => {
  it("escape < supaya tidak bisa menutup <script> lebih awal", () => {
    const out = serializeJsonLd({ "@type": "Thing", name: "</script><b>x" });
    expect(out).not.toContain("</script>");
    expect(out).toContain("\\u003c");
  });
});
