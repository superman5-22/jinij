import { ref } from 'vue'
import { supabase } from '@/lib/supabase'
import type {
  Announcement,
  AnnouncementFormData,
  AnnouncementFilters,
} from '@/types'

export function useAnnouncements() {
  const announcements = ref<Announcement[]>([])
  const current       = ref<Announcement | null>(null)
  const isLoading     = ref(false)
  const error         = ref<string | null>(null)

  // ----------------------------------------------------------------
  // 一覧取得
  // ----------------------------------------------------------------
  async function fetchAnnouncements(
    filters: Partial<AnnouncementFilters> = {}
  ): Promise<void> {
    isLoading.value = true
    error.value     = null
    try {
      let query = supabase
        .from('announcements')
        .select('*')
        .order('is_pinned', { ascending: false })
        .order('published_at',  { ascending: false })

      if (filters.category) {
        query = query.eq('category', filters.category)
      }
      // 下書き非表示（デフォルト: 公開済みのみ）
      if (!filters.include_drafts) {
        query = query.not('published_at', 'is', null)
      }

      const { data, error: sbErr } = await query
      if (sbErr) throw sbErr
      announcements.value = data ?? []
    } catch (e: unknown) {
      error.value = (e as { message?: string }).message ?? '取得に失敗しました'
    } finally {
      isLoading.value = false
    }
  }

  // ----------------------------------------------------------------
  // 単件取得
  // ----------------------------------------------------------------
  async function fetchAnnouncement(id: string): Promise<void> {
    isLoading.value = true
    error.value     = null
    try {
      const { data, error: sbErr } = await supabase
        .from('announcements')
        .select('*')
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
  async function createAnnouncement(
    form: AnnouncementFormData
  ): Promise<Announcement | null> {
    isLoading.value = true
    error.value     = null
    try {
      const { data: authData } = await supabase.auth.getUser()
      if (!authData.user) throw new Error('認証情報がありません')

      const { data, error: sbErr } = await supabase
        .from('announcements')
        .insert({
          title:        form.title,
          content:      form.content,
          category:     form.category,
          is_pinned:    form.is_pinned,
          published_at: form.published_at || null,
          expires_at:   form.expires_at   || null,
          created_by:   authData.user.id,
        })
        .select()
        .single()

      if (sbErr) throw sbErr
      announcements.value.unshift(data)
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
  async function updateAnnouncement(
    id: string,
    form: Partial<AnnouncementFormData>
  ): Promise<Announcement | null> {
    isLoading.value = true
    error.value     = null
    try {
      const payload: Record<string, unknown> = {}
      if (form.title        !== undefined) payload['title']        = form.title
      if (form.content      !== undefined) payload['content']      = form.content
      if (form.category     !== undefined) payload['category']     = form.category
      if (form.is_pinned    !== undefined) payload['is_pinned']    = form.is_pinned
      if (form.published_at !== undefined) payload['published_at'] = form.published_at || null
      if (form.expires_at   !== undefined) payload['expires_at']   = form.expires_at   || null

      const { data, error: sbErr } = await supabase
        .from('announcements')
        .update(payload)
        .eq('id', id)
        .select()
        .single()

      if (sbErr) throw sbErr
      current.value = data
      const idx = announcements.value.findIndex(a => a.id === id)
      if (idx !== -1) announcements.value[idx] = data
      return data
    } catch (e: unknown) {
      error.value = (e as { message?: string }).message ?? '更新に失敗しました'
      return null
    } finally {
      isLoading.value = false
    }
  }

  // ----------------------------------------------------------------
  // 削除
  // ----------------------------------------------------------------
  async function deleteAnnouncement(id: string): Promise<boolean> {
    isLoading.value = true
    error.value     = null
    try {
      const { error: sbErr } = await supabase
        .from('announcements')
        .delete()
        .eq('id', id)

      if (sbErr) throw sbErr
      announcements.value = announcements.value.filter(a => a.id !== id)
      return true
    } catch (e: unknown) {
      error.value = (e as { message?: string }).message ?? '削除に失敗しました'
      return false
    } finally {
      isLoading.value = false
    }
  }

  // ----------------------------------------------------------------
  // 即時公開（下書き → 公開）
  // ----------------------------------------------------------------
  async function publishAnnouncement(id: string): Promise<Announcement | null> {
    return updateAnnouncement(id, { published_at: new Date().toISOString() })
  }

  return {
    announcements,
    current,
    isLoading,
    error,
    fetchAnnouncements,
    fetchAnnouncement,
    createAnnouncement,
    updateAnnouncement,
    deleteAnnouncement,
    publishAnnouncement,
  }
}
