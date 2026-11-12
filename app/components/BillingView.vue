<script setup lang="ts">
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Eye,
  Filter,
  Plus,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Trash2,
  WalletCards,
  X,
} from 'lucide-vue-next'
import Swal from 'sweetalert2'
import { formatDate } from '../../shared/date'

const emit = defineEmits<{ refresh: [] }>()

const rows = ref<any[]>([])
const selected = ref<any | null>(null)
const payments = ref<any[]>([])
const busy = ref(false)
const paymentModal = ref(false)
const historyModal = ref(false)

const search = ref('')
const statusFilter = ref('')
const orderStatusFilter = ref('')
const dateFrom = ref('')
const dateTo = ref('')
const sort = ref('record_date')
const direction = ref<'asc' | 'desc'>('desc')
const page = ref(1)
const pageSize = ref(10)

const form = reactive({
  amountMinor: 0,
  paymentDate: new Date().toISOString().slice(0, 10),
  method: '',
  reference: '',
  notes: '',
})

const money = (n: unknown) =>
  `${new Intl.NumberFormat('en-TZ', { maximumFractionDigits: 0 }).format(Number(n) || 0)} TZS`
const date = (v?: string) => formatDate(v, '—')

const filteredRows = computed(() => {
  const query = search.value.trim().toLowerCase()
  return rows.value
    .filter(row => {
      if (query && !`${row.record_number || ''} ${row.client_name || ''} ${row.invoice_no || ''}`.toLowerCase().includes(query))
        return false
      if (statusFilter.value && row.payment_status !== statusFilter.value) return false
      if (orderStatusFilter.value && row.status_name !== orderStatusFilter.value) return false
      if (dateFrom.value && String(row.record_date || '') < dateFrom.value) return false
      if (dateTo.value && String(row.record_date || '') > dateTo.value) return false
      return true
    })
    .sort(
      (a, b) =>
        (direction.value === 'asc' ? 1 : -1) *
        String(a[sort.value] ?? '').localeCompare(String(b[sort.value] ?? ''), undefined, { numeric: true }),
    )
})

const totalPages = computed(() => Math.max(1, Math.ceil(filteredRows.value.length / pageSize.value)))
const visibleRows = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return filteredRows.value.slice(start, start + pageSize.value)
})
const pages = computed(() =>
  Array.from(
    { length: Math.min(totalPages.value, 5) },
    (_, index) => Math.max(1, Math.min(totalPages.value - 4, page.value - 2)) + index,
  ),
)

watch([totalPages, filteredRows], () => {
  if (page.value > totalPages.value) {
    page.value = Math.max(1, totalPages.value)
  }
})

function resetFilters() {
  search.value = ''
  statusFilter.value = ''
  orderStatusFilter.value = ''
  dateFrom.value = ''
  dateTo.value = ''
  page.value = 1
}

function toggleSort(key: string) {
  direction.value = sort.value === key ? (direction.value === 'asc' ? 'desc' : 'asc') : 'asc'
  sort.value = key
}

async function load() {
  const response: any = await window.api!.billing!.list()
  if (!response.ok) throw new Error(response.error.message)
  rows.value = response.data || []
}

async function loadPaymentsFor(row: any) {
  selected.value = row
  const response: any = await window.api!.billing!.payments(row.id)
  if (!response.ok) {
    await Swal.fire({ icon: 'error', title: 'Could not load payments', text: response.error.message })
    payments.value = []
    return
  }
  payments.value = response.data || []
}

async function openHistory(row: any) {
  await loadPaymentsFor(row)
  historyModal.value = true
}

async function openRecordPayment(row: any) {
  await loadPaymentsFor(row)
  const remaining = Math.max(0, Number(row.grand_total_minor || 0) - Number(row.paid_minor || 0))
  Object.assign(form, {
    amountMinor: remaining,
    paymentDate: new Date().toISOString().slice(0, 10),
    method: 'Cash',
    reference: '',
    notes: '',
  })
  paymentModal.value = true
}

async function add() {
  if (!selected.value || Number(form.amountMinor) <= 0) {
    await Swal.fire({ icon: 'warning', title: 'Enter a valid payment amount' })
    return
  }
  busy.value = true
  try {
    const response: any = await window.api!.billing!.add({
      recordId: Number(selected.value.id),
      amountMinor: Math.round(Number(form.amountMinor)),
      paymentDate: form.paymentDate,
      method: form.method,
      reference: form.reference,
      notes: form.notes,
    })
    if (!response.ok) {
      await Swal.fire({ icon: 'error', title: 'Payment not saved', text: response.error.message })
      return
    }
    paymentModal.value = false
    await load()
    const updatedRow = rows.value.find(row => row.id === selected.value?.id) || selected.value
    await loadPaymentsFor(updatedRow)
    emit('refresh')
    await Swal.fire({ icon: 'success', title: 'Payment recorded', timer: 1800, showConfirmButton: false })
  } finally {
    busy.value = false
  }
}

async function remove(id: number) {
  const result = await Swal.fire({
    title: 'Delete this payment?',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Delete payment',
    confirmButtonColor: '#76453B',
  })
  if (!result.isConfirmed) return
  const response: any = await window.api!.billing!.remove(id)
  if (!response.ok) {
    await Swal.fire({ icon: 'error', title: 'Could not delete payment', text: response.error.message })
    return
  }
  await load()
  if (selected.value) {
    const updatedRow = rows.value.find(row => row.id === selected.value?.id) || selected.value
    await loadPaymentsFor(updatedRow)
  }
  emit('refresh')
  await Swal.fire({ icon: 'success', title: 'Payment deleted', timer: 1800, showConfirmButton: false })
}

onMounted(load)
</script>

<template>
  <section class="records-card">
    <header class="records-heading">
      <div>
        <span class="eyebrow">Accounts & Receivables</span>
        <h2>Order Billing Register</h2>
        <p>{{ filteredRows.length }} billing account{{ filteredRows.length === 1 ? '' : 's' }} found · Dates in dd-mm-yyyy</p>
      </div>
      <button class="btn btn-light icon-label" type="button" @click="resetFilters">
        <RotateCcw :size="15" /> Reset filters
      </button>
    </header>

    <div class="filters">
      <label class="search-field">
        <Search :size="17" />
        <input v-model="search" placeholder="Search client, order number or invoice" @input="page = 1" />
      </label>
      <label>
        <span>From ({{ dateFrom ? date(dateFrom) : 'dd-mm-yyyy' }})</span>
        <input v-model="dateFrom" class="form-control" type="date" @change="page = 1" />
      </label>
      <label>
        <span>To ({{ dateTo ? date(dateTo) : 'dd-mm-yyyy' }})</span>
        <input v-model="dateTo" class="form-control" type="date" @change="page = 1" />
      </label>
      <label>
        <span>Order Status</span>
        <select v-model="orderStatusFilter" class="form-select" @change="page = 1">
          <option value="">All statuses</option>
          <option value="Pending">Pending</option>
          <option value="Confirmed">Confirmed</option>
          <option value="Completed">Completed</option>
          <option value="Cancelled">Cancelled</option>
        </select>
      </label>
      <label>
        <span>Payment Status</span>
        <select v-model="statusFilter" class="form-select" @change="page = 1">
          <option value="">All billing</option>
          <option value="Pending">Pending (Unpaid)</option>
          <option value="Partially Paid">Partially Paid</option>
          <option value="Fully Paid">Fully Paid</option>
        </select>
      </label>
    </div>

    <div class="filter-footer">
      <div class="presets">
        <WalletCards :size="15" />
        <button type="button" :class="{ active: statusFilter === '' }" @click="statusFilter = ''; page = 1">All</button>
        <button type="button" :class="{ active: statusFilter === 'Pending' }" @click="statusFilter = 'Pending'; page = 1">
          Unpaid
        </button>
        <button
          type="button"
          :class="{ active: statusFilter === 'Partially Paid' }"
          @click="statusFilter = 'Partially Paid'; page = 1"
        >
          Partially Paid
        </button>
        <button
          type="button"
          :class="{ active: statusFilter === 'Fully Paid' }"
          @click="statusFilter = 'Fully Paid'; page = 1"
        >
          Fully Paid
        </button>
      </div>
      <span>
        <Filter :size="14" />
        {{ [search, dateFrom, dateTo, orderStatusFilter, statusFilter].filter(Boolean).length }} active filters
      </span>
    </div>

    <div class="table-responsive">
      <table class="table align-middle records-table">
        <thead>
          <tr>
            <th @click="toggleSort('record_number')">Order No <ChevronDown :size="13" /></th>
            <th @click="toggleSort('client_name')">Client <ChevronDown :size="13" /></th>
            <th @click="toggleSort('record_date')">Order Date <ChevronDown :size="13" /></th>
            <th @click="toggleSort('status_name')">Status <ChevronDown :size="13" /></th>
            <th class="text-end" @click="toggleSort('grand_total_minor')">Total Billed <ChevronDown :size="13" /></th>
            <th class="text-end" @click="toggleSort('paid_minor')">Paid <ChevronDown :size="13" /></th>
            <th class="text-end" @click="toggleSort('balance_minor')">Balance Due <ChevronDown :size="13" /></th>
            <th>Billing</th>
            <th class="text-end">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in visibleRows" :key="row.id">
            <td>
              <strong>{{ row.record_number || `ORD-${String(row.id).padStart(4, '0')}` }}</strong>
            </td>
            <td>
              <strong>{{ row.client_name }}</strong>
              <small>{{ row.contacts || 'No contact details' }}</small>
            </td>
            <td>{{ date(row.record_date) }}</td>
            <td>
              <span class="status" :style="{ '--status': row.status_color || '#43766C' }">{{ row.status_name || 'Pending' }}</span>
            </td>
            <td class="text-end">
              <strong>{{ money(row.grand_total_minor) }}</strong>
            </td>
            <td class="text-end teal-text">
              <strong>{{ money(row.paid_minor) }}</strong>
            </td>
            <td class="text-end" :class="{ 'rust-text fw-bold': row.grand_total_minor - row.paid_minor > 0 }">
              {{ money(Math.max(0, row.grand_total_minor - row.paid_minor)) }}
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
                  title="View payment history"
                  aria-label="View payment history"
                  @click="openHistory(row)"
                >
                  <Eye :size="15" />
                </button>
                <button
                  type="button"
                  class="pay-btn"
                  :disabled="row.paid_minor >= row.grand_total_minor"
                  title="Record payment for this order"
                  @click="openRecordPayment(row)"
                >
                  <Plus :size="14" />
                  <span>{{ row.paid_minor >= row.grand_total_minor ? 'Settled' : 'Pay' }}</span>
                </button>
              </div>
            </td>
          </tr>
          <tr v-if="!visibleRows.length">
            <td colspan="9" class="empty">
              <SlidersHorizontal :size="28" />
              <strong>No billing accounts match these filters.</strong>
              <span>Try changing the search or resetting the filters.</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <footer class="pagination-bar">
      <div class="pagination-info">
        <span>
          Showing {{ filteredRows.length ? (page - 1) * pageSize + 1 : 0 }}–{{
            Math.min(page * pageSize, filteredRows.length)
          }}
          of {{ filteredRows.length }}
        </span>
        <label class="page-size-selector">
          <span>Rows per page:</span>
          <select v-model.number="pageSize" @change="page = 1">
            <option :value="10">10</option>
            <option :value="20">20</option>
            <option :value="50">50</option>
            <option :value="100">100</option>
          </select>
        </label>
      </div>
      <div class="pagination-controls">
        <button type="button" :disabled="page <= 1" title="First page" aria-label="First page" @click="page = 1">
          <ChevronsLeft :size="16" />
        </button>
        <button type="button" :disabled="page <= 1" title="Previous page" aria-label="Previous page" @click="page--">
          <ChevronLeft :size="16" />
        </button>
        <button
          v-for="item in pages"
          :key="item"
          type="button"
          :class="{ active: item === page }"
          @click="page = item"
        >
          {{ item }}
        </button>
        <button
          type="button"
          :disabled="page >= totalPages"
          title="Next page"
          aria-label="Next page"
          @click="page++"
        >
          <ChevronRight :size="16" />
        </button>
        <button
          type="button"
          :disabled="page >= totalPages"
          title="Last page"
          aria-label="Last page"
          @click="page = totalPages"
        >
          <ChevronsRight :size="16" />
        </button>
      </div>
    </footer>

    <!-- Payment History & Account Modal -->
    <div v-if="historyModal && selected" class="payment-modal-backdrop" @mousedown.self="historyModal = false">
      <div class="payment-modal wide">
        <header>
          <div>
            <span class="eyebrow">PAYMENT ACCOUNT · {{ date(selected.record_date) }}</span>
            <h2>{{ selected.record_number || `ORD-${String(selected.id).padStart(4, '0')}` }} — {{ selected.client_name }}</h2>
          </div>
          <button type="button" class="close-button" aria-label="Close" @click="historyModal = false">
            <X :size="18" />
          </button>
        </header>

        <div class="summary-grid">
          <article>
            <span>Total Billed</span>
            <strong>{{ money(selected.grand_total_minor) }}</strong>
          </article>
          <article class="paid">
            <span>Total Paid</span>
            <strong>{{ money(selected.paid_minor) }}</strong>
          </article>
          <article class="balance">
            <span>Balance Due</span>
            <strong>{{ money(Math.max(0, selected.grand_total_minor - selected.paid_minor)) }}</strong>
          </article>
        </div>

        <div class="table-heading">
          <h3>Payment History ({{ payments.length }})</h3>
          <button
            v-if="selected.paid_minor < selected.grand_total_minor"
            type="button"
            class="btn btn-brand btn-sm"
            @click="
              historyModal = false;
              openRecordPayment(selected)
            "
          >
            <Plus :size="14" /> Record payment
          </button>
        </div>

        <div class="table-responsive">
          <table class="table payment-table align-middle">
            <thead>
              <tr>
                <th>Payment Date</th>
                <th>Amount</th>
                <th>Method</th>
                <th>Reference</th>
                <th>Notes</th>
                <th class="text-end">Action</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="payment in payments" :key="payment.id">
                <td>{{ date(payment.payment_date) }}</td>
                <td>
                  <strong>{{ money(payment.amount_minor) }}</strong>
                </td>
                <td>{{ payment.method || '—' }}</td>
                <td>{{ payment.reference || '—' }}</td>
                <td>{{ payment.notes || '—' }}</td>
                <td class="text-end">
                  <button
                    type="button"
                    class="icon-button danger"
                    title="Delete payment"
                    aria-label="Delete payment"
                    @click="remove(payment.id)"
                  >
                    <Trash2 :size="14" />
                  </button>
                </td>
              </tr>
              <tr v-if="!payments.length">
                <td colspan="6" class="empty-table">No payments recorded for this order yet.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <footer>
          <button type="button" class="btn btn-light" @click="historyModal = false">Close</button>
        </footer>
      </div>
    </div>

    <!-- Record Payment Modal -->
    <div v-if="paymentModal && selected" class="payment-modal-backdrop" @mousedown.self="paymentModal = false">
      <form class="payment-modal" @submit.prevent="add">
        <header>
          <div>
            <span class="eyebrow">RECORD PAYMENT · {{ selected.record_number || selected.client_name }}</span>
            <h2>{{ selected.client_name }}</h2>
          </div>
          <button type="button" class="close-button" aria-label="Close" @click="paymentModal = false">
            <X :size="18" />
          </button>
        </header>

        <div class="summary-grid compact">
          <article>
            <span>Order Total</span>
            <strong>{{ money(selected.grand_total_minor) }}</strong>
          </article>
          <article class="paid">
            <span>Already Paid</span>
            <strong>{{ money(selected.paid_minor) }}</strong>
          </article>
          <article class="balance">
            <span>Remaining Balance</span>
            <strong>{{ money(Math.max(0, selected.grand_total_minor - selected.paid_minor)) }}</strong>
          </article>
        </div>

        <div class="modal-fields">
          <label class="form-label">
            Amount (TZS) *
            <input
              v-model.number="form.amountMinor"
              type="number"
              min="1"
              step="1"
              :max="Math.max(1, selected.grand_total_minor - selected.paid_minor)"
              class="form-control"
              required
            />
          </label>
          <label class="form-label">
            Payment date ({{ date(form.paymentDate) }}) *
            <input v-model="form.paymentDate" type="date" class="form-control" required />
          </label>
          <label class="form-label">
            Method
            <select v-model="form.method" class="form-select">
              <option value="">Select method</option>
              <option>Cash</option>
              <option>Bank transfer</option>
              <option>Mobile money</option>
              <option>Card</option>
            </select>
          </label>
          <label class="form-label">
            Reference
            <input v-model="form.reference" class="form-control" placeholder="Receipt or transaction ID" />
          </label>
          <label class="form-label notes-field">
            Notes
            <textarea v-model="form.notes" rows="2" class="form-control" placeholder="Optional payment note"></textarea>
          </label>
        </div>

        <footer>
          <button type="button" class="btn btn-light" @click="paymentModal = false">Cancel</button>
          <button class="btn btn-brand" :disabled="busy">{{ busy ? 'Saving…' : 'Save payment' }}</button>
        </footer>
      </form>
    </div>
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

.presets button:hover,
.presets button.active {
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

.teal-text {
  color: #43766C;
}

.rust-text {
  color: #76453B;
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
  align-items: center;
  gap: 6px;
}

.icon-button {
  border: 1px solid #E5DEC9;
  background: #F8FAE5;
  color: #43766C;
  border-radius: 8px;
  width: 32px;
  height: 32px;
  display: inline-grid;
  place-items: center;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.icon-button:hover {
  background: #43766C;
  color: #F8FAE5;
}

.icon-button.danger {
  background: #F6ECEA;
  color: #76453B;
  border-color: rgba(118, 69, 59, 0.22);
}

.icon-button.danger:hover {
  background: #76453B;
  color: #F8FAE5;
}

.pay-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border: 1px solid #43766C;
  background: #43766C;
  color: #F8FAE5;
  border-radius: 8px;
  height: 32px;
  padding: 0 11px;
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
}

.pay-btn:hover:not(:disabled) {
  background: #345d55;
}

.pay-btn:disabled {
  background: #EFECE0;
  border-color: #E5DEC9;
  color: #73685D;
  cursor: default;
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

.pagination-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-top: 1px solid #E5DEC9;
  padding: 14px 24px;
  color: #73685D;
  font-size: 12px;
  background: #FBFCF4;
  flex-wrap: wrap;
  gap: 12px;
}

.pagination-info {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.page-size-selector {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #73685D;
}

.page-size-selector select {
  padding: 3px 24px 3px 8px;
  font-size: 12px;
  border: 1px solid #E5DEC9;
  border-radius: 6px;
  background-color: #fff;
  color: #26211D;
  cursor: pointer;
}

.page-size-selector select:focus {
  border-color: #43766C;
  outline: none;
}

.pagination-controls {
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
  cursor: pointer;
  transition: all 0.15s ease;
}

.pagination-bar button:hover:not(:disabled) {
  background: #F8FAE5;
  border-color: #43766C;
  color: #43766C;
}

.pagination-bar button.active {
  background: #43766C;
  color: #F8FAE5;
  border-color: #43766C;
}

.pagination-bar button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

/* Modals */
.payment-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(38, 33, 29, 0.52);
  z-index: 100;
  display: grid;
  place-items: center;
  backdrop-filter: blur(3px);
  padding: 20px;
}

.payment-modal {
  width: min(640px, calc(100vw - 32px));
  max-height: calc(100vh - 40px);
  overflow: auto;
  background: #fff;
  border: 1px solid #E5DEC9;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 24px 60px rgba(38, 33, 29, 0.22);
}

.payment-modal.wide {
  width: min(820px, calc(100vw - 32px));
}

.payment-modal header,
.payment-modal footer,
.table-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.payment-modal header {
  border-bottom: 1px solid #E5DEC9;
  padding-bottom: 14px;
}

.payment-modal h2 {
  font-size: 20px;
  font-weight: 800;
  color: #26211D;
  margin: 4px 0 0;
}

.close-button {
  border: 1px solid #E5DEC9;
  background: #F8FAE5;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  color: #43766C;
  cursor: pointer;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  padding: 16px 0;
}

.summary-grid article {
  padding: 13px 15px;
  border-radius: 11px;
  background: #FBFCF4;
  border: 1px solid #E5DEC9;
}

.summary-grid .paid {
  background: #E9F1EF;
  border-color: #cce0dc;
  color: #43766C;
}

.summary-grid .balance {
  background: #F6ECEA;
  border-color: #e6cfc9;
  color: #76453B;
}

.summary-grid span {
  display: block;
  color: #73685D;
  font-size: 10.5px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 5px;
}

.summary-grid strong {
  font-size: 17px;
  font-weight: 800;
}

.table-heading {
  padding: 4px 0 10px;
}

.table-heading h3 {
  font-size: 15px;
  font-weight: 800;
  margin: 0;
}

.payment-table {
  margin: 0;
  font-size: 13px;
  border: 1px solid #E5DEC9;
}

.payment-table thead th {
  background: #F8FAE5;
  color: #73685D;
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 10px 14px;
}

.payment-table td {
  border-color: #EFECE0;
  padding: 11px 14px;
}

.empty-table {
  text-align: center;
  color: #73685D;
  padding: 28px !important;
}

.modal-fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  padding: 6px 0 18px;
}

.modal-fields label {
  font-size: 12px;
  font-weight: 800;
  color: #26211D;
}

.modal-fields .notes-field {
  grid-column: span 2;
}

.payment-modal footer {
  border-top: 1px solid #E5DEC9;
  padding-top: 16px;
  justify-content: flex-end;
  gap: 10px;
}

.btn-brand {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid #43766C;
  background: #43766C;
  color: #F8FAE5;
  font-weight: 800;
  border-radius: 9px;
  padding: 9px 15px;
}

.btn-brand:hover,
.btn-brand:disabled {
  background: #345d55;
  border-color: #345d55;
  color: #F8FAE5;
}

.payment-modal footer .btn-light {
  border: 1px solid #E5DEC9;
  background: #F8FAE5;
  color: #26211D;
  font-weight: 700;
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
  .filters {
    grid-template-columns: 1fr 1fr;
  }
  .search-field {
    grid-column: span 2;
  }
  .summary-grid,
  .modal-fields {
    grid-template-columns: 1fr;
  }
  .modal-fields .notes-field {
    grid-column: span 1;
  }
}
</style>
