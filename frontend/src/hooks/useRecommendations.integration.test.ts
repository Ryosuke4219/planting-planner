import '@testing-library/jest-dom/vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { FormEvent } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useRecommendations } from './useRecommendations'

const fetchCrops = vi.hoisted(() => vi.fn())
const fetchRecommendations = vi.hoisted(() => vi.fn())
const fetchRecommend = vi.hoisted(() => vi.fn())

vi.mock('../lib/api', () => ({
  fetchCrops: fetchCrops as unknown,
  fetchRecommendations: fetchRecommendations as unknown,
  fetchRecommend: fetchRecommend as unknown,
}))

vi.mock('../lib/week', async () => {
  const actual = await vi.importActual<typeof import('../lib/week')>('../lib/week')
  return {
    ...actual,
    getCurrentIsoWeek: vi.fn(() => '2024-W05'),
  }
})

describe('useRecommendations integration', () => {
  beforeEach(() => {
    fetchCrops.mockReset()
    fetchRecommendations.mockReset()
    fetchRecommend.mockReset()

    fetchCrops.mockResolvedValue([])
    fetchRecommendations.mockResolvedValue({
      week: '2024-W05',
      items: [],
    })
    fetchRecommend.mockResolvedValue({
      week: '2024-W05',
      items: [],
    })
  })

  it('地域変更時に新しい地域で推奨を再取得する', async () => {
    const { result } = renderHook(() => useRecommendations({ favorites: [] }))

    await waitFor(() => {
      expect(fetchRecommendations).toHaveBeenCalledWith('temperate', '2024-W05')
    })

    act(() => {
      result.current.setRegion('warm')
    })

    await waitFor(() => {
      expect(fetchRecommendations).toHaveBeenLastCalledWith('warm', '2024-W05')
    })
  })

  it('週入力を6桁の数値からISO形式に正規化して送信する', async () => {
    const { result } = renderHook(() => useRecommendations({ favorites: [] }))

    await waitFor(() => {
      expect(fetchRecommendations).toHaveBeenCalledWith('temperate', '2024-W05')
    })

    const form = document.createElement('form')
    const weekInput = document.createElement('input')
    weekInput.name = 'week'
    weekInput.value = '202413'
    form.append(weekInput)

    const regionSelect = document.createElement('select')
    regionSelect.name = 'region'
    const option = document.createElement('option')
    option.value = 'temperate'
    option.selected = true
    regionSelect.append(option)
    form.append(regionSelect)

    await act(async () => {
      result.current.handleSubmit({
        preventDefault: () => {},
        currentTarget: form,
      } as unknown as FormEvent<HTMLFormElement>)
    })

    await waitFor(() => {
      expect(fetchRecommendations).toHaveBeenLastCalledWith('temperate', '2024-W13')
    })
  })

  it('モダンAPI失敗時にレガシーAPIへフォールバックし正規化結果を保持する', async () => {
    fetchCrops.mockResolvedValue([
      { id: 1, name: 'Carrot' },
    ])
    fetchRecommendations.mockImplementation(async () => {
      throw new Error('modern failed')
    })
    fetchRecommend.mockResolvedValue({
      week: '202409',
      items: [
        {
          crop: 'Carrot',
          sowing_week: '2024W01',
          harvest_week: '2024-W10',
          score: 10,
        },
      ],
    })

    const { result } = renderHook(() => useRecommendations({ favorites: [1] }))

    await waitFor(() => {
      expect(fetchRecommendations).toHaveBeenCalled()
      expect(fetchRecommend).toHaveBeenCalledWith({ region: 'temperate', week: '2024-W05' })
      expect(result.current.sortedRows).toHaveLength(1)
    })

    const [row] = result.current.sortedRows
    expect(row).toMatchObject({
      crop: 'Carrot',
      sowingWeekLabel: '2024-W01',
      harvestWeekLabel: '2024-W10',
    })
    expect(result.current.currentWeek).toBe('2024-W09')
  })
})
