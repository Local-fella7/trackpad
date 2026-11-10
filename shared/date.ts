const pad = (n: number) => String(n).padStart(2, '0')

/** Format any YYYY-MM-DD, ISO date string, or Date object as dd-mm-yyyy. */
export function formatDate(value?: unknown, fallback = '—'): string {
  if (value === null || value === undefined || value === '') return fallback
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return fallback
    return `${pad(value.getDate())}-${pad(value.getMonth() + 1)}-${value.getFullYear()}`
  }
  const text = String(value).trim()
  if (!text) return fallback

  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (isoMatch) {
    return `${isoMatch[3]}-${isoMatch[2]}-${isoMatch[1]}`
  }

  const alreadyFormatted = text.match(/^(\d{2})-(\d{2})-(\d{4})$/)
  if (alreadyFormatted) return text

  const parsed = new Date(text)
  if (!Number.isNaN(parsed.getTime())) {
    return `${pad(parsed.getDate())}-${pad(parsed.getMonth() + 1)}-${parsed.getFullYear()}`
  }
  return text
}

/** Format a Date or ISO timestamp as dd-mm-yyyy HH:mm. */
export function formatDateTime(value?: unknown, fallback = '—'): string {
  if (value === null || value === undefined || value === '') return fallback
  const d = value instanceof Date ? value : new Date(String(value))
  if (Number.isNaN(d.getTime())) return formatDate(value, fallback)
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Format a report period string (YYYY-MM-DD -> dd-mm-yyyy, YYYY-MM -> mm-yyyy). */
export function formatReportPeriod(period?: unknown): string {
  const text = String(period ?? '').trim()
  if (!text) return '—'
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return formatDate(text)
  }
  const monthMatch = text.match(/^(\d{4})-(\d{2})$/)
  if (monthMatch) {
    return `${monthMatch[2]}-${monthMatch[1]}`
  }
  return text
}
