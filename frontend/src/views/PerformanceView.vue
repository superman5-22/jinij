<template>
  <div class="performance-view">

    <!-- ページヘッダー -->
    <div class="page-header">
      <div>
        <h1 class="page-title">目標・評価管理</h1>
        <p class="page-subtitle">
          期間: {{ currentPeriod?.name ?? '期間未選択' }}
        </p>
      </div>
      <div class="header-actions">
        <select v-model="selectedPeriodId" class="form-select period-select">
          <option value="">-- 評価期間を選択 --</option>
          <option v-for="p in periods" :key="p.id" :value="p.id">
            {{ p.name }}{{ p.is_active ? '（進行中）' : '' }}
          </option>
        </select>
        <button
          v-if="canAddGoal"
          class="btn btn-primary"
          @click="openGoalModal()"
        >
          <i class="bi bi-plus-lg me-1"></i>目標を追加
        </button>
      </div>
    </div>

    <LoadingState v-if="loading" />

    <template v-else>
      <!-- タブ -->
      <div class="tab-bar">
        <button
          class="tab-btn"
          :class="{ active: activeTab === 'goals' }"
          @click="activeTab = 'goals'"
        >
          <i class="bi bi-flag me-1"></i>目標一覧
        </button>
        <button
          class="tab-btn"
          :class="{ active: activeTab === 'review' }"
          @click="activeTab = 'review'"
        >
          <i class="bi bi-star me-1"></i>評価
        </button>
      </div>

      <!-- 目標一覧タブ -->
      <div v-if="activeTab === 'goals'">
        <div v-if="!selectedPeriodId" class="empty-state">
          <i class="bi bi-calendar3 empty-icon"></i>
          <p>評価期間を選択してください。</p>
        </div>

        <div v-else-if="goals.length === 0" class="empty-state">
          <i class="bi bi-flag empty-icon"></i>
          <p>この期間の目標はまだ登録されていません。</p>
          <button v-if="canAddGoal" class="btn btn-primary mt-2" @click="openGoalModal()">
            目標を追加する
          </button>
        </div>

        <div v-else class="goal-list">
          <div
            v-for="goal in goals"
            :key="goal.id"
            class="goal-card"
            :class="`goal-card--${goal.status}`"
          >
            <div class="goal-card__header">
              <span class="goal-category-badge">
                {{ GOAL_CATEGORY_LABELS[goal.category] }}
              </span>
              <span class="goal-status-badge" :class="`status--${goal.status}`">
                {{ GOAL_STATUS_LABELS[goal.status] }}
              </span>
            </div>
            <h3 class="goal-title">{{ goal.title }}</h3>
            <p v-if="goal.description" class="goal-description">{{ goal.description }}</p>
            <div class="goal-meta">
              <span v-if="goal.target_value">
                <i class="bi bi-bullseye me-1"></i>目標値: {{ goal.target_value }}
              </span>
              <span>
                <i class="bi bi-bar-chart me-1"></i>ウェイト: {{ goal.weight }}%
              </span>
            </div>
            <div v-if="canAddGoal" class="goal-actions">
              <button
                v-if="goal.status === 'active'"
                class="btn btn-sm btn-outline-success"
                @click="markGoalCompleted(goal.id)"
              >
                完了にする
              </button>
              <button
                class="btn btn-sm btn-outline-danger"
                @click="removeGoal(goal.id)"
              >
                削除
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 評価タブ -->
      <div v-if="activeTab === 'review'">
        <div v-if="!selectedPeriodId" class="empty-state">
          <i class="bi bi-calendar3 empty-icon"></i>
          <p>評価期間を選択してください。</p>
        </div>

        <div v-else>
          <!-- 自分の評価カード -->
          <div v-if="myReview" class="review-card">
            <div class="review-card__header">
              <h2 class="review-card__name">{{ currentPeriod?.name }} 評価</h2>
              <span class="review-status-badge" :class="`status--${myReview.status}`">
                {{ REVIEW_STATUS_LABELS[myReview.status] }}
              </span>
            </div>

            <!-- 最終ランク表示 -->
            <div v-if="myReview.final_rank" class="final-rank">
              <span class="rank-label">最終評価</span>
              <span class="rank-value" :class="`rank--${myReview.final_rank}`">
                {{ myReview.final_rank }}
              </span>
              <span class="rank-desc">{{ FINAL_RANK_LABELS[myReview.final_rank] }}</span>
            </div>

            <!-- 自己評価フォーム -->
            <div v-if="myReview.status === 'self_review'" class="self-review-form">
              <h3>自己評価の入力</h3>
              <div class="score-selector">
                <label>スコア（1〜5）</label>
                <div class="score-stars">
                  <button
                    v-for="n in 5"
                    :key="n"
                    class="star-btn"
                    :class="{ active: selfForm.self_score >= n }"
                    @click="selfForm.self_score = n"
                  >
                    <i class="bi bi-star-fill"></i>
                  </button>
                </div>
                <span class="score-text">{{ selfForm.self_score }} / 5</span>
              </div>
              <div class="mb-3">
                <label class="form-label">コメント <span class="required">*</span></label>
                <textarea
                  v-model="selfForm.self_comment"
                  class="form-control"
                  rows="4"
                  placeholder="今期の振り返りを記入してください"
                ></textarea>
              </div>
              <button class="btn btn-primary" :disabled="submitting" @click="handleSelfSubmit">
                <span v-if="submitting" class="spinner-border spinner-border-sm me-1"></span>
                自己評価を提出する
              </button>
            </div>

            <!-- 上長評価フォーム -->
            <div v-else-if="myReview.status === 'manager_review' && isManagerOrAbove" class="manager-review-form">
              <h3>上長評価の入力</h3>
              <!-- 自己評価のサマリー -->
              <div class="self-summary">
                <p class="summary-label">本人の自己評価</p>
                <div class="score-display">
                  <i v-for="n in 5" :key="n" class="bi" :class="n <= (myReview.self_score ?? 0) ? 'bi-star-fill text-warning' : 'bi-star text-muted'"></i>
                  <span class="ms-2">{{ myReview.self_score }} / 5</span>
                </div>
                <p class="self-comment-text">{{ myReview.self_comment }}</p>
              </div>
              <div class="score-selector">
                <label>評価スコア（1〜5）</label>
                <div class="score-stars">
                  <button
                    v-for="n in 5"
                    :key="n"
                    class="star-btn"
                    :class="{ active: managerForm.manager_score >= n }"
                    @click="managerForm.manager_score = n"
                  >
                    <i class="bi bi-star-fill"></i>
                  </button>
                </div>
                <span class="score-text">{{ managerForm.manager_score }} / 5</span>
              </div>
              <div class="mb-3">
                <label class="form-label">評価コメント <span class="required">*</span></label>
                <textarea
                  v-model="managerForm.manager_comment"
                  class="form-control"
                  rows="4"
                  placeholder="評価コメントを入力してください"
                ></textarea>
              </div>
              <div class="mb-3">
                <label class="form-label">最終評価ランク <span class="required">*</span></label>
                <select v-model="managerForm.final_rank" class="form-select">
                  <option v-for="(label, rank) in FINAL_RANK_LABELS" :key="rank" :value="rank">
                    {{ label }}
                  </option>
                </select>
              </div>
              <button class="btn btn-primary" :disabled="submitting" @click="handleManagerSubmit">
                <span v-if="submitting" class="spinner-border spinner-border-sm me-1"></span>
                評価を確定する
              </button>
            </div>

            <!-- 完了済みサマリー -->
            <div v-else-if="myReview.status === 'completed'" class="review-summary">
              <div class="review-score-row">
                <div class="score-block">
                  <span class="score-block__label">自己評価</span>
                  <span class="score-block__value">{{ myReview.self_score }} / 5</span>
                  <p class="score-block__comment">{{ myReview.self_comment }}</p>
                </div>
                <div class="score-block">
                  <span class="score-block__label">上長評価</span>
                  <span class="score-block__value">{{ myReview.manager_score }} / 5</span>
                  <p class="score-block__comment">{{ myReview.manager_comment }}</p>
                </div>
              </div>
            </div>
          </div>

          <!-- 評価未開始 -->
          <div v-else class="empty-state">
            <i class="bi bi-star empty-icon"></i>
            <p>この期間の評価はまだ開始されていません。</p>
            <button v-if="canStartReview" class="btn btn-primary mt-2" @click="handleStartReview">
              評価を開始する
            </button>
          </div>
        </div>
      </div>
    </template>

    <!-- 目標追加モーダル -->
    <div v-if="showGoalModal" class="modal-overlay" @click.self="closeGoalModal">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">目標を追加</h5>
            <button class="btn-close" @click="closeGoalModal"></button>
          </div>
          <div class="modal-body">
            <div class="mb-3">
              <label class="form-label">タイトル <span class="required">*</span></label>
              <input v-model="goalForm.title" type="text" class="form-control" placeholder="目標タイトル" />
            </div>
            <div class="mb-3">
              <label class="form-label">カテゴリ</label>
              <select v-model="goalForm.category" class="form-select">
                <option v-for="(label, cat) in GOAL_CATEGORY_LABELS" :key="cat" :value="cat">{{ label }}</option>
              </select>
            </div>
            <div class="mb-3">
              <label class="form-label">詳細説明</label>
              <textarea v-model="goalForm.description" class="form-control" rows="3"></textarea>
            </div>
            <div class="mb-3">
              <label class="form-label">目標値（任意）</label>
              <input v-model="goalForm.target_value" type="text" class="form-control" placeholder="例: 売上120%達成" />
            </div>
            <div class="mb-3">
              <label class="form-label">ウェイト（%）</label>
              <input v-model.number="goalForm.weight" type="number" min="1" max="100" class="form-control" />
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" @click="closeGoalModal">キャンセル</button>
            <button class="btn btn-primary" :disabled="submitting" @click="handleGoalCreate">
              <span v-if="submitting" class="spinner-border spinner-border-sm me-1"></span>
              追加する
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- エラー表示 -->
    <div v-if="error" class="alert alert-danger mt-3">{{ error }}</div>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { usePerformance } from '@/composables/usePerformance'
import LoadingState from '@/components/common/LoadingState.vue'
import type { GoalFormData, SelfReviewFormData, ManagerReviewFormData, FinalRank } from '@/types'
import {
  GOAL_CATEGORY_LABELS,
  GOAL_STATUS_LABELS,
  REVIEW_STATUS_LABELS,
  FINAL_RANK_LABELS,
} from '@/types'

const auth = useAuthStore()
const {
  goals, reviews, periods, loading, error,
  fetchPeriods, fetchGoals, createGoal, updateGoalStatus, deleteGoal,
  fetchReviews, startReview, submitSelfReview, submitManagerReview,
} = usePerformance()

const activeTab        = ref<'goals' | 'review'>('goals')
const selectedPeriodId = ref('')
const showGoalModal    = ref(false)
const submitting       = ref(false)

const currentPeriod = computed(() => periods.value.find((p) => p.id === selectedPeriodId.value))

const isManagerOrAbove = computed(() =>
  auth.profile?.role === 'manager' || auth.profile?.role === 'hr' || auth.profile?.role === 'admin'
)

const canAddGoal = computed(() => !!selectedPeriodId.value)
const canStartReview = computed(() => isManagerOrAbove.value || auth.profile?.role === 'employee')

// 自分の評価（employee_idはauth経由）
const myReview = computed(() => reviews.value[0] ?? null)

// ----------------------------------------------------------------
// フォーム
// ----------------------------------------------------------------
const goalForm = ref<GoalFormData>({
  employee_id:       '',
  review_period_id:  '',
  title:             '',
  description:       '',
  category:          'business',
  target_value:      '',
  weight:            100,
})

const selfForm = ref<SelfReviewFormData>({
  self_score:   3,
  self_comment: '',
})

const managerForm = ref<ManagerReviewFormData>({
  manager_score:   3,
  manager_comment: '',
  final_rank:      'B' as FinalRank,
})

// ----------------------------------------------------------------
// ライフサイクル
// ----------------------------------------------------------------
onMounted(async () => {
  await fetchPeriods()
  const active = periods.value.find((p) => p.is_active)
  if (active) selectedPeriodId.value = active.id
})

watch(selectedPeriodId, (periodId) => {
  if (!periodId) return
  // 自分の従業員IDを使って取得（実際の実装ではemployee_idをStoreから取得）
  fetchGoals('', periodId)
  fetchReviews(undefined, periodId)
})

// ----------------------------------------------------------------
// 目標操作
// ----------------------------------------------------------------
function openGoalModal() {
  goalForm.value = {
    employee_id:       '',
    review_period_id:  selectedPeriodId.value,
    title:             '',
    description:       '',
    category:          'business',
    target_value:      '',
    weight:            100,
  }
  showGoalModal.value = true
}

function closeGoalModal() {
  showGoalModal.value = false
}

async function handleGoalCreate() {
  if (!goalForm.value.title.trim()) return
  submitting.value = true
  try {
    await createGoal(goalForm.value)
    closeGoalModal()
    await fetchGoals('', selectedPeriodId.value)
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : '追加に失敗しました'
  } finally {
    submitting.value = false
  }
}

async function markGoalCompleted(id: string) {
  try {
    await updateGoalStatus(id, 'completed')
    await fetchGoals('', selectedPeriodId.value)
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : '更新に失敗しました'
  }
}

async function removeGoal(id: string) {
  if (!confirm('この目標を削除しますか？')) return
  try {
    await deleteGoal(id)
    await fetchGoals('', selectedPeriodId.value)
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : '削除に失敗しました'
  }
}

// ----------------------------------------------------------------
// 評価操作
// ----------------------------------------------------------------
async function handleStartReview() {
  if (!selectedPeriodId.value) return
  submitting.value = true
  try {
    await startReview('', selectedPeriodId.value)
    await fetchReviews(undefined, selectedPeriodId.value)
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : '評価開始に失敗しました'
  } finally {
    submitting.value = false
  }
}

async function handleSelfSubmit() {
  if (!myReview.value) return
  submitting.value = true
  try {
    await submitSelfReview(myReview.value.id, selfForm.value)
    await fetchReviews(undefined, selectedPeriodId.value)
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : '自己評価の提出に失敗しました'
  } finally {
    submitting.value = false
  }
}

async function handleManagerSubmit() {
  if (!myReview.value || !auth.user) return
  submitting.value = true
  try {
    await submitManagerReview(myReview.value.id, auth.user.id, managerForm.value)
    await fetchReviews(undefined, selectedPeriodId.value)
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : '評価の確定に失敗しました'
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.performance-view { padding: 1.5rem; }

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1.5rem;
  gap: 1rem;
}

.page-title    { font-size: 1.5rem; font-weight: 700; margin: 0; }
.page-subtitle { color: var(--color-text-muted, #6b7280); margin: 0.25rem 0 0; }

.header-actions {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  flex-wrap: wrap;
}

.period-select { min-width: 180px; }

/* タブ */
.tab-bar {
  display: flex;
  gap: 0.25rem;
  border-bottom: 2px solid #e5e7eb;
  margin-bottom: 1.5rem;
}

.tab-btn {
  background: none;
  border: none;
  padding: 0.6rem 1.2rem;
  cursor: pointer;
  font-weight: 500;
  color: #6b7280;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
  transition: color 0.15s, border-color 0.15s;
}

.tab-btn.active {
  color: var(--color-primary, #0d6efd);
  border-bottom-color: var(--color-primary, #0d6efd);
}

/* 空状態 */
.empty-state {
  text-align: center;
  padding: 3rem;
  color: #9ca3af;
}

.empty-icon { font-size: 2.5rem; display: block; margin-bottom: 0.75rem; }

/* 目標カード */
.goal-list { display: flex; flex-direction: column; gap: 1rem; }

.goal-card {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 1rem 1.25rem;
  background: #fff;
  transition: box-shadow 0.15s;
}

.goal-card:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
.goal-card--completed { opacity: 0.65; }

.goal-card__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.goal-category-badge {
  font-size: 0.75rem;
  background: #eff6ff;
  color: #1d4ed8;
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  font-weight: 600;
}

.goal-status-badge {
  font-size: 0.75rem;
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  font-weight: 600;
}

.status--active    { background: #d1fae5; color: #065f46; }
.status--draft     { background: #f3f4f6; color: #374151; }
.status--completed { background: #dbeafe; color: #1e40af; }
.status--cancelled { background: #fee2e2; color: #991b1b; }
.status--self_review    { background: #fef9c3; color: #854d0e; }
.status--manager_review { background: #fed7aa; color: #9a3412; }

.goal-title       { font-size: 1rem; font-weight: 600; margin: 0 0 0.25rem; }
.goal-description { color: #6b7280; font-size: 0.9rem; margin: 0 0 0.5rem; }

.goal-meta {
  display: flex;
  gap: 1rem;
  font-size: 0.8rem;
  color: #9ca3af;
  margin-bottom: 0.75rem;
}

.goal-actions { display: flex; gap: 0.5rem; }

/* 評価カード */
.review-card {
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 1.5rem;
  background: #fff;
}

.review-card__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.25rem;
}

.review-card__name { font-size: 1.1rem; font-weight: 700; margin: 0; }

.final-rank {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
  padding: 1rem;
  background: #f9fafb;
  border-radius: 8px;
}

.rank-label { font-size: 0.85rem; color: #6b7280; }

.rank-value {
  font-size: 2rem;
  font-weight: 800;
  width: 3rem;
  height: 3rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
}

.rank--S { background: #fef08a; color: #713f12; }
.rank--A { background: #d1fae5; color: #065f46; }
.rank--B { background: #dbeafe; color: #1e40af; }
.rank--C { background: #fed7aa; color: #9a3412; }
.rank--D { background: #fee2e2; color: #991b1b; }

.rank-desc { font-size: 0.9rem; color: #374151; }

/* スコア選択 */
.score-selector { margin-bottom: 1rem; }
.score-selector label { display: block; font-weight: 500; margin-bottom: 0.5rem; font-size: 0.9rem; }

.score-stars { display: flex; gap: 0.25rem; margin-bottom: 0.25rem; }

.star-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  color: #d1d5db;
  cursor: pointer;
  padding: 0;
  transition: color 0.1s, transform 0.1s;
}

.star-btn.active { color: #f59e0b; }
.star-btn:hover  { transform: scale(1.2); }

.score-text { font-size: 0.85rem; color: #6b7280; }

/* 自己評価サマリー */
.self-summary {
  background: #f9fafb;
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1.25rem;
}

.summary-label  { font-size: 0.8rem; color: #6b7280; margin-bottom: 0.25rem; }
.score-display  { font-size: 1.1rem; margin-bottom: 0.5rem; }
.self-comment-text { font-size: 0.9rem; color: #374151; margin: 0; }

/* 評価サマリー */
.review-score-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.score-block {
  background: #f9fafb;
  border-radius: 8px;
  padding: 1rem;
}

.score-block__label   { display: block; font-size: 0.8rem; color: #6b7280; margin-bottom: 0.25rem; }
.score-block__value   { display: block; font-size: 1.5rem; font-weight: 700; color: #111827; }
.score-block__comment { font-size: 0.85rem; color: #6b7280; margin: 0.5rem 0 0; }

/* モーダル */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-dialog  { width: 100%; max-width: 520px; margin: 1rem; }
.modal-content { background: #fff; border-radius: 12px; overflow: hidden; }
.modal-header  { padding: 1rem 1.5rem; border-bottom: 1px solid #e5e7eb; display: flex; align-items: center; justify-content: space-between; }
.modal-title   { font-weight: 700; margin: 0; }
.modal-body    { padding: 1.5rem; }
.modal-footer  { padding: 1rem 1.5rem; border-top: 1px solid #e5e7eb; display: flex; justify-content: flex-end; gap: 0.5rem; }

.required { color: #ef4444; }
</style>
