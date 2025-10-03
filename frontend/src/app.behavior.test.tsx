import '@testing-library/jest-dom/vitest'
import { cleanup, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  cropsFixture,
  defaultRecommendation,
  localItem,
  renderApp,
  resetAppTestState,
  fetchCrops,
  fetchRecommendations,
  saveFavorites,
  storageState,
} from './app.test.helpers'

describe('App smoke behavior', () => {
  beforeEach(() => {
    resetAppTestState()
  })

  afterEach(() => {
    cleanup()
  })

  it('保存済み地域を使って初回フェッチされる', async () => {
    storageState.region = 'cold'
    fetchCrops.mockResolvedValue(cropsFixture.slice(0, 2))
    fetchRecommendations.mockResolvedValue({
      ...defaultRecommendation,
      region: 'cold',
      items: [],
    })

    await renderApp()

    await waitFor(() => {
      expect(fetchRecommendations).toHaveBeenNthCalledWith(1, 'cold', '2024-W30')
    })
    expect(useRecommendationsSpy).toHaveBeenCalled()
  })

  it('最新API成功時はレガシーAPIを呼び出さない', async () => {
    fetchCrops.mockResolvedValue([
      { id: 1, name: '春菊', category: 'leaf' },
      { id: 2, name: 'にんじん', category: 'root' },
    ])
    fetchRecommendations.mockResolvedValue({
      week: '2024-W30',
      region: 'temperate',
      items: [],
    })
    fetchRecommend.mockResolvedValue({
      week: '2024-W30',
      region: 'temperate',
      items: [],
    })

    await renderApp()

    await waitFor(() => {
      expect(fetchRecommendations).toHaveBeenCalledTimes(1)
      expect(fetchRecommendations).toHaveBeenCalledWith('temperate', '2024-W30')
    })

    expect(fetchRecommend).not.toHaveBeenCalled()
  })

  it('fetchRecommendations が失敗しても fetchRecommend で初期描画される', async () => {
    fetchCrops.mockResolvedValue([
      { id: 1, name: '春菊', category: 'leaf' },
      { id: 2, name: 'にんじん', category: 'root' },
    ])
    fetchRecommendations.mockRejectedValueOnce(new Error('unexpected error'))
    fetchRecommend.mockResolvedValue({
      week: '2024-W30',
      region: 'temperate',
      items: [
        {
          crop: '春菊',
          harvest_week: '2024-W35',
          sowing_week: '2024-W30',
          source: 'legacy',
          growth_days: 42,
        },
      ],
    })

    await renderApp()

    await waitFor(() => {
      expect(fetchRecommend).toHaveBeenCalledWith({ region: 'temperate', week: '2024-W30' })
    })
    expect(screen.getByText('春菊')).toBeInTheDocument()
  })

  it('初期ロードで fetchRecommendations が失敗したら fetchRecommend にフォールバックする', async () => {
    fetchCrops.mockResolvedValue([
      { id: 1, name: '春菊', category: 'leaf' },
      { id: 2, name: 'にんじん', category: 'root' },
    ])
    fetchRecommendations.mockRejectedValueOnce(new Error('network error'))
    fetchRecommend.mockResolvedValue({
      week: '2024-W30',
      region: 'temperate',
      items: [
        {
          crop: '春菊',
          harvest_week: '2024-W35',
          sowing_week: '2024-W30',
          source: 'legacy',
          growth_days: 42,
        },
      ],
    })

    await renderApp()

    await waitFor(() => {
      expect(fetchRecommendations).toHaveBeenCalledTimes(1)
      expect(fetchRecommend).toHaveBeenCalledTimes(1)
    })
    expect(fetchRecommendations).toHaveBeenNthCalledWith(1, 'temperate', '2024-W30')
    expect(fetchRecommend).toHaveBeenCalledWith({ region: 'temperate', week: '2024-W30' })
    expect(screen.getByText('春菊')).toBeInTheDocument()
  })

  it('週入力は normalizeIsoWeek で揃えてAPIへ送られる', async () => {
    fetchCrops.mockResolvedValue([
      { id: 1, name: '春菊', category: 'leaf' },
      { id: 2, name: 'にんじん', category: 'root' },
    ])
    fetchRecommendations.mockImplementation(async (region, week) => {
      const resolvedWeek = week ?? '2024-W30'
      return {
        week: resolvedWeek,
        region,
        items: [
          {
            crop: '春菊',
            harvest_week: '2024-W35',
            sowing_week: '2024-W30',
            source: 'local-db',
            growth_days: 42,
          },
        ],
      }
    })

    const { user } = await renderApp()

    await waitFor(() => {
      expect(fetchRecommendations).toHaveBeenLastCalledWith('temperate', '2024-W30')
    })

    const select = screen.getByLabelText('地域')
    const weekInput = screen.getByLabelText('週')
    await user.selectOptions(select, '寒冷地')
    await user.clear(weekInput)
    await user.type(weekInput, '2024w33')
    await user.click(screen.getByRole('button', { name: 'この条件で見る' }))

    await waitFor(() => {
      expect(fetchRecommendations).toHaveBeenLastCalledWith('cold', '2024-W33')
    })
  })

  it('地域選択と週入力でAPIが手動フェッチされる', async () => {
    fetchCrops.mockResolvedValue([
      { id: 1, name: '春菊', category: 'leaf' },
      { id: 2, name: 'にんじん', category: 'root' },
    ])
    fetchRecommendations.mockImplementation(async (region) => ({
      week: '2024-W30',
      region,
      items: [
        {
          crop: region === 'temperate' ? '春菊' : 'にんじん',
          harvest_week: '2024-W35',
          sowing_week: '2024-W30',
          source: 'local-db',
          growth_days: 42,
        },
      ],
    }))

    const { user } = await renderApp()

    await waitFor(() => {
      expect(fetchRecommendations).toHaveBeenLastCalledWith('temperate', '2024-W30')
    })
    expect(useRecommendationsSpy).toHaveBeenCalled()

    const select = screen.getByLabelText('地域')
    const weekInput = screen.getByLabelText('週')
    await user.selectOptions(select, '寒冷地')
    await user.clear(weekInput)
    await user.type(weekInput, '2024-W32')
    await user.click(screen.getByRole('button', { name: 'この条件で見る' }))

    await waitFor(() => {
      expect(fetchRecommendations).toHaveBeenLastCalledWith('cold', '2024-W32')
    })
  })

  it('お気に入りトグルで保存内容が更新される', async () => {
    fetchCrops.mockResolvedValue(cropsFixture.slice(0, 2))
    fetchRecommendations.mockResolvedValue({
      ...defaultRecommendation,
      items: [
        { ...localItem, crop: '春菊' },
        localItem,
      ],
    })

    const { user } = await renderApp()

    await user.click(screen.getByRole('button', { name: 'この条件で見る' }))
    await user.click(screen.getByRole('button', { name: 'にんじんをお気に入りに追加' }))

    expect(saveFavorites).toHaveBeenLastCalledWith([2])
  })
})
