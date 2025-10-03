import '@testing-library/jest-dom/vitest'
import { cleanup, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  cropsFixture,
  defaultRecommendation,
  fetchCrops,
  fetchPrice,
  fetchRecommend,
  fetchRecommendations,
  legacyItem,
  localItem,
  renderApp,
  resetAppTestState,
  saveRegion,
} from './app.test.helpers'

describe('App recommendations flow', () => {
  beforeEach(() => {
    resetAppTestState()
  })

  afterEach(() => {
    cleanup()
  })

  it('fetchRecommendations が失敗しても fetchRecommend で初期描画される', async () => {
    fetchCrops.mockResolvedValue(cropsFixture.slice(0, 2))
    fetchRecommendations.mockRejectedValueOnce(new Error('unexpected error'))
    fetchRecommend.mockResolvedValue({
      ...defaultRecommendation,
      items: [legacyItem],
    })

    await renderApp()

    await waitFor(() => {
      expect(fetchRecommend).toHaveBeenCalledWith({ region: 'temperate', week: '2024-W30' })
    })
    expect(screen.getByText('春菊')).toBeInTheDocument()
  })

  it('初期ロードの失敗で legacy API にフォールバックする', async () => {
    fetchCrops.mockResolvedValue(cropsFixture.slice(0, 2))
    fetchRecommendations.mockRejectedValueOnce(new Error('network error'))
    fetchRecommend.mockResolvedValue({
      ...defaultRecommendation,
      items: [legacyItem],
    })

    await renderApp()

    await waitFor(() => {
      expect(fetchRecommendations).toHaveBeenCalledTimes(1)
      expect(fetchRecommend).toHaveBeenCalledTimes(1)
    })
    expect(fetchRecommendations).toHaveBeenNthCalledWith(1, 'temperate', '2024-W30')
  })

  it('地域と週の入力で API を再フェッチできる', async () => {
    fetchCrops.mockResolvedValue(cropsFixture.slice(0, 2))
    fetchRecommendations.mockImplementation(async (region) => ({
      ...defaultRecommendation,
      region,
      items: region === 'temperate' ? [legacyItem] : [localItem],
    }))

    const { user } = await renderApp()

    await waitFor(() => {
      expect(fetchRecommendations).toHaveBeenLastCalledWith('temperate', '2024-W30')
    })

    const select = screen.getByLabelText('地域')
    const weekInput = screen.getByLabelText('週')
    await user.selectOptions(select, '寒冷地')
    await user.clear(weekInput)
    await user.type(weekInput, '2024-W32')
    await user.click(screen.getByRole('button', { name: 'この条件で見る' }))

    await waitFor(() => {
      expect(fetchRecommendations).toHaveBeenLastCalledWith('cold', '2024-W32')
    })
    expect(saveRegion).toHaveBeenLastCalledWith('cold')
    expect(screen.getByText('にんじん')).toBeInTheDocument()
  })

  it('価格データは行選択時にフェッチされる', async () => {
    fetchCrops.mockResolvedValue(cropsFixture.slice(0, 2))
    fetchRecommendations.mockResolvedValue({
      ...defaultRecommendation,
      items: [legacyItem, localItem],
    })
    fetchPrice.mockResolvedValue({
      crop_id: 1,
      crop: '春菊',
      unit: 'kg',
      source: 'local-db',
      prices: [],
    })

    const { user } = await renderApp()

    const table = await screen.findByRole('table')
    const rows = within(table).getAllByRole('row').slice(1)
    const firstRow = rows.find((row) => within(row).queryByText('春菊'))
    if (!firstRow) {
      throw new Error('春菊の行が見つかりません')
    }

    await user.click(firstRow)

    await waitFor(() => {
      expect(fetchPrice).toHaveBeenCalledTimes(1)
    })
    expect(fetchPrice).toHaveBeenLastCalledWith(1, undefined, undefined)
  })
})
