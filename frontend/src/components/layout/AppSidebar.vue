<template>
  <aside class="app-sidebar">
    <!-- ロゴ -->
    <div class="sidebar-logo">
      <RouterLink to="/" class="logo-mark">
        <div class="logo-icon">人</div>
        <div class="logo-text">
          <span class="logo-primary">jinij</span>
          <span class="logo-sub">人事システム</span>
        </div>
      </RouterLink>
    </div>

    <!-- ナビゲーション -->
    <nav class="sidebar-nav">
      <span class="nav-section-label">メニュー</span>
      <RouterLink
        v-for="item in navItems"
        :key="item.to"
        :to="item.to"
        class="nav-item"
        :class="{ active: isActive(item.to) }"
      >
        <i :class="item.icon"></i>
        {{ item.label }}
      </RouterLink>
    </nav>

    <!-- フッター: ユーザー情報 -->
    <div class="sidebar-footer">
      <div class="sidebar-user" @click="handleLogout">
        <div class="user-avatar">{{ avatarInitial }}</div>
        <div class="user-info">
          <div class="user-name">{{ auth.displayName }}</div>
          <div class="user-role">{{ roleLabel }}</div>
        </div>
        <button class="btn-logout" title="ログアウト">
          <i class="bi bi-box-arrow-right"></i>
        </button>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const baseItems = [
  { to: '/',           icon: 'bi bi-grid-1x2',        label: 'ダッシュボード' },
  { to: '/employees',  icon: 'bi bi-people',           label: '従業員一覧' },
  { to: '/leaves',     icon: 'bi bi-calendar-check',   label: '休暇申請・承認' },
  { to: '/attendance',  icon: 'bi bi-clock',            label: '勤怠管理' },
  { to: '/performance', icon: 'bi bi-bar-chart-line',  label: '目標・評価' },
]

const hrItems = [
  { to: '/salary',     icon: 'bi bi-cash-coin',        label: '給与管理' },
]

const adminItems = [
  { to: '/departments', icon: 'bi bi-diagram-3',       label: '部署管理' },
]

const navItems = computed(() => {
  if (auth.isAdmin) return [...baseItems, ...hrItems, ...adminItems]
  if (auth.isHR)    return [...baseItems, ...hrItems]
  return baseItems
})

function isActive(path: string): boolean {
  if (path === '/') return route.path === '/'
  return route.path.startsWith(path)
}

const avatarInitial = computed(() => {
  const name = auth.displayName
  return name ? name.charAt(0).toUpperCase() : '?'
})

const ROLE_LABELS: Record<string, string> = {
  admin:    '管理者',
  hr:       '人事担当',
  manager:  'マネージャー',
  employee: '従業員',
}

const roleLabel = computed(
  () => ROLE_LABELS[auth.profile?.role ?? ''] ?? '従業員'
)

async function handleLogout() {
  await auth.signOut()
  router.push('/login')
}
</script>
