<template>
  <div>
    <!-- ページヘッダー -->
    <div class="leave-header">
      <div>
        <h1 class="page-title">休暇申請・承認</h1>
        <p style="font-size:0.82rem; color:var(--text-muted); margin-top:4px">
          承認待ち
          <strong style="color:var(--warning)">{{ pendingCount }}件</strong>
        </p>
      </div>
      <button
        v-if="auth.isHR"
        class="btn btn-secondary btn-sm"
        @click="showRequestForm = !showRequestForm"
      >
        <i :class="showRequestForm ? 'bi bi-x-lg' : 'bi bi-plus-lg'"></i>
        {{ showRequestForm ? '閉じる' : '申請を代行入力' }}
      </button>
    </div>

    <!-- 2カラムレイアウト (メイン幅 > フォーム幅) -->
    <div class="leave-layout" :class="{ 'show-form': showRequestForm }">
      <!-- 左: 申請一覧 -->
      <div class="leave-main">
        <div class="card">
          <!-- フィルター -->
          <div class="filter-bar" style="gap:var(--space-3)">
            <div class="search-wrap" style="max-width:220px; flex:none">
              <i class="bi bi-search"></i>
              <input
                v-model="filters.employee_id"
                type="text"
                class="form-control"
                placeholder="社員IDで絞り込み"
                @input="applyFilters"
              />
            </div>

            <div class="filter-tabs">
              <button
                v-for="tab in statusTabs"
                :key="tab.value"
                class="filter-tab"
                :class="{ active: filters.status === tab.value }"
                @click="setStatusFilter(tab.value)"
              >
                {{ tab.label }}
                <span v-if="tab.count !== null" class="tab-count">{{ tab.count }}</span>
              </button>
            </div>

            <select
              v-model="filters.leave_type"
              class="form-select filter-select"
              style="min-width:130px; margin-left:auto"
              @change="applyFilters"
            >
              <option value="">休暇種別: すべて</option>
              <option value="annual">年次有給休暇</option>
              <option value="sick">病気休暇</option>
              <option value="personal">私用休暇</option>
              <option value="bereavement">忌引き</option>
              <option value="other">その他</option>
            </select>
          </div>

          <!-- リスト -->
          <LoadingState v-if="loading" message="読み込み中..." />

          <div v-else-if="requests.length === 0" class="empty-state" style="padding:3rem">
            <div class="empty-state-icon"><i class="bi bi-calendar2-check"></i></div>
            <div class="empty-state-title">申請がありません</div>
            <div class="empty-state-desc">
              {{ filters.status === 'pending'
                ? '現在、承認待ちの申請はありません。'
                : '条件に一致する申請が見つかりませんでした。'
              }}
            </div>
          </div>

          <div v-else>
            <div
              v-for="req in requests"
              :key="req.id"
              class="leave-item"
              :class="`status-${req.status}`"
            >
              <!-- 左: 申請者情報 -->
              <div class="leave-item-person">
                <div class="person-avatar">
                  {{ req.employee?.full_name?.charAt(0) ?? '?' }}
                </div>
                <div>
                  <div class="person-name">{{ req.employee?.full_name ?? '—' }}</div>
                  <div class="person-dept">
                    {{ req.employee?.department?.name ?? '部署未設定' }}
                    <span class="mono text-muted" style="font-size:0.7rem">
                      · {{ req.employee?.employee_code }}
                    </span>
                  </div>
                </div>
              </div>

              <!-- 中: 申請詳細 -->
              <div class="leave-item-detail">
                <div class="leave-dates">
                  <i class="bi bi-calendar3" style="font-size:0.8rem; opacity:0.5"></i>
                  {{ formatDate(req.start_date) }}
                  <template v-if="req.start_date !== req.end_date">
                    〜 {{ formatDate(req.end_date) }}
                  </template>
                  <strong>（{{ req.days_count }}日）</strong>
                </div>
                <div class="leave-types-row">
                  <StatusBadge type="leave-type" :value="req.leave_type" />
                  <span v-if="req.reason" class="leave-reason">{{ req.reason }}</span>
                </div>
                <div v-if="req.review_comment" class="review-comment">
                  <i class="bi bi-chat-left-quote" style="opacity:0.5"></i>
                  {{ req.review_comment }}
                </div>
              </div>

              <!-- 右: 状態 + 操作 -->
              <div class="leave-item-actions">
                <StatusBadge type="leave-status" :value="req.status" :showDot="true" />
                <div
                  v-if="req.status === 'pending' && auth.isManager"
                  class="action-btns"
                >
                  <button
                    class="btn btn-success btn-xs"
                    :disabled="processingId === req.id"
                    @click="handleApprove(req.id)"
                  >
                    <i class="bi bi-check-lg"></i> 承認
                  </button>
                  <button
                    class="btn btn-danger btn-xs"
                    :disabled="processingId === req.id"
                    @click="openRejectModal(req.id)"
                  >
                    <i class="bi bi-x-lg"></i> 却下
                  </button>
                </div>
                <div class="leave-time">{{ timeAgo(req.created_at) }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 右: 申請フォーム (HR向け代理入力) -->
      <Transition name="slide-in">
        <div v-if="showRequestForm" class="leave-form-panel">
          <div class="card">
            <div class="card-header">
              <div style="font-size:0.9rem; font-weight:700">休暇申請を入力</div>
              <div style="font-size:0.75rem; color:var(--text-muted)">従業員に代わって入力します</div>
            </div>
            <div class="card-body">
              <form @submit.prevent="handleSubmitRequest" novalidate>
                <div style="margin-bottom:var(--space-4)">
                  <label class="form-label">従業員<span class="req">*</span></label>
                  <select v-model="reqForm.employee_id" class="form-select"
                    :class="{ 'is-invalid': reqErr.employee_id }">
                    <option value="">選択してください</option>
                    <option
                      v-for="emp in allEmployees"
                      :key="emp.id"
                      :value="emp.id"
                    >{{ emp.full_name }}</option>
                  </select>
                  <div class="invalid-feedback">{{ reqErr.employee_id }}</div>
                </div>

                <div style="margin-bottom:var(--space-4)">
                  <label class="form-label">休暇種別<span class="req">*</span></label>
                  <select v-model="reqForm.leave_type" class="form-select">
                    <option value="annual">年次有給休暇</option>
                    <option value="sick">病気休暇</option>
                    <option value="personal">私用休暇</option>
                    <option value="bereavement">忌引き休暇</option>
                    <option value="other">その他</option>
                  </select>
                </div>

                <div class="form-grid-2" style="margin-bottom:var(--space-4)">
                  <div>
                    <label class="form-label">開始日<span class="req">*</span></label>
                    <input v-model="reqForm.start_date" type="date" class="form-control"
                      :class="{ 'is-invalid': reqErr.dates }"
                      @change="calcDays" />
                  </div>
                  <div>
                    <label class="form-label">終了日<span class="req">*</span></label>
                    <input v-model="reqForm.end_date" type="date" class="form-control"
                      :class="{ 'is-invalid': reqErr.dates }"
                      @change="calcDays" />
                  </div>
                  <div class="col-span-2">
                    <div v-if="reqErr.dates" class="invalid-feedback" style="display:block">
                      {{ reqErr.dates }}
                    </div>
                  </div>
                </div>

                <div style="margin-bottom:var(--space-4)">
                  <label class="form-label">日数<span class="req">*</span></label>
                  <div class="leave-input-wrap">
                    <input v-model.number="reqForm.days_count" type="number"
                      min="0.5" max="30" step="0.5" class="form-control"
                      style="text-align:right; padding-right:2.5rem" />
                    <span class="leave-unit" style="position:absolute; right:0.75rem; top:50%; transform:translateY(-50%); font-size:0.85rem; color:var(--text-muted); pointer-events:none">日</span>
                  </div>
                </div>

                <div style="margin-bottom:var(--space-5)">
                  <label class="form-label">申請理由</label>
                  <textarea v-model="reqForm.reason" class="form-control" rows="3"
                    placeholder="任意。特記事項があれば記入してください。"
                    style="resize:vertical"></textarea>
                </div>

                <div v-if="reqError" class="alert alert-error" style="margin-bottom:var(--space-4)">
                  <i class="bi bi-exclamation-circle-fill"></i>
                  {{ reqError }}
                </div>

                <button type="submit" class="btn btn-primary" style="width:100%" :disabled="submitting">
                  <span v-if="submitting">
                    <span class="save-spinner"></span>
                    送信中...
                  </span>
                  <span v-else>申請を送信</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      </Transition>
    </div>

    <!-- 却下理由モーダル -->
    <Teleport to="body">
      <div v-if="showRejectModal" class="modal-overlay" @click.self="closeRejectModal">
        <div class="modal-dialog" role="dialog" aria-modal="true">
          <div class="modal-header">
            <div class="modal-title">申請を却下する</div>
          </div>
          <div class="modal-body">
            <p style="font-size:0.875rem; color:var(--text-secondary); margin-bottom:var(--space-4)">
              却下理由を入力してください。申請者に通知されます。
            </p>
            <textarea
              v-model="rejectComment"
              class="form-control"
              rows="3"
              placeholder="例：業務上の都合により承認できません。"
              style="resize:vertical"
            ></textarea>
            <div v-if="rejectError" style="font-size:0.8rem; color:var(--danger); margin-top:var(--space-2)">
              {{ rejectError }}
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" @click="closeRejectModal">キャンセル</button>
            <button class="btn btn-danger" :disabled="processingId !== null" @click="handleReject">
              却下する
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/ja'
import { useLeaves } from '@/composables/useLeaves'
import { useEmployees } from '@/composables/useEmployees'
import { useAuthStore } from '@/stores/auth'
import type { Employee, LeaveRequestFormData, LeaveStatus } from '@/types'
import LoadingState from '@/components/common/LoadingState.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'

dayjs.extend(relativeTime)
dayjs.locale('ja')

const auth = useAuthStore()
const { requests, loading, error, filters, fetchRequests, submitRequest, approveRequest, rejectRequest, applyFilters } = useLeaves()
const { employees: empList, fetchEmployees } = useEmployees()

const allEmployees = ref<Employee[]>([])
const showRequestForm = ref(false)
const processingId    = ref<string | null>(null)
const submitting      = ref(false)
const reqError        = ref('')

// 却下モーダル
const showRejectModal = ref(false)
const rejectingId     = ref<string | null>(null)
const rejectComment   = ref('')
const rejectError     = ref('')

const reqForm = reactive<LeaveRequestFormData>({
  employee_id: '',
  leave_type:  'annual',
  start_date:  '',
  end_date:    '',
  days_count:  1,
  reason:      '',
})

const reqErr = reactive({ employee_id: '', dates: '' })

type StatusFilter = LeaveStatus | ''

interface StatusTab { label: string; value: StatusFilter; count: number | null }

const statusTabs = computed<StatusTab[]>(() => [
  { label: 'すべて',   value: '',          count: null },
  { label: '承認待ち', value: 'pending',   count: pendingCount.value },
  { label: '承認済み', value: 'approved',  count: null },
  { label: '却下',     value: 'rejected',  count: null },
])

const pendingCount = computed(
  () => requests.value.filter((r) => r.status === 'pending').length
)

function setStatusFilter(v: StatusFilter) {
  filters.value.status = v
  applyFilters()
}

function calcDays() {
  if (reqForm.start_date && reqForm.end_date) {
    const start = dayjs(reqForm.start_date)
    const end   = dayjs(reqForm.end_date)
    if (end.isBefore(start)) {
      reqErr.dates = '終了日は開始日以降にしてください'
      return
    }
    reqErr.dates = ''
    reqForm.days_count = end.diff(start, 'day') + 1
  }
}

function validateReqForm(): boolean {
  reqErr.employee_id = reqForm.employee_id ? '' : '従業員を選択してください'
  reqErr.dates = (!reqForm.start_date || !reqForm.end_date)
    ? '期間を入力してください'
    : reqForm.end_date < reqForm.start_date
      ? '終了日は開始日以降にしてください'
      : ''
  return !Object.values(reqErr).some(Boolean)
}

async function handleSubmitRequest() {
  if (!validateReqForm()) return
  submitting.value = true
  reqError.value = ''
  try {
    await submitRequest(reqForm)
    // フォームリセット
    reqForm.employee_id = ''
    reqForm.start_date  = ''
    reqForm.end_date    = ''
    reqForm.days_count  = 1
    reqForm.reason      = ''
    showRequestForm.value = false
    await fetchRequests()
  } catch (e: unknown) {
    reqError.value = e instanceof Error ? e.message : '送信に失敗しました'
  } finally {
    submitting.value = false
  }
}

async function handleApprove(id: string) {
  processingId.value = id
  try {
    await approveRequest(id, auth.user!.id)
    await fetchRequests()
  } finally {
    processingId.value = null
  }
}

function openRejectModal(id: string) {
  rejectingId.value    = id
  rejectComment.value  = ''
  rejectError.value    = ''
  showRejectModal.value = true
}

function closeRejectModal() {
  showRejectModal.value = false
  rejectingId.value     = null
}

async function handleReject() {
  if (!rejectingId.value) return
  if (!rejectComment.value.trim()) {
    rejectError.value = '却下理由を入力してください'
    return
  }
  processingId.value = rejectingId.value
  try {
    await rejectRequest(rejectingId.value, auth.user!.id, rejectComment.value)
    closeRejectModal()
    await fetchRequests()
  } catch (e: unknown) {
    rejectError.value = e instanceof Error ? e.message : '処理に失敗しました'
  } finally {
    processingId.value = null
  }
}

function formatDate(d: string) {
  return dayjs(d).format('M月D日 (ddd)')
}

function timeAgo(d: string) {
  return dayjs(d).fromNow()
}

onMounted(async () => {
  await Promise.all([fetchRequests(), fetchEmployees()])
  allEmployees.value = empList.value.filter((e) => e.status === 'active')
})
</script>

<style scoped>
.leave-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: var(--space-6);
  gap: var(--space-4);
}

/* 2カラムレイアウト */
.leave-layout {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-6);
  align-items: start;
  transition: grid-template-columns var(--ease-slow);
}

.leave-layout.show-form {
  grid-template-columns: 1fr 320px;
}

/* フィルタータブ */
.filter-tabs {
  display: flex;
  gap: var(--space-1);
  flex-wrap: wrap;
}

.filter-tab {
  padding: 0.3rem 0.75rem;
  border: 1px solid var(--border);
  background: var(--surface);
  border-radius: 20px;
  font-size: 0.78rem;
  font-weight: 600;
  font-family: var(--font-sans);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--ease-fast);
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
}

.filter-tab:hover {
  background: var(--surface-2);
}

.filter-tab.active {
  background: var(--brand-800);
  border-color: var(--brand-800);
  color: white;
}

.tab-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--warning);
  color: white;
  font-size: 0.65rem;
  font-weight: 800;
  border-radius: 10px;
  min-width: 18px;
  height: 16px;
  padding: 0 4px;
}

/* 申請リストアイテム */
.leave-item {
  display: flex;
  align-items: center;
  gap: var(--space-5);
  padding: var(--space-5) var(--space-6);
  border-bottom: 1px solid var(--border);
  transition: background var(--ease-fast);
}

.leave-item:last-child { border-bottom: none; }
.leave-item:hover { background: var(--brand-50); }

.leave-item.status-pending {
  border-left: 3px solid var(--warning);
}

.leave-item.status-approved {
  border-left: 3px solid var(--success);
}

.leave-item.status-rejected {
  border-left: 3px solid var(--border);
  opacity: 0.75;
}

.leave-item-person {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-width: 180px;
  flex-shrink: 0;
}

.person-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--brand-100);
  color: var(--brand-700);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.9rem;
  flex-shrink: 0;
}

.person-name {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary);
}

.person-dept {
  font-size: 0.75rem;
  color: var(--text-muted);
  margin-top: 2px;
}

.leave-item-detail {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.leave-dates {
  font-size: 0.875rem;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.leave-types-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.leave-reason {
  font-size: 0.78rem;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 200px;
}

.review-comment {
  font-size: 0.78rem;
  color: var(--text-muted);
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  font-style: italic;
}

.leave-item-actions {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--space-2);
  flex-shrink: 0;
  min-width: 110px;
}

.action-btns {
  display: flex;
  gap: var(--space-2);
}

.leave-time {
  font-size: 0.7rem;
  color: var(--text-muted);
  white-space: nowrap;
}

/* 申請フォームパネル */
.leave-form-panel {
  position: sticky;
  top: calc(var(--header-height) + var(--space-4));
}

/* モーダル */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(13, 27, 42, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
  padding: var(--space-4);
}

.modal-dialog {
  background: var(--surface);
  border-radius: var(--radius-lg);
  width: 100%;
  max-width: 440px;
  box-shadow: var(--shadow-lg);
}

.req { color: var(--danger); margin-left: 2px; }
.form-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4); }
.col-span-2  { grid-column: span 2; }

.save-spinner {
  display: inline-block;
  width: 12px;
  height: 12px;
  border: 2px solid rgba(255,255,255,0.4);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

/* スライドインアニメーション（フォームパネルのみ） */
.slide-in-enter-active {
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.slide-in-leave-active {
  transition: all 0.2s ease;
}

.slide-in-enter-from {
  opacity: 0;
  transform: translateX(20px);
}

.slide-in-leave-to {
  opacity: 0;
  transform: translateX(20px);
}

@media (max-width: 1024px) {
  .leave-layout.show-form {
    grid-template-columns: 1fr;
  }

  .leave-item {
    flex-wrap: wrap;
  }

  .leave-item-person {
    min-width: unset;
    flex: 0 0 100%;
  }
}
</style>
