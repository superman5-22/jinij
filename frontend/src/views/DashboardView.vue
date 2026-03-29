<template>
  <div>
    <!-- ページヘッダー（非対称レイアウト） -->
    <div class="dash-header">
      <div>
        <h1 class="page-title">{{ greeting }}、{{ firstName }}さん</h1>
        <p class="dash-subtitle">チームの現在地を確認しましょう。</p>
      </div>
      <RouterLink to="/employees/new" class="btn btn-primary">
        <i class="bi bi-person-plus"></i>
        従業員を追加
      </RouterLink>
    </div>

    <LoadingState v-if="loading" message="読み込み中..." />

    <template v-else>
      <!-- メイン統計エリア: 意図的に高さ・比率を変えた非対称グリッド -->
      <div class="stats-layout">
        <!-- 大きなプライマリカード -->
        <div class="stat-card stat-card-primary stat-main">
          <div class="stat-label">総従業員数</div>
          <div class="stat-value">
            {{ summary.total_employees }}
            <span class="stat-unit">名</span>
          </div>
          <div class="stat-sub">
            うち在職中 {{ summary.active_employees }}名
          </div>
          <div class="stat-bar-wrap" v-if="summary.total_employees > 0">
            <div
              class="stat-bar"
              :style="{ width: activeRatio + '%' }"
            ></div>
          </div>
        </div>

        <!-- 右側: 小さなカード縦積み -->
        <div class="stats-secondary">
          <div class="stat-card stat-small">
            <div class="stat-small-icon pending-icon">
              <i class="bi bi-hourglass-split"></i>
            </div>
            <div>
              <div class="stat-label">承認待ち</div>
              <div class="stat-value-sm">
                {{ summary.pending_leave_requests }}
                <span class="stat-unit-sm">件</span>
              </div>
            </div>
          </div>

          <div class="stat-card stat-small">
            <div class="stat-small-icon leave-icon">
              <i class="bi bi-umbrella"></i>
            </div>
            <div>
              <div class="stat-label">本日の休暇</div>
              <div class="stat-value-sm">
                {{ summary.on_leave_today }}
                <span class="stat-unit-sm">名</span>
              </div>
            </div>
          </div>

          <div class="stat-card stat-small">
            <div class="stat-small-icon hire-icon">
              <i class="bi bi-person-check"></i>
            </div>
            <div>
              <div class="stat-label">今月の入社</div>
              <div class="stat-value-sm">
                {{ summary.new_hires_this_month }}
                <span class="stat-unit-sm">名</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 最近の申請 (幅広め、密度のある情報) -->
      <div class="card recent-section">
        <div class="card-header">
          <div>
            <div class="card-title">最近の休暇申請</div>
            <div style="font-size:0.78rem; color:var(--text-muted); margin-top:2px">
              直近{{ recentRequests.length }}件
            </div>
          </div>
          <RouterLink to="/leaves" class="btn btn-secondary btn-sm">
            すべて見る <i class="bi bi-arrow-right"></i>
          </RouterLink>
        </div>

        <div v-if="recentRequests.length === 0" class="empty-state" style="padding:2.5rem">
          <div class="empty-state-icon"><i class="bi bi-calendar2-x"></i></div>
          <div class="empty-state-title">まだ申請がありません</div>
          <div class="empty-state-desc">休暇申請が提出されると、ここに表示されます。</div>
        </div>

        <div v-else class="recent-list">
          <div
            v-for="req in recentRequests"
            :key="req.id"
            class="recent-item"
          >
            <div class="recent-item-left">
              <div class="recent-employee">
                {{ req.employee?.full_name ?? '—' }}
                <span class="mono text-muted" style="margin-left:6px; font-size:0.75rem">
                  {{ req.employee?.employee_code }}
                </span>
              </div>
              <div class="recent-meta">
                <StatusBadge type="leave-type" :value="req.leave_type" />
                <span class="text-muted" style="font-size:0.78rem">
                  {{ formatDate(req.start_date) }}
                  <template v-if="req.start_date !== req.end_date">
                    〜 {{ formatDate(req.end_date) }}
                  </template>
                  （{{ req.days_count }}日）
                </span>
              </div>
            </div>
            <div class="recent-item-right">
              <StatusBadge type="leave-status" :value="req.status" :showDot="true" />
              <span class="recent-time">{{ timeAgo(req.created_at) }}</span>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/ja'
import { useDashboard } from '@/composables/useDashboard'
import { useAuthStore } from '@/stores/auth'
import LoadingState from '@/components/common/LoadingState.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'

dayjs.extend(relativeTime)
dayjs.locale('ja')

const { summary, recentRequests, loading, fetchSummary } = useDashboard()
const auth = useAuthStore()

onMounted(() => fetchSummary())

const greeting = computed(() => {
  const h = new Date().getHours()
  if (h < 12) return 'おはようございます'
  if (h < 17) return 'こんにちは'
  return 'お疲れさまです'
})

const firstName = computed(() => {
  const name = auth.displayName
  return name.includes(' ') ? name.split(' ')[0] : name
})

const activeRatio = computed(() => {
  if (!summary.value.total_employees) return 0
  return Math.round((summary.value.active_employees / summary.value.total_employees) * 100)
})

function formatDate(d: string) {
  return dayjs(d).format('M/D')
}

function timeAgo(d: string) {
  return dayjs(d).fromNow()
}
</script>

<style scoped>
.dash-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: var(--space-8);
  gap: var(--space-4);
}

.dash-subtitle {
  font-size: 0.875rem;
  color: var(--text-muted);
  margin-top: var(--space-1);
}

/* 非対称グリッド: メインカードが広く、右は3枚縦積み */
.stats-layout {
  display: grid;
  grid-template-columns: 1fr 280px;
  gap: var(--space-5);
  margin-bottom: var(--space-6);
  align-items: start;
}

.stat-main {
  padding: var(--space-8) var(--space-8);
}

.stat-main .stat-value {
  font-size: 3.5rem;
  margin: var(--space-3) 0;
}

.stat-bar-wrap {
  height: 4px;
  background: rgba(255,255,255,0.15);
  border-radius: 2px;
  margin-top: var(--space-4);
  overflow: hidden;
}

.stat-bar {
  height: 100%;
  background: var(--accent-light);
  border-radius: 2px;
  transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1);
}

.stats-secondary {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.stat-small {
  padding: var(--space-4) var(--space-5);
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.stat-small-icon {
  width: 38px;
  height: 38px;
  border-radius: var(--radius);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  flex-shrink: 0;
}

.pending-icon { background: var(--warning-bg); color: var(--warning); }
.leave-icon   { background: var(--info-bg);    color: var(--info); }
.hire-icon    { background: var(--success-bg); color: var(--success); }

.stat-value-sm {
  font-size: 1.6rem;
  font-weight: 800;
  line-height: 1;
  letter-spacing: -0.02em;
  color: var(--text-primary);
}

.stat-unit-sm {
  font-size: 0.85rem;
  font-weight: 500;
  margin-left: 2px;
}

/* 最近の申請リスト */
.recent-section {
  margin-top: var(--space-4);
}

.card-title {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--text-primary);
}

.recent-list {
  divide-y: 1px solid var(--border);
}

.recent-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.875rem var(--space-6);
  border-bottom: 1px solid var(--border);
  gap: var(--space-4);
  transition: background var(--ease-fast);
}

.recent-item:last-child { border-bottom: none; }
.recent-item:hover { background: var(--brand-50); }

.recent-item-left {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-width: 0;
}

.recent-employee {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary);
  display: flex;
  align-items: baseline;
  gap: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.recent-meta {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.recent-item-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--space-2);
  flex-shrink: 0;
}

.recent-time {
  font-size: 0.72rem;
  color: var(--text-muted);
  white-space: nowrap;
}

@media (max-width: 1024px) {
  .stats-layout {
    grid-template-columns: 1fr;
  }

  .stats-secondary {
    flex-direction: row;
    flex-wrap: wrap;
  }

  .stat-small {
    flex: 1;
    min-width: 160px;
  }
}
</style>
