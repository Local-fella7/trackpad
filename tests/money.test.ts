import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { calculateTotals, formatMoney, lineTotal } from '../shared/money'
import { cloneIpcPayload, cloneRecordItems } from '../shared/record-payload'

describe('money calculations', () => {
  it('calculates ordinary whole-number TZS quantities and prices', () => {
    expect(lineTotal({ quantity: 100, unitPrice: 4000 })).toBe(400000)
  })
  it('calculates subtotal, tax, and grand total', () => {
    expect(calculateTotals([{ description: 'Service', quantity: 1, unitPrice: 5000 }], 1800)).toEqual({ subtotal: 5000, tax: 900, grandTotal: 5900 })
  })
  it('formats Tanzanian shillings without decimals', () => {
    expect(formatMoney(1250000, 'TZS')).toContain('1,250,000 TZS')
  })
  it('creates cloneable record items without changing their TZS values', () => {
    const items = cloneRecordItems([{ description: '  Catering ', quantity: 100, unitPrice: 4000 }])
    expect(structuredClone(items)).toEqual([{ description: 'Catering', quantity: 100, unitPrice: 4000 }])
    expect(calculateTotals(items, 0).grandTotal).toBe(400000)
  })
  it('unwraps reactive report proxies into structured-cloneable objects for Electron IPC', () => {
    const reactiveReport = ref({
      type: 'monthly',
      title: 'Trackpad Monthly Report',
      period: '2026-11',
      rows: [{ id: 1, client_name: 'Acme', grand_total_minor: 50000 }],
      summary: [{ currency: 'TZS', records: 1, total_minor: 50000 }],
    })
    expect(() => structuredClone(reactiveReport.value)).toThrow()
    const cloned = cloneIpcPayload(reactiveReport.value)
    expect(structuredClone(cloned)).toEqual({
      type: 'monthly',
      title: 'Trackpad Monthly Report',
      period: '2026-11',
      rows: [{ id: 1, client_name: 'Acme', grand_total_minor: 50000 }],
      summary: [{ currency: 'TZS', records: 1, total_minor: 50000 }],
    })
  })
})
