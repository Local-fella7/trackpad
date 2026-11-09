export interface IpcError { code: string; message: string }
export type IpcResult<T> = { ok: true; data: T } | { ok: false; error: IpcError }

export function asIpcError(error: unknown): IpcError {
  const code = error instanceof Error ? error.message : 'UNEXPECTED_ERROR'
  const messages: Record<string, string> = {
    INVALID_INPUT: 'Please check the information you entered.',
    INVALID_CREDENTIALS: 'The username or password is incorrect.',
    LOGIN_THROTTLED: 'Too many attempts. Please wait 30 seconds and try again.',
    SETUP_ALREADY_COMPLETE: 'A user has already been created.',
    NOT_LOGGED_IN: 'Please log in to continue.',
    PDF_EXPORT_FAILED: 'Could not create the PDF report. Please try again.',
    PDF_RENDER_FAILED: 'The report could not be rendered as a PDF. Please try again.',
    PDF_WRITE_FAILED: 'The PDF file could not be saved.',
    REPORT_STORAGE_FAILED: 'Could not create Documents\\Trackpad\\Reports. Check that the Documents folder is available and writable.',
    REPORT_RENDER_FAILED: 'The report could not be prepared for PDF or printing.',
    PRINT_FAILED: 'The report could not be sent to the printer.',
    REPORT_FILE_NOT_FOUND: 'The saved report could not be found.',
  }
  return { code, message: messages[code] ?? 'Something went wrong. Please try again.' }
}

export async function toIpcResult<T>(operation: () => T | Promise<T>): Promise<IpcResult<T>> {
  try { return { ok: true, data: await operation() } } catch (error) { return { ok: false, error: asIpcError(error) } }
}
