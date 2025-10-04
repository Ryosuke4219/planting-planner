import { useCallback, useEffect, useRef, useState } from 'react'

import { fetchRefreshStatus, postRefresh } from '../lib/api'
import type { RefreshState, RefreshStatusResponse } from '../types'
import { REFRESH_MESSAGES } from '../constants/messages'
import type { ToastItem, ToastType } from '../components/Toast'

interface RefreshToast extends ToastItem {
  updatedRecords: number
}

interface UseRefreshStatusResult {
  refreshing: boolean
  startRefresh: () => Promise<void>
  toasts: RefreshToast[]
  dismissToast: (id: string) => void
}

const TERMINAL_STATES: RefreshState[] = ['success', 'failure', 'stale']
const MAX_POLL_ATTEMPTS = 20

const createToast = (status: RefreshStatusResponse): RefreshToast => {
  if (status.state === 'success') {
    return {
      id: createId(),
      type: 'success',
      message: REFRESH_MESSAGES.success(status.updated_records),
      duration: 5000,
      updatedRecords: status.updated_records,
    }
  }
  if (status.state === 'failure') {
    return {
      id: createId(),
      type: 'error',
      message: REFRESH_MESSAGES.failure,
      duration: 5000,
      updatedRecords: status.updated_records,
    }
  }
  return {
    id: createId(),
    type: 'warning',
    message: REFRESH_MESSAGES.stale,
    duration: 5000,
    updatedRecords: status.updated_records,
  }
}

const createId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return Math.random().toString(36).slice(2)
}

const createMessageToast = (type: ToastType, message: string): RefreshToast => ({
  id: createId(),
  type,
  message,
  duration: 5000,
  updatedRecords: 0,
})

export const useRefreshStatus = (): UseRefreshStatusResult => {
  const [refreshing, setRefreshing] = useState(false)
  const [toasts, setToasts] = useState<RefreshToast[]>([])
  const activeRef = useRef(false)
  const isMountedRef = useRef(true)

  useEffect(() => {
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const enqueueToast = useCallback(
    (toast: RefreshToast) => {
      if (!isMountedRef.current) {
        return
      }
      setToasts((prev) => [...prev, toast])
    },
    [isMountedRef],
  )

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  const pollStatus = useCallback(async () => {
    let attempts = 0
    while (attempts < MAX_POLL_ATTEMPTS && isMountedRef.current) {
      attempts += 1
      try {
        const status = await fetchRefreshStatus()
        if (!TERMINAL_STATES.includes(status.state)) {
          continue
        }
        enqueueToast(createToast(status))
        return
      } catch {
        enqueueToast(createMessageToast('warning', REFRESH_MESSAGES.stale))
        return
      }
    }
    if (attempts >= MAX_POLL_ATTEMPTS && isMountedRef.current) {
      enqueueToast(createMessageToast('warning', REFRESH_MESSAGES.stale))
    }
  }, [enqueueToast, isMountedRef])

  const startRefresh = useCallback(async () => {
    if (activeRef.current || !isMountedRef.current) {
      return
    }
    activeRef.current = true
    setRefreshing(true)
    try {
      const response = await postRefresh()
      if (response.state === 'running') {
        enqueueToast(createMessageToast('success', REFRESH_MESSAGES.started))
        await pollStatus()
      } else {
        enqueueToast(
          createToast({
            state: response.state,
            started_at: null,
            finished_at: null,
            updated_records: 0,
            last_error: null,
          }),
        )
      }
    } catch {
      enqueueToast(createMessageToast('error', REFRESH_MESSAGES.failure))
    } finally {
      activeRef.current = false
      if (isMountedRef.current) {
        setRefreshing(false)
      }
    }
  }, [enqueueToast, pollStatus])

  return { refreshing, startRefresh, toasts, dismissToast }
}

export type { RefreshToast, UseRefreshStatusResult }
