import { ref } from 'vue'
import { supabase } from '@/lib/supabase'
import type {
  OvertimeRequest,
  OvertimeRequestFormData,
  OvertimeFilters,
} from '@/types'

function extractMessage(e: unknown, fallback: string): string {
  if (e instanceof Error) return e.message
  if (e && typeof e === 'object' && 'message' in e) return (e as { message: string }).message
  return fallback
}

export function useOvertimeRequests() {
  const requests  = ref<OvertimeRequest[]>([])
  const isLoading = ref(false)
  const error     = ref<string | null>(null)

  const filters = ref<OvertimeFilters>({
    employee_id: '',
    status:      '',
    date_from:   '',
    date_to:     '',
  })

  // ----------------------------------------------------------------
  // 一覧取得
  // ----------------------------------------------------------------
  async function fetchRequests() {
    isLoading.value = true
    error.value     = null
    try {
      let query = supabase
        .from('overtime_requests')
        .select(`
          *,
          employee:employees(id, full_name, employee_code, department:departments(id, name)),
          reviewer:profiles(id, full_name)
        `)

      if (filters.value.employee_id) {
        query = query.eq('employee_id', filters.value.employee_id)
      }
      if (filters.value.status) {
        query = query.eq('status', filters.value.status)
      }
      if (filters.value.date_from) {
        query = query.gte('work_date', filters.value.date_from)
      }
      if (filters.value.date_to) {
        query = query.lte('work_date', filters.value.date_to)
      }

      const { data, error: err } = await query.order('work_date', { ascending: false })
      if (err) throw err
      requests.value = (data ?? []) as OvertimeRequest[]
    } catch (e: unknown) {
      error.value = extractMessage(e, '取得に失敗しました')
    } finally {
      isLoading.value = false
    }
  }

  // ----------------------------------------------------------------
  // 申請作成
  // ----------------------------------------------------------------
  async function submitRequest(form: OvertimeRequestFormData): Promise<OvertimeRequest | null> {
    isLoading.value = true
    error.value     = null
    try {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) throw new Error('認証情報がありません')

      const { data, error: err } = await supabase
        .from('overtime_requests')
        .insert({
          employee_id:    form.employee_id,
          user_id:        userData.user.id,
          work_date:      form.work_date,
          planned_end:    form.planned_end,
          overtime_hours: form.overtime_hours,
          reason:         form.reason.trim(),
        })
        .select(`
          *,
          employee:employees(id, full_name, employee_code)
        `)
        .single()
      if (err) throw err
      return data as OvertimeRequest
    } catch (e: unknown) {
      error.value = extractMessage(e, '申請に失敗しました')
      return null
    } finally {
      isLoading.value = false
    }
  }

  // ----------------------------------------------------------------
  // 承認
  // ----------------------------------------------------------------
  async function approveRequest(id: string, reviewerId: string, comment?: string): Promise<boolean> {
    isLoading.value = true
    error.value     = null
    try {
      const { error: err } = await supabase
        .from('overtime_requests')
        .update({
          status:        'approved',
          reviewed_by:    reviewerId,
          reviewed_at:    new Date().toISOString(),
          review_comment: comment?.trim() || null,
        })
        .eq('id', id)
      if (err) throw err
      await fetchRequests()
      return true
    } catch (e: unknown) {
      error.value = extractMessage(e, '承認に失敗しました')
      return false
    } finally {
      isLoading.value = false
    }
  }

  // ----------------------------------------------------------------
  // 却下
  // ----------------------------------------------------------------
  async function rejectRequest(id: string, reviewerId: string, comment: string): Promise<boolean> {
    if (!comment.trim()) {
      error.value = '却下理由を入力してください'
      return false
    }
    isLoading.value = true
    error.value     = null
    try {
      const { error: err } = await supabase
        .from('overtime_requests')
        .update({
          status:         'rejected',
          reviewed_by:    reviewerId,
          reviewed_at:    new Date().toISOString(),
          review_comment: comment.trim(),
        })
        .eq('id', id)
      if (err) throw err
      await fetchRequests()
      return true
    } catch (e: unknown) {
      error.value = extractMessage(e, '却下に失敗しました')
      return false
    } finally {
      isLoading.value = false
    }
  }

  // ----------------------------------------------------------------
  // キャンセル（本人のみ、pending の場合）
  // ----------------------------------------------------------------
  async function cancelRequest(id: string): Promise<boolean> {
    isLoading.value = true
    error.value     = null
    try {
      const { error: err } = await supabase
        .from('overtime_requests')
        .update({ status: 'cancelled' })
        .eq('id', id)
      if (err) throw err
      requests.value = requests.value.filter(r => r.id !== id)
      return true
    } catch (e: unknown) {
      error.value = extractMessage(e, 'キャンセルに失敗しました')
      return false
    } finally {
      isLoading.value = false
    }
  }

  function applyFilters() {
    fetchRequests()
  }

  return {
    requests,
    isLoading,
    error,
    filters,
    fetchRequests,
    submitRequest,
    approveRequest,
    rejectRequest,
    cancelRequest,
    applyFilters,
  }
}
