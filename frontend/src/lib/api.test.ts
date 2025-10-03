import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { RecommendResponse } from '../types'

import { fetchRecommend } from './api'

describe('fetchRecommend', () => {
  let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>

  beforeEach(() => {
    vi.stubEnv('VITE_API_ENDPOINT', '/api')
    fetchMock = vi.fn<typeof fetch>()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('request を通じて /recommend エンドポイントへ GET する', async () => {
    const payload: RecommendResponse = {
      week: '2024-W30',
      region: 'temperate',
      items: [],
    }
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    const result = await fetchRecommend({ region: 'temperate', week: '2024-W30' })

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/recommend?region=temperate&week=2024-W30',
      {
        headers: { 'Content-Type': 'application/json' },
      },
    )
    expect(result).toEqual(payload)
  })

  it('レスポンスが失敗した場合は例外を送出する', async () => {
    fetchMock.mockResolvedValue(
      new Response('internal error', {
        status: 500,
        statusText: 'Internal Server Error',
      }),
    )

    await expect(fetchRecommend({ region: 'temperate' })).rejects.toThrow(
      'internal error',
    )
  })
})
