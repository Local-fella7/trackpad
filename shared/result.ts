export type Result<T> = { ok: true; data: T } | { ok: false; error: AppError }
export interface AppError { code: string; message: string }
export function success<T>(data: T): Result<T> { return { ok: true, data } }
export function failure(code: string, message: string): Result<never> { return { ok: false, error: { code, message } } }
