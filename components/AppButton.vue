<script setup lang="ts">
withDefaults(defineProps<{ type?: 'button' | 'submit' | 'reset'; disabled?: boolean }>(), { type: 'button', disabled: false })
</script>

<template><button class="app-button" :type="type" :disabled="disabled"><slot /></button></template>

<style scoped>
.app-button { border: 0; border-radius: .5rem; background: #0f766e; color: white; font-weight: 650; padding: .75rem 1rem; }
.app-button:disabled { cursor: not-allowed; opacity: .55; }
</style>
