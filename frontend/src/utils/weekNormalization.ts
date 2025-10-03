import { normalizeIsoWeek } from '../lib/week'

export const normalizeWeekInput = (value: string, fallbackWeek: string): string => {
  const trimmed = value.trim()
  if (trimmed) {
    const digits = trimmed.replace(/[^0-9]/g, '')
    if (digits.length === 6) {
      const year = digits.slice(0, 4)
      const week = digits.slice(4).padStart(2, '0')
      return `${year}-W${week}`
    }
  }
  return normalizeIsoWeek(value, fallbackWeek)
}
