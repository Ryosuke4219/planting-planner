import '@testing-library/jest-dom/vitest'
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useFavorites } from './FavStar'

type LoadFavorites = typeof import('../lib/storage')['loadFavorites']
type SaveFavorites = typeof import('../lib/storage')['saveFavorites']

type LoadFavoritesMock = ReturnType<typeof vi.fn<LoadFavorites>>
type SaveFavoritesMock = ReturnType<typeof vi.fn<SaveFavorites>>

const loadFavorites = vi.hoisted(() => vi.fn<LoadFavorites>(() => [])) as LoadFavoritesMock
const saveFavorites = vi.hoisted(() => vi.fn<SaveFavorites>()) as SaveFavoritesMock

vi.mock('../lib/storage', () => ({
  loadFavorites,
  saveFavorites,
}))

describe('useFavorites', () => {
  beforeEach(() => {
    loadFavorites.mockReturnValue([])
    loadFavorites.mockClear()
    saveFavorites.mockClear()
  })

  it('cropId=0でもお気に入りの追加・削除ができる', () => {
    const { result } = renderHook(() => useFavorites())

    act(() => {
      result.current.toggleFavorite(0)
    })

    expect(result.current.favorites).toEqual([0])
    expect(result.current.isFavorite(0)).toBe(true)
    expect(saveFavorites).toHaveBeenLastCalledWith([0])

    act(() => {
      result.current.toggleFavorite(0)
    })

    expect(result.current.favorites).toEqual([])
    expect(result.current.isFavorite(0)).toBe(false)
    expect(saveFavorites).toHaveBeenLastCalledWith([])
  })
})
