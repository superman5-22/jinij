import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useDepartments } from '@/composables/useDepartments'
import type { Department } from '@/types'

// ----------------------------------------------------------------
// Supabase モック（vi.hoisted でホイスティング前に変数を確保）
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
// テスト用データ
// ----------------------------------------------------------------
const makeDept = (overrides: Partial<Department> = {}): Department => ({
  id:          'd-001',
  name:        '開発部',
  code:        'DEV',
  description: 'ソフトウェア開発',
  created_at:  '2026-01-01T00:00:00Z',
  ...overrides,
})

// ----------------------------------------------------------------
// チェーン可能なクエリビルダーモック
// ----------------------------------------------------------------

/** SELECT チェーン: from → select → order（最終が Promise） */
function buildSelectMock(resolvedValue: { data: Department[] | null; error: null | { message: string } }) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  chain['select'] = vi.fn().mockReturnValue(chain)
  chain['order']  = vi.fn().mockResolvedValue(resolvedValue)
  return chain
}

/** INSERT チェーン: from → insert → select → single（最終が Promise） */
function buildInsertMock(resolvedValue: { data: Department | null; error: null | { message: string } }) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  chain['insert'] = vi.fn().mockReturnValue(chain)
  chain['select'] = vi.fn().mockReturnValue(chain)
  chain['single'] = vi.fn().mockResolvedValue(resolvedValue)
  return chain
}

/** UPDATE チェーン: from → update → eq → select → single（最終が Promise） */
function buildUpdateMock(resolvedValue: { data: Department | null; error: null | { message: string } }) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  chain['update'] = vi.fn().mockReturnValue(chain)
  chain['eq']     = vi.fn().mockReturnValue(chain)
  chain['select'] = vi.fn().mockReturnValue(chain)
  chain['single'] = vi.fn().mockResolvedValue(resolvedValue)
  return chain
}

/** DELETE チェーン: from → delete → eq（最終が Promise） */
function buildDeleteMock(resolvedValue: { error: null | { message: string } }) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  chain['delete'] = vi.fn().mockReturnValue(chain)
  chain['eq']     = vi.fn().mockResolvedValue(resolvedValue)
  return chain
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ================================================================
describe('useDepartments', () => {
  // ----------------------------------------------------------------
  describe('初期状態', () => {
    it('departments は空配列', () => {
      const { departments } = useDepartments()
      expect(departments.value).toEqual([])
    })

    it('loading は false', () => {
      const { loading } = useDepartments()
      expect(loading.value).toBe(false)
    })

    it('error は null', () => {
      const { error } = useDepartments()
      expect(error.value).toBeNull()
    })
  })

  // ----------------------------------------------------------------
  describe('fetchDepartments', () => {
    it('正常取得: departments が更新される', async () => {
      const mockData = [makeDept({ id: 'd-001' }), makeDept({ id: 'd-002', name: '営業部' })]
      mockFrom.mockReturnValue(buildSelectMock({ data: mockData, error: null }))

      const { departments, loading, fetchDepartments } = useDepartments()
      await fetchDepartments()

      expect(departments.value).toEqual(mockData)
      expect(loading.value).toBe(false)
    })

    it('取得完了後は loading が false に戻る', async () => {
      mockFrom.mockReturnValue(buildSelectMock({ data: [], error: null }))
      const { loading, fetchDepartments } = useDepartments()
      await fetchDepartments()
      expect(loading.value).toBe(false)
    })

    it('Supabase エラー時: error にメッセージがセットされる', async () => {
      const chain = buildSelectMock({ data: null, error: null })
      chain['order'] = vi.fn().mockRejectedValue(new Error('DB接続失敗'))
      mockFrom.mockReturnValue(chain)

      const { error, fetchDepartments } = useDepartments()
      await fetchDepartments()

      expect(error.value).toBe('DB接続失敗')
    })

    it('Supabase エラーオブジェクト時: error にメッセージがセットされる', async () => {
      const chain = buildSelectMock({ data: null, error: null })
      chain['order'] = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'テーブルなし' },
      })
      mockFrom.mockReturnValue(chain)

      const { error, fetchDepartments } = useDepartments()
      await fetchDepartments()

      expect(error.value).toBe('テーブルなし')
    })

    it('data が null のとき departments は空配列になる', async () => {
      mockFrom.mockReturnValue(buildSelectMock({ data: null, error: null }))
      const { departments, fetchDepartments } = useDepartments()
      await fetchDepartments()
      expect(departments.value).toEqual([])
    })
  })

  // ----------------------------------------------------------------
  describe('createDepartment', () => {
    it('正常作成: 新しい部署が返される', async () => {
      const created = makeDept({ id: 'd-new' })
      mockFrom.mockReturnValue(buildInsertMock({ data: created, error: null }))

      const { createDepartment } = useDepartments()
      const result = await createDepartment({ name: '開発部', code: 'DEV', description: '' })

      expect(result).toEqual(created)
    })

    it('sanitize: name が trim される', async () => {
      const created = makeDept()
      const insertChain = buildInsertMock({ data: created, error: null })
      mockFrom.mockReturnValue(insertChain)

      const { createDepartment } = useDepartments()
      await createDepartment({ name: '  開発部  ', code: 'DEV', description: '' })

      expect(insertChain['insert']).toHaveBeenCalledWith(
        expect.objectContaining({ name: '開発部' })
      )
    })

    it('sanitize: code が空のとき null になる', async () => {
      const created = makeDept()
      const insertChain = buildInsertMock({ data: created, error: null })
      mockFrom.mockReturnValue(insertChain)

      const { createDepartment } = useDepartments()
      await createDepartment({ name: '開発部', code: '  ', description: '' })

      expect(insertChain['insert']).toHaveBeenCalledWith(
        expect.objectContaining({ code: null })
      )
    })

    it('sanitize: description が空のとき null になる', async () => {
      const created = makeDept()
      const insertChain = buildInsertMock({ data: created, error: null })
      mockFrom.mockReturnValue(insertChain)

      const { createDepartment } = useDepartments()
      await createDepartment({ name: '開発部', code: 'DEV', description: '  ' })

      expect(insertChain['insert']).toHaveBeenCalledWith(
        expect.objectContaining({ description: null })
      )
    })

    it('Supabase エラー時は例外を投げる', async () => {
      const chain = buildInsertMock({ data: null, error: null })
      chain['single'] = vi.fn().mockResolvedValue({ data: null, error: { message: '登録失敗' } })
      mockFrom.mockReturnValue(chain)

      const { createDepartment } = useDepartments()
      await expect(createDepartment({ name: '開発部', code: '', description: '' }))
        .rejects.toMatchObject({ message: '登録失敗' })
    })
  })

  // ----------------------------------------------------------------
  describe('updateDepartment', () => {
    it('正常更新: 更新された部署が返される', async () => {
      const updated = makeDept({ name: '新開発部' })
      mockFrom.mockReturnValue(buildUpdateMock({ data: updated, error: null }))

      const { updateDepartment } = useDepartments()
      const result = await updateDepartment('d-001', { name: '新開発部', code: 'DEV', description: '' })

      expect(result).toEqual(updated)
    })

    it('eq に正しい id が渡される', async () => {
      const updated = makeDept()
      const updateChain = buildUpdateMock({ data: updated, error: null })
      mockFrom.mockReturnValue(updateChain)

      const { updateDepartment } = useDepartments()
      await updateDepartment('d-target', { name: '開発部', code: 'DEV', description: '' })

      expect(updateChain['eq']).toHaveBeenCalledWith('id', 'd-target')
    })

    it('Supabase エラー時は例外を投げる', async () => {
      const chain = buildUpdateMock({ data: null, error: null })
      chain['single'] = vi.fn().mockResolvedValue({ data: null, error: { message: '更新失敗' } })
      mockFrom.mockReturnValue(chain)

      const { updateDepartment } = useDepartments()
      await expect(updateDepartment('d-001', { name: '', code: '', description: '' }))
        .rejects.toMatchObject({ message: '更新失敗' })
    })
  })

  // ----------------------------------------------------------------
  describe('deleteDepartment', () => {
    it('正常削除: 例外が発生しない', async () => {
      mockFrom.mockReturnValue(buildDeleteMock({ error: null }))

      const { deleteDepartment } = useDepartments()
      await expect(deleteDepartment('d-001')).resolves.toBeUndefined()
    })

    it('eq に正しい id が渡される', async () => {
      const deleteChain = buildDeleteMock({ error: null })
      mockFrom.mockReturnValue(deleteChain)

      const { deleteDepartment } = useDepartments()
      await deleteDepartment('d-target')

      expect(deleteChain['eq']).toHaveBeenCalledWith('id', 'd-target')
    })

    it('Supabase エラー時は例外を投げる', async () => {
      const chain = buildDeleteMock({ error: null })
      chain['eq'] = vi.fn().mockResolvedValue({ error: { message: '削除失敗' } })
      mockFrom.mockReturnValue(chain)

      const { deleteDepartment } = useDepartments()
      await expect(deleteDepartment('d-001')).rejects.toMatchObject({ message: '削除失敗' })
    })
  })
})
