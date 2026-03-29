<template>
  <div>
    <!-- ヘッダー -->
    <div class="detail-header">
      <div class="detail-title-area">
        <RouterLink to="/employees" class="back-link">
          <i class="bi bi-arrow-left"></i> 一覧に戻る
        </RouterLink>
        <h1 class="page-title" style="margin-top:var(--space-2)">
          <template v-if="mode === 'create'">従業員を新規登録</template>
          <template v-else-if="mode === 'edit'">{{ employee?.full_name ?? '...' }} を編集</template>
          <template v-else>{{ employee?.full_name ?? '...' }}</template>
        </h1>
        <div v-if="employee && mode === 'view'" class="detail-meta">
          <span class="mono text-muted">{{ employee.employee_code }}</span>
          <StatusBadge type="employee-status" :value="employee.status" :showDot="true" />
          <span style="font-size:0.8rem; color:var(--text-muted)">
            入社 {{ formatDate(employee.hire_date) }}
          </span>
        </div>
      </div>

      <div class="detail-actions" v-if="mode === 'view' && employee">
        <RouterLink :to="`/employees/${employee.id}/edit`" class="btn btn-primary">
          <i class="bi bi-pencil"></i> 編集
        </RouterLink>
      </div>
      <div class="detail-actions" v-else-if="mode !== 'view'">
        <button class="btn btn-secondary" @click="handleCancel" :disabled="saving">
          キャンセル
        </button>
        <button class="btn btn-primary" @click="handleSave" :disabled="saving">
          <span v-if="saving">
            <span class="save-spinner"></span>
            保存中...
          </span>
          <span v-else>
            <i class="bi bi-check-lg"></i>
            {{ mode === 'create' ? '登録する' : '変更を保存' }}
          </span>
        </button>
      </div>
    </div>

    <!-- ローディング -->
    <LoadingState v-if="pageLoading" message="読み込み中..." />

    <template v-else>
      <!-- エラー -->
      <div v-if="saveError" class="alert alert-error" style="margin-bottom:var(--space-5)">
        <i class="bi bi-exclamation-circle-fill"></i>
        {{ saveError }}
      </div>

      <!-- フォーム / 詳細表示 -->
      <div class="detail-layout">
        <!-- メインフォーム -->
        <div class="detail-main">
          <!-- セクション1: 基本情報 (密度高め) -->
          <div class="card">
            <div class="card-header">
              <div class="section-title" style="font-size:0.75rem; text-transform:uppercase; letter-spacing:0.07em; color:var(--text-muted)">
                基本情報
              </div>
            </div>
            <div class="card-body">
              <div class="form-grid-3">
                <div>
                  <label class="form-label">社員コード<span class="req">*</span></label>
                  <template v-if="mode !== 'view'">
                    <input v-model="form.employee_code" type="text" class="form-control"
                      :class="{ 'is-invalid': err.employee_code }" placeholder="EMP001" />
                    <div class="invalid-feedback">{{ err.employee_code }}</div>
                  </template>
                  <div v-else class="view-value mono">{{ employee?.employee_code }}</div>
                </div>

                <div class="col-span-2">
                  <label class="form-label">氏名<span class="req">*</span></label>
                  <template v-if="mode !== 'view'">
                    <input v-model="form.full_name" type="text" class="form-control"
                      :class="{ 'is-invalid': err.full_name }" placeholder="山田 太郎" />
                    <div class="invalid-feedback">{{ err.full_name }}</div>
                  </template>
                  <div v-else class="view-value">{{ employee?.full_name }}</div>
                </div>

                <div class="col-span-2">
                  <label class="form-label">氏名（カナ）</label>
                  <template v-if="mode !== 'view'">
                    <input v-model="form.full_name_kana" type="text" class="form-control"
                      placeholder="ヤマダ タロウ" />
                  </template>
                  <div v-else class="view-value">{{ employee?.full_name_kana || '—' }}</div>
                </div>

                <div>
                  <label class="form-label">メールアドレス<span class="req">*</span></label>
                  <template v-if="mode !== 'view'">
                    <input v-model="form.email" type="email" class="form-control"
                      :class="{ 'is-invalid': err.email }" placeholder="taro@company.co.jp" />
                    <div class="invalid-feedback">{{ err.email }}</div>
                  </template>
                  <div v-else class="view-value">
                    <a :href="`mailto:${employee?.email}`" style="color:var(--brand-700)">
                      {{ employee?.email }}
                    </a>
                  </div>
                </div>

                <div>
                  <label class="form-label">電話番号</label>
                  <template v-if="mode !== 'view'">
                    <input v-model="form.phone" type="tel" class="form-control"
                      placeholder="090-1234-5678" />
                  </template>
                  <div v-else class="view-value">{{ employee?.phone || '—' }}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- セクション2: 所属情報 -->
          <div class="card" style="margin-top:var(--space-5)">
            <div class="card-header">
              <div class="section-title" style="font-size:0.75rem; text-transform:uppercase; letter-spacing:0.07em; color:var(--text-muted)">
                所属・職務
              </div>
            </div>
            <div class="card-body">
              <div class="form-grid-2">
                <div>
                  <label class="form-label">部署</label>
                  <template v-if="mode !== 'view'">
                    <select v-model="form.department_id" class="form-select">
                      <option value="">選択してください</option>
                      <option v-for="d in departments" :key="d.id" :value="d.id">
                        {{ d.name }}
                      </option>
                    </select>
                  </template>
                  <div v-else class="view-value">{{ employee?.department?.name || '—' }}</div>
                </div>

                <div>
                  <label class="form-label">役職<span class="req">*</span></label>
                  <template v-if="mode !== 'view'">
                    <input v-model="form.position" type="text" class="form-control"
                      :class="{ 'is-invalid': err.position }" placeholder="エンジニア" />
                    <div class="invalid-feedback">{{ err.position }}</div>
                  </template>
                  <div v-else class="view-value">{{ employee?.position }}</div>
                </div>

                <div>
                  <label class="form-label">雇用形態<span class="req">*</span></label>
                  <template v-if="mode !== 'view'">
                    <select v-model="form.employment_type" class="form-select">
                      <option value="full_time">正社員</option>
                      <option value="part_time">パート・アルバイト</option>
                      <option value="contract">契約社員</option>
                      <option value="temporary">派遣社員</option>
                    </select>
                  </template>
                  <div v-else class="view-value">
                    {{ EMPLOYMENT_TYPE_LABELS[employee?.employment_type ?? 'full_time'] }}
                  </div>
                </div>

                <div>
                  <label class="form-label">状態</label>
                  <template v-if="mode !== 'view'">
                    <select v-model="form.status" class="form-select">
                      <option value="active">在職</option>
                      <option value="on_leave">休職中</option>
                      <option value="inactive">退職</option>
                    </select>
                  </template>
                  <div v-else class="view-value">
                    <StatusBadge type="employee-status" :value="employee?.status ?? ''" :showDot="true" />
                  </div>
                </div>

                <div>
                  <label class="form-label">入社日<span class="req">*</span></label>
                  <template v-if="mode !== 'view'">
                    <input v-model="form.hire_date" type="date" class="form-control"
                      :class="{ 'is-invalid': err.hire_date }" />
                    <div class="invalid-feedback">{{ err.hire_date }}</div>
                  </template>
                  <div v-else class="view-value">{{ formatDate(employee?.hire_date ?? '') }}</div>
                </div>

                <div>
                  <label class="form-label">生年月日</label>
                  <template v-if="mode !== 'view'">
                    <input v-model="form.birth_date" type="date" class="form-control" />
                  </template>
                  <div v-else class="view-value">
                    {{ employee?.birth_date ? formatDate(employee.birth_date) : '—' }}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- セクション3: 個人情報 (余白多め) -->
          <div class="card" style="margin-top:var(--space-5)">
            <div class="card-header">
              <div class="section-title" style="font-size:0.75rem; text-transform:uppercase; letter-spacing:0.07em; color:var(--text-muted)">
                個人情報・緊急連絡先
              </div>
            </div>
            <div class="card-body" style="padding-bottom:var(--space-8)">
              <div class="form-grid-1" style="margin-bottom:var(--space-5)">
                <label class="form-label">住所</label>
                <template v-if="mode !== 'view'">
                  <input v-model="form.address" type="text" class="form-control"
                    placeholder="東京都渋谷区..." />
                </template>
                <div v-else class="view-value">{{ employee?.address || '—' }}</div>
              </div>

              <div class="form-grid-2">
                <div>
                  <label class="form-label">緊急連絡先（氏名）</label>
                  <template v-if="mode !== 'view'">
                    <input v-model="form.emergency_contact_name" type="text" class="form-control"
                      placeholder="山田 花子" />
                  </template>
                  <div v-else class="view-value">{{ employee?.emergency_contact_name || '—' }}</div>
                </div>
                <div>
                  <label class="form-label">緊急連絡先（電話）</label>
                  <template v-if="mode !== 'view'">
                    <input v-model="form.emergency_contact_phone" type="tel" class="form-control"
                      placeholder="090-0000-0000" />
                  </template>
                  <div v-else class="view-value">{{ employee?.emergency_contact_phone || '—' }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- サイドバー: 休暇残日数 + メモ -->
        <div class="detail-sidebar">
          <div class="card">
            <div class="card-header">
              <div class="section-title" style="font-size:0.75rem; text-transform:uppercase; letter-spacing:0.07em; color:var(--text-muted)">
                休暇設定
              </div>
            </div>
            <div class="card-body">
              <label class="form-label">年次有給休暇残日数</label>
              <template v-if="mode !== 'view'">
                <div class="leave-input-wrap">
                  <input
                    v-model.number="form.annual_leave_balance"
                    type="number"
                    min="0"
                    max="40"
                    class="form-control"
                    style="text-align:right; padding-right:2.5rem"
                  />
                  <span class="leave-unit">日</span>
                </div>
                <div class="form-text">付与日数は人事担当者が手動で設定します。</div>
              </template>
              <div v-else class="leave-display">
                <span class="leave-number">{{ employee?.annual_leave_balance }}</span>
                <span class="leave-label">日</span>
              </div>
            </div>
          </div>

          <div class="card" style="margin-top:var(--space-4)">
            <div class="card-header">
              <div class="section-title" style="font-size:0.75rem; text-transform:uppercase; letter-spacing:0.07em; color:var(--text-muted)">
                メモ
              </div>
            </div>
            <div class="card-body">
              <template v-if="mode !== 'view'">
                <textarea
                  v-model="form.notes"
                  class="form-control"
                  rows="5"
                  placeholder="特記事項など..."
                  style="resize:vertical"
                ></textarea>
              </template>
              <div v-else class="view-value" style="white-space:pre-wrap; line-height:1.7">
                {{ employee?.notes || '特記事項なし' }}
              </div>
            </div>
          </div>

          <!-- 登録情報 (詳細モードのみ) -->
          <div v-if="mode === 'view' && employee" class="card" style="margin-top:var(--space-4); background:var(--surface-2)">
            <div class="card-body" style="padding:var(--space-4) var(--space-5)">
              <div class="meta-row">
                <span class="meta-label">登録日</span>
                <span class="meta-value">{{ formatDateTime(employee.created_at) }}</span>
              </div>
              <div class="meta-row" style="margin-top:var(--space-2)">
                <span class="meta-label">最終更新</span>
                <span class="meta-value">{{ formatDateTime(employee.updated_at) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import dayjs from 'dayjs'
import { useEmployees } from '@/composables/useEmployees'
import { EMPLOYMENT_TYPE_LABELS } from '@/types'
import type { Employee, EmployeeFormData } from '@/types'
import LoadingState from '@/components/common/LoadingState.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'

const props = defineProps<{
  mode: 'view' | 'edit' | 'create'
  id?: string
}>()

const router = useRouter()
const { departments, fetchDepartments, fetchEmployee, createEmployee, updateEmployee } = useEmployees()

const employee   = ref<Employee | null>(null)
const pageLoading = ref(false)
const saving      = ref(false)
const saveError   = ref('')

const form = reactive<EmployeeFormData>({
  employee_code:           '',
  full_name:               '',
  full_name_kana:          '',
  email:                   '',
  phone:                   '',
  department_id:           '',
  position:                '',
  employment_type:         'full_time',
  hire_date:               '',
  birth_date:              '',
  address:                 '',
  emergency_contact_name:  '',
  emergency_contact_phone: '',
  status:                  'active',
  annual_leave_balance:    20,
  notes:                   '',
})

const err = reactive({
  employee_code: '',
  full_name: '',
  email: '',
  position: '',
  hire_date: '',
})

function populateForm(e: Employee) {
  form.employee_code           = e.employee_code
  form.full_name               = e.full_name
  form.full_name_kana          = e.full_name_kana ?? ''
  form.email                   = e.email
  form.phone                   = e.phone ?? ''
  form.department_id           = e.department_id ?? ''
  form.position                = e.position
  form.employment_type         = e.employment_type
  form.hire_date               = e.hire_date
  form.birth_date              = e.birth_date ?? ''
  form.address                 = e.address ?? ''
  form.emergency_contact_name  = e.emergency_contact_name ?? ''
  form.emergency_contact_phone = e.emergency_contact_phone ?? ''
  form.status                  = e.status
  form.annual_leave_balance    = e.annual_leave_balance
  form.notes                   = e.notes ?? ''
}

function validate(): boolean {
  err.employee_code = form.employee_code ? '' : '社員コードは必須です'
  err.full_name     = form.full_name ? '' : '氏名は必須です'
  err.email         = !form.email
    ? 'メールアドレスは必須です'
    : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)
      ? 'メールアドレスの形式が正しくありません'
      : ''
  err.position      = form.position ? '' : '役職は必須です'
  err.hire_date     = form.hire_date ? '' : '入社日は必須です'

  return !Object.values(err).some(Boolean)
}

async function handleSave() {
  if (!validate()) return
  saving.value = true
  saveError.value = ''

  try {
    if (props.mode === 'create') {
      const created = await createEmployee(form)
      router.push(`/employees/${created.id}`)
    } else if (props.id) {
      await updateEmployee(props.id, form)
      router.push(`/employees/${props.id}`)
    }
  } catch (e: unknown) {
    if (e instanceof Error) {
      saveError.value = e.message.includes('duplicate key')
        ? '社員コードまたはメールアドレスが既に使用されています。'
        : e.message
    }
  } finally {
    saving.value = false
  }
}

function handleCancel() {
  if (props.mode === 'create') {
    router.push('/employees')
  } else if (props.id) {
    router.push(`/employees/${props.id}`)
  }
}

function formatDate(d: string) {
  return d ? dayjs(d).format('YYYY年M月D日') : '—'
}

function formatDateTime(d: string) {
  return d ? dayjs(d).format('YYYY/MM/DD HH:mm') : '—'
}

onMounted(async () => {
  await fetchDepartments()
  if (props.id) {
    pageLoading.value = true
    try {
      employee.value = await fetchEmployee(props.id)
      if (props.mode === 'edit') populateForm(employee.value!)
    } finally {
      pageLoading.value = false
    }
  }
})

watch(() => props.mode, (m) => {
  if (m === 'edit' && employee.value) populateForm(employee.value)
})
</script>

<style scoped>
.detail-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
  margin-bottom: var(--space-6);
}

.back-link {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font-size: 0.82rem;
  color: var(--text-muted);
  text-decoration: none;
  transition: color var(--ease-fast);
}

.back-link:hover { color: var(--text-primary); }

.detail-meta {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-top: var(--space-2);
  flex-wrap: wrap;
}

.detail-actions {
  display: flex;
  gap: var(--space-3);
  align-items: center;
  flex-shrink: 0;
  margin-top: 24px;
}

/* 非対称2カラムレイアウト */
.detail-layout {
  display: grid;
  grid-template-columns: 1fr 280px;
  gap: var(--space-6);
  align-items: start;
}

.detail-main { min-width: 0; }
.detail-sidebar { min-width: 0; }

/* フォームグリッド */
.form-grid-1 { display: grid; gap: var(--space-4); }
.form-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4); }
.form-grid-3 { display: grid; grid-template-columns: 140px 1fr 1fr; gap: var(--space-4); }
.col-span-2  { grid-column: span 2; }

.view-value {
  font-size: 0.9rem;
  color: var(--text-primary);
  padding: 0.4rem 0;
  min-height: 2rem;
  display: flex;
  align-items: center;
}

/* 休暇残日数 */
.leave-display {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.leave-number {
  font-size: 2.5rem;
  font-weight: 800;
  letter-spacing: -0.03em;
  color: var(--text-primary);
}

.leave-label {
  font-size: 1rem;
  color: var(--text-muted);
}

.leave-input-wrap {
  position: relative;
}

.leave-unit {
  position: absolute;
  right: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  font-size: 0.85rem;
  color: var(--text-muted);
  pointer-events: none;
}

/* 登録情報 */
.meta-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.meta-label {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
}

.meta-value {
  font-size: 0.78rem;
  color: var(--text-secondary);
  font-family: var(--font-mono);
}

.save-spinner {
  display: inline-block;
  width: 12px;
  height: 12px;
  border: 2px solid rgba(255,255,255,0.4);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

.req {
  color: var(--danger);
  margin-left: 2px;
}

@media (max-width: 1024px) {
  .detail-layout {
    grid-template-columns: 1fr;
  }

  .form-grid-3 {
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 640px) {
  .form-grid-2,
  .form-grid-3 {
    grid-template-columns: 1fr;
  }

  .col-span-2 { grid-column: span 1; }
}
</style>
