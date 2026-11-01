export const CURRENCY_CODES = ['TZS', 'USD', 'EUR', 'KES'] as const
export type CurrencyCode = (typeof CURRENCY_CODES)[number]

export interface ItemInput {
  description: string
  quantityX100: number
  unitPriceMinor: number
}

export interface Totals {
  subtotal: number
  tax: number
  grandTotal: number
}
