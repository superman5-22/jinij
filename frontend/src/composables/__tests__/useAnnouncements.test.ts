import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useAnnouncements } from '@/composables/useAnnouncements'
import type { Announcement, AnnouncementFormData } from '@/types'

// ----------------------------------------------------------------
// Supabase モック
// ----------------------------------------------------------------
const { mockFrom } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: { from: mockFrom },
}))

// ----------------------------------------------------------------
// テストデータファクトリ
// ----------------------------------------------------------------
const makeAnnouncement = (overrides: Partial<Announcement> = {}): Announcement => ({
  id:           'ann-001',
  title:        'テストお知らせ',
  content:      'テスト本文です。',
  category:     'general',
  priority:     'normal',
  is_published: true,
  published_at: '2026-03-29T10:00:00Z',
  expires_at:   null,
  created_by:   'user-001',
  created_at:   '2026-03-29T10:00:00Z',
  updated_at:   '2026-03-29T10:00:00Z',
  ...overrides,
})

const makeFormData = (overrides: Partial<AnnouncementFormData> = {}): AnnouncementFormData => ({
  title:        'テストタイトル',
  content:      'テスト本文',
  category:     'general',
  priority:     'normal',
  is_published: false,
  published_at: '',
  expires_at:   '',
  ...overrides,
})

// ----------------------------------------------------------------
// クエリビルダー モックヘルパー
// ----------------------------------------------------------------
function buildSelectMock(result: { data: Announcement[] | null; error: null | Error }) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  chain['select'] = vi.fn().mockReturnValue(chain)
  chain['order']  = vi.fn().mockReturnValue(chain)
  chain['eq']     = vi.fn().mockReturnValue(chain)
  // フィルターなしの場合は order が resolve する
  chain['order']  = vi.fn().mockImplementation(() => {
    // allow chaining eq after order
    const sub: Record<string, ReturnType<typeof vi.fn>> = {}
    sub['eq']    = vi.fn().mockReturnValue(sub)
    // make sub itself thenable
    Object.assign(sub, Promise.resolve(result))
    sub['then']  = (res: (v: typeof result) => unknown) => Promise.resolve(result).then(res)
    sub['catch'] = (rej: (e: Error) => unknown) => Promise.resolve(result).catch(rej)
    return sub
  })
  // direct await on chain (no extra filters)
  chain['then']  = (res: (v: typeof result) => unknown) => Promise.resolve(result).then(res)
  chain['catch'] = (rej: (e: Error) => unknown) => Promise.resolve(result).catch(rej)
  return chain
}

/** シンプルな select → eq → single チェーン */
function buildSingleMock(result: { data: Announcement | null; error: null | Error }) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  chain['select'] = vi.fn().mockReturnValue(chain)
  chain['eq']     = vi.fn().mockReturnValue(chain)
  chain['single'] = vi.fn().mockResolvedValue(result)
  return chain
}

/** insert → select → single チェーン */
function buildInsertMock(result: { data: Announcement | null; error: null | Error }) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  chain['insert'] = vi.fn().mockReturnValue(chain)
  chain['select'] = vi.fn().mockReturnValue(chain)
  chain['single'] = vi.fn().mockResolvedValue(result)
  return chain
}

/** update → eq チェーン */
function buildUpdateEqMock(result: { error: null | Error }) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  chain['update'] = vi.fn().mockReturnValue(chain)
  chain['eq']     = vi.fn().mockResolvedValue(result)
  return chain
}

/** delete → eq チェーン */
function buildDeleteEqMock(result: { error: null | Error }) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  chain['delete'] = vi.fn().mockReturnValue(chain)
  chain['eq']     = vi.fn().mockResolvedValue(result)
  return chain
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ================================================================
describe('useAnnouncements', () => {

  // ----------------------------------------------------------------
  describe('初期状態', () => {
    it('announcements は空配列', () => {
      const { announcements } = useAnnouncements()
      expect(announcements.value).toEqual([])
    })

    it('loading は false', () => {
      const { loading } = useAnnouncements()
      expect(loading.value).toBe(false)
    })

    it('error は null', () => {
      const { error } = useAnnouncements()
      expect(error.value).toBeNull()
    })

    it('urgentAnnouncements は空配列', () => {
      const { urgentAnnouncements } = useAnnouncements()
      expect(urgentAnnouncements.value).toEqual([])
    })
  })

  // ----------------------------------------------------------------
  describe('urgentAnnouncements（算出プロパティ）', () => {
    it('urgent と high を返す', () => {
      const { announcements, urgentAnnouncements } = useAnnouncements()
      announcements.value = [
        makeAnnouncement({ id: 'a1', priority: 'urgent' }),
        makeAnnouncement({ id: 'a2', priority: 'high' }),
        makeAnnouncement({ id: 'a3', priority: 'normal' }),
        makeAnnouncement({ id: 'a4', priority: 'low' }),
      ]
      expect(urgentAnnouncements.value).toHaveLength(2)
      expect(urgentAnnouncements.value.map(a => a.id)).toContain('a1')
      expect(urgentAnnouncements.value.map(a => a.id)).toContain('a2')
    })

    it('urgent/high がない場合は空配列', () => {
      const { announcements, urgentAnnouncements } = useAnnouncements()
      announcements.value = [
        makeAnnouncement({ priority: 'normal' }),
        makeAnnouncement({ priority: 'low' }),
      ]
      expect(urgentAnnouncements.value).toHaveLength(0)
    })
  })

  // ----------------------------------------------------------------
  describe('fetchAnnouncements', () => {
    it('正常取得: announcements が更新される', async () => {
      const mockData = [makeAnnouncement({ id: 'a1' }), makeAnnouncement({ id: 'a2' })]
      mockFrom.mockReturnValue(buildSelectMock({ data: mockData, error: null }))

      const { announcements, loading, fetchAnnouncements } = useAnnouncements()
      await fetchAnnouncements()

      expect(announcements.value).toEqual(mockData)
      expect(loading.value).toBe(false)
    })

    it('data が null のとき announcements は空配列', async () => {
      mockFrom.mockReturnValue(buildSelectMock({ data: null, error: null }))
      const { announcements, fetchAnnouncements } = useAnnouncements()
      await fetchAnnouncements()
      expect(announcements.value).toEqual([])
    })

    it('エラー時: error にメッセージがセットされる', async () => {
      const chain = buildSelectMock({ data: null, error: null })
      chain['then'] = (_: unknown, rej: (e: Error) => unknown) =>
        Promise.reject(new Error('DB接続エラー')).catch(rej)
      // シンプルに直接 reject させる
      mockFrom.mockImplementation(() => {
        throw new Error('DB接続エラー')
      })

      const { error, fetchAnnouncements } = useAnnouncements()
      await fetchAnnouncements()
      expect(error.value).toBe('DB接続エラー')
    })

    it('ローディング中は loading が true になる', async () => {
      let resolvePromise!: () => void
      const pending = new Promise<void>(res => { resolvePromise = res })

      const chain: Record<string, ReturnType<typeof vi.fn>> = {}
      chain['select'] = vi.fn().mockReturnValue(chain)
      chain['order']  = vi.fn().mockReturnValue(chain)
      chain['then']   = (res: (v: { data: null; error: null }) => unknown) =>
        pending.then(() => res({ data: null, error: null }))
      chain['catch']  = vi.fn()
      mockFrom.mockReturnValue(chain)

      const { loading, fetchAnnouncements } = useAnnouncements()
      const fetchPromise = fetchAnnouncements()
      expect(loading.value).toBe(true)
      resolvePromise()
      await fetchPromise
      expect(loading.value).toBe(false)
    })
  })

  // ----------------------------------------------------------------
  describe('fetchById', () => {
    it('正常取得: お知らせを返す', async () => {
      const mockData = makeAnnouncement({ id: 'ann-001' })
      mockFrom.mockReturnValue(buildSingleMock({ data: mockData, error: null }))

      const { fetchById } = useAnnouncements()
      const result = await fetchById('ann-001')

      expect(result).toEqual(mockData)
    })

    it('エラー時: 例外を投げる', async () => {
      mockFrom.mockReturnValue(buildSingleMock({ data: null, error: new Error('not found') }))
      const { fetchById } = useAnnouncements()
      await expect(fetchById('missing-id')).rejects.toThrow('not found')
    })
  })

  // ----------------------------------------------------------------
  describe('createAnnouncement', () => {
    it('正常作成: announcements に追加される', async () => {
      const created = makeAnnouncement({ id: 'new-001', title: 'テストタイトル' })
      mockFrom.mockReturnValue(buildInsertMock({ data: created, error: null }))

      const { announcements, createAnnouncement } = useAnnouncements()
      const result = await createAnnouncement(makeFormData({ title: 'テストタイトル' }))

      expect(result).toEqual(created)
      expect(announcements.value[0]).toEqual(created)
    })

    it('is_published=true のとき published_at が設定される', async () => {
      const created = makeAnnouncement({ is_published: true, published_at: '2026-03-31T00:00:00Z' })
      const insertMock = buildInsertMock({ data: created, error: null })
      mockFrom.mockReturnValue(insertMock)

      const { createAnnouncement } = useAnnouncements()
      await createAnnouncement(makeFormData({
        is_published: true,
        published_at: '2026-03-31T00:00:00',
      }))

      const insertArg = insertMock['insert'].mock.calls[0][0] as Partial<Announcement>
      expect(insertArg.is_published).toBe(true)
      expect(insertArg.published_at).toBeTruthy()
    })

    it('is_published=false のとき published_at は null', async () => {
      const created = makeAnnouncement({ is_published: false, published_at: null })
      const insertMock = buildInsertMock({ data: created, error: null })
      mockFrom.mockReturnValue(insertMock)

      const { createAnnouncement } = useAnnouncements()
      await createAnnouncement(makeFormData({ is_published: false }))

      const insertArg = insertMock['insert'].mock.calls[0][0] as Partial<Announcement>
      expect(insertArg.published_at).toBeNull()
    })

    it('エラー時: 例外を投げる', async () => {
      const insertMock = buildInsertMock({ data: null, error: new Error('挿入失敗') })
      mockFrom.mockReturnValue(insertMock)

      const { createAnnouncement } = useAnnouncements()
      await expect(createAnnouncement(makeFormData())).rejects.toThrow('挿入失敗')
    })
  })

  // ----------------------------------------------------------------
  describe('updateAnnouncement', () => {
    it('正常更新: announcements 内の対象が更新される', async () => {
      mockFrom.mockReturnValue(buildUpdateEqMock({ error: null }))

      const { announcements, updateAnnouncement } = useAnnouncements()
      announcements.value = [makeAnnouncement({ id: 'ann-001', title: '旧タイトル' })]

      await updateAnnouncement('ann-001', makeFormData({ title: '新タイトル' }))

      expect(announcements.value[0].title).toBe('新タイトル')
    })

    it('存在しない id の場合は announcements を変更しない', async () => {
      mockFrom.mockReturnValue(buildUpdateEqMock({ error: null }))

      const { announcements, updateAnnouncement } = useAnnouncements()
      announcements.value = [makeAnnouncement({ id: 'ann-001' })]

      await updateAnnouncement('not-exist', makeFormData({ title: '変更後' }))

      expect(announcements.value[0].title).toBe('テストお知らせ')
    })

    it('エラー時: 例外を投げる', async () => {
      mockFrom.mockReturnValue(buildUpdateEqMock({ error: new Error('更新失敗') }))
      const { updateAnnouncement } = useAnnouncements()
      await expect(updateAnnouncement('ann-001', makeFormData())).rejects.toThrow('更新失敗')
    })
  })

  // ----------------------------------------------------------------
  describe('deleteAnnouncement', () => {
    it('正常削除: announcements から除外される', async () => {
      mockFrom.mockReturnValue(buildDeleteEqMock({ error: null }))

      const { announcements, deleteAnnouncement } = useAnnouncements()
      announcements.value = [
        makeAnnouncement({ id: 'ann-001' }),
        makeAnnouncement({ id: 'ann-002' }),
      ]

      await deleteAnnouncement('ann-001')

      expect(announcements.value).toHaveLength(1)
      expect(announcements.value[0].id).toBe('ann-002')
    })

    it('存在しない id の場合は配列が変わらない', async () => {
      mockFrom.mockReturnValue(buildDeleteEqMock({ error: null }))

      const { announcements, deleteAnnouncement } = useAnnouncements()
      announcements.value = [makeAnnouncement({ id: 'ann-001' })]

      await deleteAnnouncement('not-exist')

      expect(announcements.value).toHaveLength(1)
    })

    it('エラー時: 例外を投げる', async () => {
      mockFrom.mockReturnValue(buildDeleteEqMock({ error: new Error('削除失敗') }))
      const { deleteAnnouncement } = useAnnouncements()
      await expect(deleteAnnouncement('ann-001')).rejects.toThrow('削除失敗')
    })
  })

  // ----------------------------------------------------------------
  describe('togglePublish', () => {
    it('公開 → 非公開: is_published が false になる', async () => {
      mockFrom.mockReturnValue(buildUpdateEqMock({ error: null }))

      const { announcements, togglePublish } = useAnnouncements()
      announcements.value = [makeAnnouncement({ id: 'ann-001', is_published: true })]

      await togglePublish('ann-001', false)

      expect(announcements.value[0].is_published).toBe(false)
      expect(announcements.value[0].published_at).toBeNull()
    })

    it('非公開 → 公開: is_published が true になり published_at がセットされる', async () => {
      mockFrom.mockReturnValue(buildUpdateEqMock({ error: null }))

      const { announcements, togglePublish } = useAnnouncements()
      announcements.value = [
        makeAnnouncement({ id: 'ann-001', is_published: false, published_at: null }),
      ]

      await togglePublish('ann-001', true)

      expect(announcements.value[0].is_published).toBe(true)
      expect(announcements.value[0].published_at).toBeTruthy()
    })

    it('エラー時: 例外を投げる', async () => {
      mockFrom.mockReturnValue(buildUpdateEqMock({ error: new Error('切替失敗') }))
      const { togglePublish } = useAnnouncements()
      await expect(togglePublish('ann-001', true)).rejects.toThrow('切替失敗')
    })

    it('存在しない id の場合は announcements を変更しない', async () => {
      mockFrom.mockReturnValue(buildUpdateEqMock({ error: null }))

      const { announcements, togglePublish } = useAnnouncements()
      announcements.value = [makeAnnouncement({ id: 'ann-001', is_published: false })]

      await togglePublish('not-exist', true)

      expect(announcements.value[0].is_published).toBe(false)
    })
  })
})
