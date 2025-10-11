import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'

import {
  fetchRecommend,
  fetchRecommendations,
  fetchCrops,
  postRefresh,
  fetchRefreshStatus,
} from './utils/renderApp'
import App from '../src/App'
import { TOAST_MESSAGES } from '../src/constants/messages'

describe.skip('App refresh workflow', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  test('postRefresh 成功後にステータスをポーリングし、成功トーストと reloadCurrentWeek を経て自動クローズする', async () => {
    vi.useFakeTimers()

    fetchRecommend.mockRejectedValue(new Error('legacy endpoint disabled'))
    fetchRecommendations.mockResolvedValue({
      week: '2024-W30',
      region: 'temperate',
      items: [],
    })
    fetchCrops.mockResolvedValue([])

    const useRecommendationsModule = await import('../src/hooks/useRecommendations')
    const originalUseRecommendations = useRecommendationsModule.useRecommendations
    const reloadCurrentWeekSpy = vi.fn()
    const useRecommendationsMock = vi
      .spyOn(useRecommendationsModule, 'useRecommendations')
      .mockImplementation((options) => {
        const result = originalUseRecommendations(options)
        return {
          ...result,
          reloadCurrentWeek: async () => {
            reloadCurrentWeekSpy()
            await result.reloadCurrentWeek()
          },
        }
      })

    postRefresh.mockResolvedValue({ state: 'success' })
    fetchRefreshStatus
      .mockResolvedValueOnce({
        state: 'running',
        started_at: '2024-01-01T00:00:00Z',
        finished_at: null,
        updated_records: 0,
        last_error: null,
      })
      .mockResolvedValueOnce({
        state: 'success',
        started_at: '2024-01-01T00:00:00Z',
        finished_at: '2024-01-01T00:10:00Z',
        updated_records: 7,
        last_error: null,
      })

    render(<App />)

    const refreshButton = screen.getByRole('button', { name: '更新' })
    fireEvent.click(refreshButton)
    await Promise.resolve()

    await waitFor(() => {
      expect(postRefresh).toHaveBeenCalledTimes(1)
    })

    const startToast = await screen.findByText('更新を開始しました。進行状況を確認しています…')
    expect(startToast).toBeInTheDocument()

    await waitFor(() => {
      expect(fetchRefreshStatus).toHaveBeenCalledTimes(1)
    })

    await vi.advanceTimersByTimeAsync(1000)
    await Promise.resolve()

    await waitFor(() => {
      expect(fetchRefreshStatus).toHaveBeenCalledTimes(2)
    })

    const successToast = await screen.findByText(TOAST_MESSAGES.refreshSuccess(7))
    expect(successToast).toBeInTheDocument()

    await waitFor(() => {
      expect(reloadCurrentWeekSpy).toHaveBeenCalledTimes(1)
    })

    useRecommendationsMock.mockRestore()
  })
})
