<template>
  <div>
    <!-- ページヘッダー -->
    <div class="list-header">
      <div>
        <h1 class="page-title">従業員一覧</h1>
        <p v-if="!loading" style="font-size:0.82rem; color:var(--text-muted); margin-top:4px">
          全 {{ pagination.total }}名
          <template v-if="hasActiveFilters"> · フィルター適用中</template>
        </p>
      </div>
      <RouterLink to="/employees/new" class="btn btn-primary">
        <i class="bi bi-person-plus-fill"></i>
        新規登録
      </RouterLink>
    </div>

    <!-- テーブルカード -->
    <div class="card">
      <!-- フィルターバー -->
      <div class="filter-bar">
        <div class="search-wrap">
          <i class="bi bi-search"></i>
          <input
            v-model="filters.search"
            type="search"
            class="form-control"
            placeholder="名前・社員コード・メールで検索..."
            @input="onSearchInput"
          />
        </div>

        <select
          v-model="filters.department_id"
          class="form-select filter-select"
          @change="applyFilters"
        >
          <option value="">部署: すべて</option>
          <option v-for="d in departments" :key="d.id" :value="d.id">
            {{ d.name }}
          </option>
        </select>

        <select
          v-model="filters.status"
          class="form-select filter-select"
          style="min-width:130px"
          @change="applyFilters"
        >
          <option value="">状態: すべて</option>
          <option value="active">在職</option>
          <option value="on_leave">休職中</option>
          <option value="inactive">退職</option>
        </select>

        <select
          v-model="filters.employment_type"
          class="form-select filter-select"
          @change="applyFilters"
        >
          <option value="">雇用形態: すべて</option>
          <option value="full_time">正社員</option>
          <option value="part_time">パート・アルバイト</option>
          <option value="contract">契約社員</option>
          <option value="temporary">派遣社員</option>
        </select>

        <button
          v-if="hasActiveFilters"
          class="btn btn-secondary btn-sm"
          @click="clearFilters"
          style="white-space:nowrap"
        >
          <i class="bi bi-x-lg"></i>
          クリア
        </button>
      </div>

      <!-- テーブル本体 -->
      <div class="table-wrap">
        <LoadingState v-if="loading" message="読み込み中..." />

        <table v-else-if="employees.length > 0" class="data-table">
          <thead>
            <tr>
              <th class="col-code">社員コード</th>
              <th>氏名</th>
              <th>部署</th>
              <th>役職</th>
              <th>雇用形態</th>
              <th>入社日</th>
              <th>状態</th>
              <th class="col-actions"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="emp in employees" :key="emp.id">
              <td class="col-code">{{ emp.employee_code }}</td>
              <td class="col-name">
                <RouterLink
                  :to="`/employees/${emp.id}`"
                  class="emp-name-link"
                >{{ emp.full_name }}</RouterLink>
                <div v-if="emp.full_name_kana" class="emp-kana">{{ emp.full_name_kana }}</div>
              </td>
              <td>
                <span v-if="emp.department" class="dept-tag">
                  {{ emp.department.name }}
                </span>
                <span v-else class="text-muted">—</span>
              </td>
              <td style="font-size:0.875rem">{{ emp.position }}</td>
              <td>
                <span style="font-size:0.82rem; color:var(--text-secondary)">
                  {{ EMPLOYMENT_TYPE_LABELS[emp.employment_type] }}
                </span>
              </td>
              <td style="font-size:0.82rem; color:var(--text-secondary); white-space:nowrap">
                {{ formatHireDate(emp.hire_date) }}
              </td>
              <td>
                <StatusBadge type="employee-status" :value="emp.status" :showDot="true" />
              </td>
              <td class="col-actions">
                <RouterLink
                  :to="`/employees/${emp.id}`"
                  class="btn-icon"
                  title="詳細"
                >
                  <i class="bi bi-eye"></i>
                </RouterLink>
                <RouterLink
                  :to="`/employees/${emp.id}/edit`"
                  class="btn-icon"
                  title="編集"
                >
                  <i class="bi bi-pencil"></i>
                </RouterLink>
              </td>
            </tr>
          </tbody>
        </table>

        <div v-else class="empty-state">
          <div class="empty-state-icon"><i class="bi bi-people"></i></div>
          <div class="empty-state-title">
            {{ hasActiveFilters ? '条件に一致する従業員がいません' : 'まだ従業員が登録されていません' }}
          </div>
          <div class="empty-state-desc">
            {{ hasActiveFilters
              ? '絞り込み条件を変えてみてください。'
              : '右上の「新規登録」から従業員を追加できます。'
            }}
          </div>
        </div>
      </div>

      <!-- ページネーション -->
      <div v-if="totalPages > 1 || employees.length > 0" class="pagination-bar">
        <span>
          {{ (pagination.page - 1) * pagination.per_page + 1 }}–{{
            Math.min(pagination.page * pagination.per_page, pagination.total)
          }} / {{ pagination.total }}件
        </span>
        <div class="pagination-controls">
          <button
            class="page-btn"
            :disabled="pagination.page <= 1"
            @click="setPage(pagination.page - 1)"
          >
            <i class="bi bi-chevron-left"></i>
          </button>
          <button
            v-for="p in visiblePages"
            :key="p"
            class="page-btn"
            :class="{ active: p === pagination.page }"
            @click="setPage(p)"
          >{{ p }}</button>
          <button
            class="page-btn"
            :disabled="pagination.page >= totalPages"
            @click="setPage(pagination.page + 1)"
          >
            <i class="bi bi-chevron-right"></i>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import dayjs from 'dayjs'
import { useEmployees } from '@/composables/useEmployees'
import { EMPLOYMENT_TYPE_LABELS } from '@/types'
import LoadingState from '@/components/common/LoadingState.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'

const {
  employees, departments, loading, pagination, filters, totalPages,
  fetchDepartments, fetchEmployees, setPage, applyFilters,
} = useEmployees()

let searchTimer: ReturnType<typeof setTimeout>

function onSearchInput() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => applyFilters(), 350)
}

function clearFilters() {
  filters.value.search = ''
  filters.value.department_id = ''
  filters.value.status = ''
  filters.value.employment_type = ''
  applyFilters()
}

const hasActiveFilters = computed(() =>
  !!(filters.value.search || filters.value.department_id ||
     filters.value.status || filters.value.employment_type)
)

const visiblePages = computed(() => {
  const current = pagination.value.page
  const total   = totalPages.value
  const pages: number[] = []
  const delta = 2

  for (
    let i = Math.max(1, current - delta);
    i <= Math.min(total, current + delta);
    i++
  ) {
    pages.push(i)
  }
  return pages
})

function formatHireDate(d: string) {
  return dayjs(d).format('YYYY/MM')
}

onMounted(async () => {
  await Promise.all([fetchDepartments(), fetchEmployees()])
})
</script>

<style scoped>
.list-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: var(--space-6);
  gap: var(--space-4);
}

.table-wrap {
  overflow-x: auto;
}

.emp-name-link {
  color: var(--text-primary);
  font-weight: 600;
  text-decoration: none;
  font-size: 0.9rem;
  transition: color var(--ease-fast);
}

.emp-name-link:hover {
  color: var(--brand-700);
}

.emp-kana {
  font-size: 0.7rem;
  color: var(--text-muted);
  margin-top: 2px;
  letter-spacing: 0.03em;
}

.dept-tag {
  display: inline-block;
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--brand-700);
  background: var(--brand-50);
  padding: 0.15em 0.55em;
  border-radius: 3px;
}
</style>
