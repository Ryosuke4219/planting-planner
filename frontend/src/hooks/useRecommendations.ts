import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'

import * as apiModule from '../lib/api'
import * as weekModule from '../lib/week'
import type { Crop, RecommendResponse, RecommendationItem, Region } from '../types'
import {
  DEFAULT_ACTIVE_WEEK,
  DEFAULT_WEEK,
  RecommendationRow,
  NormalizeRecommendationResult,
  buildRecommendationRows,
  formatWeekLabel,
  normalizeRecommendationResponse,
} from '../utils/recommendations'

const week = weekModule as typeof import('../lib/week')

const api = apiModule as typeof import('../lib/api') & {
  fetchRecommend?: (input: { region: Region; week?: string }) => Promise<RecommendResponse>
}

const { normalizeIsoWeek } = week
const fetchCrops = api.fetchCrops

export interface UseRecommendationsOptions {
  favorites: readonly number[]
  initialRegion?: Region
}

export interface UseRecommendationsResult {
  region: Region
  setRegion: (region: Region) => void
  queryWeek: string
  setQueryWeek: (week: string) => void
  currentWeek: string
  displayWeek: string
  sortedRows: RecommendationRow[]
  handleSubmit: (event: FormEvent<HTMLFormElement>) => void
}

interface RecommendationFetchInput {
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

const useCropIndex = (): Map<string, number> => {
  const [crops, setCrops] = useState<Crop[]>([])

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const response = await fetchCrops()
        if (active) {
          setCrops(response)
        }
      } catch {
        if (active) {
          setCrops([])
        }
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [])

  return useMemo(() => {
    const map = new Map<string, number>()
    crops.forEach((crop) => {
      map.set(crop.name, crop.id)
    })
    return map
  }, [crops])
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
  const requestTrackerRef = useRef<{ id: number; region: Region; week: string }>({
    id: 0,
    region,
    week: currentWeekRef.current,
  })
  const fetchRecommendationsWithFallback = useRecommendationFetcher()

  const normalizeWeek = useCallback(
    (value: string) => {
      const trimmed = value.trim()
      if (trimmed) {
        const digits = trimmed.replace(/[^0-9]/g, '')
        if (digits.length === 6) {
          const year = digits.slice(0, 4)
          const weekPart = digits.slice(4).padStart(2, '0')
          return `${year}-W${weekPart}`
        }
      }
      return normalizeIsoWeek(value, activeWeek)
    },
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
      const requestId = requestTrackerRef.current.id + 1
      const requestMeta = { id: requestId, region: targetRegion, week: normalizedWeek }
      requestTrackerRef.current = requestMeta
      try {
        const result = await fetchRecommendationsWithFallback({
          region: targetRegion,
          week: normalizedWeek,
          preferLegacy: options?.preferLegacy,
        })
        const latest = requestTrackerRef.current
        if (latest.id !== requestMeta.id || latest.region !== requestMeta.region || latest.week !== requestMeta.week) {
          return
        }
        if (!result) {
          setItems([])
          setActiveWeek(normalizedWeek)
          currentWeekRef.current = normalizedWeek
          return
        }
        const resolvedWeek = normalizeWeek(result.week)
        setItems(result.items)
        setActiveWeek(resolvedWeek)
        currentWeekRef.current = resolvedWeek
      } catch {
        const latest = requestTrackerRef.current
        if (latest.id !== requestMeta.id || latest.region !== requestMeta.region || latest.week !== requestMeta.week) {
          return
        }
        setItems([])
        setActiveWeek(normalizedWeek)
        currentWeekRef.current = normalizedWeek
      }
    },
    [fetchRecommendationsWithFallback, normalizeWeek, region],
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

export const useRecommendations = ({ favorites, initialRegion }: UseRecommendationsOptions): UseRecommendationsResult => {
  const initialRegionRef = useRef<Region>(initialRegion ?? 'temperate')
  const [region, setRegion] = useState<Region>(initialRegionRef.current)
  const regionSyncRef = useRef<Region>(initialRegionRef.current)
  const regionFetchSkipRef = useRef<Region | null>(null)
  const cropIndex = useCropIndex()
  const { queryWeek, setQueryWeek: setRawQueryWeek, activeWeek, items, currentWeek, requestRecommendations } =
    useRecommendationLoader(region)

  const setQueryWeek = useCallback(
    (nextWeek: string) => {
      setRawQueryWeek(nextWeek)
    },
    [setRawQueryWeek],
  )

  useEffect(() => {
    if (initialRegion !== undefined && initialRegion !== initialRegionRef.current) {
      initialRegionRef.current = initialRegion
      setRegion(initialRegion)
    }
  }, [initialRegion, setRegion])

  useEffect(() => {
    if (regionSyncRef.current === region) {
      return
    }
    regionSyncRef.current = region
    if (regionFetchSkipRef.current === region) {
      regionFetchSkipRef.current = null
      return
    }
    void requestRecommendations(currentWeek, { regionOverride: region })
  }, [currentWeek, region, requestRecommendations])

  const sortedRows = useMemo<RecommendationRow[]>(() => {
    return buildRecommendationRows({ items, favorites, cropIndex })
  }, [items, cropIndex, favorites])

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      const form = event.currentTarget
      const weekField = form.elements.namedItem('week') as HTMLInputElement | null
      const regionField = form.elements.namedItem('region') as HTMLSelectElement | null
      const submittedWeek = weekField?.value ?? queryWeek
      const submittedRegion = (regionField?.value as Region | undefined) ?? region
      if (submittedRegion && submittedRegion !== region) {
        setRegion(submittedRegion)
      }
      const regionChanged = submittedRegion !== undefined && submittedRegion !== region
      const targetRegion = submittedRegion ?? region
      const shouldRequest = !regionChanged || submittedWeek !== currentWeek
      if (regionChanged && shouldRequest) {
        regionFetchSkipRef.current = submittedRegion
      }
      if (shouldRequest) {
        void requestRecommendations(submittedWeek, { regionOverride: targetRegion })
      }
    },
    [currentWeek, queryWeek, region, requestRecommendations, setRegion],
  )

  const displayWeek = useMemo(() => formatWeekLabel(activeWeek), [activeWeek])

  return {
    region,
    setRegion,
    queryWeek,
    setQueryWeek,
    currentWeek,
    displayWeek,
    sortedRows,
    handleSubmit,
  }
}

export type { RecommendationRow } from '../utils/recommendations'
