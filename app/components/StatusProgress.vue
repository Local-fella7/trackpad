<script setup lang="ts">
defineProps<{ name: string; color: string; count: number; total: number }>()
</script>

<template>
  <div class="progress-row">
    <div class="progress-meta">
      <span class="dot" :style="{ background: color }"></span>
      <b>{{ name }}</b>
      <small>{{ count }} ({{ total ? Math.round((count / total) * 100) : 0 }}%)</small>
    </div>
    <i class="track"><em :style="{ width: `${total ? (count / total) * 100 : 0}%`, background: color }"></em></i>
  </div>
</template>

<style scoped>
.progress-row {
  display: grid;
  gap: 7px;
  margin: 14px 0;
}

.progress-meta {
  display: flex;
  gap: 8px;
  align-items: center;
  font-size: 13px;
}

.dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  flex-shrink: 0;
}

.progress-meta small {
  margin-left: auto;
  color: var(--muted);
  font-weight: 700;
  font-size: 12px;
}

.track {
  display: block;
  height: 8px;
  background: #EFECE0;
  border-radius: 99px;
  overflow: hidden;
}

em {
  display: block;
  height: 100%;
  border-radius: inherit;
  transition: width 0.35s ease;
}
</style>
