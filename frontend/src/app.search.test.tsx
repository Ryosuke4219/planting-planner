import '@testing-library/jest-dom/vitest'
import { cleanup, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  fetchCrops,
  fetchRecommend,
  fetchRecommendations,
  renderApp,
  resetAppSpies,
} from '../tests/utils/renderApp'

describe('App search', () => {
  beforeEach(() => {
    resetAppSpies()
    fetchRecommend.mockRejectedValue(new Error('legacy endpoint disabled'))
    fetchCrops.mockResolvedValue([
      { id: 1, name: '春菊', category: 'leaf' },
      { id: 2, name: 'にんじん', category: 'root' },
    ])
    fetchRecommendations.mockResolvedValue({
      week: '2024-W30',
      region: 'temperate',
      items: [
        {
          crop: '春菊',
          harvest_week: '2024-W35',
          sowing_week: '2024-W30',
          source: 'local-db',
          growth_days: 35,
        },
        {
          crop: 'にんじん',
          harvest_week: '2024-W45',
          sowing_week: '2024-W32',
          source: 'local-db',
          growth_days: 80,
        },
      ],
    })
  })

  afterEach(() => {
    cleanup()
  })

  it('作物名の検索はNFKC正規化される', async () => {
    const { user } = await renderApp()

    const table = await screen.findByRole('table')
    expect(within(table).getByText('春菊')).toBeInTheDocument()
    expect(within(table).getByText('にんじん')).toBeInTheDocument()

    const searchBox = screen.getByRole('searchbox', { name: '作物検索' })
    await user.type(searchBox, 'ﾆﾝｼﾞﾝ')

    await waitFor(() => {
      expect(within(table).queryByText('春菊')).not.toBeInTheDocument()
    })
    expect(within(table).getByText('にんじん')).toBeInTheDocument()
  })

  it('カテゴリ文字列で大文字小文字を無視して検索できる', async () => {
    const { user } = await renderApp()

    const table = await screen.findByRole('table')
    const searchBox = screen.getByRole('searchbox', { name: '作物検索' })

    await user.type(searchBox, 'root')

    await waitFor(() => {
      expect(within(table).queryByText('春菊')).not.toBeInTheDocument()
    })
    expect(within(table).getByText('にんじん')).toBeInTheDocument()

    await user.clear(searchBox)

    await waitFor(() => {
      expect(within(table).getByText('春菊')).toBeInTheDocument()
      expect(within(table).getByText('にんじん')).toBeInTheDocument()
    })
  })
})
