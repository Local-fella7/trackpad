import type { ItemInput } from './types'

/** Return ordinary structured-cloneable values for the Electron IPC boundary. */
export function cloneRecordItems(items: readonly ItemInput[]): ItemInput[] {
  return items.map(item => ({
    description: String(item.description).trim(),
    quantity: Number(item.quantity),
    unitPrice: Number(item.unitPrice),
  }))
}
