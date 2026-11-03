<script setup lang="ts">defineProps<{row:Record<string,any>}>()</script>
<template><span class="badge" :class="{paid:row.paid_at,confirmed:row.confirmed_at}">{{row.delivered_at?'Delivered':row.paid_at?'Paid':row.confirmed_at?'Confirmed':'Pending'}}</span></template>
<style scoped>.badge{display:inline-block;padding:4px 8px;border-radius:99px;background:#f1e7d6;color:#76453b;font-size:11px;font-weight:800}.confirmed{background:#dbece7;color:#2d504a}.paid{background:#d8ede2;color:#246348}</style>
