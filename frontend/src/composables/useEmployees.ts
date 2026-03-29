import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'
import type {
  Employee, EmployeeFormData, EmployeeFilters, Pagination, Department,
} from '@/types'

export function useEmployees() {
  const employees = ref<Employee[]>([])
  const departments = ref<Department[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const pagination = ref<Pagination>({ page: 1, per_page: 20, total: 0 })

  const filters = ref<EmployeeFilters>({
    search: '',
    department_id: '',
    status: '',
    employment_type: '',
  })

  async function fetchDepartments() {
    const { data } = await supabase
      .from('departments')
      .select('*')
      .order('name')
    departments.value = (data ?? []) as Department[]
  }

  async function fetchEmployees() {
    loading.value = true
    error.value = null
    try {
      let query = supabase
        .from('employees')
        .select('*, department:departments(id, name, code)', { count: 'exact' })

      if (filters.value.search) {
        const q = `%${filters.value.search}%`
        query = query.or(
          `full_name.ilike.${q},employee_code.ilike.${q},email.ilike.${q},position.ilike.${q}`
        )
      }
      if (filters.value.department_id) {
        query = query.eq('department_id', filters.value.department_id)
      }
      if (filters.value.status) {
        query = query.eq('status', filters.value.status)
      }
      if (filters.value.employment_type) {
        query = query.eq('employment_type', filters.value.employment_type)
      }

      const from = (pagination.value.page - 1) * pagination.value.per_page
      const to = from + pagination.value.per_page - 1

      const { data, count, error: err } = await query
        .order('employee_code')
        .range(from, to)

      if (err) throw err
      employees.value = (data ?? []) as Employee[]
      pagination.value.total = count ?? 0
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : '取得に失敗しました'
    } finally {
      loading.value = false
    }
  }

  async function fetchEmployee(id: string): Promise<Employee | null> {
    const { data, error: err } = await supabase
      .from('employees')
      .select('*, department:departments(id, name, code)')
      .eq('id', id)
      .single()
    if (err) throw err
    return data as Employee
  }

  async function createEmployee(form: EmployeeFormData): Promise<Employee> {
    const payload = sanitize(form)
    const { data, error: err } = await supabase
      .from('employees')
      .insert(payload)
      .select('*, department:departments(id, name, code)')
      .single()
    if (err) throw err
    return data as Employee
  }

  async function updateEmployee(id: string, form: EmployeeFormData): Promise<Employee> {
    const payload = sanitize(form)
    const { data, error: err } = await supabase
      .from('employees')
      .update(payload)
      .eq('id', id)
      .select('*, department:departments(id, name, code)')
      .single()
    if (err) throw err
    return data as Employee
  }

  async function deleteEmployee(id: string) {
    const { error: err } = await supabase
      .from('employees')
      .update({ status: 'inactive' })
      .eq('id', id)
    if (err) throw err
  }

  function sanitize(form: EmployeeFormData) {
    return {
      employee_code:           form.employee_code.trim(),
      full_name:               form.full_name.trim(),
      full_name_kana:          form.full_name_kana.trim() || null,
      email:                   form.email.trim().toLowerCase(),
      phone:                   form.phone.trim() || null,
      department_id:           form.department_id || null,
      position:                form.position.trim(),
      employment_type:         form.employment_type,
      hire_date:               form.hire_date,
      birth_date:              form.birth_date || null,
      address:                 form.address.trim() || null,
      emergency_contact_name:  form.emergency_contact_name.trim() || null,
      emergency_contact_phone: form.emergency_contact_phone.trim() || null,
      status:                  form.status,
      annual_leave_balance:    Number(form.annual_leave_balance),
      notes:                   form.notes.trim() || null,
    }
  }

  function setPage(page: number) {
    pagination.value.page = page
    fetchEmployees()
  }

  function applyFilters() {
    pagination.value.page = 1
    fetchEmployees()
  }

  const totalPages = computed(() =>
    Math.ceil(pagination.value.total / pagination.value.per_page)
  )

  return {
    employees, departments, loading, error, pagination, filters, totalPages,
    fetchDepartments, fetchEmployees, fetchEmployee,
    createEmployee, updateEmployee, deleteEmployee,
    setPage, applyFilters,
  }
}
