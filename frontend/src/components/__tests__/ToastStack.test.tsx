import '@testing-library/jest-dom/vitest'
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ToastStack, type ToastStackToast } from '../ToastStack'

describe('ToastStack', () => {
  afterEach(() => {
    cleanup()
  })

  const baseToasts: ToastStackToast[] = [
    { id: 't1', message: '保存しました' },
    { id: 't2', message: '同期が完了しました' },
  ]

  it('トーストは role="alert" で描画される', () => {
    const { getAllByRole } = render(
      <ToastStack toasts={baseToasts} onDismiss={vi.fn()} autoCloseMs={0} />,
    )

    const alerts = getAllByRole('alert')
    expect(alerts).toHaveLength(baseToasts.length)
    expect(alerts[0]).toHaveTextContent('保存しました')
  })

  it('各トーストには閉じるボタンがある', () => {
    const onDismiss = vi.fn()
    const { getAllByRole } = render(
      <ToastStack toasts={baseToasts} onDismiss={onDismiss} autoCloseMs={0} />,
    )

    const closeButtons = getAllByRole('button', { name: '閉じる' })
    expect(closeButtons).toHaveLength(baseToasts.length)

    closeButtons[0].click()
    expect(onDismiss).toHaveBeenCalledWith('t1')
  })

  it('自動クローズで onDismiss が呼ばれる', async () => {
    const onDismiss = vi.fn()
    vi.useFakeTimers()

    try {
      render(<ToastStack toasts={baseToasts} onDismiss={onDismiss} autoCloseMs={5000} />)

      vi.advanceTimersByTime(5000)
      expect(onDismiss).toHaveBeenCalledWith('t1')
    } finally {
      vi.useRealTimers()
    }
  })
})
