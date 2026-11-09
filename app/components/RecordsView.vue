<script setup lang="ts">
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Edit3, Filter, RotateCcw, Search, SlidersHorizontal } from 'lucide-vue-next'

const props = defineProps<{ rows: Record<string, any>[]; statuses: Record<string, any>[]; search: string; dateFrom: string; dateTo: string; status: string; filter: string; page: number; pageSize: number; total: number; totalPages: number }>()
const emit = defineEmits<{ update: [value: Record<string, any>]; edit: [row: Record<string, any>] }>()
const sort = ref('record_date'), direction = ref<'asc' | 'desc'>('desc')
const visible = computed(() => [...props.rows].sort((a, b) => direction.value * String(a[sort.value] ?? '').localeCompare(String(b[sort.value] ?? ''), undefined, { numeric: true })))
const pages = computed(() => Array.from({ length: Math.min(props.totalPages, 5) }, (_, index) => Math.max(1, Math.min(props.totalPages - 4, props.page - 2)) + index))
const money = (n: number) => `${new Intl.NumberFormat('en-TZ', { maximumFractionDigits: 0 }).format(Number(n) || 0)} TZS`
const date = (v?: string) => v ? new Intl.DateTimeFormat('en-TZ', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${v}T00:00:00`)) : '—'
const update = (value: Record<string, any>) => emit('update', value)
const preset = (kind: 'today' | 'week' | 'month') => {
  const today = new Date(); const iso = (value: Date) => value.toISOString().slice(0, 10)
  const from = new Date(today); let to = new Date(today)
  if (kind === 'week') { from.setDate(today.getDate() - today.getDay()); to.setDate(from.getDate() + 6) }
  if (kind === 'month') { from.setDate(1); to = new Date(today.getFullYear(), today.getMonth() + 1, 0) }
  update({ dateFrom: iso(from), dateTo: iso(to), page: 1 })
}
const reset = () => update({ search: '', dateFrom: '', dateTo: '', status: '', filter: '', page: 1 })
const toggle = (key: string) => { direction.value = sort.value === key ? (direction.value === 'asc' ? 'desc' : 'asc') : 'asc'; sort.value = key }
</script>

<template>
  <section class="records-card">
    <header class="records-heading">
      <div><span class="eyebrow">Order register</span><h2>All orders</h2><p>{{ total }} result{{ total === 1 ? '' : 's' }} found</p></div>
      <button class="btn btn-light icon-label" type="button" @click="reset"><RotateCcw :size="15" /> Reset filters</button>
    </header>
    <div class="filters">
      <label class="search-field"><Search :size="17" /><input :value="search" placeholder="Search client, order or invoice" @input="update({ search: ($event.target as HTMLInputElement).value, page: 1 })"></label>
      <label><span>From</span><input class="form-control" :value="dateFrom" type="date" @change="update({ dateFrom: ($event.target as HTMLInputElement).value, page: 1 })"></label>
      <label><span>To</span><input class="form-control" :value="dateTo" type="date" @change="update({ dateTo: ($event.target as HTMLInputElement).value, page: 1 })"></label>
      <label><span>Status</span><select class="form-select" :value="status" @change="update({ status: ($event.target as HTMLSelectElement).value, page: 1 })"><option value="">All statuses</option><option v-for="item in statuses" :key="item.id" :value="item.name">{{ item.name }}</option></select></label>
      <label><span>Billing</span><select class="form-select" :value="filter" @change="update({ filter: ($event.target as HTMLSelectElement).value, page: 1 })"><option value="">All billing</option><option value="unpaid">Outstanding</option><option value="delivery">Delivery due</option></select></label>
    </div>
    <div class="filter-footer"><div class="presets"><CalendarDays :size="15" /><button @click="preset('today')">Today</button><button @click="preset('week')">This week</button><button @click="preset('month')">This month</button></div><span><Filter :size="14" /> {{ [search, dateFrom, dateTo, status, filter].filter(Boolean).length }} active filters</span></div>
    <div class="table-responsive">
      <table class="table align-middle records-table"><thead><tr><th @click="toggle('record_number')">Order <ChevronDown :size="13" /></th><th @click="toggle('client_name')">Client <ChevronDown :size="13" /></th><th @click="toggle('record_date')">Date <ChevronDown :size="13" /></th><th @click="toggle('status_name')">Status <ChevronDown :size="13" /></th><th @click="toggle('grand_total_minor')">Total <ChevronDown :size="13" /></th><th>Billing</th><th><span class="visually-hidden">Actions</span></th></tr></thead><tbody>
        <tr v-for="row in visible" :key="row.id"><td><strong>{{ row.record_number || '—' }}</strong></td><td><strong>{{ row.client_name }}</strong><small>{{ row.contacts || 'No contact details' }}</small></td><td>{{ date(row.record_date) }}</td><td><span class="status" :style="{ '--status': row.status_color }">{{ row.status_name }}</span></td><td><strong>{{ money(row.grand_total_minor) }}</strong></td><td><span class="billing" :class="String(row.payment_status).toLowerCase().replaceAll(' ', '-')">{{ row.payment_status || 'Pending' }}</span></td><td><button class="icon-button" title="Edit order" aria-label="Edit order" @click="emit('edit', row)"><Edit3 :size="16" /></button></td></tr>
        <tr v-if="!visible.length"><td colspan="7" class="empty"><SlidersHorizontal :size="28" /><strong>No orders match these filters.</strong><span>Try changing the dates or reset the filters.</span></td></tr>
      </tbody></table>
    </div>
    <footer class="pagination-bar"><span>Showing {{ total ? (page - 1) * pageSize + 1 : 0 }}–{{ Math.min(page * pageSize, total) }} of {{ total }}</span><div><button :disabled="page === 1" @click="update({ page: page - 1 })"><ChevronLeft :size="16" /></button><button v-for="item in pages" :key="item" :class="{ active: item === page }" @click="update({ page: item })">{{ item }}</button><button :disabled="page === totalPages" @click="update({ page: page + 1 })"><ChevronRight :size="16" /></button></div></footer>
  </section>
</template>

<style scoped>
.records-card{background:#fff;border:1px solid #e2e8e5;border-radius:16px;box-shadow:0 10px 30px rgba(16,29,50,.05);overflow:hidden}.records-heading{display:flex;justify-content:space-between;align-items:start;padding:22px 24px 16px}.eyebrow{font-size:10px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#718078}.records-heading h2{font-size:22px;margin:4px 0}.records-heading p{margin:0;color:#718078;font-size:13px}.icon-label,.presets button{display:inline-flex;gap:6px;align-items:center}.filters{padding:14px 24px;display:grid;grid-template-columns:2fr repeat(4,1fr);gap:10px;background:#f8faf9;border-block:1px solid #edf0ee}.filters label{font-size:10px;font-weight:800;color:#607069;text-transform:uppercase;letter-spacing:.04em}.filters input,.filters select{font-size:13px;margin-top:4px}.search-field{position:relative;display:flex;align-items:center;color:#7a8982!important}.search-field svg{position:absolute;left:11px;top:50%;transform:translateY(-25%)}.search-field input{width:100%;padding:9px 10px 9px 34px;border:1px solid #dbe3df;border-radius:7px;text-transform:none;letter-spacing:0}.filter-footer{display:flex;justify-content:space-between;align-items:center;padding:10px 24px;color:#718078;font-size:12px}.filter-footer>span,.presets{display:flex;gap:7px;align-items:center}.presets button{border:0;background:transparent;color:#147d58;font-weight:700;padding:2px;cursor:pointer}.records-table{margin:0;font-size:13px}.records-table th{white-space:nowrap;background:#f8faf9;color:#6f7d76;font-size:10px;text-transform:uppercase;letter-spacing:.05em;padding:12px 24px;cursor:pointer}.records-table th svg{vertical-align:middle}.records-table td{padding:14px 24px;border-color:#edf0ee}.records-table tr:hover td{background:#fbfdfc}.records-table small{display:block;color:#7b8782;margin-top:3px}.status,.billing{display:inline-block;border-radius:99px;padding:5px 9px;font-size:11px;font-weight:800}.status{background:color-mix(in srgb,var(--status,#64748b) 13%,white);color:var(--status,#64748b)}.billing{background:#fff4df;color:#9a6700}.billing.fully-paid{background:#e6f4ed;color:#147d58}.billing.partially-paid{background:#eaf3ff;color:#2463a6}.icon-button{border:0;background:#eff5f2;color:#147d58;border-radius:7px;padding:7px;display:grid;place-items:center}.empty{text-align:center!important;padding:55px!important;color:#718078}.empty svg,.empty strong,.empty span{display:block;margin:0 auto 8px}.empty strong{color:#34443c}.pagination-bar{display:flex;justify-content:space-between;align-items:center;border-top:1px solid #edf0ee;padding:14px 24px;color:#718078;font-size:12px}.pagination-bar div{display:flex;gap:4px}.pagination-bar button{min-width:31px;height:31px;border:1px solid #dbe4df;background:#fff;border-radius:7px;color:#4f6057;display:grid;place-items:center;font-size:12px}.pagination-bar button.active{background:#147d58;color:#fff;border-color:#147d58}.pagination-bar button:disabled{opacity:.45}@media(max-width:1100px){.filters{grid-template-columns:repeat(3,1fr)}.search-field{grid-column:span 3}}@media(max-width:680px){.records-heading,.filter-footer,.pagination-bar{padding-inline:16px}.filters{padding-inline:16px;grid-template-columns:1fr 1fr}.search-field{grid-column:span 2}.filter-footer{align-items:flex-start;gap:8px;flex-direction:column}.records-table th,.records-table td{padding:12px}.records-table th:nth-child(3),.records-table td:nth-child(3),.records-table th:nth-child(6),.records-table td:nth-child(6){display:none}}</style>
