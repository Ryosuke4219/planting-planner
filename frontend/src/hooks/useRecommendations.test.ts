import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MockInstance } from 'vitest'

import type { Crop, RecommendResponse, Region } from '../types'

const recommendResponse: RecommendResponse = {
  week: '2024-W06',
  region: 'temperate',
  items: [],
}

type UseRecommendationLoader = typeof import('./useRecommendations')['useRecommendationLoader']

describe('useRecommendationLoader', () => {
  let useRecommendationLoader: UseRecommendationLoader
  let fetchRecommendations: MockInstance<
    (region: Region, week?: string) => Promise<RecommendResponse>
  >
  let fetchCrops: MockInstance<() => Promise<Crop[]>>

  beforeEach(async () => {
    vi.resetModules()
    const api = await import('../lib/api')
    fetchRecommendations = vi
      .spyOn(api, 'fetchRecommendations')
      .mockResolvedValue(recommendResponse)
    fetchCrops = vi.spyOn(api, 'fetchCrops').mockResolvedValue([])
    ;({ useRecommendationLoader } = await import('./useRecommendations'))
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('normalizes numeric 5-digit week inputs before fetching', async () => {
    const { result } = renderHook(() => useRecommendationLoader('temperate'))

    fetchRecommendations.mockClear()

    await act(async () => {
      await result.current.requestRecommendations('2024-W6')
    })

    expect(fetchRecommendations).toHaveBeenCalledWith('temperate', '2024-W06')
  })
})
