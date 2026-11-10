<script setup lang="ts">
defineProps<{ row: Record<string, any> }>()
</script>

<template>
  <span class="badge" :class="{ paid: row.paid_at, confirmed: row.confirmed_at }">
    {{ row.delivered_at ? 'Delivered' : row.paid_at ? 'Paid' : row.confirmed_at ? 'Confirmed' : 'Pending' }}
  </span>
</template>

<style scoped>
.badge {
  display: inline-block;
  padding: 5px 10px;
  border-radius: 99px;
  background: #F4EFE8;
  color: #76453B;
  font-size: 11px;
  font-weight: 800;
}

.confirmed {
  background: #E9F1EF;
  color: #43766C;
}

.paid {
  background: #43766C;
  color: #F8FAE5;
}
</style>
