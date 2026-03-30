<template>
  <div class="container-fluid py-4">
    <!-- ヘッダー -->
    <div class="d-flex align-items-center justify-content-between mb-4 flex-wrap gap-2">
      <div>
        <h1 class="h3 mb-1">人事評価</h1>
        <p class="text-muted mb-0">従業員の定期評価の登録・確認</p>
      </div>
      <button
        v-if="auth.isHR || auth.profile?.role === 'manager'"
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
          <!-- 従業員（hr/admin/manager のみ） -->
          <div v-if="auth.isHR || auth.profile?.role === 'manager'" class="col-md-3">
            <label class="form-label small fw-semibold">従業員</label>
            <select v-model="filters.employee_id" class="form-select form-select-sm">
              <option value="">全従業員</option>
              <option v-for="emp in employees" :key="emp.id" :value="emp.id">
                {{ emp.full_name }} ({{ emp.employee_code }})
              </option>
            </select>
          </div>
          <!-- 年度 -->
          <div class="col-md-2">
            <label class="form-label small fw-semibold">年度</label>
            <select v-model="filters.review_year" class="form-select form-select-sm">
              <option value="">全年度</option>
              <option v-for="y in yearOptions" :key="y" :value="y">{{ y }}年</option>
            </select>
          </div>
          <!-- 種別 -->
          <div class="col-md-2">
            <label class="form-label small fw-semibold">種別</label>
            <select v-model="filters.review_type" class="form-select form-select-sm">
              <option value="">全種別</option>
              <option v-for="(label, key) in REVIEW_TYPE_LABELS" :key="key" :value="key">
                {{ label }}
              </option>
            </select>
          </div>
          <!-- ステータス -->
          <div class="col-md-2">
            <label class="form-label small fw-semibold">ステータス</label>
            <select v-model="filters.status" class="form-select form-select-sm">
              <option value="">全ステータス</option>
              <option v-for="(label, key) in REVIEW_STATUS_LABELS" :key="key" :value="key">
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

        <div v-else-if="reviews.length === 0" class="text-center py-5 text-muted">
          <i class="bi bi-clipboard2-x display-6 d-block mb-2"></i>
          評価レコードが見つかりません
        </div>

        <div v-else class="table-responsive">
          <table class="table table-hover align-middle mb-0">
            <thead class="table-light">
              <tr>
                <th class="ps-4">従業員</th>
                <th>年度・種別</th>
                <th>総合評価</th>
                <th>業績</th>
                <th>行動</th>
                <th>スキル</th>
                <th>ステータス</th>
                <th class="text-end pe-4">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="review in reviews" :key="review.id">
                <td class="ps-4">
                  <div class="fw-semibold">{{ review.employee?.full_name ?? '—' }}</div>
                  <div class="small text-muted">{{ review.employee?.employee_code }}</div>
                </td>
                <td>
                  <div>{{ review.review_year }}年</div>
                  <div class="small text-muted">
                    {{ REVIEW_TYPE_LABELS[review.review_type] }}
                    <span v-if="review.review_quarter">
                      &nbsp;Q{{ review.review_quarter }}
                    </span>
                  </div>
                </td>
                <td>
                  <span class="badge" :class="ratingBadgeClass(review.overall_rating)">
                    {{ ratingLabel(review.overall_rating) }}
                  </span>
                </td>
                <td>{{ review.performance_score }}</td>
                <td>{{ review.behavior_score }}</td>
                <td>{{ review.skill_score }}</td>
                <td>
                  <span class="badge" :class="statusBadgeClass(review.status)">
                    {{ REVIEW_STATUS_LABELS[review.status] }}
                  </span>
                </td>
                <td class="text-end pe-4">
                  <!-- 詳細表示 -->
                  <button
                    class="btn btn-sm btn-outline-secondary me-1"
                    title="詳細"
                    @click="openDetail(review)"
                  >
                    <i class="bi bi-eye"></i>
                  </button>
                  <!-- 編集（hr/admin/manager かつ draft のみ） -->
                  <button
                    v-if="(auth.isHR || auth.profile?.role === 'manager') && review.status === 'draft'"
                    class="btn btn-sm btn-outline-primary me-1"
                    title="編集"
                    @click="openModal(review)"
                  >
                    <i class="bi bi-pencil"></i>
                  </button>
                  <!-- 提出（draft → submitted） -->
                  <button
                    v-if="(auth.isHR || auth.profile?.role === 'manager') && review.status === 'draft'"
                    class="btn btn-sm btn-outline-success me-1"
                    title="提出"
                    @click="submitReview(review.id)"
                  >
                    <i class="bi bi-send"></i>
                  </button>
                  <!-- 本人確認（employee かつ submitted） -->
                  <button
                    v-if="review.status === 'submitted' && isOwnReview(review)"
                    class="btn btn-sm btn-outline-info me-1"
                    title="確認済みにする"
                    @click="acknowledgeReview(review.id)"
                  >
                    <i class="bi bi-check2-circle"></i>
                  </button>
                  <!-- 削除（hr/admin かつ draft のみ） -->
                  <button
                    v-if="auth.isHR && review.status === 'draft'"
                    class="btn btn-sm btn-outline-danger"
                    title="削除"
                    @click="confirmDelete(review)"
                  >
                    <i class="bi bi-trash"></i>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- ================================================================
         登録・編集モーダル
         ================================================================ -->
    <div
      v-if="showModal"
      class="modal fade show d-block"
      tabindex="-1"
      style="background: rgba(0,0,0,.45)"
      @click.self="closeModal"
    >
      <div class="modal-dialog modal-lg modal-dialog-scrollable">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">
              {{ editingReview ? '人事評価 編集' : '人事評価 新規登録' }}
            </h5>
            <button type="button" class="btn-close" @click="closeModal"></button>
          </div>
          <div class="modal-body">
            <form @submit.prevent="saveReview">
              <!-- 従業員選択 -->
              <div class="mb-3">
                <label class="form-label fw-semibold">従業員 <span class="text-danger">*</span></label>
                <select
                  v-model="form.employee_id"
                  class="form-select"
                  :disabled="!!editingReview"
                  required
                >
                  <option value="">選択してください</option>
                  <option v-for="emp in employees" :key="emp.id" :value="emp.id">
                    {{ emp.full_name }} ({{ emp.employee_code }})
                  </option>
                </select>
              </div>

              <div class="row g-3 mb-3">
                <!-- 評価年度 -->
                <div class="col-md-4">
                  <label class="form-label fw-semibold">評価年度 <span class="text-danger">*</span></label>
                  <select v-model="form.review_year" class="form-select" required>
                    <option v-for="y in yearOptions" :key="y" :value="y">{{ y }}年</option>
                  </select>
                </div>
                <!-- 評価種別 -->
                <div class="col-md-4">
                  <label class="form-label fw-semibold">種別 <span class="text-danger">*</span></label>
                  <select v-model="form.review_type" class="form-select" required>
                    <option v-for="(label, key) in REVIEW_TYPE_LABELS" :key="key" :value="key">
                      {{ label }}
                    </option>
                  </select>
                </div>
                <!-- 四半期（quarterly のみ） -->
                <div class="col-md-4" v-if="form.review_type === 'quarterly'">
                  <label class="form-label fw-semibold">四半期 <span class="text-danger">*</span></label>
                  <select v-model="form.review_quarter" class="form-select" required>
                    <option :value="1">Q1（1〜3月）</option>
                    <option :value="2">Q2（4〜6月）</option>
                    <option :value="3">Q3（7〜9月）</option>
                    <option :value="4">Q4（10〜12月）</option>
                  </select>
                </div>
              </div>

              <!-- 評価スコア -->
              <div class="card bg-light border-0 mb-3 p-3">
                <div class="fw-semibold mb-3">評価スコア（1〜5）</div>
                <div class="row g-3">
                  <div class="col-md-3">
                    <label class="form-label small">総合評価</label>
                    <select v-model="form.overall_rating" class="form-select form-select-sm" required>
                      <option v-for="n in 5" :key="n" :value="n">{{ n }} — {{ ratingLabel(n) }}</option>
                    </select>
                  </div>
                  <div class="col-md-3">
                    <label class="form-label small">業績評価</label>
                    <select v-model="form.performance_score" class="form-select form-select-sm" required>
                      <option v-for="n in 5" :key="n" :value="n">{{ n }}</option>
                    </select>
                  </div>
                  <div class="col-md-3">
                    <label class="form-label small">行動評価</label>
                    <select v-model="form.behavior_score" class="form-select form-select-sm" required>
                      <option v-for="n in 5" :key="n" :value="n">{{ n }}</option>
                    </select>
                  </div>
                  <div class="col-md-3">
                    <label class="form-label small">スキル評価</label>
                    <select v-model="form.skill_score" class="form-select form-select-sm" required>
                      <option v-for="n in 5" :key="n" :value="n">{{ n }}</option>
                    </select>
                  </div>
                </div>
              </div>

              <!-- テキスト項目 -->
              <div class="mb-3">
                <label class="form-label fw-semibold">目標達成状況</label>
                <textarea v-model="form.goals_achievement" class="form-control" rows="2"></textarea>
              </div>
              <div class="mb-3">
                <label class="form-label fw-semibold">強み・よかった点</label>
                <textarea v-model="form.strengths" class="form-control" rows="2"></textarea>
              </div>
              <div class="mb-3">
                <label class="form-label fw-semibold">改善点・課題</label>
                <textarea v-model="form.improvements" class="form-control" rows="2"></textarea>
              </div>
              <div class="mb-3">
                <label class="form-label fw-semibold">次期目標</label>
                <textarea v-model="form.next_goals" class="form-control" rows="2"></textarea>
              </div>
              <div class="mb-3">
                <label class="form-label fw-semibold">評価者コメント</label>
                <textarea v-model="form.reviewer_comment" class="form-control" rows="2"></textarea>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" @click="closeModal">キャンセル</button>
            <button class="btn btn-primary" :disabled="isLoading" @click="saveReview">
              <span v-if="isLoading" class="spinner-border spinner-border-sm me-1"></span>
              保存
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- ================================================================
         詳細モーダル
         ================================================================ -->
    <div
      v-if="showDetail && detailReview"
      class="modal fade show d-block"
      tabindex="-1"
      style="background: rgba(0,0,0,.45)"
      @click.self="showDetail = false"
    >
      <div class="modal-dialog modal-lg modal-dialog-scrollable">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">人事評価 詳細</h5>
            <button type="button" class="btn-close" @click="showDetail = false"></button>
          </div>
          <div class="modal-body">
            <dl class="row mb-0">
              <dt class="col-sm-3">従業員</dt>
              <dd class="col-sm-9">{{ detailReview.employee?.full_name }}</dd>
              <dt class="col-sm-3">評価年度・種別</dt>
              <dd class="col-sm-9">
                {{ detailReview.review_year }}年 /
                {{ REVIEW_TYPE_LABELS[detailReview.review_type] }}
                <span v-if="detailReview.review_quarter"> Q{{ detailReview.review_quarter }}</span>
              </dd>
              <dt class="col-sm-3">ステータス</dt>
              <dd class="col-sm-9">
                <span class="badge" :class="statusBadgeClass(detailReview.status)">
                  {{ REVIEW_STATUS_LABELS[detailReview.status] }}
                </span>
              </dd>

              <!-- スコア -->
              <dt class="col-sm-3 mt-3">総合評価</dt>
              <dd class="col-sm-9 mt-3">
                <span class="badge fs-6" :class="ratingBadgeClass(detailReview.overall_rating)">
                  {{ ratingLabel(detailReview.overall_rating) }}
                </span>
              </dd>
              <dt class="col-sm-3">業績 / 行動 / スキル</dt>
              <dd class="col-sm-9">
                {{ detailReview.performance_score }} /
                {{ detailReview.behavior_score }} /
                {{ detailReview.skill_score }}
              </dd>

              <template v-if="detailReview.goals_achievement">
                <dt class="col-sm-3 mt-3">目標達成状況</dt>
                <dd class="col-sm-9 mt-3" style="white-space: pre-wrap">{{ detailReview.goals_achievement }}</dd>
              </template>
              <template v-if="detailReview.strengths">
                <dt class="col-sm-3 mt-2">強み</dt>
                <dd class="col-sm-9 mt-2" style="white-space: pre-wrap">{{ detailReview.strengths }}</dd>
              </template>
              <template v-if="detailReview.improvements">
                <dt class="col-sm-3 mt-2">改善点</dt>
                <dd class="col-sm-9 mt-2" style="white-space: pre-wrap">{{ detailReview.improvements }}</dd>
              </template>
              <template v-if="detailReview.next_goals">
                <dt class="col-sm-3 mt-2">次期目標</dt>
                <dd class="col-sm-9 mt-2" style="white-space: pre-wrap">{{ detailReview.next_goals }}</dd>
              </template>
              <template v-if="detailReview.reviewer_comment">
                <dt class="col-sm-3 mt-2">評価者コメント</dt>
                <dd class="col-sm-9 mt-2" style="white-space: pre-wrap">{{ detailReview.reviewer_comment }}</dd>
              </template>
              <template v-if="detailReview.self_comment">
                <dt class="col-sm-3 mt-2">本人コメント</dt>
                <dd class="col-sm-9 mt-2" style="white-space: pre-wrap">{{ detailReview.self_comment }}</dd>
              </template>
            </dl>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" @click="showDetail = false">閉じる</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { usePerformanceReviews } from '@/composables/usePerformanceReviews'
import { useAuthStore } from '@/stores/auth'
import { supabase } from '@/lib/supabase'
import type {
  PerformanceReview,
  PerformanceReviewFormData,
  PerformanceReviewFilters,
  Employee,
} from '@/types'
import {
  REVIEW_TYPE_LABELS,
  REVIEW_STATUS_LABELS,
  RATING_LABELS,
} from '@/types'

const auth = useAuthStore()
const {
  reviews,
  isLoading,
  error,
  fetchReviews,
  createReview,
  updateReview,
  changeStatus,
  deleteReview,
} = usePerformanceReviews()

// ----------------------------------------------------------------
// 従業員リスト（フィルター・フォーム用）
// ----------------------------------------------------------------
const employees = ref<Employee[]>([])
async function loadEmployees() {
  const { data } = await supabase
    .from('employees')
    .select('id, full_name, employee_code, department_id, user_id')
    .eq('status', 'active')
    .order('full_name')
  employees.value = data ?? []
}

// ----------------------------------------------------------------
// 年度オプション
// ----------------------------------------------------------------
const currentYear = new Date().getFullYear()
const yearOptions = computed(() => {
  const years: number[] = []
  for (let y = currentYear + 1; y >= 2020; y--) years.push(y)
  return years
})

// ----------------------------------------------------------------
// フィルター
// ----------------------------------------------------------------
const filters = reactive<Partial<PerformanceReviewFilters>>({
  employee_id: '',
  review_year: '',
  review_type: '',
  status:      '',
})

async function search() {
  await fetchReviews(filters)
}

// ----------------------------------------------------------------
// 登録・編集モーダル
// ----------------------------------------------------------------
const showModal     = ref(false)
const editingReview = ref<PerformanceReview | null>(null)

const defaultForm = (): PerformanceReviewFormData => ({
  employee_id:       '',
  review_year:       currentYear,
  review_type:       'annual',
  review_quarter:    null,
  overall_rating:    3,
  performance_score: 3,
  behavior_score:    3,
  skill_score:       3,
  goals_achievement: '',
  strengths:         '',
  improvements:      '',
  next_goals:        '',
  self_comment:      '',
  reviewer_comment:  '',
})

const form = reactive<PerformanceReviewFormData>(defaultForm())

function openModal(review: PerformanceReview | null) {
  editingReview.value = review
  if (review) {
    Object.assign(form, {
      employee_id:       review.employee_id,
      review_year:       review.review_year,
      review_type:       review.review_type,
      review_quarter:    review.review_quarter,
      overall_rating:    review.overall_rating,
      performance_score: review.performance_score,
      behavior_score:    review.behavior_score,
      skill_score:       review.skill_score,
      goals_achievement: review.goals_achievement ?? '',
      strengths:         review.strengths         ?? '',
      improvements:      review.improvements      ?? '',
      next_goals:        review.next_goals         ?? '',
      self_comment:      review.self_comment       ?? '',
      reviewer_comment:  review.reviewer_comment   ?? '',
    })
  } else {
    Object.assign(form, defaultForm())
  }
  showModal.value = true
}

function closeModal() {
  showModal.value     = false
  editingReview.value = null
}

async function saveReview() {
  if (!form.employee_id) return

  // quarterly の場合は quarter が必要
  if (form.review_type === 'quarterly' && !form.review_quarter) {
    alert('四半期を選択してください')
    return
  }
  if (form.review_type !== 'quarterly') form.review_quarter = null

  let result
  if (editingReview.value) {
    result = await updateReview(editingReview.value.id, form)
  } else {
    result = await createReview(form)
  }
  if (result) {
    closeModal()
    await fetchReviews(filters)
  }
}

// ----------------------------------------------------------------
// 詳細モーダル
// ----------------------------------------------------------------
const showDetail   = ref(false)
const detailReview = ref<PerformanceReview | null>(null)

function openDetail(review: PerformanceReview) {
  detailReview.value = review
  showDetail.value   = true
}

// ----------------------------------------------------------------
// ステータス操作
// ----------------------------------------------------------------
async function submitReview(id: string) {
  if (!confirm('この評価を提出しますか？')) return
  const ok = await changeStatus(id, 'submitted')
  if (ok) await fetchReviews(filters)
}

async function acknowledgeReview(id: string) {
  if (!confirm('評価内容を確認済みにしますか？')) return
  const ok = await changeStatus(id, 'acknowledged')
  if (ok) await fetchReviews(filters)
}

function isOwnReview(review: PerformanceReview): boolean {
  if (!auth.profile) return false
  const empUserId = review.employee?.user_id ?? null
  // employees の user_id が自分のものか
  return (empUserId === (auth.profile as unknown as { id: string }).id)
}

// ----------------------------------------------------------------
// 削除
// ----------------------------------------------------------------
async function confirmDelete(review: PerformanceReview) {
  const name = review.employee?.full_name ?? '対象従業員'
  if (!confirm(`${name} の評価レコードを削除しますか？`)) return
  const ok = await deleteReview(review.id)
  if (ok) await fetchReviews(filters)
}

// ----------------------------------------------------------------
// ユーティリティ
// ----------------------------------------------------------------
function ratingLabel(rating: number): string {
  // 1=S(卓越), 2=A(優秀), 3=B(標準), 4=C(要改善), 5=D(不十分)
  return RATING_LABELS[rating] ?? String(rating)
}

function ratingBadgeClass(rating: number): string {
  switch (rating) {
    case 1: return 'bg-primary'
    case 2: return 'bg-success'
    case 3: return 'bg-secondary'
    case 4: return 'bg-warning text-dark'
    case 5: return 'bg-danger'
    default: return 'bg-secondary'
  }
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case 'draft':        return 'bg-secondary'
    case 'submitted':    return 'bg-warning text-dark'
    case 'acknowledged': return 'bg-success'
    default:             return 'bg-secondary'
  }
}

// ----------------------------------------------------------------
// 初期化
// ----------------------------------------------------------------
onMounted(async () => {
  await Promise.all([loadEmployees(), fetchReviews()])
})
</script>
