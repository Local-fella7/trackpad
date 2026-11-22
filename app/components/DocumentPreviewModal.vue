<script setup lang="ts">
import { Download, Printer, X } from 'lucide-vue-next'
import Swal from 'sweetalert2'
import { buildDocumentHtml } from '../../shared/document-templates'
import type { DocumentRecord } from '../../shared/document-types'

const props = defineProps<{
  doc: DocumentRecord | null
}>()

const emit = defineEmits<{
  close: []
}>()

const busy = ref<'pdf' | 'print' | ''>('')

const docLabel = computed(() => {
  if (!props.doc) return ''
  if (props.doc.doc_type === 'proforma') return `Proforma Invoice No. ${props.doc.doc_number}`
  if (props.doc.doc_type === 'invoice') return `Invoice No. ${props.doc.doc_number}`
  if (props.doc.doc_type === 'order_form') return `Customer Order Form No. ${props.doc.doc_number}`
  return `Delivery Note No. ${props.doc.doc_number}`
})

const previewHtml = computed(() => {
  if (!props.doc) return ''
  const origin = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : ''
  const base = origin && origin !== 'null' ? origin : ''
  return buildDocumentHtml(props.doc, {
    headerSrc: `${base}/branding/ms-header.png`,
    footerSrc: `${base}/branding/ms-footer.png`,
  })
})

async function savePdf() {
  if (!props.doc) return
  busy.value = 'pdf'
  try {
    const r: any = await window.api!.documents.exportPdf(props.doc.id)
    if (!r.ok) {
      await Swal.fire({ icon: 'error', title: 'Export failed', text: r.error.message, confirmButtonColor: '#76453B' })
      return
    }
    if (!r.data?.path) return
    const result = await Swal.fire({
      icon: 'success',
      title: `${docLabel.value} saved as PDF`,
      text: `Saved to ${r.data.path}`,
      showCancelButton: true,
      confirmButtonText: 'Open folder',
      cancelButtonText: 'Done',
      confirmButtonColor: '#43766C',
    })
    if (result.isConfirmed) {
      await window.api!.reports.openFolder(r.data.path)
    }
  } finally {
    busy.value = ''
  }
}

async function printDoc() {
  if (!props.doc) return
  busy.value = 'print'
  try {
    const r: any = await window.api!.documents.print(props.doc.id)
    if (!r.ok) {
      await Swal.fire({ icon: 'error', title: 'Print failed', text: r.error.message, confirmButtonColor: '#76453B' })
    }
  } finally {
    busy.value = ''
  }
}
</script>

<template>
  <div v-if="doc" class="preview-shade" @mousedown.self="emit('close')">
    <section class="preview-dialog">
      <header class="preview-header">
        <div>
          <p class="eyebrow">DOCUMENT PREVIEW · M&amp;S DECORATIONS</p>
          <h2>{{ docLabel }} — {{ doc.client_name }}</h2>
        </div>
        <div class="preview-actions">
          <button type="button" class="btn-secondary" :disabled="Boolean(busy)" @click="printDoc">
            <Printer :size="15" />
            <span>{{ busy === 'print' ? 'Printing…' : 'Print' }}</span>
          </button>
          <button type="button" class="btn-primary" :disabled="Boolean(busy)" @click="savePdf">
            <Download :size="15" />
            <span>{{ busy === 'pdf' ? 'Saving…' : 'Save PDF' }}</span>
          </button>
          <button type="button" class="close-btn" aria-label="Close preview" @click="emit('close')">
            <X :size="18" />
          </button>
        </div>
      </header>

      <div class="preview-stage">
        <div class="a4-sheet">
          <iframe class="a4-frame" :srcdoc="previewHtml" title="Document Preview" />
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.preview-shade {
  position: fixed;
  inset: 0;
  background: rgba(24, 21, 18, 0.62);
  backdrop-filter: blur(3px);
  z-index: 60;
  display: grid;
  place-items: center;
  padding: 20px;
}

.preview-dialog {
  width: min(980px, 96vw);
  height: min(92vh, 960px);
  background: #f4f1e6;
  border-radius: 16px;
  border: 1px solid #d9d0b8;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 22px;
  background: #ffffff;
  border-bottom: 1px solid #e5dec9;
}

.eyebrow {
  margin: 0 0 2px;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.12em;
  color: #B19470;
}

.preview-header h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 800;
  color: #26211D;
}

.preview-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.btn-primary,
.btn-secondary {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  border-radius: 9px;
  padding: 8px 14px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  border: 1px solid transparent;
  transition: background 0.15s, transform 0.12s;
}

.btn-primary {
  background: #43766C;
  color: #F8FAE5;
}

.btn-primary:hover:not(:disabled) {
  background: #345d55;
}

.btn-secondary {
  background: #F8FAE5;
  color: #43766C;
  border-color: #d6cfb8;
}

.btn-secondary:hover:not(:disabled) {
  background: #efecc9;
}

.btn-primary:disabled,
.btn-secondary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.close-btn {
  border: 1px solid #e5dec9;
  background: #ffffff;
  color: #73685D;
  width: 34px;
  height: 34px;
  border-radius: 9px;
  display: grid;
  place-items: center;
  cursor: pointer;
}

.close-btn:hover {
  background: #f6ecea;
  color: #76453B;
  border-color: #e4c4be;
}

.preview-stage {
  flex: 1;
  overflow: auto;
  padding: 22px;
  display: flex;
  justify-content: center;
  align-items: flex-start;
}

.a4-sheet {
  width: 210mm;
  min-width: 210mm;
  min-height: 297mm;
  background: #ffffff;
  box-shadow: 0 12px 32px rgba(38, 33, 29, 0.16);
  border-radius: 4px;
  overflow: hidden;
}

.a4-frame {
  width: 210mm;
  height: 298mm;
  border: 0;
  display: block;
}
</style>
