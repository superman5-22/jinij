import { ref } from 'vue'
import { supabase } from '@/lib/supabase'
import type {
  PerformanceReview,
  PerformanceReviewFormData,
  PerformanceReviewFilters,
  ReviewStatus,
} from '@/types'

export function usePerformanceReviews() {
  const reviews   = ref<PerformanceReview[]>([])
  const current   = ref<PerformanceReview | null>(null)
  const isLoading = ref(false)
  const error     = ref<string | null>(null)

  // ----------------------------------------------------------------
  // 一覧取得
  // ----------------------------------------------------------------
  async function fetchReviews(
    filters: Partial<PerformanceReviewFilters> = {}
  ): Promise<void> {
    isLoading.value = true
    error.value     = null
    try {
      let query = supabase
        .from('performance_reviews')
        .select('*, employee:employees(id, full_name, employee_code, department_id)')
        .order('review_year',    { ascending: false })
        .order('review_quarter', { ascending: false, nullsFirst: false })

      if (filters.employee_id) query = query.eq('employee_id', filters.employee_id)
      if (filters.review_year) query = query.eq('review_year', filters.review_year)
      if (filters.review_type) query = query.eq('review_type', filters.review_type)
      if (filters.status)      query = query.eq('status',      filters.status)

      const { data, error: sbErr } = await query
      if (sbErr) throw sbErr
      reviews.value = data ?? []
    } catch (e: unknown) {
      error.value = (e as { message?: string }).message ?? '取得に失敗しました'
    } finally {
      isLoading.value = false
    }
  }

  // ----------------------------------------------------------------
  // 単件取得
  // ----------------------------------------------------------------
  async function fetchReview(id: string): Promise<void> {
    isLoading.value = true
    error.value     = null
    try {
      const { data, error: sbErr } = await supabase
        .from('performance_reviews')
        .select('*, employee:employees(id, full_name, employee_code, department_id)')
        .eq('id', id)
        .single()

      if (sbErr) throw sbErr
      current.value = data
    } catch (e: unknown) {
      error.value = (e as { message?: string }).message ?? '取得に失敗しました'
    } finally {
      isLoading.value = false
    }
  }

  // ----------------------------------------------------------------
  // 登録
  // ----------------------------------------------------------------
  async function createReview(
    form: PerformanceReviewFormData
  ): Promise<PerformanceReview | null> {
    isLoading.value = true
    error.value     = null
    try {
      const { data: authData } = await supabase.auth.getUser()
      if (!authData.user) throw new Error('認証情報がありません')

      const payload: Record<string, unknown> = {
        employee_id:       form.employee_id,
        reviewer_id:       authData.user.id,
        review_year:       form.review_year,
        review_type:       form.review_type,
        review_quarter:    form.review_type === 'quarterly' ? (form.review_quarter ?? null) : null,
        overall_rating:    form.overall_rating,
        performance_score: form.performance_score,
        behavior_score:    form.behavior_score,
        skill_score:       form.skill_score,
        goals_achievement: form.goals_achievement || null,
        strengths:         form.strengths         || null,
        improvements:      form.improvements      || null,
        next_goals:        form.next_goals         || null,
        reviewer_comment:  form.reviewer_comment   || null,
        created_by:        authData.user.id,
      }

      const { data, error: sbErr } = await supabase
        .from('performance_reviews')
        .insert(payload)
        .select()
        .single()

      if (sbErr) throw sbErr
      return data
    } catch (e: unknown) {
      error.value = (e as { message?: string }).message ?? '登録に失敗しました'
      return null
    } finally {
      isLoading.value = false
    }
  }

  // ----------------------------------------------------------------
  // 更新
  // ----------------------------------------------------------------
  async function updateReview(
    id: string,
    form: Partial<PerformanceReviewFormData>
  ): Promise<PerformanceReview | null> {
    isLoading.value = true
    error.value     = null
    try {
      const payload: Record<string, unknown> = {}
      if (form.overall_rating    !== undefined) payload['overall_rating']    = form.overall_rating
      if (form.performance_score !== undefined) payload['performance_score'] = form.performance_score
      if (form.behavior_score    !== undefined) payload['behavior_score']    = form.behavior_score
      if (form.skill_score       !== undefined) payload['skill_score']       = form.skill_score
      if (form.goals_achievement !== undefined) payload['goals_achievement'] = form.goals_achievement || null
      if (form.strengths         !== undefined) payload['strengths']         = form.strengths         || null
      if (form.improvements      !== undefined) payload['improvements']      = form.improvements      || null
      if (form.next_goals        !== undefined) payload['next_goals']        = form.next_goals         || null
      if (form.reviewer_comment  !== undefined) payload['reviewer_comment']  = form.reviewer_comment   || null

      const { data, error: sbErr } = await supabase
        .from('performance_reviews')
        .update(payload)
        .eq('id', id)
        .select()
        .single()

      if (sbErr) throw sbErr
      current.value = data
      return data
    } catch (e: unknown) {
      error.value = (e as { message?: string }).message ?? '更新に失敗しました'
      return null
    } finally {
      isLoading.value = false
    }
  }

  // ----------------------------------------------------------------
  // ステータス変更（draft→submitted、submitted→acknowledged）
  // ----------------------------------------------------------------
  async function changeStatus(
    id: string,
    newStatus: ReviewStatus
  ): Promise<boolean> {
    isLoading.value = true
    error.value     = null
    try {
      const extra: Record<string, unknown> = {}
      if (newStatus === 'submitted')    extra['submitted_at']    = new Date().toISOString()
      if (newStatus === 'acknowledged') extra['acknowledged_at'] = new Date().toISOString()

      const { error: sbErr } = await supabase
        .from('performance_reviews')
        .update({ status: newStatus, ...extra })
        .eq('id', id)

      if (sbErr) throw sbErr
      // ローカルのリストも更新
      const idx = reviews.value.findIndex(r => r.id === id)
      if (idx >= 0) reviews.value[idx] = { ...reviews.value[idx], status: newStatus }
      return true
    } catch (e: unknown) {
      error.value = (e as { message?: string }).message ?? 'ステータス更新に失敗しました'
      return false
    } finally {
      isLoading.value = false
    }
  }

  // ----------------------------------------------------------------
  // 削除
  // ----------------------------------------------------------------
  async function deleteReview(id: string): Promise<boolean> {
    isLoading.value = true
    error.value     = null
    try {
      const { error: sbErr } = await supabase
        .from('performance_reviews')
        .delete()
        .eq('id', id)

      if (sbErr) throw sbErr
      reviews.value = reviews.value.filter(r => r.id !== id)
      return true
    } catch (e: unknown) {
      error.value = (e as { message?: string }).message ?? '削除に失敗しました'
      return false
    } finally {
      isLoading.value = false
    }
  }

  return {
    reviews,
    current,
    isLoading,
    error,
    fetchReviews,
    fetchReview,
    createReview,
    updateReview,
    changeStatus,
    deleteReview,
  }
}
