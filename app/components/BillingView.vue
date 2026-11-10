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
.billing-layout{display:grid;grid-template-columns:340px minmax(0,1fr);gap:18px}.card{border:1px solid #E5DEC9;border-radius:16px;background:#fff;box-shadow:0 8px 24px rgba(38,33,29,.05);overflow:hidden}.order-panel,.payment-panel{min-height:560px}.panel-heading,.payment-heading,.table-heading,.modal-fields,.payment-modal header,.payment-modal footer{display:flex;justify-content:space-between;align-items:flex-start}.panel-heading{padding:20px 20px 14px}.panel-heading h2,.payment-heading h2,.payment-modal h2,.no-selection h2{font-size:20px;font-weight:800;color:#26211D;margin:4px 0}.eyebrow{font-size:10px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#B19470}.count-badge{min-width:28px;height:28px;border-radius:99px;background:#F8FAE5;border:1px solid #E5DEC9;color:#43766C;display:grid;place-items:center;font-size:12px;font-weight:800}.search-box{padding:0 20px 14px}.search-box .form-control{border-radius:8px;font-size:13px;border-color:#E5DEC9}.order-list{border-top:1px solid #E5DEC9}.order-item{width:100%;border:0;border-bottom:1px solid #EFECE0;background:#fff;padding:14px 20px;text-align:left;display:flex;justify-content:space-between;gap:12px;color:#26211D;transition:background .15s}.order-item:hover{background:#FBFCF4}.order-item.active{background:#F8FAE5;box-shadow:inset 4px 0 #43766C}.order-item strong,.order-item small{display:block}.order-item small{color:#73685D;margin-top:3px}.order-values{text-align:right}.order-values b{display:block;font-size:12px;white-space:nowrap}.status-pill{display:inline-block;margin-top:5px;font-size:9.5px;border-radius:99px;padding:3px 8px;background:#F4EFE8;color:#76453B;font-weight:800}.status-pill.paid{background:#E9F1EF;color:#43766C}.payment-heading{padding:22px 24px;border-bottom:1px solid #E5DEC9}.payment-heading p{margin:0;color:#73685D}.btn-brand{border:1px solid #43766C;background:#43766C;color:#F8FAE5;font-weight:800;border-radius:9px;padding:9px 15px}.btn-brand:hover,.btn-brand:disabled{background:#345d55;border-color:#345d55;color:#F8FAE5}.summary-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;padding:20px 24px}.summary-grid article{padding:16px;border-radius:12px;background:#FBFCF4;border:1px solid #E5DEC9}.summary-grid .paid{background:#E9F1EF;border-color:#cce0dc;color:#43766C}.summary-grid .balance{background:#F6ECEA;border-color:#e6cfc9;color:#76453B}.summary-grid span{display:block;color:#73685D;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin-bottom:7px}.summary-grid strong{font-size:18px;font-weight:800}.table-heading{padding:0 24px 10px;align-items:center}.table-heading h3{font-size:15px;font-weight:800;margin:0}.table-heading span{font-size:11px;color:#73685D}.payment-table{margin:0;font-size:13px}.payment-table thead th{background:#F8FAE5;color:#73685D;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;border-bottom:1px solid #E5DEC9;padding:11px 24px}.payment-table td{border-color:#EFECE0;padding:13px 24px}.btn-delete{color:#76453B;font-size:12px;font-weight:800;text-decoration:none}.empty-table{text-align:center;color:#73685D;padding:40px!important}.empty-state{text-align:center;color:#73685D;padding:30px 20px}.no-selection{text-align:center;min-height:560px;display:flex;flex-direction:column;align-items:center;justify-content:center}.selection-icon{width:64px;height:64px;border-radius:50%;background:#F8FAE5;border:1px solid #E5DEC9;color:#43766C;display:grid;place-items:center;font-weight:900}.no-selection p{color:#73685D}.payment-modal-backdrop{position:fixed;inset:0;background:rgba(38,33,29,.52);z-index:100;display:grid;place-items:center;backdrop-filter:blur(3px)}.payment-modal{width:min(620px,calc(100vw - 32px));background:#fff;border:1px solid #E5DEC9;border-radius:16px;padding:24px;box-shadow:0 24px 60px rgba(38,33,29,.22)}.payment-modal header{border-bottom:1px solid #E5DEC9;padding-bottom:16px}.close-button{border:0;background:#F8FAE5;width:34px;height:34px;border-radius:50%;font-size:20px;color:#43766C;font-weight:800}.modal-fields{display:grid!important;grid-template-columns:1fr 1fr;gap:14px;padding:18px 0}.modal-fields label{font-size:12px;font-weight:800;color:#26211D}.modal-fields .notes-field{grid-column:span 2}.payment-modal footer{border-top:1px solid #E5DEC9;padding-top:16px}.payment-modal footer .btn-light{border:1px solid #E5DEC9;background:#F8FAE5;color:#26211D;font-weight:700}@media(max-width:900px){.billing-layout{grid-template-columns:1fr}.order-panel{min-height:auto}.payment-panel,.no-selection{min-height:420px}}@media(max-width:520px){.summary-grid{grid-template-columns:1fr}.modal-fields{grid-template-columns:1fr}.modal-fields .notes-field{grid-column:span 1}}
</style>
