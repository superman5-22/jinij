import { ref } from 'vue'
import { supabase } from '@/lib/supabase'
import type { SalaryRecord, SalaryFormData, SalaryFilters } from '@/types'

export function useSalary() {
  const records   = ref<SalaryRecord[]>([])
  const current   = ref<SalaryRecord | null>(null)
  const isLoading = ref(false)
  const error     = ref<string | null>(null)

  // ----------------------------------------------------------------
  // 一覧取得
  // ----------------------------------------------------------------
  async function fetchRecords(filters: Partial<SalaryFilters> = {}): Promise<void> {
    isLoading.value = true
    error.value     = null
    try {
      let query = supabase
        .from('salary_records')
        .select('*, employee:employees(id, full_name, employee_code, department_id)')
        .order('year',  { ascending: false })
        .order('month', { ascending: false })

      if (filters.employee_id) {
        query = query.eq('employee_id', filters.employee_id)
      }
      if (filters.year) {
        query = query.eq('year', filters.year)
      }
      if (filters.month) {
        query = query.eq('month', filters.month)
      }

      const { data, error: sbErr } = await query
      if (sbErr) throw sbErr
      records.value = data ?? []
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
        .from('salary_records')
        .select('*, employee:employees(id, full_name, employee_code, department_id)')
        .eq('id', id)
        .single()

      if (sbErr) throw sbErr
      current.value = data
    } catch (e: unknown) {
      error.value = (e as { message?: string }).message ?? '取得に失敗しました'
    } finally {
      isLoading.value = false
    }
  }

  // ----------------------------------------------------------------
  // 登録
  // ----------------------------------------------------------------
  async function createRecord(form: SalaryFormData): Promise<SalaryRecord | null> {
    isLoading.value = true
    error.value     = null
    try {
      const { data: authData } = await supabase.auth.getUser()
      if (!authData.user) throw new Error('認証情報がありません')

      const { data, error: sbErr } = await supabase
        .from('salary_records')
        .insert({
          employee_id:  form.employee_id,
          year:         form.year,
          month:        form.month,
          base_salary:  form.base_salary,
          overtime_pay: form.overtime_pay,
          allowances:   form.allowances,
          deductions:   form.deductions,
          paid_at:      form.paid_at || null,
          notes:        form.notes   || null,
          created_by:   authData.user.id,
        })
        .select()
        .single()

      if (sbErr) throw sbErr
      return data
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
  async function updateRecord(id: string, form: Partial<SalaryFormData>): Promise<SalaryRecord | null> {
    isLoading.value = true
    error.value     = null
    try {
      const payload: Record<string, unknown> = {}
      if (form.base_salary  !== undefined) payload['base_salary']  = form.base_salary
      if (form.overtime_pay !== undefined) payload['overtime_pay'] = form.overtime_pay
      if (form.allowances   !== undefined) payload['allowances']   = form.allowances
      if (form.deductions   !== undefined) payload['deductions']   = form.deductions
      if (form.paid_at      !== undefined) payload['paid_at']      = form.paid_at || null
      if (form.notes        !== undefined) payload['notes']        = form.notes   || null

      const { data, error: sbErr } = await supabase
        .from('salary_records')
        .update(payload)
        .eq('id', id)
        .select()
        .single()

      if (sbErr) throw sbErr
      current.value = data
      return data
    } catch (e: unknown) {
      error.value = (e as { message?: string }).message ?? '更新に失敗しました'
      return null
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
        .from('salary_records')
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
    deleteRecord,
  }
}
