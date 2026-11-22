<script setup lang="ts">
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Eye,
  FilePlus2,
  Hash,
  Search,
  Settings2,
  X,
} from 'lucide-vue-next'
import Swal from 'sweetalert2'
import { formatDate } from '../../shared/date'
import type { DocumentRecord, PendingOrderRow, SequenceGroup, SequenceStatus } from '../../shared/document-types'
import DocumentPreviewModal from './DocumentPreviewModal.vue'

const props = defineProps<{
  kind: 'order_form' | 'delivery_note'
}>()

const emit = defineEmits<{ refresh: [] }>()

const subTab = ref<'pending' | 'issued'>('pending')
const search = ref('')
const loading = ref(false)
const busy = ref(false)

const sequence = ref<SequenceStatus>({
  sequenceGroup: props.kind,
  configured: false,
  startNumber: null,
  nextNumber: null,
  nextFormatted: null,
})

const pendingOrders = ref<PendingOrderRow[]>([])
const issuedDocs = ref<DocumentRecord[]>([])
const previewDoc = ref<DocumentRecord | null>(null)

// Pagination
const pageSize = ref(10)
const pendingPage = ref(1)
const issuedPage = ref(1)

const pendingTotalPages = computed(() => Math.max(1, Math.ceil(pendingOrders.value.length / pageSize.value)))
const visiblePendingOrders = computed(() => {
  const start = (pendingPage.value - 1) * pageSize.value
  return pendingOrders.value.slice(start, start + pageSize.value)
})
const pendingPageNumbers = computed(() =>
  Array.from(
    { length: Math.min(pendingTotalPages.value, 5) },
    (_, i) => Math.max(1, Math.min(pendingTotalPages.value - 4, pendingPage.value - 2)) + i,
  ),
)

const issuedTotalPages = computed(() => Math.max(1, Math.ceil(issuedDocs.value.length / pageSize.value)))
const visibleIssuedDocs = computed(() => {
  const start = (issuedPage.value - 1) * pageSize.value
  return issuedDocs.value.slice(start, start + pageSize.value)
})
const issuedPageNumbers = computed(() =>
  Array.from(
    { length: Math.min(issuedTotalPages.value, 5) },
    (_, i) => Math.max(1, Math.min(issuedTotalPages.value - 4, issuedPage.value - 2)) + i,
  ),
)

watch([pendingTotalPages, pageSize], () => {
  if (pendingPage.value > pendingTotalPages.value) pendingPage.value = pendingTotalPages.value
})
watch([issuedTotalPages, pageSize], () => {
  if (issuedPage.value > issuedTotalPages.value) issuedPage.value = issuedTotalPages.value
})

// Start-number modal
const sequenceModal = ref(false)
const sequenceInput = ref(props.kind === 'order_form' ? '0498' : '0783')
const pendingActionAfterSequence = ref<(() => Promise<void>) | null>(null)

// Generate Form modal
const formModal = ref(false)
const selectedOrder = ref<PendingOrderRow | null>(null)
const formDetails = reactive({
  issueDate: new Date().toISOString().slice(0, 10),
  altPhone: '',
  setupDate: '',
  takedownDate: '',
  eventColors: '',
  showPrices: false,
  notes: '',
})

const money = (n: unknown) =>
  `${new Intl.NumberFormat('en-TZ', { maximumFractionDigits: 0 }).format(Number(n) || 0)} TZS`
const date = (v?: string | null) => formatDate(v, '—')

const currentSeqGroup = computed<SequenceGroup>(() => props.kind)
const defaultStartSuggestion = computed(() => (props.kind === 'order_form' ? '0498' : '0783'))
const kindLabel = computed(() => (props.kind === 'order_form' ? 'Customer Order Form' : 'Delivery Note'))
const pluralLabel = computed(() => (props.kind === 'order_form' ? 'Order Forms' : 'Delivery Notes'))

async function loadAll() {
  loading.value = true
  try {
    const [seqRes, pendingRes, issuedRes] = await Promise.all([
      window.api!.documents.sequenceStatus(currentSeqGroup.value),
      window.api!.documents.pendingOrders({ docKind: props.kind, search: search.value }),
      window.api!.documents.list({ sequenceGroup: currentSeqGroup.value, search: search.value }),
    ])
    if (seqRes.ok) sequence.value = seqRes.data
    if (pendingRes.ok) pendingOrders.value = pendingRes.data || []
    if (issuedRes.ok) issuedDocs.value = issuedRes.data || []
  } finally {
    loading.value = false
  }
}

watch(search, () => {
  pendingPage.value = 1
  issuedPage.value = 1
  void loadAll()
})

watch(
  () => props.kind,
  () => {
    pendingPage.value = 1
    issuedPage.value = 1
    void loadAll()
  },
)

function openSequenceModal(afterSave?: () => Promise<void>) {
  sequenceInput.value = sequence.value.nextFormatted || defaultStartSuggestion.value
  pendingActionAfterSequence.value = afterSave ?? null
  sequenceModal.value = true
}

async function saveSequenceStart() {
  const num = Number.parseInt(sequenceInput.value.replaceAll(/\D/g, ''), 10)
  if (!Number.isFinite(num) || num < 1) {
    await Swal.fire({
      icon: 'error',
      title: 'Invalid number',
      text: `Enter a positive starting number (e.g. ${defaultStartSuggestion.value}).`,
      confirmButtonColor: '#76453B',
    })
    return
  }
  busy.value = true
  try {
    const res = await window.api!.documents.setSequenceStart({
      sequenceGroup: currentSeqGroup.value,
      startNumber: num,
    })
    if (!res.ok) {
      await Swal.fire({ icon: 'error', title: 'Error', text: res.error.message, confirmButtonColor: '#76453B' })
      return
    }
    sequence.value = res.data
    sequenceModal.value = false
    const nextStep = pendingActionAfterSequence.value
    pendingActionAfterSequence.value = null
    if (nextStep) {
      await nextStep()
    } else {
      await Swal.fire({
        icon: 'success',
        title: `Next ${kindLabel.value} number set to ${res.data.nextFormatted}`,
        text: 'Existing issued numbers remain untouched and will be skipped automatically.',
        timer: 2400,
        showConfirmButton: false,
      })
    }
  } finally {
    busy.value = false
  }
}

async function openGenerateModal(order: PendingOrderRow) {
  if (!sequence.value.configured) {
    openSequenceModal(() => openGenerateModal(order))
    return
  }
  selectedOrder.value = order
  formDetails.issueDate = new Date().toISOString().slice(0, 10)
  formDetails.altPhone = ''
  formDetails.setupDate = order.event_date || ''
  formDetails.takedownDate = ''
  formDetails.eventColors = ''
  formDetails.showPrices = false
  formDetails.notes = ''
  formModal.value = true
}

async function submitGenerateForm() {
  if (!selectedOrder.value) return
  busy.value = true
  try {
    const res =
      props.kind === 'order_form'
        ? await window.api!.documents.createOrderForm({
            recordId: selectedOrder.value.id,
            issueDate: formDetails.issueDate,
            altPhone: formDetails.altPhone,
            setupDate: formDetails.setupDate,
            takedownDate: formDetails.takedownDate,
            eventColors: formDetails.eventColors,
            showPrices: formDetails.showPrices,
            notes: formDetails.notes,
          })
        : await window.api!.documents.createDeliveryNote({
            recordId: selectedOrder.value.id,
            issueDate: formDetails.issueDate,
            showPrices: formDetails.showPrices,
            notes: formDetails.notes,
          })

    if (!res.ok) {
      await Swal.fire({
        icon: 'error',
        title: `Could not generate ${kindLabel.value}`,
        text: res.error.message,
        confirmButtonColor: '#76453B',
      })
      return
    }

    formModal.value = false
    selectedOrder.value = null
    await loadAll()
    emit('refresh')
    previewDoc.value = res.data
  } finally {
    busy.value = false
  }
}

onMounted(loadAll)
</script>

<template>
  <section class="doc-page">
    <!-- Toolbar -->
    <div class="toolbar-card">
      <div class="tabs">
        <button type="button" :class="{ active: subTab === 'pending' }" @click="subTab = 'pending'">
          <span>Orders Without {{ kind === 'order_form' ? 'Order Form' : 'Delivery Note' }}</span>
          <em class="count-pill">{{ pendingOrders.length }}</em>
        </button>
        <button type="button" :class="{ active: subTab === 'issued' }" @click="subTab = 'issued'">
          <span>Issued {{ pluralLabel }}</span>
          <em class="count-pill neutral">{{ issuedDocs.length }}</em>
        </button>
      </div>

      <div class="toolbar-right">
        <label class="search-box">
          <Search :size="15" />
          <input v-model="search" placeholder="Search client, order #, or form #…" />
        </label>

        <div class="seq-pill" :class="{ unset: !sequence.configured }">
          <Hash :size="14" />
          <span v-if="sequence.configured">Next No: <strong>{{ sequence.nextFormatted }}</strong></span>
          <span v-else>Start number not set</span>
        </div>

        <button type="button" class="btn-outline" @click="openSequenceModal()">
          <Settings2 :size="15" />
          <span>{{ sequence.configured ? 'Reset Start No.' : 'Set Start No.' }}</span>
        </button>
      </div>
    </div>

    <!-- Pending Orders -->
    <div v-if="subTab === 'pending'" class="table-card">
      <div class="table-head-info">
        <h3>Orders Without a {{ kindLabel }}</h3>
        <p>Select an order to fill in {{ kind === 'order_form' ? 'event schedule & color details' : 'dispatch date' }} and generate the printable {{ kindLabel }}.</p>
      </div>

      <div v-if="!pendingOrders.length" class="empty-state">
        <strong>{{ loading ? 'Loading orders…' : `All active orders already have a ${kindLabel}.` }}</strong>
        <span>You can view or reprint existing forms in the "Issued {{ pluralLabel }}" tab.</span>
      </div>

      <div v-else class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Order #</th>
              <th>Client &amp; Contacts</th>
              <th>Event Date</th>
              <th>Location</th>
              <th class="num">Items</th>
              <th class="num">Order Total</th>
              <th class="actions-col">Action</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="order in visiblePendingOrders" :key="order.id">
              <td>
                <strong>{{ order.record_number || `#${order.id}` }}</strong>
                <small class="sub">{{ date(order.record_date) }}</small>
              </td>
              <td>
                <strong>{{ order.client_name }}</strong>
                <small class="sub">{{ order.contacts || 'No phone' }}</small>
              </td>
              <td>{{ date(order.event_date) }}</td>
              <td>{{ order.location || '—' }}</td>
              <td class="num">{{ order.item_count }}</td>
              <td class="num"><strong>{{ money(order.grand_total_minor) }}</strong></td>
              <td class="actions-col">
                <button type="button" class="btn-primary sm" :disabled="busy" @click="openGenerateModal(order)">
                  <FilePlus2 :size="14" />
                  <span>Generate {{ kind === 'order_form' ? 'Order Form' : 'Delivery Note' }}</span>
                </button>
              </td>
            </tr>
          </tbody>
        </table>

        <footer class="pager">
          <span class="pager-info">
            Showing {{ (pendingPage - 1) * pageSize + 1 }}–{{ Math.min(pendingPage * pageSize, pendingOrders.length) }} of {{ pendingOrders.length }}
          </span>
          <div class="pager-controls">
            <label class="page-size">
              <span>Rows</span>
              <select v-model.number="pageSize">
                <option :value="10">10</option>
                <option :value="25">25</option>
                <option :value="50">50</option>
              </select>
            </label>
            <button type="button" :disabled="pendingPage <= 1" @click="pendingPage = 1"><ChevronsLeft :size="14" /></button>
            <button type="button" :disabled="pendingPage <= 1" @click="pendingPage -= 1"><ChevronLeft :size="14" /></button>
            <button
              v-for="p in pendingPageNumbers"
              :key="p"
              type="button"
              :class="{ active: p === pendingPage }"
              @click="pendingPage = p"
            >
              {{ p }}
            </button>
            <button type="button" :disabled="pendingPage >= pendingTotalPages" @click="pendingPage += 1"><ChevronRight :size="14" /></button>
            <button type="button" :disabled="pendingPage >= pendingTotalPages" @click="pendingPage = pendingTotalPages"><ChevronsRight :size="14" /></button>
          </div>
        </footer>
      </div>
    </div>

    <!-- Issued Forms -->
    <div v-else class="table-card">
      <div class="table-head-info">
        <h3>Issued {{ kind === 'order_form' ? 'Customer Order Forms' : 'Delivery Notes' }}</h3>
        <p>Preview, print, or export any issued form as an A4 PDF with official M&amp;S Decorations branding.</p>
      </div>

      <div v-if="!issuedDocs.length" class="empty-state">
        <strong>{{ loading ? 'Loading forms…' : `No ${pluralLabel} generated yet.` }}</strong>
        <span>Switch to the pending tab to create one.</span>
      </div>

      <div v-else class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Form No.</th>
              <th>Client</th>
              <th>Order #</th>
              <th>Issue / Event Date</th>
              <th>Prices Shown</th>
              <th class="actions-col">Action</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="doc in visibleIssuedDocs" :key="doc.id">
              <td><strong class="doc-no">{{ doc.doc_number }}</strong></td>
              <td>
                <strong>{{ doc.client_name }}</strong>
                <small class="sub">{{ doc.location || '—' }}</small>
              </td>
              <td>{{ doc.record_number || `#${doc.record_id}` }}</td>
              <td>
                <span>{{ date(doc.issue_date) }}</span>
                <small class="sub">Event: {{ date(doc.event_date) }}</small>
              </td>
              <td>
                <span class="price-flag" :class="{ on: Boolean(doc.show_prices) }">
                  {{ doc.show_prices ? 'Shown' : 'Hidden' }}
                </span>
              </td>
              <td class="actions-col">
                <button type="button" class="btn-outline sm" @click="previewDoc = doc">
                  <Eye :size="14" />
                  <span>Preview / PDF</span>
                </button>
              </td>
            </tr>
          </tbody>
        </table>

        <footer class="pager">
          <span class="pager-info">
            Showing {{ (issuedPage - 1) * pageSize + 1 }}–{{ Math.min(issuedPage * pageSize, issuedDocs.length) }} of {{ issuedDocs.length }}
          </span>
          <div class="pager-controls">
            <label class="page-size">
              <span>Rows</span>
              <select v-model.number="pageSize">
                <option :value="10">10</option>
                <option :value="25">25</option>
                <option :value="50">50</option>
              </select>
            </label>
            <button type="button" :disabled="issuedPage <= 1" @click="issuedPage = 1"><ChevronsLeft :size="14" /></button>
            <button type="button" :disabled="issuedPage <= 1" @click="issuedPage -= 1"><ChevronLeft :size="14" /></button>
            <button
              v-for="p in issuedPageNumbers"
              :key="p"
              type="button"
              :class="{ active: p === issuedPage }"
              @click="issuedPage = p"
            >
              {{ p }}
            </button>
            <button type="button" :disabled="issuedPage >= issuedTotalPages" @click="issuedPage += 1"><ChevronRight :size="14" /></button>
            <button type="button" :disabled="issuedPage >= issuedTotalPages" @click="issuedPage = issuedTotalPages"><ChevronsRight :size="14" /></button>
          </div>
        </footer>
      </div>
    </div>

    <!-- Sequence Start Modal -->
    <div v-if="sequenceModal" class="shade" @mousedown.self="sequenceModal = false">
      <section class="dialog-card">
        <header class="dialog-header">
          <div>
            <p class="eyebrow">{{ kindLabel.toUpperCase() }} NUMBERING</p>
            <h3>{{ sequence.configured ? 'Reset Starting Number' : `Set Starting ${kindLabel} Number` }}</h3>
          </div>
          <button type="button" class="close-btn" @click="sequenceModal = false"><X :size="18" /></button>
        </header>

        <div class="dialog-body">
          <p class="hint">
            Enter the starting number (for example <strong>{{ defaultStartSuggestion }}</strong>). Future {{ pluralLabel }}
            will increment automatically and skip any already-issued numbers without overwriting them.
          </p>
          <label class="field">
            <span>Starting Number</span>
            <input v-model="sequenceInput" :placeholder="`e.g. ${defaultStartSuggestion}`" inputmode="numeric" @keyup.enter="saveSequenceStart" />
          </label>
        </div>

        <footer class="dialog-footer">
          <button type="button" class="btn-outline" @click="sequenceModal = false">Cancel</button>
          <button type="button" class="btn-primary" :disabled="busy" @click="saveSequenceStart">Save Starting Number</button>
        </footer>
      </section>
    </div>

    <!-- Generate Order Form / Delivery Note Modal -->
    <div v-if="formModal && selectedOrder" class="shade" @mousedown.self="formModal = false">
      <section class="dialog-card">
        <header class="dialog-header">
          <div>
            <p class="eyebrow">GENERATE {{ kindLabel.toUpperCase() }} · NO. {{ sequence.nextFormatted }}</p>
            <h3>{{ selectedOrder.client_name }} ({{ selectedOrder.record_number || `#${selectedOrder.id}` }})</h3>
          </div>
          <button type="button" class="close-btn" @click="formModal = false"><X :size="18" /></button>
        </header>

        <div class="dialog-body">
          <div class="grid-2">
            <label class="field">
              <span>Document Date</span>
              <input v-model="formDetails.issueDate" type="date" />
            </label>

            <label v-if="kind === 'order_form'" class="field">
              <span>Alternate Phone No.</span>
              <input v-model="formDetails.altPhone" placeholder="Optional second phone" />
            </label>
          </div>

          <div v-if="kind === 'order_form'" class="grid-2" style="margin-top: 10px">
            <label class="field">
              <span>Preferred Set-up Date</span>
              <input v-model="formDetails.setupDate" type="date" />
            </label>
            <label class="field">
              <span>Preferred Take Down Date</span>
              <input v-model="formDetails.takedownDate" type="date" />
            </label>
          </div>

          <label v-if="kind === 'order_form'" class="field" style="margin-top: 10px">
            <span>Colors of the Event</span>
            <input v-model="formDetails.eventColors" placeholder="e.g. Gold, White & Emerald" />
          </label>

          <label class="toggle-row">
            <input v-model="formDetails.showPrices" type="checkbox" />
            <span>
              <strong>Show prices (@, TSHS, CTS &amp; Total) on this {{ kindLabel }}</strong>
              <small>Leave unchecked to print quantities only (matches your standard template).</small>
            </span>
          </label>

          <label class="field" style="margin-top: 10px">
            <span>Remarks / Special Instructions (optional)</span>
            <textarea v-model="formDetails.notes" rows="2" placeholder="Optional notes" />
          </label>
        </div>

        <footer class="dialog-footer">
          <button type="button" class="btn-outline" @click="formModal = false">Cancel</button>
          <button type="button" class="btn-primary" :disabled="busy" @click="submitGenerateForm">
            {{ busy ? 'Generating…' : `Generate ${kindLabel} No. ${sequence.nextFormatted || ''}` }}
          </button>
        </footer>
      </section>
    </div>

    <DocumentPreviewModal :doc="previewDoc" @close="previewDoc = null" />
  </section>
</template>

<style scoped>
.doc-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.toolbar-card {
  background: #ffffff;
  border: 1px solid #e5dec9;
  border-radius: 14px;
  padding: 12px 16px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.tabs {
  display: flex;
  gap: 6px;
  background: #f8fae5;
  padding: 4px;
  border-radius: 10px;
  border: 1px solid #e5dec9;
}

.tabs button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border: 0;
  background: transparent;
  color: #73685D;
  padding: 8px 14px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}

.tabs button.active {
  background: #43766C;
  color: #F8FAE5;
}

.count-pill {
  font-style: normal;
  font-size: 11px;
  font-weight: 800;
  padding: 1px 7px;
  border-radius: 99px;
  background: #B19470;
  color: #F8FAE5;
}

.tabs button.active .count-pill {
  background: rgba(248, 250, 229, 0.22);
}

.count-pill.neutral {
  background: #e5dec9;
  color: #26211D;
}

.toolbar-right {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.search-box {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #fbfcf2;
  border: 1px solid #e5dec9;
  border-radius: 9px;
  padding: 7px 12px;
  color: #73685D;
}

.search-box input {
  border: 0;
  background: transparent;
  outline: none;
  font-size: 13px;
  width: 210px;
  color: #26211D;
}

.seq-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #e9f1ef;
  color: #43766C;
  border: 1px solid #cde0dc;
  padding: 7px 12px;
  border-radius: 9px;
  font-size: 12.5px;
  font-weight: 600;
}

.seq-pill.unset {
  background: #f6ecea;
  color: #76453B;
  border-color: #e4c4be;
}

.table-card {
  background: #ffffff;
  border: 1px solid #e5dec9;
  border-radius: 14px;
  overflow: hidden;
}

.table-head-info {
  padding: 16px 20px;
  border-bottom: 1px solid #e5dec9;
  background: #fbfcf2;
}

.table-head-info h3 {
  margin: 0 0 3px;
  font-size: 15px;
  font-weight: 800;
  color: #26211D;
}

.table-head-info p {
  margin: 0;
  font-size: 12.5px;
  color: #73685D;
}

.table-wrap {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th {
  text-align: left;
  padding: 11px 16px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #73685D;
  background: #faf8ee;
  border-bottom: 1px solid #e5dec9;
}

td {
  padding: 13px 16px;
  font-size: 13px;
  border-bottom: 1px solid #f0ebd9;
  color: #26211D;
  vertical-align: middle;
}

tbody tr:hover td {
  background: #fdfdf7;
}

.num {
  text-align: right;
  white-space: nowrap;
}

.actions-col {
  text-align: right;
  white-space: nowrap;
}

.sub {
  display: block;
  font-size: 11.5px;
  color: #73685D;
  margin-top: 2px;
}

.doc-no {
  font-size: 14px;
  color: #43766C;
}

.price-flag {
  display: inline-block;
  padding: 2px 9px;
  border-radius: 99px;
  font-size: 11px;
  font-weight: 700;
  background: #f4efe8;
  color: #73685D;
}

.price-flag.on {
  background: #e9f1ef;
  color: #43766C;
}

.empty-state {
  padding: 44px 20px;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.empty-state strong {
  font-size: 14.5px;
  color: #26211D;
}

.empty-state span {
  font-size: 12.5px;
  color: #73685D;
}

.btn-primary,
.btn-outline {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border-radius: 9px;
  padding: 8px 14px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  border: 1px solid transparent;
}

.btn-primary.sm,
.btn-outline.sm {
  padding: 6px 11px;
  font-size: 12px;
}

.btn-primary {
  background: #43766C;
  color: #F8FAE5;
}

.btn-primary:hover:not(:disabled) {
  background: #345d55;
}

.btn-outline {
  background: #ffffff;
  color: #43766C;
  border-color: #d7cfb8;
}

.btn-outline:hover:not(:disabled) {
  background: #F8FAE5;
}

/* Pagination */
.pager {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 18px;
  border-top: 1px solid #e5dec9;
  background: #fbfcf2;
}

.pager-info {
  font-size: 12.5px;
  font-weight: 600;
  color: #73685D;
}

.pager-controls {
  display: flex;
  align-items: center;
  gap: 6px;
}

.page-size {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 700;
  color: #73685D;
  margin-right: 6px;
}

.page-size select {
  border: 1px solid #d7cfb8;
  border-radius: 7px;
  padding: 4px 8px;
  background: #ffffff;
  font-size: 12px;
  color: #26211D;
}

.pager-controls button {
  min-width: 30px;
  height: 30px;
  padding: 0 8px;
  border-radius: 7px;
  border: 1px solid #d7cfb8;
  background: #ffffff;
  color: #26211D;
  font-size: 12px;
  font-weight: 700;
  display: inline-grid;
  place-items: center;
  cursor: pointer;
}

.pager-controls button.active {
  background: #43766C;
  border-color: #43766C;
  color: #F8FAE5;
}

.pager-controls button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

/* Modals */
.shade {
  position: fixed;
  inset: 0;
  background: rgba(24, 21, 18, 0.54);
  backdrop-filter: blur(2px);
  z-index: 50;
  display: grid;
  place-items: center;
  padding: 20px;
}

.dialog-card {
  width: min(540px, 95vw);
  max-height: 90vh;
  background: #ffffff;
  border-radius: 16px;
  border: 1px solid #e5dec9;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.24);
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #e5dec9;
  background: #fbfcf2;
}

.eyebrow {
  margin: 0 0 2px;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.12em;
  color: #B19470;
}

.dialog-header h3 {
  margin: 0;
  font-size: 15.5px;
  font-weight: 800;
  color: #26211D;
}

.close-btn {
  border: 1px solid #e5dec9;
  background: #ffffff;
  color: #73685D;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: grid;
  place-items: center;
  cursor: pointer;
}

.dialog-body {
  padding: 18px 20px;
  overflow-y: auto;
}

.hint {
  margin: 0 0 14px;
  font-size: 13px;
  color: #5a5147;
  line-height: 1.5;
}

.grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.field span {
  font-size: 11.5px;
  font-weight: 700;
  color: #5a5147;
}

.field input,
.field textarea {
  border: 1px solid #d9d0b8;
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 13px;
  background: #ffffff;
}

.toggle-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-top: 14px;
  padding: 10px 12px;
  border-radius: 10px;
  background: #f8fae5;
  border: 1px solid #e5dec9;
  cursor: pointer;
}

.toggle-row input {
  margin-top: 3px;
}

.toggle-row strong {
  display: block;
  font-size: 12.5px;
  color: #26211D;
}

.toggle-row small {
  display: block;
  font-size: 11.5px;
  color: #73685D;
}

.dialog-footer {
  padding: 14px 20px;
  border-top: 1px solid #e5dec9;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  background: #fbfcf2;
}
</style>
