import { describe, it, expect, vi, beforeEach } from 'vitest'
import { usePerformanceReviews } from '@/composables/usePerformanceReviews'
import type { PerformanceReview } from '@/types'

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
const makeReview = (overrides: Partial<PerformanceReview> = {}): PerformanceReview => ({
  id:                 'rev-001',
  employee_id:        'emp-001',
  reviewer_id:        'usr-001',
  review_year:        2026,
  review_type:        'annual',
  review_quarter:     null,
  overall_rating:     3,
  performance_score:  3,
  behavior_score:     3,
  skill_score:        3,
  goals_achievement:  '目標達成',
  strengths:          'チームワーク',
  improvements:       '時間管理',
  next_goals:         'リーダーシップ向上',
  self_comment:       '精一杯取り組みました',
  reviewer_comment:   '良い仕事でした',
  status:             'draft',
  submitted_at:       null,
  acknowledged_at:    null,
  created_by:         'usr-001',
  created_at:         '2026-03-01T00:00:00Z',
  updated_at:         '2026-03-01T00:00:00Z',
  ...overrides,
})

// ----------------------------------------------------------------
// クエリビルダーモック ヘルパー
// ----------------------------------------------------------------

/** LIST チェーン: from → select → order → order */
function buildListMock(
  resolvedValue: { data: PerformanceReview[] | null; error: null | { message: string } }
) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  chain['select'] = vi.fn().mockReturnValue(chain)
  chain['eq']     = vi.fn().mockReturnValue(chain)
  chain['order']  = vi.fn().mockImplementation(() => {
    // 2回目の order が最終チェーン
    const inner: Record<string, ReturnType<typeof vi.fn>> = {}
    inner['order'] = vi.fn().mockResolvedValue(resolvedValue)
    inner['eq']    = vi.fn().mockReturnValue(inner)
    return inner
  })
  return chain
}

/** INSERT チェーン */
function buildInsertMock(
  resolvedValue: { data: PerformanceReview | null; error: null | { message: string } }
) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  chain['insert'] = vi.fn().mockReturnValue(chain)
  chain['select'] = vi.fn().mockReturnValue(chain)
  chain['single'] = vi.fn().mockResolvedValue(resolvedValue)
  return chain
}

/** UPDATE チェーン */
function buildUpdateMock(
  resolvedValue: { data: PerformanceReview | null; error: null | { message: string } }
) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  chain['update'] = vi.fn().mockReturnValue(chain)
  chain['eq']     = vi.fn().mockReturnValue(chain)
  chain['select'] = vi.fn().mockReturnValue(chain)
  chain['single'] = vi.fn().mockResolvedValue(resolvedValue)
  return chain
}

/** UPDATE (changeStatus) チェーン: update → eq (resolves) */
function buildStatusUpdateMock(
  resolvedValue: { error: null | { message: string } }
) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  chain['update'] = vi.fn().mockReturnValue(chain)
  chain['eq']     = vi.fn().mockResolvedValue(resolvedValue)
  return chain
}

/** SELECT single チェーン */
function buildSingleMock(
  resolvedValue: { data: PerformanceReview | null; error: null | { message: string } }
) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  chain['select'] = vi.fn().mockReturnValue(chain)
  chain['eq']     = vi.fn().mockReturnValue(chain)
  chain['single'] = vi.fn().mockResolvedValue(resolvedValue)
  return chain
}

/** DELETE チェーン */
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
describe('usePerformanceReviews', () => {

  // ----------------------------------------------------------------
  describe('初期状態', () => {
    it('reviews は空配列', () => {
      const { reviews } = usePerformanceReviews()
      expect(reviews.value).toEqual([])
    })

    it('current は null', () => {
      const { current } = usePerformanceReviews()
      expect(current.value).toBeNull()
    })

    it('isLoading は false', () => {
      const { isLoading } = usePerformanceReviews()
      expect(isLoading.value).toBe(false)
    })

    it('error は null', () => {
      const { error } = usePerformanceReviews()
      expect(error.value).toBeNull()
    })
  })

  // ----------------------------------------------------------------
  describe('fetchReview（単件取得）', () => {
    it('正常取得: current が更新される', async () => {
      const rev = makeReview()
      mockFrom.mockReturnValue(buildSingleMock({ data: rev, error: null }))

      const { current, fetchReview } = usePerformanceReviews()
      await fetchReview('rev-001')

      expect(current.value).toEqual(rev)
    })

    it('取得完了後は isLoading が false に戻る', async () => {
      mockFrom.mockReturnValue(buildSingleMock({ data: null, error: null }))

      const { isLoading, fetchReview } = usePerformanceReviews()
      await fetchReview('rev-001')

      expect(isLoading.value).toBe(false)
    })

    it('Supabase エラー時: error にメッセージがセットされる', async () => {
      const chain = buildSingleMock({ data: null, error: null })
      chain['single'] = vi.fn().mockResolvedValue({ data: null, error: { message: '権限エラー' } })
      mockFrom.mockReturnValue(chain)

      const { error, fetchReview } = usePerformanceReviews()
      await fetchReview('rev-001')

      expect(error.value).toBe('権限エラー')
    })

    it('例外スロー時: error にメッセージがセットされる', async () => {
      const chain = buildSingleMock({ data: null, error: null })
      chain['single'] = vi.fn().mockRejectedValue(new Error('ネットワークエラー'))
      mockFrom.mockReturnValue(chain)

      const { error, fetchReview } = usePerformanceReviews()
      await fetchReview('rev-001')

      expect(error.value).toBe('ネットワークエラー')
    })
  })

  // ----------------------------------------------------------------
  describe('createReview（登録）', () => {
    beforeEach(() => {
      mockGetUser.mockResolvedValue({ data: { user: { id: 'usr-001' } } })
    })

    it('正常登録: PerformanceReview が返る', async () => {
      const rev = makeReview()
      mockFrom.mockReturnValue(buildInsertMock({ data: rev, error: null }))

      const { createReview } = usePerformanceReviews()
      const result = await createReview({
        employee_id: 'emp-001', review_year: 2026,
        review_type: 'annual', review_quarter: null,
        overall_rating: 3, performance_score: 3,
        behavior_score: 3, skill_score: 3,
        goals_achievement: '', strengths: '',
        improvements: '', next_goals: '',
        self_comment: '', reviewer_comment: '',
      })

      expect(result).toEqual(rev)
    })

    it('insert に reviewer_id として認証ユーザー id が渡される', async () => {
      const rev = makeReview()
      const chain = buildInsertMock({ data: rev, error: null })
      mockFrom.mockReturnValue(chain)

      const { createReview } = usePerformanceReviews()
      await createReview({
        employee_id: 'emp-001', review_year: 2026,
        review_type: 'annual', review_quarter: null,
        overall_rating: 3, performance_score: 3,
        behavior_score: 3, skill_score: 3,
        goals_achievement: '', strengths: '',
        improvements: '', next_goals: '',
        self_comment: '', reviewer_comment: '',
      })

      expect(chain['insert']).toHaveBeenCalledWith(
        expect.objectContaining({ reviewer_id: 'usr-001' })
      )
    })

    it('quarterly でない場合: review_quarter は null として insert される', async () => {
      const chain = buildInsertMock({ data: makeReview(), error: null })
      mockFrom.mockReturnValue(chain)

      const { createReview } = usePerformanceReviews()
      await createReview({
        employee_id: 'emp-001', review_year: 2026,
        review_type: 'annual', review_quarter: 2, // 無視されるべき
        overall_rating: 3, performance_score: 3,
        behavior_score: 3, skill_score: 3,
        goals_achievement: '', strengths: '',
        improvements: '', next_goals: '',
        self_comment: '', reviewer_comment: '',
      })

      expect(chain['insert']).toHaveBeenCalledWith(
        expect.objectContaining({ review_quarter: null })
      )
    })

    it('空文字フィールドは null として insert される', async () => {
      const chain = buildInsertMock({ data: makeReview(), error: null })
      mockFrom.mockReturnValue(chain)

      const { createReview } = usePerformanceReviews()
      await createReview({
        employee_id: 'emp-001', review_year: 2026,
        review_type: 'annual', review_quarter: null,
        overall_rating: 3, performance_score: 3,
        behavior_score: 3, skill_score: 3,
        goals_achievement: '', strengths: '',
        improvements: '', next_goals: '',
        self_comment: '', reviewer_comment: '',
      })

      expect(chain['insert']).toHaveBeenCalledWith(
        expect.objectContaining({
          goals_achievement: null,
          strengths:         null,
          reviewer_comment:  null,
        })
      )
    })

    it('未認証の場合: null を返し error がセットされる', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } })

      const { createReview, error } = usePerformanceReviews()
      const result = await createReview({
        employee_id: 'emp-001', review_year: 2026,
        review_type: 'annual', review_quarter: null,
        overall_rating: 3, performance_score: 3,
        behavior_score: 3, skill_score: 3,
        goals_achievement: '', strengths: '',
        improvements: '', next_goals: '',
        self_comment: '', reviewer_comment: '',
      })

      expect(result).toBeNull()
      expect(error.value).toBe('認証情報がありません')
      expect(mockFrom).not.toHaveBeenCalled()
    })

    it('Supabase エラー時: null を返し error がセットされる', async () => {
      const chain = buildInsertMock({ data: null, error: null })
      chain['single'] = vi.fn().mockResolvedValue({ data: null, error: { message: '重複エラー' } })
      mockFrom.mockReturnValue(chain)

      const { createReview, error } = usePerformanceReviews()
      const result = await createReview({
        employee_id: 'emp-001', review_year: 2026,
        review_type: 'annual', review_quarter: null,
        overall_rating: 3, performance_score: 3,
        behavior_score: 3, skill_score: 3,
        goals_achievement: '', strengths: '',
        improvements: '', next_goals: '',
        self_comment: '', reviewer_comment: '',
      })

      expect(result).toBeNull()
      expect(error.value).toBe('重複エラー')
    })

    it('登録完了後は isLoading が false に戻る', async () => {
      mockFrom.mockReturnValue(buildInsertMock({ data: makeReview(), error: null }))

      const { isLoading, createReview } = usePerformanceReviews()
      await createReview({
        employee_id: 'emp-001', review_year: 2026,
        review_type: 'annual', review_quarter: null,
        overall_rating: 3, performance_score: 3,
        behavior_score: 3, skill_score: 3,
        goals_achievement: '', strengths: '',
        improvements: '', next_goals: '',
        self_comment: '', reviewer_comment: '',
      })

      expect(isLoading.value).toBe(false)
    })
  })

  // ----------------------------------------------------------------
  describe('updateReview（更新）', () => {
    it('正常更新: current が更新される', async () => {
      const updated = makeReview({ overall_rating: 2 })
      mockFrom.mockReturnValue(buildUpdateMock({ data: updated, error: null }))

      const { current, updateReview } = usePerformanceReviews()
      const result = await updateReview('rev-001', { overall_rating: 2 })

      expect(result).toEqual(updated)
      expect(current.value).toEqual(updated)
    })

    it('update に正しい id が eq で渡される', async () => {
      const chain = buildUpdateMock({ data: makeReview(), error: null })
      mockFrom.mockReturnValue(chain)

      const { updateReview } = usePerformanceReviews()
      await updateReview('rev-target', { overall_rating: 4 })

      expect(chain['eq']).toHaveBeenCalledWith('id', 'rev-target')
    })

    it('空文字フィールドは null として update される', async () => {
      const chain = buildUpdateMock({ data: makeReview(), error: null })
      mockFrom.mockReturnValue(chain)

      const { updateReview } = usePerformanceReviews()
      await updateReview('rev-001', { reviewer_comment: '' })

      expect(chain['update']).toHaveBeenCalledWith(
        expect.objectContaining({ reviewer_comment: null })
      )
    })

    it('Supabase エラー時: null を返し error がセットされる', async () => {
      const chain = buildUpdateMock({ data: null, error: null })
      chain['single'] = vi.fn().mockResolvedValue({ data: null, error: { message: '更新エラー' } })
      mockFrom.mockReturnValue(chain)

      const { updateReview, error } = usePerformanceReviews()
      const result = await updateReview('rev-001', { overall_rating: 1 })

      expect(result).toBeNull()
      expect(error.value).toBe('更新エラー')
    })
  })

  // ----------------------------------------------------------------
  describe('changeStatus（ステータス変更）', () => {
    it('draft → submitted: true を返し reviews 内ステータスが更新される', async () => {
      mockFrom.mockReturnValue(buildStatusUpdateMock({ error: null }))

      const { reviews, changeStatus } = usePerformanceReviews()
      reviews.value = [makeReview({ id: 'rev-001', status: 'draft' })]
      const result = await changeStatus('rev-001', 'submitted')

      expect(result).toBe(true)
      expect(reviews.value[0].status).toBe('submitted')
    })

    it('submitted → acknowledged: true を返し reviews 内ステータスが更新される', async () => {
      mockFrom.mockReturnValue(buildStatusUpdateMock({ error: null }))

      const { reviews, changeStatus } = usePerformanceReviews()
      reviews.value = [makeReview({ id: 'rev-001', status: 'submitted' })]
      const result = await changeStatus('rev-001', 'acknowledged')

      expect(result).toBe(true)
      expect(reviews.value[0].status).toBe('acknowledged')
    })

    it('Supabase エラー時: false を返し error がセットされる', async () => {
      const chain = buildStatusUpdateMock({ error: null })
      chain['eq'] = vi.fn().mockResolvedValue({ error: { message: 'ステータスエラー' } })
      mockFrom.mockReturnValue(chain)

      const { changeStatus, error } = usePerformanceReviews()
      const result = await changeStatus('rev-001', 'submitted')

      expect(result).toBe(false)
      expect(error.value).toBe('ステータスエラー')
    })

    it('ステータス変更完了後は isLoading が false に戻る', async () => {
      mockFrom.mockReturnValue(buildStatusUpdateMock({ error: null }))

      const { isLoading, changeStatus } = usePerformanceReviews()
      await changeStatus('rev-001', 'submitted')

      expect(isLoading.value).toBe(false)
    })
  })

  // ----------------------------------------------------------------
  describe('deleteReview（削除）', () => {
    it('正常削除: reviews から該当レコードが除去される', async () => {
      mockFrom.mockReturnValue(buildDeleteMock({ error: null }))

      const { reviews, deleteReview } = usePerformanceReviews()
      reviews.value = [makeReview({ id: 'rev-001' }), makeReview({ id: 'rev-002' })]
      const result = await deleteReview('rev-001')

      expect(result).toBe(true)
      expect(reviews.value.map(r => r.id)).toEqual(['rev-002'])
    })

    it('delete に正しい id が eq で渡される', async () => {
      const chain = buildDeleteMock({ error: null })
      mockFrom.mockReturnValue(chain)

      const { deleteReview } = usePerformanceReviews()
      await deleteReview('rev-target')

      expect(chain['eq']).toHaveBeenCalledWith('id', 'rev-target')
    })

    it('Supabase エラー時: false を返し error がセットされる', async () => {
      const chain = buildDeleteMock({ error: null })
      chain['eq'] = vi.fn().mockResolvedValue({ error: { message: '削除エラー' } })
      mockFrom.mockReturnValue(chain)

      const { deleteReview, error } = usePerformanceReviews()
      const result = await deleteReview('rev-001')

      expect(result).toBe(false)
      expect(error.value).toBe('削除エラー')
    })

    it('削除完了後は isLoading が false に戻る', async () => {
      mockFrom.mockReturnValue(buildDeleteMock({ error: null }))

      const { isLoading, deleteReview } = usePerformanceReviews()
      await deleteReview('rev-001')

      expect(isLoading.value).toBe(false)
    })
  })

  // ----------------------------------------------------------------
  describe('スコア境界値', () => {
    beforeEach(() => {
      mockGetUser.mockResolvedValue({ data: { user: { id: 'usr-001' } } })
    })

    it.each([1, 2, 3, 4, 5])('overall_rating = %i が insert に渡される', async (rating) => {
      const chain = buildInsertMock({ data: makeReview({ overall_rating: rating }), error: null })
      mockFrom.mockReturnValue(chain)

      const { createReview } = usePerformanceReviews()
      await createReview({
        employee_id: 'emp-001', review_year: 2026,
        review_type: 'annual', review_quarter: null,
        overall_rating: rating, performance_score: rating,
        behavior_score: rating, skill_score: rating,
        goals_achievement: '', strengths: '',
        improvements: '', next_goals: '',
        self_comment: '', reviewer_comment: '',
      })

      expect(chain['insert']).toHaveBeenCalledWith(
        expect.objectContaining({ overall_rating: rating })
      )
    })
  })

  // ----------------------------------------------------------------
  describe('quarterly 評価の review_quarter', () => {
    beforeEach(() => {
      mockGetUser.mockResolvedValue({ data: { user: { id: 'usr-001' } } })
    })

    it.each([1, 2, 3, 4])('quarterly・Q%i が insert に渡される', async (quarter) => {
      const chain = buildInsertMock({ data: makeReview({ review_type: 'quarterly', review_quarter: quarter }), error: null })
      mockFrom.mockReturnValue(chain)

      const { createReview } = usePerformanceReviews()
      await createReview({
        employee_id: 'emp-001', review_year: 2026,
        review_type: 'quarterly', review_quarter: quarter,
        overall_rating: 3, performance_score: 3,
        behavior_score: 3, skill_score: 3,
        goals_achievement: '', strengths: '',
        improvements: '', next_goals: '',
        self_comment: '', reviewer_comment: '',
      })

      expect(chain['insert']).toHaveBeenCalledWith(
        expect.objectContaining({ review_quarter: quarter })
      )
    })
  })
})
