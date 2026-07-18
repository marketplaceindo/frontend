<script setup lang="ts">
import type { Block } from "@marketplaceindo/shared";

type Data = Extract<Block, { type: "whatsapp_float" }>["data"];
const props = defineProps<{ data: Data }>();

const href = computed(() => {
  const base = `https://wa.me/${props.data.whatsapp}`;
  return props.data.defaultMessage
    ? `${base}?text=${encodeURIComponent(props.data.defaultMessage)}`
    : base;
});
</script>

<template>
  <a
    :href="href"
    target="_blank"
    rel="noopener"
    aria-label="Chat via WhatsApp"
    class="fixed bottom-4 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-transform hover:scale-105"
    :class="data.position === 'left' ? 'left-4' : 'right-4'"
    style="background-color: #25d366"
  >
    <!-- #25D366 = warna brand WhatsApp (bukan token tenant). -->
    <svg viewBox="0 0 24 24" class="h-7 w-7 fill-white" aria-hidden="true">
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2c-1.6 0-3.1-.4-4.4-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.6-6.1c-.3-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1-.2.3-.6.8-.8 1-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4 0-.5.2-.7l.4-.5c.1-.2.1-.3 0-.5l-.8-1.9c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.2.3-.9.9-.9 2.2s.9 2.5 1.1 2.7c.1.2 1.9 2.9 4.6 4a15 15 0 0 0 1.5.6c.6.2 1.2.2 1.7.1.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.6-.3Z" />
    </svg>
  </a>
</template>
