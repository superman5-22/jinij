import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useAnnouncements } from '@/composables/useAnnouncements'
import type { Announcement } from '@/types'

// ----------------------------------------------------------------
// Supabase モック
// ----------------------------------------------------------------
const { mockFrom, mockGetUser } = vi.hoisted(() => ({
  mockFrom:    vi.fn(),
  mockGetUser: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from:    mockFrom,
    auth: { getUser: mockGetUser },
  },
}))

// ----------------------------------------------------------------
// テスト用データファクトリ
// ----------------------------------------------------------------
const makeAnnouncement = (overrides: Partial<Announcement> = {}): Announcement => ({
  id:           'ann-001',
  title:        'テストお知らせ',
  content:      'これはテスト用のお知らせです。',
  category:     'general',
  is_pinned:    false,
  published_at: '2026-01-01T10:00:00Z',
  expires_at:   null,
  created_by:   'user-001',
  created_at:   '2026-01-01T00:00:00Z',
  updated_at:   '2026-01-01T00:00:00Z',
  ...overrides,
})

// ----------------------------------------------------------------
// クエリチェーンビルダー
// ----------------------------------------------------------------

/**
 * SELECT チェーン: select → order × 2 → not (optional) → eq (optional)
 * チェーン自体を thenable にすることで `await query` を正しく解決する
 */
function buildSelectChain(resolved: { data: Announcement[] | null; error: null | { message: string } }) {
  const promise = Promise.resolve(resolved)
  const chain: Record<string, unknown> = {}
  chain['select'] = vi.fn().mockReturnValue(chain)
  chain['order']  = vi.fn().mockReturnValue(chain)
  chain['not']    = vi.fn().mockReturnValue(chain)
  chain['eq']     = vi.fn().mockReturnValue(chain)
  // thenable にする（await chain で resolved が返る）
  chain['then']   = (res: (v: unknown) => void, rej: (e: unknown) => void) => promise.then(res, rej)
  chain['catch']  = (rej: (e: unknown) => void) => promise.catch(rej)
  return chain
}

/** SELECT 単件: from → select → eq → single */
function buildSingleChain(resolved: { data: Announcement | null; error: null | { message: string } }) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  chain['select'] = vi.fn().mockReturnValue(chain)
  chain['eq']     = vi.fn().mockReturnValue(chain)
  chain['single'] = vi.fn().mockResolvedValue(resolved)
  return chain
}

/** INSERT チェーン: from → insert → select → single */
function buildInsertChain(resolved: { data: Announcement | null; error: null | { message: string } }) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  chain['insert'] = vi.fn().mockReturnValue(chain)
  chain['select'] = vi.fn().mockReturnValue(chain)
  chain['single'] = vi.fn().mockResolvedValue(resolved)
  return chain
}

/** UPDATE チェーン: from → update → eq → select → single */
function buildUpdateChain(resolved: { data: Announcement | null; error: null | { message: string } }) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  chain['update'] = vi.fn().mockReturnValue(chain)
  chain['eq']     = vi.fn().mockReturnValue(chain)
  chain['select'] = vi.fn().mockReturnValue(chain)
  chain['single'] = vi.fn().mockResolvedValue(resolved)
  return chain
}

/** DELETE チェーン: from → delete → eq */
function buildDeleteChain(resolved: { error: null | { message: string } }) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  chain['delete'] = vi.fn().mockReturnValue(chain)
  chain['eq']     = vi.fn().mockResolvedValue(resolved)
  return chain
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ================================================================
describe('useAnnouncements', () => {

  // ---------------------------------------------------------------
  describe('初期状態', () => {
    it('announcements は空配列', () => {
      const { announcements } = useAnnouncements()
      expect(announcements.value).toEqual([])
    })

    it('current は null', () => {
      const { current } = useAnnouncements()
      expect(current.value).toBeNull()
    })

    it('isLoading は false', () => {
      const { isLoading } = useAnnouncements()
      expect(isLoading.value).toBe(false)
    })

    it('error は null', () => {
      const { error } = useAnnouncements()
      expect(error.value).toBeNull()
    })
  })

  // ---------------------------------------------------------------
  describe('fetchAnnouncements', () => {
    it('正常取得: announcements が更新される', async () => {
      const mockData = [makeAnnouncement({ id: 'ann-001' }), makeAnnouncement({ id: 'ann-002' })]
      mockFrom.mockReturnValue(buildSelectChain({ data: mockData, error: null }))

      const { announcements, isLoading, fetchAnnouncements } = useAnnouncements()
      await fetchAnnouncements()

      expect(announcements.value).toEqual(mockData)
      expect(isLoading.value).toBe(false)
    })

    it('data が null のとき announcements は空配列', async () => {
      mockFrom.mockReturnValue(buildSelectChain({ data: null, error: null }))

      const { announcements, fetchAnnouncements } = useAnnouncements()
      await fetchAnnouncements()

      expect(announcements.value).toEqual([])
    })

    it('Supabase エラー時: error にメッセージがセットされる', async () => {
      mockFrom.mockReturnValue(
        buildSelectChain({ data: null, error: { message: 'DB接続エラー' } })
      )

      const { error, fetchAnnouncements } = useAnnouncements()
      await fetchAnnouncements()

      expect(error.value).toBe('DB接続エラー')
    })

    it('ネットワーク例外時: error にメッセージがセットされる', async () => {
      const errPromise = Promise.reject(new Error('ネットワーク障害'))
      errPromise.catch(() => {}) // unhandled rejection を抑制
      const chain: Record<string, unknown> = {}
      chain['select'] = vi.fn().mockReturnValue(chain)
      chain['order']  = vi.fn().mockReturnValue(chain)
      chain['not']    = vi.fn().mockReturnValue(chain)
      chain['eq']     = vi.fn().mockReturnValue(chain)
      chain['then']   = (res: (v: unknown) => void, rej: (e: unknown) => void) =>
        errPromise.then(res, rej)
      chain['catch']  = (rej: (e: unknown) => void) => errPromise.catch(rej)
      mockFrom.mockReturnValue(chain)

      const { error, fetchAnnouncements } = useAnnouncements()
      await fetchAnnouncements()

      expect(error.value).toBe('ネットワーク障害')
    })
  })

  // ---------------------------------------------------------------
  describe('fetchAnnouncement (単件)', () => {
    it('正常取得: current が更新される', async () => {
      const mockData = makeAnnouncement({ id: 'ann-001' })
      mockFrom.mockReturnValue(buildSingleChain({ data: mockData, error: null }))

      const { current, fetchAnnouncement } = useAnnouncements()
      await fetchAnnouncement('ann-001')

      expect(current.value).toEqual(mockData)
    })

    it('Supabase エラー時: error にメッセージがセットされる', async () => {
      mockFrom.mockReturnValue(buildSingleChain({ data: null, error: { message: '取得失敗' } }))

      const { error, fetchAnnouncement } = useAnnouncements()
      await fetchAnnouncement('ann-999')

      expect(error.value).toBe('取得失敗')
    })
  })

  // ---------------------------------------------------------------
  describe('createAnnouncement', () => {
    const validForm = {
      title:        'テスト新規お知らせ',
      content:      '内容です。',
      category:     'important' as const,
      is_pinned:    true,
      published_at: '2026-04-01T10:00:00Z',
      expires_at:   '',
    }

    beforeEach(() => {
      mockGetUser.mockResolvedValue({ data: { user: { id: 'user-001' } } })
    })

    it('正常登録: Announcement が返される', async () => {
      const created = makeAnnouncement({ id: 'ann-new', title: validForm.title })
      mockFrom.mockReturnValue(buildInsertChain({ data: created, error: null }))

      const { createAnnouncement } = useAnnouncements()
      const result = await createAnnouncement(validForm)

      expect(result).toEqual(created)
    })

    it('insert に正しいデータが渡される', async () => {
      const created = makeAnnouncement()
      const insertChain = buildInsertChain({ data: created, error: null })
      mockFrom.mockReturnValue(insertChain)

      const { createAnnouncement } = useAnnouncements()
      await createAnnouncement(validForm)

      expect(insertChain['insert']).toHaveBeenCalledWith(
        expect.objectContaining({
          title:     validForm.title,
          content:   validForm.content,
          category:  validForm.category,
          is_pinned: validForm.is_pinned,
        })
      )
    })

    it('published_at が空文字のとき null になる', async () => {
      const created = makeAnnouncement()
      const insertChain = buildInsertChain({ data: created, error: null })
      mockFrom.mockReturnValue(insertChain)

      const { createAnnouncement } = useAnnouncements()
      await createAnnouncement({ ...validForm, published_at: '' })

      expect(insertChain['insert']).toHaveBeenCalledWith(
        expect.objectContaining({ published_at: null })
      )
    })

    it('expires_at が空文字のとき null になる', async () => {
      const created = makeAnnouncement()
      const insertChain = buildInsertChain({ data: created, error: null })
      mockFrom.mockReturnValue(insertChain)

      const { createAnnouncement } = useAnnouncements()
      await createAnnouncement({ ...validForm, expires_at: '' })

      expect(insertChain['insert']).toHaveBeenCalledWith(
        expect.objectContaining({ expires_at: null })
      )
    })

    it('認証情報がない場合は null を返す', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } })

      const { createAnnouncement, error } = useAnnouncements()
      const result = await createAnnouncement(validForm)

      expect(result).toBeNull()
      expect(error.value).toBe('認証情報がありません')
    })

    it('Supabase エラー時: null を返しエラーをセットする', async () => {
      const chain = buildInsertChain({ data: null, error: null })
      chain['single'] = vi.fn().mockResolvedValue({ data: null, error: { message: '登録失敗' } })
      mockFrom.mockReturnValue(chain)

      const { createAnnouncement, error } = useAnnouncements()
      const result = await createAnnouncement(validForm)

      expect(result).toBeNull()
      expect(error.value).toBe('登録失敗')
    })

    it('登録成功時: announcements の先頭に追加される', async () => {
      const existing  = makeAnnouncement({ id: 'ann-old' })
      const created   = makeAnnouncement({ id: 'ann-new' })
      const insertChain = buildInsertChain({ data: created, error: null })
      mockFrom.mockReturnValue(insertChain)

      const { announcements, createAnnouncement } = useAnnouncements()
      announcements.value = [existing]
      await createAnnouncement(validForm)

      expect(announcements.value[0]).toEqual(created)
      expect(announcements.value[1]).toEqual(existing)
    })
  })

  // ---------------------------------------------------------------
  describe('updateAnnouncement', () => {
    it('正常更新: Announcement が返される', async () => {
      const updated = makeAnnouncement({ title: '更新後タイトル' })
      mockFrom.mockReturnValue(buildUpdateChain({ data: updated, error: null }))

      const { updateAnnouncement } = useAnnouncements()
      const result = await updateAnnouncement('ann-001', { title: '更新後タイトル' })

      expect(result).toEqual(updated)
    })

    it('current も更新される', async () => {
      const updated = makeAnnouncement({ title: '更新後' })
      mockFrom.mockReturnValue(buildUpdateChain({ data: updated, error: null }))

      const { current, updateAnnouncement } = useAnnouncements()
      await updateAnnouncement('ann-001', { title: '更新後' })

      expect(current.value).toEqual(updated)
    })

    it('announcements 配列内の対象レコードも更新される', async () => {
      const original = makeAnnouncement({ id: 'ann-001', title: '旧タイトル' })
      const updated  = makeAnnouncement({ id: 'ann-001', title: '新タイトル' })
      mockFrom.mockReturnValue(buildUpdateChain({ data: updated, error: null }))

      const { announcements, updateAnnouncement } = useAnnouncements()
      announcements.value = [original]
      await updateAnnouncement('ann-001', { title: '新タイトル' })

      expect(announcements.value[0].title).toBe('新タイトル')
    })

    it('Supabase エラー時: null を返す', async () => {
      const chain = buildUpdateChain({ data: null, error: null })
      chain['single'] = vi.fn().mockResolvedValue({ data: null, error: { message: '更新失敗' } })
      mockFrom.mockReturnValue(chain)

      const { updateAnnouncement, error } = useAnnouncements()
      const result = await updateAnnouncement('ann-001', { title: '更新' })

      expect(result).toBeNull()
      expect(error.value).toBe('更新失敗')
    })
  })

  // ---------------------------------------------------------------
  describe('deleteAnnouncement', () => {
    it('正常削除: true が返される', async () => {
      mockFrom.mockReturnValue(buildDeleteChain({ error: null }))

      const { deleteAnnouncement } = useAnnouncements()
      const result = await deleteAnnouncement('ann-001')

      expect(result).toBe(true)
    })

    it('削除後: announcements から該当レコードが除去される', async () => {
      mockFrom.mockReturnValue(buildDeleteChain({ error: null }))

      const { announcements, deleteAnnouncement } = useAnnouncements()
      announcements.value = [
        makeAnnouncement({ id: 'ann-001' }),
        makeAnnouncement({ id: 'ann-002' }),
      ]
      await deleteAnnouncement('ann-001')

      expect(announcements.value).toHaveLength(1)
      expect(announcements.value[0].id).toBe('ann-002')
    })

    it('Supabase エラー時: false を返しエラーをセットする', async () => {
      const chain = buildDeleteChain({ error: null })
      chain['eq'] = vi.fn().mockResolvedValue({ error: { message: '削除失敗' } })
      mockFrom.mockReturnValue(chain)

      const { deleteAnnouncement, error } = useAnnouncements()
      const result = await deleteAnnouncement('ann-001')

      expect(result).toBe(false)
      expect(error.value).toBe('削除失敗')
    })
  })

  // ---------------------------------------------------------------
  describe('publishAnnouncement', () => {
    it('publishAnnouncement は published_at に現在時刻をセットする', async () => {
      const updated = makeAnnouncement({ published_at: new Date().toISOString() })
      const updateChain = buildUpdateChain({ data: updated, error: null })
      mockFrom.mockReturnValue(updateChain)

      const { publishAnnouncement } = useAnnouncements()
      const result = await publishAnnouncement('ann-001')

      expect(result).not.toBeNull()
      expect(updateChain['update']).toHaveBeenCalledWith(
        expect.objectContaining({ published_at: expect.any(String) })
      )
    })
  })

  // ---------------------------------------------------------------
  describe('ローディング状態', () => {
    it('fetchAnnouncements 完了後 isLoading は false', async () => {
      mockFrom.mockReturnValue(buildSelectChain({ data: [], error: null }))
      const { isLoading, fetchAnnouncements } = useAnnouncements()
      await fetchAnnouncements()
      expect(isLoading.value).toBe(false)
    })
  })
})
