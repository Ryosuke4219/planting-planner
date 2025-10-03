import { useCallback, useEffect, useRef, useState } from 'react'

import * as apiModule from '../lib/api'
import type { RecommendResponse, RecommendationItem, Region } from '../types'
import {
  DEFAULT_ACTIVE_WEEK,
  DEFAULT_WEEK,
  NormalizeRecommendationResult,
  normalizeRecommendationResponse,
} from '../utils/recommendations'
import { normalizeWeekInput } from '../utils/weekNormalization'

const api = apiModule as typeof import('../lib/api') & {
  fetchRecommend?: (input: { region: Region; week?: string }) => Promise<RecommendResponse>
}

export interface RecommendationFetchInput {
  region: Region
  week: string
  preferLegacy?: boolean
}

export type RecommendationFetcher = (
  input: RecommendationFetchInput,
) => Promise<NormalizeRecommendationResult | null>

export const useRecommendationFetcher = (): RecommendationFetcher => {
  return useCallback<RecommendationFetcher>(
    async ({ region, week, preferLegacy = false }) => {
      const callModern = async (): Promise<RecommendResponse | undefined> => {
        if (typeof api.fetchRecommendations !== 'function') {
          return undefined
        }
        try {
          return await api.fetchRecommendations(region, week)
        } catch {
          return undefined
        }
      }

      const callLegacy = async (): Promise<RecommendResponse | undefined> => {
        if (typeof api.fetchRecommend !== 'function') {
          return undefined
        }
        try {
          return await api.fetchRecommend({ region, week })
        } catch {
          return undefined
        }
      }

      const primary = preferLegacy ? callLegacy : callModern
      const secondary = preferLegacy ? callModern : callLegacy

      const response = (await primary()) ?? (await secondary())
      if (!response) {
        return null
      }

      return normalizeRecommendationResponse(response, week)
    },
    [],
  )
}

export interface UseRecommendationLoaderResult {
  queryWeek: string
  setQueryWeek: (week: string) => void
  activeWeek: string
  items: RecommendationItem[]
  currentWeek: string
  requestRecommendations: (
    inputWeek: string,
    options?: { preferLegacy?: boolean; regionOverride?: Region },
  ) => Promise<void>
}

export const useRecommendationLoader = (region: Region): UseRecommendationLoaderResult => {
  const [queryWeek, setQueryWeek] = useState(DEFAULT_WEEK)
  const [activeWeek, setActiveWeek] = useState(DEFAULT_ACTIVE_WEEK)
  const [items, setItems] = useState<RecommendationItem[]>([])
  const currentWeekRef = useRef<string>(DEFAULT_WEEK)
  const initialFetchRef = useRef(false)
  const fetchRecommendationsWithFallback = useRecommendationFetcher()

  const normalizeWeek = useCallback(
    (value: string) => normalizeWeekInput(value, activeWeek),
    [activeWeek],
  )

  const requestRecommendations = useCallback(
    async (
      inputWeek: string,
      options?: { preferLegacy?: boolean; regionOverride?: Region },
    ) => {
      const targetRegion = options?.regionOverride ?? region
      const normalizedWeek = normalizeWeek(inputWeek)
      setQueryWeek(normalizedWeek)
      currentWeekRef.current = normalizedWeek
      try {
        const result = await fetchRecommendationsWithFallback({
          region: targetRegion,
          week: normalizedWeek,
          preferLegacy: options?.preferLegacy,
        })
        if (!result) {
          setItems([])
          return
        }
        const resolvedWeek = normalizeWeekInput(result.week, activeWeek)
        setItems(result.items)
        setActiveWeek(resolvedWeek)
        currentWeekRef.current = resolvedWeek
      } catch {
        setItems([])
      }
    },
    [activeWeek, fetchRecommendationsWithFallback, normalizeWeek, region],
  )

  useEffect(() => {
    if (initialFetchRef.current) {
      return
    }
    initialFetchRef.current = true
    void requestRecommendations(currentWeekRef.current)
  }, [requestRecommendations])

  return {
    queryWeek,
    setQueryWeek,
    activeWeek,
    items,
    currentWeek: currentWeekRef.current,
    requestRecommendations,
  }
}
