type ToastErrorFn = (title: string, message?: string) => void

interface SupabaseLikeError {
  message?: string
}

export function handleSupabaseError(
  error: SupabaseLikeError | null | undefined,
  toastError: ToastErrorFn,
  title = 'Database error'
) {
  if (!error) return false
  toastError(title, error.message ?? 'The database write failed.')
  return true
}
