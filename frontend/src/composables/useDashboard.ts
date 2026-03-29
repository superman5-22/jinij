import { ref } from 'vue'
import { supabase } from '@/lib/supabase'
import type { DashboardSummary, LeaveRequest } from '@/types'

export function useDashboard() {
  const summary = ref<DashboardSummary>({
    total_employees:      0,
    active_employees:     0,
    on_leave_today:       0,
    pending_leave_requests: 0,
    new_hires_this_month: 0,
    departments_count:    0,
  })
  const recentRequests = ref<LeaveRequest[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchSummary() {
    loading.value = true
    error.value = null

    try {
      const today = new Date().toISOString().split('T')[0]
      const firstOfMonth = today.substring(0, 8) + '01'

      const [
        { count: total },
        { count: active },
        { count: onLeave },
        { count: pending },
        { count: newHires },
        { count: depts },
        { data: recent },
      ] = await Promise.all([
        supabase.from('employees').select('id', { count: 'exact', head: true }),
        supabase.from('employees').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        supabase
          .from('leave_requests')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'approved')
          .lte('start_date', today)
          .gte('end_date', today),
        supabase.from('leave_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase
          .from('employees')
          .select('id', { count: 'exact', head: true })
          .gte('hire_date', firstOfMonth)
          .eq('status', 'active'),
        supabase.from('departments').select('id', { count: 'exact', head: true }),
        supabase
          .from('leave_requests')
          .select(`
            *,
            employee:employees(id, full_name, employee_code, department:departments(name))
          `)
          .order('created_at', { ascending: false })
          .limit(8),
      ])

      summary.value = {
        total_employees:      total ?? 0,
        active_employees:     active ?? 0,
        on_leave_today:       onLeave ?? 0,
        pending_leave_requests: pending ?? 0,
        new_hires_this_month: newHires ?? 0,
        departments_count:    depts ?? 0,
      }
      recentRequests.value = (recent ?? []) as LeaveRequest[]
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : '取得に失敗しました'
    } finally {
      loading.value = false
    }
  }

  return { summary, recentRequests, loading, error, fetchSummary }
}
