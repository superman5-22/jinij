<template>
  <div class="notification-bell" ref="bellRef">
    <!-- ベルボタン -->
    <button
      class="bell-btn"
      :aria-label="`通知 (未読${unreadCount}件)`"
      @click="toggleDropdown"
    >
      <i class="bi bi-bell-fill"></i>
      <span v-if="unreadCount > 0" class="unread-badge">
        {{ unreadCount > 99 ? '99+' : unreadCount }}
      </span>
    </button>

    <!-- ドロップダウン -->
    <div v-if="isOpen" class="notification-dropdown">
      <div class="dropdown-header">
        <span class="dropdown-title">通知</span>
        <button
          v-if="unreadCount > 0"
          class="mark-all-btn"
          @click="handleMarkAllAsRead"
        >
          すべて既読にする
        </button>
      </div>

      <div v-if="loading" class="dropdown-loading">
        <span class="spinner-border spinner-border-sm text-secondary"></span>
        <span class="ms-2" style="font-size:0.8rem">読み込み中...</span>
      </div>

      <div v-else-if="notifications.length === 0" class="dropdown-empty">
        <i class="bi bi-bell-slash" style="font-size:1.5rem; color:var(--text-muted)"></i>
        <p style="margin:0.5rem 0 0; font-size:0.8rem; color:var(--text-muted)">通知はありません</p>
      </div>

      <ul v-else class="notification-list">
        <li
          v-for="n in notifications"
          :key="n.id"
          :class="['notification-item', { 'is-unread': !n.is_read }]"
          @click="handleRead(n)"
        >
          <div class="notification-icon" :class="iconWrapClass(n.type)">
            <i :class="iconClass(n.type)"></i>
          </div>
          <div class="notification-body">
            <p class="notification-title">{{ n.title }}</p>
            <p class="notification-message">{{ n.message }}</p>
            <span class="notification-time">{{ relativeTime(n.created_at) }}</span>
          </div>
          <span v-if="!n.is_read" class="unread-dot" aria-hidden="true"></span>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import dayjs from 'dayjs'
import relativeTimePlugin from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/ja'
import { useNotifications } from '@/composables/useNotifications'
import type { Notification, NotificationType } from '@/types'

dayjs.extend(relativeTimePlugin)
dayjs.locale('ja')

const props = defineProps<{ userId: string }>()

const {
  notifications,
  loading,
  unreadCount,
  fetchNotifications,
  markAsRead,
  markAllAsRead,
  subscribeRealtime,
  unsubscribeRealtime,
} = useNotifications(props.userId)

const isOpen = ref(false)
const bellRef = ref<HTMLElement | null>(null)

function toggleDropdown() {
  isOpen.value = !isOpen.value
}

function handleClickOutside(e: MouseEvent) {
  if (bellRef.value && !bellRef.value.contains(e.target as Node)) {
    isOpen.value = false
  }
}

async function handleRead(n: Notification) {
  if (!n.is_read) {
    await markAsRead(n.id)
  }
}

async function handleMarkAllAsRead() {
  await markAllAsRead()
}

function iconClass(type: NotificationType): string {
  const map: Record<NotificationType, string> = {
    leave_approved:  'bi bi-check-circle-fill',
    leave_rejected:  'bi bi-x-circle-fill',
    leave_submitted: 'bi bi-send-fill',
    system:          'bi bi-info-circle-fill',
  }
  return map[type] ?? 'bi bi-bell-fill'
}

function iconWrapClass(type: NotificationType): string {
  const map: Record<NotificationType, string> = {
    leave_approved:  'icon-approved',
    leave_rejected:  'icon-rejected',
    leave_submitted: 'icon-submitted',
    system:          'icon-system',
  }
  return map[type] ?? 'icon-system'
}

function relativeTime(dateStr: string): string {
  return dayjs(dateStr).fromNow()
}

// ドロップダウンを開いたとき通知を取得
watch(isOpen, (val) => {
  if (val) fetchNotifications()
})

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  fetchNotifications()
  subscribeRealtime()
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
  unsubscribeRealtime()
})
</script>

<style scoped>
.notification-bell {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.bell-btn {
  position: relative;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.4rem;
  color: var(--text-muted, #6c757d);
  font-size: 1.1rem;
  line-height: 1;
  border-radius: 0.375rem;
  transition: color 0.15s, background 0.15s;
}

.bell-btn:hover {
  color: var(--text-primary, #1e293b);
  background: var(--surface-hover, #f1f5f9);
}

.unread-badge {
  position: absolute;
  top: 0;
  right: 0;
  min-width: 16px;
  height: 16px;
  padding: 0 3px;
  background: #ef4444;
  color: #fff;
  border-radius: 8px;
  font-size: 0.6rem;
  font-weight: 700;
  line-height: 16px;
  text-align: center;
  pointer-events: none;
}

/* ドロップダウン */
.notification-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  width: 340px;
  max-height: 480px;
  overflow-y: auto;
  background: #fff;
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 0.75rem;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  z-index: 9999;
}

.dropdown-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--border-color, #e2e8f0);
  position: sticky;
  top: 0;
  background: #fff;
}

.dropdown-title {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-primary, #1e293b);
}

.mark-all-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 0.75rem;
  color: var(--accent, #6366f1);
  padding: 0;
}

.mark-all-btn:hover {
  text-decoration: underline;
}

.dropdown-loading,
.dropdown-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem 1rem;
  color: var(--text-muted, #6c757d);
  font-size: 0.85rem;
}

/* 通知リスト */
.notification-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.notification-item {
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
  padding: 0.75rem 1rem;
  cursor: pointer;
  border-bottom: 1px solid var(--border-color, #e2e8f0);
  transition: background 0.1s;
}

.notification-item:last-child {
  border-bottom: none;
}

.notification-item:hover {
  background: var(--surface-hover, #f8fafc);
}

.notification-item.is-unread {
  background: #f0f4ff;
}

.notification-item.is-unread:hover {
  background: #e8eeff;
}

.notification-icon {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.85rem;
  margin-top: 2px;
}

.icon-approved  { background: #dcfce7; color: #16a34a; }
.icon-rejected  { background: #fee2e2; color: #dc2626; }
.icon-submitted { background: #dbeafe; color: #2563eb; }
.icon-system    { background: #f3f4f6; color: #6b7280; }

.notification-body {
  flex: 1;
  min-width: 0;
}

.notification-title {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-primary, #1e293b);
  margin: 0 0 0.2rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.notification-message {
  font-size: 0.75rem;
  color: var(--text-secondary, #475569);
  margin: 0 0 0.3rem;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.notification-time {
  font-size: 0.7rem;
  color: var(--text-muted, #94a3b8);
}

.unread-dot {
  flex-shrink: 0;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #6366f1;
  margin-top: 6px;
}
</style>
