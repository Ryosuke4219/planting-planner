import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'

import * as weekModule from '../lib/week'
import type { RecommendationItem, Region } from '../types'
import type { CropCatalogMap } from './useCropCatalog'
import {
  DEFAULT_ACTIVE_WEEK,
  DEFAULT_WEEK,
  RecommendationRow,
  buildRecommendationRows,
  formatWeekLabel,
} from '../utils/recommendations'

import { useRecommendationFetcher } from './recommendationFetcher'
import { useCropCatalog } from './useCropCatalog'

const week = weekModule as typeof import('../lib/week')

const { normalizeIsoWeek, getCurrentIsoWeek } = week
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
  cropCatalog: CropCatalogMap
  handleSubmit: (event: FormEvent<HTMLFormElement>) => void
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
        const dateLike = trimmed.match(/^(\d{4})([-/.])(\d{1,2})\2(\d{1,2})$/)
        if (dateLike) {
          const [, yearPart, , monthPart, dayPart] = dateLike
          const year = Number(yearPart)
          const month = Number(monthPart)
          const day = Number(dayPart)
          if (
            Number.isInteger(year) &&
            Number.isInteger(month) &&
            Number.isInteger(day) &&
            month >= 1 &&
            month <= 12 &&
            day >= 1 &&
            day <= 31
          ) {
            const utcDate = new Date(Date.UTC(year, month - 1, day))
            if (
              utcDate.getUTCFullYear() === year &&
              utcDate.getUTCMonth() === month - 1 &&
              utcDate.getUTCDate() === day
            ) {
              return getCurrentIsoWeek(utcDate)
            }
          }
        }

        const upper = trimmed.toUpperCase()
        const weekFirstMatch = upper.match(/^W?(\d{1,2})\D+(\d{4})$/)
        if (weekFirstMatch) {
          const weekPart = weekFirstMatch[1]
          const yearPart = weekFirstMatch[2]
          if (weekPart && yearPart) {
            return normalizeIsoWeek(`${yearPart}-W${weekPart.padStart(2, '0')}`, activeWeek)
          }
        }

        const digits = upper.replace(/[^0-9]/g, '')
        if (digits.length === 5 || digits.length === 6) {
          const year = digits.slice(0, 4)
          const weekPart = digits.slice(4)
          if (year && weekPart) {
            return normalizeIsoWeek(`${year}-W${weekPart.padStart(2, '0')}`, activeWeek)
          }
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
      const isLatestRequest = (): boolean => {
        const latest = requestTrackerRef.current
        return (
          latest.id === requestMeta.id &&
          latest.region === requestMeta.region &&
          latest.week === requestMeta.week
        )
      }
      try {
        const result = await fetchRecommendationsWithFallback({
          region: targetRegion,
          week: normalizedWeek,
          preferLegacy: options?.preferLegacy,
        })
        if (!isLatestRequest()) {
          return
        }
        if (!result) {
          setItems([])
          setActiveWeek(normalizedWeek)
          currentWeekRef.current = normalizedWeek
          return
        }
        const resolvedWeek = normalizeIsoWeek(result.week, normalizedWeek)
        setItems(result.items)
        setActiveWeek(resolvedWeek)
        currentWeekRef.current = resolvedWeek
      } catch {
        if (!isLatestRequest()) {
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
  const { catalog: cropCatalog } = useCropCatalog()
  const cropIndex = useMemo(() => {
    const map = new Map<string, number>()
    cropCatalog.forEach((entry, cropName) => {
      map.set(cropName, entry.id)
    })
    return map
  }, [cropCatalog])
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
    cropCatalog,
    handleSubmit,
  }
}

export type { RecommendationRow } from '../utils/recommendations'
export type { RecommendationFetcher } from './recommendationFetcher'
export { useCropCatalog } from './useCropCatalog'
export type { CropCatalogEntry, CropCatalogMap, UseCropCatalogResult } from './useCropCatalog'
