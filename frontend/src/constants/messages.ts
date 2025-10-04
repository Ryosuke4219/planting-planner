export const REFRESH_BUTTON_TEXT = {
  idle: '更新',
  loading: '更新中...',
} as const

export const REFRESH_MESSAGES = {
  success: (updatedRecords: number) =>
    `データ更新が完了しました（${updatedRecords}件更新）`,
  failure: 'データ更新に失敗しました。時間をおいて再度お試しください。',
  stale: '更新状況の取得に失敗しました。時間をおいて再度お試しください。',
  started: 'データ更新を開始しました。',
} as const
