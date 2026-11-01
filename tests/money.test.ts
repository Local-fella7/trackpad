import { describe, expect, it } from 'vitest'
import { calculateTotals, formatMoney, lineTotal } from '../shared/money'

describe('money calculations', () => {
  it('calculates fractional quantities without floating point loss', () => {
    expect(lineTotal({ quantityX100: 250, unitPriceMinor: 1200 })).toBe(3000)
  })
  it('calculates subtotal, tax, and grand total', () => {
    expect(calculateTotals([{ description: 'Service', quantityX100: 100, unitPriceMinor: 5000 }], 1800)).toEqual({ subtotal: 5000, tax: 900, grandTotal: 5900 })
  })
  it('formats Tanzanian shillings without decimals', () => {
    expect(formatMoney(1250000, 'TZS')).toContain('1,250,000 TZS')
  })
})
