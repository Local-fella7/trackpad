<script setup lang="ts">
const result = ref('Ready to verify the desktop toolchain.')
const isDesktop = computed(() => typeof window !== 'undefined' && Boolean(window.desktopProof))

async function runProof() {
  if (!window.desktopProof) {
    result.value = 'Open this app through Electron to run the proof.'
    return
  }

  result.value = 'Creating a local database row and PDF…'
  const proof = await window.desktopProof.run()
  result.value = `Success: ${proof.recordCount} local row(s), PDF saved to ${proof.pdfPath}`
}
</script>

<template>
  <main>
    <h1>Business Records</h1>
    <p>Phase 0: desktop technical proof</p>
    <button type="button" :disabled="!isDesktop" @click="runProof">
      Run SQLite and PDF proof
    </button>
    <p aria-live="polite">{{ result }}</p>
  </main>
</template>

<style>
main { max-width: 44rem; margin: 5rem auto; font: 16px/1.5 system-ui, sans-serif; }
button { padding: .75rem 1rem; font: inherit; cursor: pointer; }
</style>
