/**
 * Hubungi Sales — schema validation untuk photo, role, dan backward compat.
 */
import { describe, expect, it } from "vitest";
import { hubungiSalesDataSchema } from "@marketplaceindo/shared";

describe("hubungiSalesDataSchema dengan photo & role", () => {
  it("menerima sales dengan photo dan role", () => {
    const data = {
      heading: "Hubungi Sales Kami",
      sales: [
        {
          name: "Budi Santoso",
          whatsapp: "6281234567890",
          photo: { url: "https://example.com/budi.jpg", alt: "Budi" },
          role: "Sales Consultant",
        },
      ],
    };
    const result = hubungiSalesDataSchema.safeParse(data);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sales[0]!.photo).toBeDefined();
      expect(result.data.sales[0]!.role).toBe("Sales Consultant");
    }
  });

  it("menerima sales tanpa photo dan role (backward compat)", () => {
    const data = {
      heading: "Hubungi Sales Kami",
      sales: [{ name: "Budi Santoso", whatsapp: "6281234567890" }],
    };
    const result = hubungiSalesDataSchema.safeParse(data);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sales[0]!.photo).toBeUndefined();
      expect(result.data.sales[0]!.role).toBeUndefined();
    }
  });

  it("menerima sales dengan photo tapi tanpa role", () => {
    const data = {
      sales: [
        {
          name: "Budi Santoso",
          whatsapp: "6281234567890",
          photo: { url: "https://example.com/budi.jpg", alt: "Budi" },
        },
      ],
    };
    const result = hubungiSalesDataSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it("menerima sales dengan role tapi tanpa photo", () => {
    const data = {
      sales: [
        {
          name: "Budi Santoso",
          whatsapp: "6281234567890",
          role: "Sales Manager",
        },
      ],
    };
    const result = hubungiSalesDataSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it("menolak sales tanpa name", () => {
    const data = {
      sales: [{ whatsapp: "6281234567890" }],
    };
    const result = hubungiSalesDataSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it("menolak sales tanpa whatsapp", () => {
    const data = {
      sales: [{ name: "Budi Santoso" }],
    };
    const result = hubungiSalesDataSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it("menolak role lebih dari 80 karakter", () => {
    const data = {
      sales: [
        {
          name: "Budi Santoso",
          whatsapp: "6281234567890",
          role: "A".repeat(81),
        },
      ],
    };
    const result = hubungiSalesDataSchema.safeParse(data);
    expect(result.success).toBe(false);
  });
});
