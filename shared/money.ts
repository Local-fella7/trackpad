import type { CurrencyCode, ItemInput, Totals } from './types'

export const CURRENCY_DECIMALS: Record<CurrencyCode, number> = {
  TZS: 0,
  USD: 2,
  EUR: 2,
  KES: 2,
}

export function lineTotal(item: Pick<ItemInput, 'quantity' | 'unitPrice'>): number {
  return Math.round(item.quantity * item.unitPrice)
}

export function calculateTotals(items: readonly ItemInput[], taxRateBasisPoints: number): Totals {
  const subtotal = items.reduce((total, item) => total + lineTotal(item), 0)
  const tax = Math.round((subtotal * taxRateBasisPoints) / 10_000)
  return { subtotal, tax, grandTotal: subtotal + tax }
}

export function formatMoney(amountMinor: number, currency: CurrencyCode = 'TZS', locale = 'en-TZ'): string {
  const decimals = CURRENCY_DECIMALS[currency]
  return new Intl.NumberFormat(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(amountMinor / 10 ** decimals) + ` ${currency}`
}
