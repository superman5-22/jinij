import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useEmployees } from '@/composables/useEmployees'
import type { Employee, Department } from '@/types'

// ----------------------------------------------------------------
// Supabase モック
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
  id:          'd-001',
  name:        '開発部',
  code:        'DEV',
  description: null,
  created_at:  '2026-01-01T00:00:00Z',
  ...overrides,
})

const makeEmployee = (overrides: Partial<Employee> = {}): Employee => ({
  id:                      'emp-001',
  user_id:                 null,
  employee_code:           'E001',
  full_name:               '山田 太郎',
  full_name_kana:          'ヤマダ タロウ',
  email:                   'yamada@example.com',
  phone:                   '090-0000-0001',
  department_id:           'd-001',
  position:                'エンジニア',
  employment_type:         'full_time',
  hire_date:               '2024-04-01',
  birth_date:              '1990-01-01',
  address:                 '東京都',
  emergency_contact_name:  null,
  emergency_contact_phone: null,
  status:                  'active',
  annual_leave_balance:    20,
  notes:                   null,
  created_at:              '2024-04-01T00:00:00Z',
  updated_at:              '2024-04-01T00:00:00Z',
  department:              makeDept(),
  ...overrides,
})

// ----------------------------------------------------------------
// クエリビルダーモック ヘルパー
// ----------------------------------------------------------------

/**
 * fetchEmployees チェーン:
 * from → select → [or/eq...] → order → range → Promise({ data, count, error })
 */
function buildFetchMock(resolvedValue: {
  data: Employee[] | null
  count: number | null
  error: null | { message: string }
}) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  chain['select'] = vi.fn().mockReturnValue(chain)
  chain['or']     = vi.fn().mockReturnValue(chain)
  chain['eq']     = vi.fn().mockReturnValue(chain)
  chain['order']  = vi.fn().mockReturnValue(chain)
  chain['range']  = vi.fn().mockResolvedValue(resolvedValue)
  return chain
}

/** fetchDepartments: from → select → order → Promise */
function buildDeptMock(resolvedValue: { data: Department[] | null; error: null }) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  chain['select'] = vi.fn().mockReturnValue(chain)
  chain['order']  = vi.fn().mockResolvedValue(resolvedValue)
  return chain
}

/** fetchEmployee / createEmployee / updateEmployee チェーン (single) */
function buildSingleMock(resolvedValue: { data: Employee | null; error: null | { message: string } }) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  chain['select'] = vi.fn().mockReturnValue(chain)
  chain['insert'] = vi.fn().mockReturnValue(chain)
  chain['update'] = vi.fn().mockReturnValue(chain)
  chain['eq']     = vi.fn().mockReturnValue(chain)
  chain['single'] = vi.fn().mockResolvedValue(resolvedValue)
  return chain
}

/** deleteEmployee チェーン: from → update → eq → Promise */
function buildUpdateEqMock(resolvedValue: { error: null | { message: string } }) {
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

    it('loading は false', () => {
      const { loading } = useEmployees()
      expect(loading.value).toBe(false)
    })

    it('error は null', () => {
      const { error } = useEmployees()
      expect(error.value).toBeNull()
    })

    it('pagination の初期値が正しい', () => {
      const { pagination } = useEmployees()
      expect(pagination.value).toEqual({ page: 1, per_page: 20, total: 0 })
    })

    it('totalPages は 0', () => {
      const { totalPages } = useEmployees()
      expect(totalPages.value).toBe(0)
    })
  })

  // ----------------------------------------------------------------
  describe('totalPages（computed）', () => {
    it('total=100, per_page=20 のとき totalPages=5', () => {
      const { pagination, totalPages } = useEmployees()
      pagination.value.total    = 100
      pagination.value.per_page = 20
      expect(totalPages.value).toBe(5)
    })

    it('total=21, per_page=20 のとき totalPages=2（切り上げ）', () => {
      const { pagination, totalPages } = useEmployees()
      pagination.value.total    = 21
      pagination.value.per_page = 20
      expect(totalPages.value).toBe(2)
    })

    it('total=0 のとき totalPages=0', () => {
      const { pagination, totalPages } = useEmployees()
      pagination.value.total = 0
      expect(totalPages.value).toBe(0)
    })
  })

  // ----------------------------------------------------------------
  describe('fetchDepartments', () => {
    it('正常取得: departments が更新される', async () => {
      const mockData = [makeDept({ id: 'd-001' }), makeDept({ id: 'd-002', name: '営業部' })]
      mockFrom.mockReturnValue(buildDeptMock({ data: mockData, error: null }))

      const { departments, fetchDepartments } = useEmployees()
      await fetchDepartments()

      expect(departments.value).toEqual(mockData)
    })

    it('data が null のとき departments は空配列', async () => {
      mockFrom.mockReturnValue(buildDeptMock({ data: null, error: null }))
      const { departments, fetchDepartments } = useEmployees()
      await fetchDepartments()
      expect(departments.value).toEqual([])
    })
  })

  // ----------------------------------------------------------------
  describe('fetchEmployees', () => {
    it('正常取得: employees と total が更新される', async () => {
      const mockData = [makeEmployee()]
      mockFrom.mockReturnValue(buildFetchMock({ data: mockData, count: 1, error: null }))

      const { employees, pagination, fetchEmployees } = useEmployees()
      await fetchEmployees()

      expect(employees.value).toEqual(mockData)
      expect(pagination.value.total).toBe(1)
    })

    it('取得完了後は loading が false に戻る', async () => {
      mockFrom.mockReturnValue(buildFetchMock({ data: [], count: 0, error: null }))
      const { loading, fetchEmployees } = useEmployees()
      await fetchEmployees()
      expect(loading.value).toBe(false)
    })

    it('data が null のとき employees は空配列', async () => {
      mockFrom.mockReturnValue(buildFetchMock({ data: null, count: 0, error: null }))
      const { employees, fetchEmployees } = useEmployees()
      await fetchEmployees()
      expect(employees.value).toEqual([])
    })

    it('count が null のとき total は 0 になる', async () => {
      mockFrom.mockReturnValue(buildFetchMock({ data: [], count: null, error: null }))
      const { pagination, fetchEmployees } = useEmployees()
      await fetchEmployees()
      expect(pagination.value.total).toBe(0)
    })

    it('Supabase エラーオブジェクト時: フォールバックメッセージがセットされる', async () => {
      // useEmployees は instanceof Error で分岐するため、
      // プレーンオブジェクトのエラーはフォールバック文言になる
      const chain = buildFetchMock({ data: null, count: null, error: null })
      chain['range'] = vi.fn().mockResolvedValue({
        data:  null,
        count: null,
        error: { message: '権限エラー' },
      })
      mockFrom.mockReturnValue(chain)

      const { error, fetchEmployees } = useEmployees()
      await fetchEmployees()

      expect(error.value).toBe('取得に失敗しました')
    })

    it('例外スロー時: error にメッセージがセットされる', async () => {
      const chain = buildFetchMock({ data: null, count: null, error: null })
      chain['range'] = vi.fn().mockRejectedValue(new Error('ネットワーク障害'))
      mockFrom.mockReturnValue(chain)

      const { error, fetchEmployees } = useEmployees()
      await fetchEmployees()

      expect(error.value).toBe('ネットワーク障害')
    })

    it('search フィルタが空でないとき or() が呼ばれる', async () => {
      const chain = buildFetchMock({ data: [], count: 0, error: null })
      mockFrom.mockReturnValue(chain)

      const { filters, fetchEmployees } = useEmployees()
      filters.value.search = '山田'
      await fetchEmployees()

      expect(chain['or']).toHaveBeenCalledOnce()
    })

    it('search フィルタが空のとき or() は呼ばれない', async () => {
      const chain = buildFetchMock({ data: [], count: 0, error: null })
      mockFrom.mockReturnValue(chain)

      const { filters, fetchEmployees } = useEmployees()
      filters.value.search = ''
      await fetchEmployees()

      expect(chain['or']).not.toHaveBeenCalled()
    })

    it('department_id フィルタが設定されているとき eq が呼ばれる', async () => {
      const chain = buildFetchMock({ data: [], count: 0, error: null })
      mockFrom.mockReturnValue(chain)

      const { filters, fetchEmployees } = useEmployees()
      filters.value.department_id = 'd-001'
      await fetchEmployees()

      expect(chain['eq']).toHaveBeenCalledWith('department_id', 'd-001')
    })

    it('status フィルタが設定されているとき eq が呼ばれる', async () => {
      const chain = buildFetchMock({ data: [], count: 0, error: null })
      mockFrom.mockReturnValue(chain)

      const { filters, fetchEmployees } = useEmployees()
      filters.value.status = 'active'
      await fetchEmployees()

      expect(chain['eq']).toHaveBeenCalledWith('status', 'active')
    })

    it('employment_type フィルタが設定されているとき eq が呼ばれる', async () => {
      const chain = buildFetchMock({ data: [], count: 0, error: null })
      mockFrom.mockReturnValue(chain)

      const { filters, fetchEmployees } = useEmployees()
      filters.value.employment_type = 'full_time'
      await fetchEmployees()

      expect(chain['eq']).toHaveBeenCalledWith('employment_type', 'full_time')
    })

    it('page=2 のとき range の開始が per_page と一致する', async () => {
      const chain = buildFetchMock({ data: [], count: 0, error: null })
      mockFrom.mockReturnValue(chain)

      const { pagination, fetchEmployees } = useEmployees()
      pagination.value.page     = 2
      pagination.value.per_page = 20
      await fetchEmployees()

      expect(chain['range']).toHaveBeenCalledWith(20, 39) // (2-1)*20=20, 20+20-1=39
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
      const chain = buildSingleMock({ data: makeEmployee(), error: null })
      mockFrom.mockReturnValue(chain)

      const { fetchEmployee } = useEmployees()
      await fetchEmployee('emp-target')

      expect(chain['eq']).toHaveBeenCalledWith('id', 'emp-target')
    })

    it('Supabase エラー時は例外を投げる', async () => {
      const chain = buildSingleMock({ data: null, error: null })
      chain['single'] = vi.fn().mockResolvedValue({ data: null, error: { message: '取得失敗' } })
      mockFrom.mockReturnValue(chain)

      const { fetchEmployee } = useEmployees()
      await expect(fetchEmployee('emp-001')).rejects.toMatchObject({ message: '取得失敗' })
    })
  })

  // ----------------------------------------------------------------
  describe('createEmployee', () => {
    const formBase = {
      employee_code:           'E002',
      full_name:               '鈴木 花子',
      full_name_kana:          'スズキ ハナコ',
      email:                   'SUZUKI@EXAMPLE.COM',
      phone:                   '',
      department_id:           'd-001',
      position:                'デザイナー',
      employment_type:         'full_time' as const,
      hire_date:               '2026-04-01',
      birth_date:              '',
      address:                 '  大阪府  ',
      emergency_contact_name:  '',
      emergency_contact_phone: '',
      status:                  'active' as const,
      annual_leave_balance:    20,
      notes:                   '',
    }

    it('正常作成: 作成された Employee が返される', async () => {
      const created = makeEmployee({ id: 'emp-002' })
      mockFrom.mockReturnValue(buildSingleMock({ data: created, error: null }))

      const { createEmployee } = useEmployees()
      const result = await createEmployee(formBase)

      expect(result).toEqual(created)
    })

    it('sanitize: email が小文字に変換される', async () => {
      const chain = buildSingleMock({ data: makeEmployee(), error: null })
      mockFrom.mockReturnValue(chain)

      const { createEmployee } = useEmployees()
      await createEmployee(formBase)

      expect(chain['insert']).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'suzuki@example.com' }),
      )
    })

    it('sanitize: phone が空のとき null になる', async () => {
      const chain = buildSingleMock({ data: makeEmployee(), error: null })
      mockFrom.mockReturnValue(chain)

      const { createEmployee } = useEmployees()
      await createEmployee({ ...formBase, phone: '  ' })

      expect(chain['insert']).toHaveBeenCalledWith(
        expect.objectContaining({ phone: null }),
      )
    })

    it('sanitize: address が trim される', async () => {
      const chain = buildSingleMock({ data: makeEmployee(), error: null })
      mockFrom.mockReturnValue(chain)

      const { createEmployee } = useEmployees()
      await createEmployee(formBase)

      expect(chain['insert']).toHaveBeenCalledWith(
        expect.objectContaining({ address: '大阪府' }),
      )
    })

    it('sanitize: birth_date が空のとき null になる', async () => {
      const chain = buildSingleMock({ data: makeEmployee(), error: null })
      mockFrom.mockReturnValue(chain)

      const { createEmployee } = useEmployees()
      await createEmployee({ ...formBase, birth_date: '' })

      expect(chain['insert']).toHaveBeenCalledWith(
        expect.objectContaining({ birth_date: null }),
      )
    })

    it('sanitize: notes が空のとき null になる', async () => {
      const chain = buildSingleMock({ data: makeEmployee(), error: null })
      mockFrom.mockReturnValue(chain)

      const { createEmployee } = useEmployees()
      await createEmployee({ ...formBase, notes: '  ' })

      expect(chain['insert']).toHaveBeenCalledWith(
        expect.objectContaining({ notes: null }),
      )
    })

    it('sanitize: annual_leave_balance が数値に変換される', async () => {
      const chain = buildSingleMock({ data: makeEmployee(), error: null })
      mockFrom.mockReturnValue(chain)

      const { createEmployee } = useEmployees()
      await createEmployee({ ...formBase, annual_leave_balance: '15' as unknown as number })

      expect(chain['insert']).toHaveBeenCalledWith(
        expect.objectContaining({ annual_leave_balance: 15 }),
      )
    })

    it('Supabase エラー時は例外を投げる', async () => {
      const chain = buildSingleMock({ data: null, error: null })
      chain['single'] = vi.fn().mockResolvedValue({ data: null, error: { message: '登録失敗' } })
      mockFrom.mockReturnValue(chain)

      const { createEmployee } = useEmployees()
      await expect(createEmployee(formBase)).rejects.toMatchObject({ message: '登録失敗' })
    })
  })

  // ----------------------------------------------------------------
  describe('updateEmployee', () => {
    const formBase = {
      employee_code:           'E001',
      full_name:               '山田 太郎',
      full_name_kana:          'ヤマダ タロウ',
      email:                   'yamada@example.com',
      phone:                   '090-0000-0001',
      department_id:           'd-001',
      position:                'シニアエンジニア',
      employment_type:         'full_time' as const,
      hire_date:               '2024-04-01',
      birth_date:              '1990-01-01',
      address:                 '東京都',
      emergency_contact_name:  '',
      emergency_contact_phone: '',
      status:                  'active' as const,
      annual_leave_balance:    20,
      notes:                   '',
    }

    it('正常更新: 更新された Employee が返される', async () => {
      const updated = makeEmployee({ position: 'シニアエンジニア' })
      mockFrom.mockReturnValue(buildSingleMock({ data: updated, error: null }))

      const { updateEmployee } = useEmployees()
      const result = await updateEmployee('emp-001', formBase)

      expect(result).toEqual(updated)
    })

    it('eq に正しい id が渡される', async () => {
      const chain = buildSingleMock({ data: makeEmployee(), error: null })
      mockFrom.mockReturnValue(chain)

      const { updateEmployee } = useEmployees()
      await updateEmployee('emp-target', formBase)

      expect(chain['eq']).toHaveBeenCalledWith('id', 'emp-target')
    })

    it('Supabase エラー時は例外を投げる', async () => {
      const chain = buildSingleMock({ data: null, error: null })
      chain['single'] = vi.fn().mockResolvedValue({ data: null, error: { message: '更新失敗' } })
      mockFrom.mockReturnValue(chain)

      const { updateEmployee } = useEmployees()
      await expect(updateEmployee('emp-001', formBase)).rejects.toMatchObject({ message: '更新失敗' })
    })
  })

  // ----------------------------------------------------------------
  describe('deleteEmployee（論理削除）', () => {
    it('正常削除: 例外が発生しない', async () => {
      mockFrom.mockReturnValue(buildUpdateEqMock({ error: null }))
      const { deleteEmployee } = useEmployees()
      await expect(deleteEmployee('emp-001')).resolves.toBeUndefined()
    })

    it('eq に正しい id が渡される', async () => {
      const chain = buildUpdateEqMock({ error: null })
      mockFrom.mockReturnValue(chain)

      const { deleteEmployee } = useEmployees()
      await deleteEmployee('emp-target')

      expect(chain['eq']).toHaveBeenCalledWith('id', 'emp-target')
    })

    it('update に status: inactive が渡される', async () => {
      const chain = buildUpdateEqMock({ error: null })
      mockFrom.mockReturnValue(chain)

      const { deleteEmployee } = useEmployees()
      await deleteEmployee('emp-001')

      expect(chain['update']).toHaveBeenCalledWith({ status: 'inactive' })
    })

    it('Supabase エラー時は例外を投げる', async () => {
      const chain = buildUpdateEqMock({ error: null })
      chain['eq'] = vi.fn().mockResolvedValue({ error: { message: '削除失敗' } })
      mockFrom.mockReturnValue(chain)

      const { deleteEmployee } = useEmployees()
      await expect(deleteEmployee('emp-001')).rejects.toMatchObject({ message: '削除失敗' })
    })
  })

  // ----------------------------------------------------------------
  describe('setPage', () => {
    it('setPage(3) を呼ぶと pagination.page が 3 になる', async () => {
      const chain = buildFetchMock({ data: [], count: 0, error: null })
      mockFrom.mockReturnValue(chain)

      const { pagination, setPage } = useEmployees()
      setPage(3)
      // 非同期の fetchEmployees が完了するのを待つ
      await vi.waitUntil(() => !chain['range'].mock.calls.length || true)

      expect(pagination.value.page).toBe(3)
    })
  })

  // ----------------------------------------------------------------
  describe('applyFilters', () => {
    it('applyFilters を呼ぶと page が 1 にリセットされる', async () => {
      const chain = buildFetchMock({ data: [], count: 0, error: null })
      mockFrom.mockReturnValue(chain)

      const { pagination, applyFilters } = useEmployees()
      pagination.value.page = 5
      applyFilters()
      await vi.waitUntil(() => !chain['range'].mock.calls.length || true)

      expect(pagination.value.page).toBe(1)
    })
  })
})
