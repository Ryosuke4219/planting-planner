import '@testing-library/jest-dom/vitest'
import { cleanup, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'

import {
  fetchCrops,
  fetchRecommendations,
  fetchRefreshStatus,
  postRefresh,
  renderApp,
  saveFavorites,
  saveRegion,
  storageState,
} from '../utils/renderApp'
import {
  createItem,
  createRecommendResponse,
  defaultCrops,
  setupRecommendationsTest,
} from '../utils/recommendations'

describe('App recommendations / お気に入り並び替え', () => {
  let useRecommendationsSpy: MockInstance

  beforeEach(async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    ;({ useRecommendationsSpy } = await setupRecommendationsTest())
  })

  afterEach(() => {
    vi.useRealTimers()
    useRecommendationsSpy.mockRestore()
    cleanup()
  })

  it('推奨表がお気に入りを優先して描画される', async () => {
    storageState.favorites = [2]
    fetchCrops.mockResolvedValue(defaultCrops.map((crop) => ({ ...crop })))
    fetchRecommendations.mockResolvedValue(
      createRecommendResponse({
        items: [
          createItem({
            crop: '春菊',
            sowing_week: '2024-W31',
            harvest_week: '2024-W40',
            growth_days: 45,
          }),
          createItem({
            crop: 'にんじん',
            sowing_week: '2024-W30',
            harvest_week: '2024-W39',
            growth_days: 65,
          }),
          createItem({
            crop: 'キャベツ',
            sowing_week: '2024-W33',
            harvest_week: '2024-W42',
            growth_days: 60,
          }),
        ],
      }),
    )
    postRefresh.mockResolvedValue({
      state: 'running',
    })
    fetchRefreshStatus.mockImplementationOnce(async () => ({
      state: 'running',
      started_at: '2024-07-01T00:00:00Z',
      finished_at: null,
      updated_records: 0,
      last_error: null,
    }))
    fetchRefreshStatus.mockResolvedValue({
      state: 'success',
      started_at: '2024-07-01T00:00:00Z',
      finished_at: '2024-07-01T01:00:00Z',
      updated_records: 3,
      last_error: null,
    })

    const { user } = await renderApp({ useFakeTimers: true })

    expect(fetchRefreshStatus).not.toHaveBeenCalled()

    const select = screen.getByLabelText('地域')
    await user.selectOptions(select, '寒冷地')
    await waitFor(() => expect(saveRegion).toHaveBeenLastCalledWith('cold'))

    const weekInput = screen.getByLabelText('週')
    await user.clear(weekInput)
    await user.type(weekInput, '2024-W32')
    await user.click(screen.getByRole('button', { name: 'この条件で見る' }))

    await waitFor(() => {
      expect(fetchRecommendations).toHaveBeenLastCalledWith('cold', '2024-W32')
    })

    const table = await screen.findByRole('table')

    const expectRowOrder = (expected: string[]) => {
      const rows = within(table).getAllByRole('row').slice(1)
      expect(rows).toHaveLength(expected.length)
      expected.forEach((cropName, index) => {
        const row = rows[index]
        if (!row) {
          throw new Error('推奨テーブルの行が不足しています')
        }
        expect(row).toHaveTextContent(cropName)
      })
    }

    await waitFor(() => {
      expectRowOrder(['にんじん', '春菊', 'キャベツ'])
    })

    await user.click(screen.getByRole('button', { name: '更新' }))

    await waitFor(() => {
      expect(postRefresh).toHaveBeenCalledTimes(1)
    })

    await waitFor(() => {
      expect(fetchRefreshStatus).toHaveBeenCalledTimes(1)
    })

    await vi.advanceTimersToNextTimerAsync()

    await waitFor(() => {
      expect(fetchRefreshStatus).toHaveBeenCalledTimes(2)
    })

    await waitFor(() => {
      expectRowOrder(['にんじん', '春菊', 'キャベツ'])
    })

    const rows = within(table).getAllByRole('row').slice(1)
    const favToggle = within(rows[1]!).getByRole('button', { name: '春菊をお気に入りに追加' })
    await user.click(favToggle)

    expect(saveFavorites).toHaveBeenLastCalledWith([2, 1])
    expect(useRecommendationsSpy).toHaveBeenCalled()
  })
})
