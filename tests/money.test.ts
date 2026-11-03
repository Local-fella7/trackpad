import { describe, expect, it } from 'vitest'
import { calculateTotals, formatMoney, lineTotal } from '../shared/money'
import { cloneRecordItems } from '../shared/record-payload'

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
})
