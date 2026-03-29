import { ref } from 'vue'
import { supabase } from '@/lib/supabase'
import type { LeaveRequest, LeaveRequestFormData, LeaveFilters } from '@/types'

export function useLeaves() {
  const requests = ref<LeaveRequest[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const filters = ref<LeaveFilters>({
    employee_id: '',
    status: '',
    leave_type: '',
    date_from: '',
    date_to: '',
  })

  async function fetchRequests() {
    loading.value = true
    error.value = null
    try {
      let query = supabase
        .from('leave_requests')
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
      if (filters.value.leave_type) {
        query = query.eq('leave_type', filters.value.leave_type)
      }
      if (filters.value.date_from) {
        query = query.gte('start_date', filters.value.date_from)
      }
      if (filters.value.date_to) {
        query = query.lte('end_date', filters.value.date_to)
      }

      const { data, error: err } = await query.order('created_at', { ascending: false })
      if (err) throw err
      requests.value = (data ?? []) as LeaveRequest[]
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : '取得に失敗しました'
    } finally {
      loading.value = false
    }
  }

  async function submitRequest(form: LeaveRequestFormData): Promise<LeaveRequest> {
    const { data, error: err } = await supabase
      .from('leave_requests')
      .insert({
        employee_id: form.employee_id,
        leave_type:  form.leave_type,
        start_date:  form.start_date,
        end_date:    form.end_date,
        days_count:  form.days_count,
        reason:      form.reason.trim() || null,
      })
      .select('*, employee:employees(id, full_name, employee_code)')
      .single()
    if (err) throw err
    return data as LeaveRequest
  }

  async function approveRequest(id: string, reviewerId: string, comment?: string) {
    const { error: err } = await supabase
      .from('leave_requests')
      .update({
        status:         'approved',
        reviewed_by:    reviewerId,
        reviewed_at:    new Date().toISOString(),
        review_comment: comment?.trim() || null,
      })
      .eq('id', id)
    if (err) throw err
  }

  async function rejectRequest(id: string, reviewerId: string, comment: string) {
    if (!comment.trim()) throw new Error('却下理由を入力してください')
    const { error: err } = await supabase
      .from('leave_requests')
      .update({
        status:         'rejected',
        reviewed_by:    reviewerId,
        reviewed_at:    new Date().toISOString(),
        review_comment: comment.trim(),
      })
      .eq('id', id)
    if (err) throw err
  }

  async function cancelRequest(id: string) {
    const { error: err } = await supabase
      .from('leave_requests')
      .update({ status: 'cancelled' })
      .eq('id', id)
    if (err) throw err
  }

  function applyFilters() {
    fetchRequests()
  }

  return {
    requests, loading, error, filters,
    fetchRequests, submitRequest, approveRequest, rejectRequest, cancelRequest,
    applyFilters,
  }
}
