import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useSalary } from '@/composables/useSalary'
import type { SalaryRecord } from '@/types'

// ----------------------------------------------------------------
// Supabase モック
// ----------------------------------------------------------------
const { mockFrom, mockGetUser } = vi.hoisted(() => ({
  mockFrom:    vi.fn(),
  mockGetUser: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: mockFrom,
    auth: { getUser: mockGetUser },
  },
}))

// ----------------------------------------------------------------
// テストデータファクトリ
// ----------------------------------------------------------------
const makeRecord = (overrides: Partial<SalaryRecord> = {}): SalaryRecord => ({
  id:           'sal-001',
  employee_id:  'emp-001',
  year:         2026,
  month:        3,
  base_salary:  300000,
  overtime_pay: 20000,
  allowances:   10000,
  deductions:   50000,
  net_salary:   280000, // 300000 + 20000 + 10000 - 50000
  paid_at:      '2026-03-25',
  notes:        null,
  created_by:   'usr-001',
  created_at:   '2026-03-01T00:00:00Z',
  updated_at:   '2026-03-01T00:00:00Z',
  ...overrides,
})

// ----------------------------------------------------------------
// クエリビルダーモック ヘルパー
// ----------------------------------------------------------------

/** SELECT チェーン: from → select → order → order → (任意の eq*) */
function buildSelectMock(
  resolvedValue: { data: SalaryRecord[] | null; error: null | { message: string } }
) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  chain['select'] = vi.fn().mockReturnValue(chain)
  chain['order']  = vi.fn().mockReturnValue(chain)
  chain['eq']     = vi.fn().mockReturnValue(chain)
  // 最後の .order() / .eq() が Promise を返す
  const resolved  = vi.fn().mockResolvedValue(resolvedValue)
  // 最後のチェーンが呼ばれたとき resolved を返す
  chain['order'] = vi.fn().mockImplementation(() => {
    const inner: Record<string, ReturnType<typeof vi.fn>> = {}
    inner['eq']    = vi.fn().mockReturnValue(inner)
    inner['order'] = vi.fn().mockReturnValue(inner)
    // then-able にするため Promise-like にする
    Object.assign(inner, { then: resolved.mockImplementation((fn: (v: unknown) => unknown) => fn(resolvedValue)) })
    return Object.assign(inner, resolved())
  })
  return { chain, resolved }
}

/** INSERT チェーン: from → insert → select → single */
function buildInsertMock(
  resolvedValue: { data: SalaryRecord | null; error: null | { message: string } }
) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  chain['insert'] = vi.fn().mockReturnValue(chain)
  chain['select'] = vi.fn().mockReturnValue(chain)
  chain['single'] = vi.fn().mockResolvedValue(resolvedValue)
  return chain
}

/** UPDATE チェーン: from → update → eq → select → single */
function buildUpdateMock(
  resolvedValue: { data: SalaryRecord | null; error: null | { message: string } }
) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  chain['update'] = vi.fn().mockReturnValue(chain)
  chain['eq']     = vi.fn().mockReturnValue(chain)
  chain['select'] = vi.fn().mockReturnValue(chain)
  chain['single'] = vi.fn().mockResolvedValue(resolvedValue)
  return chain
}

/** SELECT single チェーン: from → select → eq → single */
function buildSingleMock(
  resolvedValue: { data: SalaryRecord | null; error: null | { message: string } }
) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  chain['select'] = vi.fn().mockReturnValue(chain)
  chain['eq']     = vi.fn().mockReturnValue(chain)
  chain['single'] = vi.fn().mockResolvedValue(resolvedValue)
  return chain
}

/** DELETE チェーン: from → delete → eq */
function buildDeleteMock(
  resolvedValue: { error: null | { message: string } }
) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  chain['delete'] = vi.fn().mockReturnValue(chain)
  chain['eq']     = vi.fn().mockResolvedValue(resolvedValue)
  return chain
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ================================================================
describe('useSalary', () => {

  // ----------------------------------------------------------------
  describe('初期状態', () => {
    it('records は空配列', () => {
      const { records } = useSalary()
      expect(records.value).toEqual([])
    })

    it('current は null', () => {
      const { current } = useSalary()
      expect(current.value).toBeNull()
    })

    it('isLoading は false', () => {
      const { isLoading } = useSalary()
      expect(isLoading.value).toBe(false)
    })

    it('error は null', () => {
      const { error } = useSalary()
      expect(error.value).toBeNull()
    })
  })

  // ----------------------------------------------------------------
  describe('fetchRecord（単件取得）', () => {
    it('正常取得: current が更新される', async () => {
      const rec = makeRecord()
      mockFrom.mockReturnValue(buildSingleMock({ data: rec, error: null }))

      const { current, fetchRecord } = useSalary()
      await fetchRecord('sal-001')

      expect(current.value).toEqual(rec)
    })

    it('取得完了後は isLoading が false に戻る', async () => {
      mockFrom.mockReturnValue(buildSingleMock({ data: null, error: null }))

      const { isLoading, fetchRecord } = useSalary()
      await fetchRecord('sal-001')

      expect(isLoading.value).toBe(false)
    })

    it('Supabase エラー時: error にメッセージがセットされる', async () => {
      const chain = buildSingleMock({ data: null, error: null })
      chain['single'] = vi.fn().mockResolvedValue({ data: null, error: { message: '権限エラー' } })
      mockFrom.mockReturnValue(chain)

      const { error, fetchRecord } = useSalary()
      await fetchRecord('sal-001')

      expect(error.value).toBe('権限エラー')
    })

    it('例外スロー時: error にメッセージがセットされる', async () => {
      const chain = buildSingleMock({ data: null, error: null })
      chain['single'] = vi.fn().mockRejectedValue(new Error('ネットワークエラー'))
      mockFrom.mockReturnValue(chain)

      const { error, fetchRecord } = useSalary()
      await fetchRecord('sal-001')

      expect(error.value).toBe('ネットワークエラー')
    })
  })

  // ----------------------------------------------------------------
  describe('createRecord（登録）', () => {
    beforeEach(() => {
      mockGetUser.mockResolvedValue({ data: { user: { id: 'usr-001' } } })
    })

    it('正常登録: 返り値が SalaryRecord になる', async () => {
      const rec = makeRecord()
      mockFrom.mockReturnValue(buildInsertMock({ data: rec, error: null }))

      const { createRecord } = useSalary()
      const result = await createRecord({
        employee_id: 'emp-001', year: 2026, month: 3,
        base_salary: 300000, overtime_pay: 20000,
        allowances: 10000, deductions: 50000,
        paid_at: '2026-03-25', notes: '',
      })

      expect(result).toEqual(rec)
    })

    it('insert に正しい employee_id が渡される', async () => {
      const rec = makeRecord()
      const chain = buildInsertMock({ data: rec, error: null })
      mockFrom.mockReturnValue(chain)

      const { createRecord } = useSalary()
      await createRecord({
        employee_id: 'emp-999', year: 2026, month: 3,
        base_salary: 0, overtime_pay: 0,
        allowances: 0, deductions: 0,
        paid_at: '', notes: '',
      })

      expect(chain['insert']).toHaveBeenCalledWith(
        expect.objectContaining({ employee_id: 'emp-999' })
      )
    })

    it('未認証の場合: null を返し error がセットされる', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } })

      const { createRecord, error } = useSalary()
      const result = await createRecord({
        employee_id: 'emp-001', year: 2026, month: 3,
        base_salary: 0, overtime_pay: 0,
        allowances: 0, deductions: 0,
        paid_at: '', notes: '',
      })

      expect(result).toBeNull()
      expect(error.value).toBe('認証情報がありません')
      expect(mockFrom).not.toHaveBeenCalled()
    })

    it('paid_at が空文字のとき null として insert される', async () => {
      const chain = buildInsertMock({ data: makeRecord(), error: null })
      mockFrom.mockReturnValue(chain)

      const { createRecord } = useSalary()
      await createRecord({
        employee_id: 'emp-001', year: 2026, month: 3,
        base_salary: 0, overtime_pay: 0,
        allowances: 0, deductions: 0,
        paid_at: '', notes: '',
      })

      expect(chain['insert']).toHaveBeenCalledWith(
        expect.objectContaining({ paid_at: null })
      )
    })

    it('Supabase エラー時: null を返し error がセットされる', async () => {
      const chain = buildInsertMock({ data: null, error: null })
      chain['single'] = vi.fn().mockResolvedValue({ data: null, error: { message: '重複キーエラー' } })
      mockFrom.mockReturnValue(chain)

      const { createRecord, error } = useSalary()
      const result = await createRecord({
        employee_id: 'emp-001', year: 2026, month: 3,
        base_salary: 0, overtime_pay: 0,
        allowances: 0, deductions: 0,
        paid_at: '', notes: '',
      })

      expect(result).toBeNull()
      expect(error.value).toBe('重複キーエラー')
    })

    it('登録完了後は isLoading が false に戻る', async () => {
      mockFrom.mockReturnValue(buildInsertMock({ data: makeRecord(), error: null }))

      const { isLoading, createRecord } = useSalary()
      await createRecord({
        employee_id: 'emp-001', year: 2026, month: 3,
        base_salary: 0, overtime_pay: 0,
        allowances: 0, deductions: 0,
        paid_at: '', notes: '',
      })

      expect(isLoading.value).toBe(false)
    })
  })

  // ----------------------------------------------------------------
  describe('updateRecord（更新）', () => {
    it('正常更新: current が更新される', async () => {
      const updated = makeRecord({ base_salary: 350000, net_salary: 330000 })
      const chain = buildUpdateMock({ data: updated, error: null })
      mockFrom.mockReturnValue(chain)

      const { current, updateRecord } = useSalary()
      const result = await updateRecord('sal-001', { base_salary: 350000 })

      expect(result).toEqual(updated)
      expect(current.value).toEqual(updated)
    })

    it('update に正しい id が eq で渡される', async () => {
      const chain = buildUpdateMock({ data: makeRecord(), error: null })
      mockFrom.mockReturnValue(chain)

      const { updateRecord } = useSalary()
      await updateRecord('sal-target', { base_salary: 300000 })

      expect(chain['eq']).toHaveBeenCalledWith('id', 'sal-target')
    })

    it('paid_at が空文字のとき null として update される', async () => {
      const chain = buildUpdateMock({ data: makeRecord(), error: null })
      mockFrom.mockReturnValue(chain)

      const { updateRecord } = useSalary()
      await updateRecord('sal-001', { paid_at: '' })

      expect(chain['update']).toHaveBeenCalledWith(
        expect.objectContaining({ paid_at: null })
      )
    })

    it('Supabase エラー時: null を返し error がセットされる', async () => {
      const chain = buildUpdateMock({ data: null, error: null })
      chain['single'] = vi.fn().mockResolvedValue({ data: null, error: { message: '更新エラー' } })
      mockFrom.mockReturnValue(chain)

      const { updateRecord, error } = useSalary()
      const result = await updateRecord('sal-001', { base_salary: 300000 })

      expect(result).toBeNull()
      expect(error.value).toBe('更新エラー')
    })

    it('更新完了後は isLoading が false に戻る', async () => {
      mockFrom.mockReturnValue(buildUpdateMock({ data: makeRecord(), error: null }))

      const { isLoading, updateRecord } = useSalary()
      await updateRecord('sal-001', { base_salary: 300000 })

      expect(isLoading.value).toBe(false)
    })
  })

  // ----------------------------------------------------------------
  describe('deleteRecord（削除）', () => {
    it('正常削除: records から該当レコードが除去される', async () => {
      mockFrom.mockReturnValue(buildDeleteMock({ error: null }))

      const { records, deleteRecord } = useSalary()
      records.value = [makeRecord({ id: 'sal-001' }), makeRecord({ id: 'sal-002' })]
      const result = await deleteRecord('sal-001')

      expect(result).toBe(true)
      expect(records.value.map(r => r.id)).toEqual(['sal-002'])
    })

    it('delete に正しい id が eq で渡される', async () => {
      const chain = buildDeleteMock({ error: null })
      mockFrom.mockReturnValue(chain)

      const { deleteRecord } = useSalary()
      await deleteRecord('sal-target')

      expect(chain['eq']).toHaveBeenCalledWith('id', 'sal-target')
    })

    it('Supabase エラー時: false を返し error がセットされる', async () => {
      const chain = buildDeleteMock({ error: null })
      chain['eq'] = vi.fn().mockResolvedValue({ error: { message: '削除エラー' } })
      mockFrom.mockReturnValue(chain)

      const { deleteRecord, error } = useSalary()
      const result = await deleteRecord('sal-001')

      expect(result).toBe(false)
      expect(error.value).toBe('削除エラー')
    })

    it('削除完了後は isLoading が false に戻る', async () => {
      mockFrom.mockReturnValue(buildDeleteMock({ error: null }))

      const { isLoading, deleteRecord } = useSalary()
      await deleteRecord('sal-001')

      expect(isLoading.value).toBe(false)
    })
  })
})
