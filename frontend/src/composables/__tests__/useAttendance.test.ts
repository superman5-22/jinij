import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useAttendance } from '@/composables/useAttendance'
import type { AttendanceRecord } from '@/types'

// ----------------------------------------------------------------
// Supabase モック（vi.hoisted でホイスティング前に変数を確保）
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
// テスト用データファクトリ
// ----------------------------------------------------------------
const makeRecord = (overrides: Partial<AttendanceRecord> = {}): AttendanceRecord => ({
  id:            'rec-001',
  employee_id:   'emp-001',
  user_id:       'usr-001',
  work_date:     '2026-03-29',
  clock_in:      '2026-03-29T09:00:00Z',
  clock_out:     null,
  break_minutes: 0,
  status:        'present',
  note:          null,
  created_at:    '2026-03-29T09:00:00Z',
  updated_at:    '2026-03-29T09:00:00Z',
  ...overrides,
})

// ----------------------------------------------------------------
// クエリビルダーモック ヘルパー
// ----------------------------------------------------------------

/** SELECT チェーン: from → select → eq → eq → maybeSingle */
function buildMaybeSingleMock(
  resolvedValue: { data: AttendanceRecord | null; error: null | { message: string } }
) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  chain['select']      = vi.fn().mockReturnValue(chain)
  chain['eq']          = vi.fn().mockReturnValue(chain)
  chain['maybeSingle'] = vi.fn().mockResolvedValue(resolvedValue)
  return chain
}

/** SELECT チェーン: from → select → eq → gte → lt → order */
function buildSelectOrderMock(
  resolvedValue: { data: AttendanceRecord[] | null; error: null | { message: string } }
) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  chain['select'] = vi.fn().mockReturnValue(chain)
  chain['eq']     = vi.fn().mockReturnValue(chain)
  chain['gte']    = vi.fn().mockReturnValue(chain)
  chain['lt']     = vi.fn().mockReturnValue(chain)
  chain['order']  = vi.fn().mockResolvedValue(resolvedValue)
  return chain
}

/** INSERT チェーン: from → insert → select → single */
function buildInsertMock(
  resolvedValue: { data: AttendanceRecord | null; error: null | { message: string } }
) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  chain['insert'] = vi.fn().mockReturnValue(chain)
  chain['select'] = vi.fn().mockReturnValue(chain)
  chain['single'] = vi.fn().mockResolvedValue(resolvedValue)
  return chain
}

/** UPDATE チェーン: from → update → eq → select → single */
function buildUpdateMock(
  resolvedValue: { data: AttendanceRecord | null; error: null | { message: string } }
) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  chain['update'] = vi.fn().mockReturnValue(chain)
  chain['eq']     = vi.fn().mockReturnValue(chain)
  chain['select'] = vi.fn().mockReturnValue(chain)
  chain['single'] = vi.fn().mockResolvedValue(resolvedValue)
  return chain
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ================================================================
describe('useAttendance', () => {
  // ----------------------------------------------------------------
  describe('初期状態', () => {
    it('todayRecord は null', () => {
      const { todayRecord } = useAttendance()
      expect(todayRecord.value).toBeNull()
    })

    it('monthlyRecords は空配列', () => {
      const { monthlyRecords } = useAttendance()
      expect(monthlyRecords.value).toEqual([])
    })

    it('isLoading は false', () => {
      const { isLoading } = useAttendance()
      expect(isLoading.value).toBe(false)
    })

    it('error は null', () => {
      const { error } = useAttendance()
      expect(error.value).toBeNull()
    })

    it('isClockedIn は false（todayRecord が null）', () => {
      const { isClockedIn } = useAttendance()
      expect(isClockedIn.value).toBe(false)
    })

    it('isClockedOut は false（todayRecord が null）', () => {
      const { isClockedOut } = useAttendance()
      expect(isClockedOut.value).toBe(false)
    })
  })

  // ----------------------------------------------------------------
  describe('isClockedIn / isClockedOut（computed）', () => {
    it('clock_in のみある場合: isClockedIn=true, isClockedOut=false', () => {
      const { todayRecord, isClockedIn, isClockedOut } = useAttendance()
      todayRecord.value = makeRecord({ clock_in: '2026-03-29T09:00:00Z', clock_out: null })
      expect(isClockedIn.value).toBe(true)
      expect(isClockedOut.value).toBe(false)
    })

    it('clock_in と clock_out 両方ある場合: 両方 true', () => {
      const { todayRecord, isClockedIn, isClockedOut } = useAttendance()
      todayRecord.value = makeRecord({
        clock_in:  '2026-03-29T09:00:00Z',
        clock_out: '2026-03-29T18:00:00Z',
      })
      expect(isClockedIn.value).toBe(true)
      expect(isClockedOut.value).toBe(true)
    })
  })

  // ----------------------------------------------------------------
  describe('totalWorkMinutes（computed）', () => {
    it('clock_in/out が揃っているレコードのみ集計される', () => {
      const { monthlyRecords, totalWorkMinutes } = useAttendance()
      monthlyRecords.value = [
        makeRecord({
          clock_in:      '2026-03-01T09:00:00.000Z',
          clock_out:     '2026-03-01T18:00:00.000Z',
          break_minutes: 60,
        }),
        makeRecord({
          id:        'rec-002',
          work_date: '2026-03-02',
          clock_in:  '2026-03-02T09:00:00.000Z',
          clock_out: null,
        }),
      ]
      // 9時〜18時 = 540分 − 60分 = 480分
      expect(totalWorkMinutes.value).toBe(480)
    })

    it('レコードが空のとき 0 を返す', () => {
      const { totalWorkMinutes } = useAttendance()
      expect(totalWorkMinutes.value).toBe(0)
    })

    it('break_minutes が実働より大きい場合は 0 にクランプされる', () => {
      const { monthlyRecords, totalWorkMinutes } = useAttendance()
      monthlyRecords.value = [
        makeRecord({
          clock_in:      '2026-03-01T09:00:00.000Z',
          clock_out:     '2026-03-01T09:10:00.000Z', // 10分
          break_minutes: 60,                           // 休憩が実働を超える
        }),
      ]
      expect(totalWorkMinutes.value).toBe(0)
    })

    it('複数レコードの合計が正しく計算される', () => {
      const { monthlyRecords, totalWorkMinutes } = useAttendance()
      monthlyRecords.value = [
        makeRecord({
          clock_in:      '2026-03-01T09:00:00.000Z',
          clock_out:     '2026-03-01T18:00:00.000Z',
          break_minutes: 60, // 480分
        }),
        makeRecord({
          id:            'rec-002',
          work_date:     '2026-03-03',
          clock_in:      '2026-03-03T10:00:00.000Z',
          clock_out:     '2026-03-03T17:00:00.000Z',
          break_minutes: 0, // 420分
        }),
      ]
      expect(totalWorkMinutes.value).toBe(900) // 480 + 420
    })
  })

  // ----------------------------------------------------------------
  describe('fetchTodayRecord', () => {
    it('正常取得: todayRecord が更新される', async () => {
      const record = makeRecord()
      mockFrom.mockReturnValue(buildMaybeSingleMock({ data: record, error: null }))

      const { todayRecord, fetchTodayRecord } = useAttendance()
      await fetchTodayRecord('emp-001')

      expect(todayRecord.value).toEqual(record)
    })

    it('データが null のとき todayRecord は null になる', async () => {
      mockFrom.mockReturnValue(buildMaybeSingleMock({ data: null, error: null }))

      const { todayRecord, fetchTodayRecord } = useAttendance()
      await fetchTodayRecord('emp-001')

      expect(todayRecord.value).toBeNull()
    })

    it('取得完了後は isLoading が false に戻る', async () => {
      mockFrom.mockReturnValue(buildMaybeSingleMock({ data: null, error: null }))

      const { isLoading, fetchTodayRecord } = useAttendance()
      await fetchTodayRecord('emp-001')

      expect(isLoading.value).toBe(false)
    })

    it('Supabase エラーオブジェクト時: error にメッセージがセットされる', async () => {
      const chain = buildMaybeSingleMock({ data: null, error: null })
      chain['maybeSingle'] = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'DB接続失敗' },
      })
      mockFrom.mockReturnValue(chain)

      const { error, fetchTodayRecord } = useAttendance()
      await fetchTodayRecord('emp-001')

      expect(error.value).toBe('DB接続失敗')
    })

    it('例外スロー時: error にメッセージがセットされる', async () => {
      const chain = buildMaybeSingleMock({ data: null, error: null })
      chain['maybeSingle'] = vi.fn().mockRejectedValue(new Error('ネットワークエラー'))
      mockFrom.mockReturnValue(chain)

      const { error, fetchTodayRecord } = useAttendance()
      await fetchTodayRecord('emp-001')

      expect(error.value).toBe('ネットワークエラー')
    })
  })

  // ----------------------------------------------------------------
  describe('clockIn', () => {
    beforeEach(() => {
      mockGetUser.mockResolvedValue({ data: { user: { id: 'usr-001' } } })
    })

    it('正常打刻: todayRecord が更新される', async () => {
      const record = makeRecord()
      mockFrom.mockReturnValue(buildInsertMock({ data: record, error: null }))

      const { todayRecord, clockIn } = useAttendance()
      await clockIn('emp-001')

      expect(todayRecord.value).toEqual(record)
    })

    it('insert に正しい employee_id が渡される', async () => {
      const record = makeRecord()
      const insertChain = buildInsertMock({ data: record, error: null })
      mockFrom.mockReturnValue(insertChain)

      const { clockIn } = useAttendance()
      await clockIn('emp-999')

      expect(insertChain['insert']).toHaveBeenCalledWith(
        expect.objectContaining({ employee_id: 'emp-999' })
      )
    })

    it('note が渡された場合: insert に note が含まれる', async () => {
      const record = makeRecord()
      const insertChain = buildInsertMock({ data: record, error: null })
      mockFrom.mockReturnValue(insertChain)

      const { clockIn } = useAttendance()
      await clockIn('emp-001', 'テレワーク')

      expect(insertChain['insert']).toHaveBeenCalledWith(
        expect.objectContaining({ note: 'テレワーク' })
      )
    })

    it('note が未指定のとき insert に note: null が渡される', async () => {
      const record = makeRecord()
      const insertChain = buildInsertMock({ data: record, error: null })
      mockFrom.mockReturnValue(insertChain)

      const { clockIn } = useAttendance()
      await clockIn('emp-001')

      expect(insertChain['insert']).toHaveBeenCalledWith(
        expect.objectContaining({ note: null })
      )
    })

    it('未認証の場合: error にメッセージがセットされ insert は呼ばれない', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } })
      const { error, clockIn } = useAttendance()
      await clockIn('emp-001')

      expect(error.value).toBe('認証情報がありません')
      expect(mockFrom).not.toHaveBeenCalled()
    })

    it('Supabase エラー時: error にメッセージがセットされる', async () => {
      const chain = buildInsertMock({ data: null, error: null })
      chain['single'] = vi.fn().mockResolvedValue({ data: null, error: { message: '重複エラー' } })
      mockFrom.mockReturnValue(chain)

      const { error, clockIn } = useAttendance()
      await clockIn('emp-001')

      expect(error.value).toBe('重複エラー')
    })

    it('打刻完了後は isLoading が false に戻る', async () => {
      mockFrom.mockReturnValue(buildInsertMock({ data: makeRecord(), error: null }))

      const { isLoading, clockIn } = useAttendance()
      await clockIn('emp-001')

      expect(isLoading.value).toBe(false)
    })
  })

  // ----------------------------------------------------------------
  describe('clockOut', () => {
    it('正常退勤: todayRecord が更新される', async () => {
      const updated = makeRecord({ clock_out: '2026-03-29T18:00:00Z', break_minutes: 60 })
      const updateChain = buildUpdateMock({ data: updated, error: null })
      mockFrom.mockReturnValue(updateChain)

      const { todayRecord, clockOut } = useAttendance()
      todayRecord.value = makeRecord() // 出勤済みとする
      await clockOut('emp-001', 60)

      expect(todayRecord.value?.clock_out).toBe('2026-03-29T18:00:00Z')
    })

    it('todayRecord が null の場合: error にメッセージがセットされ update は呼ばれない', async () => {
      const { error, clockOut } = useAttendance()
      // todayRecord は null のまま
      await clockOut('emp-001')

      expect(error.value).toBe('出勤記録がありません')
      expect(mockFrom).not.toHaveBeenCalled()
    })

    it('update に正しい id が eq で渡される', async () => {
      const updated    = makeRecord({ clock_out: '2026-03-29T18:00:00Z' })
      const updateChain = buildUpdateMock({ data: updated, error: null })
      mockFrom.mockReturnValue(updateChain)

      const { todayRecord, clockOut } = useAttendance()
      todayRecord.value = makeRecord({ id: 'rec-target' })
      await clockOut('emp-001')

      expect(updateChain['eq']).toHaveBeenCalledWith('id', 'rec-target')
    })

    it('break_minutes が負の場合は 0 になる', async () => {
      const updated    = makeRecord({ clock_out: '2026-03-29T18:00:00Z', break_minutes: 0 })
      const updateChain = buildUpdateMock({ data: updated, error: null })
      mockFrom.mockReturnValue(updateChain)

      const { todayRecord, clockOut } = useAttendance()
      todayRecord.value = makeRecord()
      await clockOut('emp-001', -30)

      expect(updateChain['update']).toHaveBeenCalledWith(
        expect.objectContaining({ break_minutes: 0 })
      )
    })

    it('退勤完了後は isLoading が false に戻る', async () => {
      mockFrom.mockReturnValue(buildUpdateMock({ data: makeRecord(), error: null }))

      const { todayRecord, isLoading, clockOut } = useAttendance()
      todayRecord.value = makeRecord()
      await clockOut('emp-001')

      expect(isLoading.value).toBe(false)
    })
  })

  // ----------------------------------------------------------------
  describe('fetchMonthlyRecords', () => {
    it('正常取得: monthlyRecords が更新される', async () => {
      const records = [makeRecord(), makeRecord({ id: 'rec-002', work_date: '2026-03-02' })]
      mockFrom.mockReturnValue(buildSelectOrderMock({ data: records, error: null }))

      const { monthlyRecords, fetchMonthlyRecords } = useAttendance()
      await fetchMonthlyRecords('emp-001', 2026, 3)

      expect(monthlyRecords.value).toEqual(records)
    })

    it('data が null のとき monthlyRecords は空配列', async () => {
      mockFrom.mockReturnValue(buildSelectOrderMock({ data: null, error: null }))

      const { monthlyRecords, fetchMonthlyRecords } = useAttendance()
      await fetchMonthlyRecords('emp-001', 2026, 3)

      expect(monthlyRecords.value).toEqual([])
    })

    it('12月の場合: gte/lt が正しい日付範囲になる', async () => {
      const chain = buildSelectOrderMock({ data: [], error: null })
      mockFrom.mockReturnValue(chain)

      const { fetchMonthlyRecords } = useAttendance()
      await fetchMonthlyRecords('emp-001', 2026, 12)

      expect(chain['gte']).toHaveBeenCalledWith('work_date', '2026-12-01')
      expect(chain['lt']).toHaveBeenCalledWith('work_date', '2027-01-01')
    })

    it('1月の場合: gte/lt が正しい日付範囲になる', async () => {
      const chain = buildSelectOrderMock({ data: [], error: null })
      mockFrom.mockReturnValue(chain)

      const { fetchMonthlyRecords } = useAttendance()
      await fetchMonthlyRecords('emp-001', 2026, 1)

      expect(chain['gte']).toHaveBeenCalledWith('work_date', '2026-01-01')
      expect(chain['lt']).toHaveBeenCalledWith('work_date', '2026-02-01')
    })

    it('Supabase エラーオブジェクト時: error にメッセージがセットされる', async () => {
      const chain = buildSelectOrderMock({ data: null, error: null })
      chain['order'] = vi.fn().mockResolvedValue({
        data: null,
        error: { message: '権限エラー' },
      })
      mockFrom.mockReturnValue(chain)

      const { error, fetchMonthlyRecords } = useAttendance()
      await fetchMonthlyRecords('emp-001', 2026, 3)

      expect(error.value).toBe('権限エラー')
    })

    it('取得完了後は isLoading が false に戻る', async () => {
      mockFrom.mockReturnValue(buildSelectOrderMock({ data: [], error: null }))

      const { isLoading, fetchMonthlyRecords } = useAttendance()
      await fetchMonthlyRecords('emp-001', 2026, 3)

      expect(isLoading.value).toBe(false)
    })
  })
})
