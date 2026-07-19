/**
 * blockMap: type block → komponen Vue. Fase 3 = 12 section inti;
 * Fase 4 = section khas template (bisnis_jasa/katalog/kuliner/otomotif)
 * + block fungsional (simulasi_kredit, test_drive, hubungi_sales).
 * Tipe tak dikenal → BlockUnknown (log dev, render null) — forward compatibility.
 */
import { defineComponent, type Component } from "vue";
import type { BlockType } from "@marketplaceindo/shared";
import BlockNavbar from "../components/blocks/BlockNavbar.vue";
import BlockHero from "../components/blocks/BlockHero.vue";
import BlockAbout from "../components/blocks/BlockAbout.vue";
import BlockFeatures from "../components/blocks/BlockFeatures.vue";
import BlockGallery from "../components/blocks/BlockGallery.vue";
import BlockTestimonials from "../components/blocks/BlockTestimonials.vue";
import BlockStats from "../components/blocks/BlockStats.vue";
import BlockCtaBand from "../components/blocks/BlockCtaBand.vue";
import BlockFaq from "../components/blocks/BlockFaq.vue";
import BlockContact from "../components/blocks/BlockContact.vue";
import BlockFooter from "../components/blocks/BlockFooter.vue";
import BlockWhatsappFloat from "../components/blocks/BlockWhatsappFloat.vue";
import BlockServices from "../components/blocks/BlockServices.vue";
import BlockProcess from "../components/blocks/BlockProcess.vue";
import BlockTeam from "../components/blocks/BlockTeam.vue";
import BlockClientLogos from "../components/blocks/BlockClientLogos.vue";
import BlockProductGrid from "../components/blocks/BlockProductGrid.vue";
import BlockProductCategories from "../components/blocks/BlockProductCategories.vue";
import BlockPriceList from "../components/blocks/BlockPriceList.vue";
import BlockPromoBanner from "../components/blocks/BlockPromoBanner.vue";
import BlockMenu from "../components/blocks/BlockMenu.vue";
import BlockFeaturedMenu from "../components/blocks/BlockFeaturedMenu.vue";
import BlockOpeningHours from "../components/blocks/BlockOpeningHours.vue";
import BlockReservation from "../components/blocks/BlockReservation.vue";
import BlockVehicleGrid from "../components/blocks/BlockVehicleGrid.vue";
import BlockFeaturedVehicles from "../components/blocks/BlockFeaturedVehicles.vue";
import BlockSimulasiKredit from "../components/blocks/BlockSimulasiKredit.vue";
import BlockTestDrive from "../components/blocks/BlockTestDrive.vue";
import BlockHubungiSales from "../components/blocks/BlockHubungiSales.vue";

/** Fallback: log sekali di dev, tidak me-render apa pun. */
export const BlockUnknown = defineComponent({
  name: "BlockUnknown",
  props: { data: { type: Object, default: undefined }, blockType: { type: String, default: "?" } },
  setup(props) {
    if (import.meta.dev) {
      console.warn(`[SectionRenderer] tipe block tak dikenal, dilewati: "${props.blockType}"`);
    }
    return () => null;
  },
});

/** 12 section inti (dipakai semua template). */
export const CORE_BLOCK_TYPES = [
  "navbar", "hero", "about", "features", "gallery", "testimonials",
  "stats", "cta_band", "faq", "contact", "footer", "whatsapp_float",
] as const satisfies readonly BlockType[];

export const blockMap: Record<BlockType, Component> = {
  // Inti (Fase 3)
  navbar: BlockNavbar,
  hero: BlockHero,
  about: BlockAbout,
  features: BlockFeatures,
  gallery: BlockGallery,
  testimonials: BlockTestimonials,
  stats: BlockStats,
  cta_band: BlockCtaBand,
  faq: BlockFaq,
  contact: BlockContact,
  footer: BlockFooter,
  whatsapp_float: BlockWhatsappFloat,
  // Bisnis & Jasa (Fase 4)
  services: BlockServices,
  process: BlockProcess,
  team: BlockTeam,
  client_logos: BlockClientLogos,
  // Katalog (Fase 4)
  product_grid: BlockProductGrid,
  product_categories: BlockProductCategories,
  price_list: BlockPriceList,
  promo_banner: BlockPromoBanner,
  // Kuliner (Fase 4)
  menu: BlockMenu,
  featured_menu: BlockFeaturedMenu,
  opening_hours: BlockOpeningHours,
  reservation: BlockReservation,
  // Otomotif + fungsional (Fase 4)
  vehicle_grid: BlockVehicleGrid,
  featured_vehicles: BlockFeaturedVehicles,
  simulasi_kredit: BlockSimulasiKredit,
  test_drive: BlockTestDrive,
  hubungi_sales: BlockHubungiSales,
};

export function resolveBlock(type: string): Component {
  return blockMap[type as BlockType] ?? BlockUnknown;
}
