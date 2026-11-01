<script setup lang="ts">
const result = ref('Ready.')
const search = ref('')
const rows = ref<Record<string, unknown>[]>([])
const statuses = ref<Record<string, unknown>[]>([])
const settings = reactive<Record<string, string>>({})
const newStatus = reactive({ name: '', color: '#64748b' })
const dashboard = ref<Record<string, unknown> | null>(null)
const form = reactive({ recordDate: new Date().toISOString().slice(0, 10), clientName: '', statusId: 1, currency: 'TZS', taxRateBasisPoints: 0, items: [{ description: '', quantityX100: 100, unitPriceMinor: 0 }] })
const total = computed(() => form.items.reduce((sum, item) => sum + Math.round(item.quantityX100 * item.unitPriceMinor / 100), 0))
async function loadRecords() { if (!window.api) return; const response = await window.api.records.list({ search: search.value }); rows.value = (response.data ?? []) as Record<string, unknown>[] }
async function loadConfiguration() { if (!window.api) return; const [a, b] = await Promise.all([window.api.statuses.list(), window.api.settings.get()]); statuses.value = (a.data ?? []) as Record<string, unknown>[]; Object.assign(settings, b.data ?? {}) }
function addItem() { form.items.push({ description: '', quantityX100: 100, unitPriceMinor: 0 }) }
async function saveRecord() { if (!window.api || !form.clientName.trim()) { result.value = 'Client name is required.'; return }; const response = await window.api.records.create({ record: { ...form, items: undefined }, items: form.items }); result.value = response.ok ? 'Record saved.' : response.error?.message ?? 'Could not save record.'; if (response.ok) await loadRecords() }
async function addStatus() { if (window.api && newStatus.name.trim() && (await window.api.statuses.create(newStatus)).ok) { newStatus.name = ''; await loadConfiguration() } }
async function saveSetting(key: string) { if (window.api) await window.api.settings.set({ key, value: settings[key] ?? '' }) }
async function loadDashboard() { if (!window.api) return; const response = await window.api.dashboard.data(); dashboard.value = response.data ?? null }
</script>
<template>
  <main class="shell">
    <header><h1>Business Records</h1><p>Dashboard, records, statuses and settings</p></header>
    <section class="card"><h2>Dashboard</h2><AppButton @click="loadDashboard">Refresh dashboard</AppButton><template v-if="dashboard"><div class="metrics"><p>Records today: <strong>{{ dashboard.recordsToday }}</strong></p><p>Backup health: <strong>Backup checks arrive in Phase 8.</strong></p></div><h3>Monthly totals</h3><p v-for="summary in dashboard.monthSummary as Record<string, unknown>[]" :key="String(summary.currency)">{{ summary.currency }}: {{ summary.total }} ({{ summary.count }} records)</p><h3>Upcoming events</h3><p v-for="event in dashboard.upcomingEvents as Record<string, unknown>[]" :key="String(event.id)">{{ event.event_date }} — {{ event.client_name }} ({{ event.status_name }})</p><h3>Records by status</h3><p v-for="status in dashboard.byStatus as Record<string, unknown>[]" :key="String(status.name)">{{ status.name }}: {{ status.count }}</p></template></section>
    <section class="card"><h2>Records</h2><input v-model="search" placeholder="Search client, number or invoice" @keyup.enter="loadRecords"><AppButton @click="loadRecords">Search</AppButton><table v-if="rows.length"><tr><th>Date</th><th>Client</th><th>Total</th><th>Status</th></tr><tr v-for="row in rows" :key="String(row.id)"><td>{{ row.record_date }}</td><td>{{ row.client_name }}</td><td>{{ row.grand_total_minor }} {{ row.currency }}</td><td>{{ row.status_name }}</td></tr></table></section>
    <section class="card"><h2>New record</h2><input v-model="form.recordDate" type="date"><input v-model="form.clientName" placeholder="Client name"><div v-for="(item, index) in form.items" :key="index" class="item"><input v-model="item.description" placeholder="Item"><input v-model.number="item.quantityX100" type="number"><input v-model.number="item.unitPriceMinor" type="number"></div><AppButton @click="addItem">Add item</AppButton><p>Grand total: {{ total }} {{ form.currency }}</p><AppButton @click="saveRecord">Save record</AppButton></section>
    <section class="card"><h2>Status and settings</h2><AppButton @click="loadConfiguration">Load configuration</AppButton><p v-for="status in statuses" :key="String(status.id)">{{ status.name }}</p><div class="item"><input v-model="newStatus.name" placeholder="New status"><input v-model="newStatus.color" type="color"><AppButton @click="addStatus">Add status</AppButton></div><label>Currency <input v-model="settings.currency" @change="saveSetting('currency')"></label><label>Tax rate <input v-model="settings.tax_rate_bp" @change="saveSetting('tax_rate_bp')"></label><label>Auto-lock minutes <input v-model="settings.autolock_minutes" @change="saveSetting('autolock_minutes')"></label></section>
    <p aria-live="polite">{{ result }}</p>
  </main>
</template>
<style>.shell{max-width:68rem;margin:3rem auto;padding:0 1rem}.card{display:grid;gap:1rem;margin:1rem 0;padding:1.25rem;background:white;border:1px solid #dce3ef;border-radius:.75rem}input{padding:.55rem}.item{display:grid;grid-template-columns:2fr 1fr 1fr;gap:.5rem}.metrics{display:flex;gap:2rem;flex-wrap:wrap}table{border-collapse:collapse;width:100%}th,td{padding:.5rem;text-align:left;border-bottom:1px solid #e5e7eb}</style>
