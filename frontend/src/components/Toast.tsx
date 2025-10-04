import { useEffect } from 'react'

export type ToastType = 'success' | 'error' | 'warning'

export interface ToastProps {
  id: string
  message: string
  type: ToastType
  onClose: (id: string) => void
  duration?: number
}

export type ToastItem = Omit<ToastProps, 'onClose'>

export const Toast = ({ id, message, type, onClose, duration = 5000 }: ToastProps) => {
  useEffect(() => {
    const timer = window.setTimeout(() => {
      onClose(id)
    }, duration)
    return () => {
      window.clearTimeout(timer)
    }
  }, [duration, id, onClose])

  return (
    <div className={`toast toast--${type}`} role="alert" aria-live="assertive">
      <span className="toast__message">{message}</span>
      <button
        type="button"
        className="toast__close"
        onClick={() => {
          onClose(id)
        }}
        aria-label="閉じる"
      >
        ×
      </button>
    </div>
  )
}

Toast.displayName = 'Toast'
