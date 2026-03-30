<template>
  <div class="page-container">
    <!-- ヘッダー -->
    <div class="page-header">
      <div>
        <h1 class="page-title">お知らせ</h1>
        <p class="page-subtitle">社内アナウンス・重要連絡</p>
      </div>
      <button
        v-if="auth.isHR"
        class="btn btn-primary"
        @click="openCreateModal"
      >
        <i class="bi bi-plus-lg me-1"></i>新規作成
      </button>
    </div>

    <!-- フィルターバー -->
    <div class="filter-bar mb-4">
      <div class="d-flex gap-2 flex-wrap align-items-center">
        <!-- キーワード検索 -->
        <div class="search-wrap">
          <i class="bi bi-search search-icon"></i>
          <input
            v-model="filters.keyword"
            type="text"
            class="form-control ps-4"
            placeholder="タイトル・本文で検索"
            @input="debouncedFetch"
          />
        </div>

        <!-- カテゴリフィルター -->
        <select v-model="filters.category" class="form-select w-auto" @change="applyFilters">
          <option value="">すべてのカテゴリ</option>
          <option v-for="(label, key) in ANNOUNCEMENT_CATEGORY_LABELS" :key="key" :value="key">
            {{ label }}
          </option>
        </select>

        <!-- HR/admin: 下書き含む全件表示 -->
        <div v-if="auth.isHR" class="form-check form-switch ms-2 mb-0">
          <input
            v-model="filters.show_all"
            class="form-check-input"
            type="checkbox"
            id="showAll"
            @change="applyFilters"
          />
          <label class="form-check-label" for="showAll">下書き含む</label>
        </div>
      </div>
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

    <!-- お知らせ一覧 -->
    <template v-else>
      <div v-if="announcements.length === 0" class="empty-state">
        <i class="bi bi-megaphone empty-icon"></i>
        <p class="empty-text">お知らせはありません</p>
      </div>

      <div v-else class="announcements-list">
        <div
          v-for="item in announcements"
          :key="item.id"
          class="announcement-card card mb-3"
          :class="{ 'announcement-pinned': item.is_pinned, 'announcement-unread': !item.is_read }"
          @click="openDetail(item)"
        >
          <div class="card-body">
            <div class="d-flex align-items-start gap-2">
              <!-- ピン留めアイコン -->
              <i v-if="item.is_pinned" class="bi bi-pin-angle-fill text-warning mt-1"></i>

              <div class="flex-grow-1 min-w-0">
                <!-- バッジ行 -->
                <div class="d-flex align-items-center gap-2 mb-1 flex-wrap">
                  <span
                    class="badge"
                    :class="`bg-${ANNOUNCEMENT_CATEGORY_COLORS[item.category]}`"
                  >
                    {{ ANNOUNCEMENT_CATEGORY_LABELS[item.category] }}
                  </span>
                  <span v-if="!item.is_read && item.published_at" class="badge bg-danger">NEW</span>
                  <span v-if="auth.isHR && !item.published_at" class="badge bg-secondary">下書き</span>
                </div>

                <!-- タイトル -->
                <h5 class="announcement-title mb-1">{{ item.title }}</h5>

                <!-- 本文プレビュー -->
                <p class="announcement-preview text-muted small mb-2">
                  {{ previewText(item.body) }}
                </p>

                <!-- メタ情報 -->
                <div class="d-flex gap-3 text-muted small flex-wrap">
                  <span>
                    <i class="bi bi-person me-1"></i>
                    {{ item.author?.full_name ?? item.author?.email ?? '不明' }}
                  </span>
                  <span>
                    <i class="bi bi-calendar3 me-1"></i>
                    {{ formatDateTime(item.published_at ?? item.created_at) }}
                  </span>
                  <span v-if="item.expires_at" class="text-warning">
                    <i class="bi bi-clock-history me-1"></i>
                    {{ formatDate(item.expires_at) }} まで
                  </span>
                </div>
              </div>

              <!-- 操作ボタン (HR/admin) -->
              <div v-if="auth.isHR" class="d-flex gap-1 flex-shrink-0" @click.stop>
                <button
                  class="btn btn-sm btn-outline-secondary"
                  title="編集"
                  @click="openEditModal(item)"
                >
                  <i class="bi bi-pencil"></i>
                </button>
                <button
                  class="btn btn-sm btn-outline-danger"
                  title="削除"
                  @click="confirmDelete(item)"
                >
                  <i class="bi bi-trash"></i>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- ========================================================
         詳細モーダル
    ======================================================== -->
    <div
      v-if="showDetail && selectedItem"
      class="modal-backdrop-custom"
      @click.self="closeDetail"
    >
      <div class="modal-dialog-custom modal-dialog-lg">
        <div class="card">
          <div class="card-header d-flex justify-content-between align-items-start gap-3">
            <div>
              <div class="d-flex gap-2 mb-1 flex-wrap">
                <span
                  class="badge"
                  :class="`bg-${ANNOUNCEMENT_CATEGORY_COLORS[selectedItem.category]}`"
                >
                  {{ ANNOUNCEMENT_CATEGORY_LABELS[selectedItem.category] }}
                </span>
                <span v-if="selectedItem.is_pinned" class="badge bg-warning text-dark">
                  <i class="bi bi-pin-angle-fill me-1"></i>ピン留め
                </span>
              </div>
              <h5 class="mb-0">{{ selectedItem.title }}</h5>
            </div>
            <button class="btn-close flex-shrink-0" @click="closeDetail"></button>
          </div>
          <div class="card-body">
            <!-- 本文 -->
            <div class="announcement-body">{{ selectedItem.body }}</div>

            <!-- メタ情報 -->
            <hr />
            <div class="d-flex gap-4 text-muted small flex-wrap">
              <span>
                <i class="bi bi-person me-1"></i>
                {{ selectedItem.author?.full_name ?? selectedItem.author?.email ?? '不明' }}
              </span>
              <span>
                <i class="bi bi-calendar3 me-1"></i>
                {{ formatDateTime(selectedItem.published_at ?? selectedItem.created_at) }}
              </span>
              <span v-if="selectedItem.expires_at">
                <i class="bi bi-clock-history me-1"></i>
                有効期限: {{ formatDate(selectedItem.expires_at) }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ========================================================
         作成・編集モーダル (HR/admin)
    ======================================================== -->
    <div
      v-if="showFormModal"
      class="modal-backdrop-custom"
      @click.self="closeFormModal"
    >
      <div class="modal-dialog-custom modal-dialog-lg">
        <div class="card">
          <div class="card-header d-flex justify-content-between align-items-center">
            <h5 class="mb-0">{{ isEditing ? 'お知らせを編集' : 'お知らせを新規作成' }}</h5>
            <button class="btn-close" @click="closeFormModal"></button>
          </div>
          <div class="card-body">
            <form @submit.prevent="submitForm">
              <!-- タイトル -->
              <div class="mb-3">
                <label class="form-label fw-medium">
                  タイトル <span class="text-danger">*</span>
                </label>
                <input
                  v-model="form.title"
                  type="text"
                  class="form-control"
                  :class="{ 'is-invalid': formErrors.title }"
                  placeholder="例：夏季休暇のお知らせ"
                  maxlength="200"
                />
                <div v-if="formErrors.title" class="invalid-feedback">{{ formErrors.title }}</div>
                <div class="form-text text-end">{{ form.title.length }}/200</div>
              </div>

              <!-- カテゴリ・ピン留め -->
              <div class="row g-3 mb-3">
                <div class="col-sm-6">
                  <label class="form-label fw-medium">カテゴリ</label>
                  <select v-model="form.category" class="form-select">
                    <option v-for="(label, key) in ANNOUNCEMENT_CATEGORY_LABELS" :key="key" :value="key">
                      {{ label }}
                    </option>
                  </select>
                </div>
                <div class="col-sm-6 d-flex align-items-end">
                  <div class="form-check form-switch">
                    <input
                      v-model="form.is_pinned"
                      class="form-check-input"
                      type="checkbox"
                      id="isPinned"
                    />
                    <label class="form-check-label" for="isPinned">
                      <i class="bi bi-pin-angle me-1"></i>ピン留めする
                    </label>
                  </div>
                </div>
              </div>

              <!-- 本文 -->
              <div class="mb-3">
                <label class="form-label fw-medium">
                  本文 <span class="text-danger">*</span>
                </label>
                <textarea
                  v-model="form.body"
                  class="form-control"
                  :class="{ 'is-invalid': formErrors.body }"
                  rows="6"
                  placeholder="お知らせの内容を入力してください"
                ></textarea>
                <div v-if="formErrors.body" class="invalid-feedback">{{ formErrors.body }}</div>
              </div>

              <!-- 公開日時・有効期限 -->
              <div class="row g-3 mb-4">
                <div class="col-sm-6">
                  <label class="form-label fw-medium">公開日時</label>
                  <input
                    v-model="form.published_at"
                    type="datetime-local"
                    class="form-control"
                  />
                  <div class="form-text">空欄の場合は下書き保存</div>
                </div>
                <div class="col-sm-6">
                  <label class="form-label fw-medium">有効期限</label>
                  <input
                    v-model="form.expires_at"
                    type="datetime-local"
                    class="form-control"
                  />
                  <div class="form-text">空欄の場合は無期限</div>
                </div>
              </div>

              <div class="d-flex gap-2 justify-content-end">
                <button type="button" class="btn btn-outline-secondary" @click="closeFormModal">
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
                  {{ isEditing ? '更新' : '作成' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>

    <!-- ========================================================
         削除確認モーダル
    ======================================================== -->
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
            <p class="mb-1">以下のお知らせを削除しますか？</p>
            <p class="fw-bold">{{ deletingItem?.title }}</p>
            <p class="text-muted small mb-4">この操作は取り消せません。</p>
            <div class="d-flex gap-2 justify-content-end">
              <button class="btn btn-outline-secondary" @click="showDeleteConfirm = false">
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
import { useAnnouncements } from '@/composables/useAnnouncements'
import type { Announcement, AnnouncementFormData, AnnouncementFilters } from '@/types'
import {
  ANNOUNCEMENT_CATEGORY_LABELS,
  ANNOUNCEMENT_CATEGORY_COLORS,
} from '@/types'

const auth = useAuthStore()
const {
  announcements, loading, error,
  fetchAnnouncements, markAsRead,
  createAnnouncement, updateAnnouncement, deleteAnnouncement,
} = useAnnouncements()

// フィルター
const filters = reactive<AnnouncementFilters>({
  category: '',
  keyword:  '',
  show_all: false,
})

// 詳細モーダル
const showDetail    = ref(false)
const selectedItem  = ref<Announcement | null>(null)

// フォームモーダル
const showFormModal = ref(false)
const isEditing     = ref(false)
const editingId     = ref<string | null>(null)
const submitting    = ref(false)

const form = reactive<AnnouncementFormData>({
  title:        '',
  body:         '',
  category:     'general',
  is_pinned:    false,
  published_at: '',
  expires_at:   '',
})
const formErrors = reactive<Partial<Record<keyof AnnouncementFormData, string>>>({})

// 削除確認
const showDeleteConfirm = ref(false)
const deletingItem      = ref<Announcement | null>(null)

// debounce 用タイマー
let debounceTimer: ReturnType<typeof setTimeout> | null = null

// ============================================================
// ライフサイクル
// ============================================================
onMounted(() => applyFilters())

// ============================================================
// フィルター
// ============================================================
function applyFilters() {
  fetchAnnouncements(filters, auth.isHR)
}

function debouncedFetch() {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => applyFilters(), 300)
}

// ============================================================
// 詳細
// ============================================================
async function openDetail(item: Announcement) {
  selectedItem.value = item
  showDetail.value   = true
  if (!item.is_read && item.published_at) {
    await markAsRead(item.id)
  }
}

function closeDetail() {
  showDetail.value  = false
  selectedItem.value = null
}

// ============================================================
// フォーム（作成・編集）
// ============================================================
function openCreateModal() {
  resetForm()
  isEditing.value  = false
  editingId.value  = null
  showFormModal.value = true
}

function openEditModal(item: Announcement) {
  form.title        = item.title
  form.body         = item.body
  form.category     = item.category
  form.is_pinned    = item.is_pinned
  form.published_at = item.published_at ? toDatetimeLocal(item.published_at) : ''
  form.expires_at   = item.expires_at   ? toDatetimeLocal(item.expires_at)   : ''
  isEditing.value   = true
  editingId.value   = item.id
  showFormModal.value = true
}

function closeFormModal() {
  showFormModal.value = false
  resetForm()
}

function resetForm() {
  form.title        = ''
  form.body         = ''
  form.category     = 'general'
  form.is_pinned    = false
  form.published_at = ''
  form.expires_at   = ''
  Object.assign(formErrors, { title: '', body: '' })
}

function validate(): boolean {
  let valid = true
  formErrors.title = ''
  formErrors.body  = ''
  if (!form.title.trim()) {
    formErrors.title = 'タイトルは必須です'
    valid = false
  }
  if (!form.body.trim()) {
    formErrors.body = '本文は必須です'
    valid = false
  }
  return valid
}

async function submitForm() {
  if (!validate()) return
  submitting.value = true
  try {
    if (isEditing.value && editingId.value) {
      const updated = await updateAnnouncement(editingId.value, form)
      const idx = announcements.value.findIndex(a => a.id === updated.id)
      if (idx !== -1) announcements.value[idx] = updated
    } else {
      const created = await createAnnouncement(form)
      announcements.value.unshift(created)
    }
    closeFormModal()
  } catch (e: unknown) {
    formErrors.title = e instanceof Error ? e.message : '保存に失敗しました'
  } finally {
    submitting.value = false
  }
}

// ============================================================
// 削除
// ============================================================
function confirmDelete(item: Announcement) {
  deletingItem.value     = item
  showDeleteConfirm.value = true
}

async function executeDelete() {
  if (!deletingItem.value) return
  submitting.value = true
  try {
    await deleteAnnouncement(deletingItem.value.id)
    announcements.value = announcements.value.filter(a => a.id !== deletingItem.value!.id)
    showDeleteConfirm.value = false
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : '削除に失敗しました'
    showDeleteConfirm.value = false
  } finally {
    submitting.value = false
    deletingItem.value = null
  }
}

// ============================================================
// ユーティリティ
// ============================================================
function previewText(body: string, maxLen = 100): string {
  const oneline = body.replace(/\n+/g, ' ')
  return oneline.length > maxLen ? oneline.slice(0, maxLen) + '…' : oneline
}

function formatDate(iso: string): string {
  return iso.slice(0, 10)
}

function formatDateTime(iso: string): string {
  return iso.slice(0, 16).replace('T', ' ')
}

function toDatetimeLocal(iso: string): string {
  // "2026-04-01T09:00:00+09:00" → "2026-04-01T09:00"
  return iso.slice(0, 16)
}
</script>

<style scoped>
.search-wrap {
  position: relative;
  flex: 1;
  min-width: 200px;
  max-width: 360px;
}
.search-icon {
  position: absolute;
  left: 0.6rem;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-muted, #6c757d);
  pointer-events: none;
}

/* お知らせカード */
.announcement-card {
  cursor: pointer;
  transition: box-shadow 0.15s var(--ease-fast, ease);
  border-left: 3px solid transparent;
}
.announcement-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}
.announcement-unread {
  border-left-color: var(--bs-primary, #0d6efd);
}
.announcement-pinned {
  background-color: rgba(255, 193, 7, 0.05);
}

.announcement-title {
  font-size: 1rem;
  font-weight: 600;
}
.announcement-preview {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.announcement-body {
  white-space: pre-wrap;
  line-height: 1.7;
}

/* 空状態 */
.empty-state {
  text-align: center;
  padding: 4rem 1rem;
  color: var(--text-muted, #6c757d);
}
.empty-icon {
  font-size: 3rem;
  display: block;
  margin-bottom: 1rem;
  opacity: 0.4;
}
.empty-text {
  font-size: 1rem;
}

/* モーダル */
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
.modal-dialog-sm  { max-width: 400px; }
.modal-dialog-lg  { max-width: 680px; }
</style>
