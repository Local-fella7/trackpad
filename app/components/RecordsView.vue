<script setup lang="ts">
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Eye,
  Filter,
  Printer,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Trash2,
} from 'lucide-vue-next'
import { formatDate } from '../../shared/date'

const props = defineProps<{
  rows: Record<string, any>[]
  statuses: Record<string, any>[]
  search: string
  dateFrom: string
  dateTo: string
  status: string
  filter: string
  page: number
  pageSize: number
  total: number
  totalPages: number
}>()

const emit = defineEmits<{
  update: [value: Record<string, any>]
  view: [row: Record<string, any>]
  print: [row: Record<string, any>]
  edit: [row: Record<string, any>]
  remove: [row: Record<string, any>]
}>()

const sort = ref('record_date')
const direction = ref<'asc' | 'desc'>('desc')

const visible = computed(() =>
  [...props.rows].sort(
    (a, b) =>
      (direction.value === 'asc' ? 1 : -1) *
      String(a[sort.value] ?? '').localeCompare(String(b[sort.value] ?? ''), undefined, { numeric: true }),
  ),
)

const pages = computed(() =>
  Array.from(
    { length: Math.min(props.totalPages, 5) },
    (_, index) => Math.max(1, Math.min(props.totalPages - 4, props.page - 2)) + index,
  ),
)

const money = (n: number) => `${new Intl.NumberFormat('en-TZ', { maximumFractionDigits: 0 }).format(Number(n) || 0)} TZS`
const date = (v?: string) => formatDate(v, '—')
const update = (value: Record<string, any>) => emit('update', value)

const preset = (kind: 'today' | 'week' | 'month') => {
  const today = new Date()
  const iso = (value: Date) => value.toISOString().slice(0, 10)
  const from = new Date(today)
  let to = new Date(today)
  if (kind === 'week') {
    from.setDate(today.getDate() - today.getDay())
    to.setDate(from.getDate() + 6)
  }
  if (kind === 'month') {
    from.setDate(1)
    to = new Date(today.getFullYear(), today.getMonth() + 1, 0)
  }
  update({ dateFrom: iso(from), dateTo: iso(to), page: 1 })
}

const reset = () => update({ search: '', dateFrom: '', dateTo: '', status: '', filter: '', page: 1 })
const toggle = (key: string) => {
  direction.value = sort.value === key ? (direction.value === 'asc' ? 'desc' : 'asc') : 'asc'
  sort.value = key
}
</script>

<template>
  <section class="records-card">
    <header class="records-heading">
      <div>
        <span class="eyebrow">Order register</span>
        <h2>All orders</h2>
        <p>{{ total }} result{{ total === 1 ? '' : 's' }} found · Dates in dd-mm-yyyy</p>
      </div>
      <button class="btn btn-light icon-label" type="button" @click="reset">
        <RotateCcw :size="15" /> Reset filters
      </button>
    </header>

    <div class="filters">
      <label class="search-field">
        <Search :size="17" />
        <input
          :value="search"
          placeholder="Search client, order or invoice"
          @input="update({ search: ($event.target as HTMLInputElement).value, page: 1 })"
        />
      </label>
      <label>
        <span>From ({{ dateFrom ? date(dateFrom) : 'dd-mm-yyyy' }})</span>
        <input
          class="form-control"
          :value="dateFrom"
          type="date"
          @change="update({ dateFrom: ($event.target as HTMLInputElement).value, page: 1 })"
        />
      </label>
      <label>
        <span>To ({{ dateTo ? date(dateTo) : 'dd-mm-yyyy' }})</span>
        <input
          class="form-control"
          :value="dateTo"
          type="date"
          @change="update({ dateTo: ($event.target as HTMLInputElement).value, page: 1 })"
        />
      </label>
      <label>
        <span>Status</span>
        <select
          class="form-select"
          :value="status"
          @change="update({ status: ($event.target as HTMLSelectElement).value, page: 1 })"
        >
          <option value="">All statuses</option>
          <option v-for="item in statuses" :key="item.id" :value="item.name">{{ item.name }}</option>
        </select>
      </label>
      <label>
        <span>Billing</span>
        <select
          class="form-select"
          :value="filter"
          @change="update({ filter: ($event.target as HTMLSelectElement).value, page: 1 })"
        >
          <option value="">All billing</option>
          <option value="unpaid">Outstanding</option>
          <option value="delivery">Delivery due</option>
        </select>
      </label>
    </div>

    <div class="filter-footer">
      <div class="presets">
        <CalendarDays :size="15" />
        <button type="button" @click="preset('today')">Today</button>
        <button type="button" @click="preset('week')">This week</button>
        <button type="button" @click="preset('month')">This month</button>
      </div>
      <span>
        <Filter :size="14" /> {{ [search, dateFrom, dateTo, status, filter].filter(Boolean).length }} active filters
      </span>
    </div>

    <div class="table-responsive">
      <table class="table align-middle records-table">
        <thead>
          <tr>
            <th @click="toggle('record_number')">Order <ChevronDown :size="13" /></th>
            <th @click="toggle('client_name')">Client <ChevronDown :size="13" /></th>
            <th @click="toggle('record_date')">Order Date <ChevronDown :size="13" /></th>
            <th @click="toggle('event_date')">Event Date <ChevronDown :size="13" /></th>
            <th @click="toggle('status_name')">Status <ChevronDown :size="13" /></th>
            <th @click="toggle('grand_total_minor')">Total <ChevronDown :size="13" /></th>
            <th>Billing</th>
            <th class="text-end">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in visible" :key="row.id">
            <td>
              <strong>{{ row.record_number || '—' }}</strong>
            </td>
            <td>
              <strong>{{ row.client_name }}</strong>
              <small>{{ row.contacts || 'No contact details' }}</small>
            </td>
            <td>{{ date(row.record_date) }}</td>
            <td>{{ date(row.event_date) }}</td>
            <td>
              <span class="status" :style="{ '--status': row.status_color }">{{ row.status_name }}</span>
            </td>
            <td>
              <strong>{{ money(row.grand_total_minor) }}</strong>
            </td>
            <td>
              <span class="billing" :class="String(row.payment_status).toLowerCase().replaceAll(' ', '-')">
                {{ row.payment_status || 'Pending' }}
              </span>
            </td>
            <td>
              <div class="action-group">
                <button
                  type="button"
                  class="icon-button"
                  title="View order & items"
                  aria-label="View order & items"
                  @click="emit('view', row)"
                >
                  <Eye :size="15" />
                </button>
                <button
                  type="button"
                  class="icon-button tan"
                  title="Print order item list"
                  aria-label="Print order item list"
                  @click="emit('print', row)"
                >
                  <Printer :size="15" />
                </button>
                <button
                  type="button"
                  class="icon-button"
                  title="Edit order"
                  aria-label="Edit order"
                  @click="emit('edit', row)"
                >
                  <Edit3 :size="15" />
                </button>
                <button
                  type="button"
                  class="icon-button danger"
                  title="Delete order"
                  aria-label="Delete order"
                  @click="emit('remove', row)"
                >
                  <Trash2 :size="15" />
                </button>
              </div>
            </td>
          </tr>
          <tr v-if="!visible.length">
            <td colspan="8" class="empty">
              <SlidersHorizontal :size="28" />
              <strong>No orders match these filters.</strong>
              <span>Try changing the dates or reset the filters.</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <footer class="pagination-bar">
      <span>Showing {{ total ? (page - 1) * pageSize + 1 : 0 }}–{{ Math.min(page * pageSize, total) }} of {{ total }}</span>
      <div>
        <button type="button" :disabled="page === 1" @click="update({ page: page - 1 })"><ChevronLeft :size="16" /></button>
        <button
          v-for="item in pages"
          :key="item"
          type="button"
          :class="{ active: item === page }"
          @click="update({ page: item })"
        >
          {{ item }}
        </button>
        <button type="button" :disabled="page === totalPages" @click="update({ page: page + 1 })">
          <ChevronRight :size="16" />
        </button>
      </div>
    </footer>
  </section>
</template>

<style scoped>
.records-card {
  background: #fff;
  border: 1px solid #E5DEC9;
  border-radius: 16px;
  box-shadow: 0 10px 28px rgba(38, 33, 29, 0.05);
  overflow: hidden;
}

.records-heading {
  display: flex;
  justify-content: space-between;
  align-items: start;
  padding: 22px 24px 16px;
}

.eyebrow {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #B19470;
}

.records-heading h2 {
  font-size: 22px;
  margin: 4px 0;
  color: #26211D;
  font-weight: 800;
}

.records-heading p {
  margin: 0;
  color: #73685D;
  font-size: 13px;
}

.icon-label,
.presets button {
  display: inline-flex;
  gap: 6px;
  align-items: center;
}

.icon-label {
  border: 1px solid #E5DEC9;
  background: #F8FAE5;
  color: #43766C;
  font-weight: 700;
  font-size: 12.5px;
}

.icon-label:hover {
  background: #E9F1EF;
  color: #345d55;
}

.filters {
  padding: 14px 24px;
  display: grid;
  grid-template-columns: 2fr repeat(4, 1fr);
  gap: 10px;
  background: #FBFCF4;
  border-block: 1px solid #E5DEC9;
}

.filters label {
  font-size: 10px;
  font-weight: 800;
  color: #73685D;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.filters input,
.filters select {
  font-size: 13px;
  margin-top: 4px;
  border-color: #E5DEC9;
}

.search-field {
  position: relative;
  display: flex;
  align-items: center;
  color: #73685D !important;
}

.search-field svg {
  position: absolute;
  left: 11px;
  top: 50%;
  transform: translateY(-25%);
  color: #B19470;
}

.search-field input {
  width: 100%;
  padding: 9px 10px 9px 34px;
  border: 1px solid #E5DEC9;
  border-radius: 8px;
  text-transform: none;
  letter-spacing: 0;
  background: #fff;
}

.filter-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 24px;
  color: #73685D;
  font-size: 12px;
  background: #fff;
}

.filter-footer > span,
.presets {
  display: flex;
  gap: 8px;
  align-items: center;
}

.presets button {
  border: 0;
  background: #F8FAE5;
  color: #43766C;
  font-weight: 800;
  padding: 4px 10px;
  border-radius: 99px;
  cursor: pointer;
  font-size: 11.5px;
}

.presets button:hover {
  background: #43766C;
  color: #F8FAE5;
}

.records-table {
  margin: 0;
  font-size: 13px;
}

.records-table th {
  white-space: nowrap;
  background: #F8FAE5;
  color: #73685D;
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 12px 18px;
  cursor: pointer;
  border-bottom: 1px solid #E5DEC9;
}

.records-table th svg {
  vertical-align: middle;
}

.records-table td {
  padding: 13px 18px;
  border-color: #EFECE0;
  color: #26211D;
}

.records-table tr:hover td {
  background: #FBFCF4;
}

.records-table small {
  display: block;
  color: #73685D;
  margin-top: 3px;
}

.status,
.billing {
  display: inline-block;
  border-radius: 99px;
  padding: 5px 10px;
  font-size: 11px;
  font-weight: 800;
}

.status {
  background: color-mix(in srgb, var(--status, #43766C) 14%, white);
  color: var(--status, #43766C);
}

.billing {
  background: #F4EFE8;
  color: #76453B;
}

.billing.fully-paid {
  background: #E9F1EF;
  color: #43766C;
}

.billing.partially-paid {
  background: #F8FAE5;
  color: #B19470;
  border: 1px solid #B19470;
}

.action-group {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
}

.icon-button {
  border: 1px solid #E5DEC9;
  background: #F8FAE5;
  color: #43766C;
  border-radius: 8px;
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  cursor: pointer;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}

.icon-button:hover {
  background: #43766C;
  border-color: #43766C;
  color: #F8FAE5;
}

.icon-button.tan {
  background: #F4EFE8;
  color: #76453B;
}

.icon-button.tan:hover {
  background: #B19470;
  border-color: #B19470;
  color: #F8FAE5;
}

.icon-button.danger {
  background: #F6ECEA;
  color: #76453B;
  border-color: rgba(118, 69, 59, 0.22);
}

.icon-button.danger:hover {
  background: #76453B;
  border-color: #76453B;
  color: #F8FAE5;
}

.empty {
  text-align: center !important;
  padding: 55px !important;
  color: #73685D;
}

.empty svg,
.empty strong,
.empty span {
  display: block;
  margin: 0 auto 8px;
}

.empty strong {
  color: #26211D;
}

.pagination-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-top: 1px solid #E5DEC9;
  padding: 14px 24px;
  color: #73685D;
  font-size: 12px;
  background: #FBFCF4;
}

.pagination-bar div {
  display: flex;
  gap: 5px;
}

.pagination-bar button {
  min-width: 32px;
  height: 32px;
  border: 1px solid #E5DEC9;
  background: #fff;
  border-radius: 8px;
  color: #26211D;
  display: grid;
  place-items: center;
  font-size: 12px;
  font-weight: 700;
}

.pagination-bar button.active {
  background: #43766C;
  color: #F8FAE5;
  border-color: #43766C;
}

.pagination-bar button:disabled {
  opacity: 0.45;
}

@media (max-width: 1100px) {
  .filters {
    grid-template-columns: repeat(3, 1fr);
  }
  .search-field {
    grid-column: span 3;
  }
}

@media (max-width: 680px) {
  .records-heading,
  .filter-footer,
  .pagination-bar {
    padding-inline: 16px;
  }
  .filters {
    padding-inline: 16px;
    grid-template-columns: 1fr 1fr;
  }
  .search-field {
    grid-column: span 2;
  }
  .filter-footer {
    align-items: flex-start;
    gap: 8px;
    flex-direction: column;
  }
  .records-table th,
  .records-table td {
    padding: 12px;
  }
}
</style>
