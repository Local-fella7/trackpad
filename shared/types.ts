export const CURRENCY_CODES = ['TZS'] as const
export type CurrencyCode = (typeof CURRENCY_CODES)[number]

export interface ItemInput {
  description: string
  /** Whole items entered by the user. */
  quantity: number
  /** Whole Tanzanian shillings entered by the user. */
  unitPrice: number
}

export interface Totals {
  subtotal: number
  tax: number
  grandTotal: number
}
