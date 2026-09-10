<template>
  <div class="quantum-background" aria-hidden="true">
    <img class="quantum-art" :src="quantumField" alt="" decoding="async" />
  </div>
</template>

<script setup lang="ts">
import quantumField from "../assets/login-quantum-field.webp";
</script>

<style scoped>
.quantum-background {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  background: #020c19;
  /* Filter the artwork and its base together to keep mobile edges seamless. */
  filter: hue-rotate(42deg) saturate(.45) brightness(.82);
}
.quantum-art {
  width: 100%;
  height: 100%;
  position: absolute;
  inset: 0;
  object-fit: cover;
  object-position: center;
}
/* Keep orbital detail above the form on narrow screens. */
@media (max-width: 768px) {
  .quantum-art {
    width: 900px;
    height: auto;
    max-width: none;
    left: calc(50% - 220px);
    top: -185px;
    opacity: .8;
  }
}
</style>
