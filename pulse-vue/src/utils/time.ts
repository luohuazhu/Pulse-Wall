const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const WEEK = 7 * DAY

export function pad(value: number): string {
  return String(value).padStart(2, '0')
}

/**
 * 相对时间：刚刚 / N 分钟前 / N 小时前 / N 天前 / YYYY-MM-DD。
 * `now` 由调用方传入，便于测试与统一刷新。
 */
export function formatTime(timestamp: number, now: number): string {
  const diff = now - timestamp

  if (!Number.isFinite(diff)) {
    return ''
  }
  if (diff < MINUTE) {
    return '刚刚'
  }
  if (diff < HOUR) {
    return `${Math.floor(diff / MINUTE)} 分钟前`
  }
  if (diff < DAY) {
    return `${Math.floor(diff / HOUR)} 小时前`
  }
  if (diff < WEEK) {
    return `${Math.floor(diff / DAY)} 天前`
  }

  const date = new Date(timestamp)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}
