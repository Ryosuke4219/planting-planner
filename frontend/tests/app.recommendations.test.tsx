import '@testing-library/jest-dom/vitest'
import { cleanup, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'

import {
  fetchRecommend,
  fetchRecommendations,
  fetchCrops,
  renderApp,
  resetAppSpies,
} from './utils/renderApp'

describe('App recommendations', () => {
  beforeEach(() => {
    resetAppSpies()
    fetchCrops.mockResolvedValue([])
    fetchRecommendations.mockRejectedValue(new Error('modern failed'))
    fetchRecommend.mockRejectedValue(new Error('legacy failed'))
  })

  afterEach(() => {
    cleanup()
    resetAppSpies()
  })

  test('両方のAPIが失敗しても基準週が送信週に同期される', async () => {
    const { user } = await renderApp()

    await screen.findByText('基準週: 2024-W30')

    const weekInput = screen.getByLabelText('週') as HTMLInputElement
    await user.clear(weekInput)
    await user.type(weekInput, '2024-W31')
    await user.click(screen.getByRole('button', { name: 'この条件で見る' }))

    await waitFor(() => {
      expect(fetchRecommendations).toHaveBeenLastCalledWith('temperate', '2024-W31')
    })

    await waitFor(() => {
      expect(fetchRecommend).toHaveBeenCalled()
    })

    await waitFor(() => {
      expect(screen.getByText('基準週: 2024-W31')).toBeInTheDocument()
    })
  })
})
