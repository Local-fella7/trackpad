<script setup lang="ts">
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  CalendarClock,
  CalendarDays,
  Download,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  Layers,
  Printer,
  RefreshCw,
  Truck,
  Users,
  WalletCards,
} from 'lucide-vue-next'
import { formatDate, formatDateTime, formatReportPeriod } from '../../shared/date'

const props = defineProps<{
  report: any
  type: string
  day: string
  month: string
  days: number
  busyAction: string
  savedPath: string
  savedBytes: number
}>()

const emit = defineEmits<{
  preview: []
  excel: []
  pdf: []
  print: []
  'open-folder': []
  'update:type': [v: string]
  'update:day': [v: string]
  'update:month': [v: string]
  'update:days': [v: number]
}>()

const activeReportOpen = ref(false)

interface ReportCardInfo {
  id: string
  tag: string
  title: string
  description: string
  columnsHint: string
  accent: 'teal' | 'tan' | 'rust'
  icon: any
}

const reportCards: ReportCardInfo[] = [
  {
    id: 'general',
    tag: 'Master Register',
    title: 'General Orders Report',
    description: 'Comprehensive master register of all orders with dates, status, invoices, payments, and balances.',
    columnsHint: 'Order No · Client · Dates · Status · Total · Paid · Balance',
    accent: 'teal',
    icon: Layers,
  },
  {
    id: 'daily',
    tag: 'Daily Register',
    title: 'Daily Orders Report',
    description: 'Detailed daily log of orders booked on a selected date, including item lists, tax, and balances.',
    columnsHint: 'Order No · Client · Items Summary · Subtotal · Tax · Total',
    accent: 'teal',
    icon: CalendarDays,
  },
  {
    id: 'monthly',
    tag: 'Monthly Finance',
    title: 'Monthly Revenue Statement',
    description: 'Formal monthly accounting statement showing total billed, amount paid, and balance due per order.',
    columnsHint: 'Order Date · Order No · Invoice No · Client · Total · Paid · Balance',
    accent: 'teal',
    icon: FileText,
  },
  {
    id: 'unpaid-invoices',
    tag: 'Receivables',
    title: 'Outstanding Invoices',
    description: 'Debt collection statement listing unpaid and partially paid orders with aging days and client contacts.',
    columnsHint: 'Order Date · Invoice · Client · Contacts · Age Days · Balance Due',
    accent: 'rust',
    icon: WalletCards,
  },
  {
    id: 'upcoming-events',
    tag: 'Event Schedule',
    title: 'Upcoming Events Report',
    description: 'Operational schedule for upcoming events with countdown days, venue location, and required items.',
    columnsHint: 'Event Date · Days Left · Client · Location · Items / Services',
    accent: 'tan',
    icon: CalendarClock,
  },
  {
    id: 'delivery-due',
    tag: 'Logistics & Dispatch',
    title: 'Delivery Due Sheet',
    description: 'Dispatch checklist for confirmed and paid orders due for delivery in the next 3 days.',
    columnsHint: 'Event Date · Order/Delivery Form · Client · Location · Items',
    accent: 'tan',
    icon: Truck,
  },
  {
    id: 'status-summary',
    tag: 'Workflow Analytics',
    title: 'Order Status Summary',
    description: 'Executive summary of order volume, billed value, collected payments, and balances by status.',
    columnsHint: 'Workflow Status · Orders Count · Total Billed · Paid · Balance',
    accent: 'teal',
    icon: BarChart3,
  },
  {
    id: 'client-summary',
    tag: 'Client Accounts',
    title: 'Client Financial Summary',
    description: 'Account statement per client ranking total orders, last order date, total billed, paid, and balance.',
    columnsHint: 'Client · Contacts · Orders · Last Order · Billed · Paid · Balance',
    accent: 'rust',
    icon: Users,
  },
]

const currentCard = computed(() => reportCards.find(c => c.id === props.type) || reportCards[0]!)

function openReportCard(id: string) {
  activeReportOpen.value = true
  if (props.type !== id) {
    emit('update:type', id)
  } else {
    emit('preview')
  }
}

const numFormat = (n: unknown) => new Intl.NumberFormat('en-TZ', { maximumFractionDigits: 0 }).format(Number(n) || 0)
const money = (n: unknown) => `${numFormat(n)} TZS`
const fileSize = (bytes: number) => `${Math.max(1, Math.ceil(bytes / 1024))} KB`
const label = (key: string) => key.replaceAll('_', ' ').replace(/\b\w/g, char => char.toUpperCase())

interface ColumnDef {
  key: string
  label: string
  kind?: 'text' | 'date' | 'money' | 'number'
  total?: boolean
}

const columns = (report: any): ColumnDef[] => {
  if (Array.isArray(report?.columns) && report.columns.length) return report.columns
  const keys = Object.keys(report?.rows?.[0] || report?.summary?.[0] || {})
  const preferred = [
    'record_number',
    'client_name',
    'record_date',
    'event_date',
    'status_name',
    'grand_total_minor',
    'paid_minor',
    'balance_minor',
    'payment_status',
    'invoice_no',
    'location',
  ]
  const ordered = preferred
    .filter(key => keys.includes(key))
    .concat(
      keys
        .filter(
          key =>
            !preferred.includes(key) &&
            !['id', 'status_id', 'currency', 'deleted_at', 'created_at', 'updated_at'].includes(key),
        )
        .slice(0, 5),
    )
  return ordered.map(key => ({
    key,
    label: label(key),
    kind: key.includes('minor') ? 'money' : key.includes('date') ? 'date' : key === 'records' ? 'number' : 'text',
    total: key.includes('minor') || key === 'records',
  }))
}

const formatCell = (col: ColumnDef, value: unknown) => {
  if (col.kind === 'money' || col.key.includes('minor')) return money(value)
  if (col.kind === 'date' || col.key.includes('date')) return formatDate(value, '-')
  if (col.kind === 'number') return numFormat(value)
  const text = String(value ?? '').trim()
  return text || '-'
}

const sumColumn = (rows: any[], key: string) => (rows || []).reduce((sum, row) => sum + (Number(row[key]) || 0), 0)
</script>

<template>
  <section class="reports-shell">
    <!-- STAGE 1: 8-Card Report Directory Hub -->
    <template v-if="!activeReportOpen">
      <header class="reports-hero">
        <div>
          <span class="eyebrow">8 Formal Business Reports</span>
          <h2>Select a Report to Open</h2>
          <p>Choose any of the 8 specialized report cards below to filter, preview, print, or export to PDF and Excel.</p>
        </div>
      </header>

      <div class="report-cards-grid">
        <article
          v-for="(card, index) in reportCards"
          :key="card.id"
          class="report-hub-card"
          :class="card.accent"
          @click="openReportCard(card.id)"
        >
          <div class="card-top">
            <span class="card-icon" :class="card.accent">
              <component :is="card.icon" :size="20" />
            </span>
            <span class="card-tag">0{{ index + 1 }} · {{ card.tag }}</span>
          </div>

          <div class="card-body">
            <h3>{{ card.title }}</h3>
            <p>{{ card.description }}</p>
          </div>

          <div class="card-footer">
            <small>{{ card.columnsHint }}</small>
            <span class="open-link">
              Open report <ArrowRight :size="14" />
            </span>
          </div>
        </article>
      </div>
    </template>

    <!-- STAGE 2: Dedicated Full-Width Formal Report View -->
    <template v-else>
      <!-- Top Control & Filter Bar -->
      <div class="report-toolbar-card">
        <div class="toolbar-left">
          <button type="button" class="back-btn" @click="activeReportOpen = false">
            <ArrowLeft :size="16" />
            <span>All 8 Reports</span>
          </button>

          <div class="report-switcher">
            <label>
              <span>Report Type</span>
              <select
                class="form-select"
                :value="type"
                @change="emit('update:type', ($event.target as HTMLSelectElement).value)"
              >
                <option v-for="card in reportCards" :key="card.id" :value="card.id">
                  {{ card.title }}
                </option>
              </select>
            </label>
          </div>

          <!-- Contextual Filters for the Active Report -->
          <div v-if="type === 'daily'" class="filter-item">
            <label>
              <span>Report Date ({{ formatDate(day) }})</span>
              <input
                class="form-control"
                :value="day"
                type="date"
                @change="
                  emit('update:day', ($event.target as HTMLInputElement).value);
                  emit('preview')
                "
              />
            </label>
          </div>

          <div v-else-if="type === 'monthly'" class="filter-item">
            <label>
              <span>Report Month ({{ formatReportPeriod(month) }})</span>
              <input
                class="form-control"
                :value="month"
                type="month"
                @change="
                  emit('update:month', ($event.target as HTMLInputElement).value);
                  emit('preview')
                "
              />
            </label>
          </div>

          <div v-else-if="type === 'upcoming-events'" class="filter-item">
            <label>
              <span>Days Ahead</span>
              <input
                class="form-control"
                :value="days"
                type="number"
                min="1"
                max="365"
                @change="
                  emit('update:days', Number(($event.target as HTMLInputElement).value));
                  emit('preview')
                "
              />
            </label>
          </div>

          <button type="button" class="btn btn-light refresh-btn" :disabled="Boolean(busyAction)" @click="emit('preview')">
            <RefreshCw :size="15" :class="{ spinning: busyAction === 'preview' }" />
            {{ busyAction === 'preview' ? 'Generating...' : 'Refresh' }}
          </button>
        </div>

        <div class="report-actions">
          <button
            type="button"
            class="btn btn-light"
            :disabled="Boolean(busyAction) || !report"
            title="Save formal report as PDF"
            @click="emit('print')"
          >
            <Printer :size="16" /> {{ busyAction === 'print' ? 'Saving PDF...' : 'Print' }}
          </button>
          <button
            type="button"
            class="btn btn-light"
            :disabled="Boolean(busyAction) || !report"
            title="Export Excel workbook"
            @click="emit('excel')"
          >
            <FileSpreadsheet :size="16" /> Excel
          </button>
          <button
            type="button"
            class="btn btn-brand"
            :disabled="Boolean(busyAction) || !report"
            title="Save formal PDF report"
            @click="emit('pdf')"
          >
            <Download :size="16" /> {{ busyAction === 'pdf' ? 'Saving PDF...' : 'Save PDF' }}
          </button>
        </div>
      </div>

      <!-- Full-Width Formal Statement Document -->
      <main class="preview-card">
        <template v-if="report">
          <header class="preview-header">
            <div class="formal-title-block">
              <span class="eyebrow">TRACKPAD FORMAL STATEMENT · {{ currentCard.tag.toUpperCase() }}</span>
              <h1>{{ report.title || currentCard.title }}</h1>
              <p>{{ currentCard.description }}</p>
            </div>
            <div class="statement-meta">
              <div>
                <small>REPORTING PERIOD</small>
                <strong>{{ formatReportPeriod(report.period) }}</strong>
              </div>
              <div>
                <small>TOTAL RECORDS</small>
                <strong>{{ report.rows?.length || 0 }}</strong>
              </div>
              <div>
                <small>GENERATED ON</small>
                <strong>{{ formatDate(new Date()) }}</strong>
              </div>
            </div>
          </header>

          <div class="table-responsive report-table-wrap">
            <table class="table report-table align-middle">
              <thead>
                <tr>
                  <th
                    v-for="col in columns(report)"
                    :key="col.key"
                    :class="{ 'text-end': col.kind === 'money' || col.kind === 'number' }"
                  >
                    {{ col.label }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, index) in report.rows" :key="row.id || index">
                  <td
                    v-for="col in columns(report)"
                    :key="col.key"
                    :class="{ 'text-end fw-semibold': col.kind === 'money' || col.kind === 'number' }"
                  >
                    {{ formatCell(col, row[col.key]) }}
                  </td>
                </tr>
                <tr v-if="!report.rows?.length">
                  <td :colspan="columns(report).length" class="empty-table">No records match this report period.</td>
                </tr>
              </tbody>
              <tfoot v-if="report.rows?.length">
                <tr class="formal-total-row">
                  <td
                    v-for="(col, idx) in columns(report)"
                    :key="col.key"
                    :class="{ 'text-end': col.kind === 'money' || col.kind === 'number' }"
                  >
                    <template v-if="idx === 0">TOTAL ({{ report.rows.length }} records)</template>
                    <template v-else-if="col.total">
                      {{
                        col.kind === 'money'
                          ? money(sumColumn(report.rows, col.key))
                          : numFormat(sumColumn(report.rows, col.key))
                      }}
                    </template>
                    <template v-else></template>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <footer>
            <span>Trackpad Formal Report · Generated {{ formatDateTime(new Date()) }}</span>
            <span>All monetary values in Tanzanian Shillings (TZS) · Dates in dd-mm-yyyy</span>
          </footer>
        </template>

        <div v-else class="empty-preview">
          <span><FileText :size="30" /></span>
          <h2>Generating {{ currentCard.title }}…</h2>
          <p>Please wait or click Refresh above to load the statement.</p>
        </div>
      </main>
    </template>
  </section>
</template>

<style scoped>
.reports-shell {
  display: grid;
  gap: 18px;
}

.eyebrow {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #B19470;
}

.reports-hero h2 {
  font-size: 23px;
  font-weight: 800;
  color: #26211D;
  margin: 4px 0;
}

.reports-hero p {
  margin: 0;
  color: #73685D;
  font-size: 13px;
}

/* STAGE 1: 8-Card Grid */
.report-cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.report-hub-card {
  background: #FFFFFF;
  border: 1px solid #E5DEC9;
  border-top: 4px solid #43766C;
  border-radius: 16px;
  padding: 20px 22px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 14px;
  cursor: pointer;
  box-shadow: 0 8px 24px rgba(38, 33, 29, 0.04);
  transition: transform 0.16s ease, box-shadow 0.16s ease, border-color 0.16s ease;
}

.report-hub-card.tan {
  border-top-color: #B19470;
}

.report-hub-card.rust {
  border-top-color: #76453B;
}

.report-hub-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 14px 32px rgba(38, 33, 29, 0.09);
  border-color: #B19470;
}

.card-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
}

.card-icon {
  width: 42px;
  height: 42px;
  border-radius: 11px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}

.card-icon.teal {
  background: #E9F1EF;
  color: #43766C;
}

.card-icon.tan {
  background: #F4EFE8;
  color: #B19470;
}

.card-icon.rust {
  background: #F6ECEA;
  color: #76453B;
}

.card-tag {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: 4px 9px;
  border-radius: 99px;
  background: #F8FAE5;
  border: 1px solid #E5DEC9;
  color: #73685D;
}

.card-body h3 {
  margin: 0 0 6px;
  font-size: 17px;
  font-weight: 800;
  color: #26211D;
}

.card-body p {
  margin: 0;
  font-size: 12.5px;
  line-height: 1.5;
  color: #73685D;
}

.card-footer {
  padding-top: 12px;
  border-top: 1px solid #EFECE0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
}

.card-footer small {
  font-size: 10.5px;
  color: #73685D;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.open-link {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  font-weight: 800;
  color: #43766C;
  white-space: nowrap;
}

/* STAGE 2: Toolbar & Full-Width Report View */
.report-toolbar-card {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: 14px;
  padding: 16px 20px;
  background: #FFFFFF;
  border: 1px solid #E5DEC9;
  border-radius: 15px;
  box-shadow: 0 6px 20px rgba(38, 33, 29, 0.04);
}

.toolbar-left {
  display: flex;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: 12px;
}

.back-btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  border: 1px solid #E5DEC9;
  background: #F8FAE5;
  color: #43766C;
  font-weight: 800;
  font-size: 12.5px;
  padding: 9px 14px;
  border-radius: 9px;
  cursor: pointer;
  height: 38px;
}

.back-btn:hover {
  background: #43766C;
  border-color: #43766C;
  color: #F8FAE5;
}

.report-switcher label,
.filter-item label {
  display: grid;
  gap: 4px;
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #73685D;
}

.report-switcher .form-select,
.filter-item .form-control {
  font-size: 13px;
  font-weight: 700;
  height: 38px;
  border-color: #E5DEC9;
  border-radius: 9px;
  min-width: 190px;
}

.refresh-btn {
  height: 38px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  font-weight: 800;
  background: #F8FAE5;
  border-color: #E5DEC9;
  color: #26211D;
  border-radius: 9px;
}

.btn-brand {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  border: 1px solid #43766C;
  background: #43766C;
  color: #F8FAE5;
  font-weight: 800;
  border-radius: 9px;
  padding: 9px 15px;
  height: 38px;
}

.btn-brand:hover,
.btn-brand:disabled {
  background: #345d55;
  border-color: #345d55;
  color: #F8FAE5;
}

.report-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.report-actions .btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  font-weight: 800;
  height: 38px;
  border-radius: 9px;
}

.report-actions .btn-light {
  background: #F8FAE5;
  border-color: #E5DEC9;
  color: #26211D;
}

.preview-card {
  border: 1px solid #E5DEC9;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 8px 24px rgba(38, 33, 29, 0.05);
  min-height: 560px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 18px;
  padding: 22px 24px;
  border-bottom: 2px solid #43766C;
  background: #FBFCF4;
}

.preview-header h1 {
  font-size: 22px;
  font-weight: 800;
  color: #26211D;
  margin: 4px 0 6px;
}

.preview-header p {
  margin: 0;
  color: #73685D;
  font-size: 12.5px;
}

.statement-meta {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.statement-meta > div {
  background: #F8FAE5;
  border: 1px solid #E5DEC9;
  border-radius: 10px;
  padding: 8px 13px;
  min-width: 115px;
}

.statement-meta small {
  display: block;
  font-size: 9.5px;
  font-weight: 800;
  letter-spacing: 0.08em;
  color: #73685D;
}

.statement-meta strong {
  display: block;
  font-size: 13.5px;
  font-weight: 800;
  color: #43766C;
  margin-top: 2px;
}

.save-success {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 16px 24px 0;
  padding: 11px 14px;
  border: 1px solid #B19470;
  background: #F8FAE5;
  border-radius: 10px;
  color: #43766C;
}

.save-success span {
  min-width: 0;
  flex: 1;
}

.save-success b,
.save-success small {
  display: block;
}

.save-success small {
  margin-top: 2px;
  color: #73685D;
  font-size: 11px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.save-success button {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  white-space: nowrap;
}

.report-table-wrap {
  flex: 1;
}

.report-table {
  margin: 0;
  font-size: 12.5px;
}

.report-table th {
  background: #43766C;
  color: #F8FAE5;
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 12px 14px;
  white-space: nowrap;
  border-bottom: 1px solid #345d55;
}

.report-table td {
  padding: 11px 14px;
  border-color: #EFECE0;
  color: #26211D;
}

.report-table tbody tr:nth-child(even) td {
  background: #FBFCF4;
}

.formal-total-row td {
  background: #F8FAE5 !important;
  border-top: 2px solid #43766C !important;
  border-bottom: 2px solid #43766C !important;
  font-weight: 800;
  font-size: 13px;
  color: #26211D;
  padding: 13px 14px;
}

.empty-table {
  text-align: center;
  color: #73685D;
  padding: 45px !important;
}

.preview-card footer {
  padding: 12px 24px;
  border-top: 1px solid #E5DEC9;
  color: #73685D;
  font-size: 11px;
  background: #FBFCF4;
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
}

.empty-preview {
  min-height: 480px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.empty-preview > span {
  display: grid;
  place-items: center;
  width: 65px;
  height: 65px;
  border-radius: 50%;
  background: #F8FAE5;
  border: 1px solid #E5DEC9;
  color: #43766C;
}

.empty-preview h2 {
  font-size: 19px;
  font-weight: 800;
  margin: 15px 0 5px;
}

.empty-preview p {
  margin: 0;
  color: #73685D;
}

.spinning {
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 720px) {
  .report-toolbar-card {
    flex-direction: column;
    align-items: stretch;
  }
  .report-actions {
    justify-content: flex-start;
  }
}
</style>
