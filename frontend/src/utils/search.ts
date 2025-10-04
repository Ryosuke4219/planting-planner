import type { SearchFilter } from '../types'

const toHiragana = (value: string): string =>
  value.replace(/[ァ-ン]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0x60))

const normalize = (value: string): string =>
  toHiragana(value.normalize('NFKC').toLocaleLowerCase('ja-JP'))

export interface SearchableValue {
  name: string
  category?: string | null
}

export const matchesSearchFilter = (filter: SearchFilter, candidate: SearchableValue): boolean => {
  const keyword = filter.keyword.trim()
  if (!keyword) {
    return true
  }

  const normalizedKeyword = normalize(keyword)
  const name = normalize(candidate.name)
  if (name.includes(normalizedKeyword)) {
    return true
  }
  if (candidate.category) {
    const category = normalize(candidate.category)
    if (category.includes(normalizedKeyword)) {
      return true
    }
  }
  return false
}

export const filterBySearch = <T extends SearchableValue>(
  items: readonly T[],
  filter: SearchFilter,
): T[] => {
  if (!filter.keyword.trim()) {
    return [...items]
  }
  return items.filter((item) => matchesSearchFilter(filter, item))
}

export const normalizeSearchKeyword = (value: string): string => normalize(value)
