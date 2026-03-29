<template>
  <div class="container-fluid py-4">
    <!-- ヘッダー -->
    <div class="d-flex align-items-center justify-content-between mb-4">
      <div>
        <h1 class="h3 mb-1">勤怠管理</h1>
        <p class="text-muted mb-0">出退勤の打刻・勤怠実績の確認</p>
      </div>
      <!-- 月選択 -->
      <div class="d-flex align-items-center gap-2">
        <button class="btn btn-outline-secondary btn-sm" @click="prevMonth">
          <i class="bi bi-chevron-left"></i>
        </button>
        <span class="fw-semibold" style="min-width: 100px; text-align: center">
          {{ selectedYear }}年 {{ selectedMonth }}月
        </span>
        <button class="btn btn-outline-secondary btn-sm" @click="nextMonth">
          <i class="bi bi-chevron-right"></i>
        </button>
      </div>
    </div>

    <!-- エラー -->
    <div v-if="error" class="alert alert-danger alert-dismissible fade show" role="alert">
      <i class="bi bi-exclamation-triangle-fill me-2"></i>{{ error }}
      <button type="button" class="btn-close" @click="clearError"></button>
    </div>

    <!-- 打刻カード（自分の分のみ） -->
    <div v-if="myEmployee" class="card mb-4 border-0 shadow-sm">
      <div class="card-body p-4">
        <div class="row align-items-center">
          <div class="col-md-6">
            <h5 class="card-title mb-1">本日の打刻状況</h5>
            <p class="text-muted mb-0 small">{{ todayLabel }}</p>
          </div>
          <div class="col-md-6 mt-3 mt-md-0">
            <div class="d-flex flex-wrap gap-3 justify-content-md-end">
              <!-- 出勤時刻 -->
              <div class="text-center">
                <div class="small text-muted mb-1">出勤</div>
                <div class="h5 mb-0 fw-bold text-success">
                  {{ formatTime(todayRecord?.clock_in) }}
                </div>
              </div>
              <!-- 退勤時刻 -->
              <div class="text-center">
                <div class="small text-muted mb-1">退勤</div>
                <div class="h5 mb-0 fw-bold text-danger">
                  {{ formatTime(todayRecord?.clock_out) }}
                </div>
              </div>
              <!-- 実働時間 -->
              <div class="text-center">
                <div class="small text-muted mb-1">実働</div>
                <div class="h5 mb-0 fw-bold">
                  {{ formatWorkTime(todayRecord) }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <hr class="my-3">

        <!-- 打刻ボタン -->
        <div class="d-flex flex-wrap gap-2">
          <button
            class="btn btn-success px-4"
            :disabled="isClockedIn || isLoading"
            @click="handleClockIn"
          >
            <i class="bi bi-box-arrow-in-right me-2"></i>
            出勤
          </button>
          <button
            class="btn btn-danger px-4"
            :disabled="!isClockedIn || isClockedOut || isLoading"
            @click="showClockOutModal = true"
          >
            <i class="bi bi-box-arrow-right me-2"></i>
            退勤
          </button>
          <span v-if="isLoading" class="text-muted small align-self-center ms-1">
            <span class="spinner-border spinner-border-sm me-1"></span>処理中...
          </span>
        </div>
      </div>
    </div>

    <!-- 月次サマリーカード -->
    <div class="row g-3 mb-4">
      <div class="col-6 col-md-3">
        <div class="card border-0 shadow-sm h-100">
          <div class="card-body text-center py-3">
            <div class="text-muted small mb-1">出勤日数</div>
            <div class="h4 mb-0 fw-bold text-primary">{{ workDaysCount }}<small class="fs-6 fw-normal">日</small></div>
          </div>
        </div>
      </div>
      <div class="col-6 col-md-3">
        <div class="card border-0 shadow-sm h-100">
          <div class="card-body text-center py-3">
            <div class="text-muted small mb-1">合計実働</div>
            <div class="h4 mb-0 fw-bold">
              {{ Math.floor(totalWorkMinutes / 60) }}<small class="fs-6 fw-normal">h</small>
              {{ totalWorkMinutes % 60 }}<small class="fs-6 fw-normal">m</small>
            </div>
          </div>
        </div>
      </div>
      <div class="col-6 col-md-3">
        <div class="card border-0 shadow-sm h-100">
          <div class="card-body text-center py-3">
            <div class="text-muted small mb-1">欠勤日数</div>
            <div class="h4 mb-0 fw-bold text-danger">{{ absentDays }}<small class="fs-6 fw-normal">日</small></div>
          </div>
        </div>
      </div>
      <div class="col-6 col-md-3">
        <div class="card border-0 shadow-sm h-100">
          <div class="card-body text-center py-3">
            <div class="text-muted small mb-1">遅刻日数</div>
            <div class="h4 mb-0 fw-bold text-warning">{{ lateDays }}<small class="fs-6 fw-normal">日</small></div>
          </div>
        </div>
      </div>
    </div>

    <!-- 月次勤怠一覧テーブル -->
    <div class="card border-0 shadow-sm">
      <div class="card-header bg-white py-3 border-bottom">
        <h6 class="mb-0 fw-semibold">
          {{ selectedYear }}年{{ selectedMonth }}月の勤怠実績
        </h6>
      </div>
      <div class="card-body p-0">
        <div v-if="isLoading" class="text-center py-5 text-muted">
          <span class="spinner-border spinner-border-sm me-2"></span>読み込み中...
        </div>
        <div v-else-if="monthlyRecords.length === 0" class="text-center py-5 text-muted">
          <i class="bi bi-calendar-x fs-2 d-block mb-2"></i>
          この月の勤怠データはありません
        </div>
        <div v-else class="table-responsive">
          <table class="table table-hover align-middle mb-0">
            <thead class="table-light">
              <tr>
                <th class="ps-3">日付</th>
                <th>ステータス</th>
                <th>出勤時刻</th>
                <th>退勤時刻</th>
                <th>休憩</th>
                <th>実働時間</th>
                <th>備考</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="rec in monthlyRecords" :key="rec.id">
                <td class="ps-3">{{ formatDate(rec.work_date) }}</td>
                <td>
                  <span :class="statusBadgeClass(rec.status)">
                    {{ ATTENDANCE_STATUS_LABELS[rec.status] }}
                  </span>
                </td>
                <td class="font-monospace">{{ formatTime(rec.clock_in) }}</td>
                <td class="font-monospace">{{ formatTime(rec.clock_out) }}</td>
                <td>{{ rec.break_minutes > 0 ? `${rec.break_minutes}分` : '—' }}</td>
                <td class="font-monospace">{{ formatWorkTime(rec) }}</td>
                <td class="text-muted small">{{ rec.note ?? '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- 退勤モーダル -->
    <div
      v-if="showClockOutModal"
      class="modal fade show d-block"
      tabindex="-1"
      style="background: rgba(0,0,0,.5)"
      @click.self="showClockOutModal = false"
    >
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">退勤打刻</h5>
            <button class="btn-close" @click="showClockOutModal = false"></button>
          </div>
          <div class="modal-body">
            <div class="mb-3">
              <label class="form-label">休憩時間（分）</label>
              <input
                v-model.number="clockOutBreakMinutes"
                type="number"
                class="form-control"
                min="0"
                step="5"
                placeholder="例: 60"
              />
            </div>
            <div class="mb-3">
              <label class="form-label">備考</label>
              <input
                v-model="clockOutNote"
                type="text"
                class="form-control"
                placeholder="任意"
              />
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" @click="showClockOutModal = false">キャンセル</button>
            <button class="btn btn-danger" :disabled="isLoading" @click="handleClockOut">
              退勤する
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useAttendance } from '@/composables/useAttendance'
import type { AttendanceRecord } from '@/types'
import { ATTENDANCE_STATUS_LABELS } from '@/types'
import { supabase } from '@/lib/supabase'

// ----------------------------------------------------------------
// 状態
// ----------------------------------------------------------------
const authStore = useAuthStore()
const {
  todayRecord, monthlyRecords, isLoading, error,
  isClockedIn, isClockedOut, totalWorkMinutes,
  fetchTodayRecord, clockIn, clockOut, fetchMonthlyRecords,
} = useAttendance()

const myEmployee     = ref<{ id: string } | null>(null)
const showClockOutModal    = ref(false)
const clockOutBreakMinutes = ref(60)
const clockOutNote         = ref('')

// 月選択
const now            = new Date()
const selectedYear   = ref(now.getFullYear())
const selectedMonth  = ref(now.getMonth() + 1)

// ----------------------------------------------------------------
// computed
// ----------------------------------------------------------------
const todayLabel = computed(() => {
  const d = new Date()
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${['日','月','火','水','木','金','土'][d.getDay()]}）`
})

const workDaysCount = computed(() =>
  monthlyRecords.value.filter(r => r.status !== 'absent' && r.status !== 'holiday').length
)

const absentDays = computed(() =>
  monthlyRecords.value.filter(r => r.status === 'absent').length
)

const lateDays = computed(() =>
  monthlyRecords.value.filter(r => r.status === 'late').length
)

// ----------------------------------------------------------------
// ユーティリティ
// ----------------------------------------------------------------
function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  const weekdays = ['日', '月', '火', '水', '木', '金', '土']
  return `${d.getMonth() + 1}/${d.getDate()}（${weekdays[d.getDay()]}）`
}

function formatTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function formatWorkTime(rec: AttendanceRecord | null | undefined): string {
  if (!rec?.clock_in || !rec?.clock_out) return '—'
  const mins = Math.max(
    0,
    Math.floor(
      (new Date(rec.clock_out).getTime() - new Date(rec.clock_in).getTime()) / 60_000
    ) - rec.break_minutes
  )
  return `${Math.floor(mins / 60)}h${mins % 60}m`
}

function statusBadgeClass(status: string): string {
  const map: Record<string, string> = {
    present:     'badge bg-success',
    remote:      'badge bg-info',
    late:        'badge bg-warning text-dark',
    early_leave: 'badge bg-warning text-dark',
    absent:      'badge bg-danger',
    holiday:     'badge bg-secondary',
  }
  return map[status] ?? 'badge bg-secondary'
}

function clearError() {
  error.value = null
}

// ----------------------------------------------------------------
// イベントハンドラ
// ----------------------------------------------------------------
async function handleClockIn() {
  if (!myEmployee.value) return
  await clockIn(myEmployee.value.id)
}

async function handleClockOut() {
  if (!myEmployee.value) return
  await clockOut(myEmployee.value.id, clockOutBreakMinutes.value, clockOutNote.value || undefined)
  showClockOutModal.value  = false
  clockOutBreakMinutes.value = 60
  clockOutNote.value         = ''
}

function prevMonth() {
  if (selectedMonth.value === 1) {
    selectedYear.value -= 1
    selectedMonth.value = 12
  } else {
    selectedMonth.value -= 1
  }
}

function nextMonth() {
  if (selectedMonth.value === 12) {
    selectedYear.value += 1
    selectedMonth.value = 1
  } else {
    selectedMonth.value += 1
  }
}

// ----------------------------------------------------------------
// ライフサイクル
// ----------------------------------------------------------------
async function loadMyEmployee() {
  if (!authStore.user) return
  const { data } = await supabase
    .from('employees')
    .select('id')
    .eq('user_id', authStore.user.id)
    .maybeSingle()
  myEmployee.value = data
}

async function loadData() {
  if (!myEmployee.value) return
  await Promise.all([
    fetchTodayRecord(myEmployee.value.id),
    fetchMonthlyRecords(myEmployee.value.id, selectedYear.value, selectedMonth.value),
  ])
}

onMounted(async () => {
  await loadMyEmployee()
  await loadData()
})

watch([selectedYear, selectedMonth], () => loadData())
</script>
