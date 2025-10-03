import type {
  Crop,
  RecommendResponse,
  RefreshResponse,
  RefreshStatusResponse,
  Region,
} from '../types'

const API_ENDPOINT = (import.meta.env.VITE_API_ENDPOINT ?? '/api').replace(/\/$/, '')

const buildUrl = (path: string, searchParams?: URLSearchParams): string => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const search = searchParams?.toString()
  return `${API_ENDPOINT}${normalizedPath}${search ? `?${search}` : ''}`
}

const request = async <T>(input: RequestInfo, init?: RequestInit): Promise<T> => {
  const response = await fetch(input, {
    headers: {
      'Content-Type': 'application/json',
    },
    ...init,
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || `Request failed with status ${response.status}`)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}

export const fetchCrops = async (): Promise<Crop[]> => {
  const url = buildUrl('/crops')
  return request<Crop[]>(url)
}

export const fetchRecommend = async ({
  region,
  week,
}: {
  region: Region
  week?: string
}): Promise<RecommendResponse> => {
  const params = new URLSearchParams({ region })
  if (week) {
    params.set('week', week)
  }
  const url = buildUrl('/recommend', params)
  return request<RecommendResponse>(url)
}

export const fetchRecommendations = async (
  region: Region,
  week?: string,
): Promise<RecommendResponse> => {
  const params = new URLSearchParams({ region })
  if (week) {
    params.set('week', week)
  }
  const url = buildUrl('/recommend', params)
  return request<RecommendResponse>(url)
}

export const fetchRecommend = async ({
  region,
  week,
}: {
  region: Region
  week?: string
}): Promise<RecommendResponse> => {
  const params = new URLSearchParams({ region })
  if (week) {
    params.set('week', week)
  }
  const url = buildUrl('/recommend', params)
  return request<RecommendResponse>(url)
}

export const postRefresh = async (body?: unknown): Promise<RefreshResponse> => {
  const url = buildUrl('/refresh')
  const init: RequestInit = { method: 'POST' }
  if (body !== undefined) {
    init.body = JSON.stringify(body)
  }
  return request<RefreshResponse>(url, init)
}

export const fetchRefreshStatus = async (): Promise<RefreshStatusResponse> => {
  const url = buildUrl('/refresh/status')
  return request<RefreshStatusResponse>(url)
}

export const fetchPrice = async (
  cropId: number,
  frm?: string,
  to?: string,
): Promise<{
  crop_id: number
  crop: string
  unit: string
  source: string
  prices: { week: string; avg_price: number | null; stddev?: number | null }[]
}> => {
  const params = new URLSearchParams({ crop_id: String(cropId) })
  if (frm) params.set('frm', frm)
  if (to) params.set('to', to)
  const url = buildUrl('/price', params)
  return request(url)
}
