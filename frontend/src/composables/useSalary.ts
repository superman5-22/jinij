import { ref } from 'vue'
import { supabase } from '@/lib/supabase'
import type {
  SalaryTemplate,
  SalaryTemplateFormData,
  Payslip,
  PayslipFormData,
  PayslipFilters,
} from '@/types'

// ============================================================
// 給与テンプレート
// ============================================================
export function useSalaryTemplates() {
  const templates = ref<SalaryTemplate[]>([])
  const loading   = ref(false)
  const error     = ref<string | null>(null)

  async function fetchTemplates() {
    loading.value = true
    error.value   = null
    try {
      const { data, error: err } = await supabase
        .from('salary_templates')
        .select(`
          *,
          employee:employees(id, full_name, employee_code, department:departments(id, name))
        `)
        .order('created_at', { ascending: false })
      if (err) throw err
      templates.value = (data ?? []) as SalaryTemplate[]
    } catch (e: unknown) {
      error.value = (e as { message?: string }).message ?? 'テンプレートの取得に失敗しました'
    } finally {
      loading.value = false
    }
  }

  async function fetchTemplateByEmployeeId(employeeId: string): Promise<SalaryTemplate | null> {
    const { data, error: err } = await supabase
      .from('salary_templates')
      .select('*')
      .eq('employee_id', employeeId)
      .maybeSingle()
    if (err) throw err
    return data as SalaryTemplate | null
  }

  async function upsertTemplate(form: SalaryTemplateFormData): Promise<SalaryTemplate> {
    const { data, error: err } = await supabase
      .from('salary_templates')
      .upsert(
        {
          employee_id:          form.employee_id,
          basic_salary:         form.basic_salary,
          housing_allowance:    form.housing_allowance,
          commute_allowance:    form.commute_allowance,
          family_allowance:     form.family_allowance,
          position_allowance:   form.position_allowance,
          overtime_unit_price:  form.overtime_unit_price,
          health_insurance:     form.health_insurance,
          pension_insurance:    form.pension_insurance,
          employment_insurance: form.employment_insurance,
          income_tax:           form.income_tax,
          resident_tax:         form.resident_tax,
          note:                 form.note.trim() || null,
          effective_from:       form.effective_from,
        },
        { onConflict: 'employee_id' }
      )
      .select('*')
      .single()
    if (err) throw err
    return data as SalaryTemplate
  }

  async function deleteTemplate(id: string) {
    const { error: err } = await supabase
      .from('salary_templates')
      .delete()
      .eq('id', id)
    if (err) throw err
  }

  return {
    templates, loading, error,
    fetchTemplates, fetchTemplateByEmployeeId, upsertTemplate, deleteTemplate,
  }
}

// ============================================================
// 給与明細
// ============================================================
export function usePayslips() {
  const payslips  = ref<Payslip[]>([])
  const loading   = ref(false)
  const error     = ref<string | null>(null)

  const filters = ref<PayslipFilters>({
    employee_id: '',
    pay_year:    '',
    pay_month:   '',
    status:      '',
  })

  async function fetchPayslips() {
    loading.value = true
    error.value   = null
    try {
      let query = supabase
        .from('payslips')
        .select(`
          *,
          employee:employees(id, full_name, employee_code, department:departments(id, name))
        `)

      if (filters.value.employee_id) {
        query = query.eq('employee_id', filters.value.employee_id)
      }
      if (filters.value.pay_year !== '') {
        query = query.eq('pay_year', filters.value.pay_year)
      }
      if (filters.value.pay_month !== '') {
        query = query.eq('pay_month', filters.value.pay_month)
      }
      if (filters.value.status) {
        query = query.eq('status', filters.value.status)
      }

      const { data, error: err } = await query
        .order('pay_year',  { ascending: false })
        .order('pay_month', { ascending: false })

      if (err) throw err
      payslips.value = (data ?? []) as Payslip[]
    } catch (e: unknown) {
      error.value = (e as { message?: string }).message ?? '給与明細の取得に失敗しました'
    } finally {
      loading.value = false
    }
  }

  async function fetchPayslipById(id: string): Promise<Payslip | null> {
    const { data, error: err } = await supabase
      .from('payslips')
      .select(`
        *,
        employee:employees(id, full_name, employee_code, department:departments(id, name))
      `)
      .eq('id', id)
      .maybeSingle()
    if (err) throw err
    return data as Payslip | null
  }

  async function createPayslip(form: PayslipFormData): Promise<Payslip> {
    const { data, error: err } = await supabase
      .from('payslips')
      .insert({
        employee_id:          form.employee_id,
        pay_year:             form.pay_year,
        pay_month:            form.pay_month,
        basic_salary:         form.basic_salary,
        housing_allowance:    form.housing_allowance,
        commute_allowance:    form.commute_allowance,
        family_allowance:     form.family_allowance,
        position_allowance:   form.position_allowance,
        overtime_pay:         form.overtime_pay,
        other_allowance:      form.other_allowance,
        health_insurance:     form.health_insurance,
        pension_insurance:    form.pension_insurance,
        employment_insurance: form.employment_insurance,
        income_tax:           form.income_tax,
        resident_tax:         form.resident_tax,
        other_deduction:      form.other_deduction,
        note:                 form.note.trim() || null,
        status:               'draft',
      })
      .select('*')
      .single()
    if (err) throw err
    return data as Payslip
  }

  async function updatePayslip(id: string, form: Partial<PayslipFormData>): Promise<Payslip> {
    // 確定済みは編集不可
    const existing = await fetchPayslipById(id)
    if (existing?.status === 'confirmed') {
      throw new Error('確定済みの給与明細は編集できません')
    }

    const { data, error: err } = await supabase
      .from('payslips')
      .update({
        ...(form.basic_salary         !== undefined && { basic_salary:         form.basic_salary }),
        ...(form.housing_allowance    !== undefined && { housing_allowance:    form.housing_allowance }),
        ...(form.commute_allowance    !== undefined && { commute_allowance:    form.commute_allowance }),
        ...(form.family_allowance     !== undefined && { family_allowance:     form.family_allowance }),
        ...(form.position_allowance   !== undefined && { position_allowance:   form.position_allowance }),
        ...(form.overtime_pay         !== undefined && { overtime_pay:         form.overtime_pay }),
        ...(form.other_allowance      !== undefined && { other_allowance:      form.other_allowance }),
        ...(form.health_insurance     !== undefined && { health_insurance:     form.health_insurance }),
        ...(form.pension_insurance    !== undefined && { pension_insurance:    form.pension_insurance }),
        ...(form.employment_insurance !== undefined && { employment_insurance: form.employment_insurance }),
        ...(form.income_tax           !== undefined && { income_tax:           form.income_tax }),
        ...(form.resident_tax         !== undefined && { resident_tax:         form.resident_tax }),
        ...(form.other_deduction      !== undefined && { other_deduction:      form.other_deduction }),
        ...(form.note                 !== undefined && { note:                 form.note.trim() || null }),
      })
      .eq('id', id)
      .select('*')
      .single()
    if (err) throw err
    return data as Payslip
  }

  async function confirmPayslip(id: string, userId: string): Promise<void> {
    const { error: err } = await supabase
      .from('payslips')
      .update({
        status:       'confirmed',
        confirmed_by: userId,
        confirmed_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('status', 'draft') // ドラフトのみ確定可
    if (err) throw err
  }

  async function deletePayslip(id: string): Promise<void> {
    // 確定済みは削除不可
    const existing = await fetchPayslipById(id)
    if (existing?.status === 'confirmed') {
      throw new Error('確定済みの給与明細は削除できません')
    }
    const { error: err } = await supabase
      .from('payslips')
      .delete()
      .eq('id', id)
    if (err) throw err
  }

  /**
   * 給与テンプレートから当月の給与明細ドラフトを生成する
   */
  async function generateFromTemplate(
    employeeId: string,
    year: number,
    month: number,
  ): Promise<Payslip> {
    const { data: tmpl, error: tmplErr } = await supabase
      .from('salary_templates')
      .select('*')
      .eq('employee_id', employeeId)
      .maybeSingle()
    if (tmplErr) throw tmplErr
    if (!tmpl) throw new Error('給与テンプレートが設定されていません')

    return createPayslip({
      employee_id:          employeeId,
      pay_year:             year,
      pay_month:            month,
      basic_salary:         (tmpl as SalaryTemplate).basic_salary,
      housing_allowance:    (tmpl as SalaryTemplate).housing_allowance,
      commute_allowance:    (tmpl as SalaryTemplate).commute_allowance,
      family_allowance:     (tmpl as SalaryTemplate).family_allowance,
      position_allowance:   (tmpl as SalaryTemplate).position_allowance,
      overtime_pay:         0,
      other_allowance:      0,
      health_insurance:     (tmpl as SalaryTemplate).health_insurance,
      pension_insurance:    (tmpl as SalaryTemplate).pension_insurance,
      employment_insurance: (tmpl as SalaryTemplate).employment_insurance,
      income_tax:           (tmpl as SalaryTemplate).income_tax,
      resident_tax:         (tmpl as SalaryTemplate).resident_tax,
      other_deduction:      0,
      note:                 '',
    })
  }

  function applyFilters() {
    fetchPayslips()
  }

  return {
    payslips, loading, error, filters,
    fetchPayslips, fetchPayslipById,
    createPayslip, updatePayslip, confirmPayslip, deletePayslip,
    generateFromTemplate, applyFilters,
  }
}
