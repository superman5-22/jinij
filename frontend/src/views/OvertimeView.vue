<template>
  <div>
    <!-- ページヘッダー -->
    <div class="leave-header">
      <div>
        <h1 class="page-title">残業申請・承認</h1>
        <p style="font-size:0.82rem; color:var(--text-muted); margin-top:4px">
          承認待ち
          <strong style="color:var(--warning)">{{ pendingCount }}件</strong>
        </p>
      </div>
      <button
        class="btn btn-secondary btn-sm"
        @click="showRequestForm = !showRequestForm"
      >
        <i :class="showRequestForm ? 'bi bi-x-lg' : 'bi bi-plus-lg'"></i>
        {{ showRequestForm ? '閉じる' : '残業申請' }}
      </button>
    </div>

    <!-- 2カラムレイアウト -->
    <div class="leave-layout" :class="{ 'show-form': showRequestForm }">
      <!-- 左: 申請一覧 -->
      <div class="leave-main">
        <div class="card">
          <!-- フィルター -->
          <div class="filter-bar" style="gap:var(--space-3)">
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

            <div style="display:flex; gap:var(--space-2); margin-left:auto; align-items:center">
              <input
                v-model="filters.date_from"
                type="date"
                class="form-control"
                style="width:140px"
                @change="applyFilters"
              />
              <span style="color:var(--text-muted)">〜</span>
              <input
                v-model="filters.date_to"
                type="date"
                class="form-control"
                style="width:140px"
                @change="applyFilters"
              />
            </div>
          </div>

          <!-- エラー -->
          <div v-if="error" class="alert alert-danger mt-3">{{ error }}</div>

          <!-- ローディング -->
          <div v-if="isLoading" class="text-center py-5">
            <div class="spinner-border text-secondary" style="width:2rem;height:2rem;"></div>
          </div>

          <!-- データなし -->
          <div v-else-if="requests.length === 0" class="empty-state">
            <i class="bi bi-clipboard-x" style="font-size:2rem; color:var(--text-muted)"></i>
            <p style="color:var(--text-muted); margin-top:8px">残業申請はありません</p>
          </div>

          <!-- 申請一覧テーブル -->
          <table v-else class="data-table">
            <thead>
              <tr>
                <th>氏名</th>
                <th>残業日</th>
                <th>予定退社</th>
                <th>残業時間</th>
                <th>理由</th>
                <th>ステータス</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="req in requests" :key="req.id">
                <td>
                  <div style="font-weight:500">{{ req.employee?.full_name ?? '—' }}</div>
                  <div style="font-size:0.75rem; color:var(--text-muted)">
                    {{ req.employee?.employee_code }}
                  </div>
                </td>
                <td>{{ req.work_date }}</td>
                <td>{{ req.planned_end.slice(0, 5) }}</td>
                <td>{{ req.overtime_hours }}h</td>
                <td style="max-width:200px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis">
                  {{ req.reason }}
                </td>
                <td>
                  <span class="badge" :class="statusBadgeClass(req.status)">
                    {{ OVERTIME_STATUS_LABELS[req.status] }}
                  </span>
                </td>
                <td>
                  <div v-if="req.status === 'pending'" style="display:flex; gap:4px">
                    <button
                      v-if="auth.isHR || auth.profile?.role === 'manager'"
                      class="btn btn-xs btn-success"
                      @click="openApprove(req)"
                    >承認</button>
                    <button
                      v-if="auth.isHR || auth.profile?.role === 'manager'"
                      class="btn btn-xs btn-danger"
                      @click="openReject(req)"
                    >却下</button>
                    <button
                      v-if="req.user_id === auth.user?.id"
                      class="btn btn-xs btn-outline-secondary"
                      @click="handleCancel(req.id)"
                    >取消</button>
                  </div>
                  <span v-else style="color:var(--text-muted); font-size:0.8rem">—</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 右: 申請フォーム -->
      <div v-if="showRequestForm" class="leave-form-panel">
        <div class="card">
          <h5 style="margin-bottom:var(--space-4)">残業申請フォーム</h5>

          <div class="mb-3">
            <label class="form-label">残業日 <span class="text-danger">*</span></label>
            <input v-model="form.work_date" type="date" class="form-control" />
          </div>

          <div class="mb-3">
            <label class="form-label">予定退社時刻 <span class="text-danger">*</span></label>
            <input v-model="form.planned_end" type="time" class="form-control" />
          </div>

          <div class="mb-3">
            <label class="form-label">残業時間（時間） <span class="text-danger">*</span></label>
            <input
              v-model.number="form.overtime_hours"
              type="number"
              min="0.5"
              max="10"
              step="0.5"
              class="form-control"
            />
          </div>

          <div class="mb-3">
            <label class="form-label">残業理由 <span class="text-danger">*</span></label>
            <textarea
              v-model="form.reason"
              rows="3"
              class="form-control"
              placeholder="残業が必要な理由を入力してください"
            ></textarea>
          </div>

          <div v-if="formError" class="alert alert-danger">{{ formError }}</div>

          <button
            class="btn btn-primary w-100"
            :disabled="submitting"
            @click="handleSubmit"
          >
            <span v-if="submitting" class="spinner-border spinner-border-sm me-1"></span>
            申請する
          </button>
        </div>
      </div>
    </div>

    <!-- 承認モーダル -->
    <div v-if="approveTarget" class="modal-backdrop" @click.self="approveTarget = null">
      <div class="modal-box">
        <h5>残業申請を承認しますか？</h5>
        <p style="color:var(--text-muted)">
          {{ approveTarget.employee?.full_name }}（{{ approveTarget.work_date }}
          {{ approveTarget.overtime_hours }}時間）
        </p>
        <div class="mb-3">
          <label class="form-label">コメント（任意）</label>
          <textarea v-model="reviewComment" rows="2" class="form-control"></textarea>
        </div>
        <div style="display:flex; gap:8px; justify-content:flex-end">
          <button class="btn btn-outline-secondary btn-sm" @click="approveTarget = null">
            キャンセル
          </button>
          <button class="btn btn-success btn-sm" @click="handleApprove">承認する</button>
        </div>
      </div>
    </div>

    <!-- 却下モーダル -->
    <div v-if="rejectTarget" class="modal-backdrop" @click.self="rejectTarget = null">
      <div class="modal-box">
        <h5>残業申請を却下しますか？</h5>
        <p style="color:var(--text-muted)">
          {{ rejectTarget.employee?.full_name }}（{{ rejectTarget.work_date }}
          {{ rejectTarget.overtime_hours }}時間）
        </p>
        <div class="mb-3">
          <label class="form-label">却下理由 <span class="text-danger">*</span></label>
          <textarea v-model="reviewComment" rows="2" class="form-control"></textarea>
        </div>
        <div v-if="rejectError" class="alert alert-danger py-1 px-2" style="font-size:0.8rem">
          {{ rejectError }}
        </div>
        <div style="display:flex; gap:8px; justify-content:flex-end">
          <button class="btn btn-outline-secondary btn-sm" @click="rejectTarget = null">
            キャンセル
          </button>
          <button class="btn btn-danger btn-sm" @click="handleReject">却下する</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useOvertimeRequests } from '@/composables/useOvertimeRequests'
import { useAuthStore } from '@/stores/auth'
import { OVERTIME_STATUS_LABELS } from '@/types'
import type { OvertimeRequest, OvertimeStatus } from '@/types'

const auth = useAuthStore()
const {
  requests, isLoading, error, filters,
  fetchRequests, submitRequest, approveRequest, rejectRequest, cancelRequest,
  applyFilters,
} = useOvertimeRequests()

// ----------------------------------------------------------------
// フォーム状態
// ----------------------------------------------------------------
const showRequestForm = ref(false)
const submitting      = ref(false)
const formError       = ref<string | null>(null)

const form = ref({
  employee_id:    '',
  work_date:      '',
  planned_end:    '20:00',
  overtime_hours: 1,
  reason:         '',
})

// ----------------------------------------------------------------
// 承認・却下モーダル
// ----------------------------------------------------------------
const approveTarget  = ref<OvertimeRequest | null>(null)
const rejectTarget   = ref<OvertimeRequest | null>(null)
const reviewComment  = ref('')
const rejectError    = ref<string | null>(null)

function openApprove(req: OvertimeRequest) {
  approveTarget.value = req
  reviewComment.value = ''
}

function openReject(req: OvertimeRequest) {
  rejectTarget.value = req
  reviewComment.value = ''
  rejectError.value  = null
}

// ----------------------------------------------------------------
// ステータスタブ
// ----------------------------------------------------------------
type StatusTab = { value: OvertimeStatus | ''; label: string; count: number | null }

const statusTabs = computed<StatusTab[]>(() => [
  { value: '',          label: 'すべて',  count: requests.value.length },
  { value: 'pending',   label: '承認待ち', count: requests.value.filter(r => r.status === 'pending').length },
  { value: 'approved',  label: '承認済み', count: null },
  { value: 'rejected',  label: '却下',    count: null },
])

const pendingCount = computed(() =>
  requests.value.filter(r => r.status === 'pending').length
)

function setStatusFilter(value: OvertimeStatus | '') {
  filters.value.status = value
  fetchRequests()
}

// ----------------------------------------------------------------
// バッジクラス
// ----------------------------------------------------------------
function statusBadgeClass(status: OvertimeStatus) {
  return {
    'bg-warning text-dark': status === 'pending',
    'bg-success':           status === 'approved',
    'bg-danger':            status === 'rejected',
    'bg-secondary':         status === 'cancelled',
  }
}

// ----------------------------------------------------------------
// 操作ハンドラ
// ----------------------------------------------------------------
async function handleSubmit() {
  formError.value = null

  if (!form.value.work_date)           { formError.value = '残業日を入力してください'; return }
  if (!form.value.planned_end)         { formError.value = '予定退社時刻を入力してください'; return }
  if (!form.value.overtime_hours || form.value.overtime_hours <= 0) {
    formError.value = '残業時間は0より大きい値を入力してください'; return
  }
  if (!form.value.reason.trim())       { formError.value = '残業理由を入力してください'; return }

  // employee_id が未設定の場合、ログインユーザーの employee を特定
  if (!form.value.employee_id) {
    formError.value = '社員情報が取得できません。再ログインしてください'; return
  }

  submitting.value = true
  const result = await submitRequest(form.value)
  submitting.value = false

  if (result) {
    showRequestForm.value  = false
    form.value.work_date   = ''
    form.value.reason      = ''
    form.value.overtime_hours = 1
    await fetchRequests()
  } else {
    formError.value = error.value
  }
}

async function handleApprove() {
  if (!approveTarget.value || !auth.user) return
  await approveRequest(approveTarget.value.id, auth.user.id, reviewComment.value)
  approveTarget.value = null
}

async function handleReject() {
  if (!rejectTarget.value || !auth.user) return
  rejectError.value = null
  if (!reviewComment.value.trim()) {
    rejectError.value = '却下理由を入力してください'
    return
  }
  await rejectRequest(rejectTarget.value.id, auth.user.id, reviewComment.value)
  rejectTarget.value = null
}

async function handleCancel(id: string) {
  if (!confirm('この残業申請を取り消しますか？')) return
  await cancelRequest(id)
}

// ----------------------------------------------------------------
// 初期化: ログインユーザーの employee_id を取得
// ----------------------------------------------------------------
onMounted(async () => {
  await fetchRequests()

  if (auth.user) {
    const { supabase } = await import('@/lib/supabase')
    const { data } = await supabase
      .from('employees')
      .select('id')
      .eq('user_id', auth.user.id)
      .single()
    if (data) form.value.employee_id = data.id
  }
})
</script>

<style scoped>
.leave-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-4);
}

.leave-layout {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-4);
}
.leave-layout.show-form {
  grid-template-columns: 1fr 340px;
}

.leave-form-panel {
  min-width: 0;
}

/* modal */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.modal-box {
  background: var(--surface);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  width: 420px;
  max-width: 90vw;
  box-shadow: var(--shadow-lg);
}

.btn-xs {
  padding: 2px 8px;
  font-size: 0.75rem;
}

.empty-state {
  text-align: center;
  padding: var(--space-8);
}
</style>
