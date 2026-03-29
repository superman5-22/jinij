import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useLeaves } from '@/composables/useLeaves'
import type { LeaveRequest } from '@/types'

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
const makeRequest = (overrides: Partial<LeaveRequest> = {}): LeaveRequest => ({
  id:             'lr-001',
  employee_id:    'emp-001',
  leave_type:     'annual',
  start_date:     '2026-04-01',
  end_date:       '2026-04-03',
  days_count:     3,
  reason:         '私用のため',
  status:         'pending',
  reviewed_by:    null,
  reviewed_at:    null,
  review_comment: null,
  created_at:     '2026-03-29T10:00:00Z',
  updated_at:     '2026-03-29T10:00:00Z',
  ...overrides,
})

// ----------------------------------------------------------------
// クエリビルダーモック ヘルパー
// ----------------------------------------------------------------

/**
 * fetchRequests チェーン:
 * from → select → [eq/gte/lte...] → order → Promise({ data, error })
 */
function buildSelectMock(resolvedValue: {
  data: LeaveRequest[] | null
  error: null | { message: string }
}) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  chain['select'] = vi.fn().mockReturnValue(chain)
  chain['eq']     = vi.fn().mockReturnValue(chain)
  chain['gte']    = vi.fn().mockReturnValue(chain)
  chain['lte']    = vi.fn().mockReturnValue(chain)
  chain['order']  = vi.fn().mockResolvedValue(resolvedValue)
  return chain
}

/** submitRequest チェーン: insert → select → single */
function buildInsertMock(resolvedValue: {
  data: LeaveRequest | null
  error: null | { message: string }
}) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  chain['insert'] = vi.fn().mockReturnValue(chain)
  chain['select'] = vi.fn().mockReturnValue(chain)
  chain['single'] = vi.fn().mockResolvedValue(resolvedValue)
  return chain
}

/** approve / reject / cancel チェーン: update → eq → Promise */
function buildUpdateEqMock(resolvedValue: { error: null | { message: string } }) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  chain['update'] = vi.fn().mockReturnValue(chain)
  chain['eq']     = vi.fn().mockResolvedValue(resolvedValue)
  return chain
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ================================================================
describe('useLeaves', () => {
  // ----------------------------------------------------------------
  describe('初期状態', () => {
    it('requests は空配列', () => {
      const { requests } = useLeaves()
      expect(requests.value).toEqual([])
    })

    it('loading は false', () => {
      const { loading } = useLeaves()
      expect(loading.value).toBe(false)
    })

    it('error は null', () => {
      const { error } = useLeaves()
      expect(error.value).toBeNull()
    })

    it('filters の初期値が正しい', () => {
      const { filters } = useLeaves()
      expect(filters.value).toEqual({
        employee_id: '',
        status:      '',
        leave_type:  '',
        date_from:   '',
        date_to:     '',
      })
    })
  })

  // ----------------------------------------------------------------
  describe('fetchRequests', () => {
    it('正常取得: requests が更新される', async () => {
      const mockData = [makeRequest(), makeRequest({ id: 'lr-002' })]
      mockFrom.mockReturnValue(buildSelectMock({ data: mockData, error: null }))

      const { requests, loading, fetchRequests } = useLeaves()
      await fetchRequests()

      expect(requests.value).toEqual(mockData)
      expect(loading.value).toBe(false)
    })

    it('data が null のとき requests は空配列', async () => {
      mockFrom.mockReturnValue(buildSelectMock({ data: null, error: null }))
      const { requests, fetchRequests } = useLeaves()
      await fetchRequests()
      expect(requests.value).toEqual([])
    })

    it('取得完了後は loading が false に戻る', async () => {
      mockFrom.mockReturnValue(buildSelectMock({ data: [], error: null }))
      const { loading, fetchRequests } = useLeaves()
      await fetchRequests()
      expect(loading.value).toBe(false)
    })

    it('Supabase エラーオブジェクト時: フォールバックメッセージがセットされる', async () => {
      // useLeaves は instanceof Error で分岐するため、
      // プレーンオブジェクトのエラーはフォールバック文言になる
      const chain = buildSelectMock({ data: null, error: null })
      chain['order'] = vi.fn().mockResolvedValue({ data: null, error: { message: 'DB Error' } })
      mockFrom.mockReturnValue(chain)

      const { error, fetchRequests } = useLeaves()
      await fetchRequests()

      expect(error.value).toBe('取得に失敗しました')
    })

    it('例外スロー時: error にメッセージがセットされる', async () => {
      const chain = buildSelectMock({ data: null, error: null })
      chain['order'] = vi.fn().mockRejectedValue(new Error('ネットワーク障害'))
      mockFrom.mockReturnValue(chain)

      const { error, fetchRequests } = useLeaves()
      await fetchRequests()

      expect(error.value).toBe('ネットワーク障害')
    })

    it('employee_id フィルタが設定されているとき eq が呼ばれる', async () => {
      const chain = buildSelectMock({ data: [], error: null })
      mockFrom.mockReturnValue(chain)

      const { filters, fetchRequests } = useLeaves()
      filters.value.employee_id = 'emp-001'
      await fetchRequests()

      expect(chain['eq']).toHaveBeenCalledWith('employee_id', 'emp-001')
    })

    it('status フィルタが設定されているとき eq が呼ばれる', async () => {
      const chain = buildSelectMock({ data: [], error: null })
      mockFrom.mockReturnValue(chain)

      const { filters, fetchRequests } = useLeaves()
      filters.value.status = 'pending'
      await fetchRequests()

      expect(chain['eq']).toHaveBeenCalledWith('status', 'pending')
    })

    it('leave_type フィルタが設定されているとき eq が呼ばれる', async () => {
      const chain = buildSelectMock({ data: [], error: null })
      mockFrom.mockReturnValue(chain)

      const { filters, fetchRequests } = useLeaves()
      filters.value.leave_type = 'annual'
      await fetchRequests()

      expect(chain['eq']).toHaveBeenCalledWith('leave_type', 'annual')
    })

    it('date_from フィルタが設定されているとき gte が呼ばれる', async () => {
      const chain = buildSelectMock({ data: [], error: null })
      mockFrom.mockReturnValue(chain)

      const { filters, fetchRequests } = useLeaves()
      filters.value.date_from = '2026-04-01'
      await fetchRequests()

      expect(chain['gte']).toHaveBeenCalledWith('start_date', '2026-04-01')
    })

    it('date_to フィルタが設定されているとき lte が呼ばれる', async () => {
      const chain = buildSelectMock({ data: [], error: null })
      mockFrom.mockReturnValue(chain)

      const { filters, fetchRequests } = useLeaves()
      filters.value.date_to = '2026-04-30'
      await fetchRequests()

      expect(chain['lte']).toHaveBeenCalledWith('end_date', '2026-04-30')
    })

    it('フィルタが全て空のとき eq/gte/lte は呼ばれない', async () => {
      const chain = buildSelectMock({ data: [], error: null })
      mockFrom.mockReturnValue(chain)

      const { fetchRequests } = useLeaves()
      await fetchRequests()

      expect(chain['eq']).not.toHaveBeenCalled()
      expect(chain['gte']).not.toHaveBeenCalled()
      expect(chain['lte']).not.toHaveBeenCalled()
    })
  })

  // ----------------------------------------------------------------
  describe('submitRequest', () => {
    const formBase = {
      employee_id: 'emp-001',
      leave_type:  'annual' as const,
      start_date:  '2026-04-01',
      end_date:    '2026-04-03',
      days_count:  3,
      reason:      '  旅行のため  ',
    }

    it('正常申請: LeaveRequest が返される', async () => {
      const created = makeRequest()
      mockFrom.mockReturnValue(buildInsertMock({ data: created, error: null }))

      const { submitRequest } = useLeaves()
      const result = await submitRequest(formBase)

      expect(result).toEqual(created)
    })

    it('reason が trim されて insert に渡される', async () => {
      const chain = buildInsertMock({ data: makeRequest(), error: null })
      mockFrom.mockReturnValue(chain)

      const { submitRequest } = useLeaves()
      await submitRequest(formBase)

      expect(chain['insert']).toHaveBeenCalledWith(
        expect.objectContaining({ reason: '旅行のため' }),
      )
    })

    it('reason が空白のみのとき null になる', async () => {
      const chain = buildInsertMock({ data: makeRequest(), error: null })
      mockFrom.mockReturnValue(chain)

      const { submitRequest } = useLeaves()
      await submitRequest({ ...formBase, reason: '   ' })

      expect(chain['insert']).toHaveBeenCalledWith(
        expect.objectContaining({ reason: null }),
      )
    })

    it('Supabase エラー時は例外を投げる', async () => {
      const chain = buildInsertMock({ data: null, error: null })
      chain['single'] = vi.fn().mockResolvedValue({ data: null, error: { message: '申請失敗' } })
      mockFrom.mockReturnValue(chain)

      const { submitRequest } = useLeaves()
      await expect(submitRequest(formBase)).rejects.toMatchObject({ message: '申請失敗' })
    })
  })

  // ----------------------------------------------------------------
  describe('approveRequest', () => {
    it('正常承認: 例外が発生しない', async () => {
      mockFrom.mockReturnValue(buildUpdateEqMock({ error: null }))
      const { approveRequest } = useLeaves()
      await expect(approveRequest('lr-001', 'reviewer-001')).resolves.toBeUndefined()
    })

    it('update に status: approved が渡される', async () => {
      const chain = buildUpdateEqMock({ error: null })
      mockFrom.mockReturnValue(chain)

      const { approveRequest } = useLeaves()
      await approveRequest('lr-001', 'reviewer-001')

      expect(chain['update']).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'approved', reviewed_by: 'reviewer-001' }),
      )
    })

    it('comment が渡された場合 review_comment に trim された値が入る', async () => {
      const chain = buildUpdateEqMock({ error: null })
      mockFrom.mockReturnValue(chain)

      const { approveRequest } = useLeaves()
      await approveRequest('lr-001', 'reviewer-001', '  問題なし  ')

      expect(chain['update']).toHaveBeenCalledWith(
        expect.objectContaining({ review_comment: '問題なし' }),
      )
    })

    it('comment が空のとき review_comment は null になる', async () => {
      const chain = buildUpdateEqMock({ error: null })
      mockFrom.mockReturnValue(chain)

      const { approveRequest } = useLeaves()
      await approveRequest('lr-001', 'reviewer-001')

      expect(chain['update']).toHaveBeenCalledWith(
        expect.objectContaining({ review_comment: null }),
      )
    })

    it('eq に正しい id が渡される', async () => {
      const chain = buildUpdateEqMock({ error: null })
      mockFrom.mockReturnValue(chain)

      const { approveRequest } = useLeaves()
      await approveRequest('lr-target', 'reviewer-001')

      expect(chain['eq']).toHaveBeenCalledWith('id', 'lr-target')
    })

    it('Supabase エラー時は例外を投げる', async () => {
      const chain = buildUpdateEqMock({ error: null })
      chain['eq'] = vi.fn().mockResolvedValue({ error: { message: '承認失敗' } })
      mockFrom.mockReturnValue(chain)

      const { approveRequest } = useLeaves()
      await expect(approveRequest('lr-001', 'reviewer-001')).rejects.toMatchObject({ message: '承認失敗' })
    })
  })

  // ----------------------------------------------------------------
  describe('rejectRequest', () => {
    it('正常却下: 例外が発生しない', async () => {
      mockFrom.mockReturnValue(buildUpdateEqMock({ error: null }))
      const { rejectRequest } = useLeaves()
      await expect(rejectRequest('lr-001', 'reviewer-001', '業務上の都合')).resolves.toBeUndefined()
    })

    it('update に status: rejected と review_comment が渡される', async () => {
      const chain = buildUpdateEqMock({ error: null })
      mockFrom.mockReturnValue(chain)

      const { rejectRequest } = useLeaves()
      await rejectRequest('lr-001', 'reviewer-001', '  人員不足  ')

      expect(chain['update']).toHaveBeenCalledWith(
        expect.objectContaining({
          status:         'rejected',
          reviewed_by:    'reviewer-001',
          review_comment: '人員不足',
        }),
      )
    })

    it('comment が空白のみのとき例外を投げる', async () => {
      const { rejectRequest } = useLeaves()
      await expect(rejectRequest('lr-001', 'reviewer-001', '   ')).rejects.toThrow('却下理由を入力してください')
    })

    it('comment が空文字のとき例外を投げる', async () => {
      const { rejectRequest } = useLeaves()
      await expect(rejectRequest('lr-001', 'reviewer-001', '')).rejects.toThrow('却下理由を入力してください')
    })

    it('Supabase エラー時は例外を投げる', async () => {
      const chain = buildUpdateEqMock({ error: null })
      chain['eq'] = vi.fn().mockResolvedValue({ error: { message: '却下失敗' } })
      mockFrom.mockReturnValue(chain)

      const { rejectRequest } = useLeaves()
      await expect(rejectRequest('lr-001', 'reviewer-001', '理由あり')).rejects.toMatchObject({ message: '却下失敗' })
    })
  })

  // ----------------------------------------------------------------
  describe('cancelRequest', () => {
    it('正常キャンセル: 例外が発生しない', async () => {
      mockFrom.mockReturnValue(buildUpdateEqMock({ error: null }))
      const { cancelRequest } = useLeaves()
      await expect(cancelRequest('lr-001')).resolves.toBeUndefined()
    })

    it('update に status: cancelled が渡される', async () => {
      const chain = buildUpdateEqMock({ error: null })
      mockFrom.mockReturnValue(chain)

      const { cancelRequest } = useLeaves()
      await cancelRequest('lr-001')

      expect(chain['update']).toHaveBeenCalledWith({ status: 'cancelled' })
    })

    it('eq に正しい id が渡される', async () => {
      const chain = buildUpdateEqMock({ error: null })
      mockFrom.mockReturnValue(chain)

      const { cancelRequest } = useLeaves()
      await cancelRequest('lr-target')

      expect(chain['eq']).toHaveBeenCalledWith('id', 'lr-target')
    })

    it('Supabase エラー時は例外を投げる', async () => {
      const chain = buildUpdateEqMock({ error: null })
      chain['eq'] = vi.fn().mockResolvedValue({ error: { message: 'キャンセル失敗' } })
      mockFrom.mockReturnValue(chain)

      const { cancelRequest } = useLeaves()
      await expect(cancelRequest('lr-001')).rejects.toMatchObject({ message: 'キャンセル失敗' })
    })
  })

  // ----------------------------------------------------------------
  describe('applyFilters', () => {
    it('applyFilters を呼ぶと fetchRequests が実行される', async () => {
      const chain = buildSelectMock({ data: [], error: null })
      mockFrom.mockReturnValue(chain)

      const { applyFilters } = useLeaves()
      applyFilters()

      // fetchRequests が非同期で呼ばれることを確認
      await vi.waitUntil(() => chain['order'].mock.calls.length > 0)
      expect(chain['order']).toHaveBeenCalledOnce()
    })
  })
})
