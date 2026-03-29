<template>
  <header class="app-header">
    <div class="header-breadcrumb">
      <RouterLink to="/" class="text-muted" style="text-decoration:none">jinij</RouterLink>
      <template v-if="segments.length">
        <span class="breadcrumb-sep"><i class="bi bi-chevron-right" style="font-size:0.65rem"></i></span>
        <template v-for="(seg, i) in segments" :key="seg.path">
          <RouterLink
            v-if="i < segments.length - 1"
            :to="seg.path"
            class="text-muted"
            style="text-decoration:none"
          >{{ seg.label }}</RouterLink>
          <span v-else class="breadcrumb-current">{{ seg.label }}</span>
          <span v-if="i < segments.length - 1" class="breadcrumb-sep">
            <i class="bi bi-chevron-right" style="font-size:0.65rem"></i>
          </span>
        </template>
      </template>
    </div>

    <div class="header-actions">
      <span style="font-size:0.8rem; color:var(--text-muted)">{{ todayStr }}</span>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import dayjs from 'dayjs'
import 'dayjs/locale/ja'

dayjs.locale('ja')

const route = useRoute()

const todayStr = computed(() =>
  dayjs().format('YYYY年M月D日 (ddd)')
)

interface Segment { path: string; label: string }

const ROUTE_LABELS: Record<string, string> = {
  '/':               'ダッシュボード',
  '/employees':      '従業員一覧',
  '/employees/new':  '新規登録',
  '/leaves':         '休暇申請・承認',
}

const segments = computed<Segment[]>(() => {
  const path = route.path
  if (path === '/') return []

  const parts = path.split('/').filter(Boolean)
  const result: Segment[] = []
  let cumPath = ''

  for (const part of parts) {
    cumPath += '/' + part
    const label = ROUTE_LABELS[cumPath] ?? (route.meta?.title as string) ?? part
    result.push({ path: cumPath, label })
  }

  // employee detail overrides
  if (route.name === 'employee-detail' || route.name === 'employee-edit') {
    result[0] = { path: '/employees', label: '従業員一覧' }
    result[1] = {
      path: route.path,
      label: route.name === 'employee-edit' ? '編集' : '詳細',
    }
  }

  return result
})
</script>
