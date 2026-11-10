import type { ItemInput } from './types'

/** Return ordinary structured-cloneable values for the Electron IPC boundary. */
export function cloneRecordItems(items: readonly ItemInput[]): ItemInput[] {
  return items.map(item => ({
    description: String(item.description).trim(),
    quantity: Number(item.quantity),
    unitPrice: Number(item.unitPrice),
  }))
}

/** Return ordinary structured-cloneable values for any reactive payload crossing the Electron IPC boundary. */
export function cloneIpcPayload<T>(value: T): T {
  const json = JSON.stringify(value)
  if (json === undefined) throw new TypeError('Payload could not be serialized.')
  return JSON.parse(json) as T
}
