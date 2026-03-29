<template>
  <span :class="['badge', badgeClass]">
    <span v-if="showDot" class="dot"></span>
    {{ label }}
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type {
  EmployeeStatus, LeaveStatus, LeaveType,
  EMPLOYEE_STATUS_LABELS, LEAVE_STATUS_LABELS, LEAVE_TYPE_LABELS,
} from '@/types'
import {
  EMPLOYEE_STATUS_LABELS as EMP_LABELS,
  LEAVE_STATUS_LABELS as LEAVE_LABELS,
  LEAVE_TYPE_LABELS as TYPE_LABELS,
} from '@/types'

const props = defineProps<{
  type: 'employee-status' | 'leave-status' | 'leave-type'
  value: string
  showDot?: boolean
}>()

const label = computed(() => {
  if (props.type === 'employee-status') return EMP_LABELS[props.value as EmployeeStatus] ?? props.value
  if (props.type === 'leave-status')    return LEAVE_LABELS[props.value as LeaveStatus] ?? props.value
  if (props.type === 'leave-type')      return TYPE_LABELS[props.value as LeaveType] ?? props.value
  return props.value
})

const badgeClass = computed(() => {
  if (props.type === 'employee-status') {
    return {
      active:   'badge-active',
      inactive: 'badge-inactive',
      on_leave: 'badge-on-leave',
    }[props.value] ?? 'badge-inactive'
  }
  if (props.type === 'leave-status') {
    return {
      pending:   'badge-pending',
      approved:  'badge-approved',
      rejected:  'badge-rejected',
      cancelled: 'badge-cancelled',
    }[props.value] ?? 'badge-inactive'
  }
  if (props.type === 'leave-type') {
    return `badge-${props.value}`
  }
  return ''
})
</script>

<style scoped>
.dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  opacity: 0.8;
}
</style>
