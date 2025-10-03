import React from 'react'
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Legend,
} from 'chart.js'
import { Line } from 'react-chartjs-2'

import { fetchPrice } from '../lib/api'

ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend)

type PriceChartProps = {
  cropId: number | null
  range?: { from?: string; to?: string }
}

export const PriceChart: React.FC<PriceChartProps> = ({ cropId, range }) => {
  const [labels, setLabels] = React.useState<string[]>([])
  const [values, setValues] = React.useState<number[]>([])
  const [title, setTitle] = React.useState('')
  const [isLoading, setIsLoading] = React.useState(false)

  React.useEffect(() => {
    if (!cropId) {
      setLabels([])
      setValues([])
      setTitle('')
      setIsLoading(false)
      return
    }

    let active = true
    setIsLoading(true)
    setLabels([])
    setValues([])
    setTitle('')
    ;(async () => {
      try {
        const res = await fetchPrice(cropId, range?.from, range?.to)
        if (!active) return
        setTitle(`${res.crop} (${res.unit})`)
        const points = res.prices ?? []
        setLabels(points.map((p) => p.week))
        setValues(points.map((p) => (p.avg_price ?? NaN)))
        setLoadedCropId(cropId)
        setIsLoading(false)
      } catch {
        if (active) {
          setLabels([])
          setValues([])
          setTitle('')
        }
      } finally {
        if (active) {
          setIsLoading(false)
        }
      }
    })()

    return () => {
      active = false
    }
  }, [cropId, range?.from, range?.to])

  if (!cropId) {
    return <p>作物を選択すると価格推移が表示されます。</p>
  }

  if (isLoading) {
    return <p>価格データを読み込み中です…</p>
  }

  if (labels.length === 0) {
    return <p>価格データがありません。</p>
  }

  return (
    <div>
      <h4 style={{ margin: '8px 0' }}>{title}</h4>
      <Line
        data={{
          labels,
          datasets: [{ label: '週平均価格', data: values, tension: 0.2 }],
        }}
        options={{
          responsive: true,
          plugins: { legend: { display: true } },
          scales: { y: { beginAtZero: false } },
        }}
      />
    </div>
  )
}
