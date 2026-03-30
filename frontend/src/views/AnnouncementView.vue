<template>
  <div class="container-fluid py-4">
    <!-- ヘッダー -->
    <div class="d-flex align-items-center justify-content-between mb-4 flex-wrap gap-2">
      <div>
        <h1 class="h3 mb-1">お知らせ</h1>
        <p class="text-muted mb-0">社内掲示板・全体連絡</p>
      </div>
      <button
        v-if="auth.isHR"
        class="btn btn-primary"
        @click="openModal(null)"
      >
        <i class="bi bi-plus-lg me-1"></i>新規作成
      </button>
    </div>

    <!-- エラー -->
    <div v-if="error" class="alert alert-danger alert-dismissible fade show" role="alert">
      <i class="bi bi-exclamation-triangle-fill me-2"></i>{{ error }}
      <button type="button" class="btn-close" @click="error = null"></button>
    </div>

    <!-- フィルター -->
    <div class="card border-0 shadow-sm mb-4">
      <div class="card-body">
        <div class="row g-3 align-items-end">
          <div class="col-md-4">
            <label class="form-label small fw-semibold">カテゴリ</label>
            <select v-model="filterCategory" class="form-select form-select-sm" @change="load">
              <option value="">すべて</option>
              <option v-for="(label, key) in ANNOUNCEMENT_CATEGORY_LABELS" :key="key" :value="key">
                {{ label }}
              </option>
            </select>
          </div>
          <div v-if="auth.isHR" class="col-md-4">
            <div class="form-check mt-3">
              <input
                id="includeDrafts"
                v-model="includeDrafts"
                class="form-check-input"
                type="checkbox"
                @change="load"
              />
              <label class="form-check-label small" for="includeDrafts">
                下書きを含む
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ローディング -->
    <div v-if="isLoading" class="text-center py-5">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">読み込み中...</span>
      </div>
    </div>

    <!-- お知らせ一覧 -->
    <template v-else>
      <!-- 件数ゼロ -->
      <div v-if="announcements.length === 0" class="card border-0 shadow-sm">
        <div class="card-body text-center py-5 text-muted">
          <i class="bi bi-megaphone fs-2 mb-2 d-block"></i>
          お知らせはありません
        </div>
      </div>

      <!-- ピン留め -->
      <template v-if="pinned.length">
        <p class="small text-muted fw-semibold mb-2">
          <i class="bi bi-pin-fill me-1 text-danger"></i>ピン留め
        </p>
        <AnnouncementCard
          v-for="item in pinned"
          :key="item.id"
          :item="item"
          :can-edit="auth.isHR"
          class="mb-3"
          @edit="openModal"
          @delete="confirmDelete"
          @publish="handlePublish"
        />
        <hr class="my-3" />
      </template>

      <!-- 通常一覧 -->
      <AnnouncementCard
        v-for="item in normal"
        :key="item.id"
        :item="item"
        :can-edit="auth.isHR"
        class="mb-3"
        @edit="openModal"
        @delete="confirmDelete"
        @publish="handlePublish"
      />
    </template>

    <!-- モーダル: 新規作成 / 編集 -->
    <div
      v-if="showModal"
      class="modal fade show d-block"
      tabindex="-1"
      style="background: rgba(0,0,0,.5)"
      @click.self="closeModal"
    >
      <div class="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">
              {{ editTarget ? 'お知らせ編集' : 'お知らせ新規作成' }}
            </h5>
            <button type="button" class="btn-close" @click="closeModal"></button>
          </div>
          <div class="modal-body">
            <form @submit.prevent="saveAnnouncement">
              <!-- タイトル -->
              <div class="mb-3">
                <label class="form-label fw-semibold">タイトル <span class="text-danger">*</span></label>
                <input
                  v-model="form.title"
                  class="form-control"
                  required
                  maxlength="200"
                  placeholder="お知らせのタイトルを入力"
                />
              </div>

              <!-- カテゴリ -->
              <div class="mb-3">
                <label class="form-label fw-semibold">カテゴリ <span class="text-danger">*</span></label>
                <select v-model="form.category" class="form-select" required>
                  <option
                    v-for="(label, key) in ANNOUNCEMENT_CATEGORY_LABELS"
                    :key="key"
                    :value="key"
                  >{{ label }}</option>
                </select>
              </div>

              <!-- 本文 -->
              <div class="mb-3">
                <label class="form-label fw-semibold">本文 <span class="text-danger">*</span></label>
                <textarea
                  v-model="form.content"
                  class="form-control"
                  rows="6"
                  required
                  placeholder="お知らせの内容を入力"
                ></textarea>
              </div>

              <!-- 公開日時 -->
              <div class="mb-3">
                <label class="form-label fw-semibold">公開日時</label>
                <input
                  v-model="form.published_at"
                  class="form-control"
                  type="datetime-local"
                />
                <div class="form-text">空白の場合は下書きとして保存されます</div>
              </div>

              <!-- 有効期限 -->
              <div class="mb-3">
                <label class="form-label fw-semibold">有効期限</label>
                <input
                  v-model="form.expires_at"
                  class="form-control"
                  type="datetime-local"
                />
                <div class="form-text">空白の場合は無期限で表示されます</div>
              </div>

              <!-- ピン留め -->
              <div class="form-check mb-3">
                <input
                  id="formPinned"
                  v-model="form.is_pinned"
                  class="form-check-input"
                  type="checkbox"
                />
                <label class="form-check-label" for="formPinned">
                  <i class="bi bi-pin-fill text-danger me-1"></i>ピン留めにする
                </label>
              </div>

              <div class="d-flex justify-content-end gap-2">
                <button type="button" class="btn btn-outline-secondary" @click="closeModal">
                  キャンセル
                </button>
                <button type="submit" class="btn btn-primary" :disabled="isLoading">
                  <span v-if="isLoading" class="spinner-border spinner-border-sm me-1"></span>
                  {{ editTarget ? '更新' : '登録' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>

    <!-- 削除確認モーダル -->
    <div
      v-if="deleteTarget"
      class="modal fade show d-block"
      tabindex="-1"
      style="background: rgba(0,0,0,.5)"
      @click.self="deleteTarget = null"
    >
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title text-danger">削除確認</h5>
            <button type="button" class="btn-close" @click="deleteTarget = null"></button>
          </div>
          <div class="modal-body">
            「<strong>{{ deleteTarget.title }}</strong>」を削除しますか？
            <br /><small class="text-muted">この操作は取り消せません。</small>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline-secondary" @click="deleteTarget = null">キャンセル</button>
            <button class="btn btn-danger" :disabled="isLoading" @click="execDelete">
              <span v-if="isLoading" class="spinner-border spinner-border-sm me-1"></span>
              削除する
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, defineComponent, h } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useAnnouncements } from '@/composables/useAnnouncements'
import type { Announcement, AnnouncementFormData, AnnouncementCategory } from '@/types'
import {
  ANNOUNCEMENT_CATEGORY_LABELS,
  ANNOUNCEMENT_CATEGORY_COLORS,
} from '@/types'
import dayjs from 'dayjs'

// ----------------------------------------------------------------
// 子コンポーネント: AnnouncementCard (インライン定義)
// ----------------------------------------------------------------
const AnnouncementCard = defineComponent({
  name: 'AnnouncementCard',
  props: {
    item:    { type: Object as () => Announcement, required: true },
    canEdit: { type: Boolean, default: false },
  },
  emits: ['edit', 'delete', 'publish'],
  setup(props, { emit }) {
    const isDraft   = computed(() => !props.item.published_at)
    const isExpired = computed(() =>
      props.item.expires_at ? dayjs().isAfter(dayjs(props.item.expires_at)) : false
    )
    const color = computed(
      () => ANNOUNCEMENT_CATEGORY_COLORS[props.item.category] ?? 'secondary'
    )
    const label = computed(
      () => ANNOUNCEMENT_CATEGORY_LABELS[props.item.category] ?? props.item.category
    )

    return () => h('div', {
      class: `card border-0 shadow-sm ${isDraft.value ? 'opacity-75' : ''}`,
    }, [
      h('div', { class: 'card-body' }, [
        h('div', { class: 'd-flex align-items-start gap-2 mb-2' }, [
          props.item.is_pinned
            ? h('i', { class: 'bi bi-pin-fill text-danger mt-1' })
            : null,
          h('span', { class: `badge bg-${color.value} me-1` }, label.value),
          isDraft.value
            ? h('span', { class: 'badge bg-warning text-dark' }, '下書き')
            : null,
          isExpired.value
            ? h('span', { class: 'badge bg-secondary' }, '期限切れ')
            : null,
          h('small', { class: 'ms-auto text-muted' },
            props.item.published_at
              ? dayjs(props.item.published_at).format('YYYY/MM/DD HH:mm')
              : '—'
          ),
          props.canEdit
            ? h('div', { class: 'btn-group btn-group-sm ms-2' }, [
                isDraft.value
                  ? h('button', {
                      class: 'btn btn-outline-success',
                      title: '今すぐ公開',
                      onClick: () => emit('publish', props.item),
                    }, [h('i', { class: 'bi bi-send' })])
                  : null,
                h('button', {
                  class: 'btn btn-outline-secondary',
                  title: '編集',
                  onClick: () => emit('edit', props.item),
                }, [h('i', { class: 'bi bi-pencil' })]),
                h('button', {
                  class: 'btn btn-outline-danger',
                  title: '削除',
                  onClick: () => emit('delete', props.item),
                }, [h('i', { class: 'bi bi-trash' })]),
              ])
            : null,
        ]),
        h('h5', { class: 'card-title mb-1' }, props.item.title),
        h('p', {
          class: 'card-text text-muted small mb-0',
          style: 'white-space: pre-wrap',
        }, props.item.content),
      ]),
    ])
  },
})

// ----------------------------------------------------------------
// State
// ----------------------------------------------------------------
const auth = useAuthStore()
const {
  announcements, isLoading, error,
  fetchAnnouncements, createAnnouncement, updateAnnouncement,
  deleteAnnouncement, publishAnnouncement,
} = useAnnouncements()

const filterCategory = ref<AnnouncementCategory | ''>('')
const includeDrafts  = ref(false)

const showModal   = ref(false)
const editTarget  = ref<Announcement | null>(null)
const deleteTarget = ref<Announcement | null>(null)

const emptyForm = (): AnnouncementFormData => ({
  title:        '',
  content:      '',
  category:     'general',
  is_pinned:    false,
  published_at: '',
  expires_at:   '',
})
const form = ref<AnnouncementFormData>(emptyForm())

// ----------------------------------------------------------------
// Computed
// ----------------------------------------------------------------
const pinned = computed(() => announcements.value.filter(a => a.is_pinned))
const normal = computed(() => announcements.value.filter(a => !a.is_pinned))

// ----------------------------------------------------------------
// Methods
// ----------------------------------------------------------------
async function load() {
  await fetchAnnouncements({
    category:       filterCategory.value || undefined,
    include_drafts: auth.isHR ? includeDrafts.value : false,
  })
}

function openModal(item: Announcement | null) {
  editTarget.value = item
  if (item) {
    form.value = {
      title:        item.title,
      content:      item.content,
      category:     item.category,
      is_pinned:    item.is_pinned,
      published_at: item.published_at
        ? dayjs(item.published_at).format('YYYY-MM-DDTHH:mm')
        : '',
      expires_at: item.expires_at
        ? dayjs(item.expires_at).format('YYYY-MM-DDTHH:mm')
        : '',
    }
  } else {
    form.value = {
      ...emptyForm(),
      published_at: dayjs().format('YYYY-MM-DDTHH:mm'),
    }
  }
  showModal.value = true
}

function closeModal() {
  showModal.value = false
  editTarget.value = null
}

async function saveAnnouncement() {
  const payload: AnnouncementFormData = {
    ...form.value,
    published_at: form.value.published_at
      ? new Date(form.value.published_at).toISOString()
      : '',
    expires_at: form.value.expires_at
      ? new Date(form.value.expires_at).toISOString()
      : '',
  }

  const result = editTarget.value
    ? await updateAnnouncement(editTarget.value.id, payload)
    : await createAnnouncement(payload)

  if (result) {
    closeModal()
    await load()
  }
}

function confirmDelete(item: Announcement) {
  deleteTarget.value = item
}

async function execDelete() {
  if (!deleteTarget.value) return
  const ok = await deleteAnnouncement(deleteTarget.value.id)
  if (ok) deleteTarget.value = null
}

async function handlePublish(item: Announcement) {
  await publishAnnouncement(item.id)
  await load()
}

// ----------------------------------------------------------------
// Lifecycle
// ----------------------------------------------------------------
onMounted(load)
</script>
