import { describe, it, expect, vi, beforeEach } from 'vitest'
import { usePerformance } from '@/composables/usePerformance'
import type { Goal, PerformanceReview, ReviewPeriod } from '@/types'

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
// テスト用ファクトリ関数
// ----------------------------------------------------------------
const makePeriod = (overrides: Partial<ReviewPeriod> = {}): ReviewPeriod => ({
  id:         'period-001',
  name:       '2026年上期',
  start_date: '2026-04-01',
  end_date:   '2026-09-30',
  is_active:  true,
  created_at: '2026-01-01T00:00:00Z',
  ...overrides,
})

const makeGoal = (overrides: Partial<Goal> = {}): Goal => ({
  id:               'goal-001',
  employee_id:      'emp-001',
  review_period_id: 'period-001',
  title:            '売上120%達成',
  description:      '前年比120%の売上目標達成',
  category:         'business',
  target_value:     '120%',
  weight:           60,
  status:           'active',
  created_at:       '2026-04-01T00:00:00Z',
  updated_at:       '2026-04-01T00:00:00Z',
  ...overrides,
})

const makeReview = (overrides: Partial<PerformanceReview> = {}): PerformanceReview => ({
  id:               'review-001',
  employee_id:      'emp-001',
  review_period_id: 'period-001',
  reviewer_id:      null,
  self_score:       null,
  self_comment:     null,
  manager_score:    null,
  manager_comment:  null,
  final_rank:       null,
  status:           'draft',
  completed_at:     null,
  created_at:       '2026-04-01T00:00:00Z',
  updated_at:       '2026-04-01T00:00:00Z',
  ...overrides,
})

// ----------------------------------------------------------------
// クエリチェーンビルダー
// ----------------------------------------------------------------

/** SELECT チェーン: select → order → (Promise) */
function buildSelectOrderMock(resolved: { data: unknown; error: null | { message: string } }) {
  const c: Record<string, ReturnType<typeof vi.fn>> = {}
  c['select'] = vi.fn().mockReturnValue(c)
  c['order']  = vi.fn().mockResolvedValue(resolved)
  return c
}

/** SELECT チェーン with eq: select → eq → order → (Promise) */
function buildSelectEqOrderMock(resolved: { data: unknown; error: null | { message: string } }) {
  const c: Record<string, ReturnType<typeof vi.fn>> = {}
  c['select'] = vi.fn().mockReturnValue(c)
  c['eq']     = vi.fn().mockReturnValue(c)
  c['order']  = vi.fn().mockResolvedValue(resolved)
  return c
}

/** INSERT チェーン: insert → select → single → (Promise) */
function buildInsertMock(resolved: { data: unknown; error: null | { message: string } }) {
  const c: Record<string, ReturnType<typeof vi.fn>> = {}
  c['insert'] = vi.fn().mockReturnValue(c)
  c['select'] = vi.fn().mockReturnValue(c)
  c['single'] = vi.fn().mockResolvedValue(resolved)
  return c
}

/** UPDATE チェーン: update → eq → (Promise) */
function buildUpdateEqMock(resolved: { error: null | { message: string } }) {
  const c: Record<string, ReturnType<typeof vi.fn>> = {}
  c['update'] = vi.fn().mockReturnValue(c)
  c['eq']     = vi.fn().mockResolvedValue(resolved)
  return c
}

/** DELETE チェーン: delete → eq → (Promise) */
function buildDeleteEqMock(resolved: { error: null | { message: string } }) {
  const c: Record<string, ReturnType<typeof vi.fn>> = {}
  c['delete'] = vi.fn().mockReturnValue(c)
  c['eq']     = vi.fn().mockResolvedValue(resolved)
  return c
}

beforeEach(() => vi.clearAllMocks())

// ================================================================
describe('usePerformance', () => {

  // ----------------------------------------------------------------
  describe('初期状態', () => {
    it('goals は空配列', () => {
      const { goals } = usePerformance()
      expect(goals.value).toEqual([])
    })

    it('reviews は空配列', () => {
      const { reviews } = usePerformance()
      expect(reviews.value).toEqual([])
    })

    it('periods は空配列', () => {
      const { periods } = usePerformance()
      expect(periods.value).toEqual([])
    })

    it('loading は false', () => {
      const { loading } = usePerformance()
      expect(loading.value).toBe(false)
    })

    it('error は null', () => {
      const { error } = usePerformance()
      expect(error.value).toBeNull()
    })
  })

  // ----------------------------------------------------------------
  describe('fetchPeriods', () => {
    it('正常取得: periods が更新される', async () => {
      const data = [makePeriod(), makePeriod({ id: 'period-002', name: '2026年下期', is_active: false })]
      mockFrom.mockReturnValue(buildSelectOrderMock({ data, error: null }))

      const { periods, fetchPeriods } = usePerformance()
      await fetchPeriods()

      expect(periods.value).toEqual(data)
    })

    it('取得完了後は loading が false に戻る', async () => {
      mockFrom.mockReturnValue(buildSelectOrderMock({ data: [], error: null }))
      const { loading, fetchPeriods } = usePerformance()
      await fetchPeriods()
      expect(loading.value).toBe(false)
    })

    it('Supabase エラー時: error にメッセージがセットされる', async () => {
      const chain = buildSelectOrderMock({ data: null, error: null })
      chain['order'] = vi.fn().mockRejectedValue(new Error('DB接続失敗'))
      mockFrom.mockReturnValue(chain)

      const { error, fetchPeriods } = usePerformance()
      await fetchPeriods()

      expect(error.value).toBe('DB接続失敗')
    })

    it('data が null のとき periods は空配列になる', async () => {
      mockFrom.mockReturnValue(buildSelectOrderMock({ data: null, error: null }))
      const { periods, fetchPeriods } = usePerformance()
      await fetchPeriods()
      expect(periods.value).toEqual([])
    })
  })

  // ----------------------------------------------------------------
  describe('activePeriod', () => {
    it('is_active=true の期間を返す', async () => {
      const active   = makePeriod({ id: 'p-active', is_active: true })
      const inactive = makePeriod({ id: 'p-inactive', is_active: false })
      mockFrom.mockReturnValue(buildSelectOrderMock({ data: [active, inactive], error: null }))

      const { fetchPeriods, activePeriod } = usePerformance()
      await fetchPeriods()

      expect(activePeriod()?.id).toBe('p-active')
    })

    it('is_active=true がない場合は undefined を返す', async () => {
      mockFrom.mockReturnValue(buildSelectOrderMock({
        data: [makePeriod({ is_active: false })],
        error: null,
      }))

      const { fetchPeriods, activePeriod } = usePerformance()
      await fetchPeriods()

      expect(activePeriod()).toBeUndefined()
    })
  })

  // ----------------------------------------------------------------
  describe('fetchGoals', () => {
    it('employee_id で絞り込んで取得できる', async () => {
      const data = [makeGoal()]
      mockFrom.mockReturnValue(buildSelectEqOrderMock({ data, error: null }))

      const { goals, fetchGoals } = usePerformance()
      await fetchGoals('emp-001')

      expect(goals.value).toEqual(data)
    })

    it('Supabase エラー時: error にメッセージがセットされる', async () => {
      const chain = buildSelectEqOrderMock({ data: null, error: null })
      chain['order'] = vi.fn().mockRejectedValue(new Error('目標取得失敗'))
      mockFrom.mockReturnValue(chain)

      const { error, fetchGoals } = usePerformance()
      await fetchGoals('emp-001')

      expect(error.value).toBe('目標取得失敗')
    })
  })

  // ----------------------------------------------------------------
  describe('createGoal', () => {
    it('正常作成: Goal が返される', async () => {
      const created = makeGoal({ id: 'goal-new' })
      mockFrom.mockReturnValue(buildInsertMock({ data: created, error: null }))

      const { createGoal } = usePerformance()
      const result = await createGoal({
        employee_id:      'emp-001',
        review_period_id: 'period-001',
        title:            '売上120%達成',
        description:      '',
        category:         'business',
        target_value:     '120%',
        weight:           60,
      })

      expect(result).toEqual(created)
    })

    it('Supabase エラー時は例外を投げる', async () => {
      const chain = buildInsertMock({ data: null, error: null })
      chain['single'] = vi.fn().mockResolvedValue({ data: null, error: { message: '登録失敗' } })
      mockFrom.mockReturnValue(chain)

      const { createGoal } = usePerformance()
      await expect(
        createGoal({ employee_id: '', review_period_id: '', title: 'x', description: '', category: 'business', target_value: '', weight: 100 })
      ).rejects.toMatchObject({ message: '登録失敗' })
    })
  })

  // ----------------------------------------------------------------
  describe('updateGoalStatus', () => {
    it('正常更新: 例外が発生しない', async () => {
      mockFrom.mockReturnValue(buildUpdateEqMock({ error: null }))
      const { updateGoalStatus } = usePerformance()
      await expect(updateGoalStatus('goal-001', 'completed')).resolves.toBeUndefined()
    })

    it('Supabase エラー時は例外を投げる', async () => {
      const chain = buildUpdateEqMock({ error: null })
      chain['eq'] = vi.fn().mockResolvedValue({ error: { message: '更新失敗' } })
      mockFrom.mockReturnValue(chain)

      const { updateGoalStatus } = usePerformance()
      await expect(updateGoalStatus('goal-001', 'completed'))
        .rejects.toMatchObject({ message: '更新失敗' })
    })
  })

  // ----------------------------------------------------------------
  describe('deleteGoal', () => {
    it('正常削除: 例外が発生しない', async () => {
      mockFrom.mockReturnValue(buildDeleteEqMock({ error: null }))
      const { deleteGoal } = usePerformance()
      await expect(deleteGoal('goal-001')).resolves.toBeUndefined()
    })

    it('Supabase エラー時は例外を投げる', async () => {
      const chain = buildDeleteEqMock({ error: null })
      chain['eq'] = vi.fn().mockResolvedValue({ error: { message: '削除失敗' } })
      mockFrom.mockReturnValue(chain)

      const { deleteGoal } = usePerformance()
      await expect(deleteGoal('goal-001')).rejects.toMatchObject({ message: '削除失敗' })
    })
  })

  // ----------------------------------------------------------------
  describe('submitSelfReview', () => {
    it('スコアが範囲外（0）のとき例外を投げる', async () => {
      const { submitSelfReview } = usePerformance()
      await expect(submitSelfReview('review-001', { self_score: 0, self_comment: 'コメント' }))
        .rejects.toThrow('自己評価スコアは1〜5で入力してください')
    })

    it('スコアが範囲外（6）のとき例外を投げる', async () => {
      const { submitSelfReview } = usePerformance()
      await expect(submitSelfReview('review-001', { self_score: 6, self_comment: 'コメント' }))
        .rejects.toThrow('自己評価スコアは1〜5で入力してください')
    })

    it('コメントが空のとき例外を投げる', async () => {
      const { submitSelfReview } = usePerformance()
      await expect(submitSelfReview('review-001', { self_score: 3, self_comment: '   ' }))
        .rejects.toThrow('自己評価コメントを入力してください')
    })

    it('正常な入力では Supabase update が呼ばれる', async () => {
      const updateChain = buildUpdateEqMock({ error: null })
      mockFrom.mockReturnValue(updateChain)

      const { submitSelfReview } = usePerformance()
      await submitSelfReview('review-001', { self_score: 4, self_comment: 'よく頑張った' })

      expect(updateChain['update']).toHaveBeenCalledWith(
        expect.objectContaining({ self_score: 4, status: 'manager_review' })
      )
    })
  })

  // ----------------------------------------------------------------
  describe('submitManagerReview', () => {
    it('スコアが範囲外のとき例外を投げる', async () => {
      const { submitManagerReview } = usePerformance()
      await expect(
        submitManagerReview('review-001', 'user-001', { manager_score: 0, manager_comment: 'OK', final_rank: 'B' })
      ).rejects.toThrow('評価スコアは1〜5で入力してください')
    })

    it('コメントが空のとき例外を投げる', async () => {
      const { submitManagerReview } = usePerformance()
      await expect(
        submitManagerReview('review-001', 'user-001', { manager_score: 3, manager_comment: '', final_rank: 'B' })
      ).rejects.toThrow('評価コメントを入力してください')
    })

    it('正常な入力では status が completed になる', async () => {
      const updateChain = buildUpdateEqMock({ error: null })
      mockFrom.mockReturnValue(updateChain)

      const { submitManagerReview } = usePerformance()
      await submitManagerReview('review-001', 'user-001', {
        manager_score: 4,
        manager_comment: '目標超過達成',
        final_rank: 'A',
      })

      expect(updateChain['update']).toHaveBeenCalledWith(
        expect.objectContaining({
          manager_score: 4,
          final_rank:    'A',
          status:        'completed',
        })
      )
    })

    it('Supabase エラー時は例外を投げる', async () => {
      const chain = buildUpdateEqMock({ error: null })
      chain['eq'] = vi.fn().mockResolvedValue({ error: { message: '評価確定失敗' } })
      mockFrom.mockReturnValue(chain)

      const { submitManagerReview } = usePerformance()
      await expect(
        submitManagerReview('review-001', 'user-001', { manager_score: 3, manager_comment: 'OK', final_rank: 'B' })
      ).rejects.toMatchObject({ message: '評価確定失敗' })
    })
  })

  // ----------------------------------------------------------------
  describe('startReview', () => {
    it('正常開始: PerformanceReview が返される', async () => {
      const created = makeReview({ status: 'self_review' })
      mockFrom.mockReturnValue(buildInsertMock({ data: created, error: null }))

      const { startReview } = usePerformance()
      const result = await startReview('emp-001', 'period-001')

      expect(result.status).toBe('self_review')
    })

    it('Supabase エラー時は例外を投げる', async () => {
      const chain = buildInsertMock({ data: null, error: null })
      chain['single'] = vi.fn().mockResolvedValue({ data: null, error: { message: '評価開始失敗' } })
      mockFrom.mockReturnValue(chain)

      const { startReview } = usePerformance()
      await expect(startReview('emp-001', 'period-001'))
        .rejects.toMatchObject({ message: '評価開始失敗' })
    })
  })
})
