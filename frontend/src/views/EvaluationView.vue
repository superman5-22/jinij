<template>
  <div class="container-fluid py-4">
    <!-- ヘッダー -->
    <div class="d-flex align-items-center justify-content-between mb-4 flex-wrap gap-2">
      <div>
        <h1 class="h3 mb-1">人事評価管理</h1>
        <p class="text-muted mb-0">従業員のパフォーマンス評価の登録・確認</p>
      </div>
      <button
        v-if="canEdit"
        class="btn btn-primary"
        @click="openModal(null)"
      >
        <i class="bi bi-plus-lg me-1"></i>新規評価登録
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
          <div v-if="canEdit" class="col-md-3">
            <label class="form-label small fw-semibold">従業員</label>
            <select v-model="filters.employee_id" class="form-select form-select-sm">
              <option value="">全従業員</option>
              <option v-for="emp in employees" :key="emp.id" :value="emp.id">
                {{ emp.full_name }} ({{ emp.employee_code }})
              </option>
            </select>
          </div>
          <div class="col-md-2">
            <label class="form-label small fw-semibold">年度</label>
            <select v-model="filters.year" class="form-select form-select-sm">
              <option value="">全年度</option>
              <option v-for="y in yearOptions" :key="y" :value="y">{{ y }}年</option>
            </select>
          </div>
          <div class="col-md-2">
            <label class="form-label small fw-semibold">四半期</label>
            <select v-model="filters.quarter" class="form-select form-select-sm">
              <option value="">全四半期</option>
              <option :value="1">Q1（1-3月）</option>
              <option :value="2">Q2（4-6月）</option>
              <option :value="3">Q3（7-9月）</option>
              <option :value="4">Q4（10-12月）</option>
            </select>
          </div>
          <div class="col-md-2">
            <label class="form-label small fw-semibold">ステータス</label>
            <select v-model="filters.status" class="form-select form-select-sm">
              <option value="">全ステータス</option>
              <option v-for="(label, key) in EVALUATION_STATUS_LABELS" :key="key" :value="key">
                {{ label }}
              </option>
            </select>
          </div>
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
        <div v-if="isLoading" class="text-center py-5">
          <div class="spinner-border text-primary" role="status"></div>
        </div>

        <div v-else-if="records.length === 0" class="text-center py-5 text-muted">
          <i class="bi bi-clipboard-x display-6 d-block mb-2"></i>
          評価レコードが見つかりません
        </div>

        <div v-else class="table-responsive">
          <table class="table table-hover mb-0 align-middle">
            <thead class="table-light">
              <tr>
                <th class="ps-4">対象期間</th>
                <th v-if="canEdit">従業員</th>
                <th class="text-center">業績</th>
                <th class="text-center">チームワーク</th>
                <th class="text-center">コミュニケーション</th>
                <th class="text-center">リーダーシップ</th>
                <th class="text-center">成長</th>
                <th class="text-center fw-bold">総合</th>
                <th>ステータス</th>
                <th v-if="canEdit" class="text-center">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="rec in records" :key="rec.id">
                <td class="ps-4 fw-semibold">
                  {{ rec.year }}年 Q{{ rec.quarter }}
                </td>
                <td v-if="canEdit" class="text-muted small">
                  {{ rec.employee?.full_name ?? '-' }}
                </td>
                <td class="text-center">
                  <ScoreStars :score="rec.score_performance" />
                </td>
                <td class="text-center">
                  <ScoreStars :score="rec.score_teamwork" />
                </td>
                <td class="text-center">
                  <ScoreStars :score="rec.score_communication" />
                </td>
                <td class="text-center">
                  <ScoreStars :score="rec.score_leadership" />
                </td>
                <td class="text-center">
                  <ScoreStars :score="rec.score_growth" />
                </td>
                <td class="text-center">
                  <span :class="overallBadgeClass(rec.overall_score)" class="badge fs-6">
                    {{ Number(rec.overall_score).toFixed(1) }}
                  </span>
                </td>
                <td>
                  <span :class="statusBadgeClass(rec.status)" class="badge">
                    {{ EVALUATION_STATUS_LABELS[rec.status] }}
                  </span>
                </td>
                <td v-if="canEdit" class="text-center">
                  <div class="d-flex gap-1 justify-content-center">
                    <button
                      class="btn btn-sm btn-outline-secondary"
                      title="編集"
                      :disabled="rec.status === 'finalized'"
                      @click="openModal(rec)"
                    >
                      <i class="bi bi-pencil"></i>
                    </button>
                    <button
                      v-if="rec.status === 'draft'"
                      class="btn btn-sm btn-outline-primary"
                      title="提出"
                      @click="submitEvaluation(rec.id)"
                    >
                      <i class="bi bi-send"></i>
                    </button>
                    <button
                      v-if="rec.status === 'submitted' && auth.isHR"
                      class="btn btn-sm btn-outline-success"
                      title="確定"
                      @click="finalizeEvaluation(rec.id)"
                    >
                      <i class="bi bi-check-lg"></i>
                    </button>
                    <button
                      class="btn btn-sm btn-outline-danger"
                      title="削除"
                      :disabled="rec.status === 'finalized'"
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
              {{ editTarget ? '人事評価 編集' : '人事評価 新規登録' }}
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
                    <option v-for="emp in employees" :key="emp.id" :value="emp.id">
                      {{ emp.full_name }} ({{ emp.employee_code }})
                    </option>
                  </select>
                </div>
                <!-- 年度 -->
                <div class="col-md-3">
                  <label class="form-label fw-semibold">年度 <span class="text-danger">*</span></label>
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
                <!-- 四半期 -->
                <div class="col-md-3">
                  <label class="form-label fw-semibold">四半期 <span class="text-danger">*</span></label>
                  <select
                    v-model.number="form.quarter"
                    class="form-select"
                    :disabled="!!editTarget"
                    required
                  >
                    <option :value="1">Q1（1-3月）</option>
                    <option :value="2">Q2（4-6月）</option>
                    <option :value="3">Q3（7-9月）</option>
                    <option :value="4">Q4（10-12月）</option>
                  </select>
                </div>

                <!-- 評価スコア -->
                <div class="col-12">
                  <hr class="my-1" />
                  <p class="fw-semibold mb-2">評価スコア（各1〜5点）</p>
                </div>
                <div v-for="item in scoreItems" :key="item.key" class="col-md-6">
                  <label class="form-label fw-semibold">{{ item.label }}</label>
                  <div class="d-flex gap-2 align-items-center">
                    <input
                      v-model.number="(form as Record<string, number>)[item.key]"
                      type="range"
                      class="form-range flex-grow-1"
                      min="1"
                      max="5"
                      step="1"
                    />
                    <span class="badge bg-primary fs-6" style="min-width:2.5rem">
                      {{ (form as Record<string, number>)[item.key] }}
                    </span>
                  </div>
                  <div class="text-muted small">
                    {{ EVALUATION_SCORE_LABELS[(form as Record<string, number>)[item.key]] }}
                  </div>
                </div>

                <!-- 総合スコア（プレビュー） -->
                <div class="col-12">
                  <div class="alert alert-info mb-0 py-2">
                    <span class="fw-semibold">総合スコア（自動計算）：</span>
                    <span class="fs-5 fw-bold ms-2">{{ previewOverallScore }}</span>
                  </div>
                </div>

                <!-- コメント -->
                <div class="col-12">
                  <label class="form-label fw-semibold">評価コメント</label>
                  <textarea
                    v-model="form.comment"
                    class="form-control"
                    rows="3"
                    placeholder="強み・改善点などを記入してください"
                  ></textarea>
                </div>
                <!-- ステータス -->
                <div class="col-md-4">
                  <label class="form-label fw-semibold">ステータス</label>
                  <select v-model="form.status" class="form-select">
                    <option value="draft">下書き</option>
                    <option value="submitted">提出済み</option>
                    <option v-if="auth.isHR" value="finalized">確定</option>
                  </select>
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
import { ref, computed, onMounted, defineComponent, h } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useEvaluations } from '@/composables/useEvaluations'
import { supabase } from '@/lib/supabase'
import {
  EVALUATION_STATUS_LABELS,
  EVALUATION_SCORE_LABELS,
  type EvaluationRecord,
  type EvaluationFormData,
  type EvaluationStatus,
  type Employee,
} from '@/types'

// ----------------------------------------------------------------
// インラインコンポーネント: 星表示
// ----------------------------------------------------------------
const ScoreStars = defineComponent({
  props: { score: { type: Number, required: true } },
  setup(props) {
    return () => h('span', { class: 'text-warning small' },
      Array.from({ length: 5 }, (_, i) =>
        h('i', { class: i < props.score ? 'bi bi-star-fill' : 'bi bi-star' })
      )
    )
  },
})

const auth = useAuthStore()
const { records, isLoading, error, fetchRecords, createRecord, updateRecord, changeStatus, deleteRecord } = useEvaluations()

const canEdit = computed(() => auth.isHR || auth.isManager || auth.isAdmin)

// ----------------------------------------------------------------
// 従業員一覧
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
  quarter:     '' as 1 | 2 | 3 | 4 | '',
  status:      '' as EvaluationStatus | '',
})

async function search() {
  await fetchRecords({
    employee_id: filters.value.employee_id || undefined,
    year:        filters.value.year    !== '' ? filters.value.year    : undefined,
    quarter:     filters.value.quarter !== '' ? filters.value.quarter : undefined,
    status:      filters.value.status  !== '' ? filters.value.status  : undefined,
  })
}

// ----------------------------------------------------------------
// スコア項目
// ----------------------------------------------------------------
const scoreItems = [
  { key: 'score_performance',   label: '業績・目標達成度' },
  { key: 'score_teamwork',      label: 'チームワーク' },
  { key: 'score_communication', label: 'コミュニケーション' },
  { key: 'score_leadership',    label: 'リーダーシップ' },
  { key: 'score_growth',        label: '成長・学習意欲' },
]

// ----------------------------------------------------------------
// モーダル
// ----------------------------------------------------------------
const showModal  = ref(false)
const editTarget = ref<EvaluationRecord | null>(null)

const defaultForm = (): EvaluationFormData => ({
  employee_id:          '',
  year:                 currentYear,
  quarter:              Math.ceil((new Date().getMonth() + 1) / 3) as 1 | 2 | 3 | 4,
  score_performance:    3,
  score_teamwork:       3,
  score_communication:  3,
  score_leadership:     3,
  score_growth:         3,
  comment:              '',
  status:               'draft',
})

const form = ref<EvaluationFormData>(defaultForm())

const previewOverallScore = computed(() => {
  const total = form.value.score_performance
    + form.value.score_teamwork
    + form.value.score_communication
    + form.value.score_leadership
    + form.value.score_growth
  return (total / 5).toFixed(1)
})

function openModal(rec: EvaluationRecord | null) {
  editTarget.value = rec
  if (rec) {
    form.value = {
      employee_id:          rec.employee_id,
      year:                 rec.year,
      quarter:              rec.quarter,
      score_performance:    rec.score_performance,
      score_teamwork:       rec.score_teamwork,
      score_communication:  rec.score_communication,
      score_leadership:     rec.score_leadership,
      score_growth:         rec.score_growth,
      comment:              rec.comment ?? '',
      status:               rec.status,
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
// ステータス操作
// ----------------------------------------------------------------
async function submitEvaluation(id: string) {
  if (!confirm('この評価を提出しますか？提出後は評価者のみ編集可能です。')) return
  await changeStatus(id, 'submitted')
}

async function finalizeEvaluation(id: string) {
  if (!confirm('この評価を確定しますか？確定後は変更できません。')) return
  await changeStatus(id, 'finalized')
}

// ----------------------------------------------------------------
// 削除
// ----------------------------------------------------------------
async function confirmDelete(rec: EvaluationRecord) {
  if (!confirm(`${rec.year}年 Q${rec.quarter} の評価を削除しますか？`)) return
  await deleteRecord(rec.id)
}

// ----------------------------------------------------------------
// バッジスタイル
// ----------------------------------------------------------------
function statusBadgeClass(status: EvaluationStatus): string {
  const map: Record<EvaluationStatus, string> = {
    draft:     'bg-secondary',
    submitted: 'bg-warning text-dark',
    finalized: 'bg-success',
  }
  return map[status]
}

function overallBadgeClass(score: number): string {
  if (score >= 4.5) return 'bg-success'
  if (score >= 3.5) return 'bg-primary'
  if (score >= 2.5) return 'bg-warning text-dark'
  return 'bg-danger'
}

// ----------------------------------------------------------------
// 初期化
// ----------------------------------------------------------------
onMounted(async () => {
  await Promise.all([loadEmployees(), search()])
})
</script>
