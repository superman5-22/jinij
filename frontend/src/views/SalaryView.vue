<template>
  <div class="container-fluid py-4">
    <!-- ヘッダー -->
    <div class="d-flex align-items-center justify-content-between mb-4 flex-wrap gap-2">
      <div>
        <h1 class="h3 mb-1">給与管理</h1>
        <p class="text-muted mb-0">給与明細の確認・登録・編集</p>
      </div>
      <button
        v-if="auth.isHR"
        class="btn btn-primary"
        @click="openModal(null)"
      >
        <i class="bi bi-plus-lg me-1"></i>新規登録
      </button>
    </div>

    <!-- エラー -->
    <div v-if="error" class="alert alert-danger alert-dismissible fade show" role="alert">
      <i class="bi bi-exclamation-triangle-fill me-2"></i>{{ error }}
      <button type="button" class="btn-close" @click="error = null"></button>
    </div>

    <!-- フィルター -->
    <div class="card border-0 shadow-sm mb-4">
      <div class="card-body">
        <div class="row g-3 align-items-end">
          <!-- 従業員（hr/admin のみ） -->
          <div v-if="auth.isHR" class="col-md-4">
            <label class="form-label small fw-semibold">従業員</label>
            <select v-model="filters.employee_id" class="form-select form-select-sm">
              <option value="">全従業員</option>
              <option
                v-for="emp in employees"
                :key="emp.id"
                :value="emp.id"
              >{{ emp.full_name }} ({{ emp.employee_code }})</option>
            </select>
          </div>
          <!-- 年 -->
          <div class="col-md-3">
            <label class="form-label small fw-semibold">年</label>
            <select v-model="filters.year" class="form-select form-select-sm">
              <option value="">全年度</option>
              <option v-for="y in yearOptions" :key="y" :value="y">{{ y }}年</option>
            </select>
          </div>
          <!-- 月 -->
          <div class="col-md-3">
            <label class="form-label small fw-semibold">月</label>
            <select v-model="filters.month" class="form-select form-select-sm">
              <option value="">全月</option>
              <option v-for="m in 12" :key="m" :value="m">{{ m }}月</option>
            </select>
          </div>
          <!-- 検索ボタン -->
          <div class="col-md-2">
            <button class="btn btn-outline-primary btn-sm w-100" @click="search">
              <i class="bi bi-search me-1"></i>絞り込み
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- テーブル -->
    <div class="card border-0 shadow-sm">
      <div class="card-body p-0">
        <!-- ローディング -->
        <div v-if="isLoading" class="text-center py-5">
          <div class="spinner-border text-primary" role="status"></div>
        </div>

        <!-- データなし -->
        <div v-else-if="records.length === 0" class="text-center py-5 text-muted">
          <i class="bi bi-inbox display-6 d-block mb-2"></i>
          給与明細が見つかりません
        </div>

        <!-- テーブル本体 -->
        <div v-else class="table-responsive">
          <table class="table table-hover mb-0 align-middle">
            <thead class="table-light">
              <tr>
                <th class="ps-4">対象期間</th>
                <th v-if="auth.isHR">従業員</th>
                <th class="text-end">基本給</th>
                <th class="text-end">残業手当</th>
                <th class="text-end">各種手当</th>
                <th class="text-end">控除合計</th>
                <th class="text-end fw-bold">手取り</th>
                <th>支払日</th>
                <th v-if="auth.isHR" class="text-center">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="rec in records" :key="rec.id">
                <td class="ps-4 fw-semibold">
                  {{ rec.year }}年{{ rec.month }}月
                </td>
                <td v-if="auth.isHR" class="text-muted small">
                  {{ rec.employee?.full_name ?? '-' }}
                </td>
                <td class="text-end">{{ formatCurrency(rec.base_salary) }}</td>
                <td class="text-end">{{ formatCurrency(rec.overtime_pay) }}</td>
                <td class="text-end">{{ formatCurrency(rec.allowances) }}</td>
                <td class="text-end text-danger">{{ formatCurrency(rec.deductions) }}</td>
                <td class="text-end fw-bold text-success">
                  {{ formatCurrency(rec.net_salary) }}
                </td>
                <td class="text-muted small">{{ rec.paid_at ?? '-' }}</td>
                <td v-if="auth.isHR" class="text-center">
                  <div class="d-flex gap-1 justify-content-center">
                    <button
                      class="btn btn-sm btn-outline-secondary"
                      title="編集"
                      @click="openModal(rec)"
                    >
                      <i class="bi bi-pencil"></i>
                    </button>
                    <button
                      class="btn btn-sm btn-outline-danger"
                      title="削除"
                      @click="confirmDelete(rec)"
                    >
                      <i class="bi bi-trash"></i>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- ===== 登録・編集モーダル ===== -->
    <div
      v-if="showModal"
      class="modal fade show d-block"
      tabindex="-1"
      role="dialog"
      style="background: rgba(0,0,0,.45)"
      @click.self="closeModal"
    >
      <div class="modal-dialog modal-lg modal-dialog-centered" role="document">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">
              {{ editTarget ? '給与明細 編集' : '給与明細 新規登録' }}
            </h5>
            <button type="button" class="btn-close" @click="closeModal"></button>
          </div>

          <form @submit.prevent="saveRecord">
            <div class="modal-body">
              <div class="row g-3">
                <!-- 従業員 -->
                <div class="col-md-6">
                  <label class="form-label fw-semibold">従業員 <span class="text-danger">*</span></label>
                  <select
                    v-model="form.employee_id"
                    class="form-select"
                    :disabled="!!editTarget"
                    required
                  >
                    <option value="">選択してください</option>
                    <option
                      v-for="emp in employees"
                      :key="emp.id"
                      :value="emp.id"
                    >{{ emp.full_name }} ({{ emp.employee_code }})</option>
                  </select>
                </div>
                <!-- 年月 -->
                <div class="col-md-3">
                  <label class="form-label fw-semibold">年 <span class="text-danger">*</span></label>
                  <input
                    v-model.number="form.year"
                    type="number"
                    class="form-control"
                    min="2000"
                    max="2099"
                    :disabled="!!editTarget"
                    required
                  />
                </div>
                <div class="col-md-3">
                  <label class="form-label fw-semibold">月 <span class="text-danger">*</span></label>
                  <select
                    v-model.number="form.month"
                    class="form-select"
                    :disabled="!!editTarget"
                    required
                  >
                    <option v-for="m in 12" :key="m" :value="m">{{ m }}月</option>
                  </select>
                </div>
                <!-- 基本給 -->
                <div class="col-md-6">
                  <label class="form-label fw-semibold">基本給（円）</label>
                  <input
                    v-model.number="form.base_salary"
                    type="number"
                    class="form-control"
                    min="0"
                    step="1"
                  />
                </div>
                <!-- 残業手当 -->
                <div class="col-md-6">
                  <label class="form-label fw-semibold">残業手当（円）</label>
                  <input
                    v-model.number="form.overtime_pay"
                    type="number"
                    class="form-control"
                    min="0"
                    step="1"
                  />
                </div>
                <!-- 各種手当 -->
                <div class="col-md-6">
                  <label class="form-label fw-semibold">各種手当（円）</label>
                  <input
                    v-model.number="form.allowances"
                    type="number"
                    class="form-control"
                    min="0"
                    step="1"
                  />
                </div>
                <!-- 控除合計 -->
                <div class="col-md-6">
                  <label class="form-label fw-semibold">控除合計（円）</label>
                  <input
                    v-model.number="form.deductions"
                    type="number"
                    class="form-control"
                    min="0"
                    step="1"
                  />
                </div>
                <!-- 手取り（計算表示） -->
                <div class="col-12">
                  <div class="alert alert-info mb-0 py-2">
                    <span class="fw-semibold">手取り（自動計算）：</span>
                    <span class="fs-5 fw-bold ms-2">{{ formatCurrency(computedNetSalary) }}</span>
                  </div>
                </div>
                <!-- 支払日 -->
                <div class="col-md-6">
                  <label class="form-label fw-semibold">支払日</label>
                  <input
                    v-model="form.paid_at"
                    type="date"
                    class="form-control"
                  />
                </div>
                <!-- 備考 -->
                <div class="col-12">
                  <label class="form-label fw-semibold">備考</label>
                  <textarea
                    v-model="form.notes"
                    class="form-control"
                    rows="2"
                    placeholder="備考・特記事項"
                  ></textarea>
                </div>
              </div>
            </div>

            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" @click="closeModal">
                キャンセル
              </button>
              <button type="submit" class="btn btn-primary" :disabled="isLoading">
                <span v-if="isLoading" class="spinner-border spinner-border-sm me-1"></span>
                {{ editTarget ? '保存' : '登録' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useSalary } from '@/composables/useSalary'
import { supabase } from '@/lib/supabase'
import type { SalaryRecord, SalaryFormData, Employee } from '@/types'

const auth    = useAuthStore()
const { records, isLoading, error, fetchRecords, createRecord, updateRecord, deleteRecord } = useSalary()

// ----------------------------------------------------------------
// 従業員一覧（フォーム用）
// ----------------------------------------------------------------
const employees = ref<Pick<Employee, 'id' | 'full_name' | 'employee_code'>[]>([])

async function loadEmployees() {
  const { data } = await supabase
    .from('employees')
    .select('id, full_name, employee_code')
    .eq('status', 'active')
    .order('full_name')
  employees.value = data ?? []
}

// ----------------------------------------------------------------
// フィルター
// ----------------------------------------------------------------
const currentYear = new Date().getFullYear()
const yearOptions = computed(() => {
  const years: number[] = []
  for (let y = currentYear; y >= currentYear - 4; y--) years.push(y)
  return years
})

const filters = ref({
  employee_id: '',
  year:        currentYear as number | '',
  month:       (new Date().getMonth() + 1) as number | '',
})

async function search() {
  await fetchRecords({
    employee_id: filters.value.employee_id || undefined,
    year:        filters.value.year   !== '' ? filters.value.year   : undefined,
    month:       filters.value.month  !== '' ? filters.value.month  : undefined,
  })
}

// ----------------------------------------------------------------
// モーダル
// ----------------------------------------------------------------
const showModal   = ref(false)
const editTarget  = ref<SalaryRecord | null>(null)

const defaultForm = (): SalaryFormData => ({
  employee_id:  '',
  year:         currentYear,
  month:        new Date().getMonth() + 1,
  base_salary:  0,
  overtime_pay: 0,
  allowances:   0,
  deductions:   0,
  paid_at:      '',
  notes:        '',
})

const form = ref<SalaryFormData>(defaultForm())

const computedNetSalary = computed(
  () => form.value.base_salary + form.value.overtime_pay + form.value.allowances - form.value.deductions
)

function openModal(rec: SalaryRecord | null) {
  editTarget.value = rec
  if (rec) {
    form.value = {
      employee_id:  rec.employee_id,
      year:         rec.year,
      month:        rec.month,
      base_salary:  rec.base_salary,
      overtime_pay: rec.overtime_pay,
      allowances:   rec.allowances,
      deductions:   rec.deductions,
      paid_at:      rec.paid_at ?? '',
      notes:        rec.notes   ?? '',
    }
  } else {
    form.value = defaultForm()
  }
  showModal.value = true
}

function closeModal() {
  showModal.value = false
  editTarget.value = null
}

async function saveRecord() {
  if (editTarget.value) {
    await updateRecord(editTarget.value.id, form.value)
  } else {
    await createRecord(form.value)
  }
  if (!error.value) {
    closeModal()
    await search()
  }
}

// ----------------------------------------------------------------
// 削除
// ----------------------------------------------------------------
async function confirmDelete(rec: SalaryRecord) {
  if (!confirm(`${rec.year}年${rec.month}月の給与明細を削除しますか？`)) return
  await deleteRecord(rec.id)
}

// ----------------------------------------------------------------
// フォーマット
// ----------------------------------------------------------------
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(value)
}

// ----------------------------------------------------------------
// 初期化
// ----------------------------------------------------------------
onMounted(async () => {
  await Promise.all([loadEmployees(), search()])
})
</script>
