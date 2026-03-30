import { ref } from 'vue'
import { supabase } from '@/lib/supabase'
import type { EvaluationRecord, EvaluationFormData, EvaluationFilters, EvaluationStatus } from '@/types'

export function useEvaluations() {
  const records   = ref<EvaluationRecord[]>([])
  const current   = ref<EvaluationRecord | null>(null)
  const isLoading = ref(false)
  const error     = ref<string | null>(null)

  // ----------------------------------------------------------------
  // 一覧取得
  // ----------------------------------------------------------------
  async function fetchRecords(filters: Partial<EvaluationFilters> = {}): Promise<void> {
    isLoading.value = true
    error.value     = null
    try {
      let query = supabase
        .from('evaluation_records')
        .select(`
          *,
          employee:employees(id, full_name, employee_code, department:departments(id, name)),
          evaluator:profiles(id, full_name)
        `)
        .order('year',    { ascending: false })
        .order('quarter', { ascending: false })

      if (filters.employee_id) {
        query = query.eq('employee_id', filters.employee_id)
      }
      if (filters.year) {
        query = query.eq('year', filters.year)
      }
      if (filters.quarter) {
        query = query.eq('quarter', filters.quarter)
      }
      if (filters.status) {
        query = query.eq('status', filters.status)
      }

      const { data, error: sbErr } = await query
      if (sbErr) throw sbErr
      records.value = (data ?? []) as EvaluationRecord[]
    } catch (e: unknown) {
      error.value = (e as { message?: string }).message ?? '取得に失敗しました'
    } finally {
      isLoading.value = false
    }
  }

  // ----------------------------------------------------------------
  // 単件取得
  // ----------------------------------------------------------------
  async function fetchRecord(id: string): Promise<void> {
    isLoading.value = true
    error.value     = null
    try {
      const { data, error: sbErr } = await supabase
        .from('evaluation_records')
        .select(`
          *,
          employee:employees(id, full_name, employee_code, department:departments(id, name)),
          evaluator:profiles(id, full_name)
        `)
        .eq('id', id)
        .single()

      if (sbErr) throw sbErr
      current.value = data as EvaluationRecord
    } catch (e: unknown) {
      error.value = (e as { message?: string }).message ?? '取得に失敗しました'
    } finally {
      isLoading.value = false
    }
  }

  // ----------------------------------------------------------------
  // 登録
  // ----------------------------------------------------------------
  async function createRecord(form: EvaluationFormData): Promise<EvaluationRecord | null> {
    isLoading.value = true
    error.value     = null
    try {
      const { data: authData } = await supabase.auth.getUser()
      if (!authData.user) throw new Error('認証情報がありません')

      const { data, error: sbErr } = await supabase
        .from('evaluation_records')
        .insert({
          employee_id:          form.employee_id,
          evaluator_id:         authData.user.id,
          year:                 form.year,
          quarter:              form.quarter,
          score_performance:    form.score_performance,
          score_teamwork:       form.score_teamwork,
          score_communication:  form.score_communication,
          score_leadership:     form.score_leadership,
          score_growth:         form.score_growth,
          comment:              form.comment.trim() || null,
          status:               form.status,
        })
        .select()
        .single()

      if (sbErr) throw sbErr
      return data as EvaluationRecord
    } catch (e: unknown) {
      error.value = (e as { message?: string }).message ?? '登録に失敗しました'
      return null
    } finally {
      isLoading.value = false
    }
  }

  // ----------------------------------------------------------------
  // 更新
  // ----------------------------------------------------------------
  async function updateRecord(id: string, form: Partial<EvaluationFormData>): Promise<EvaluationRecord | null> {
    isLoading.value = true
    error.value     = null
    try {
      const payload: Record<string, unknown> = {}
      if (form.score_performance   !== undefined) payload['score_performance']   = form.score_performance
      if (form.score_teamwork      !== undefined) payload['score_teamwork']      = form.score_teamwork
      if (form.score_communication !== undefined) payload['score_communication'] = form.score_communication
      if (form.score_leadership    !== undefined) payload['score_leadership']    = form.score_leadership
      if (form.score_growth        !== undefined) payload['score_growth']        = form.score_growth
      if (form.comment             !== undefined) payload['comment']             = form.comment?.trim() || null
      if (form.status              !== undefined) payload['status']              = form.status

      const { data, error: sbErr } = await supabase
        .from('evaluation_records')
        .update(payload)
        .eq('id', id)
        .select()
        .single()

      if (sbErr) throw sbErr
      current.value = data as EvaluationRecord
      return data as EvaluationRecord
    } catch (e: unknown) {
      error.value = (e as { message?: string }).message ?? '更新に失敗しました'
      return null
    } finally {
      isLoading.value = false
    }
  }

  // ----------------------------------------------------------------
  // ステータス変更（submit / finalize）
  // ----------------------------------------------------------------
  async function changeStatus(id: string, status: EvaluationStatus): Promise<boolean> {
    isLoading.value = true
    error.value     = null
    try {
      const { error: sbErr } = await supabase
        .from('evaluation_records')
        .update({ status })
        .eq('id', id)

      if (sbErr) throw sbErr
      const idx = records.value.findIndex(r => r.id === id)
      if (idx !== -1) records.value[idx].status = status
      return true
    } catch (e: unknown) {
      error.value = (e as { message?: string }).message ?? 'ステータス変更に失敗しました'
      return false
    } finally {
      isLoading.value = false
    }
  }

  // ----------------------------------------------------------------
  // 削除
  // ----------------------------------------------------------------
  async function deleteRecord(id: string): Promise<boolean> {
    isLoading.value = true
    error.value     = null
    try {
      const { error: sbErr } = await supabase
        .from('evaluation_records')
        .delete()
        .eq('id', id)

      if (sbErr) throw sbErr
      records.value = records.value.filter(r => r.id !== id)
      return true
    } catch (e: unknown) {
      error.value = (e as { message?: string }).message ?? '削除に失敗しました'
      return false
    } finally {
      isLoading.value = false
    }
  }

  return {
    records,
    current,
    isLoading,
    error,
    fetchRecords,
    fetchRecord,
    createRecord,
    updateRecord,
    changeStatus,
    deleteRecord,
  }
}
