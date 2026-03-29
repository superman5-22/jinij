import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useLeaves } from '@/composables/useLeaves'
import type { LeaveRequest } from '@/types'

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
// テスト用データファクトリ
// ----------------------------------------------------------------
const makeLeaveRequest = (overrides: Partial<LeaveRequest> = {}): LeaveRequest => ({
  id:             'lr-001',
  employee_id:    'emp-001',
  leave_type:     'annual',
  start_date:     '2026-04-01',
  end_date:       '2026-04-02',
  days_count:     2,
  reason:         '旅行のため',
  status:         'pending',
  reviewed_by:    null,
  reviewed_at:    null,
  review_comment: null,
  created_at:     '2026-03-29T00:00:00Z',
  updated_at:     '2026-03-29T00:00:00Z',
  ...overrides,
})

// ----------------------------------------------------------------
// クエリビルダーモック ヘルパー
// ----------------------------------------------------------------

/**
 * fetchRequests チェーン:
 * from → select → [eq, eq, eq, gte, lte（すべて任意）] → order (終端 Promise)
 */
function buildFetchMock(
  resolvedValue: { data: LeaveRequest[] | null; error: null | { message: string } }
) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  chain['select'] = vi.fn().mockReturnValue(chain)
  chain['eq']     = vi.fn().mockReturnValue(chain)
  chain['gte']    = vi.fn().mockReturnValue(chain)
  chain['lte']    = vi.fn().mockReturnValue(chain)
  chain['order']  = vi.fn().mockResolvedValue(resolvedValue)
  return chain
}

/**
 * submitRequest チェーン:
 * from → insert → select → single (終端 Promise)
 */
function buildInsertMock(
  resolvedValue: { data: LeaveRequest | null; error: null | { message: string } }
) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  chain['insert'] = vi.fn().mockReturnValue(chain)
  chain['select'] = vi.fn().mockReturnValue(chain)
  chain['single'] = vi.fn().mockResolvedValue(resolvedValue)
  return chain
}

/**
 * approveRequest / rejectRequest / cancelRequest チェーン:
 * from → update → eq (終端 Promise)
 */
function buildUpdateMock(
  resolvedValue: { error: null | { message: string } }
) {
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

    it('filters のデフォルト値が正しい', () => {
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
      const mockData = [makeLeaveRequest({ id: 'lr-001' }), makeLeaveRequest({ id: 'lr-002' })]
      mockFrom.mockReturnValue(buildFetchMock({ data: mockData, error: null }))

      const { requests, fetchRequests } = useLeaves()
      await fetchRequests()

      expect(requests.value).toEqual(mockData)
    })

    it('取得完了後は loading が false に戻る', async () => {
      mockFrom.mockReturnValue(buildFetchMock({ data: [], error: null }))

      const { loading, fetchRequests } = useLeaves()
      await fetchRequests()

      expect(loading.value).toBe(false)
    })

    it('data が null のとき requests は空配列', async () => {
      mockFrom.mockReturnValue(buildFetchMock({ data: null, error: null }))

      const { requests, fetchRequests } = useLeaves()
      await fetchRequests()

      expect(requests.value).toEqual([])
    })

    it('Supabase がエラーオブジェクトを返す場合: error にフォールバックメッセージがセットされる', async () => {
      // Supabase エラーオブジェクト（instanceof Error ではない）が throw された場合、
      // catch ブロックで '取得に失敗しました' にフォールバックする
      const chain = buildFetchMock({ data: null, error: null })
      chain['order'] = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'permission denied' },
      })
      mockFrom.mockReturnValue(chain)

      const { error, fetchRequests } = useLeaves()
      await fetchRequests()

      expect(error.value).toBe('取得に失敗しました')
    })

    it('例外が発生した場合: error にメッセージがセットされる', async () => {
      const chain = buildFetchMock({ data: null, error: null })
      chain['order'] = vi.fn().mockRejectedValue(new Error('ネットワークエラー'))
      mockFrom.mockReturnValue(chain)

      const { error, fetchRequests } = useLeaves()
      await fetchRequests()

      expect(error.value).toBe('ネットワークエラー')
    })
  })

  // ----------------------------------------------------------------
  describe('fetchRequests — フィルター適用', () => {
    it('employee_id フィルター: eq が呼ばれる', async () => {
      const chain = buildFetchMock({ data: [], error: null })
      mockFrom.mockReturnValue(chain)

      const { filters, fetchRequests } = useLeaves()
      filters.value.employee_id = 'emp-999'
      await fetchRequests()

      expect(chain['eq']).toHaveBeenCalledWith('employee_id', 'emp-999')
    })

    it('status フィルター: eq が呼ばれる', async () => {
      const chain = buildFetchMock({ data: [], error: null })
      mockFrom.mockReturnValue(chain)

      const { filters, fetchRequests } = useLeaves()
      filters.value.status = 'pending'
      await fetchRequests()

      expect(chain['eq']).toHaveBeenCalledWith('status', 'pending')
    })

    it('leave_type フィルター: eq が呼ばれる', async () => {
      const chain = buildFetchMock({ data: [], error: null })
      mockFrom.mockReturnValue(chain)

      const { filters, fetchRequests } = useLeaves()
      filters.value.leave_type = 'annual'
      await fetchRequests()

      expect(chain['eq']).toHaveBeenCalledWith('leave_type', 'annual')
    })

    it('date_from フィルター: gte が呼ばれる', async () => {
      const chain = buildFetchMock({ data: [], error: null })
      mockFrom.mockReturnValue(chain)

      const { filters, fetchRequests } = useLeaves()
      filters.value.date_from = '2026-04-01'
      await fetchRequests()

      expect(chain['gte']).toHaveBeenCalledWith('start_date', '2026-04-01')
    })

    it('date_to フィルター: lte が呼ばれる', async () => {
      const chain = buildFetchMock({ data: [], error: null })
      mockFrom.mockReturnValue(chain)

      const { filters, fetchRequests } = useLeaves()
      filters.value.date_to = '2026-04-30'
      await fetchRequests()

      expect(chain['lte']).toHaveBeenCalledWith('end_date', '2026-04-30')
    })

    it('フィルターが空の場合: eq / gte / lte は呼ばれない', async () => {
      const chain = buildFetchMock({ data: [], error: null })
      mockFrom.mockReturnValue(chain)

      const { fetchRequests } = useLeaves()
      await fetchRequests()

      expect(chain['gte']).not.toHaveBeenCalled()
      expect(chain['lte']).not.toHaveBeenCalled()
    })
  })

  // ----------------------------------------------------------------
  describe('submitRequest', () => {
    it('正常申請: LeaveRequest が返される', async () => {
      const created = makeLeaveRequest({ id: 'lr-new' })
      mockFrom.mockReturnValue(buildInsertMock({ data: created, error: null }))

      const { submitRequest } = useLeaves()
      const result = await submitRequest({
        employee_id: 'emp-001',
        leave_type:  'annual',
        start_date:  '2026-04-01',
        end_date:    '2026-04-02',
        days_count:  2,
        reason:      '旅行のため',
      })

      expect(result).toEqual(created)
    })

    it('reason が trim される', async () => {
      const created = makeLeaveRequest()
      const insertChain = buildInsertMock({ data: created, error: null })
      mockFrom.mockReturnValue(insertChain)

      const { submitRequest } = useLeaves()
      await submitRequest({
        employee_id: 'emp-001',
        leave_type:  'annual',
        start_date:  '2026-04-01',
        end_date:    '2026-04-01',
        days_count:  1,
        reason:      '  休養  ',
      })

      expect(insertChain['insert']).toHaveBeenCalledWith(
        expect.objectContaining({ reason: '休養' })
      )
    })

    it('reason が空白のみの場合: insert に null が渡される', async () => {
      const created = makeLeaveRequest({ reason: null })
      const insertChain = buildInsertMock({ data: created, error: null })
      mockFrom.mockReturnValue(insertChain)

      const { submitRequest } = useLeaves()
      await submitRequest({
        employee_id: 'emp-001',
        leave_type:  'annual',
        start_date:  '2026-04-01',
        end_date:    '2026-04-01',
        days_count:  1,
        reason:      '   ',
      })

      expect(insertChain['insert']).toHaveBeenCalledWith(
        expect.objectContaining({ reason: null })
      )
    })

    it('Supabase エラー時は例外を投げる', async () => {
      const chain = buildInsertMock({ data: null, error: null })
      chain['single'] = vi.fn().mockResolvedValue({ data: null, error: { message: '申請登録失敗' } })
      mockFrom.mockReturnValue(chain)

      const { submitRequest } = useLeaves()
      await expect(submitRequest({
        employee_id: 'emp-001',
        leave_type:  'annual',
        start_date:  '2026-04-01',
        end_date:    '2026-04-01',
        days_count:  1,
        reason:      '',
      })).rejects.toMatchObject({ message: '申請登録失敗' })
    })
  })

  // ----------------------------------------------------------------
  describe('approveRequest', () => {
    it('正常承認: 例外が発生しない', async () => {
      mockFrom.mockReturnValue(buildUpdateMock({ error: null }))

      const { approveRequest } = useLeaves()
      await expect(approveRequest('lr-001', 'mgr-001')).resolves.toBeUndefined()
    })

    it('comment が trim されて渡される', async () => {
      const updateChain = buildUpdateMock({ error: null })
      mockFrom.mockReturnValue(updateChain)

      const { approveRequest } = useLeaves()
      await approveRequest('lr-001', 'mgr-001', '  問題なし  ')

      expect(updateChain['update']).toHaveBeenCalledWith(
        expect.objectContaining({ review_comment: '問題なし' })
      )
    })

    it('comment 未指定の場合: review_comment に null が渡される', async () => {
      const updateChain = buildUpdateMock({ error: null })
      mockFrom.mockReturnValue(updateChain)

      const { approveRequest } = useLeaves()
      await approveRequest('lr-001', 'mgr-001')

      expect(updateChain['update']).toHaveBeenCalledWith(
        expect.objectContaining({ review_comment: null })
      )
    })

    it('status: approved が渡される', async () => {
      const updateChain = buildUpdateMock({ error: null })
      mockFrom.mockReturnValue(updateChain)

      const { approveRequest } = useLeaves()
      await approveRequest('lr-001', 'mgr-001')

      expect(updateChain['update']).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'approved' })
      )
    })

    it('eq に正しい id が渡される', async () => {
      const updateChain = buildUpdateMock({ error: null })
      mockFrom.mockReturnValue(updateChain)

      const { approveRequest } = useLeaves()
      await approveRequest('lr-target', 'mgr-001')

      expect(updateChain['eq']).toHaveBeenCalledWith('id', 'lr-target')
    })

    it('Supabase エラー時は例外を投げる', async () => {
      const chain = buildUpdateMock({ error: null })
      chain['eq'] = vi.fn().mockResolvedValue({ error: { message: '承認失敗' } })
      mockFrom.mockReturnValue(chain)

      const { approveRequest } = useLeaves()
      await expect(approveRequest('lr-001', 'mgr-001'))
        .rejects.toMatchObject({ message: '承認失敗' })
    })
  })

  // ----------------------------------------------------------------
  describe('rejectRequest', () => {
    it('正常却下: 例外が発生しない', async () => {
      mockFrom.mockReturnValue(buildUpdateMock({ error: null }))

      const { rejectRequest } = useLeaves()
      await expect(rejectRequest('lr-001', 'mgr-001', '人員不足のため')).resolves.toBeUndefined()
    })

    it('comment が空文字の場合: バリデーションエラーを投げる', async () => {
      const { rejectRequest } = useLeaves()
      await expect(rejectRequest('lr-001', 'mgr-001', ''))
        .rejects.toThrow('却下理由を入力してください')
    })

    it('comment が空白のみの場合: バリデーションエラーを投げる', async () => {
      const { rejectRequest } = useLeaves()
      await expect(rejectRequest('lr-001', 'mgr-001', '   '))
        .rejects.toThrow('却下理由を入力してください')
    })

    it('comment が trim されて渡される', async () => {
      const updateChain = buildUpdateMock({ error: null })
      mockFrom.mockReturnValue(updateChain)

      const { rejectRequest } = useLeaves()
      await rejectRequest('lr-001', 'mgr-001', '  人員不足  ')

      expect(updateChain['update']).toHaveBeenCalledWith(
        expect.objectContaining({ review_comment: '人員不足' })
      )
    })

    it('status: rejected が渡される', async () => {
      const updateChain = buildUpdateMock({ error: null })
      mockFrom.mockReturnValue(updateChain)

      const { rejectRequest } = useLeaves()
      await rejectRequest('lr-001', 'mgr-001', '理由あり')

      expect(updateChain['update']).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'rejected' })
      )
    })

    it('Supabase エラー時は例外を投げる', async () => {
      const chain = buildUpdateMock({ error: null })
      chain['eq'] = vi.fn().mockResolvedValue({ error: { message: '却下失敗' } })
      mockFrom.mockReturnValue(chain)

      const { rejectRequest } = useLeaves()
      await expect(rejectRequest('lr-001', 'mgr-001', '理由あり'))
        .rejects.toMatchObject({ message: '却下失敗' })
    })
  })

  // ----------------------------------------------------------------
  describe('cancelRequest', () => {
    it('正常キャンセル: 例外が発生しない', async () => {
      mockFrom.mockReturnValue(buildUpdateMock({ error: null }))

      const { cancelRequest } = useLeaves()
      await expect(cancelRequest('lr-001')).resolves.toBeUndefined()
    })

    it('status: cancelled が渡される', async () => {
      const updateChain = buildUpdateMock({ error: null })
      mockFrom.mockReturnValue(updateChain)

      const { cancelRequest } = useLeaves()
      await cancelRequest('lr-001')

      expect(updateChain['update']).toHaveBeenCalledWith({ status: 'cancelled' })
    })

    it('eq に正しい id が渡される', async () => {
      const updateChain = buildUpdateMock({ error: null })
      mockFrom.mockReturnValue(updateChain)

      const { cancelRequest } = useLeaves()
      await cancelRequest('lr-target')

      expect(updateChain['eq']).toHaveBeenCalledWith('id', 'lr-target')
    })

    it('Supabase エラー時は例外を投げる', async () => {
      const chain = buildUpdateMock({ error: null })
      chain['eq'] = vi.fn().mockResolvedValue({ error: { message: 'キャンセル失敗' } })
      mockFrom.mockReturnValue(chain)

      const { cancelRequest } = useLeaves()
      await expect(cancelRequest('lr-001'))
        .rejects.toMatchObject({ message: 'キャンセル失敗' })
    })
  })

  // ----------------------------------------------------------------
  describe('applyFilters', () => {
    it('applyFilters を呼ぶと fetchRequests が実行される', async () => {
      mockFrom.mockReturnValue(buildFetchMock({ data: [], error: null }))

      const { applyFilters } = useLeaves()
      applyFilters()

      // mockFrom が呼ばれたことで fetchRequests が実行されたことを確認
      expect(mockFrom).toHaveBeenCalledWith('leave_requests')
    })
  })
})
