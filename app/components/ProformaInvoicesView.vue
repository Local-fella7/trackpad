<script setup lang="ts">
import {
  Eye,
  FileEdit,
  FilePlus2,
  Hash,
  Plus,
  Search,
  Settings2,
  Trash2,
  X,
} from 'lucide-vue-next'
import Swal from 'sweetalert2'
import { formatDate } from '../../shared/date'
import type { DocumentRecord, PendingOrderRow, SequenceStatus } from '../../shared/document-types'
import DocumentPreviewModal from './DocumentPreviewModal.vue'

const emit = defineEmits<{ refresh: [] }>()

const activeTab = ref<'pending' | 'issued'>('pending')
const search = ref('')
const loading = ref(false)
const busy = ref(false)

const sequence = ref<SequenceStatus>({
  sequenceGroup: 'proforma_invoice',
  configured: false,
  startNumber: null,
  nextNumber: null,
  nextFormatted: null,
})

const pendingOrders = ref<PendingOrderRow[]>([])
const issuedDocs = ref<DocumentRecord[]>([])
const previewDoc = ref<DocumentRecord | null>(null)

// Start-number modal state
const sequenceModal = ref(false)
const sequenceInput = ref('0948')
const pendingActionAfterSequence = ref<(() => Promise<void>) | null>(null)

// Amend Proforma -> Raise Invoice modal state
const amendModal = ref(false)
const amendSource = ref<DocumentRecord | null>(null)
const amendForm = reactive({
  issueDate: new Date().toISOString().slice(0, 10),
  discountMinor: 0,
  notes: '',
  items: [] as Array<{
    description: string
    quantity: number | null
    unitPrice: number | null
    lineTotal: number
    isLumpSum: boolean
  }>,
})

const money = (n: unknown) =>
  `${new Intl.NumberFormat('en-TZ', { maximumFractionDigits: 0 }).format(Number(n) || 0)} TZS`
const date = (v?: string | null) => formatDate(v, '—')

const amendSubtotal = computed(() =>
  amendForm.items.reduce((sum, item) => {
    if (item.isLumpSum) return sum + Math.max(0, Math.round(Number(item.lineTotal || 0)))
    return sum + Math.max(0, Math.round(Number(item.quantity || 0) * Number(item.unitPrice || 0)))
  }, 0),
)
const amendDiscount = computed(() =>
  Math.max(0, Math.min(amendSubtotal.value, Math.round(Number(amendForm.discountMinor || 0)))),
)
const amendGrandTotal = computed(() => Math.max(0, amendSubtotal.value - amendDiscount.value))

async function loadAll() {
  loading.value = true
  try {
    const [seqRes, pendingRes, issuedRes] = await Promise.all([
      window.api!.documents.sequenceStatus('proforma_invoice'),
      window.api!.documents.pendingOrders({ docKind: 'proforma', search: search.value }),
      window.api!.documents.list({ sequenceGroup: 'proforma_invoice', search: search.value }),
    ])
    if (seqRes.ok) sequence.value = seqRes.data
    if (pendingRes.ok) pendingOrders.value = pendingRes.data || []
    if (issuedRes.ok) issuedDocs.value = issuedRes.data || []
  } finally {
    loading.value = false
  }
}

watch(search, () => {
  void loadAll()
})

function openSequenceModal(afterSave?: () => Promise<void>) {
  sequenceInput.value = sequence.value.nextFormatted || '0948'
  pendingActionAfterSequence.value = afterSave ?? null
  sequenceModal.value = true
}

async function saveSequenceStart() {
  const num = Number.parseInt(sequenceInput.value.replaceAll(/\D/g, ''), 10)
  if (!Number.isFinite(num) || num < 1) {
    await Swal.fire({ icon: 'error', title: 'Invalid number', text: 'Enter a positive starting number (e.g. 0948).', confirmButtonColor: '#76453B' })
    return
  }
  busy.value = true
  try {
    const res = await window.api!.documents.setSequenceStart({
      sequenceGroup: 'proforma_invoice',
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
        title: `Next number set to ${res.data.nextFormatted}`,
        text: 'Existing issued numbers remain untouched and will be skipped automatically.',
        timer: 2400,
        showConfirmButton: false,
      })
    }
  } finally {
    busy.value = false
  }
}

async function generateProforma(order: PendingOrderRow) {
  if (!sequence.value.configured) {
    openSequenceModal(() => generateProforma(order))
    return
  }
  busy.value = true
  try {
    const res = await window.api!.documents.createProforma({
      recordId: order.id,
      issueDate: new Date().toISOString().slice(0, 10),
    })
    if (!res.ok) {
      await Swal.fire({ icon: 'error', title: 'Could not generate Proforma', text: res.error.message, confirmButtonColor: '#76453B' })
      return
    }
    await loadAll()
    emit('refresh')
    previewDoc.value = res.data
  } finally {
    busy.value = false
  }
}

function openAmendModal(doc: DocumentRecord) {
  if (!sequence.value.configured) {
    openSequenceModal(async () => openAmendModal(doc))
    return
  }
  amendSource.value = doc
  amendForm.issueDate = new Date().toISOString().slice(0, 10)
  amendForm.discountMinor = Number(doc.discount_minor || 0)
  amendForm.notes = doc.notes || ''
  amendForm.items = (doc.items || []).map(item => ({
    description: item.description,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    lineTotal: item.lineTotal,
    isLumpSum: Boolean(item.isLumpSum),
  }))
  if (!amendForm.items.length) {
    amendForm.items.push({ description: '', quantity: 1, unitPrice: 0, lineTotal: 0, isLumpSum: false })
  }
  amendModal.value = true
}

function addAmendRow() {
  amendForm.items.push({ description: '', quantity: 1, unitPrice: 0, lineTotal: 0, isLumpSum: false })
}

function removeAmendRow(index: number) {
  if (amendForm.items.length <= 1) return
  amendForm.items.splice(index, 1)
}

async function submitAmendInvoice() {
  if (!amendSource.value) return
  const invalid = amendForm.items.some(item => {
    if (!item.description.trim()) return true
    if (item.isLumpSum) return Number(item.lineTotal || 0) < 0
    return Number(item.quantity || 0) <= 0 || Number(item.unitPrice || 0) < 0
  })
  if (invalid) {
    await Swal.fire({
      icon: 'error',
      title: 'Check line items',
      text: 'Every item needs a description and valid quantity/price (or lump-sum amount).',
      confirmButtonColor: '#76453B',
    })
    return
  }

  busy.value = true
  try {
    const res = await window.api!.documents.amendProforma({
      sourceDocumentId: amendSource.value.id,
      issueDate: amendForm.issueDate,
      discountMinor: Number(amendForm.discountMinor || 0),
      notes: amendForm.notes,
      items: amendForm.items.map(item => ({
        description: item.description.trim(),
        quantity: item.isLumpSum ? (item.quantity && Number(item.quantity) > 0 ? Number(item.quantity) : null) : Number(item.quantity),
        unitPrice: item.isLumpSum ? null : Number(item.unitPrice || 0),
        lineTotal: item.isLumpSum ? Number(item.lineTotal || 0) : Math.round(Number(item.quantity || 0) * Number(item.unitPrice || 0)),
        isLumpSum: item.isLumpSum,
      })),
    })
    if (!res.ok) {
      await Swal.fire({ icon: 'error', title: 'Could not raise Invoice', text: res.error.message, confirmButtonColor: '#76453B' })
      return
    }
    amendModal.value = false
    amendSource.value = null
    await loadAll()
    emit('refresh')
    activeTab.value = 'issued'
    previewDoc.value = res.data
  } finally {
    busy.value = false
  }
}

onMounted(loadAll)
</script>

<template>
  <section class="doc-page">
    <!-- Sequence & Controls Bar -->
    <div class="toolbar-card">
      <div class="tabs">
        <button type="button" :class="{ active: activeTab === 'pending' }" @click="activeTab = 'pending'">
          <span>Orders Without Proforma</span>
          <em class="count-pill">{{ pendingOrders.length }}</em>
        </button>
        <button type="button" :class="{ active: activeTab === 'issued' }" @click="activeTab = 'issued'">
          <span>Issued Proformas &amp; Invoices</span>
          <em class="count-pill neutral">{{ issuedDocs.length }}</em>
        </button>
      </div>

      <div class="toolbar-right">
        <label class="search-box">
          <Search :size="15" />
          <input v-model="search" placeholder="Search client, order #, or doc #…" />
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

    <!-- Tab 1: Orders Without Proforma -->
    <div v-if="activeTab === 'pending'" class="table-card">
      <div class="table-head-info">
        <div>
          <h3>Orders Waiting for Proforma Invoice</h3>
          <p>Select any order below to generate an official M&amp;S Decorations Proforma Invoice with automatic numbering.</p>
        </div>
      </div>

      <div v-if="!pendingOrders.length" class="empty-state">
        <strong>{{ loading ? 'Loading orders…' : 'All active orders already have a Proforma Invoice.' }}</strong>
        <span>New orders you create without a proforma number will appear here automatically.</span>
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
            <tr v-for="order in pendingOrders" :key="order.id">
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
                <button type="button" class="btn-primary sm" :disabled="busy" @click="generateProforma(order)">
                  <FilePlus2 :size="14" />
                  <span>Generate Proforma</span>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Tab 2: Issued Proformas & Invoices -->
    <div v-else class="table-card">
      <div class="table-head-info">
        <div>
          <h3>Issued Proforma Invoices &amp; Amended Invoices</h3>
          <p>Preview, print, save as PDF, or amend any Proforma to raise an official <strong>Invoice</strong> with the next sequential number.</p>
        </div>
      </div>

      <div v-if="!issuedDocs.length" class="empty-state">
        <strong>{{ loading ? 'Loading documents…' : 'No Proforma Invoices or Invoices issued yet.' }}</strong>
        <span>Generate your first Proforma from the "Orders Without Proforma" tab.</span>
      </div>

      <div v-else class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Doc No.</th>
              <th>Type</th>
              <th>Client</th>
              <th>Order #</th>
              <th>Issue / Event Date</th>
              <th class="num">Total</th>
              <th class="actions-col">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="doc in issuedDocs" :key="doc.id">
              <td>
                <strong class="doc-no">{{ doc.doc_number }}</strong>
                <small v-if="doc.parent_doc_number" class="sub ref-sub">
                  Amended from {{ doc.parent_doc_number }}
                </small>
              </td>
              <td>
                <span class="doc-badge" :class="doc.doc_type">
                  {{ doc.doc_type === 'invoice' ? 'INVOICE' : 'PROFORMA' }}
                </span>
              </td>
              <td>
                <strong>{{ doc.client_name }}</strong>
                <small class="sub">{{ doc.location || '—' }}</small>
              </td>
              <td>{{ doc.record_number || `#${doc.record_id}` }}</td>
              <td>
                <span>{{ date(doc.issue_date) }}</span>
                <small class="sub">Event: {{ date(doc.event_date) }}</small>
              </td>
              <td class="num"><strong>{{ money(doc.grand_total_minor) }}</strong></td>
              <td class="actions-col">
                <div class="row-actions">
                  <button type="button" class="btn-outline sm" @click="previewDoc = doc">
                    <Eye :size="14" />
                    <span>Preview / PDF</span>
                  </button>
                  <button type="button" class="btn-tan sm" @click="openAmendModal(doc)">
                    <FileEdit :size="14" />
                    <span>Amend → Invoice</span>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Set / Reset Start Number Modal -->
    <div v-if="sequenceModal" class="shade" @mousedown.self="sequenceModal = false">
      <section class="dialog-card">
        <header class="dialog-header">
          <div>
            <p class="eyebrow">DOCUMENT NUMBERING</p>
            <h3>{{ sequence.configured ? 'Reset Starting Number' : 'Set Starting Proforma / Invoice Number' }}</h3>
          </div>
          <button type="button" class="close-btn" @click="sequenceModal = false"><X :size="18" /></button>
        </header>

        <div class="dialog-body">
          <p class="hint">
            Enter the number to start from (for example <strong>0948</strong>). Both Proforma Invoices and Amended Invoices
            will increment automatically from this number. Already-issued numbers are preserved and skipped automatically.
          </p>
          <label class="field">
            <span>Starting Number</span>
            <input v-model="sequenceInput" placeholder="e.g. 0948" inputmode="numeric" @keyup.enter="saveSequenceStart" />
          </label>
        </div>

        <footer class="dialog-footer">
          <button type="button" class="btn-outline" @click="sequenceModal = false">Cancel</button>
          <button type="button" class="btn-primary" :disabled="busy" @click="saveSequenceStart">
            Save Starting Number
          </button>
        </footer>
      </section>
    </div>

    <!-- Amend Proforma -> Raise Invoice Modal -->
    <div v-if="amendModal && amendSource" class="shade" @mousedown.self="amendModal = false">
      <section class="dialog-card wide">
        <header class="dialog-header">
          <div>
            <p class="eyebrow">AMEND PROFORMA {{ amendSource.doc_number }} → RAISE INVOICE</p>
            <h3>Raise Amended Invoice ({{ sequence.nextFormatted || 'Next No.' }}) — {{ amendSource.client_name }}</h3>
          </div>
          <button type="button" class="close-btn" @click="amendModal = false"><X :size="18" /></button>
        </header>

        <div class="dialog-body">
          <div class="amend-banner">
            This will create a new official <strong>INVOICE</strong> numbered <strong>{{ sequence.nextFormatted }}</strong>
            referencing <strong>{{ amendSource.doc_type === 'invoice' ? 'Invoice' : 'Proforma' }} {{ amendSource.doc_number }}</strong>,
            and sync the updated items &amp; total to the linked order. The original Proforma remains saved in history.
          </div>

          <div class="meta-row">
            <label class="field">
              <span>Invoice Issue Date</span>
              <input v-model="amendForm.issueDate" type="date" />
            </label>
            <label class="field">
              <span>Discount (TZS)</span>
              <input v-model.number="amendForm.discountMinor" type="number" min="0" step="1000" />
            </label>
          </div>

          <div class="items-editor">
            <div class="items-editor-head">
              <strong>Line Items</strong>
              <button type="button" class="btn-outline sm" @click="addAmendRow">
                <Plus :size="14" />
                <span>Add Item</span>
              </button>
            </div>

            <div v-for="(item, idx) in amendForm.items" :key="idx" class="item-row">
              <input v-model="item.description" class="desc-input" placeholder="Particulars / item description" />
              <label class="lump-toggle" title="Check for lump-sum lines like Transport with no unit price">
                <input v-model="item.isLumpSum" type="checkbox" />
                <span>Lump sum</span>
              </label>
              <input
                v-model.number="item.quantity"
                type="number"
                min="0"
                step="1"
                class="qty-input"
                :placeholder="item.isLumpSum ? 'Qty (opt)' : 'Qty'"
              />
              <input
                v-if="!item.isLumpSum"
                v-model.number="item.unitPrice"
                type="number"
                min="0"
                step="500"
                class="price-input"
                placeholder="Unit @"
              />
              <input
                v-else
                v-model.number="item.lineTotal"
                type="number"
                min="0"
                step="500"
                class="price-input"
                placeholder="Total TSHS"
              />
              <div class="line-total">
                {{
                  money(
                    item.isLumpSum
                      ? item.lineTotal
                      : Math.round(Number(item.quantity || 0) * Number(item.unitPrice || 0)),
                  )
                }}
              </div>
              <button
                type="button"
                class="icon-del"
                :disabled="amendForm.items.length <= 1"
                title="Remove row"
                @click="removeAmendRow(idx)"
              >
                <Trash2 :size="15" />
              </button>
            </div>
          </div>

          <label class="field" style="margin-top: 12px">
            <span>Remarks / Notes (optional)</span>
            <textarea v-model="amendForm.notes" rows="2" placeholder="Optional remarks on the invoice" />
          </label>

          <div class="totals-compare">
            <div>
              <small>ORIGINAL ({{ amendSource.doc_number }})</small>
              <strong>{{ money(amendSource.grand_total_minor) }}</strong>
            </div>
            <div class="new-total">
              <small>NEW INVOICE TOTAL ({{ sequence.nextFormatted }})</small>
              <strong>{{ money(amendGrandTotal) }}</strong>
            </div>
          </div>
        </div>

        <footer class="dialog-footer">
          <button type="button" class="btn-outline" @click="amendModal = false">Cancel</button>
          <button type="button" class="btn-primary" :disabled="busy" @click="submitAmendInvoice">
            {{ busy ? 'Raising Invoice…' : `Raise Invoice No. ${sequence.nextFormatted || ''}` }}
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

.row-actions {
  display: inline-flex;
  gap: 8px;
}

.sub {
  display: block;
  font-size: 11.5px;
  color: #73685D;
  margin-top: 2px;
}

.ref-sub {
  color: #B19470;
  font-weight: 700;
}

.doc-no {
  font-size: 14px;
  color: #43766C;
}

.doc-badge {
  display: inline-block;
  padding: 3px 9px;
  border-radius: 99px;
  font-size: 10.5px;
  font-weight: 800;
  letter-spacing: 0.05em;
}

.doc-badge.proforma {
  background: #e9f1ef;
  color: #43766C;
}

.doc-badge.invoice {
  background: #f4efe8;
  color: #76453B;
  border: 1px solid #d9c5a9;
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

/* Buttons */
.btn-primary,
.btn-outline,
.btn-tan {
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
.btn-outline.sm,
.btn-tan.sm {
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

.btn-tan {
  background: #B19470;
  color: #F8FAE5;
}

.btn-tan:hover:not(:disabled) {
  background: #9c7e5a;
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
  width: min(480px, 95vw);
  max-height: 90vh;
  background: #ffffff;
  border-radius: 16px;
  border: 1px solid #e5dec9;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.24);
}

.dialog-card.wide {
  width: min(820px, 96vw);
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

.amend-banner {
  background: #f8fae5;
  border: 1px solid #d9d0b4;
  border-left: 4px solid #43766C;
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 12.5px;
  color: #26211D;
  margin-bottom: 14px;
}

.meta-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 14px;
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

.items-editor {
  border: 1px solid #e5dec9;
  border-radius: 10px;
  padding: 12px;
  background: #fbfcf5;
}

.items-editor-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.item-row {
  display: grid;
  grid-template-columns: 1fr auto 82px 115px 110px 32px;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
}

.item-row input[type='text'],
.item-row input[type='number'],
.desc-input {
  border: 1px solid #d9d0b8;
  border-radius: 7px;
  padding: 7px 9px;
  font-size: 12.5px;
  background: #ffffff;
  width: 100%;
}

.lump-toggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 700;
  color: #73685D;
  white-space: nowrap;
  cursor: pointer;
}

.line-total {
  text-align: right;
  font-size: 12.5px;
  font-weight: 700;
  color: #26211D;
  white-space: nowrap;
}

.icon-del {
  border: 1px solid #e5dec9;
  background: #ffffff;
  color: #76453B;
  width: 30px;
  height: 30px;
  border-radius: 7px;
  display: grid;
  place-items: center;
  cursor: pointer;
}

.icon-del:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.totals-compare {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-top: 14px;
}

.totals-compare > div {
  background: #fbfcf2;
  border: 1px solid #e5dec9;
  border-radius: 10px;
  padding: 10px 14px;
}

.totals-compare .new-total {
  background: #e9f1ef;
  border-color: #43766C;
}

.totals-compare small {
  display: block;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.08em;
  color: #73685D;
}

.totals-compare strong {
  font-size: 17px;
  color: #26211D;
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
