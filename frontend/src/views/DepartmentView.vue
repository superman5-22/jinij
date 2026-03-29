<template>
  <div class="page-container">
    <!-- ヘッダー -->
    <div class="page-header">
      <div>
        <h1 class="page-title">部署管理</h1>
        <p class="page-subtitle">部署マスタの登録・編集・削除</p>
      </div>
      <button
        v-if="auth.isAdmin"
        class="btn btn-primary"
        @click="openCreateModal"
      >
        <i class="bi bi-plus-lg me-1"></i>新規登録
      </button>
    </div>

    <!-- エラー表示 -->
    <div v-if="error" class="alert alert-danger" role="alert">
      <i class="bi bi-exclamation-triangle me-2"></i>{{ error }}
    </div>

    <!-- ローディング -->
    <div v-if="loading" class="text-center py-5">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">読み込み中...</span>
      </div>
    </div>

    <!-- 部署テーブル -->
    <div v-else class="card">
      <div class="card-body p-0">
        <table class="table table-hover mb-0">
          <thead>
            <tr>
              <th>部署コード</th>
              <th>部署名</th>
              <th>説明</th>
              <th>登録日</th>
              <th v-if="auth.isAdmin" class="text-end">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="departments.length === 0">
              <td :colspan="auth.isAdmin ? 5 : 4" class="text-center py-4 text-muted">
                部署が登録されていません
              </td>
            </tr>
            <tr v-for="dept in departments" :key="dept.id">
              <td>
                <code class="text-secondary">{{ dept.code ?? '—' }}</code>
              </td>
              <td class="fw-medium">{{ dept.name }}</td>
              <td class="text-muted small">{{ dept.description ?? '—' }}</td>
              <td class="text-muted small">{{ formatDate(dept.created_at) }}</td>
              <td v-if="auth.isAdmin" class="text-end">
                <button
                  class="btn btn-sm btn-outline-secondary me-1"
                  @click="openEditModal(dept)"
                >
                  <i class="bi bi-pencil"></i>
                </button>
                <button
                  class="btn btn-sm btn-outline-danger"
                  @click="confirmDelete(dept)"
                >
                  <i class="bi bi-trash"></i>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 登録・編集モーダル -->
    <div
      v-if="showModal"
      class="modal-backdrop-custom"
      @click.self="closeModal"
    >
      <div class="modal-dialog-custom">
        <div class="card">
          <div class="card-header d-flex justify-content-between align-items-center">
            <h5 class="mb-0">{{ isEditing ? '部署を編集' : '部署を新規登録' }}</h5>
            <button class="btn-close" @click="closeModal"></button>
          </div>
          <div class="card-body">
            <form @submit.prevent="submitForm">
              <!-- 部署名 -->
              <div class="mb-3">
                <label class="form-label fw-medium">
                  部署名 <span class="text-danger">*</span>
                </label>
                <input
                  v-model="form.name"
                  type="text"
                  class="form-control"
                  :class="{ 'is-invalid': formErrors.name }"
                  placeholder="例：開発部"
                  required
                />
                <div v-if="formErrors.name" class="invalid-feedback">
                  {{ formErrors.name }}
                </div>
              </div>

              <!-- 部署コード -->
              <div class="mb-3">
                <label class="form-label fw-medium">部署コード</label>
                <input
                  v-model="form.code"
                  type="text"
                  class="form-control"
                  :class="{ 'is-invalid': formErrors.code }"
                  placeholder="例：DEV"
                />
                <div v-if="formErrors.code" class="invalid-feedback">
                  {{ formErrors.code }}
                </div>
                <div class="form-text">半角英数字・ハイフンのみ使用可能</div>
              </div>

              <!-- 説明 -->
              <div class="mb-4">
                <label class="form-label fw-medium">説明</label>
                <textarea
                  v-model="form.description"
                  class="form-control"
                  rows="2"
                  placeholder="部署の説明（任意）"
                ></textarea>
              </div>

              <div class="d-flex gap-2 justify-content-end">
                <button
                  type="button"
                  class="btn btn-outline-secondary"
                  @click="closeModal"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  class="btn btn-primary"
                  :disabled="submitting"
                >
                  <span
                    v-if="submitting"
                    class="spinner-border spinner-border-sm me-1"
                    role="status"
                  ></span>
                  {{ isEditing ? '更新' : '登録' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>

    <!-- 削除確認モーダル -->
    <div
      v-if="showDeleteConfirm"
      class="modal-backdrop-custom"
      @click.self="showDeleteConfirm = false"
    >
      <div class="modal-dialog-custom modal-dialog-sm">
        <div class="card">
          <div class="card-header">
            <h5 class="mb-0 text-danger">
              <i class="bi bi-exclamation-triangle me-2"></i>削除の確認
            </h5>
          </div>
          <div class="card-body">
            <p class="mb-1">以下の部署を削除しますか？</p>
            <p class="fw-bold">{{ deletingDept?.name }}</p>
            <p class="text-muted small mb-4">
              この操作は取り消せません。この部署に所属する従業員がいる場合、
              削除できない場合があります。
            </p>
            <div class="d-flex gap-2 justify-content-end">
              <button
                class="btn btn-outline-secondary"
                @click="showDeleteConfirm = false"
              >
                キャンセル
              </button>
              <button
                class="btn btn-danger"
                :disabled="submitting"
                @click="executeDelete"
              >
                <span
                  v-if="submitting"
                  class="spinner-border spinner-border-sm me-1"
                  role="status"
                ></span>
                削除する
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useDepartments } from '@/composables/useDepartments'
import type { Department, DepartmentFormData } from '@/types'

const auth = useAuthStore()
const { departments, loading, error, fetchDepartments, createDepartment, updateDepartment, deleteDepartment } = useDepartments()

// モーダル状態
const showModal = ref(false)
const isEditing = ref(false)
const editingId = ref<string | null>(null)
const submitting = ref(false)

// 削除確認
const showDeleteConfirm = ref(false)
const deletingDept = ref<Department | null>(null)

// フォーム
const form = reactive<DepartmentFormData>({
  name: '',
  code: '',
  description: '',
})
const formErrors = reactive<Partial<DepartmentFormData>>({})

onMounted(fetchDepartments)

function openCreateModal() {
  resetForm()
  isEditing.value = false
  editingId.value = null
  showModal.value = true
}

function openEditModal(dept: Department) {
  form.name = dept.name
  form.code = dept.code ?? ''
  form.description = dept.description ?? ''
  Object.assign(formErrors, { name: '', code: '', description: '' })
  isEditing.value = true
  editingId.value = dept.id
  showModal.value = true
}

function closeModal() {
  showModal.value = false
  resetForm()
}

function resetForm() {
  form.name = ''
  form.code = ''
  form.description = ''
  Object.assign(formErrors, { name: '', code: '', description: '' })
}

function validate(): boolean {
  let valid = true
  formErrors.name = ''
  formErrors.code = ''

  if (!form.name.trim()) {
    formErrors.name = '部署名は必須です'
    valid = false
  }
  if (form.code && !/^[A-Za-z0-9-]+$/.test(form.code.trim())) {
    formErrors.code = '半角英数字・ハイフンのみ使用可能です'
    valid = false
  }
  return valid
}

async function submitForm() {
  if (!validate()) return
  submitting.value = true
  try {
    if (isEditing.value && editingId.value) {
      const updated = await updateDepartment(editingId.value, form)
      const idx = departments.value.findIndex(d => d.id === updated.id)
      if (idx !== -1) departments.value[idx] = updated
    } else {
      const created = await createDepartment(form)
      departments.value.push(created)
      departments.value.sort((a, b) => a.name.localeCompare(b.name))
    }
    closeModal()
  } catch (e: unknown) {
    formErrors.name = e instanceof Error ? e.message : '保存に失敗しました'
  } finally {
    submitting.value = false
  }
}

function confirmDelete(dept: Department) {
  deletingDept.value = dept
  showDeleteConfirm.value = true
}

async function executeDelete() {
  if (!deletingDept.value) return
  submitting.value = true
  try {
    await deleteDepartment(deletingDept.value.id)
    departments.value = departments.value.filter(d => d.id !== deletingDept.value!.id)
    showDeleteConfirm.value = false
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : '削除に失敗しました'
    showDeleteConfirm.value = false
  } finally {
    submitting.value = false
    deletingDept.value = null
  }
}

function formatDate(iso: string): string {
  return iso.slice(0, 10)
}
</script>

<style scoped>
.modal-backdrop-custom {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1050;
  padding: 1rem;
}

.modal-dialog-custom {
  width: 100%;
  max-width: 480px;
}

.modal-dialog-sm {
  max-width: 400px;
}
</style>
