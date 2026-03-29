import { computed, ref } from 'vue'
import { supabase } from '@/lib/supabase'
import type { AttendanceRecord, AttendanceMonthlySummary } from '@/types'
import { ATTENDANCE_STATUS_LABELS } from '@/types'

export function useAttendance() {
  const todayRecord    = ref<AttendanceRecord | null>(null)
  const monthlyRecords = ref<AttendanceRecord[]>([])
  const isLoading      = ref(false)
  const error          = ref<string | null>(null)

  /** 今日の出勤打刻済みか */
  const isClockedIn  = computed(() => !!todayRecord.value?.clock_in)
  /** 今日の退勤打刻済みか */
  const isClockedOut = computed(() => !!todayRecord.value?.clock_out)

  /**
   * 月次レコードから合計実働時間（分）を算出する。
   * clock_in・clock_out の両方が存在するレコードのみ集計する。
   */
  const totalWorkMinutes = computed<number>(() =>
    monthlyRecords.value.reduce((sum, r) => {
      if (r.clock_in && r.clock_out) {
        const diff =
          (new Date(r.clock_out).getTime() - new Date(r.clock_in).getTime()) / 60_000 -
          r.break_minutes
        return sum + Math.max(0, Math.floor(diff))
      }
      return sum
    }, 0)
  )

  // ----------------------------------------------------------------
  // 今日の打刻状態を取得
  // ----------------------------------------------------------------
  async function fetchTodayRecord(employeeId: string): Promise<void> {
    isLoading.value = true
    error.value     = null
    try {
      const today = new Date().toISOString().split('T')[0]
      const { data, error: sbErr } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('employee_id', employeeId)
        .eq('work_date', today)
        .maybeSingle()

      if (sbErr) throw sbErr
      todayRecord.value = data
    } catch (e: unknown) {
      error.value = (e as { message?: string }).message ?? '取得に失敗しました'
    } finally {
      isLoading.value = false
    }
  }

  // ----------------------------------------------------------------
  // 出勤打刻
  // ----------------------------------------------------------------
  async function clockIn(employeeId: string, note?: string): Promise<void> {
    isLoading.value = true
    error.value     = null
    try {
      const { data: authData } = await supabase.auth.getUser()
      if (!authData.user) throw new Error('認証情報がありません')

      const today = new Date().toISOString().split('T')[0]
      const now   = new Date().toISOString()

      const { data, error: sbErr } = await supabase
        .from('attendance_records')
        .insert({
          employee_id:   employeeId,
          user_id:       authData.user.id,
          work_date:     today,
          clock_in:      now,
          status:        'present',
          note:          note ?? null,
        })
        .select()
        .single()

      if (sbErr) throw sbErr
      todayRecord.value = data
    } catch (e: unknown) {
      error.value = (e as { message?: string }).message ?? '出勤打刻に失敗しました'
    } finally {
      isLoading.value = false
    }
  }

  // ----------------------------------------------------------------
  // 退勤打刻
  // ----------------------------------------------------------------
  async function clockOut(
    employeeId: string,
    breakMinutes = 0,
    note?: string,
  ): Promise<void> {
    isLoading.value = true
    error.value     = null
    try {
      if (!todayRecord.value) throw new Error('出勤記録がありません')

      const now = new Date().toISOString()

      const { data, error: sbErr } = await supabase
        .from('attendance_records')
        .update({
          clock_out:     now,
          break_minutes: Math.max(0, breakMinutes),
          note:          note ?? todayRecord.value.note,
          updated_at:    now,
        })
        .eq('id', todayRecord.value.id)
        .select()
        .single()

      if (sbErr) throw sbErr
      todayRecord.value = data
    } catch (e: unknown) {
      error.value = (e as { message?: string }).message ?? '退勤打刻に失敗しました'
    } finally {
      isLoading.value = false
    }
  }

  // ----------------------------------------------------------------
  // 月次レコード取得
  // ----------------------------------------------------------------
  async function fetchMonthlyRecords(
    employeeId: string,
    year:       number,
    month:      number,
  ): Promise<void> {
    isLoading.value = true
    error.value     = null
    try {
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`
      const endMonth  = month === 12 ? 1 : month + 1
      const endYear   = month === 12 ? year + 1 : year
      const endDate   = `${endYear}-${String(endMonth).padStart(2, '0')}-01`

      const { data, error: sbErr } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('employee_id', employeeId)
        .gte('work_date', startDate)
        .lt('work_date', endDate)
        .order('work_date', { ascending: true })

      if (sbErr) throw sbErr
      monthlyRecords.value = data ?? []
    } catch (e: unknown) {
      error.value = (e as { message?: string }).message ?? '取得に失敗しました'
    } finally {
      isLoading.value = false
    }
  }

  // ----------------------------------------------------------------
  // 月次勤怠 CSV エクスポート
  // ----------------------------------------------------------------
  /**
   * monthlyRecords の内容を UTF-8 BOM 付き CSV としてダウンロードする。
   * @param year         対象年
   * @param month        対象月
   * @param employeeName ファイル名に付与する従業員名（省略可）
   */
  function exportMonthlyCSV(year: number, month: number, employeeName?: string): void {
    const header = ['日付', 'ステータス', '出勤時刻', '退勤時刻', '休憩(分)', '実働時間', '備考']

    const rows = monthlyRecords.value.map((r) => {
      const workMin =
        r.clock_in && r.clock_out
          ? Math.max(
              0,
              Math.floor(
                (new Date(r.clock_out).getTime() - new Date(r.clock_in).getTime()) / 60_000 -
                  r.break_minutes,
              ),
            )
          : 0

      const fmtTime = (iso: string | null) =>
        iso
          ? new Date(iso).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', hour12: false })
          : ''

      const fmtWork = (min: number) =>
        min > 0 ? `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}` : ''

      return [
        r.work_date,
        ATTENDANCE_STATUS_LABELS[r.status] ?? r.status,
        fmtTime(r.clock_in),
        fmtTime(r.clock_out),
        String(r.break_minutes),
        fmtWork(workMin),
        r.note ?? '',
      ]
    })

    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`
    const csvContent = [header, ...rows]
      .map((row) => row.map(escape).join(','))
      .join('\n')

    const bom  = '\uFEFF'
    const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    const prefix = employeeName ? `${employeeName}_` : ''
    a.href     = url
    a.download = `${prefix}勤怠_${year}年${String(month).padStart(2, '0')}月.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return {
    todayRecord,
    monthlyRecords,
    isLoading,
    error,
    isClockedIn,
    isClockedOut,
    totalWorkMinutes,
    fetchTodayRecord,
    clockIn,
    clockOut,
    fetchMonthlyRecords,
    exportMonthlyCSV,
  }
}
