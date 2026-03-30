import { ref } from 'vue'
import { supabase } from '@/lib/supabase'
import type {
  Goal,
  GoalFormData,
  PerformanceReview,
  ReviewPeriod,
  SelfReviewFormData,
  ManagerReviewFormData,
} from '@/types'

export function usePerformance() {
  const goals         = ref<Goal[]>([])
  const reviews       = ref<PerformanceReview[]>([])
  const periods       = ref<ReviewPeriod[]>([])
  const loading       = ref(false)
  const error         = ref<string | null>(null)

  // ----------------------------------------------------------------
  // 評価期間
  // ----------------------------------------------------------------

  async function fetchPeriods() {
    loading.value = true
    error.value   = null
    try {
      const { data, error: err } = await supabase
        .from('review_periods')
        .select('*')
        .order('start_date', { ascending: false })
      if (err) throw err
      periods.value = (data ?? []) as ReviewPeriod[]
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : '取得に失敗しました'
    } finally {
      loading.value = false
    }
  }

  function activePeriod(): ReviewPeriod | undefined {
    return periods.value.find((p) => p.is_active)
  }

  // ----------------------------------------------------------------
  // 目標
  // ----------------------------------------------------------------

  async function fetchGoals(employeeId: string, periodId?: string) {
    loading.value = true
    error.value   = null
    try {
      let query = supabase
        .from('goals')
        .select('*, employee:employees(id, full_name, employee_code), review_period:review_periods(id, name)')
        .eq('employee_id', employeeId)

      if (periodId) {
        query = query.eq('review_period_id', periodId)
      }

      const { data, error: err } = await query.order('created_at', { ascending: true })
      if (err) throw err
      goals.value = (data ?? []) as Goal[]
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : '取得に失敗しました'
    } finally {
      loading.value = false
    }
  }

  async function createGoal(form: GoalFormData): Promise<Goal> {
    const { data, error: err } = await supabase
      .from('goals')
      .insert({
        employee_id:       form.employee_id,
        review_period_id:  form.review_period_id,
        title:             form.title.trim(),
        description:       form.description.trim() || null,
        category:          form.category,
        target_value:      form.target_value.trim() || null,
        weight:            form.weight,
        status:            'active',
      })
      .select('*, review_period:review_periods(id, name)')
      .single()
    if (err) throw err
    return data as Goal
  }

  async function updateGoalStatus(id: string, status: Goal['status']): Promise<void> {
    const { error: err } = await supabase
      .from('goals')
      .update({ status })
      .eq('id', id)
    if (err) throw err
  }

  async function deleteGoal(id: string): Promise<void> {
    const { error: err } = await supabase
      .from('goals')
      .delete()
      .eq('id', id)
    if (err) throw err
  }

  // ----------------------------------------------------------------
  // 評価
  // ----------------------------------------------------------------

  async function fetchReviews(employeeId?: string, periodId?: string) {
    loading.value = true
    error.value   = null
    try {
      let query = supabase
        .from('performance_reviews')
        .select(`
          *,
          employee:employees(id, full_name, employee_code, department:departments(id, name)),
          reviewer:profiles(id, full_name),
          review_period:review_periods(id, name)
        `)

      if (employeeId) query = query.eq('employee_id', employeeId)
      if (periodId)   query = query.eq('review_period_id', periodId)

      const { data, error: err } = await query.order('created_at', { ascending: false })
      if (err) throw err
      reviews.value = (data ?? []) as PerformanceReview[]
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : '取得に失敗しました'
    } finally {
      loading.value = false
    }
  }

  async function startReview(employeeId: string, periodId: string): Promise<PerformanceReview> {
    const { data, error: err } = await supabase
      .from('performance_reviews')
      .insert({
        employee_id:       employeeId,
        review_period_id:  periodId,
        status:            'self_review',
      })
      .select('*, employee:employees(id, full_name), review_period:review_periods(id, name)')
      .single()
    if (err) throw err
    return data as PerformanceReview
  }

  async function submitSelfReview(reviewId: string, form: SelfReviewFormData): Promise<void> {
    if (form.self_score < 1 || form.self_score > 5) {
      throw new Error('自己評価スコアは1〜5で入力してください')
    }
    if (!form.self_comment.trim()) {
      throw new Error('自己評価コメントを入力してください')
    }
    const { error: err } = await supabase
      .from('performance_reviews')
      .update({
        self_score:    form.self_score,
        self_comment:  form.self_comment.trim(),
        status:        'manager_review',
      })
      .eq('id', reviewId)
    if (err) throw err
  }

  async function submitManagerReview(
    reviewId: string,
    reviewerId: string,
    form: ManagerReviewFormData,
  ): Promise<void> {
    if (form.manager_score < 1 || form.manager_score > 5) {
      throw new Error('評価スコアは1〜5で入力してください')
    }
    if (!form.manager_comment.trim()) {
      throw new Error('評価コメントを入力してください')
    }
    const { error: err } = await supabase
      .from('performance_reviews')
      .update({
        reviewer_id:      reviewerId,
        manager_score:    form.manager_score,
        manager_comment:  form.manager_comment.trim(),
        final_rank:       form.final_rank,
        status:           'completed',
        completed_at:     new Date().toISOString(),
      })
      .eq('id', reviewId)
    if (err) throw err
  }

  return {
    goals, reviews, periods, loading, error,
    fetchPeriods, activePeriod,
    fetchGoals, createGoal, updateGoalStatus, deleteGoal,
    fetchReviews, startReview, submitSelfReview, submitManagerReview,
  }
}
