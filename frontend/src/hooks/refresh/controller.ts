import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { fetchRefreshStatus, postRefresh } from '../../lib/api'
import { TOAST_MESSAGES } from '../../constants/messages'
import type { RefreshState, RefreshStatusResponse } from '../../types'

import { createRefreshStatusPoller, isTerminalState } from './poller'

export type RefreshToastVariant = 'success' | 'error' | 'warning'

export interface RefreshToast {
  readonly id: string
  readonly variant: RefreshToastVariant
  readonly message: string
  readonly detail?: string | null
}

const TOAST_AUTO_DISMISS_MS = 5000
const REFRESH_TIMEOUT_DETAIL = 'タイムアウトしました。'

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

const buildStatus = (
  state: RefreshState,
  overrides: Partial<RefreshStatusResponse> = {},
): RefreshStatusResponse => ({
  state,
  started_at: overrides.started_at ?? null,
  finished_at: overrides.finished_at ?? null,
  updated_records: overrides.updated_records ?? 0,
  last_error: overrides.last_error ?? null,
})

const toastFromStatus = (status: RefreshStatusResponse): ToastPayload => {
  if (status.state === 'success') {
    return {
      variant: 'success',
      message: TOAST_MESSAGES.refreshSuccess(status.updated_records),
      detail: `更新件数: ${status.updated_records}`,
    }
  }
  if (status.state === 'failure') {
    const detail = status.last_error ?? TOAST_MESSAGES.refreshStatusUnknownDetail
    return {
      variant: 'error',
      message: TOAST_MESSAGES.refreshFailure(detail),
      detail,
    }
  }
  return {
    variant: 'warning',
    message: TOAST_MESSAGES.refreshUnknown,
    detail: TOAST_MESSAGES.refreshStatusUnknownDetail,
  }
}

const createFetchErrorToast = (error: unknown): ToastPayload => {
  const detail = error instanceof Error ? error.message : String(error)
  return {
    variant: 'error',
    message: TOAST_MESSAGES.refreshStatusFetchFailure(detail),
    detail,
  }
}

export const useRefreshStatusController = (
  options?: UseRefreshStatusOptions,
): UseRefreshStatusResult => {
  const settings = useMemo(
    () => ({ pollIntervalMs: options?.pollIntervalMs ?? 2000, timeoutMs: options?.timeoutMs ?? 120000 }),
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
      finish({
        variant: 'warning',
        message: TOAST_MESSAGES.refreshStatusFetchFailure(REFRESH_TIMEOUT_DETAIL),
        detail: REFRESH_TIMEOUT_DETAIL,
      })
    }, settings.timeoutMs)

    try {
      const response = await postRefresh()
      if (!active.current) return
      if (isTerminalState(response.state)) {
        finish(toastFromStatus(buildStatus(response.state)))
      } else {
        void pollerRef.current?.run()
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      finish({
        variant: 'error',
        message: TOAST_MESSAGES.refreshRequestFailureWithDetail(detail),
        detail,
      })
    }

    await completionPromise
  }, [finish, settings.pollIntervalMs, settings.timeoutMs])

  return { isRefreshing, pendingToasts, startRefresh, dismissToast }
}

export const useRefreshStatus = useRefreshStatusController

export type { RefreshStatusResponse }
