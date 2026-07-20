/**
 * Builder JSON-LD (schema.org) untuk structured data SEO (Fase 6). Fungsi murni
 * (input → objek) supaya mudah diuji; komponen menyuntik hasilnya via useHead
 * script type="application/ld+json" (pakai serializeJsonLd untuk escape aman).
 */
import type { Block, Product, Vehicle } from "@marketplaceindo/shared";

type JsonLd = Record<string, unknown>;

const CURRENCY = "IDR";
const SCHEMA = "https://schema.org";

type MenuData = Extract<Block, { type: "menu" }>["data"];
type FaqItem = Extract<Block, { type: "faq" }>["data"]["items"][number];

const TRANSMISSION_LABELS: Record<string, string> = {
  manual: "Manual",
  automatic: "Automatic",
  cvt: "CVT",
};
const FUEL_LABELS: Record<string, string> = {
  bensin: "Gasoline",
  diesel: "Diesel",
  listrik: "Electric",
  hybrid: "Hybrid",
};

/** Nama bisnis dari SEO title (bagian sebelum pemisah —/–/|), fallback subdomain. */
export function businessName(seoTitle: string | undefined, subdomain: string): string {
  const first = seoTitle?.split(/\s[—–|-]\s/)[0]?.trim();
  if (first) return first;
  return subdomain.charAt(0).toUpperCase() + subdomain.slice(1);
}

export interface BusinessInput {
  name: string;
  url: string;
  whatsapp: string;
  address?: string;
  image?: string;
}

/** LocalBusiness / Organization / Restaurant (tergantung `type`). */
export function localBusinessJsonLd(input: BusinessInput, type = "LocalBusiness"): JsonLd {
  const ld: JsonLd = {
    "@context": SCHEMA,
    "@type": type,
    name: input.name,
    url: input.url,
    telephone: `+${input.whatsapp}`,
  };
  if (input.address) {
    ld.address = {
      "@type": "PostalAddress",
      streetAddress: input.address,
      addressCountry: "ID",
    };
  }
  if (input.image) ld.image = input.image;
  return ld;
}

/** Restaurant + (opsional) hasMenu dari block menu. */
export function restaurantJsonLd(input: BusinessInput, menu?: MenuData): JsonLd {
  const ld = localBusinessJsonLd(input, "Restaurant");
  if (menu && menu.groups.length) {
    ld.hasMenu = {
      "@type": "Menu",
      hasMenuSection: menu.groups.map((group) => ({
        "@type": "MenuSection",
        name: group.title,
        hasMenuItem: group.items.map((item) => ({
          "@type": "MenuItem",
          name: item.name,
          ...(item.description ? { description: item.description } : {}),
          ...(item.price !== undefined
            ? { offers: { "@type": "Offer", price: item.price, priceCurrency: CURRENCY } }
            : {}),
        })),
      })),
    };
  }
  return ld;
}

/** Product (PDP katalog). */
export function productJsonLd(product: Product, url: string): JsonLd {
  const ld: JsonLd = {
    "@context": SCHEMA,
    "@type": "Product",
    name: product.name,
    url,
    offers: {
      "@type": "Offer",
      price: product.price,
      priceCurrency: CURRENCY,
      availability: product.inStock === false ? `${SCHEMA}/OutOfStock` : `${SCHEMA}/InStock`,
      url,
    },
  };
  if (product.category) ld.category = product.category;
  if (product.description) ld.description = product.description;
  return ld;
}

/** Car/Vehicle (VDP otomotif — eligibility Google Vehicle Listings). */
export function carJsonLd(vehicle: Vehicle, url: string): JsonLd {
  const ld: JsonLd = {
    "@context": SCHEMA,
    "@type": "Car",
    name: vehicle.name,
    url,
    brand: { "@type": "Brand", name: vehicle.brand },
    vehicleModelDate: String(vehicle.year),
    offers: {
      "@type": "Offer",
      price: vehicle.price,
      priceCurrency: CURRENCY,
      availability: vehicle.sold ? `${SCHEMA}/SoldOut` : `${SCHEMA}/InStock`,
      url,
      itemCondition: `${SCHEMA}/UsedCondition`,
    },
  };
  if (vehicle.model) ld.model = vehicle.model;
  if (vehicle.color) ld.color = vehicle.color;
  if (vehicle.description) ld.description = vehicle.description;
  if (vehicle.transmission) ld.vehicleTransmission = TRANSMISSION_LABELS[vehicle.transmission];
  if (vehicle.fuelType) ld.fuelType = FUEL_LABELS[vehicle.fuelType];
  if (vehicle.mileageKm !== undefined) {
    ld.mileageFromOdometer = {
      "@type": "QuantitativeValue",
      value: vehicle.mileageKm,
      unitCode: "KMT",
    };
  }
  return ld;
}

/** FAQPage dari items block faq. */
export function faqPageJsonLd(items: FaqItem[]): JsonLd {
  return {
    "@context": SCHEMA,
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}

/**
 * Serialize aman untuk disematkan di dalam <script>: escape `<` supaya string
 * data (mis. "</script>") tidak bisa menutup tag lebih awal.
 */
export function serializeJsonLd(ld: JsonLd | JsonLd[]): string {
  return JSON.stringify(ld).replace(/</g, "\\u003c");
}
