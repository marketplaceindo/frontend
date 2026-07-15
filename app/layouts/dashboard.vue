<script setup lang="ts">
// Shell dashboard (domain utama / app.*). Konten sesungguhnya dibangun di Fase 7.
</script>

<template>
  <div class="dashboard-shell">
    <header>
      <strong>MarketIndonesia</strong> · Dashboard
    </header>
    <main>
      <slot />
    </main>
  </div>
</template>

<style scoped>
.dashboard-shell {
  max-width: 60rem;
  margin: 0 auto;
  padding: 0 1rem;
  font-family: system-ui, sans-serif;
}
header {
  padding: 1rem 0;
  border-bottom: 1px solid #e5e7eb;
}
</style>
