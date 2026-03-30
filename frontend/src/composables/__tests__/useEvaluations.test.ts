import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useEvaluations } from '@/composables/useEvaluations'
import type { EvaluationRecord, EvaluationFormData } from '@/types'

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
const makeRecord = (overrides: Partial<EvaluationRecord> = {}): EvaluationRecord => ({
  id:                   'eval-001',
  employee_id:          'emp-001',
  evaluator_id:         'usr-001',
  year:                 2026,
  quarter:              1,
  score_performance:    4,
  score_teamwork:       3,
  score_communication:  4,
  score_leadership:     3,
  score_growth:         4,
  overall_score:        3.6,
  comment:              '非常に積極的な姿勢が見られる',
  status:               'draft',
  created_at:           '2026-01-01T00:00:00Z',
  updated_at:           '2026-01-01T00:00:00Z',
  ...overrides,
})

const makeForm = (overrides: Partial<EvaluationFormData> = {}): EvaluationFormData => ({
  employee_id:          'emp-001',
  year:                 2026,
  quarter:              1,
  score_performance:    4,
  score_teamwork:       3,
  score_communication:  4,
  score_leadership:     3,
  score_growth:         4,
  comment:              'テストコメント',
  status:               'draft',
  ...overrides,
})

// ----------------------------------------------------------------
// クエリビルダーモック ヘルパー
// ----------------------------------------------------------------

/** SELECT 一覧チェーン */
function buildListMock(
  result: { data: EvaluationRecord[] | null; error: null | { message: string } }
) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  chain['select'] = vi.fn().mockReturnValue(chain)
  chain['order']  = vi.fn().mockReturnValue(chain)
  chain['eq']     = vi.fn().mockReturnValue(chain)
  // 最後の eq または order が Promise を返す
  const resolved  = vi.fn().mockResolvedValue(result)
  chain['order']  = vi.fn().mockImplementation(() => {
    const inner: Record<string, ReturnType<typeof vi.fn>> = {}
    inner['eq']     = vi.fn().mockReturnValue(inner)
    inner['order']  = vi.fn().mockReturnValue(inner)
    return Object.assign(inner, resolved())
  })
  return { chain, resolved }
}

/** SELECT single チェーン */
function buildSingleMock(
  result: { data: EvaluationRecord | null; error: null | { message: string } }
) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  chain['select'] = vi.fn().mockReturnValue(chain)
  chain['eq']     = vi.fn().mockReturnValue(chain)
  chain['single'] = vi.fn().mockResolvedValue(result)
  return chain
}

/** INSERT チェーン */
function buildInsertMock(
  result: { data: EvaluationRecord | null; error: null | { message: string } }
) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  chain['insert'] = vi.fn().mockReturnValue(chain)
  chain['select'] = vi.fn().mockReturnValue(chain)
  chain['single'] = vi.fn().mockResolvedValue(result)
  return chain
}

/** UPDATE チェーン */
function buildUpdateMock(
  result: { data: EvaluationRecord | null; error: null | { message: string } }
) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  chain['update'] = vi.fn().mockReturnValue(chain)
  chain['eq']     = vi.fn().mockReturnValue(chain)
  chain['select'] = vi.fn().mockReturnValue(chain)
  chain['single'] = vi.fn().mockResolvedValue(result)
  return chain
}

/** UPDATE ステータス変更チェーン（戻り値なし） */
function buildStatusMock(
  result: { error: null | { message: string } }
) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  chain['update'] = vi.fn().mockReturnValue(chain)
  chain['eq']     = vi.fn().mockResolvedValue(result)
  return chain
}

/** DELETE チェーン */
function buildDeleteMock(
  result: { error: null | { message: string } }
) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  chain['delete'] = vi.fn().mockReturnValue(chain)
  chain['eq']     = vi.fn().mockResolvedValue(result)
  return chain
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ================================================================
describe('useEvaluations', () => {

  // ----------------------------------------------------------------
  describe('初期状態', () => {
    it('records は空配列', () => {
      const { records } = useEvaluations()
      expect(records.value).toEqual([])
    })

    it('current は null', () => {
      const { current } = useEvaluations()
      expect(current.value).toBeNull()
    })

    it('isLoading は false', () => {
      const { isLoading } = useEvaluations()
      expect(isLoading.value).toBe(false)
    })

    it('error は null', () => {
      const { error } = useEvaluations()
      expect(error.value).toBeNull()
    })
  })

  // ----------------------------------------------------------------
  describe('fetchRecord（単件取得）', () => {
    it('正常取得: current が更新される', async () => {
      const rec = makeRecord()
      mockFrom.mockReturnValue(buildSingleMock({ data: rec, error: null }))

      const { current, fetchRecord } = useEvaluations()
      await fetchRecord('eval-001')

      expect(current.value).toEqual(rec)
    })

    it('取得完了後は isLoading が false に戻る', async () => {
      mockFrom.mockReturnValue(buildSingleMock({ data: null, error: null }))

      const { isLoading, fetchRecord } = useEvaluations()
      await fetchRecord('eval-001')

      expect(isLoading.value).toBe(false)
    })

    it('Supabase エラー時: error にメッセージがセットされる', async () => {
      const chain = buildSingleMock({ data: null, error: null })
      chain['single'] = vi.fn().mockResolvedValue({ data: null, error: { message: '権限エラー' } })
      mockFrom.mockReturnValue(chain)

      const { error, fetchRecord } = useEvaluations()
      await fetchRecord('eval-001')

      expect(error.value).toBe('権限エラー')
    })

    it('例外スロー時: error にメッセージがセットされる', async () => {
      const chain = buildSingleMock({ data: null, error: null })
      chain['single'] = vi.fn().mockRejectedValue(new Error('ネットワークエラー'))
      mockFrom.mockReturnValue(chain)

      const { error, fetchRecord } = useEvaluations()
      await fetchRecord('eval-001')

      expect(error.value).toBe('ネットワークエラー')
    })
  })

  // ----------------------------------------------------------------
  describe('createRecord（登録）', () => {
    beforeEach(() => {
      mockGetUser.mockResolvedValue({ data: { user: { id: 'usr-001' } } })
    })

    it('正常登録: 返り値が EvaluationRecord になる', async () => {
      const rec = makeRecord()
      mockFrom.mockReturnValue(buildInsertMock({ data: rec, error: null }))

      const { createRecord } = useEvaluations()
      const result = await createRecord(makeForm())

      expect(result).toEqual(rec)
    })

    it('insert に正しい employee_id が渡される', async () => {
      const chain = buildInsertMock({ data: makeRecord(), error: null })
      mockFrom.mockReturnValue(chain)

      const { createRecord } = useEvaluations()
      await createRecord(makeForm({ employee_id: 'emp-999' }))

      expect(chain['insert']).toHaveBeenCalledWith(
        expect.objectContaining({ employee_id: 'emp-999' })
      )
    })

    it('insert に evaluator_id (auth.uid) が渡される', async () => {
      mockGetUser.mockResolvedValue({ data: { user: { id: 'evaluator-uuid' } } })
      const chain = buildInsertMock({ data: makeRecord(), error: null })
      mockFrom.mockReturnValue(chain)

      const { createRecord } = useEvaluations()
      await createRecord(makeForm())

      expect(chain['insert']).toHaveBeenCalledWith(
        expect.objectContaining({ evaluator_id: 'evaluator-uuid' })
      )
    })

    it('空コメントが null として insert される', async () => {
      const chain = buildInsertMock({ data: makeRecord(), error: null })
      mockFrom.mockReturnValue(chain)

      const { createRecord } = useEvaluations()
      await createRecord(makeForm({ comment: '   ' }))

      expect(chain['insert']).toHaveBeenCalledWith(
        expect.objectContaining({ comment: null })
      )
    })

    it('未認証の場合: null を返し error がセットされる', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } })

      const { createRecord, error } = useEvaluations()
      const result = await createRecord(makeForm())

      expect(result).toBeNull()
      expect(error.value).toBe('認証情報がありません')
      expect(mockFrom).not.toHaveBeenCalled()
    })

    it('Supabase エラー時: null を返し error がセットされる', async () => {
      const chain = buildInsertMock({ data: null, error: null })
      chain['single'] = vi.fn().mockResolvedValue({
        data: null,
        error: { message: '同一期間の評価が既に存在します' },
      })
      mockFrom.mockReturnValue(chain)

      const { createRecord, error } = useEvaluations()
      const result = await createRecord(makeForm())

      expect(result).toBeNull()
      expect(error.value).toBe('同一期間の評価が既に存在します')
    })

    it('登録完了後は isLoading が false に戻る', async () => {
      mockFrom.mockReturnValue(buildInsertMock({ data: makeRecord(), error: null }))

      const { isLoading, createRecord } = useEvaluations()
      await createRecord(makeForm())

      expect(isLoading.value).toBe(false)
    })
  })

  // ----------------------------------------------------------------
  describe('updateRecord（更新）', () => {
    it('正常更新: current が更新される', async () => {
      const updated = makeRecord({ score_performance: 5, overall_score: 3.8 })
      const chain = buildUpdateMock({ data: updated, error: null })
      mockFrom.mockReturnValue(chain)

      const { current, updateRecord } = useEvaluations()
      const result = await updateRecord('eval-001', { score_performance: 5 })

      expect(result).toEqual(updated)
      expect(current.value).toEqual(updated)
    })

    it('update に正しい id が eq で渡される', async () => {
      const chain = buildUpdateMock({ data: makeRecord(), error: null })
      mockFrom.mockReturnValue(chain)

      const { updateRecord } = useEvaluations()
      await updateRecord('eval-target', { score_performance: 5 })

      expect(chain['eq']).toHaveBeenCalledWith('id', 'eval-target')
    })

    it('comment が空文字のとき null として update される', async () => {
      const chain = buildUpdateMock({ data: makeRecord(), error: null })
      mockFrom.mockReturnValue(chain)

      const { updateRecord } = useEvaluations()
      await updateRecord('eval-001', { comment: '' })

      expect(chain['update']).toHaveBeenCalledWith(
        expect.objectContaining({ comment: null })
      )
    })

    it('Supabase エラー時: null を返し error がセットされる', async () => {
      const chain = buildUpdateMock({ data: null, error: null })
      chain['single'] = vi.fn().mockResolvedValue({ data: null, error: { message: '更新エラー' } })
      mockFrom.mockReturnValue(chain)

      const { updateRecord, error } = useEvaluations()
      const result = await updateRecord('eval-001', { score_performance: 5 })

      expect(result).toBeNull()
      expect(error.value).toBe('更新エラー')
    })

    it('更新完了後は isLoading が false に戻る', async () => {
      mockFrom.mockReturnValue(buildUpdateMock({ data: makeRecord(), error: null }))

      const { isLoading, updateRecord } = useEvaluations()
      await updateRecord('eval-001', { score_performance: 5 })

      expect(isLoading.value).toBe(false)
    })
  })

  // ----------------------------------------------------------------
  describe('changeStatus（ステータス変更）', () => {
    it('submitted への変更が成功する', async () => {
      mockFrom.mockReturnValue(buildStatusMock({ error: null }))

      const { changeStatus } = useEvaluations()
      const result = await changeStatus('eval-001', 'submitted')

      expect(result).toBe(true)
    })

    it('finalized への変更が成功する', async () => {
      mockFrom.mockReturnValue(buildStatusMock({ error: null }))

      const { changeStatus } = useEvaluations()
      const result = await changeStatus('eval-001', 'finalized')

      expect(result).toBe(true)
    })

    it('records 内の対象レコードのステータスが更新される', async () => {
      mockFrom.mockReturnValue(buildStatusMock({ error: null }))

      const { records, changeStatus } = useEvaluations()
      records.value = [makeRecord({ id: 'eval-001', status: 'draft' })]

      await changeStatus('eval-001', 'submitted')

      expect(records.value[0].status).toBe('submitted')
    })

    it('Supabase エラー時: false を返し error がセットされる', async () => {
      const chain = buildStatusMock({ error: null })
      chain['eq'] = vi.fn().mockResolvedValue({ error: { message: 'ステータス変更エラー' } })
      mockFrom.mockReturnValue(chain)

      const { changeStatus, error } = useEvaluations()
      const result = await changeStatus('eval-001', 'finalized')

      expect(result).toBe(false)
      expect(error.value).toBe('ステータス変更エラー')
    })

    it('変更完了後は isLoading が false に戻る', async () => {
      mockFrom.mockReturnValue(buildStatusMock({ error: null }))

      const { isLoading, changeStatus } = useEvaluations()
      await changeStatus('eval-001', 'submitted')

      expect(isLoading.value).toBe(false)
    })
  })

  // ----------------------------------------------------------------
  describe('deleteRecord（削除）', () => {
    it('正常削除: records から該当レコードが除去される', async () => {
      mockFrom.mockReturnValue(buildDeleteMock({ error: null }))

      const { records, deleteRecord } = useEvaluations()
      records.value = [
        makeRecord({ id: 'eval-001' }),
        makeRecord({ id: 'eval-002' }),
      ]
      const result = await deleteRecord('eval-001')

      expect(result).toBe(true)
      expect(records.value.map(r => r.id)).toEqual(['eval-002'])
    })

    it('delete に正しい id が eq で渡される', async () => {
      const chain = buildDeleteMock({ error: null })
      mockFrom.mockReturnValue(chain)

      const { deleteRecord } = useEvaluations()
      await deleteRecord('eval-target')

      expect(chain['eq']).toHaveBeenCalledWith('id', 'eval-target')
    })

    it('Supabase エラー時: false を返し error がセットされる', async () => {
      const chain = buildDeleteMock({ error: null })
      chain['eq'] = vi.fn().mockResolvedValue({ error: { message: '削除エラー' } })
      mockFrom.mockReturnValue(chain)

      const { deleteRecord, error } = useEvaluations()
      const result = await deleteRecord('eval-001')

      expect(result).toBe(false)
      expect(error.value).toBe('削除エラー')
    })

    it('削除完了後は isLoading が false に戻る', async () => {
      mockFrom.mockReturnValue(buildDeleteMock({ error: null }))

      const { isLoading, deleteRecord } = useEvaluations()
      await deleteRecord('eval-001')

      expect(isLoading.value).toBe(false)
    })
  })

  // ----------------------------------------------------------------
  describe('境界値テスト', () => {
    beforeEach(() => {
      mockGetUser.mockResolvedValue({ data: { user: { id: 'usr-001' } } })
    })

    it('スコア最小値（1）で登録できる', async () => {
      const chain = buildInsertMock({ data: makeRecord({ score_performance: 1 }), error: null })
      mockFrom.mockReturnValue(chain)

      const { createRecord } = useEvaluations()
      const result = await createRecord(makeForm({
        score_performance: 1,
        score_teamwork: 1,
        score_communication: 1,
        score_leadership: 1,
        score_growth: 1,
      }))

      expect(result).not.toBeNull()
      expect(chain['insert']).toHaveBeenCalledWith(
        expect.objectContaining({ score_performance: 1 })
      )
    })

    it('スコア最大値（5）で登録できる', async () => {
      const chain = buildInsertMock({ data: makeRecord({ score_performance: 5 }), error: null })
      mockFrom.mockReturnValue(chain)

      const { createRecord } = useEvaluations()
      const result = await createRecord(makeForm({
        score_performance: 5,
        score_teamwork: 5,
        score_communication: 5,
        score_leadership: 5,
        score_growth: 5,
      }))

      expect(result).not.toBeNull()
      expect(chain['insert']).toHaveBeenCalledWith(
        expect.objectContaining({ score_performance: 5 })
      )
    })

    it('quarter=1 で登録できる', async () => {
      const chain = buildInsertMock({ data: makeRecord({ quarter: 1 }), error: null })
      mockFrom.mockReturnValue(chain)

      const { createRecord } = useEvaluations()
      await createRecord(makeForm({ quarter: 1 }))

      expect(chain['insert']).toHaveBeenCalledWith(
        expect.objectContaining({ quarter: 1 })
      )
    })

    it('quarter=4 で登録できる', async () => {
      const chain = buildInsertMock({ data: makeRecord({ quarter: 4 }), error: null })
      mockFrom.mockReturnValue(chain)

      const { createRecord } = useEvaluations()
      await createRecord(makeForm({ quarter: 4 }))

      expect(chain['insert']).toHaveBeenCalledWith(
        expect.objectContaining({ quarter: 4 })
      )
    })
  })
})
