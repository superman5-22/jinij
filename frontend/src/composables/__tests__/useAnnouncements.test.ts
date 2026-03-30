import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useAnnouncements } from '@/composables/useAnnouncements'
import type { Announcement } from '@/types'

// ----------------------------------------------------------------
// Supabase モック
// ----------------------------------------------------------------
const { mockFrom } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: mockFrom,
  },
}))

// ----------------------------------------------------------------
// テスト用データファクトリ
// ----------------------------------------------------------------
const makeAnnouncement = (overrides: Partial<Announcement> = {}): Announcement => ({
  id:           'ann-001',
  title:        '夏季休暇のお知らせ',
  body:         '今年の夏季休暇期間は8月13日〜15日です。',
  category:     'hr',
  is_pinned:    false,
  published_at: '2026-04-01T09:00:00Z',
  expires_at:   null,
  created_by:   'user-001',
  created_at:   '2026-04-01T00:00:00Z',
  updated_at:   '2026-04-01T00:00:00Z',
  is_read:      false,
  author:       { id: 'user-001', full_name: '田中 太郎', email: 'tanaka@example.com' },
  ...overrides,
})

// ----------------------------------------------------------------
// チェーン可能なクエリビルダーモック
// ----------------------------------------------------------------

/** SELECT チェーン（複数条件付き）: from → select → order → order → not → lte → or */
function buildSelectChain(resolvedValue: { data: unknown[] | null; error: null | { message: string } }) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  const end = vi.fn().mockResolvedValue(resolvedValue)
  chain['select'] = vi.fn().mockReturnValue(chain)
  chain['order']  = vi.fn().mockReturnValue(chain)
  chain['not']    = vi.fn().mockReturnValue(chain)
  chain['lte']    = vi.fn().mockReturnValue(chain)
  chain['or']     = vi.fn().mockReturnValue(chain)
  chain['eq']     = vi.fn().mockReturnValue(chain)
  chain['in']     = vi.fn().mockReturnValue(chain)
  chain['ilike']  = vi.fn().mockReturnValue(chain)
  // 最終 Promiseとして機能させるため then/catch を付与
  chain['or'] = vi.fn().mockResolvedValue(resolvedValue)
  chain['lte'] = vi.fn().mockReturnValue(chain)
  chain['order'] = vi.fn().mockReturnValue({
    ...chain,
    order: vi.fn().mockReturnValue({
      ...chain,
      not: vi.fn().mockReturnValue({
        ...chain,
        lte: vi.fn().mockReturnValue({
          ...chain,
          or: end,
        }),
      }),
    }),
  })
  return chain
}

/** INSERT チェーン */
function buildInsertChain(resolvedValue: { data: Announcement | null; error: null | { message: string } }) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  chain['insert'] = vi.fn().mockReturnValue(chain)
  chain['select'] = vi.fn().mockReturnValue(chain)
  chain['single'] = vi.fn().mockResolvedValue(resolvedValue)
  return chain
}

/** UPDATE チェーン */
function buildUpdateChain(resolvedValue: { data: Announcement | null; error: null | { message: string } }) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  chain['update'] = vi.fn().mockReturnValue(chain)
  chain['eq']     = vi.fn().mockReturnValue(chain)
  chain['select'] = vi.fn().mockReturnValue(chain)
  chain['single'] = vi.fn().mockResolvedValue(resolvedValue)
  return chain
}

/** DELETE チェーン */
function buildDeleteChain(resolvedValue: { error: null | { message: string } }) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  chain['delete'] = vi.fn().mockReturnValue(chain)
  chain['eq']     = vi.fn().mockResolvedValue(resolvedValue)
  return chain
}

/** UPSERT チェーン（既読登録用）*/
function buildUpsertChain(resolvedValue: { error: null | { message: string } }) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  chain['upsert'] = vi.fn().mockResolvedValue(resolvedValue)
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
  })

  // ----------------------------------------------------------------
  describe('createAnnouncement', () => {
    it('正常作成: 作成されたお知らせが返される', async () => {
      const created = makeAnnouncement({ id: 'ann-new', title: '社内イベントのお知らせ' })
      mockFrom.mockReturnValue(buildInsertChain({ data: created, error: null }))

      const { createAnnouncement } = useAnnouncements()
      const result = await createAnnouncement({
        title:        '社内イベントのお知らせ',
        body:         '内容',
        category:     'event',
        is_pinned:    false,
        published_at: '2026-04-01T09:00',
        expires_at:   '',
      })

      expect(result.title).toBe('社内イベントのお知らせ')
      expect(result.id).toBe('ann-new')
    })

    it('title が trim される', async () => {
      const created = makeAnnouncement()
      const insertChain = buildInsertChain({ data: created, error: null })
      mockFrom.mockReturnValue(insertChain)

      const { createAnnouncement } = useAnnouncements()
      await createAnnouncement({
        title:        '  タイトル  ',
        body:         '本文',
        category:     'general',
        is_pinned:    false,
        published_at: '',
        expires_at:   '',
      })

      expect(insertChain['insert']).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'タイトル' })
      )
    })

    it('published_at が空文字のとき null になる', async () => {
      const created = makeAnnouncement({ published_at: null })
      const insertChain = buildInsertChain({ data: created, error: null })
      mockFrom.mockReturnValue(insertChain)

      const { createAnnouncement } = useAnnouncements()
      await createAnnouncement({
        title: 'テスト', body: '本文',
        category: 'general', is_pinned: false,
        published_at: '', expires_at: '',
      })

      expect(insertChain['insert']).toHaveBeenCalledWith(
        expect.objectContaining({ published_at: null, expires_at: null })
      )
    })

    it('Supabase エラー時は Error を投げる', async () => {
      const chain = buildInsertChain({ data: null, error: null })
      chain['single'] = vi.fn().mockResolvedValue({ data: null, error: { message: '作成失敗' } })
      mockFrom.mockReturnValue(chain)

      const { createAnnouncement } = useAnnouncements()
      await expect(
        createAnnouncement({ title: 'T', body: 'B', category: 'general', is_pinned: false, published_at: '', expires_at: '' })
      ).rejects.toThrow('作成失敗')
    })

    it('カテゴリが正しく渡される（urgent）', async () => {
      const created = makeAnnouncement({ category: 'urgent' })
      const insertChain = buildInsertChain({ data: created, error: null })
      mockFrom.mockReturnValue(insertChain)

      const { createAnnouncement } = useAnnouncements()
      await createAnnouncement({
        title: '緊急連絡', body: '緊急です',
        category: 'urgent', is_pinned: true,
        published_at: '2026-04-01T00:00', expires_at: '',
      })

      expect(insertChain['insert']).toHaveBeenCalledWith(
        expect.objectContaining({ category: 'urgent', is_pinned: true })
      )
    })
  })

  // ----------------------------------------------------------------
  describe('updateAnnouncement', () => {
    it('正常更新: 更新されたお知らせが返される', async () => {
      const updated = makeAnnouncement({ title: '更新後タイトル' })
      mockFrom.mockReturnValue(buildUpdateChain({ data: updated, error: null }))

      const { updateAnnouncement } = useAnnouncements()
      const result = await updateAnnouncement('ann-001', {
        title: '更新後タイトル', body: '本文',
        category: 'hr', is_pinned: false,
        published_at: '', expires_at: '',
      })

      expect(result.title).toBe('更新後タイトル')
    })

    it('eq に正しい id が渡される', async () => {
      const updated = makeAnnouncement()
      const updateChain = buildUpdateChain({ data: updated, error: null })
      mockFrom.mockReturnValue(updateChain)

      const { updateAnnouncement } = useAnnouncements()
      await updateAnnouncement('ann-target', {
        title: 'T', body: 'B',
        category: 'general', is_pinned: false,
        published_at: '', expires_at: '',
      })

      expect(updateChain['eq']).toHaveBeenCalledWith('id', 'ann-target')
    })

    it('Supabase エラー時は Error を投げる', async () => {
      const chain = buildUpdateChain({ data: null, error: null })
      chain['single'] = vi.fn().mockResolvedValue({ data: null, error: { message: '更新失敗' } })
      mockFrom.mockReturnValue(chain)

      const { updateAnnouncement } = useAnnouncements()
      await expect(
        updateAnnouncement('ann-001', { title: 'T', body: 'B', category: 'general', is_pinned: false, published_at: '', expires_at: '' })
      ).rejects.toThrow('更新失敗')
    })
  })

  // ----------------------------------------------------------------
  describe('deleteAnnouncement', () => {
    it('正常削除: 例外が発生しない', async () => {
      mockFrom.mockReturnValue(buildDeleteChain({ error: null }))

      const { deleteAnnouncement } = useAnnouncements()
      await expect(deleteAnnouncement('ann-001')).resolves.toBeUndefined()
    })

    it('eq に正しい id が渡される', async () => {
      const deleteChain = buildDeleteChain({ error: null })
      mockFrom.mockReturnValue(deleteChain)

      const { deleteAnnouncement } = useAnnouncements()
      await deleteAnnouncement('ann-target')

      expect(deleteChain['eq']).toHaveBeenCalledWith('id', 'ann-target')
    })

    it('Supabase エラー時は Error を投げる', async () => {
      const chain = buildDeleteChain({ error: null })
      chain['eq'] = vi.fn().mockResolvedValue({ error: { message: '削除失敗' } })
      mockFrom.mockReturnValue(chain)

      const { deleteAnnouncement } = useAnnouncements()
      await expect(deleteAnnouncement('ann-001')).rejects.toThrow('削除失敗')
    })
  })

  // ----------------------------------------------------------------
  describe('markAsRead', () => {
    it('既読登録が呼ばれ、is_read が true に更新される', async () => {
      const ann = makeAnnouncement({ is_read: false })
      const upsertChain = buildUpsertChain({ error: null })
      mockFrom.mockReturnValue(upsertChain)

      const { announcements, markAsRead } = useAnnouncements()
      announcements.value = [ann]
      await markAsRead('ann-001')

      expect(upsertChain['upsert']).toHaveBeenCalledWith(
        expect.objectContaining({ announcement_id: 'ann-001' })
      )
      expect(announcements.value[0].is_read).toBe(true)
    })

    it('Supabase エラー時は Error を投げる', async () => {
      const chain = buildUpsertChain({ error: null })
      chain['upsert'] = vi.fn().mockResolvedValue({ error: { message: '既読失敗' } })
      mockFrom.mockReturnValue(chain)

      const { markAsRead } = useAnnouncements()
      await expect(markAsRead('ann-001')).rejects.toBeTruthy()
    })
  })
})
