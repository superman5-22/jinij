import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'
import type { Announcement, AnnouncementFormData, AnnouncementFilters } from '@/types'

export function useAnnouncements() {
  const announcements = ref<Announcement[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  // 緊急・重要お知らせ（未読バナー表示用）
  const urgentAnnouncements = computed(() =>
    announcements.value.filter(a => a.priority === 'urgent' || a.priority === 'high')
  )

  // ============================================================
  // 取得
  // ============================================================
  async function fetchAnnouncements(filters: Partial<AnnouncementFilters> = {}) {
    loading.value = true
    error.value = null
    try {
      let query = supabase
        .from('announcements')
        .select('*')
        .order('published_at', { ascending: false })

      if (filters.category) {
        query = query.eq('category', filters.category)
      }
      if (filters.priority) {
        query = query.eq('priority', filters.priority)
      }
      if (filters.is_published !== '' && filters.is_published !== undefined) {
        query = query.eq('is_published', filters.is_published)
      }

      const { data, error: err } = await query
      if (err) throw err
      announcements.value = (data ?? []) as Announcement[]
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'お知らせの取得に失敗しました'
    } finally {
      loading.value = false
    }
  }

  async function fetchById(id: string): Promise<Announcement | null> {
    const { data, error: err } = await supabase
      .from('announcements')
      .select('*')
      .eq('id', id)
      .single()
    if (err) throw err
    return data as Announcement | null
  }

  // ============================================================
  // 作成
  // ============================================================
  async function createAnnouncement(form: AnnouncementFormData): Promise<Announcement> {
    const payload: Partial<Announcement> = {
      title:        form.title,
      content:      form.content,
      category:     form.category,
      priority:     form.priority,
      is_published: form.is_published,
      published_at: form.is_published
        ? (form.published_at || new Date().toISOString())
        : null,
      expires_at:   form.expires_at || null,
    }

    const { data, error: err } = await supabase
      .from('announcements')
      .insert(payload)
      .select()
      .single()
    if (err) throw err

    const created = data as Announcement
    announcements.value.unshift(created)
    return created
  }

  // ============================================================
  // 更新
  // ============================================================
  async function updateAnnouncement(id: string, form: AnnouncementFormData): Promise<void> {
    const payload: Partial<Announcement> = {
      title:        form.title,
      content:      form.content,
      category:     form.category,
      priority:     form.priority,
      is_published: form.is_published,
      published_at: form.is_published
        ? (form.published_at || new Date().toISOString())
        : null,
      expires_at:   form.expires_at || null,
    }

    const { error: err } = await supabase
      .from('announcements')
      .update(payload)
      .eq('id', id)
    if (err) throw err

    const idx = announcements.value.findIndex(a => a.id === id)
    if (idx !== -1) {
      announcements.value[idx] = { ...announcements.value[idx], ...payload }
    }
  }

  // ============================================================
  // 削除
  // ============================================================
  async function deleteAnnouncement(id: string): Promise<void> {
    const { error: err } = await supabase
      .from('announcements')
      .delete()
      .eq('id', id)
    if (err) throw err

    announcements.value = announcements.value.filter(a => a.id !== id)
  }

  // ============================================================
  // 公開 / 非公開 切り替え
  // ============================================================
  async function togglePublish(id: string, publish: boolean): Promise<void> {
    const payload: Partial<Announcement> = {
      is_published: publish,
      published_at: publish ? new Date().toISOString() : null,
    }
    const { error: err } = await supabase
      .from('announcements')
      .update(payload)
      .eq('id', id)
    if (err) throw err

    const target = announcements.value.find(a => a.id === id)
    if (target) {
      target.is_published = publish
      target.published_at = payload.published_at ?? null
    }
  }

  return {
    announcements,
    loading,
    error,
    urgentAnnouncements,
    fetchAnnouncements,
    fetchById,
    createAnnouncement,
    updateAnnouncement,
    deleteAnnouncement,
    togglePublish,
  }
}
