<script setup lang="ts">
import { CalendarDays, Check, Edit3, Plus, Printer, RefreshCw, ShieldCheck, Trash2, X } from 'lucide-vue-next'
import Swal from 'sweetalert2'
import { formatDate } from '../../shared/date'
import { cloneIpcPayload, cloneRecordItems } from '../../shared/record-payload'
import AppSidebar, { type Page } from '../components/AppSidebar.vue'
import BillingView from '../components/BillingView.vue'

type Row = Record<string, any>

const page = ref<Page>('dashboard')
const user = ref<any>(null)
const auth = ref<'setup' | 'login' | 'recover'>('login')
const busy = ref(false)
const error = ref('')
const notice = ref('')
const search = ref('')
const recordFilter = ref('')
const recordDateFrom = ref('')
const recordDateTo = ref('')
const recordStatus = ref('')
const recordPage = ref(1)
const recordPageSize = ref(25)
const recordTotal = ref(0)
const recordTotalPages = ref(1)
const rows = ref<Row[]>([])
const statuses = ref<any[]>([])
const dashboard = ref<any>(null)

const modal = ref(false)
const viewModal = ref(false)
const viewDetail = ref<{ record: Record<string, any>; items: Record<string, any>[] } | null>(null)
const step = ref(1)
const editId = ref<number | null>(null)
const showPassword = ref(false)
const confirmPassword = ref('')
const legacyPrompt = ref(false)

const credentials = reactive({
  username: '',
  displayName: '',
  password: '',
  recoveryKey: '',
  newPassword: '',
})

const password = computed({
  get: () => (auth.value === 'recover' ? credentials.newPassword : credentials.password),
  set: v => (auth.value === 'recover' ? (credentials.newPassword = v) : (credentials.password = v)),
})

const needsConfirmation = computed(() => auth.value === 'setup' || auth.value === 'recover')

const empty = () => ({
  recordDate: new Date().toISOString().slice(0, 10),
  recordNumber: '',
  clientName: '',
  contacts: '',
  location: '',
  sourceOfInfo: '',
  eventDate: '',
  proformaNo: '',
  invoiceNo: '',
  orderFormNo: '',
  deliveryFormNo: '',
  statusId: 0,
  taxRateBasisPoints: 0,
  notes: '',
  items: [{ description: '', quantity: 1, unitPrice: 0 }],
})

const form = reactive(empty())
const subtotal = computed(() =>
  form.items.reduce((sum, item) => sum + Math.round(Number(item.quantity || 0) * Number(item.unitPrice || 0)), 0),
)
const tax = computed(() => Math.round((subtotal.value * Number(form.taxRateBasisPoints || 0)) / 10000))
const total = computed(() => subtotal.value + tax.value)

const money = (n: number) => `${new Intl.NumberFormat('en-TZ', { maximumFractionDigits: 0 }).format(Number(n) || 0)} TZS`
const date = (value?: string) => formatDate(value, '—')
const todayLabel = computed(() => formatDate(new Date()))

const pageMeta = computed(() => {
  if (page.value === 'dashboard') {
    return {
      eyebrow: 'EXECUTIVE OVERVIEW',
      title: `Good day, ${user.value?.displayName?.split(' ')[0] || 'there'}`,
      subtitle: 'Track revenue, monthly event schedule, and client balances at a glance.',
    }
  }
  if (page.value === 'orders') {
    return {
      eyebrow: 'ORDER MANAGEMENT',
      title: 'Orders Register',
      subtitle: 'Create, view, print item lists, edit, or delete client orders.',
    }
  }
  if (page.value === 'billing') {
    return {
      eyebrow: 'BILLING & PAYMENTS',
      title: 'Billing & Accounts',
      subtitle: 'Record client payments and monitor outstanding balances.',
    }
  }
  return {
    eyebrow: 'REPORTING CENTRE',
    title: 'Reports & Exports',
    subtitle: 'Generate, print, and export formal PDF or Excel statements.',
  }
})

const stepLabels = ['Order details', 'Items & totals', 'Documents & notes', 'Review & save']

const fail = (message?: string) => {
  const text = message || 'Something went wrong. Please try again.'
  error.value = text
  if (user.value || auth.value === 'login') void Swal.fire({ icon: 'error', title: 'Error', text })
  return text
}

function changeAuth(next: 'setup' | 'login' | 'recover') {
  auth.value = next
  error.value = ''
  confirmPassword.value = ''
  showPassword.value = false
}

const notify = (message: string) => {
  notice.value = message
  void Swal.fire({ icon: 'success', title: message, timer: 2200, showConfirmButton: false })
}

async function timed<T>(name: string, operation: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${name} is taking longer than 10 seconds.`)), 10000)
  })
  try {
    return await Promise.race([operation, timeout])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

async function load() {
  const tasks = [
    window.api!.statuses.list().then((r: any) => {
      if (!r.ok) throw new Error(r.error.message)
      statuses.value = r.data
    }),
    window.api!.records
      .list({
        search: search.value,
        filter: recordFilter.value,
        dateFrom: recordDateFrom.value,
        dateTo: recordDateTo.value,
        status: recordStatus.value,
        page: recordPage.value,
        pageSize: recordPageSize.value,
      })
      .then((r: any) => {
        if (!r.ok) throw new Error(r.error.message)
        rows.value = r.data.rows
        recordTotal.value = r.data.total
        recordTotalPages.value = r.data.totalPages
        recordPage.value = r.data.page
      }),
    window.api!.dashboard.data().then((r: any) => {
      if (!r.ok) throw new Error(r.error.message)
      dashboard.value = r.data
    }),
  ]
  const results = await Promise.allSettled(tasks)
  const rejected = results.find((item): item is PromiseRejectedResult => item.status === 'rejected')
  if (rejected) fail(rejected.reason?.message)
}

async function checkLegacy() {
  const r: any = await window.api!.records.legacyStatus()
  if (r.ok && r.data.count > 0 && !r.data.decided) legacyPrompt.value = true
}

async function boot() {
  const r: any = await window.api?.auth.status()
  if (!r?.ok) return fail(r?.error?.message)
  user.value = r.data.user
  auth.value = r.data.hasUser ? 'login' : 'setup'
  if (user.value) {
    await load()
    await checkLegacy()
  }
}

async function signIn() {
  if (needsConfirmation.value && password.value !== confirmPassword.value) return fail('Passwords do not match.')
  busy.value = true
  error.value = ''
  try {
    let r: any
    if (auth.value === 'setup') {
      const status: any = await window.api!.auth.status()
      if (status.data.hasUser) {
        changeAuth('login')
        notice.value = 'A workspace already exists. Sign in to continue.'
        return
      }
      r = await timed(
        'Workspace creation',
        window.api!.auth.setup({
          username: credentials.username,
          displayName: credentials.displayName,
          password: credentials.password,
        }),
      )
    } else if (auth.value === 'login') {
      r = await timed('Sign in', window.api!.auth.login({ username: credentials.username, password: credentials.password }))
    } else {
      r = await timed(
        'Password reset',
        window.api!.auth.recover({
          username: credentials.username,
          recoveryKey: credentials.recoveryKey,
          newPassword: credentials.newPassword,
        }),
      )
    }
    if (!r.ok) return fail(r.error.message)
    if (auth.value === 'recover') {
      notice.value = `Password reset. New recovery key: ${r.data.recoveryKey}`
      changeAuth('login')
      return
    }
    user.value = auth.value === 'setup' ? r.data.user : r.data
    if (auth.value === 'setup') notice.value = `Workspace created. Save this recovery key: ${r.data.recoveryKey}`
    await load()
    await checkLegacy()
  } catch (reason) {
    fail(reason instanceof Error ? reason.message : 'Could not complete your request.')
  } finally {
    busy.value = false
  }
}

async function logout() {
  try {
    await window.api?.auth.logout()
  } finally {
    busy.value = false
    user.value = null
    credentials.password = ''
    credentials.newPassword = ''
    notice.value = ''
    changeAuth('login')
  }
}

async function newOrder() {
  error.value = ''
  Object.assign(form, empty())
  const number: any = await window.api!.records.nextNumber()
  form.recordNumber = number.ok ? number.data : 'REC-0001'
  form.statusId = statuses.value.find(s => s.is_default)?.id || statuses.value[0]?.id || 0
  editId.value = null
  step.value = 1
  modal.value = true
}

async function viewOrder(row: Row) {
  const r: any = await window.api!.records.get(row.id)
  if (!r.ok || !r.data) return fail(r.error?.message)
  viewDetail.value = {
    record: {
      ...r.data.record,
      status_name: row.status_name || statuses.value.find(s => s.id === r.data.record.status_id)?.name || 'Pending',
      payment_status: row.payment_status || 'Pending',
      paid_minor: row.paid_minor || 0,
    },
    items: r.data.items || [],
  }
  viewModal.value = true
}

async function printOrder(rowOrId: Row | number) {
  const id = typeof rowOrId === 'number' ? rowOrId : Number(rowOrId.id)
  if (!id) return
  try {
    const r: any = await (window.api!.records as any).printItems(id)
    if (!r.ok) return fail(r.error.message)
  } catch (reason) {
    fail(reason instanceof Error ? `Order items could not be printed: ${reason.message}` : 'Order items could not be printed.')
  }
}

async function removeOrder(row: Row) {
  const confirmResult = await Swal.fire({
    title: `Delete order ${row.record_number || `#${row.id}`}?`,
    text: `Client: ${row.client_name} (${money(row.grand_total_minor)}). This will remove the order from your register.`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Delete order',
    confirmButtonColor: '#76453B',
  })
  if (!confirmResult.isConfirmed) return
  const r: any = await window.api!.records.remove(row.id)
  if (!r.ok) return fail(r.error?.message)
  viewModal.value = false
  notify('Order deleted.')
  await load()
}

async function edit(row: Row) {
  viewModal.value = false
  const r: any = await window.api!.records.get(row.id)
  if (!r.ok || !r.data) return fail(r.error?.message)
  const x = r.data.record
  Object.assign(form, {
    recordDate: x.record_date,
    recordNumber: x.record_number || '',
    clientName: x.client_name,
    contacts: x.contacts || '',
    location: x.location || '',
    sourceOfInfo: x.source_of_info || '',
    proformaNo: x.proforma_no || '',
    invoiceNo: x.invoice_no || '',
    eventDate: x.event_date || '',
    orderFormNo: x.order_form_no || '',
    deliveryFormNo: x.delivery_form_no || '',
    statusId: x.status_id,
    taxRateBasisPoints: x.tax_rate_bp,
    notes: x.notes || '',
    items: r.data.items.map((i: any) => ({
      description: i.description,
      quantity: i.quantity_x100 / 100,
      unitPrice: i.unit_price_minor,
    })),
  })
  editId.value = row.id
  step.value = 1
  modal.value = true
}

function validStep() {
  if (step.value === 1 && !form.clientName.trim()) {
    fail('Enter a client name to continue.')
    return false
  }
  if (
    step.value === 2 &&
    form.items.some(item => !item.description.trim() || Number(item.quantity) <= 0 || Number(item.unitPrice) < 0)
  ) {
    fail('Each item needs a name, a quantity, and a price.')
    return false
  }
  error.value = ''
  return true
}

function next() {
  if (validStep()) step.value = Math.min(4, step.value + 1)
}

async function save() {
  if (!validStep()) return
  busy.value = true
  error.value = ''
  const record = {
    recordDate: form.recordDate,
    recordNumber: form.recordNumber,
    clientName: form.clientName,
    contacts: form.contacts,
    location: form.location,
    sourceOfInfo: form.sourceOfInfo,
    eventDate: form.eventDate,
    proformaNo: form.proformaNo,
    invoiceNo: form.invoiceNo,
    orderFormNo: form.orderFormNo,
    deliveryFormNo: form.deliveryFormNo,
    statusId: Number(form.statusId),
    currency: 'TZS',
    taxRateBasisPoints: Number(form.taxRateBasisPoints),
    notes: form.notes,
  }
  const items = cloneRecordItems(form.items)
  try {
    const r: any =
      editId.value === null
        ? await window.api!.records.create({ record, items })
        : await window.api!.records.update({ id: editId.value, record, items })
    if (!r.ok) return fail(r.error.message)
    modal.value = false
    notify('Order saved.')
    await load()
    page.value = 'orders'
    recordFilter.value = ''
  } catch (reason) {
    fail(reason instanceof Error ? reason.message : 'Could not save this order. Please try again.')
  } finally {
    busy.value = false
  }
}

async function freshStart() {
  busy.value = true
  const r: any = await window.api!.records.clearLegacy()
  busy.value = false
  if (!r.ok) return fail(r.error.message)
  legacyPrompt.value = false
  notice.value = 'Test orders were cleared. You can start with the corrected TZS model.'
  await load()
}

async function keepLegacy() {
  await window.api!.records.keepLegacy()
  legacyPrompt.value = false
}

const reportType = ref<
  | 'general'
  | 'daily'
  | 'monthly'
  | 'upcoming-events'
  | 'unpaid-invoices'
  | 'delivery-due'
  | 'status-summary'
  | 'client-summary'
>('monthly')
const report = ref<any>(null)
const reportDay = ref(new Date().toISOString().slice(0, 10))
const reportMonth = ref(new Date().toISOString().slice(0, 7))
const reportDays = ref(7)
const reportBusy = ref('')
const savedReportPath = ref('')
const savedReportBytes = ref(0)

async function previewReport() {
  reportBusy.value = 'preview'
  savedReportPath.value = ''
  savedReportBytes.value = 0
  try {
    const params =
      reportType.value === 'daily'
        ? { day: reportDay.value }
        : reportType.value === 'monthly'
          ? { month: reportMonth.value }
          : { days: reportDays.value }
    const r: any = await window.api!.reports!.data(reportType.value, params)
    if (!r.ok) return fail(r.error.message)
    report.value = r.data
  } finally {
    reportBusy.value = ''
  }
}

async function exportExcel() {
  if (!report.value) return
  reportBusy.value = 'excel'
  try {
    const r: any = await window.api!.reports!.exportExcel(cloneIpcPayload(report.value))
    if (!r.ok) return fail(r.error.message)
    if (r.data)
      await Swal.fire({
        icon: 'success',
        title: 'Excel report saved',
        text: r.data,
        timer: 2600,
        showConfirmButton: false,
      })
  } catch (reason) {
    fail(
      reason instanceof Error
        ? `Excel could not be saved: ${reason.message}`
        : 'Excel could not be saved. Please try again.',
    )
  } finally {
    reportBusy.value = ''
  }
}

async function exportPdf() {
  if (!report.value) return
  reportBusy.value = 'pdf'
  try {
    const r: any = await window.api!.reports!.exportPdf(cloneIpcPayload(report.value))
    if (!r.ok) {
      fail(r.error.message)
      return
    }
    if (!r.data?.path || !r.data?.bytes) throw new Error('The PDF export returned no saved file.')
    savedReportPath.value = r.data.path
    savedReportBytes.value = r.data.bytes
    await Swal.fire({
      icon: 'success',
      title: 'PDF report saved',
      text: `Saved to ${r.data.path}`,
      confirmButtonText: 'Done',
    })
  } catch (reason) {
    fail(
      reason instanceof Error ? `PDF could not be saved: ${reason.message}` : 'PDF could not be saved. Please try again.',
    )
  } finally {
    reportBusy.value = ''
  }
}

async function printReport() {
  if (!report.value) return
  reportBusy.value = 'print'
  try {
    const r: any = await window.api!.reports!.print(cloneIpcPayload(report.value))
    if (!r.ok) return fail(r.error.message)
  } catch (reason) {
    fail(
      reason instanceof Error
        ? `Report could not be printed: ${reason.message}`
        : 'Report could not be printed. Please try again.',
    )
  } finally {
    reportBusy.value = ''
  }
}

async function openReportFolder() {
  if (!savedReportPath.value) return
  const r: any = await window.api!.reports!.openFolder(savedReportPath.value)
  if (!r.ok) fail(r.error.message)
}

function handleNavigate(target: Page) {
  page.value = target
  if (target === 'reports' && !report.value) {
    void previewReport()
  }
}

async function openFiltered(filter: string) {
  recordFilter.value = filter
  recordPage.value = 1
  page.value = 'orders'
  await load()
}

async function updateRecords(value: Record<string, any>) {
  if ('search' in value) search.value = value.search
  if ('filter' in value) recordFilter.value = value.filter
  if ('dateFrom' in value) recordDateFrom.value = value.dateFrom
  if ('dateTo' in value) recordDateTo.value = value.dateTo
  if ('status' in value) recordStatus.value = value.status
  if ('page' in value) recordPage.value = value.page
  await load()
}

onMounted(boot)
</script>

<template>
  <main v-if="user" class="app">
    <AppSidebar
      :page="page"
      :user="user"
      :unpaid-count="dashboard?.unpaidCount || 0"
      :delivery-count="dashboard?.deliveryCount || 0"
      @navigate="handleNavigate"
      @logout="logout"
      @new-record="newOrder"
    />

    <section class="content">
      <!-- Top Navigation / Header Bar -->
      <header class="topbar">
        <div class="topbar-title">
          <p class="eyebrow">{{ pageMeta.eyebrow }}</p>
          <h1>{{ pageMeta.title }}</h1>
          <span>{{ pageMeta.subtitle }}</span>
        </div>

        <div class="topbar-actions">
          <span class="date-pill">
            <CalendarDays :size="15" />
            {{ todayLabel }}
          </span>
          <button type="button" class="icon-action" title="Refresh data" aria-label="Refresh data" @click="load">
            <RefreshCw :size="16" />
          </button>
          <button type="button" class="primary" @click="newOrder">
            <Plus :size="16" />
            <span>New order</span>
          </button>
        </div>
      </header>

      <div v-if="notice" class="notice">
        <span>{{ notice }}</span>
        <button type="button" aria-label="Dismiss notice" @click="notice = ''"><X :size="16" /></button>
      </div>
      <p v-if="error && !modal" class="error">{{ error }}</p>

      <DashboardView
        v-if="page === 'dashboard'"
        :dashboard="dashboard"
        :money="money"
        :date="date"
        @filter="openFiltered"
        @refresh="load"
      />
      <RecordsView
        v-else-if="page === 'orders'"
        :rows="rows"
        :statuses="statuses"
        :search="search"
        :date-from="recordDateFrom"
        :date-to="recordDateTo"
        :status="recordStatus"
        :filter="recordFilter"
        :page="recordPage"
        :page-size="recordPageSize"
        :total="recordTotal"
        :total-pages="recordTotalPages"
        @update="updateRecords"
        @view="viewOrder"
        @print="printOrder"
        @edit="edit"
        @remove="removeOrder"
      />
      <BillingView v-else-if="page === 'billing'" @refresh="load" />
      <ReportsView
        v-else
        :report="report"
        :type="reportType"
        :day="reportDay"
        :month="reportMonth"
        :days="reportDays"
        :busy-action="reportBusy"
        :saved-path="savedReportPath"
        :saved-bytes="savedReportBytes"
        @update:type="
          value => {
            reportType = value as any
            void previewReport()
          }
        "
        @update:day="value => (reportDay = value)"
        @update:month="value => (reportMonth = value)"
        @update:days="value => (reportDays = value)"
        @preview="previewReport"
        @excel="exportExcel"
        @pdf="exportPdf"
        @print="printReport"
        @open-folder="openReportFolder"
      />
    </section>
  </main>

  <!-- Auth View -->
  <main v-else class="auth">
    <section class="intro">
      <div class="brand">
        <b>TP</b>
        <div>
          <small>DESKTOP WORKSPACE</small>
          <strong>TRACKPAD</strong>
        </div>
      </div>
      <div class="intro-copy">
        <p>OFFLINE ORDER MANAGEMENT</p>
        <h1>Your orders,<br />organized.</h1>
        <span>
          Securely manage client orders, event schedules, invoices, and payments from one private desktop workspace.
        </span>
      </div>
      <div class="intro-footer">
        <ShieldCheck :size="16" />
        <small>Local SQLite storage · Private by design</small>
      </div>
    </section>

    <form @submit.prevent="signIn">
      <p>{{ auth === 'setup' ? 'WELCOME' : auth === 'recover' ? 'ACCOUNT RECOVERY' : 'WELCOME BACK' }}</p>
      <h2>
        {{ auth === 'setup' ? 'Create your workspace' : auth === 'recover' ? 'Reset your password' : 'Sign in to continue' }}
      </h2>
      <label v-if="auth === 'setup'">
        Your name
        <input v-model="credentials.displayName" placeholder="e.g. Amina Nyerere" required />
      </label>
      <label>
        Username
        <input v-model="credentials.username" placeholder="Enter your username" required />
      </label>
      <label v-if="auth === 'recover'">
        Recovery key
        <input v-model="credentials.recoveryKey" placeholder="Paste your recovery key" required />
      </label>
      <label>
        {{ auth === 'recover' ? 'New password' : 'Password' }}
        <span class="password">
          <input v-model="password" :type="showPassword ? 'text' : 'password'" minlength="6" required />
          <button type="button" @click="showPassword = !showPassword">{{ showPassword ? 'Hide' : 'Show' }}</button>
        </span>
      </label>
      <label v-if="needsConfirmation">
        Confirm password
        <input v-model="confirmPassword" :type="showPassword ? 'text' : 'password'" minlength="6" required />
      </label>
      <p v-if="needsConfirmation && confirmPassword && password !== confirmPassword" class="error">
        Passwords do not match.
      </p>
      <p v-else-if="error" class="error">{{ error }}</p>
      <button class="primary auth-submit" :disabled="busy">
        {{
          busy
            ? 'Please wait…'
            : auth === 'setup'
              ? 'Create workspace'
              : auth === 'recover'
                ? 'Reset password'
                : 'Sign in'
        }}
      </button>
      <button v-if="auth !== 'login'" type="button" class="link" @click="changeAuth('login')">Back to sign in</button>
      <button v-if="auth === 'login'" type="button" class="link" @click="changeAuth('recover')">Forgot password?</button>
    </form>
  </main>

  <!-- Legacy Prompt -->
  <div v-if="legacyPrompt" class="shade">
    <section class="dialog">
      <p>CALCULATION UPDATE</p>
      <h2>Start with corrected TZS orders?</h2>
      <span>
        The previous test orders used an incorrect amount model. Starting fresh deletes orders and their items, but
        keeps your account and settings.
      </span>
      <footer>
        <button type="button" class="secondary" @click="keepLegacy">Keep existing orders</button>
        <button type="button" class="danger" :disabled="busy" @click="freshStart">Start fresh</button>
      </footer>
    </section>
  </div>

  <!-- View Order & Item List Modal -->
  <div v-if="viewModal && viewDetail" class="shade" @mousedown.self="viewModal = false">
    <section class="modal">
      <header class="modal-header">
        <div>
          <p>ORDER SPECIFICATION · {{ date(viewDetail.record.record_date) }}</p>
          <h2>Order {{ viewDetail.record.record_number || `#${viewDetail.record.id}` }} — {{ viewDetail.record.client_name }}</h2>
        </div>
        <button type="button" class="close-btn" aria-label="Close modal" @click="viewModal = false">
          <X :size="18" />
        </button>
      </header>

      <div class="body">
        <div class="review-summary-grid">
          <div>
            <small>CLIENT & CONTACTS</small>
            <strong>{{ viewDetail.record.client_name }}</strong>
            <p class="meta-line">{{ viewDetail.record.contacts || 'No contact provided' }}</p>
          </div>
          <div>
            <small>EVENT & LOCATION</small>
            <strong>Event: {{ date(viewDetail.record.event_date) }}</strong>
            <p class="meta-line">{{ viewDetail.record.location || 'Location not specified' }}</p>
          </div>
          <div class="highlight">
            <small>FINANCIAL SUMMARY</small>
            <strong>{{ money(viewDetail.record.grand_total_minor) }}</strong>
            <p class="meta-line">
              Paid: {{ money(viewDetail.record.paid_minor || 0) }} · Status: {{ viewDetail.record.status_name }}
            </p>
          </div>
        </div>

        <div class="review-summary-grid" style="margin-top: 12px">
          <div>
            <small>INVOICE / PROFORMA</small>
            <strong>Invoice: {{ viewDetail.record.invoice_no || '—' }}</strong>
            <p class="meta-line">Proforma: {{ viewDetail.record.proforma_no || '—' }}</p>
          </div>
          <div>
            <small>ORDER & DELIVERY FORMS</small>
            <strong>Order Form: {{ viewDetail.record.order_form_no || '—' }}</strong>
            <p class="meta-line">Delivery Form: {{ viewDetail.record.delivery_form_no || '—' }}</p>
          </div>
          <div>
            <small>SOURCE OF INFO</small>
            <strong>{{ viewDetail.record.source_of_info || '—' }}</strong>
            <p class="meta-line">Order Date: {{ date(viewDetail.record.record_date) }}</p>
          </div>
        </div>

        <div class="review-items-card" style="margin-top: 16px">
          <div class="review-items-head">
            <span>ORDER ITEMS ({{ viewDetail.items.length }})</span>
            <span>QUANTITY × UNIT PRICE = LINE TOTAL</span>
          </div>
          <div v-for="(item, idx) in viewDetail.items" :key="idx" class="review-item">
            <span>
              <b>{{ Number(idx) + 1 }}.</b> {{ item.description }}
            </span>
            <span>
              {{ item.quantity_x100 / 100 }} × {{ money(item.unit_price_minor) }} =
              <b>{{ money(item.line_total_minor ?? (item.quantity_x100 / 100) * item.unit_price_minor) }}</b>
            </span>
          </div>
          <div class="review-item total-bar">
            <span>Subtotal: {{ money(viewDetail.record.subtotal_minor) }} · Tax: {{ money(viewDetail.record.tax_minor) }}</span>
            <strong>GRAND TOTAL: {{ money(viewDetail.record.grand_total_minor) }}</strong>
          </div>
        </div>

        <div v-if="viewDetail.record.notes" class="notes-box">
          <small>REMARKS & NOTES</small>
          <p>{{ viewDetail.record.notes }}</p>
        </div>
      </div>

      <footer class="modal-footer">
        <button type="button" class="danger" @click="removeOrder(viewDetail.record)">
          <Trash2 :size="15" /> Delete
        </button>
        <button type="button" class="secondary" @click="edit(viewDetail.record)">
          <Edit3 :size="15" /> Edit order
        </button>
        <button type="button" class="primary" @click="printOrder(viewDetail.record.id)">
          <Printer :size="15" /> Print item list
        </button>
      </footer>
    </section>
  </div>

  <!-- 4-Step Order Modal -->
  <div v-if="modal" class="shade" @mousedown.self="modal = false">
    <section class="modal">
      <header class="modal-header">
        <div>
          <p>{{ editId === null ? 'NEW ORDER' : 'EDIT ORDER' }} · STEP {{ step }} OF 4</p>
          <h2>{{ stepLabels[step - 1] }}</h2>
        </div>
        <button type="button" class="close-btn" aria-label="Close modal" @click="modal = false">
          <X :size="18" />
        </button>
      </header>

      <!-- Stepper Bar -->
      <div class="stepper">
        <div
          v-for="(labelText, index) in stepLabels"
          :key="labelText"
          class="step-item"
          :class="{ active: step === index + 1, done: step > index + 1 }"
        >
          <span class="step-circle">
            <Check v-if="step > index + 1" :size="13" />
            <template v-else>{{ index + 1 }}</template>
          </span>
          <b>{{ labelText }}</b>
        </div>
      </div>

      <form @submit.prevent="step === 4 ? save() : next()">
        <div class="body">
          <p v-if="error" class="error">{{ error }}</p>

          <!-- Step 1 -->
          <fieldset v-if="step === 1">
            <div class="fields">
              <label>Order date ({{ date(form.recordDate) }}) *<input v-model="form.recordDate" type="date" required /></label>
              <label>Order number<input v-model="form.recordNumber" readonly class="readonly-input" /></label>
              <label>Client name *<input v-model="form.clientName" placeholder="Client or organization" required /></label>
              <label>Contacts<input v-model="form.contacts" placeholder="Phone or email" /></label>
              <label>Location<input v-model="form.location" placeholder="Event or delivery venue" /></label>
              <label>Source of information<input v-model="form.sourceOfInfo" placeholder="Referral, walk-in, etc." /></label>
            </div>
          </fieldset>

          <!-- Step 2 -->
          <fieldset v-if="step === 2">
            <div class="item head">
              <span>ITEM DESCRIPTION</span>
              <span>QUANTITY</span>
              <span>UNIT PRICE (TZS)</span>
              <span>LINE AMOUNT</span>
              <span></span>
            </div>
            <div v-for="(item, index) in form.items" :key="index" class="item">
              <input v-model="item.description" placeholder="Item or service description" required />
              <input v-model.number="item.quantity" type="number" min="1" step="1" />
              <input v-model.number="item.unitPrice" type="number" min="0" step="1" />
              <strong>{{ money(item.quantity * item.unitPrice) }}</strong>
              <button
                type="button"
                class="remove-item"
                title="Remove item"
                :disabled="form.items.length === 1"
                @click="form.items.splice(index, 1)"
              >
                <Trash2 :size="15" />
              </button>
            </div>
            <button
              type="button"
              class="add"
              @click="form.items.push({ description: '', quantity: 1, unitPrice: 0 })"
            >
              <Plus :size="15" /> Add another item
            </button>
            <div class="totals">
              <label>
                Tax (%)
                <input
                  :value="form.taxRateBasisPoints / 100"
                  type="number"
                  min="0"
                  @input="form.taxRateBasisPoints = Number(($event.target as HTMLInputElement).value) * 100"
                />
              </label>
              <div>
                <small>Subtotal</small>
                <b>{{ money(subtotal) }}</b>
              </div>
              <div class="grand-box">
                <small>Grand Total</small>
                <b>{{ money(total) }}</b>
              </div>
            </div>
          </fieldset>

          <!-- Step 3 -->
          <fieldset v-if="step === 3">
            <div class="fields">
              <label>Event date ({{ date(form.eventDate) }})<input v-model="form.eventDate" type="date" /></label>
              <label>Proforma invoice number<input v-model="form.proformaNo" /></label>
              <label>Invoice number<input v-model="form.invoiceNo" /></label>
              <label>Order form number<input v-model="form.orderFormNo" /></label>
              <label>Delivery form number<input v-model="form.deliveryFormNo" /></label>
              <label>
                Status
                <select v-model.number="form.statusId">
                  <option v-for="s in statuses" :key="s.id" :value="s.id">{{ s.name }}</option>
                </select>
              </label>
            </div>
            <label class="notes">
              Remarks & notes
              <textarea v-model="form.notes" rows="4" placeholder="Add special instructions or notes…"></textarea>
            </label>
          </fieldset>

          <!-- Step 4 -->
          <fieldset v-if="step === 4" class="review">
            <div class="review-summary-grid">
              <div>
                <small>ORDER</small>
                <strong>{{ form.recordNumber }} · {{ date(form.recordDate) }}</strong>
              </div>
              <div>
                <small>CLIENT</small>
                <strong>{{ form.clientName }}</strong>
              </div>
              <div class="highlight">
                <small>GRAND TOTAL</small>
                <strong>{{ money(total) }}</strong>
              </div>
            </div>
            <div class="review-items-card">
              <div class="review-items-head">
                <span>ITEM SUMMARY</span>
                <span>AMOUNT</span>
              </div>
              <div v-for="(item, idx) in form.items" :key="idx" class="review-item">
                <span>{{ item.description }} × {{ item.quantity }}</span>
                <b>{{ money(item.quantity * item.unitPrice) }}</b>
              </div>
            </div>
          </fieldset>
        </div>

        <footer class="modal-footer">
          <button v-if="editId !== null" type="button" class="secondary" @click="printOrder(editId)">
            <Printer :size="15" /> Print item list
          </button>
          <button v-if="step > 1" type="button" class="secondary" @click="step--">Back</button>
          <button type="button" class="secondary" @click="modal = false">Cancel</button>
          <button class="primary" :disabled="busy">
            {{ step === 4 ? (busy ? 'Saving…' : 'Save order') : 'Continue' }}
          </button>
        </footer>
      </form>
    </section>
  </div>
</template>

<style scoped>
.app {
  display: flex;
  height: 100vh;
  overflow: hidden;
  background: var(--cream);
}

.content {
  flex: 1;
  min-width: 0;
  height: 100vh;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 28px 38px 44px;
}

/* Sticky Topbar */
.topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
  margin-bottom: 24px;
  padding-bottom: 18px;
  border-bottom: 1px solid var(--border);
}

.topbar-title .eyebrow,
.auth form > p,
.intro p,
.modal-header p,
.dialog > p {
  margin: 0 0 4px;
  color: #B19470;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.topbar-title h1 {
  margin: 0;
  font-size: 28px;
  font-weight: 800;
  letter-spacing: -0.03em;
  color: var(--text);
}

.topbar-title span {
  display: block;
  margin-top: 3px;
  font-size: 13px;
  color: var(--muted);
}

.topbar-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.date-pill {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 8px 13px;
  border-radius: 99px;
  background: #FFFFFF;
  border: 1px solid var(--border);
  color: var(--muted);
  font-size: 12px;
  font-weight: 700;
}

.icon-action {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: #FFFFFF;
  color: #43766C;
  display: grid;
  place-items: center;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.icon-action:hover {
  background: #43766C;
  color: #F8FAE5;
  border-color: #43766C;
}

.primary,
.danger,
.secondary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  border: 1px solid transparent;
  border-radius: 10px;
  padding: 10px 16px;
  font: inherit;
  font-size: 13px;
  font-weight: 800;
  cursor: pointer;
  transition: background 0.15s, transform 0.15s;
}

.primary {
  background: #43766C;
  color: #F8FAE5;
}

.primary:hover:not(:disabled) {
  background: #345d55;
}

.secondary {
  background: #F8FAE5;
  border-color: var(--border);
  color: var(--text);
}

.secondary:hover {
  background: #EFECE0;
}

.danger {
  background: #76453B;
  color: #F8FAE5;
}

.primary:disabled,
.danger:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.notice,
.error {
  padding: 12px 16px;
  border-radius: 10px;
  margin: 0 0 18px;
  font-size: 13px;
  font-weight: 600;
}

.notice {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #E9F1EF;
  border: 1px solid #C5DBD6;
  color: #43766C;
}

.notice button {
  border: 0;
  background: transparent;
  color: #43766C;
  cursor: pointer;
}

.error {
  background: #F6ECEA;
  border: 1px solid #E4C8C3;
  color: #76453B;
}

/* Auth Screen */
.auth {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 1.05fr 1fr;
  background: var(--cream);
}

.intro {
  padding: 56px clamp(32px, 7vw, 120px);
  background: linear-gradient(150deg, #43766C 0%, #315951 100%);
  color: #F8FAE5;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.intro .brand {
  display: flex;
  gap: 12px;
  align-items: center;
}

.intro .brand > b {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: #B19470;
  color: #F8FAE5;
  font-size: 14px;
  font-weight: 900;
}

.intro .brand small {
  display: block;
  font-size: 9.5px;
  letter-spacing: 0.14em;
  color: rgba(248, 250, 229, 0.7);
  font-weight: 700;
}

.intro .brand strong {
  font-size: 17px;
  letter-spacing: 0.04em;
}

.intro-copy p {
  color: #B19470;
}

.intro h1 {
  font-size: clamp(38px, 4.6vw, 58px);
  font-weight: 800;
  line-height: 1.04;
  margin: 10px 0 16px;
}

.intro-copy span {
  color: rgba(248, 250, 229, 0.84);
  font-size: 16px;
  line-height: 1.65;
  max-width: 460px;
  display: block;
}

.intro-footer {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: rgba(248, 250, 229, 0.76);
}

.auth form {
  width: min(440px, calc(100% - 48px));
  align-self: center;
  justify-self: center;
  background: #FFFFFF;
  border: 1px solid var(--border);
  border-radius: 18px;
  padding: 36px 34px;
  box-shadow: 0 16px 40px rgba(38, 33, 29, 0.06);
  display: grid;
  gap: 14px;
}

.auth form h2 {
  margin: 0 0 6px;
  font-size: 26px;
  font-weight: 800;
  color: var(--text);
}

.auth label,
.fields label,
.totals label,
.notes {
  display: grid;
  gap: 6px;
  color: var(--text);
  font-size: 12px;
  font-weight: 800;
}

.fields input,
.fields select,
.item input,
.totals input,
textarea,
.auth input {
  border: 1px solid var(--border);
  border-radius: 9px;
  padding: 10px 12px;
  font: inherit;
  font-size: 13px;
  background: #FFFFFF;
  color: var(--text);
}

.readonly-input {
  background: #F8FAE5 !important;
  color: #43766C !important;
  font-weight: 800;
}

.password {
  display: flex;
}

.password input {
  min-width: 0;
  flex: 1;
  border-radius: 9px 0 0 9px;
}

.password button {
  border: 1px solid var(--border);
  border-left: 0;
  border-radius: 0 9px 9px 0;
  background: #F8FAE5;
  color: #43766C;
  font-weight: 800;
  padding: 0 14px;
  cursor: pointer;
}

.auth-submit {
  margin-top: 4px;
  padding: 12px;
}

.auth .link {
  border: 0;
  background: transparent;
  color: #43766C;
  text-align: left;
  font: inherit;
  font-size: 13px;
  font-weight: 800;
  cursor: pointer;
  padding: 2px 0;
}

/* Modal & Dialog */
.shade {
  position: fixed;
  inset: 0;
  z-index: 50;
  background: rgba(38, 33, 29, 0.54);
  backdrop-filter: blur(3px);
  display: grid;
  place-items: center;
  padding: 22px;
}

.modal,
.dialog {
  width: min(940px, 100%);
  max-height: calc(100vh - 44px);
  display: flex;
  flex-direction: column;
  background: #FFFFFF;
  border: 1px solid var(--border);
  border-radius: 18px;
  overflow: hidden;
  box-shadow: 0 24px 64px rgba(38, 33, 29, 0.24);
  position: static;
}

.dialog {
  width: min(480px, 100%);
  padding: 26px;
  gap: 10px;
}

.dialog h2,
.modal-header h2 {
  margin: 0;
  font-weight: 800;
  font-size: 21px;
}

.dialog > span {
  color: var(--muted);
  line-height: 1.55;
}

.modal-header {
  padding: 20px 26px 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--border);
}

.close-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid var(--border);
  background: #F8FAE5;
  color: #43766C;
  display: grid;
  place-items: center;
  cursor: pointer;
}

.close-btn:hover {
  background: #76453B;
  color: #F8FAE5;
  border-color: #76453B;
}

/* Stepper */
.stepper {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  padding: 12px 26px;
  background: #F8FAE5;
  border-bottom: 1px solid var(--border);
}

.step-item {
  display: flex;
  align-items: center;
  gap: 9px;
  color: var(--muted);
  font-size: 12px;
}

.step-circle {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #FFFFFF;
  border: 1px solid var(--border);
  display: grid;
  place-items: center;
  font-size: 11px;
  font-weight: 800;
  flex-shrink: 0;
}

.step-item.active {
  color: #43766C;
}

.step-item.active .step-circle {
  background: #43766C;
  border-color: #43766C;
  color: #F8FAE5;
  box-shadow: 0 0 0 3px rgba(177, 148, 112, 0.32);
}

.step-item.done {
  color: var(--text);
}

.step-item.done .step-circle {
  background: #B19470;
  border-color: #B19470;
  color: #F8FAE5;
}

.body {
  overflow: auto;
  padding: 18px 26px 24px;
}

fieldset {
  border: 0;
  padding: 6px 0;
  margin: 0;
}

.fields {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
}

.notes {
  margin-top: 16px;
}

.item {
  display: grid;
  grid-template-columns: 1.7fr 0.65fr 1fr 1fr 34px;
  gap: 10px;
  align-items: center;
  margin-top: 10px;
}

.item.head {
  font-size: 10px;
  font-weight: 800;
  color: var(--muted);
  letter-spacing: 0.06em;
  padding: 6px 2px;
  margin-top: 0;
  border-bottom: 1px solid var(--border);
}

.remove-item {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: #F6ECEA;
  color: #76453B;
  display: grid;
  place-items: center;
  cursor: pointer;
}

.remove-item:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.add {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 0;
  background: #F8FAE5;
  color: #43766C;
  font-weight: 800;
  font-size: 12.5px;
  padding: 8px 14px;
  border-radius: 8px;
  margin: 14px 0;
  cursor: pointer;
}

.totals {
  display: flex;
  gap: 22px;
  justify-content: flex-end;
  align-items: center;
  border-top: 1px solid var(--border);
  padding-top: 16px;
}

.totals div {
  display: grid;
  gap: 2px;
  padding: 10px 14px;
  border-radius: 10px;
  background: #FBFCF4;
  border: 1px solid var(--border);
}

.totals .grand-box {
  background: #F8FAE5;
  border-color: #B19470;
  color: #43766C;
}

.totals b {
  font-size: 17px;
  font-weight: 800;
}

.review {
  display: grid;
  gap: 16px;
}

.review-summary-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.review-summary-grid > div {
  padding: 14px 16px;
  border-radius: 12px;
  background: #FBFCF4;
  border: 1px solid var(--border);
}

.review-summary-grid > div.highlight {
  background: #F8FAE5;
  border-color: #43766C;
  color: #43766C;
}

.review-summary-grid small {
  display: block;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.08em;
  color: var(--muted);
  margin-bottom: 4px;
}

.review-summary-grid strong {
  font-size: 15.5px;
  font-weight: 800;
}

.meta-line {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--muted);
}

.review-items-card {
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
}

.review-items-head {
  display: flex;
  justify-content: space-between;
  padding: 10px 16px;
  background: #43766C;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.08em;
  color: #F8FAE5;
}

.review-item {
  display: flex;
  justify-content: space-between;
  border-top: 1px solid #EFECE0;
  padding: 11px 16px;
  font-size: 13px;
}

.review-item.total-bar {
  background: #F8FAE5;
  border-top: 2px solid #43766C;
  font-weight: 700;
  color: #26211D;
}

.notes-box {
  margin-top: 14px;
  padding: 12px 16px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: #FBFCF4;
}

.notes-box small {
  display: block;
  font-size: 10px;
  font-weight: 800;
  color: #B19470;
  margin-bottom: 4px;
}

.notes-box p {
  margin: 0;
  font-size: 13px;
}

.modal-footer,
.dialog footer {
  padding: 16px 26px;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  border-top: 1px solid var(--border);
  background: #FBFCF4;
}

.dialog footer {
  padding: 14px 0 0;
  border: 0;
  background: transparent;
}

@media (max-width: 900px) {
  .content {
    padding: 22px 18px;
  }
  .fields,
  .review-summary-grid {
    grid-template-columns: 1fr 1fr;
  }
  .stepper {
    grid-template-columns: 1fr 1fr;
  }
  .auth {
    grid-template-columns: 1fr;
  }
  .intro {
    display: none;
  }
}

@media (max-width: 560px) {
  .fields,
  .review-summary-grid {
    grid-template-columns: 1fr;
  }
  .item {
    grid-template-columns: 1fr 1fr 34px;
  }
  .item input:first-child {
    grid-column: span 3;
  }
  .item.head {
    display: none;
  }
  .totals {
    flex-wrap: wrap;
  }
}
</style>
