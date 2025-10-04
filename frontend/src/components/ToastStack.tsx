import type { ToastItem } from './Toast'
import { Toast } from './Toast'

interface ToastStackProps {
  toasts: ToastItem[]
  onDismiss: (id: string) => void
}

export const ToastStack = ({ toasts, onDismiss }: ToastStackProps) => {
  if (toasts.length === 0) {
    return null
  }

  return (
    <div className="toast-stack">
      {toasts.map((toast) => (
        <Toast key={toast.id} {...toast} onClose={onDismiss} />
      ))}
    </div>
  )
}

ToastStack.displayName = 'ToastStack'
