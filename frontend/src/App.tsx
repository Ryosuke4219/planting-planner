
import { ChangeEvent, useCallback, useMemo, useRef, useState } from 'react'

import { PriceChartSection } from './components/PriceChartSection'
import { RecommendationsTable } from './components/RecommendationsTable'
import { SearchControls } from './components/SearchControls'
import { useFavorites } from './components/FavStar'
import { ToastStack } from './components/ToastStack'
import { loadRegion } from './lib/storage'
import { useRefreshStatus } from './hooks/useRefreshStatus'
import { useRecommendations } from './hooks/useRecommendations'
import type { Region, SearchFilter } from './types'
import { matchesSearchFilter } from './utils/search'

import './App.css'

export const App = () => {
  const [selectedCropId, setSelectedCropId] = useState<number | null>(null)
  const [searchFilter, setSearchFilter] = useState<SearchFilter>({ keyword: '' })
  const { favorites, toggleFavorite, isFavorite } = useFavorites()
  const { refreshing, startRefresh, toasts, dismissToast } = useRefreshStatus()

  const initialRegionRef = useRef<Region>(loadRegion())

  const {
    region,
    setRegion,
    queryWeek,
    setQueryWeek,
    currentWeek,
    displayWeek,
    sortedRows,
    cropCatalog,
    handleSubmit,
  } = useRecommendations({ favorites, initialRegion: initialRegionRef.current })

  const handleWeekChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setQueryWeek(event.target.value)
    },
    [setQueryWeek],
  )

  const handleRegionChange = useCallback(
    (next: Region) => {
      setRegion(next)
    },
    [setRegion],
  )

  const handleSearchChange = useCallback((keyword: string) => {
    setSearchFilter({ keyword })
  }, [])

  const handleSearchClear = useCallback(() => {
    setSearchFilter({ keyword: '' })
  }, [])

  const filteredRows = useMemo(() => {
    if (!searchFilter.keyword.trim()) {
      return sortedRows
    }
    return sortedRows.filter((row) => {
      const category = cropCatalog.get(row.crop)?.category ?? null
      return matchesSearchFilter(searchFilter, {
        name: row.crop,
        category,
      })
    })
  }, [cropCatalog, searchFilter, sortedRows])

  return (
    <div className="app">
      <header className="app__header">
        <h1 className="app__title">Planting Planner</h1>
        <SearchControls
          queryWeek={queryWeek}
          currentWeek={currentWeek}
          onWeekChange={handleWeekChange}
          onRegionChange={handleRegionChange}
          onSubmit={handleSubmit}
          onRefresh={startRefresh}
          refreshing={refreshing}
          searchKeyword={searchFilter.keyword}
          onSearchChange={handleSearchChange}
          onSearchClear={handleSearchClear}
        />
      </header>
      <main className="app__main">
        <ToastStack toasts={toasts} onDismiss={dismissToast} />
        <RecommendationsTable
          region={region}
          displayWeek={displayWeek}
          rows={filteredRows}
          selectedCropId={selectedCropId}
          onSelect={setSelectedCropId}
          onToggleFavorite={toggleFavorite}
          isFavorite={isFavorite}
        />
        <PriceChartSection selectedCropId={selectedCropId} />
      </main>
    </div>
  )
}

export default App
