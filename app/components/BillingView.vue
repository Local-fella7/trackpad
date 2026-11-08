<script setup lang="ts">
import Swal from 'sweetalert2'

const emit = defineEmits<{ refresh: [] }>()
const rows = ref<any[]>([])
const selected = ref<any | null>(null)
const payments = ref<any[]>([])
const busy = ref(false)
const paymentModal = ref(false)
const search = ref('')
const form = reactive({
  amountMinor: 0,
  paymentDate: new Date().toISOString().slice(0, 10),
  method: '',
  reference: '',
  notes: '',
})

const money = (n: number) => `${new Intl.NumberFormat('en-TZ', { maximumFractionDigits: 0 }).format(Number(n) || 0)} TZS`
const filteredRows = computed(() => {
  const query = search.value.trim().toLowerCase()
  if (!query) return rows.value
  return rows.value.filter(row => `${row.record_number || ''} ${row.client_name || ''}`.toLowerCase().includes(query))
})

async function load() {
  const response: any = await window.api!.billing!.list()
  if (!response.ok) throw new Error(response.error.message)
  rows.value = response.data || []
}

async function choose(row: any) {
  selected.value = row
  const response: any = await window.api!.billing!.payments(row.id)
  if (!response.ok) {
    await Swal.fire({ icon: 'error', title: 'Could not load payments', text: response.error.message })
    payments.value = []
    return
  }
  payments.value = response.data || []
}

async function add() {
  if (!selected.value || form.amountMinor <= 0) {
    await Swal.fire({ icon: 'warning', title: 'Enter a payment amount' })
    return
  }
  busy.value = true
  const response: any = await window.api!.billing!.add({
    recordId: selected.value.id,
    amountMinor: form.amountMinor,
    paymentDate: form.paymentDate,
    method: form.method,
    reference: form.reference,
    notes: form.notes,
  })
  busy.value = false
  if (!response.ok) {
    await Swal.fire({ icon: 'error', title: 'Payment not saved', text: response.error.message })
    return
  }
  Object.assign(form, {
    amountMinor: 0,
    paymentDate: new Date().toISOString().slice(0, 10),
    method: '',
    reference: '',
    notes: '',
  })
  paymentModal.value = false
  await load()
  await choose(rows.value.find(row => row.id === selected.value?.id) || selected.value)
  emit('refresh')
  await Swal.fire({ icon: 'success', title: 'Payment recorded', timer: 1800, showConfirmButton: false })
}

async function remove(id: number) {
  const result = await Swal.fire({
    title: 'Delete this payment?',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Delete payment',
    confirmButtonColor: '#b42318',
  })
  if (!result.isConfirmed) return
  const response: any = await window.api!.billing!.remove(id)
  if (!response.ok) {
    await Swal.fire({ icon: 'error', title: 'Could not delete payment', text: response.error.message })
    return
  }
  await load()
  await choose(rows.value.find(row => row.id === selected.value?.id) || selected.value)
  emit('refresh')
  await Swal.fire({ icon: 'success', title: 'Payment deleted', timer: 1800, showConfirmButton: false })
}

watch(selected, row => {
  if (row) void choose(row)
})
onMounted(load)
</script>

<template>
  <div class="billing-layout">
    <aside class="card order-panel">
      <div class="panel-heading">
        <div>
          <span class="eyebrow">Accounts</span>
          <h2>Orders</h2>
        </div>
        <span class="count-badge">{{ filteredRows.length }}</span>
      </div>
      <div class="search-box">
        <input v-model="search" class="form-control" placeholder="Search order or client" aria-label="Search orders">
      </div>
      <div class="order-list">
        <button
          v-for="row in filteredRows"
          :key="row.id"
          type="button"
          class="order-item"
          :class="{ active: selected?.id === row.id }"
          @click="choose(row)"
        >
          <span>
            <strong>{{ row.record_number || row.client_name }}</strong>
            <small>{{ row.client_name }}</small>
          </span>
          <span class="order-values">
            <b>{{ money(row.grand_total_minor - row.paid_minor) }}</b>
            <span class="status-pill" :class="{ paid: row.payment_status === 'Fully Paid' }">{{ row.payment_status }}</span>
          </span>
        </button>
        <p v-if="!filteredRows.length" class="empty-state">No orders match your search.</p>
      </div>
    </aside>

    <section class="card payment-panel">
      <template v-if="selected">
        <div class="payment-heading">
          <div>
            <span class="eyebrow">Payment account</span>
            <h2>{{ selected.record_number || selected.client_name }}</h2>
            <p>{{ selected.client_name }}</p>
          </div>
          <button class="btn btn-brand" :disabled="busy || selected.paid_minor >= selected.grand_total_minor" @click="paymentModal = true">
            + Record payment
          </button>
        </div>

        <div class="summary-grid">
          <article><span>Total</span><strong>{{ money(selected.grand_total_minor) }}</strong></article>
          <article class="paid"><span>Paid</span><strong>{{ money(selected.paid_minor) }}</strong></article>
          <article class="balance"><span>Balance</span><strong>{{ money(selected.grand_total_minor - selected.paid_minor) }}</strong></article>
        </div>

        <div class="table-heading">
          <div><h3>Payment history</h3><span>{{ payments.length }} transaction{{ payments.length === 1 ? '' : 's' }}</span></div>
        </div>
        <div class="table-responsive">
          <table class="table payment-table align-middle">
            <thead><tr><th>Date</th><th>Amount</th><th>Method</th><th>Reference</th><th class="text-end">Action</th></tr></thead>
            <tbody>
              <tr v-for="payment in payments" :key="payment.id">
                <td>{{ payment.payment_date }}</td>
                <td><strong>{{ money(payment.amount_minor) }}</strong></td>
                <td>{{ payment.method || '—' }}</td>
                <td>{{ payment.reference || '—' }}</td>
                <td class="text-end"><button class="btn btn-link btn-delete" @click="remove(payment.id)">Delete</button></td>
              </tr>
              <tr v-if="!payments.length"><td colspan="5" class="empty-table">No payments recorded for this order.</td></tr>
            </tbody>
          </table>
        </div>
      </template>
      <div v-else class="no-selection">
        <span class="selection-icon">TZS</span>
        <h2>Select an order</h2>
        <p>Choose an order to review its balance and payment history.</p>
      </div>
    </section>

    <div v-if="paymentModal" class="payment-modal-backdrop" @mousedown.self="paymentModal = false">
      <form class="payment-modal" @submit.prevent="add">
        <header>
          <div><span class="eyebrow">Payment</span><h2>Record payment</h2></div>
          <button type="button" class="close-button" aria-label="Close" @click="paymentModal = false">×</button>
        </header>
        <div class="modal-fields">
          <label class="form-label">Amount (TZS)<input v-model.number="form.amountMinor" type="number" min="1" :max="selected ? selected.grand_total_minor - selected.paid_minor : undefined" class="form-control" required></label>
          <label class="form-label">Payment date<input v-model="form.paymentDate" type="date" class="form-control" required></label>
          <label class="form-label">Method<select v-model="form.method" class="form-select"><option value="">Select method</option><option>Cash</option><option>Bank transfer</option><option>Mobile money</option><option>Card</option></select></label>
          <label class="form-label">Reference<input v-model="form.reference" class="form-control"></label>
          <label class="form-label notes-field">Notes<textarea v-model="form.notes" rows="3" class="form-control"></textarea></label>
        </div>
        <footer>
          <button type="button" class="btn btn-light" @click="paymentModal = false">Cancel</button>
          <button class="btn btn-brand" :disabled="busy">Save payment</button>
        </footer>
      </form>
    </div>
  </div>
</template>

<style scoped>
.billing-layout{display:grid;grid-template-columns:340px minmax(0,1fr);gap:18px}.card{border:1px solid #e5e9e7;border-radius:14px;background:#fff;box-shadow:0 8px 24px rgba(16,29,50,.04)}.order-panel,.payment-panel{min-height:560px}.panel-heading,.payment-heading,.table-heading,.modal-fields,.payment-modal header,.payment-modal footer{display:flex;justify-content:space-between;align-items:flex-start}.panel-heading{padding:20px 20px 14px}.panel-heading h2,.payment-heading h2,.payment-modal h2,.no-selection h2{font-size:20px;margin:4px 0}.eyebrow{font-size:10px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#6f7b76}.count-badge{min-width:28px;height:28px;border-radius:99px;background:#edf5f1;color:#147d58;display:grid;place-items:center;font-size:12px;font-weight:800}.search-box{padding:0 20px 14px}.search-box .form-control{border-radius:8px;font-size:13px}.order-list{border-top:1px solid #edf0ee}.order-item{width:100%;border:0;border-bottom:1px solid #edf0ee;background:#fff;padding:14px 20px;text-align:left;display:flex;justify-content:space-between;gap:12px;color:#18253a}.order-item:hover{background:#f7faf8}.order-item.active{background:#edf7f2;box-shadow:inset 3px 0 #147d58}.order-item strong,.order-item small{display:block}.order-item small{color:#7b8580;margin-top:3px}.order-values{text-align:right}.order-values b{display:block;font-size:12px;white-space:nowrap}.status-pill{display:inline-block;margin-top:5px;font-size:9px;border-radius:99px;padding:3px 7px;background:#fff4df;color:#9a6700;font-weight:800}.status-pill.paid{background:#e6f4ed;color:#147d58}.payment-heading{padding:22px 24px;border-bottom:1px solid #edf0ee}.payment-heading p{margin:0;color:#7b8580}.btn-brand{border:1px solid #147d58;background:#147d58;color:#fff;font-weight:800;border-radius:8px}.btn-brand:hover,.btn-brand:disabled{background:#0f6848;border-color:#0f6848;color:#fff}.summary-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;padding:20px 24px}.summary-grid article{padding:16px;border-radius:10px;background:#f6f8f7;border:1px solid #edf0ee}.summary-grid .paid{background:#edf7f2}.summary-grid .balance{background:#fff5ec}.summary-grid span{display:block;color:#6f7b76;font-size:11px;margin-bottom:7px}.summary-grid strong{font-size:17px}.table-heading{padding:0 24px 10px;align-items:center}.table-heading h3{font-size:15px;margin:0}.table-heading span{font-size:11px;color:#7b8580}.payment-table{margin:0;font-size:13px}.payment-table thead th{background:#f8faf9;color:#6f7b76;font-size:10px;text-transform:uppercase;letter-spacing:.05em;border-bottom:1px solid #e5e9e7;padding:11px 24px}.payment-table td{border-color:#edf0ee;padding:13px 24px}.btn-delete{color:#b42318;font-size:12px;font-weight:800;text-decoration:none}.empty-table{text-align:center;color:#8a938f;padding:40px!important}.empty-state{text-align:center;color:#8a938f;padding:30px 20px}.no-selection{text-align:center;min-height:560px;display:flex;flex-direction:column;align-items:center;justify-content:center}.selection-icon{width:64px;height:64px;border-radius:50%;background:#edf5f1;color:#147d58;display:grid;place-items:center;font-weight:900}.no-selection p{color:#7b8580}.payment-modal-backdrop{position:fixed;inset:0;background:rgba(7,18,15,.48);z-index:100;display:grid;place-items:center;backdrop-filter:blur(3px)}.payment-modal{width:min(620px,calc(100vw - 32px));background:#fff;border-radius:14px;padding:22px;box-shadow:0 24px 60px rgba(0,0,0,.18)}.payment-modal header{border-bottom:1px solid #edf0ee;padding-bottom:16px}.close-button{border:0;background:#f3f5f4;width:34px;height:34px;border-radius:50%;font-size:22px;color:#66736e}.modal-fields{display:grid!important;grid-template-columns:1fr 1fr;gap:14px;padding:18px 0}.modal-fields label{font-size:12px;font-weight:800}.modal-fields .notes-field{grid-column:span 2}.payment-modal footer{border-top:1px solid #edf0ee;padding-top:16px}.payment-modal footer .btn-light{border:1px solid #dde3e0;font-weight:700}@media(max-width:900px){.billing-layout{grid-template-columns:1fr}.order-panel{min-height:auto}.payment-panel,.no-selection{min-height:420px}}@media(max-width:520px){.summary-grid{grid-template-columns:1fr}.modal-fields{grid-template-columns:1fr}.modal-fields .notes-field{grid-column:span 1}}
</style>
