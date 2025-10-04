import '@testing-library/jest-dom/vitest'
import { cleanup, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { REFRESH_BUTTON_TEXT, REFRESH_MESSAGES } from './constants/messages'

import {
  fetchCrops,
  fetchRecommend,
  fetchRefreshStatus,
  fetchRecommendations,
  postRefresh,
  renderApp,
  resetAppSpies,
} from '../tests/utils/renderApp'

describe('App refresh', () => {
  beforeEach(() => {
    resetAppSpies()
    fetchRecommend.mockRejectedValue(new Error('legacy endpoint disabled'))
  })

  afterEach(() => {
    cleanup()
  })

  it('更新完了までポーリングし成功トーストを表示する', async () => {
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
      ],
    })

    const { user } = await renderApp()
    const refreshButton = screen.getByRole('button', { name: REFRESH_BUTTON_TEXT.idle })
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined)

    try {
      let resolvePostRefresh: ((response: { state: 'running' }) => void) | undefined
      postRefresh.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolvePostRefresh = resolve
          }),
      )
      fetchRefreshStatus.mockResolvedValueOnce({
        state: 'running',
        started_at: '2024-01-01T00:00:00Z',
        finished_at: null,
        updated_records: 0,
        last_error: null,
      })
      fetchRefreshStatus.mockResolvedValueOnce({
        state: 'success',
        started_at: '2024-01-01T00:00:00Z',
        finished_at: '2024-01-01T00:05:00Z',
        updated_records: 3,
        last_error: null,
      })

      await user.click(refreshButton)
      await waitFor(() => {
        expect(refreshButton).toBeDisabled()
      })
      expect(refreshButton).toHaveTextContent(REFRESH_BUTTON_TEXT.loading)

      resolvePostRefresh?.({ state: 'running' })

      await Promise.resolve()
      await Promise.resolve()

      await waitFor(() => {
        expect(fetchRefreshStatus).toHaveBeenCalled()
      })

      expect(await screen.findByText(REFRESH_MESSAGES.success(3))).toBeInTheDocument()

      expect(refreshButton).not.toBeDisabled()
      expect(alertSpy).not.toHaveBeenCalled()
    } finally {
      alertSpy.mockRestore()
    }
  })

  it('リフレッシュに失敗した場合はエラートーストを表示する', async () => {
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
      ],
    })

    const { user } = await renderApp()

    const refreshButton = screen.getByRole('button', { name: REFRESH_BUTTON_TEXT.idle })

    postRefresh.mockRejectedValue(new Error('network'))

    await user.click(refreshButton)

    expect(await screen.findByText(REFRESH_MESSAGES.failure)).toBeInTheDocument()

    expect(refreshButton).not.toBeDisabled()
    expect(fetchRefreshStatus).not.toHaveBeenCalled()
  })
})
