<template>
  <div class="solver-empty-state">
    <span class="solver-empty-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <template v-if="icon === 'log'">
          <circle cx="12" cy="12" r="8" /><path d="M12 7v5l3 2" />
        </template>
        <path v-else d="M5 4h10l4 4v12H5zM14 4v5h5M9 13h6M9 16h4" />
      </svg>
    </span>
    <div class="solver-empty-copy">
      <strong>{{ title }}</strong>
      <p>{{ description }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ title: string; description: string; icon: 'result' | 'log' }>();
</script>
