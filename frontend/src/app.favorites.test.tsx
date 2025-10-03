import '@testing-library/jest-dom/vitest'
import { cleanup, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  cropsFixture,
  defaultRecommendation,
  fetchCrops,
  fetchRecommendations,
  fetchRefreshStatus,
  legacyItem,
  localItem,
  renderApp,
  resetAppTestState,
  saveFavorites,
  saveRegion,
  storageState,
} from './app.test.helpers'

describe('App favorites flow', () => {
  beforeEach(() => {
    resetAppTestState()
  })

  afterEach(() => {
    cleanup()
  })

  it('既存のお気に入りに新しい作物を追加できる', async () => {
    storageState.favorites = [1]
    fetchCrops.mockResolvedValue(cropsFixture.slice(0, 2))
    fetchRecommendations.mockResolvedValue({
      ...defaultRecommendation,
      items: [
        { ...legacyItem, crop: '春菊', growth_days: 35 },
        localItem,
      ],
    })

    const { user } = await renderApp()

    await user.click(screen.getByRole('button', { name: 'この条件で見る' }))
    await user.click(screen.getByRole('button', { name: 'にんじんをお気に入りに追加' }))

    expect(saveFavorites).toHaveBeenLastCalledWith([1, 2])
  })

  it('推奨表はお気に入りを先頭にソートする', async () => {
    storageState.favorites = [2]
    fetchCrops.mockResolvedValue(cropsFixture)
    fetchRecommendations.mockResolvedValue({
      ...defaultRecommendation,
      items: [
        { ...legacyItem, harvest_week: '2024-W40' },
        localItem,
        { ...localItem, crop: 'キャベツ', harvest_week: '2024-W42' },
      ],
    })

    const { user } = await renderApp()

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
    const rows = within(table).getAllByRole('row').slice(1)
    const [firstRow, ...restRows] = rows
    if (!firstRow || restRows.length < 2) {
      throw new Error('推奨テーブルの行が不足しています')
    }

    expect(firstRow).toHaveTextContent('にんじん')
    const restTexts = restRows.map((row) => row.textContent ?? '')
    expect(restTexts.some((text) => text.includes('春菊'))).toBe(true)
    expect(restTexts.some((text) => text.includes('キャベツ'))).toBe(true)
  })
})
