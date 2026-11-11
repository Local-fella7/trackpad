import type { CurrencyCode, ItemInput, Totals } from './types'

export const CURRENCY_DECIMALS: Record<CurrencyCode, number> = {
  TZS: 0,
}

export function lineTotal(item: Pick<ItemInput, 'quantity' | 'unitPrice'>): number {
  return Math.round(item.quantity * item.unitPrice)
}

export function calculateTotals(items: readonly ItemInput[], discountMinor = 0): Totals {
  const subtotal = items.reduce((total, item) => total + lineTotal(item), 0)
  const discount = Math.max(0, Math.min(subtotal, Math.round(Number(discountMinor) || 0)))
  return { subtotal, discount, tax: 0, grandTotal: Math.max(0, subtotal - discount) }
}

export function formatMoney(amountMinor: number, currency: CurrencyCode = 'TZS', locale = 'en-TZ'): string {
  const decimals = CURRENCY_DECIMALS[currency] ?? 0
  return (
    new Intl.NumberFormat(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(
      amountMinor / 10 ** decimals,
    ) + ` ${currency}`
  )
}
