import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { TOAST_AUTO_DISMISS_MS } from '../../components/ToastStack'
import { TOAST_MESSAGES } from '../../constants/messages'
import { fetchRefreshStatus, postRefresh } from '../../lib/api'
import type { RefreshStatusResponse } from '../../types'

import { createRefreshStatusPoller, isTerminalState } from './poller'

export type RefreshToastVariant = 'success' | 'error' | 'warning' | 'info'

export interface RefreshToast {
  readonly id: string
  readonly variant: RefreshToastVariant
  readonly message: string
  readonly detail?: string | null
}

const STALE_TOAST_MESSAGE = 'データ更新の結果を取得できませんでした'
const FETCH_STATUS_ERROR_MESSAGE = '更新状況の取得に失敗しました'

export interface UseRefreshStatusOptions {
  readonly pollIntervalMs?: number
  readonly timeoutMs?: number
  readonly onSuccess?: () => void
}

export interface UseRefreshStatusResult {
  readonly isRefreshing: boolean
  readonly pendingToasts: ReadonlyArray<RefreshToast>
  readonly startRefresh: () => Promise<void>
  readonly dismissToast: (id: string) => void
}

type ToastPayload = Omit<RefreshToast, 'id'>

type ToastStatus =
  | RefreshStatusResponse
  | (Pick<RefreshStatusResponse, 'state'> &
      Partial<Pick<RefreshStatusResponse, 'updated_records' | 'last_error'>>)

const toastFromStatus = (status: ToastStatus): ToastPayload => {
  if (status.state === 'success') {
    return {
      variant: 'success',
      message: 'データ更新が完了しました',
      detail: `${status.updated_records ?? 0}件のデータを更新しました。`,
    }
  }
  if (status.state === 'failure') {
    return {
      variant: 'error',
      message: 'データ更新に失敗しました',
      detail: status.last_error ?? null,
    }
  }
  return {
    variant: 'warning',
    message: STALE_TOAST_MESSAGE,
    detail: '更新状況を確認できませんでした。時間をおいて再試行してください。',
  }
}

const createFetchErrorToast = (error: unknown): ToastPayload => ({
  variant: 'error',
  message: FETCH_STATUS_ERROR_MESSAGE,
  detail: error instanceof Error ? error.message : String(error),
})

export const useRefreshStatusController = (
  options?: UseRefreshStatusOptions,
): UseRefreshStatusResult => {
  const settings = useMemo(
    () => ({ pollIntervalMs: options?.pollIntervalMs ?? 5000, timeoutMs: options?.timeoutMs ?? 120000 }),
    [options?.pollIntervalMs, options?.timeoutMs],
  )
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [pendingToasts, setPendingToasts] = useState<RefreshToast[]>([])
  const active = useRef(false)
  const timeoutTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const completion = useRef<(() => void) | null>(null)
  const toastSeq = useRef(0)
  const toastTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const pollerRef = useRef<ReturnType<typeof createRefreshStatusPoller> | null>(null)

  const cancelToastTimer = useCallback((id: string) => {
    const timer = toastTimers.current.get(id)
    if (!timer) return
    clearTimeout(timer)
    toastTimers.current.delete(id)
  }, [])

  const enqueue = useCallback((toast: ToastPayload) => {
    const id = String(++toastSeq.current)
    setPendingToasts((prev) => [...prev, { ...toast, id }])
    const timer = setTimeout(() => {
      setPendingToasts((prev) => prev.filter((entry) => entry.id !== id))
      toastTimers.current.delete(id)
    }, TOAST_AUTO_DISMISS_MS)
    toastTimers.current.set(id, timer)
  }, [])

  const dismissToast = useCallback((id: string) => {
    cancelToastTimer(id)
    setPendingToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [cancelToastTimer])

  useEffect(
    () => () => {
      toastTimers.current.forEach((timer) => {
        clearTimeout(timer)
      })
      toastTimers.current.clear()
    },
    [],
  )

  const clearTimers = useCallback(() => {
    pollerRef.current?.stop()
    pollerRef.current = null
    if (timeoutTimer.current) {
      clearTimeout(timeoutTimer.current)
      timeoutTimer.current = null
    }
  }, [])

  const finish = useCallback(
    (toast?: ToastPayload) => {
      if (!active.current) return
      active.current = false
      clearTimers()
      setIsRefreshing(false)
      completion.current?.()
      completion.current = null
      if (toast) {
        if (toast.variant === 'success') {
          options?.onSuccess?.()
        }
        enqueue(toast)
      }
    },
    [clearTimers, enqueue, options?.onSuccess],
  )

  useEffect(
    () => () => {
      toastTimers.current.forEach((timer) => {
        clearTimeout(timer)
      })
      toastTimers.current.clear()
      finish()
    },
    [finish],
  )

  const startRefresh = useCallback(async () => {
    if (active.current) return
    active.current = true
    setIsRefreshing(true)
    const completionPromise = new Promise<void>((resolve) => {
      completion.current = resolve
    })

    pollerRef.current = createRefreshStatusPoller({
      pollIntervalMs: settings.pollIntervalMs,
      fetchStatus: fetchRefreshStatus,
      isActive: () => active.current,
      onTerminal: (status) => {
        finish(toastFromStatus(status))
      },
      onError: (error) => {
        finish(createFetchErrorToast(error))
      },
    })

    timeoutTimer.current = setTimeout(() => {
      finish({ variant: 'warning', message: '更新状況の取得がタイムアウトしました', detail: null })
    }, settings.timeoutMs)

    try {
      const response = await postRefresh()
      if (!active.current) return
      if (isTerminalState(response.state)) {
        finish(toastFromStatus(response))
      } else {
        enqueue({ variant: 'info', message: TOAST_MESSAGES.refreshRequestStarted, detail: null })
        void pollerRef.current?.run()
      }
    } catch (error) {
      finish({
        variant: 'error',
        message: '更新リクエストに失敗しました',
        detail: error instanceof Error ? error.message : String(error),
      })
    }

    await completionPromise
  }, [finish, settings.pollIntervalMs, settings.timeoutMs])

  return { isRefreshing, pendingToasts, startRefresh, dismissToast }
}

export const useRefreshStatus = useRefreshStatusController

export type { RefreshStatusResponse }
