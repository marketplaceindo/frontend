/**
 * blockMap Fase 3: type block → komponen Vue. 12 section inti; tipe khas
 * template & fungsional (services, menu, vehicle_grid, dst) menyusul Fase 4.
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

export const blockMap: Partial<Record<BlockType, Component>> = {
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
};

export function resolveBlock(type: string): Component {
  return blockMap[type as BlockType] ?? BlockUnknown;
}
