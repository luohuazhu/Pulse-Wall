// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createMemoryPostRepository } from '../../server/store.ts'

describe('createMemoryPostRepository', () => {
  it('初始为空', () => {
    const repository = createMemoryPostRepository()

    expect(repository.list()).toEqual([])
  })

  it('按 createdAt 倒序返回，且可注入时钟与 id 生成器', () => {
    const times = [100, 200, 300]
    let index = 0
    let idIndex = 0
    const repository = createMemoryPostRepository({
      now: () => times[index++] ?? 0,
      createId: () => `id-${++idIndex}`,
    })

    const first = repository.create('第一条')
    const second = repository.create('第二条')
    const third = repository.create('第三条')

    expect(first).toEqual({ id: 'id-1', content: '第一条', createdAt: 100 })
    expect(second.createdAt).toBe(200)
    expect(third.createdAt).toBe(300)
    expect(repository.list().map((post) => post.id)).toEqual(['id-3', 'id-2', 'id-1'])
  })

  it('同一毫秒内创建也能得到不同 id', () => {
    const repository = createMemoryPostRepository({ now: () => 100 })

    const a = repository.create('a')
    const b = repository.create('b')

    expect(a.id).not.toBe(b.id)
    expect(repository.list()).toHaveLength(2)
  })

  it('list 返回副本，外部修改不影响仓库内部状态', () => {
    const repository = createMemoryPostRepository()
    repository.create('不会消失')

    const snapshot = repository.list()
    snapshot.push({ id: 'injected', content: '外部注入', createdAt: 1 })
    snapshot.length = 0

    expect(repository.list()).toHaveLength(1)
    expect(repository.list()[0]?.content).toBe('不会消失')
  })

  it('不同实例之间数据隔离', () => {
    const a = createMemoryPostRepository()
    const b = createMemoryPostRepository()

    a.create('只属于 a')

    expect(a.list()).toHaveLength(1)
    expect(b.list()).toEqual([])
  })
})
