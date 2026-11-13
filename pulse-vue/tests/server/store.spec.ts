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

    expect(first).toEqual({
      id: 'id-1',
      content: '第一条',
      createdAt: 100,
      likes: 0,
      liked: false,
      favorited: false,
    })
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

describe('互动：点赞 / 收藏', () => {
  function seeded() {
    let id = 0
    const repository = createMemoryPostRepository({
      now: () => 100,
      createId: () => `p${++id}`,
    })
    const first = repository.create('第一条')
    const second = repository.create('第二条')
    return { repository, first, second }
  }

  it('创建时初始化为 0 / false / false', () => {
    const { repository, first } = seeded()

    expect(first).toMatchObject({ likes: 0, liked: false, favorited: false })
    expect(repository.list()[0]).toMatchObject({ likes: 0, liked: false, favorited: false })
  })

  it('首次点赞：likes 0 → 1 且 liked=true', () => {
    const { repository, first } = seeded()

    const result = repository.like(first.id)

    expect(result).toEqual({
      ok: true,
      post: { ...first, likes: 1, liked: true, favorited: false },
    })
    expect(repository.list().find((post) => post.id === first.id)?.likes).toBe(1)
  })

  it('重复点赞不重复累加', () => {
    const { repository, first } = seeded()

    repository.like(first.id)
    repository.like(first.id)
    const result = repository.like(first.id)

    expect(result.ok && result.post.likes).toBe(1)
  })

  it('取消点赞计数下限为 0', () => {
    const { repository, first } = seeded()

    repository.like(first.id)
    repository.unlike(first.id)
    const result = repository.unlike(first.id)

    expect(result).toMatchObject({ ok: true, post: { likes: 0, liked: false } })
  })

  it('点赞 → 取消 → 再点赞回到 1', () => {
    const { repository, first } = seeded()

    repository.like(first.id)
    repository.unlike(first.id)
    const result = repository.like(first.id)

    expect(result.ok && result.post.likes).toBe(1)
    expect(result.ok && result.post.liked).toBe(true)
  })

  it('收藏幂等且不影响点赞计数', () => {
    const { repository, first } = seeded()

    expect(repository.favorite(first.id)).toMatchObject({ ok: true, post: { favorited: true, likes: 0 } })
    expect(repository.favorite(first.id)).toMatchObject({ ok: true, post: { favorited: true, likes: 0 } })
    expect(repository.unfavorite(first.id)).toMatchObject({ ok: true, post: { favorited: false, likes: 0 } })
    expect(repository.unfavorite(first.id)).toMatchObject({ ok: true, post: { favorited: false, likes: 0 } })
  })

  it('未知 id 的四个操作都返回 ok:false 且不新建条目', () => {
    const { repository } = seeded()
    const before = repository.list()

    for (const result of [
      repository.like('missing'),
      repository.unlike('missing'),
      repository.favorite('missing'),
      repository.unfavorite('missing'),
    ]) {
      expect(result).toEqual({ ok: false })
    }

    expect(repository.list()).toEqual(before)
  })

  it('返回值是副本：双向修改都不影响仓库', () => {
    const { repository, first } = seeded()

    const liked = repository.like(first.id)
    if (liked.ok) {
      liked.post.likes = 999
      liked.post.content = '被外部改坏'
    }

    const snapshot = repository.list()
    const target = snapshot.find((post) => post.id === first.id)
    if (target) {
      target.likes = 999
      target.favorited = true
    }

    expect(repository.list().find((post) => post.id === first.id)).toMatchObject({
      content: '第一条',
      likes: 1,
      favorited: false,
    })
  })

  it('只影响目标动态', () => {
    const { repository, first, second } = seeded()

    repository.like(first.id)
    repository.favorite(first.id)

    expect(repository.list().find((post) => post.id === second.id)).toMatchObject({
      likes: 0,
      liked: false,
      favorited: false,
    })
  })
})
