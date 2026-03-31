<template>
  <div class="page-container">
    <!-- ページヘッダー -->
    <div class="page-header d-flex justify-content-between align-items-center mb-4">
      <div>
        <h1 class="page-title">社内お知らせ</h1>
        <p class="page-subtitle text-muted">全社向けのお知らせを確認・管理できます</p>
      </div>
      <button
        v-if="auth.isHR || auth.isAdmin"
        class="btn btn-primary"
        @click="openCreateModal"
      >
        <i class="bi bi-plus-lg me-1"></i>新規作成
      </button>
    </div>

    <!-- フィルター -->
    <div class="card mb-4">
      <div class="card-body">
        <div class="row g-3">
          <div class="col-md-4">
            <label class="form-label">カテゴリ</label>
            <select v-model="filters.category" class="form-select" @change="applyFilters">
              <option value="">すべて</option>
              <option v-for="(label, key) in ANNOUNCEMENT_CATEGORY_LABELS" :key="key" :value="key">
                {{ label }}
              </option>
            </select>
          </div>
          <div class="col-md-4">
            <label class="form-label">優先度</label>
            <select v-model="filters.priority" class="form-select" @change="applyFilters">
              <option value="">すべて</option>
              <option v-for="(label, key) in ANNOUNCEMENT_PRIORITY_LABELS" :key="key" :value="key">
                {{ label }}
              </option>
            </select>
          </div>
          <div v-if="auth.isHR || auth.isAdmin" class="col-md-4">
            <label class="form-label">公開状態</label>
            <select v-model="publishedFilter" class="form-select" @change="applyFilters">
              <option value="">すべて</option>
              <option value="true">公開中</option>
              <option value="false">下書き</option>
            </select>
          </div>
        </div>
      </div>
    </div>

    <!-- ローディング -->
    <div v-if="loading" class="text-center py-5">
      <div class="spinner-border text-primary"></div>
    </div>

    <!-- エラー -->
    <div v-else-if="error" class="alert alert-danger">{{ error }}</div>

    <!-- お知らせ一覧 -->
    <div v-else-if="announcements.length > 0" class="announcement-list">
      <div
        v-for="item in announcements"
        :key="item.id"
        class="card announcement-card mb-3"
        :class="priorityCardClass(item.priority)"
      >
        <div class="card-body">
          <div class="d-flex justify-content-between align-items-start">
            <div class="flex-grow-1">
              <div class="d-flex align-items-center gap-2 mb-2">
                <span class="badge" :class="priorityBadgeClass(item.priority)">
                  {{ ANNOUNCEMENT_PRIORITY_LABELS[item.priority] }}
                </span>
                <span class="badge bg-secondary">
                  {{ ANNOUNCEMENT_CATEGORY_LABELS[item.category] }}
                </span>
                <span v-if="!item.is_published" class="badge bg-light text-dark border">
                  下書き
                </span>
              </div>
              <h5 class="card-title mb-1">{{ item.title }}</h5>
              <p class="card-text text-muted small mb-2">
                {{ formatDate(item.published_at ?? item.created_at) }}
                <span v-if="item.expires_at" class="ms-2">
                  （有効期限: {{ formatDate(item.expires_at) }}）
                </span>
              </p>
              <p class="card-text content-preview">{{ item.content }}</p>
            </div>

            <!-- 管理操作ボタン -->
            <div v-if="auth.isHR || auth.isAdmin" class="ms-3 d-flex flex-column gap-2">
              <button
                class="btn btn-sm btn-outline-secondary"
                @click="openEditModal(item)"
              >
                <i class="bi bi-pencil"></i>
              </button>
              <button
                class="btn btn-sm"
                :class="item.is_published ? 'btn-outline-warning' : 'btn-outline-success'"
                :title="item.is_published ? '非公開にする' : '公開する'"
                @click="handleTogglePublish(item)"
              >
                <i :class="item.is_published ? 'bi bi-eye-slash' : 'bi bi-eye'"></i>
              </button>
              <button
                class="btn btn-sm btn-outline-danger"
                @click="handleDelete(item)"
              >
                <i class="bi bi-trash"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 空状態 -->
    <div v-else class="text-center py-5 text-muted">
      <i class="bi bi-megaphone fs-1 d-block mb-3"></i>
      <p>お知らせはありません</p>
    </div>

    <!-- 作成・編集モーダル -->
    <div v-if="showModal" class="modal-backdrop-custom" @click.self="closeModal">
      <div class="modal-dialog-custom card">
        <div class="card-header d-flex justify-content-between align-items-center">
          <h5 class="mb-0">{{ editingId ? 'お知らせを編集' : '新規お知らせ' }}</h5>
          <button class="btn-close" @click="closeModal"></button>
        </div>
        <div class="card-body">
          <form @submit.prevent="handleSubmit">
            <div class="mb-3">
              <label class="form-label">タイトル <span class="text-danger">*</span></label>
              <input
                v-model="form.title"
                type="text"
                class="form-control"
                :class="{ 'is-invalid': formErrors.title }"
                placeholder="お知らせのタイトルを入力"
                maxlength="200"
              />
              <div v-if="formErrors.title" class="invalid-feedback">{{ formErrors.title }}</div>
            </div>

            <div class="mb-3">
              <label class="form-label">本文 <span class="text-danger">*</span></label>
              <textarea
                v-model="form.content"
                class="form-control"
                :class="{ 'is-invalid': formErrors.content }"
                rows="5"
                placeholder="お知らせの内容を入力"
              ></textarea>
              <div v-if="formErrors.content" class="invalid-feedback">{{ formErrors.content }}</div>
            </div>

            <div class="row g-3 mb-3">
              <div class="col-md-6">
                <label class="form-label">カテゴリ</label>
                <select v-model="form.category" class="form-select">
                  <option v-for="(label, key) in ANNOUNCEMENT_CATEGORY_LABELS" :key="key" :value="key">
                    {{ label }}
                  </option>
                </select>
              </div>
              <div class="col-md-6">
                <label class="form-label">優先度</label>
                <select v-model="form.priority" class="form-select">
                  <option v-for="(label, key) in ANNOUNCEMENT_PRIORITY_LABELS" :key="key" :value="key">
                    {{ label }}
                  </option>
                </select>
              </div>
            </div>

            <div class="row g-3 mb-3">
              <div class="col-md-6">
                <label class="form-label">公開日時</label>
                <input v-model="form.published_at" type="datetime-local" class="form-control" />
              </div>
              <div class="col-md-6">
                <label class="form-label">有効期限</label>
                <input v-model="form.expires_at" type="datetime-local" class="form-control" />
              </div>
            </div>

            <div class="form-check mb-3">
              <input
                id="is_published"
                v-model="form.is_published"
                type="checkbox"
                class="form-check-input"
              />
              <label for="is_published" class="form-check-label">今すぐ公開する</label>
            </div>

            <div class="d-flex gap-2 justify-content-end">
              <button type="button" class="btn btn-secondary" @click="closeModal">キャンセル</button>
              <button type="submit" class="btn btn-primary" :disabled="submitting">
                <span v-if="submitting" class="spinner-border spinner-border-sm me-1"></span>
                {{ editingId ? '更新' : '作成' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useAnnouncements } from '@/composables/useAnnouncements'
import type { Announcement, AnnouncementFormData } from '@/types'
import {
  ANNOUNCEMENT_CATEGORY_LABELS,
  ANNOUNCEMENT_PRIORITY_LABELS,
} from '@/types'

const auth = useAuthStore()
const {
  announcements,
  loading,
  error,
  fetchAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  togglePublish,
} = useAnnouncements()

// フィルター
const filters = reactive({ category: '' as string, priority: '' as string })
const publishedFilter = ref('')

function applyFilters() {
  fetchAnnouncements({
    category:     filters.category as AnnouncementFormData['category'] | '',
    priority:     filters.priority as AnnouncementFormData['priority'] | '',
    is_published: publishedFilter.value === '' ? '' : publishedFilter.value === 'true',
  })
}

// モーダル制御
const showModal  = ref(false)
const editingId  = ref<string | null>(null)
const submitting = ref(false)

const defaultForm = (): AnnouncementFormData => ({
  title:        '',
  content:      '',
  category:     'general',
  priority:     'normal',
  is_published: false,
  published_at: '',
  expires_at:   '',
})

const form       = reactive<AnnouncementFormData>(defaultForm())
const formErrors = reactive<Partial<Record<keyof AnnouncementFormData, string>>>({})

function openCreateModal() {
  editingId.value = null
  Object.assign(form, defaultForm())
  Object.keys(formErrors).forEach(k => delete (formErrors as Record<string, string>)[k])
  showModal.value = true
}

function openEditModal(item: Announcement) {
  editingId.value = item.id
  Object.assign(form, {
    title:        item.title,
    content:      item.content,
    category:     item.category,
    priority:     item.priority,
    is_published: item.is_published,
    published_at: item.published_at ? item.published_at.slice(0, 16) : '',
    expires_at:   item.expires_at   ? item.expires_at.slice(0, 16)   : '',
  })
  showModal.value = true
}

function closeModal() {
  showModal.value = false
}

function validateForm(): boolean {
  Object.keys(formErrors).forEach(k => delete (formErrors as Record<string, string>)[k])
  if (!form.title.trim()) {
    formErrors.title = 'タイトルは必須です'
  }
  if (!form.content.trim()) {
    formErrors.content = '本文は必須です'
  }
  return Object.keys(formErrors).length === 0
}

async function handleSubmit() {
  if (!validateForm()) return
  submitting.value = true
  try {
    if (editingId.value) {
      await updateAnnouncement(editingId.value, { ...form })
    } else {
      await createAnnouncement({ ...form })
    }
    closeModal()
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '保存に失敗しました'
    formErrors.title = msg
  } finally {
    submitting.value = false
  }
}

async function handleTogglePublish(item: Announcement) {
  try {
    await togglePublish(item.id, !item.is_published)
  } catch {
    // サイレントエラー (必要に応じてトースト通知を追加)
  }
}

async function handleDelete(item: Announcement) {
  if (!confirm(`「${item.title}」を削除しますか？`)) return
  try {
    await deleteAnnouncement(item.id)
  } catch (e: unknown) {
    alert(e instanceof Error ? e.message : '削除に失敗しました')
  }
}

// ユーティリティ
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ja-JP', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
}

function priorityBadgeClass(priority: string): string {
  return {
    urgent: 'bg-danger',
    high:   'bg-warning text-dark',
    normal: 'bg-primary',
    low:    'bg-secondary',
  }[priority] ?? 'bg-secondary'
}

function priorityCardClass(priority: string): string {
  return priority === 'urgent' ? 'border-danger border-2' : ''
}

onMounted(() => fetchAnnouncements())
</script>

<style scoped>
.announcement-card {
  transition: box-shadow 0.15s ease;
}
.announcement-card:hover {
  box-shadow: 0 4px 12px rgba(0,0,0,.08);
}
.content-preview {
  white-space: pre-wrap;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
}
.modal-backdrop-custom {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1050;
}
.modal-dialog-custom {
  width: 100%;
  max-width: 640px;
  max-height: 90vh;
  overflow-y: auto;
  margin: 1rem;
}
</style>
