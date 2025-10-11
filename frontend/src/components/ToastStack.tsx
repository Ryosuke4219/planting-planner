import { type ReactNode, useEffect, useRef } from 'react'

export type ToastStackToast = {
  id: string
  message: ReactNode
}

export type ToastStackProps = {
  toasts: readonly ToastStackToast[]
  onDismiss: (id: string) => void
  autoCloseMs?: number
}

export function ToastStack({ toasts, onDismiss, autoCloseMs }: ToastStackProps) {
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const previousConfigRef = useRef<{ autoCloseMs?: number; onDismiss: ToastStackProps['onDismiss'] }>({
    autoCloseMs,
    onDismiss,
  })

  const clearAllTimers = () => {
    const timers = timersRef.current
    timers.forEach((timerId) => clearTimeout(timerId))
    timers.clear()
  }

  useEffect(() => () => {
    clearAllTimers()
  }, [])

  useEffect(() => {
    const timers = timersRef.current
    const autoCloseDisabled = autoCloseMs === undefined || autoCloseMs <= 0

    if (autoCloseDisabled) {
      clearAllTimers()
      previousConfigRef.current = { autoCloseMs, onDismiss }
      return
    }

    const configChanged =
      previousConfigRef.current.autoCloseMs !== autoCloseMs || previousConfigRef.current.onDismiss !== onDismiss

    if (configChanged) {
      clearAllTimers()
    }

    const activeIds = new Set(toasts.map((toast) => toast.id))
    for (const [id, timerId] of timers.entries()) {
      if (!activeIds.has(id)) {
        clearTimeout(timerId)
        timers.delete(id)
      }
    }

    for (const toast of toasts) {
      if (timers.has(toast.id)) continue

      const timerId = setTimeout(() => {
        timers.delete(toast.id)
        onDismiss(toast.id)
      }, autoCloseMs)
      timers.set(toast.id, timerId)
    }

    previousConfigRef.current = { autoCloseMs, onDismiss }
  }, [toasts, autoCloseMs, onDismiss])

  const handleManualDismiss = (id: string) => {
    const timers = timersRef.current
    const timerId = timers.get(id)
    if (timerId !== undefined) {
      clearTimeout(timerId)
      timers.delete(id)
    }
    onDismiss(id)
  }

  return (
    <div className="toast-stack" role="log" aria-live="assertive" aria-relevant="additions text">
      {toasts.map((toast) => (
        <div key={toast.id} role="alert" aria-live="assertive" aria-atomic="true" className="toast">
          <div className="toast__message">{toast.message}</div>
          <button type="button" onClick={() => handleManualDismiss(toast.id)} aria-label="閉じる">
            閉じる
          </button>
        </div>
      ))}
    </div>
  )
}
