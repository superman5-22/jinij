import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useOvertimeRequests } from '@/composables/useOvertimeRequests'
import type { OvertimeRequest } from '@/types'

// ----------------------------------------------------------------
// Supabase モック
// ----------------------------------------------------------------
const { mockFrom, mockGetUser } = vi.hoisted(() => ({
  mockFrom:    vi.fn(),
  mockGetUser: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from:  mockFrom,
    auth: { getUser: mockGetUser },
  },
}))

// ----------------------------------------------------------------
// テストデータファクトリ
// ----------------------------------------------------------------
const makeRequest = (overrides: Partial<OvertimeRequest> = {}): OvertimeRequest => ({
  id:             'ot-001',
  employee_id:    'emp-001',
  user_id:        'usr-001',
  work_date:      '2026-03-30',
  planned_end:    '21:00:00',
  actual_end:     null,
  overtime_hours: 2,
  reason:         '期末対応のため',
  status:         'pending',
  reviewed_by:    null,
  reviewed_at:    null,
  review_comment: null,
  created_at:     '2026-03-30T10:00:00Z',
  updated_at:     '2026-03-30T10:00:00Z',
  ...overrides,
})

// ----------------------------------------------------------------
// クエリビルダーモック ヘルパー
// ----------------------------------------------------------------

/** SELECT チェーン (一覧) */
function buildSelectListMock(
  result: { data: OvertimeRequest[] | null; error: null | { message: string } }
) {
  const c: Record<string, ReturnType<typeof vi.fn>> = {}
  c.select = vi.fn().mockReturnValue(c)
  c.eq     = vi.fn().mockReturnValue(c)
  c.gte    = vi.fn().mockReturnValue(c)
  c.lte    = vi.fn().mockReturnValue(c)
  c.order  = vi.fn().mockResolvedValue(result)
  return c
}

/** INSERT チェーン */
function buildInsertMock(
  result: { data: OvertimeRequest | null; error: null | { message: string } }
) {
  const c: Record<string, ReturnType<typeof vi.fn>> = {}
  c.insert = vi.fn().mockReturnValue(c)
  c.select = vi.fn().mockReturnValue(c)
  c.single = vi.fn().mockResolvedValue(result)
  return c
}

/** UPDATE チェーン */
function buildUpdateMock(
  result: { error: null | { message: string } }
) {
  const c: Record<string, ReturnType<typeof vi.fn>> = {}
  c.update = vi.fn().mockReturnValue(c)
  c.eq     = vi.fn().mockResolvedValue(result)
  return c
}

/** UPDATE キャンセル用チェーン */
function buildCancelMock(
  result: { error: null | { message: string } }
) {
  const c: Record<string, ReturnType<typeof vi.fn>> = {}
  c.update = vi.fn().mockReturnValue(c)
  c.eq     = vi.fn().mockResolvedValue(result)
  return c
}

// ----------------------------------------------------------------
beforeEach(() => {
  vi.clearAllMocks()
})

// ================================================================
describe('useOvertimeRequests', () => {

  // --------------------------------------------------------------
  describe('初期状態', () => {
    it('requests は空配列', () => {
      const { requests } = useOvertimeRequests()
      expect(requests.value).toEqual([])
    })

    it('isLoading は false', () => {
      const { isLoading } = useOvertimeRequests()
      expect(isLoading.value).toBe(false)
    })

    it('error は null', () => {
      const { error } = useOvertimeRequests()
      expect(error.value).toBeNull()
    })

    it('filters のデフォルト値が正しい', () => {
      const { filters } = useOvertimeRequests()
      expect(filters.value).toEqual({
        employee_id: '',
        status:      '',
        date_from:   '',
        date_to:     '',
      })
    })
  })

  // --------------------------------------------------------------
  describe('fetchRequests（一覧取得）', () => {
    it('正常取得: requests が更新される', async () => {
      const recs = [makeRequest(), makeRequest({ id: 'ot-002' })]
      mockFrom.mockReturnValue(buildSelectListMock({ data: recs, error: null }))

      const { requests, fetchRequests } = useOvertimeRequests()
      await fetchRequests()

      expect(requests.value).toEqual(recs)
    })

    it('data が null の場合 requests は空配列になる', async () => {
      mockFrom.mockReturnValue(buildSelectListMock({ data: null, error: null }))

      const { requests, fetchRequests } = useOvertimeRequests()
      await fetchRequests()

      expect(requests.value).toEqual([])
    })

    it('取得完了後は isLoading が false に戻る', async () => {
      mockFrom.mockReturnValue(buildSelectListMock({ data: [], error: null }))

      const { isLoading, fetchRequests } = useOvertimeRequests()
      await fetchRequests()

      expect(isLoading.value).toBe(false)
    })

    it('Supabase エラー時: error にメッセージがセットされる', async () => {
      const c = buildSelectListMock({ data: null, error: null })
      c.order = vi.fn().mockResolvedValue({ data: null, error: { message: '権限エラー' } })
      mockFrom.mockReturnValue(c)

      const { error, fetchRequests } = useOvertimeRequests()
      await fetchRequests()

      expect(error.value).toBe('権限エラー')
    })

    it('例外スロー時: error にメッセージがセットされる', async () => {
      const c = buildSelectListMock({ data: null, error: null })
      c.order = vi.fn().mockRejectedValue(new Error('ネットワーク障害'))
      mockFrom.mockReturnValue(c)

      const { error, fetchRequests } = useOvertimeRequests()
      await fetchRequests()

      expect(error.value).toBe('ネットワーク障害')
    })
  })

  // --------------------------------------------------------------
  describe('submitRequest（申請作成）', () => {
    beforeEach(() => {
      mockGetUser.mockResolvedValue({ data: { user: { id: 'usr-001' } } })
    })

    it('正常申請: 返り値が OvertimeRequest になる', async () => {
      const rec = makeRequest()
      mockFrom.mockReturnValue(buildInsertMock({ data: rec, error: null }))

      const { submitRequest } = useOvertimeRequests()
      const result = await submitRequest({
        employee_id: 'emp-001', work_date: '2026-03-30',
        planned_end: '21:00', overtime_hours: 2, reason: '期末対応',
      })

      expect(result).toEqual(rec)
    })

    it('insert に employee_id と user_id が渡される', async () => {
      const chain = buildInsertMock({ data: makeRequest(), error: null })
      mockFrom.mockReturnValue(chain)

      const { submitRequest } = useOvertimeRequests()
      await submitRequest({
        employee_id: 'emp-999', work_date: '2026-03-30',
        planned_end: '21:00', overtime_hours: 2, reason: '緊急対応',
      })

      expect(chain.insert).toHaveBeenCalledWith(
        expect.objectContaining({ employee_id: 'emp-999', user_id: 'usr-001' })
      )
    })

    it('未認証の場合: null を返し error がセットされる', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } })

      const { submitRequest, error } = useOvertimeRequests()
      const result = await submitRequest({
        employee_id: 'emp-001', work_date: '2026-03-30',
        planned_end: '21:00', overtime_hours: 2, reason: '対応',
      })

      expect(result).toBeNull()
      expect(error.value).toBe('認証情報がありません')
    })

    it('Supabase エラー時: null を返し error がセットされる', async () => {
      const chain = buildInsertMock({ data: null, error: null })
      chain.single = vi.fn().mockResolvedValue({ data: null, error: { message: 'DB エラー' } })
      mockFrom.mockReturnValue(chain)

      const { submitRequest, error } = useOvertimeRequests()
      const result = await submitRequest({
        employee_id: 'emp-001', work_date: '2026-03-30',
        planned_end: '21:00', overtime_hours: 2, reason: '対応',
      })

      expect(result).toBeNull()
      expect(error.value).toBe('DB エラー')
    })

    it('申請完了後は isLoading が false に戻る', async () => {
      mockFrom.mockReturnValue(buildInsertMock({ data: makeRequest(), error: null }))

      const { isLoading, submitRequest } = useOvertimeRequests()
      await submitRequest({
        employee_id: 'emp-001', work_date: '2026-03-30',
        planned_end: '21:00', overtime_hours: 2, reason: '対応',
      })

      expect(isLoading.value).toBe(false)
    })
  })

  // --------------------------------------------------------------
  describe('approveRequest（承認）', () => {
    it('正常承認: true を返す', async () => {
      // approve calls update then fetchRequests
      mockFrom
        .mockReturnValueOnce(buildUpdateMock({ error: null }))
        .mockReturnValueOnce(buildSelectListMock({ data: [], error: null }))

      const { approveRequest } = useOvertimeRequests()
      const result = await approveRequest('ot-001', 'mgr-001', '問題なし')

      expect(result).toBe(true)
    })

    it('update に approved ステータスが渡される', async () => {
      const updateChain = buildUpdateMock({ error: null })
      mockFrom
        .mockReturnValueOnce(updateChain)
        .mockReturnValueOnce(buildSelectListMock({ data: [], error: null }))

      const { approveRequest } = useOvertimeRequests()
      await approveRequest('ot-001', 'mgr-001')

      expect(updateChain.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'approved' })
      )
    })

    it('Supabase エラー時: false を返し error がセットされる', async () => {
      const c = buildUpdateMock({ error: null })
      c.eq = vi.fn().mockResolvedValue({ error: { message: '承認エラー' } })
      mockFrom.mockReturnValue(c)

      const { approveRequest, error } = useOvertimeRequests()
      const result = await approveRequest('ot-001', 'mgr-001')

      expect(result).toBe(false)
      expect(error.value).toBe('承認エラー')
    })
  })

  // --------------------------------------------------------------
  describe('rejectRequest（却下）', () => {
    it('コメントなしの場合: false を返し error がセットされる', async () => {
      const { rejectRequest, error } = useOvertimeRequests()
      const result = await rejectRequest('ot-001', 'mgr-001', '')

      expect(result).toBe(false)
      expect(error.value).toBe('却下理由を入力してください')
    })

    it('正常却下: true を返す', async () => {
      mockFrom
        .mockReturnValueOnce(buildUpdateMock({ error: null }))
        .mockReturnValueOnce(buildSelectListMock({ data: [], error: null }))

      const { rejectRequest } = useOvertimeRequests()
      const result = await rejectRequest('ot-001', 'mgr-001', '業務過多のため認められない')

      expect(result).toBe(true)
    })

    it('update に rejected ステータスが渡される', async () => {
      const updateChain = buildUpdateMock({ error: null })
      mockFrom
        .mockReturnValueOnce(updateChain)
        .mockReturnValueOnce(buildSelectListMock({ data: [], error: null }))

      const { rejectRequest } = useOvertimeRequests()
      await rejectRequest('ot-001', 'mgr-001', '却下理由')

      expect(updateChain.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'rejected', review_comment: '却下理由' })
      )
    })
  })

  // --------------------------------------------------------------
  describe('cancelRequest（キャンセル）', () => {
    it('正常キャンセル: requests から該当レコードが除去される', async () => {
      mockFrom.mockReturnValue(buildCancelMock({ error: null }))

      const { requests, cancelRequest } = useOvertimeRequests()
      requests.value = [makeRequest({ id: 'ot-001' }), makeRequest({ id: 'ot-002' })]
      const result = await cancelRequest('ot-001')

      expect(result).toBe(true)
      expect(requests.value.map(r => r.id)).toEqual(['ot-002'])
    })

    it('delete に正しい id が eq で渡される', async () => {
      const chain = buildCancelMock({ error: null })
      mockFrom.mockReturnValue(chain)

      const { cancelRequest } = useOvertimeRequests()
      await cancelRequest('ot-target')

      expect(chain.eq).toHaveBeenCalledWith('id', 'ot-target')
    })

    it('Supabase エラー時: false を返し error がセットされる', async () => {
      const c = buildCancelMock({ error: null })
      c.eq = vi.fn().mockResolvedValue({ error: { message: '削除エラー' } })
      mockFrom.mockReturnValue(c)

      const { cancelRequest, error } = useOvertimeRequests()
      const result = await cancelRequest('ot-001')

      expect(result).toBe(false)
      expect(error.value).toBe('削除エラー')
    })

    it('キャンセル完了後は isLoading が false に戻る', async () => {
      mockFrom.mockReturnValue(buildCancelMock({ error: null }))

      const { isLoading, cancelRequest } = useOvertimeRequests()
      await cancelRequest('ot-001')

      expect(isLoading.value).toBe(false)
    })
  })
})
