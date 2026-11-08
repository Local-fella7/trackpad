<script setup lang="ts">
defineProps<{ report: any; type: string; day: string; month: string; days: number }>()
const emit = defineEmits<{
  preview: []
  excel: []
  pdf: []
  print: []
  'update:type': [v: string]
  'update:day': [v: string]
  'update:month': [v: string]
  'update:days': [v: number]
}>()

const types = [
  ['daily', 'Daily report'],
  ['monthly', 'Monthly report'],
  ['upcoming-events', 'Upcoming events'],
  ['unpaid-invoices', 'Unpaid invoices'],
  ['delivery-due', 'Delivery due'],
  ['status-summary', 'Status summary'],
  ['client-summary', 'Client summary'],
]
const money = (n: number) => `${new Intl.NumberFormat('en-TZ', { maximumFractionDigits: 0 }).format(Number(n) || 0)} TZS`
const label = (key: string) => key.replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase())
const preferred = ['record_number', 'client_name', 'record_date', 'event_date', 'status_name', 'grand_total_minor', 'paid_minor', 'payment_status', 'invoice_no', 'location']
const columns = (report: any) => {
  const keys = Object.keys(report?.rows?.[0] || report?.summary?.[0] || {})
  return preferred.filter(key => keys.includes(key)).concat(
    keys.filter(key => !preferred.includes(key) && !['id', 'status_id', 'currency', 'deleted_at', 'created_at', 'updated_at'].includes(key)).slice(0, 5),
  )
}
</script>

<template>
  <div class="reports-layout">
    <section class="report-controls card">
      <div class="controls-heading">
        <div><span class="eyebrow">Report builder</span><h2>Configure report</h2></div>
      </div>
      <label class="form-label">Report type
        <select class="form-select" :value="type" @change="emit('update:type', ($event.target as HTMLSelectElement).value)">
          <option v-for="item in types" :key="item[0]" :value="item[0]">{{ item[1] }}</option>
        </select>
      </label>
      <label v-if="type === 'daily'" class="form-label">Date
        <input class="form-control" :value="day" type="date" @input="emit('update:day', ($event.target as HTMLInputElement).value)">
      </label>
      <label v-if="type === 'monthly'" class="form-label">Month
        <input class="form-control" :value="month" type="month" @input="emit('update:month', ($event.target as HTMLInputElement).value)">
      </label>
      <label v-if="type === 'upcoming-events'" class="form-label">Days ahead
        <input class="form-control" :value="days" type="number" min="1" max="365" @input="emit('update:days', Number(($event.target as HTMLInputElement).value))">
      </label>
      <button class="btn btn-brand w-100" @click="emit('preview')">Preview report</button>
    </section>

    <section v-if="report" class="report-preview card">
      <header class="report-header">
        <div>
          <span class="eyebrow">Preview</span>
          <h1>{{ report.title || report.type.replaceAll('-', ' ') }}</h1>
          <p>{{ report.period }}</p>
        </div>
        <div class="report-actions">
          <button class="btn btn-outline-secondary" @click="emit('print')">Print</button>
          <button class="btn btn-outline-secondary" @click="emit('excel')">Excel</button>
          <button class="btn btn-brand" @click="emit('pdf')">Save PDF</button>
        </div>
      </header>

      <div v-if="report.summary?.length" class="summary-grid">
        <article v-for="(item, index) in report.summary" :key="index">
          <span>{{ item.status_name || item.client_name || 'Total' }}</span>
          <strong>{{ money(item.total_minor ?? item.grand_total_minor) }}</strong>
          <small>{{ item.records || 0 }} order{{ item.records === 1 ? '' : 's' }}</small>
        </article>
      </div>

      <div class="report-table-wrap">
        <table class="table report-table align-middle">
          <thead><tr><th v-for="key in columns(report)" :key="key">{{ label(key) }}</th></tr></thead>
          <tbody>
            <tr v-for="(row, index) in report.rows" :key="row.id || index">
              <td v-for="key in columns(report)" :key="key">
                {{ String(key.includes('minor') ? money(Number(row[key])) : row[key] ?? '—') }}
              </td>
            </tr>
            <tr v-if="!report.rows?.length"><td :colspan="columns(report).length" class="empty-table">No records match this report.</td></tr>
          </tbody>
        </table>
      </div>
      <footer class="report-footer">
        <span>Trackpad Report</span>
        <span>Generated {{ new Date().toLocaleString() }}</span>
      </footer>
    </section>

    <section v-else class="report-preview card empty-preview">
      <span class="selection-icon">PDF</span>
      <h2>No report selected</h2>
      <p>Configure the report and select “Preview report” to generate it.</p>
    </section>
  </div>
</template>

<style scoped>
.reports-layout{display:grid;grid-template-columns:280px minmax(0,1fr);gap:18px}.card{border:1px solid #e5e9e7;border-radius:14px;background:#fff;box-shadow:0 8px 24px rgba(16,29,50,.04)}.report-controls{padding:20px;height:max-content}.controls-heading{border-bottom:1px solid #edf0ee;margin-bottom:18px;padding-bottom:14px}.controls-heading h2{font-size:19px;margin:4px 0}.eyebrow{font-size:10px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#6f7b76}.report-controls .form-label{width:100%;margin-bottom:14px;font-size:12px;font-weight:800}.btn-brand{border:1px solid #147d58;background:#147d58;color:#fff;font-weight:800;border-radius:8px}.btn-brand:hover{background:#0f6848;border-color:#0f6848}.report-preview{min-height:560px;overflow:hidden}.report-header{display:flex;justify-content:space-between;align-items:flex-start;padding:22px 24px;border-bottom:1px solid #edf0ee}.report-header h1{font-size:22px;margin:4px 0 2px}.report-header p{margin:0;color:#7b8580;font-size:13px}.report-actions{display:flex;gap:8px}.report-actions .btn{font-size:12px;font-weight:800;border-radius:8px}.summary-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;padding:18px 24px}.summary-grid article{border-radius:9px;background:#f7faf8;border:1px solid #edf0ee;padding:13px}.summary-grid span,.summary-grid small{display:block;color:#6f7b76}.summary-grid span{font-size:11px}.summary-grid strong{display:block;margin:6px 0;font-size:15px}.summary-grid small{font-size:10px}.report-table-wrap{padding:0 24px 18px}.report-table{font-size:12px}.report-table thead th{background:#147d58;color:#fff;border:0;text-transform:uppercase;font-size:9px;letter-spacing:.04em;padding:10px 12px}.report-table td{border-color:#edf0ee;padding:10px 12px}.empty-table{text-align:center;color:#8a938f;padding:50px!important}.report-footer{border-top:1px solid #edf0ee;padding:12px 24px;display:flex;justify-content:space-between;color:#8a938f;font-size:10px}.empty-preview{min-height:560px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}.selection-icon{width:64px;height:64px;border-radius:50%;background:#edf5f1;color:#147d58;display:grid;place-items:center;font-weight:900}.empty-preview h2{font-size:20px;margin-top:12px}.empty-preview p{color:#7b8580}@media(max-width:900px){.reports-layout{grid-template-columns:1fr}.report-preview{min-height:420px}.report-controls{position:static}}@media print{.reports-layout{display:block}.report-controls,.report-actions,.report-footer{display:none!important}.report-preview{border:0;box-shadow:none;min-height:0}.report-table thead th{-webkit-print-color-adjust:exact;print-color-adjust:exact}.report-table-wrap{overflow:visible;padding:0}.report-header{padding-left:0;padding-right:0}}
</style>
