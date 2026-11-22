import type { DocumentRecord } from './document-types'

export interface DocumentBrandingAssets {
  headerSrc: string
  footerSrc: string
}

const escapeHtml = (value: unknown) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!,
  )

const formatMoneyTsh = (value: number | null | undefined): string => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return ''
  const rounded = Math.round(Number(value))
  return `${new Intl.NumberFormat('en-TZ', { maximumFractionDigits: 0 }).format(rounded)}/=`
}

const formatQty = (value: number | null | undefined): string => {
  if (value === null || value === undefined || Number.isNaN(Number(value)) || Number(value) <= 0) return ''
  const num = Number(value)
  return Number.isInteger(num) ? String(num) : num.toFixed(2).replace(/\.?0+$/, '')
}

function formatDocDate(value?: string | null, style: 'slash' | 'long' = 'slash'): string {
  if (!value) return ''
  const raw = String(value).trim()
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match) return raw
  const [, yyyy, mm, dd] = match
  if (style === 'slash') return `${dd}/${mm}/${yyyy}`
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const monthLabel = months[Math.max(0, Math.min(11, Number(mm) - 1))] || mm
  return `${dd} ${monthLabel} ${yyyy}`
}

function buildHeaderHtml(assets: DocumentBrandingAssets, showTin: boolean): string {
  const banner = assets.headerSrc
    ? `<img class="brand-banner" src="${assets.headerSrc}" alt="M&S Decorations" />`
    : `<div class="brand-fallback"><span>M&amp;S DECORATIONS</span><small>WE BUILD YOUR DREAM AROUND YOU</small></div>`

  return `
    <header class="ms-header">
      <div class="banner-wrap">
        ${banner}
        <div class="banner-overlay">
          <div class="company-name">M&amp;S DECORATIONS</div>
          <div class="company-tagline">
            Dealers in: Decor for all occasions &amp; corporate events,<br/>
            flowers for all occasions, decorative lighting and many more
          </div>
        </div>
      </div>
      ${showTin ? `<div class="tin-row">TIN: 117-922-650</div>` : ''}
    </header>
  `
}

function buildFooterHtml(assets: DocumentBrandingAssets): string {
  if (assets.footerSrc) {
    return `
      <footer class="ms-footer">
        <img class="footer-banner" src="${assets.footerSrc}" alt="+255 768 230 917 | mandsdecor@hotmail.com | Arusha, Tanzania" />
      </footer>
    `
  }
  return `
    <footer class="ms-footer-fallback">
      +255 768 230 917 | mandsdecor@hotmail.com | Arusha, Tanzania
    </footer>
  `
}

function buildItemsTable(
  doc: DocumentRecord,
  options: { showPrices: boolean; includeTotalRow: boolean; minRows?: number },
): string {
  const items = doc.items || []
  const minRows = options.minRows ?? 6
  const renderedRows = items.map((item, idx) => {
    const qtyCell = item.isLumpSum && !item.quantity ? '' : formatQty(item.quantity)
    const unitCell =
      !options.showPrices || item.isLumpSum || item.unitPrice === null || item.unitPrice === undefined
        ? ''
        : formatMoneyTsh(item.unitPrice)
    const tshsCell = options.showPrices ? formatMoneyTsh(item.lineTotal) : ''
    const ctsCell = options.showPrices ? '00' : ''

    return `
      <tr>
        <td class="col-sn">${idx + 1}</td>
        <td class="col-part">${escapeHtml(item.description)}</td>
        <td class="col-qty">${escapeHtml(qtyCell)}</td>
        <td class="col-unit">${escapeHtml(unitCell)}</td>
        <td class="col-tshs">${escapeHtml(tshsCell)}</td>
        <td class="col-cts">${escapeHtml(ctsCell)}</td>
      </tr>
    `
  })

  const fillerCount = Math.max(0, minRows - items.length)
  for (let i = 0; i < fillerCount; i++) {
    renderedRows.push(`
      <tr class="empty-row">
        <td class="col-sn">&nbsp;</td>
        <td class="col-part"></td>
        <td class="col-qty"></td>
        <td class="col-unit"></td>
        <td class="col-tshs"></td>
        <td class="col-cts"></td>
      </tr>
    `)
  }

  let summaryRows = ''
  if (options.includeTotalRow) {
    if (options.showPrices && Number(doc.discount_minor || 0) > 0) {
      summaryRows += `
        <tr class="summary-row">
          <td colspan="4" class="total-label">SUBTOTAL</td>
          <td class="col-tshs">${escapeHtml(formatMoneyTsh(doc.subtotal_minor))}</td>
          <td class="col-cts">00</td>
        </tr>
        <tr class="summary-row">
          <td colspan="4" class="total-label">DISCOUNT</td>
          <td class="col-tshs">- ${escapeHtml(formatMoneyTsh(doc.discount_minor))}</td>
          <td class="col-cts">00</td>
        </tr>
      `
    }
    summaryRows += `
      <tr class="total-row">
        <td colspan="4" class="total-label">TOTAL</td>
        <td class="col-tshs">${options.showPrices ? escapeHtml(formatMoneyTsh(doc.grand_total_minor)) : ''}</td>
        <td class="col-cts">${options.showPrices ? '00' : ''}</td>
      </tr>
    `
  }

  return `
    <table class="items-table">
      <thead>
        <tr>
          <th class="col-sn">S/N</th>
          <th class="col-part">Particulars</th>
          <th class="col-qty">Qty</th>
          <th class="col-unit">@</th>
          <th class="col-tshs">TSHS</th>
          <th class="col-cts">CTS</th>
        </tr>
      </thead>
      <tbody>
        ${renderedRows.join('')}
        ${summaryRows}
      </tbody>
    </table>
  `
}

function buildProformaOrInvoiceBody(doc: DocumentRecord): string {
  const isInvoice = doc.doc_type === 'invoice'
  const titleText = isInvoice ? `INVOICE NO: ${doc.doc_number}` : `PROFORMA INVOICE NO: ${doc.doc_number}`
  const refBadge =
    isInvoice && doc.parent_doc_number
      ? `<div class="ref-note">Amended from ${doc.parent_doc_type === 'invoice' ? 'Invoice' : 'Proforma Invoice'} No: ${escapeHtml(doc.parent_doc_number)}</div>`
      : ''

  return `
    <div class="doc-title-bar">
      <div class="doc-title">${escapeHtml(titleText)}</div>
      <div class="doc-date"><strong>DATE:</strong> ${escapeHtml(formatDocDate(doc.issue_date, 'slash'))}</div>
    </div>
    ${refBadge}

    <div class="meta-block">
      <div class="meta-line"><strong>M/S:</strong> ${escapeHtml(doc.client_name)}${doc.client_phone ? ` (${escapeHtml(doc.client_phone)})` : ''}</div>
      <div class="meta-line"><strong>Location:</strong> ${escapeHtml(doc.location || '—')}</div>
      <div class="meta-line"><strong>Event Date:</strong> ${escapeHtml(formatDocDate(doc.event_date, 'long') || '—')}</div>
    </div>

    ${buildItemsTable(doc, { showPrices: Boolean(doc.show_prices), includeTotalRow: true, minRows: 7 })}

    ${doc.notes ? `<div class="doc-notes"><strong>Remarks:</strong> ${escapeHtml(doc.notes)}</div>` : ''}

    <div class="payment-terms">
      <p>50% of the total amount should be paid for you to secure the booking and as an advance.</p>
      <p>And the remaining 50% should be paid one week before delivery day.</p>
    </div>

    <table class="payment-grid">
      <tbody>
        <tr>
          <td>
            <div class="pay-handle">MandSdecor</div>
            <div class="pay-sub">Pay to:</div>
            <div class="pay-acc">Acc No: 015C555005800</div>
            <div class="pay-name">M&amp;S DECORATION</div>
            <div class="pay-bank">CRDB BANK</div>
          </td>
          <td>
            <div class="pay-handle">MandSdecor</div>
            <div class="pay-sub">Pay to:</div>
            <div class="pay-acc">VODACOM LIPA NUMBER</div>
            <div class="pay-name">NO: 68144856</div>
            <div class="pay-bank">M&amp;S DECORATION</div>
          </td>
          <td>
            <div class="pay-handle">MandSdecor</div>
            <div class="pay-sub">Pay to:</div>
            <div class="pay-acc">Acc No: 40810217275</div>
            <div class="pay-name">M&amp;S DECORATION</div>
            <div class="pay-bank">NMB BANK</div>
          </td>
        </tr>
      </tbody>
    </table>
  `
}

function buildOrderFormBody(doc: DocumentRecord): string {
  return `
    <div class="order-title-block">
      <div class="order-title">CUSTOMER ORDER FORM</div>
      <div class="order-no">NO: ${escapeHtml(doc.doc_number)}</div>
    </div>

    <table class="order-meta-grid">
      <tbody>
        <tr>
          <td><strong>CUSTOMER NAME:</strong> ${escapeHtml(doc.client_name)}</td>
          <td><strong>CUSTOMER PHONE NUMBER:</strong> ${escapeHtml(doc.client_phone || '')}</td>
        </tr>
        <tr>
          <td><strong>ALTERNATE PHONE NO:</strong> ${escapeHtml(doc.alt_phone || '')}</td>
          <td><strong>DATE &amp; TIME OF THE EVENT:</strong> ${escapeHtml(formatDocDate(doc.event_date, 'slash'))}</td>
        </tr>
        <tr>
          <td><strong>PREFERRED SET-UP DATE:</strong> ${escapeHtml(formatDocDate(doc.setup_date, 'slash'))}</td>
          <td><strong>PREFERRED TAKE DOWN DATE:</strong> ${escapeHtml(formatDocDate(doc.takedown_date, 'slash'))}</td>
        </tr>
        <tr>
          <td><strong>EVENT ADDRESS:</strong> ${escapeHtml(doc.location || '')}</td>
          <td><strong>COLORS OF THE EVENT:</strong> ${escapeHtml(doc.event_colors || '')}</td>
        </tr>
      </tbody>
    </table>

    ${buildItemsTable(doc, { showPrices: Boolean(doc.show_prices), includeTotalRow: true, minRows: 7 })}

    ${doc.notes ? `<div class="doc-notes"><strong>Remarks:</strong> ${escapeHtml(doc.notes)}</div>` : ''}

    <div class="deposit-clause">
      A 20% non-refundable deposit is due for any order processed, in order to confirm date availability.
    </div>

    <table class="signoff-grid">
      <thead>
        <tr>
          <th>OFFICIAL USE</th>
          <th>CUSTOMER</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>
            <div class="sig-line">Name: <span class="dots"></span></div>
            <div class="sig-line">Sign: <span class="dots"></span></div>
          </td>
          <td>
            <div class="sig-line">Name: <span class="dots"></span></div>
            <div class="sig-line">Sign: <span class="dots"></span></div>
          </td>
        </tr>
      </tbody>
    </table>
  `
}

function buildDeliveryNoteBody(doc: DocumentRecord): string {
  return `
    <div class="delivery-title-bar">
      <div class="delivery-no">NO: ${escapeHtml(doc.doc_number)}</div>
      <div class="delivery-title">DELIVERY NOTE</div>
      <div class="delivery-date">DATE: ${escapeHtml(formatDocDate(doc.issue_date, 'slash'))}</div>
    </div>

    <div class="meta-block">
      <div class="meta-line"><strong>M/S:</strong> ${escapeHtml(doc.client_name)}${doc.client_phone ? ` (${escapeHtml(doc.client_phone)})` : ''}</div>
      <div class="meta-line"><strong>Location:</strong> ${escapeHtml(doc.location || '—')}</div>
      <div class="meta-line"><strong>Event date:</strong> ${escapeHtml(formatDocDate(doc.event_date, 'long') || '—')}</div>
    </div>

    <div class="delivery-intro">Please receive the following goods</div>

    ${buildItemsTable(doc, { showPrices: Boolean(doc.show_prices), includeTotalRow: Boolean(doc.show_prices), minRows: 7 })}

    ${doc.notes ? `<div class="doc-notes"><strong>Remarks:</strong> ${escapeHtml(doc.notes)}</div>` : ''}

    <div class="delivery-signoff">
      <div class="delivery-condition">Received the above goods in good order and condition</div>

      <div class="sig-group">
        <div class="sig-heading">Delivered by / Imetolewa na:</div>
        <div class="sig-triple">
          <span>Name/Jina: <em class="line-fill"></em></span>
          <span>Signature/Sahihi: <em class="line-fill"></em></span>
          <span>Phone/simu: <em class="line-fill"></em></span>
        </div>
      </div>

      <div class="sig-group">
        <div class="sig-heading">Received by / Imepokelewa:</div>
        <div class="sig-triple">
          <span>Name/Jina: <em class="line-fill"></em></span>
          <span>Signature/Sahihi: <em class="line-fill"></em></span>
          <span>Phone/simu: <em class="line-fill"></em></span>
        </div>
      </div>
    </div>
  `
}

export function buildDocumentHtml(doc: DocumentRecord, assets: DocumentBrandingAssets): string {
  const showTin = doc.doc_type !== 'order_form'
  const bodyHtml =
    doc.doc_type === 'order_form'
      ? buildOrderFormBody(doc)
      : doc.doc_type === 'delivery_note'
        ? buildDeliveryNoteBody(doc)
        : buildProformaOrInvoiceBody(doc)

  const docTitle =
    doc.doc_type === 'proforma'
      ? `Proforma Invoice ${doc.doc_number}`
      : doc.doc_type === 'invoice'
        ? `Invoice ${doc.doc_number}`
        : doc.doc_type === 'order_form'
          ? `Order Form ${doc.doc_number}`
          : `Delivery Note ${doc.doc_number}`

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(docTitle)} - M&amp;S Decorations</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 0;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    html, body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #111111;
      font-family: "Segoe UI", Arial, Helvetica, sans-serif;
      font-size: 12px;
      line-height: 1.45;
    }
    .page {
      width: 210mm;
      min-height: 297mm;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      background: #ffffff;
      position: relative;
    }
    .ms-header {
      width: 100%;
    }
    .banner-wrap {
      position: relative;
      width: 100%;
      overflow: hidden;
    }
    .brand-banner {
      display: block;
      width: 100%;
      height: auto;
      max-height: 44mm;
      object-fit: cover;
    }
    .brand-fallback {
      background: #111111;
      color: #e2c060;
      padding: 18px 24px;
      text-align: left;
      font-weight: 800;
      font-size: 20px;
      letter-spacing: 0.08em;
    }
    .brand-fallback small {
      display: block;
      font-size: 10px;
      font-weight: 600;
      margin-top: 3px;
    }
    .banner-overlay {
      position: absolute;
      top: 50%;
      right: 12mm;
      left: 42%;
      transform: translateY(-50%);
      text-align: center;
      color: #14110b;
      padding: 4px 8px;
    }
    .company-name {
      font-size: 16px;
      font-weight: 900;
      letter-spacing: 0.06em;
      margin-bottom: 3px;
    }
    .company-tagline {
      font-size: 10.5px;
      font-weight: 600;
      line-height: 1.3;
    }
    .tin-row {
      text-align: right;
      padding: 4px 14mm 0;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.04em;
      color: #222222;
    }
    .doc-body {
      flex: 1;
      padding: 8mm 14mm 10mm;
      display: flex;
      flex-direction: column;
    }
    .doc-title-bar {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      border-bottom: 2px solid #b8943d;
      padding-bottom: 6px;
      margin-bottom: 10px;
    }
    .doc-title {
      font-size: 16px;
      font-weight: 800;
      letter-spacing: 0.04em;
      color: #111111;
    }
    .doc-date {
      font-size: 12px;
      color: #111111;
    }
    .ref-note {
      font-size: 11px;
      font-weight: 600;
      color: #6b4e16;
      background: #fdf8eb;
      border: 1px solid #e6d29d;
      border-radius: 4px;
      padding: 4px 10px;
      margin-bottom: 10px;
      display: inline-block;
      align-self: flex-start;
    }
    .meta-block {
      margin-bottom: 12px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .meta-line {
      font-size: 12.5px;
    }
    .meta-line strong {
      display: inline-block;
      min-width: 82px;
    }
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 6px;
      margin-bottom: 14px;
    }
    .items-table th {
      background: #1a1a1a;
      color: #f3d77f;
      border: 1px solid #2b2b2b;
      padding: 7px 8px;
      font-size: 11px;
      font-weight: 700;
      text-align: left;
      letter-spacing: 0.03em;
    }
    .items-table td {
      border: 1px solid #333333;
      padding: 6.5px 8px;
      font-size: 12px;
      vertical-align: top;
    }
    .items-table tr.empty-row td {
      height: 24px;
    }
    .col-sn { width: 42px; text-align: center !important; }
    .col-part { width: auto; }
    .col-qty { width: 58px; text-align: center !important; }
    .col-unit { width: 102px; text-align: right !important; white-space: nowrap; }
    .col-tshs { width: 112px; text-align: right !important; white-space: nowrap; }
    .col-cts { width: 46px; text-align: center !important; }
    .summary-row td {
      font-weight: 700;
      background: #faf8f2;
    }
    .total-row td {
      font-weight: 800;
      font-size: 12.5px;
      background: #f6efd9;
      border-top: 2px solid #1a1a1a;
    }
    .total-label {
      text-align: right;
      letter-spacing: 0.05em;
    }
    .doc-notes {
      margin-bottom: 12px;
      padding: 8px 10px;
      background: #faf9f5;
      border-left: 3px solid #b8943d;
      font-size: 11.5px;
    }
    .payment-terms {
      margin: 6px 0 14px;
      font-size: 11.5px;
      font-weight: 600;
      color: #1f1f1f;
    }
    .payment-terms p {
      margin: 2px 0;
    }
    .payment-grid {
      width: 100%;
      border-collapse: collapse;
      margin-top: auto;
    }
    .payment-grid td {
      width: 33.33%;
      border: 1px solid #2b2b2b;
      padding: 8px 10px;
      vertical-align: top;
      text-align: center;
      background: #fcfaf2;
    }
    .pay-handle {
      font-size: 10px;
      font-weight: 700;
      color: #8a6a1d;
      margin-bottom: 2px;
    }
    .pay-sub {
      font-size: 10px;
      color: #555555;
      margin-bottom: 4px;
    }
    .pay-acc {
      font-size: 11.5px;
      font-weight: 800;
      color: #111111;
      margin-bottom: 2px;
    }
    .pay-name {
      font-size: 11px;
      font-weight: 700;
      color: #222222;
      margin-bottom: 2px;
    }
    .pay-bank {
      font-size: 11px;
      font-weight: 800;
      color: #76453B;
      letter-spacing: 0.03em;
    }
    /* Order Form specific */
    .order-title-block {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      border-bottom: 2px solid #b8943d;
      padding-bottom: 6px;
      margin-bottom: 12px;
    }
    .order-title {
      font-size: 17px;
      font-weight: 900;
      letter-spacing: 0.05em;
    }
    .order-no {
      font-size: 13px;
      font-weight: 800;
    }
    .order-meta-grid {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 12px;
    }
    .order-meta-grid td {
      width: 50%;
      padding: 5px 8px;
      border: 1px solid #d5cba9;
      font-size: 11.5px;
      background: #fdfcf7;
    }
    .deposit-clause {
      font-size: 11.5px;
      font-weight: 700;
      font-style: italic;
      margin: 6px 0 14px;
      color: #222222;
    }
    .signoff-grid {
      width: 100%;
      border-collapse: collapse;
      margin-top: auto;
    }
    .signoff-grid th {
      background: #1a1a1a;
      color: #f3d77f;
      border: 1px solid #2b2b2b;
      padding: 6px 10px;
      font-size: 11px;
      text-align: left;
      width: 50%;
    }
    .signoff-grid td {
      border: 1px solid #2b2b2b;
      padding: 12px 10px;
      vertical-align: top;
    }
    .sig-line {
      display: flex;
      align-items: flex-end;
      gap: 6px;
      margin-bottom: 14px;
      font-size: 11.5px;
      font-weight: 600;
    }
    .sig-line:last-child { margin-bottom: 2px; }
    .dots {
      flex: 1;
      border-bottom: 1px dotted #333333;
      height: 12px;
    }
    /* Delivery Note specific */
    .delivery-title-bar {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      border-bottom: 2px solid #b8943d;
      padding-bottom: 6px;
      margin-bottom: 12px;
    }
    .delivery-no, .delivery-date {
      font-size: 12px;
      font-weight: 800;
    }
    .delivery-title {
      font-size: 17px;
      font-weight: 900;
      letter-spacing: 0.06em;
    }
    .delivery-intro {
      font-size: 12px;
      font-weight: 700;
      margin-bottom: 6px;
    }
    .delivery-signoff {
      margin-top: auto;
      padding-top: 10px;
    }
    .delivery-condition {
      font-size: 12px;
      font-weight: 700;
      font-style: italic;
      margin-bottom: 14px;
    }
    .sig-group {
      margin-bottom: 16px;
    }
    .sig-heading {
      font-size: 12px;
      font-weight: 800;
      margin-bottom: 10px;
    }
    .sig-triple {
      display: grid;
      grid-template-columns: 1.2fr 1fr 0.9fr;
      gap: 12px;
      font-size: 11px;
      font-weight: 600;
    }
    .sig-triple span {
      display: flex;
      align-items: flex-end;
      gap: 4px;
    }
    .line-fill {
      flex: 1;
      border-bottom: 1px dotted #222222;
      height: 12px;
      display: inline-block;
    }
    .ms-footer {
      width: 100%;
      margin-top: auto;
    }
    .footer-banner {
      display: block;
      width: 100%;
      height: auto;
      max-height: 20mm;
      object-fit: cover;
    }
    .ms-footer-fallback {
      background: #111111;
      color: #f3d77f;
      padding: 10px 14mm;
      font-size: 11px;
      font-weight: 700;
      text-align: center;
      margin-top: auto;
    }
  </style>
</head>
<body>
  <div class="page">
    ${buildHeaderHtml(assets, showTin)}
    <main class="doc-body">
      ${bodyHtml}
    </main>
    ${buildFooterHtml(assets)}
  </div>
</body>
</html>`
}
