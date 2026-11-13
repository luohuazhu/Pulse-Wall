import { describe, expect, it } from 'vitest'
import { formatTime, pad } from '../../src/utils/time'

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

const NOW = new Date(2024, 4, 20, 12, 0, 0).getTime()

describe('pad', () => {
  it('不足两位时补零', () => {
    expect(pad(0)).toBe('00')
    expect(pad(5)).toBe('05')
  })

  it('两位及以上原样返回', () => {
    expect(pad(12)).toBe('12')
    expect(pad(2024)).toBe('2024')
  })
})

describe('formatTime', () => {
  it('一分钟内显示「刚刚」', () => {
    expect(formatTime(NOW, NOW)).toBe('刚刚')
    expect(formatTime(NOW - (MINUTE - 1), NOW)).toBe('刚刚')
  })

  it('未来时间也按「刚刚」处理', () => {
    expect(formatTime(NOW + 5000, NOW)).toBe('刚刚')
  })

  it('一分钟到一小时之间显示分钟', () => {
    expect(formatTime(NOW - MINUTE, NOW)).toBe('1 分钟前')
    expect(formatTime(NOW - 59 * MINUTE, NOW)).toBe('59 分钟前')
  })

  it('一小时到一天之间显示小时', () => {
    expect(formatTime(NOW - HOUR, NOW)).toBe('1 小时前')
    expect(formatTime(NOW - 23 * HOUR - 59 * MINUTE, NOW)).toBe('23 小时前')
  })

  it('一天到七天之间显示天数', () => {
    expect(formatTime(NOW - DAY, NOW)).toBe('1 天前')
    expect(formatTime(NOW - 6 * DAY, NOW)).toBe('6 天前')
  })

  it('超过七天显示 YYYY-MM-DD 并补零', () => {
    const timestamp = new Date(2024, 4, 6, 8, 30, 0).getTime()
    expect(formatTime(timestamp, NOW)).toBe('2024-05-06')
    expect(formatTime(new Date(2023, 11, 1).getTime(), NOW)).toBe('2023-12-01')
  })
})
