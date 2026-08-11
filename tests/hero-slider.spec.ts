/**
 * Hero slider — schema validation untuk slides, autoPlayMs, dan backward compat.
 */
import { describe, expect, it } from "vitest";
import { heroDataSchema, heroSlideSchema } from "@marketplaceindo/shared";

describe("heroSlideSchema", () => {
  it("menerima slide dengan semua field", () => {
    const slide = {
      image: { url: "https://example.com/img.jpg", alt: "Promo" },
      href: "/mobil/avanza",
      label: "Diskon 10%",
      labelVariant: "accent" as const,
    };
    const result = heroSlideSchema.safeParse(slide);
    expect(result.success).toBe(true);
  });

  it("menerima slide tanpa href, label, dan labelVariant", () => {
    const slide = {
      image: { url: "https://example.com/img.jpg", alt: "Promo" },
    };
    const result = heroSlideSchema.safeParse(slide);
    expect(result.success).toBe(true);
  });

  it("menolak slide tanpa image", () => {
    const slide = { href: "/mobil/avanza" };
    const result = heroSlideSchema.safeParse(slide);
    expect(result.success).toBe(false);
  });
});

describe("heroDataSchema dengan slides", () => {
  it("menerima hero dengan slides array", () => {
    const hero = {
      heading: "Showroom Mobil",
      slides: [
        {
          image: { url: "https://example.com/1.jpg", alt: "Slide 1" },
          href: "#unit",
          label: "Promo",
          labelVariant: "primary" as const,
        },
        {
          image: { url: "https://example.com/2.jpg", alt: "Slide 2" },
        },
      ],
      autoPlayMs: 5000,
    };
    const result = heroDataSchema.safeParse(hero);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.slides).toHaveLength(2);
      expect(result.data.autoPlayMs).toBe(5000);
    }
  });

  it("menerima hero tanpa slides (backward compat)", () => {
    const hero = {
      heading: "Showroom Mobil",
      image: { url: "https://example.com/hero.jpg", alt: "Hero" },
    };
    const result = heroDataSchema.safeParse(hero);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.slides).toBeUndefined();
    }
  });

  it("menerima hero tanpa image dan tanpa slides", () => {
    const hero = { heading: "Showroom Mobil" };
    const result = heroDataSchema.safeParse(hero);
    expect(result.success).toBe(true);
  });

  it("autoPlayMs undefined jika tidak diisi", () => {
    const hero = { heading: "Showroom Mobil" };
    const result = heroDataSchema.safeParse(hero);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.autoPlayMs).toBeUndefined();
    }
  });

  it("menolak autoPlayMs negatif", () => {
    const hero = { heading: "Showroom Mobil", autoPlayMs: -1 };
    const result = heroDataSchema.safeParse(hero);
    expect(result.success).toBe(false);
  });

  it("menolak autoPlayMs lebih dari 15000", () => {
    const hero = { heading: "Showroom Mobil", autoPlayMs: 15001 };
    const result = heroDataSchema.safeParse(hero);
    expect(result.success).toBe(false);
  });

  it("menolak slides lebih dari 10", () => {
    const slides = Array.from({ length: 11 }, (_, i) => ({
      image: { url: `https://example.com/${i}.jpg`, alt: `Slide ${i}` },
    }));
    const hero = { heading: "Showroom Mobil", slides };
    const result = heroDataSchema.safeParse(hero);
    expect(result.success).toBe(false);
  });
});
