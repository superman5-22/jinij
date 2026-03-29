import { ref } from 'vue'
import { supabase } from '@/lib/supabase'
import type { Department, DepartmentFormData } from '@/types'

export function useDepartments() {
  const departments = ref<Department[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchDepartments() {
    loading.value = true
    error.value = null
    try {
      const { data, error: err } = await supabase
        .from('departments')
        .select('*')
        .order('name')
      if (err) throw err
      departments.value = (data ?? []) as Department[]
    } catch (e: unknown) {
      error.value = extractMessage(e)
    } finally {
      loading.value = false
    }
  }

  async function createDepartment(form: DepartmentFormData): Promise<Department> {
    const { data, error: err } = await supabase
      .from('departments')
      .insert(sanitize(form))
      .select()
      .single()
    if (err) throw err
    return data as Department
  }

  async function updateDepartment(id: string, form: DepartmentFormData): Promise<Department> {
    const { data, error: err } = await supabase
      .from('departments')
      .update(sanitize(form))
      .eq('id', id)
      .select()
      .single()
    if (err) throw err
    return data as Department
  }

  async function deleteDepartment(id: string): Promise<void> {
    const { error: err } = await supabase
      .from('departments')
      .delete()
      .eq('id', id)
    if (err) throw err
  }

  function extractMessage(e: unknown): string {
    if (e instanceof Error) return e.message
    if (e && typeof e === 'object' && 'message' in e) return (e as { message: string }).message
    return '取得に失敗しました'
  }

  function sanitize(form: DepartmentFormData) {
    return {
      name:        form.name.trim(),
      code:        form.code.trim() || null,
      description: form.description.trim() || null,
    }
  }

  return {
    departments,
    loading,
    error,
    fetchDepartments,
    createDepartment,
    updateDepartment,
    deleteDepartment,
  }
}
