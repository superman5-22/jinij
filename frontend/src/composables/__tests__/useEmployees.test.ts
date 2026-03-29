import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useEmployees } from '@/composables/useEmployees'
import type { Employee, Department } from '@/types'

// ----------------------------------------------------------------
// Supabase モック（vi.hoisted でホイスティング前に変数を確保）
// ----------------------------------------------------------------
const { mockFrom } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: mockFrom,
  },
}))

// ----------------------------------------------------------------
// テスト用データファクトリ
// ----------------------------------------------------------------
const makeDept = (overrides: Partial<Department> = {}): Department => ({
  id:          'dept-001',
  name:        '開発部',
  code:        'DEV',
  description: null,
  created_at:  '2026-01-01T00:00:00Z',
  ...overrides,
})

const makeEmployee = (overrides: Partial<Employee> = {}): Employee => ({
  id:                      'emp-001',
  user_id:                 'usr-001',
  employee_code:           'E001',
  full_name:               '山田 太郎',
  full_name_kana:          'ヤマダ タロウ',
  email:                   'yamada@example.com',
  phone:                   '090-0000-0001',
  department_id:           'dept-001',
  position:                'エンジニア',
  employment_type:         'full_time',
  hire_date:               '2024-04-01',
  birth_date:              '1990-01-01',
  address:                 '東京都渋谷区',
  emergency_contact_name:  '山田 花子',
  emergency_contact_phone: '090-0000-0002',
  status:                  'active',
  annual_leave_balance:    20,
  notes:                   null,
  created_at:              '2026-01-01T00:00:00Z',
  updated_at:              '2026-01-01T00:00:00Z',
  ...overrides,
})

// ----------------------------------------------------------------
// クエリビルダーモック ヘルパー
// ----------------------------------------------------------------

/**
 * fetchDepartments チェーン:
 * from → select → order (終端 Promise、count なし)
 */
function buildDeptSelectMock(
  resolvedValue: { data: Department[] | null; error: null | { message: string } }
) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  chain['select'] = vi.fn().mockReturnValue(chain)
  chain['order']  = vi.fn().mockResolvedValue(resolvedValue)
  return chain
}

/**
 * fetchEmployees チェーン:
 * from → select(*, { count: 'exact' }) → [or, eq, eq, eq（すべて任意）] → order → range (終端 Promise)
 */
function buildEmployeeListMock(
  resolvedValue: { data: Employee[] | null; count: number | null; error: null | { message: string } }
) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  chain['select'] = vi.fn().mockReturnValue(chain)
  chain['or']     = vi.fn().mockReturnValue(chain)
  chain['eq']     = vi.fn().mockReturnValue(chain)
  chain['order']  = vi.fn().mockReturnValue(chain)
  chain['range']  = vi.fn().mockResolvedValue(resolvedValue)
  return chain
}

/**
 * fetchEmployee チェーン:
 * from → select → eq → single (終端 Promise)
 */
function buildSingleMock(
  resolvedValue: { data: Employee | null; error: null | { message: string } }
) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  chain['select'] = vi.fn().mockReturnValue(chain)
  chain['eq']     = vi.fn().mockReturnValue(chain)
  chain['single'] = vi.fn().mockResolvedValue(resolvedValue)
  return chain
}

/**
 * createEmployee チェーン:
 * from → insert → select → single (終端 Promise)
 */
function buildInsertMock(
  resolvedValue: { data: Employee | null; error: null | { message: string } }
) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  chain['insert'] = vi.fn().mockReturnValue(chain)
  chain['select'] = vi.fn().mockReturnValue(chain)
  chain['single'] = vi.fn().mockResolvedValue(resolvedValue)
  return chain
}

/**
 * updateEmployee チェーン:
 * from → update → eq → select → single (終端 Promise)
 */
function buildUpdateSingleMock(
  resolvedValue: { data: Employee | null; error: null | { message: string } }
) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  chain['update'] = vi.fn().mockReturnValue(chain)
  chain['eq']     = vi.fn().mockReturnValue(chain)
  chain['select'] = vi.fn().mockReturnValue(chain)
  chain['single'] = vi.fn().mockResolvedValue(resolvedValue)
  return chain
}

/**
 * deleteEmployee チェーン（論理削除）:
 * from → update → eq (終端 Promise)
 */
function buildDeleteMock(
  resolvedValue: { error: null | { message: string } }
) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  chain['update'] = vi.fn().mockReturnValue(chain)
  chain['eq']     = vi.fn().mockResolvedValue(resolvedValue)
  return chain
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ================================================================
describe('useEmployees', () => {
  // ----------------------------------------------------------------
  describe('初期状態', () => {
    it('employees は空配列', () => {
      const { employees } = useEmployees()
      expect(employees.value).toEqual([])
    })

    it('departments は空配列', () => {
      const { departments } = useEmployees()
      expect(departments.value).toEqual([])
    })

    it('loading は false', () => {
      const { loading } = useEmployees()
      expect(loading.value).toBe(false)
    })

    it('error は null', () => {
      const { error } = useEmployees()
      expect(error.value).toBeNull()
    })

    it('pagination のデフォルト値が正しい', () => {
      const { pagination } = useEmployees()
      expect(pagination.value).toEqual({ page: 1, per_page: 20, total: 0 })
    })
  })

  // ----------------------------------------------------------------
  describe('totalPages (computed)', () => {
    it('total=0 の場合は 0', () => {
      const { totalPages } = useEmployees()
      expect(totalPages.value).toBe(0)
    })

    it('total=20 per_page=20 の場合は 1', () => {
      const { pagination, totalPages } = useEmployees()
      pagination.value.total = 20
      expect(totalPages.value).toBe(1)
    })

    it('total=21 per_page=20 の場合は 2（切り上げ）', () => {
      const { pagination, totalPages } = useEmployees()
      pagination.value.total = 21
      expect(totalPages.value).toBe(2)
    })
  })

  // ----------------------------------------------------------------
  describe('fetchDepartments', () => {
    it('正常取得: departments が更新される', async () => {
      const mockData = [makeDept({ id: 'dept-001' }), makeDept({ id: 'dept-002', name: '営業部' })]
      mockFrom.mockReturnValue(buildDeptSelectMock({ data: mockData, error: null }))

      const { departments, fetchDepartments } = useEmployees()
      await fetchDepartments()

      expect(departments.value).toEqual(mockData)
    })

    it('data が null のとき departments は空配列', async () => {
      mockFrom.mockReturnValue(buildDeptSelectMock({ data: null, error: null }))

      const { departments, fetchDepartments } = useEmployees()
      await fetchDepartments()

      expect(departments.value).toEqual([])
    })
  })

  // ----------------------------------------------------------------
  describe('fetchEmployees', () => {
    it('正常取得: employees と total が更新される', async () => {
      const mockData = [makeEmployee({ id: 'emp-001' }), makeEmployee({ id: 'emp-002' })]
      mockFrom.mockReturnValue(buildEmployeeListMock({ data: mockData, count: 2, error: null }))

      const { employees, pagination, fetchEmployees } = useEmployees()
      await fetchEmployees()

      expect(employees.value).toEqual(mockData)
      expect(pagination.value.total).toBe(2)
    })

    it('取得完了後は loading が false に戻る', async () => {
      mockFrom.mockReturnValue(buildEmployeeListMock({ data: [], count: 0, error: null }))

      const { loading, fetchEmployees } = useEmployees()
      await fetchEmployees()

      expect(loading.value).toBe(false)
    })

    it('data が null のとき employees は空配列', async () => {
      mockFrom.mockReturnValue(buildEmployeeListMock({ data: null, count: null, error: null }))

      const { employees, fetchEmployees } = useEmployees()
      await fetchEmployees()

      expect(employees.value).toEqual([])
    })

    it('Supabase エラー時: error にフォールバックメッセージがセットされる', async () => {
      // Supabase エラーオブジェクト（instanceof Error ではない）が throw された場合、
      // catch ブロックで '取得に失敗しました' にフォールバックする
      const chain = buildEmployeeListMock({ data: null, count: null, error: null })
      chain['range'] = vi.fn().mockResolvedValue({ data: null, count: null, error: { message: 'DB エラー' } })
      mockFrom.mockReturnValue(chain)

      const { error, fetchEmployees } = useEmployees()
      await fetchEmployees()

      expect(error.value).toBe('取得に失敗しました')
    })
  })

  // ----------------------------------------------------------------
  describe('fetchEmployees — フィルター適用', () => {
    it('search フィルター: or が呼ばれる', async () => {
      const chain = buildEmployeeListMock({ data: [], count: 0, error: null })
      mockFrom.mockReturnValue(chain)

      const { filters, fetchEmployees } = useEmployees()
      filters.value.search = '山田'
      await fetchEmployees()

      expect(chain['or']).toHaveBeenCalled()
    })

    it('department_id フィルター: eq が呼ばれる', async () => {
      const chain = buildEmployeeListMock({ data: [], count: 0, error: null })
      mockFrom.mockReturnValue(chain)

      const { filters, fetchEmployees } = useEmployees()
      filters.value.department_id = 'dept-001'
      await fetchEmployees()

      expect(chain['eq']).toHaveBeenCalledWith('department_id', 'dept-001')
    })

    it('status フィルター: eq が呼ばれる', async () => {
      const chain = buildEmployeeListMock({ data: [], count: 0, error: null })
      mockFrom.mockReturnValue(chain)

      const { filters, fetchEmployees } = useEmployees()
      filters.value.status = 'active'
      await fetchEmployees()

      expect(chain['eq']).toHaveBeenCalledWith('status', 'active')
    })

    it('employment_type フィルター: eq が呼ばれる', async () => {
      const chain = buildEmployeeListMock({ data: [], count: 0, error: null })
      mockFrom.mockReturnValue(chain)

      const { filters, fetchEmployees } = useEmployees()
      filters.value.employment_type = 'full_time'
      await fetchEmployees()

      expect(chain['eq']).toHaveBeenCalledWith('employment_type', 'full_time')
    })

    it('フィルターが空の場合: or は呼ばれない', async () => {
      const chain = buildEmployeeListMock({ data: [], count: 0, error: null })
      mockFrom.mockReturnValue(chain)

      const { fetchEmployees } = useEmployees()
      await fetchEmployees()

      expect(chain['or']).not.toHaveBeenCalled()
    })
  })

  // ----------------------------------------------------------------
  describe('fetchEmployee', () => {
    it('正常取得: Employee が返される', async () => {
      const emp = makeEmployee()
      mockFrom.mockReturnValue(buildSingleMock({ data: emp, error: null }))

      const { fetchEmployee } = useEmployees()
      const result = await fetchEmployee('emp-001')

      expect(result).toEqual(emp)
    })

    it('eq に正しい id が渡される', async () => {
      const singleChain = buildSingleMock({ data: makeEmployee(), error: null })
      mockFrom.mockReturnValue(singleChain)

      const { fetchEmployee } = useEmployees()
      await fetchEmployee('emp-target')

      expect(singleChain['eq']).toHaveBeenCalledWith('id', 'emp-target')
    })

    it('Supabase エラー時は例外を投げる', async () => {
      const chain = buildSingleMock({ data: null, error: null })
      chain['single'] = vi.fn().mockResolvedValue({ data: null, error: { message: '従業員が見つかりません' } })
      mockFrom.mockReturnValue(chain)

      const { fetchEmployee } = useEmployees()
      await expect(fetchEmployee('emp-999'))
        .rejects.toMatchObject({ message: '従業員が見つかりません' })
    })
  })

  // ----------------------------------------------------------------
  describe('createEmployee', () => {
    const baseForm = () => ({
      employee_code:           'E999',
      full_name:               '田中 花子',
      full_name_kana:          'タナカ ハナコ',
      email:                   'tanaka@example.com',
      phone:                   '090-1234-5678',
      department_id:           'dept-001',
      position:                'マネージャー',
      employment_type:         'full_time' as const,
      hire_date:               '2026-04-01',
      birth_date:              '1985-06-15',
      address:                 '大阪府大阪市',
      emergency_contact_name:  '田中 一郎',
      emergency_contact_phone: '080-9876-5432',
      status:                  'active' as const,
      annual_leave_balance:    20,
      notes:                   '',
    })

    it('正常登録: Employee が返される', async () => {
      const created = makeEmployee({ id: 'emp-new' })
      mockFrom.mockReturnValue(buildInsertMock({ data: created, error: null }))

      const { createEmployee } = useEmployees()
      const result = await createEmployee(baseForm())

      expect(result).toEqual(created)
    })

    it('sanitize: full_name が trim される', async () => {
      const insertChain = buildInsertMock({ data: makeEmployee(), error: null })
      mockFrom.mockReturnValue(insertChain)

      const { createEmployee } = useEmployees()
      await createEmployee({ ...baseForm(), full_name: '  田中 花子  ' })

      expect(insertChain['insert']).toHaveBeenCalledWith(
        expect.objectContaining({ full_name: '田中 花子' })
      )
    })

    it('sanitize: email が小文字化される', async () => {
      const insertChain = buildInsertMock({ data: makeEmployee(), error: null })
      mockFrom.mockReturnValue(insertChain)

      const { createEmployee } = useEmployees()
      await createEmployee({ ...baseForm(), email: 'TANAKA@EXAMPLE.COM' })

      expect(insertChain['insert']).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'tanaka@example.com' })
      )
    })

    it('sanitize: phone が空のとき null になる', async () => {
      const insertChain = buildInsertMock({ data: makeEmployee(), error: null })
      mockFrom.mockReturnValue(insertChain)

      const { createEmployee } = useEmployees()
      await createEmployee({ ...baseForm(), phone: '   ' })

      expect(insertChain['insert']).toHaveBeenCalledWith(
        expect.objectContaining({ phone: null })
      )
    })

    it('sanitize: birth_date が空のとき null になる', async () => {
      const insertChain = buildInsertMock({ data: makeEmployee(), error: null })
      mockFrom.mockReturnValue(insertChain)

      const { createEmployee } = useEmployees()
      await createEmployee({ ...baseForm(), birth_date: '' })

      expect(insertChain['insert']).toHaveBeenCalledWith(
        expect.objectContaining({ birth_date: null })
      )
    })

    it('sanitize: department_id が空のとき null になる', async () => {
      const insertChain = buildInsertMock({ data: makeEmployee(), error: null })
      mockFrom.mockReturnValue(insertChain)

      const { createEmployee } = useEmployees()
      await createEmployee({ ...baseForm(), department_id: '' })

      expect(insertChain['insert']).toHaveBeenCalledWith(
        expect.objectContaining({ department_id: null })
      )
    })

    it('sanitize: annual_leave_balance が数値に変換される', async () => {
      const insertChain = buildInsertMock({ data: makeEmployee(), error: null })
      mockFrom.mockReturnValue(insertChain)

      const { createEmployee } = useEmployees()
      // number型として渡すが、Number() 変換を通ることを確認
      await createEmployee({ ...baseForm(), annual_leave_balance: 15 })

      expect(insertChain['insert']).toHaveBeenCalledWith(
        expect.objectContaining({ annual_leave_balance: 15 })
      )
    })

    it('Supabase エラー時は例外を投げる', async () => {
      const chain = buildInsertMock({ data: null, error: null })
      chain['single'] = vi.fn().mockResolvedValue({ data: null, error: { message: '登録失敗' } })
      mockFrom.mockReturnValue(chain)

      const { createEmployee } = useEmployees()
      await expect(createEmployee(baseForm())).rejects.toMatchObject({ message: '登録失敗' })
    })
  })

  // ----------------------------------------------------------------
  describe('updateEmployee', () => {
    const baseForm = () => ({
      employee_code:           'E001',
      full_name:               '山田 太郎',
      full_name_kana:          'ヤマダ タロウ',
      email:                   'yamada@example.com',
      phone:                   '',
      department_id:           'dept-001',
      position:                'エンジニア',
      employment_type:         'full_time' as const,
      hire_date:               '2024-04-01',
      birth_date:              '',
      address:                 '',
      emergency_contact_name:  '',
      emergency_contact_phone: '',
      status:                  'active' as const,
      annual_leave_balance:    20,
      notes:                   '',
    })

    it('正常更新: 更新済み Employee が返される', async () => {
      const updated = makeEmployee({ full_name: '山田 次郎' })
      mockFrom.mockReturnValue(buildUpdateSingleMock({ data: updated, error: null }))

      const { updateEmployee } = useEmployees()
      const result = await updateEmployee('emp-001', baseForm())

      expect(result).toEqual(updated)
    })

    it('eq に正しい id が渡される', async () => {
      const updateChain = buildUpdateSingleMock({ data: makeEmployee(), error: null })
      mockFrom.mockReturnValue(updateChain)

      const { updateEmployee } = useEmployees()
      await updateEmployee('emp-target', baseForm())

      expect(updateChain['eq']).toHaveBeenCalledWith('id', 'emp-target')
    })

    it('Supabase エラー時は例外を投げる', async () => {
      const chain = buildUpdateSingleMock({ data: null, error: null })
      chain['single'] = vi.fn().mockResolvedValue({ data: null, error: { message: '更新失敗' } })
      mockFrom.mockReturnValue(chain)

      const { updateEmployee } = useEmployees()
      await expect(updateEmployee('emp-001', baseForm())).rejects.toMatchObject({ message: '更新失敗' })
    })
  })

  // ----------------------------------------------------------------
  describe('deleteEmployee（論理削除）', () => {
    it('正常削除: 例外が発生しない', async () => {
      mockFrom.mockReturnValue(buildDeleteMock({ error: null }))

      const { deleteEmployee } = useEmployees()
      await expect(deleteEmployee('emp-001')).resolves.toBeUndefined()
    })

    it('status: inactive が渡される（論理削除）', async () => {
      const deleteChain = buildDeleteMock({ error: null })
      mockFrom.mockReturnValue(deleteChain)

      const { deleteEmployee } = useEmployees()
      await deleteEmployee('emp-001')

      expect(deleteChain['update']).toHaveBeenCalledWith({ status: 'inactive' })
    })

    it('eq に正しい id が渡される', async () => {
      const deleteChain = buildDeleteMock({ error: null })
      mockFrom.mockReturnValue(deleteChain)

      const { deleteEmployee } = useEmployees()
      await deleteEmployee('emp-target')

      expect(deleteChain['eq']).toHaveBeenCalledWith('id', 'emp-target')
    })

    it('Supabase エラー時は例外を投げる', async () => {
      const chain = buildDeleteMock({ error: null })
      chain['eq'] = vi.fn().mockResolvedValue({ error: { message: '削除失敗' } })
      mockFrom.mockReturnValue(chain)

      const { deleteEmployee } = useEmployees()
      await expect(deleteEmployee('emp-001')).rejects.toMatchObject({ message: '削除失敗' })
    })
  })

  // ----------------------------------------------------------------
  describe('setPage', () => {
    it('setPage を呼ぶと pagination.page が変わる', async () => {
      mockFrom.mockReturnValue(buildEmployeeListMock({ data: [], count: 0, error: null }))

      const { pagination, setPage } = useEmployees()
      setPage(3)

      expect(pagination.value.page).toBe(3)
    })

    it('setPage を呼ぶと fetchEmployees が実行される', async () => {
      mockFrom.mockReturnValue(buildEmployeeListMock({ data: [], count: 0, error: null }))

      const { setPage } = useEmployees()
      setPage(2)

      expect(mockFrom).toHaveBeenCalledWith('employees')
    })
  })

  // ----------------------------------------------------------------
  describe('applyFilters', () => {
    it('applyFilters を呼ぶと page が 1 にリセットされる', async () => {
      mockFrom.mockReturnValue(buildEmployeeListMock({ data: [], count: 0, error: null }))

      const { pagination, applyFilters } = useEmployees()
      pagination.value.page = 5
      applyFilters()

      expect(pagination.value.page).toBe(1)
    })

    it('applyFilters を呼ぶと fetchEmployees が実行される', async () => {
      mockFrom.mockReturnValue(buildEmployeeListMock({ data: [], count: 0, error: null }))

      const { applyFilters } = useEmployees()
      applyFilters()

      expect(mockFrom).toHaveBeenCalledWith('employees')
    })
  })
})
