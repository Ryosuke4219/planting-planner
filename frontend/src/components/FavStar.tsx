import { useCallback, useMemo, useState } from 'react'

import { loadFavorites, saveFavorites } from '../lib/storage'

interface Props {
  active: boolean
  cropName: string
  onToggle: () => void
}

export const FavStar = ({ active, cropName, onToggle }: Props) => {
  const label = active ? `${cropName}をお気に入りから外す` : `${cropName}をお気に入りに追加`
  return (
    <button
      type="button"
      className={`fav-star${active ? ' fav-star--active' : ''}`}
      aria-pressed={active}
      aria-label={label}
      onClick={(event) => {
        event.stopPropagation()
        onToggle()
      }}
    >
      {active ? '★' : '☆'}
    </button>
  )
}

FavStar.displayName = 'FavStar'

export const useFavorites = () => {
  const [favorites, setFavorites] = useState<number[]>(() => loadFavorites())

  const toggleFavorite = useCallback((cropId?: number) => {
    if (cropId === null || cropId === undefined) {
      return
    }
    setFavorites((prev) => {
      const exists = prev.includes(cropId)
      const next = exists ? prev.filter((id) => id !== cropId) : [...prev, cropId]
      saveFavorites(next)
      return next
    })
  }, [])

  const isFavorite = useCallback(
    (cropId?: number) => (cropId !== undefined ? favorites.includes(cropId) : false),
    [favorites],
  )

  return useMemo(
    () => ({ favorites, toggleFavorite, isFavorite }),
    [favorites, isFavorite, toggleFavorite],
  )
}
