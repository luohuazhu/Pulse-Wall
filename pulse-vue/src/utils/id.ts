let sequence = 0

/**
 * 生成动态 id：时间戳 36 进制 + 随机后缀 + 自增序号。
 * 序号用于保证同一毫秒内批量生成也不会撞号。
 */
export function createId(): string {
  sequence = (sequence + 1) % 1_000_000
  const random = Math.random().toString(36).slice(2, 8)
  return `${Date.now().toString(36)}${random}${sequence.toString(36)}`
}
