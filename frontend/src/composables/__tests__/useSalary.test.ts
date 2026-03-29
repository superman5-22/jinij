import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useSalaryTemplates, usePayslips } from '@/composables/useSalary'
import type { SalaryTemplate, Payslip } from '@/types'

// ----------------------------------------------------------------
// Supabase モック
// ----------------------------------------------------------------
const { mockFrom } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: { from: mockFrom },
}))

// ----------------------------------------------------------------
// テスト用データファクトリ
// ----------------------------------------------------------------
const makeTemplate = (overrides: Partial<SalaryTemplate> = {}): SalaryTemplate => ({
  id:                   'tmpl-001',
  employee_id:          'emp-001',
  basic_salary:         300_000,
  housing_allowance:    20_000,
  commute_allowance:    10_000,
  family_allowance:     0,
  position_allowance:   0,
  overtime_unit_price:  1_500,
  health_insurance:     15_000,
  pension_insurance:    27_000,
  employment_insurance: 1_000,
  income_tax:           8_000,
  resident_tax:         12_000,
  note:                 null,
  effective_from:       '2026-01-01',
  created_by:           null,
  created_at:           '2026-01-01T00:00:00Z',
  updated_at:           '2026-01-01T00:00:00Z',
  ...overrides,
})

const makePayslip = (overrides: Partial<Payslip> = {}): Payslip => ({
  id:                   'pay-001',
  employee_id:          'emp-001',
  pay_year:             2026,
  pay_month:            3,
  basic_salary:         300_000,
  housing_allowance:    20_000,
  commute_allowance:    10_000,
  family_allowance:     0,
  position_allowance:   0,
  overtime_pay:         0,
  other_allowance:      0,
  health_insurance:     15_000,
  pension_insurance:    27_000,
  employment_insurance: 1_000,
  income_tax:           8_000,
  resident_tax:         12_000,
  other_deduction:      0,
  total_payment:        330_000,
  total_deduction:      63_000,
  net_payment:          267_000,
  status:               'draft',
  note:                 null,
  confirmed_by:         null,
  confirmed_at:         null,
  created_by:           null,
  created_at:           '2026-03-01T00:00:00Z',
  updated_at:           '2026-03-01T00:00:00Z',
  ...overrides,
})

// ----------------------------------------------------------------
// クエリビルダーモック ヘルパー
// ----------------------------------------------------------------
function buildSelectChain(
  resolved: { data: unknown; error: null | { message: string } },
  extraMethods: string[] = []
) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  for (const m of ['select', 'eq', 'order', ...extraMethods]) {
    chain[m] = vi.fn().mockReturnValue(chain)
  }
  // 最後のメソッドを resolve させる
  const lastMethod = extraMethods.at(-1) ?? 'order'
  chain[lastMethod] = vi.fn().mockResolvedValue(resolved)
  return chain
}

function buildMaybeSingleChain(resolved: { data: unknown; error: null | { message: string } }) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  chain['select']      = vi.fn().mockReturnValue(chain)
  chain['eq']          = vi.fn().mockReturnValue(chain)
  chain['maybeSingle'] = vi.fn().mockResolvedValue(resolved)
  return chain
}

function buildUpsertChain(resolved: { data: unknown; error: null | { message: string } }) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  chain['upsert'] = vi.fn().mockReturnValue(chain)
  chain['select'] = vi.fn().mockReturnValue(chain)
  chain['single'] = vi.fn().mockResolvedValue(resolved)
  return chain
}

function buildInsertChain(resolved: { data: unknown; error: null | { message: string } }) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  chain['insert'] = vi.fn().mockReturnValue(chain)
  chain['select'] = vi.fn().mockReturnValue(chain)
  chain['single'] = vi.fn().mockResolvedValue(resolved)
  return chain
}

function buildUpdateChain(resolved: { data: unknown; error: null | { message: string } }) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  chain['update'] = vi.fn().mockReturnValue(chain)
  chain['eq']     = vi.fn().mockReturnValue(chain)
  chain['select'] = vi.fn().mockReturnValue(chain)
  chain['single'] = vi.fn().mockResolvedValue(resolved)
  return chain
}

function buildDeleteChain(resolved: { error: null | { message: string } }) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  chain['delete'] = vi.fn().mockReturnValue(chain)
  chain['eq']     = vi.fn().mockResolvedValue(resolved)
  return chain
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ================================================================
// useSalaryTemplates
// ================================================================
describe('useSalaryTemplates', () => {
  describe('初期状態', () => {
    it('templates は空配列', () => {
      const { templates } = useSalaryTemplates()
      expect(templates.value).toEqual([])
    })

    it('loading は false', () => {
      const { loading } = useSalaryTemplates()
      expect(loading.value).toBe(false)
    })

    it('error は null', () => {
      const { error } = useSalaryTemplates()
      expect(error.value).toBeNull()
    })
  })

  // ----------------------------------------------------------------
  describe('fetchTemplates', () => {
    it('正常取得: templates が更新される', async () => {
      const tmpl = makeTemplate()
      const chain = buildSelectChain({ data: [tmpl], error: null })
      mockFrom.mockReturnValue(chain)

      const { templates, fetchTemplates } = useSalaryTemplates()
      await fetchTemplates()

      expect(templates.value).toEqual([tmpl])
    })

    it('data が null のとき templates は空配列', async () => {
      const chain = buildSelectChain({ data: null, error: null })
      mockFrom.mockReturnValue(chain)

      const { templates, fetchTemplates } = useSalaryTemplates()
      await fetchTemplates()

      expect(templates.value).toEqual([])
    })

    it('取得完了後は loading が false に戻る', async () => {
      mockFrom.mockReturnValue(buildSelectChain({ data: [], error: null }))

      const { loading, fetchTemplates } = useSalaryTemplates()
      await fetchTemplates()

      expect(loading.value).toBe(false)
    })

    it('Supabase エラー時: error にメッセージがセットされる', async () => {
      const chain = buildSelectChain({ data: null, error: null })
      chain['order'] = vi.fn().mockResolvedValue({ data: null, error: { message: 'DB エラー' } })
      mockFrom.mockReturnValue(chain)

      const { error, fetchTemplates } = useSalaryTemplates()
      await fetchTemplates()

      expect(error.value).toBe('DB エラー')
    })

    it('例外スロー時: error にメッセージがセットされる', async () => {
      const chain = buildSelectChain({ data: null, error: null })
      chain['order'] = vi.fn().mockRejectedValue(new Error('ネットワーク障害'))
      mockFrom.mockReturnValue(chain)

      const { error, fetchTemplates } = useSalaryTemplates()
      await fetchTemplates()

      expect(error.value).toBe('ネットワーク障害')
    })
  })

  // ----------------------------------------------------------------
  describe('fetchTemplateByEmployeeId', () => {
    it('存在する従業員IDで取得できる', async () => {
      const tmpl = makeTemplate()
      mockFrom.mockReturnValue(buildMaybeSingleChain({ data: tmpl, error: null }))

      const { fetchTemplateByEmployeeId } = useSalaryTemplates()
      const result = await fetchTemplateByEmployeeId('emp-001')

      expect(result).toEqual(tmpl)
    })

    it('存在しない場合 null が返る', async () => {
      mockFrom.mockReturnValue(buildMaybeSingleChain({ data: null, error: null }))

      const { fetchTemplateByEmployeeId } = useSalaryTemplates()
      const result = await fetchTemplateByEmployeeId('emp-999')

      expect(result).toBeNull()
    })

    it('エラー時は例外がスローされる', async () => {
      const chain = buildMaybeSingleChain({ data: null, error: null })
      chain['maybeSingle'] = vi.fn().mockResolvedValue({ data: null, error: { message: 'DB エラー' } })
      mockFrom.mockReturnValue(chain)

      const { fetchTemplateByEmployeeId } = useSalaryTemplates()
      await expect(fetchTemplateByEmployeeId('emp-001')).rejects.toThrow()
    })
  })

  // ----------------------------------------------------------------
  describe('upsertTemplate', () => {
    it('正常: SalaryTemplate が返る', async () => {
      const tmpl = makeTemplate()
      mockFrom.mockReturnValue(buildUpsertChain({ data: tmpl, error: null }))

      const { upsertTemplate } = useSalaryTemplates()
      const result = await upsertTemplate({
        employee_id:          'emp-001',
        basic_salary:         300_000,
        housing_allowance:    20_000,
        commute_allowance:    10_000,
        family_allowance:     0,
        position_allowance:   0,
        overtime_unit_price:  1_500,
        health_insurance:     15_000,
        pension_insurance:    27_000,
        employment_insurance: 1_000,
        income_tax:           8_000,
        resident_tax:         12_000,
        note:                 '',
        effective_from:       '2026-01-01',
      })

      expect(result).toEqual(tmpl)
    })

    it('note が空文字の場合 null に変換される', async () => {
      const tmpl = makeTemplate()
      const chain = buildUpsertChain({ data: tmpl, error: null })
      mockFrom.mockReturnValue(chain)

      const { upsertTemplate } = useSalaryTemplates()
      await upsertTemplate({
        employee_id: 'emp-001', basic_salary: 300_000,
        housing_allowance: 0, commute_allowance: 0, family_allowance: 0,
        position_allowance: 0, overtime_unit_price: 0,
        health_insurance: 0, pension_insurance: 0, employment_insurance: 0,
        income_tax: 0, resident_tax: 0,
        note: '', effective_from: '2026-01-01',
      })

      expect(chain['upsert']).toHaveBeenCalledWith(
        expect.objectContaining({ note: null }),
        expect.any(Object)
      )
    })

    it('エラー時は例外がスローされる', async () => {
      const chain = buildUpsertChain({ data: null, error: null })
      chain['single'] = vi.fn().mockResolvedValue({ data: null, error: { message: 'upsert 失敗' } })
      mockFrom.mockReturnValue(chain)

      const { upsertTemplate } = useSalaryTemplates()
      await expect(upsertTemplate({
        employee_id: 'emp-001', basic_salary: 300_000,
        housing_allowance: 0, commute_allowance: 0, family_allowance: 0,
        position_allowance: 0, overtime_unit_price: 0,
        health_insurance: 0, pension_insurance: 0, employment_insurance: 0,
        income_tax: 0, resident_tax: 0,
        note: '', effective_from: '2026-01-01',
      })).rejects.toThrow()
    })
  })

  // ----------------------------------------------------------------
  describe('deleteTemplate', () => {
    it('正常: エラーなし', async () => {
      mockFrom.mockReturnValue(buildDeleteChain({ error: null }))

      const { deleteTemplate } = useSalaryTemplates()
      await expect(deleteTemplate('tmpl-001')).resolves.not.toThrow()
    })

    it('エラー時は例外がスローされる', async () => {
      const chain = buildDeleteChain({ error: null })
      chain['eq'] = vi.fn().mockResolvedValue({ error: { message: '削除失敗' } })
      mockFrom.mockReturnValue(chain)

      const { deleteTemplate } = useSalaryTemplates()
      await expect(deleteTemplate('tmpl-001')).rejects.toThrow()
    })
  })
})

// ================================================================
// usePayslips
// ================================================================
describe('usePayslips', () => {
  describe('初期状態', () => {
    it('payslips は空配列', () => {
      const { payslips } = usePayslips()
      expect(payslips.value).toEqual([])
    })

    it('loading は false', () => {
      const { loading } = usePayslips()
      expect(loading.value).toBe(false)
    })

    it('error は null', () => {
      const { error } = usePayslips()
      expect(error.value).toBeNull()
    })

    it('filters の初期値が正しい', () => {
      const { filters } = usePayslips()
      expect(filters.value).toEqual({
        employee_id: '',
        pay_year:    '',
        pay_month:   '',
        status:      '',
      })
    })
  })

  // ----------------------------------------------------------------
  describe('fetchPayslips', () => {
    it('正常取得: payslips が更新される', async () => {
      const pay = makePayslip()
      const chain = buildSelectChain({ data: [pay], error: null })
      // fetchPayslips は .order を2回チェーンする
      chain['order'] = vi.fn().mockReturnValue(chain)
      // 2回目の order が resolve
      let callCount = 0
      chain['order'] = vi.fn().mockImplementation(() => {
        callCount++
        return callCount < 2 ? chain : Promise.resolve({ data: [pay], error: null })
      })
      mockFrom.mockReturnValue(chain)

      const { payslips, fetchPayslips } = usePayslips()
      await fetchPayslips()

      expect(payslips.value).toEqual([pay])
    })

    it('data が null のとき payslips は空配列', async () => {
      const chain: Record<string, ReturnType<typeof vi.fn>> = {}
      chain['select'] = vi.fn().mockReturnValue(chain)
      chain['order']  = vi.fn().mockReturnValue(chain)
      let callCount = 0
      chain['order']  = vi.fn().mockImplementation(() => {
        callCount++
        return callCount < 2 ? chain : Promise.resolve({ data: null, error: null })
      })
      mockFrom.mockReturnValue(chain)

      const { payslips, fetchPayslips } = usePayslips()
      await fetchPayslips()

      expect(payslips.value).toEqual([])
    })

    it('取得完了後は loading が false に戻る', async () => {
      const chain: Record<string, ReturnType<typeof vi.fn>> = {}
      chain['select'] = vi.fn().mockReturnValue(chain)
      let callCount = 0
      chain['order']  = vi.fn().mockImplementation(() => {
        callCount++
        return callCount < 2 ? chain : Promise.resolve({ data: [], error: null })
      })
      mockFrom.mockReturnValue(chain)

      const { loading, fetchPayslips } = usePayslips()
      await fetchPayslips()

      expect(loading.value).toBe(false)
    })
  })

  // ----------------------------------------------------------------
  describe('createPayslip', () => {
    it('正常: Payslip が返る', async () => {
      const pay = makePayslip()
      mockFrom.mockReturnValue(buildInsertChain({ data: pay, error: null }))

      const { createPayslip } = usePayslips()
      const result = await createPayslip({
        employee_id: 'emp-001', pay_year: 2026, pay_month: 3,
        basic_salary: 300_000, housing_allowance: 20_000,
        commute_allowance: 10_000, family_allowance: 0,
        position_allowance: 0, overtime_pay: 0, other_allowance: 0,
        health_insurance: 15_000, pension_insurance: 27_000,
        employment_insurance: 1_000, income_tax: 8_000,
        resident_tax: 12_000, other_deduction: 0, note: '',
      })

      expect(result).toEqual(pay)
    })

    it('status が draft で作成される', async () => {
      const pay = makePayslip()
      const chain = buildInsertChain({ data: pay, error: null })
      mockFrom.mockReturnValue(chain)

      const { createPayslip } = usePayslips()
      await createPayslip({
        employee_id: 'emp-001', pay_year: 2026, pay_month: 3,
        basic_salary: 300_000, housing_allowance: 0,
        commute_allowance: 0, family_allowance: 0,
        position_allowance: 0, overtime_pay: 0, other_allowance: 0,
        health_insurance: 0, pension_insurance: 0,
        employment_insurance: 0, income_tax: 0,
        resident_tax: 0, other_deduction: 0, note: '',
      })

      expect(chain['insert']).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'draft' })
      )
    })

    it('エラー時は例外がスローされる', async () => {
      const chain = buildInsertChain({ data: null, error: null })
      chain['single'] = vi.fn().mockResolvedValue({ data: null, error: { message: '重複エラー' } })
      mockFrom.mockReturnValue(chain)

      const { createPayslip } = usePayslips()
      await expect(createPayslip({
        employee_id: 'emp-001', pay_year: 2026, pay_month: 3,
        basic_salary: 300_000, housing_allowance: 0,
        commute_allowance: 0, family_allowance: 0,
        position_allowance: 0, overtime_pay: 0, other_allowance: 0,
        health_insurance: 0, pension_insurance: 0,
        employment_insurance: 0, income_tax: 0,
        resident_tax: 0, other_deduction: 0, note: '',
      })).rejects.toThrow()
    })
  })

  // ----------------------------------------------------------------
  describe('updatePayslip', () => {
    it('draft 状態なら更新できる', async () => {
      const draftPay   = makePayslip({ status: 'draft' })
      const updatedPay = makePayslip({ basic_salary: 350_000, status: 'draft' })

      // fetchPayslipById (maybeSingle) → updatePayslip (update chain)
      const maybeSingleChain = buildMaybeSingleChain({ data: draftPay, error: null })
      const updateChain      = buildUpdateChain({ data: updatedPay, error: null })
      mockFrom
        .mockReturnValueOnce(maybeSingleChain)
        .mockReturnValueOnce(updateChain)

      const { updatePayslip } = usePayslips()
      const result = await updatePayslip('pay-001', { basic_salary: 350_000 })

      expect(result).toEqual(updatedPay)
    })

    it('confirmed 状態のとき例外がスローされる', async () => {
      const confirmedPay = makePayslip({ status: 'confirmed' })
      mockFrom.mockReturnValue(buildMaybeSingleChain({ data: confirmedPay, error: null }))

      const { updatePayslip } = usePayslips()
      await expect(updatePayslip('pay-001', { basic_salary: 350_000 }))
        .rejects.toThrow('確定済みの給与明細は編集できません')
    })
  })

  // ----------------------------------------------------------------
  describe('confirmPayslip', () => {
    it('正常: エラーなし', async () => {
      const chain: Record<string, ReturnType<typeof vi.fn>> = {}
      chain['update'] = vi.fn().mockReturnValue(chain)
      chain['eq']     = vi.fn().mockReturnValue(chain)
      // 2回目の eq が resolve
      let eqCount = 0
      chain['eq'] = vi.fn().mockImplementation(() => {
        eqCount++
        return eqCount < 2 ? chain : Promise.resolve({ error: null })
      })
      mockFrom.mockReturnValue(chain)

      const { confirmPayslip } = usePayslips()
      await expect(confirmPayslip('pay-001', 'usr-001')).resolves.not.toThrow()
    })

    it('update に status: confirmed が渡される', async () => {
      const chain: Record<string, ReturnType<typeof vi.fn>> = {}
      chain['update'] = vi.fn().mockReturnValue(chain)
      let eqCount = 0
      chain['eq'] = vi.fn().mockImplementation(() => {
        eqCount++
        return eqCount < 2 ? chain : Promise.resolve({ error: null })
      })
      mockFrom.mockReturnValue(chain)

      const { confirmPayslip } = usePayslips()
      await confirmPayslip('pay-001', 'usr-001')

      expect(chain['update']).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'confirmed', confirmed_by: 'usr-001' })
      )
    })
  })

  // ----------------------------------------------------------------
  describe('deletePayslip', () => {
    it('draft 状態なら削除できる', async () => {
      const draftPay = makePayslip({ status: 'draft' })
      const maybeSingleChain = buildMaybeSingleChain({ data: draftPay, error: null })
      const deleteChain      = buildDeleteChain({ error: null })
      mockFrom
        .mockReturnValueOnce(maybeSingleChain)
        .mockReturnValueOnce(deleteChain)

      const { deletePayslip } = usePayslips()
      await expect(deletePayslip('pay-001')).resolves.not.toThrow()
    })

    it('confirmed 状態のとき例外がスローされる', async () => {
      const confirmedPay = makePayslip({ status: 'confirmed' })
      mockFrom.mockReturnValue(buildMaybeSingleChain({ data: confirmedPay, error: null }))

      const { deletePayslip } = usePayslips()
      await expect(deletePayslip('pay-001'))
        .rejects.toThrow('確定済みの給与明細は削除できません')
    })
  })

  // ----------------------------------------------------------------
  describe('generateFromTemplate', () => {
    it('テンプレートから給与明細が生成される', async () => {
      const tmpl = makeTemplate()
      const pay  = makePayslip()

      const maybeSingleChain = buildMaybeSingleChain({ data: tmpl, error: null })
      const insertChain      = buildInsertChain({ data: pay, error: null })
      mockFrom
        .mockReturnValueOnce(maybeSingleChain)
        .mockReturnValueOnce(insertChain)

      const { generateFromTemplate } = usePayslips()
      const result = await generateFromTemplate('emp-001', 2026, 3)

      expect(result).toEqual(pay)
    })

    it('overtime_pay と other_allowance は 0 で生成される', async () => {
      const tmpl = makeTemplate()
      const pay  = makePayslip()

      const maybeSingleChain = buildMaybeSingleChain({ data: tmpl, error: null })
      const insertChain      = buildInsertChain({ data: pay, error: null })
      mockFrom
        .mockReturnValueOnce(maybeSingleChain)
        .mockReturnValueOnce(insertChain)

      const { generateFromTemplate } = usePayslips()
      await generateFromTemplate('emp-001', 2026, 3)

      expect(insertChain['insert']).toHaveBeenCalledWith(
        expect.objectContaining({ overtime_pay: 0, other_allowance: 0, other_deduction: 0 })
      )
    })

    it('テンプレートが存在しない場合は例外がスローされる', async () => {
      mockFrom.mockReturnValue(buildMaybeSingleChain({ data: null, error: null }))

      const { generateFromTemplate } = usePayslips()
      await expect(generateFromTemplate('emp-999', 2026, 3))
        .rejects.toThrow('給与テンプレートが設定されていません')
    })

    it('テンプレート取得でエラーが発生した場合は例外がスローされる', async () => {
      const chain = buildMaybeSingleChain({ data: null, error: null })
      chain['maybeSingle'] = vi.fn().mockResolvedValue({ data: null, error: { message: 'DB エラー' } })
      mockFrom.mockReturnValue(chain)

      const { generateFromTemplate } = usePayslips()
      await expect(generateFromTemplate('emp-001', 2026, 3)).rejects.toThrow()
    })
  })

  // ----------------------------------------------------------------
  describe('applyFilters', () => {
    it('applyFilters を呼ぶと fetchPayslips が実行される', async () => {
      const chain: Record<string, ReturnType<typeof vi.fn>> = {}
      chain['select'] = vi.fn().mockReturnValue(chain)
      let callCount = 0
      chain['order']  = vi.fn().mockImplementation(() => {
        callCount++
        return callCount < 2 ? chain : Promise.resolve({ data: [], error: null })
      })
      mockFrom.mockReturnValue(chain)

      const { applyFilters } = usePayslips()
      applyFilters()

      // fetchPayslips が非同期で実行されることを確認
      expect(mockFrom).toHaveBeenCalledWith('payslips')
    })
  })
})
