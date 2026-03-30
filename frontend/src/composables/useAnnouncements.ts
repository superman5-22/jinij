import { ref } from 'vue'
import { supabase } from '@/lib/supabase'
import type { Announcement, AnnouncementFormData, AnnouncementFilters } from '@/types'

export function useAnnouncements() {
  const announcements = ref<Announcement[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  // ============================================================
  // 取得
  // ============================================================
  async function fetchAnnouncements(filters?: Partial<AnnouncementFilters>, isHR = false) {
    loading.value = true
    error.value = null
    try {
      let query = supabase
        .from('announcements')
        .select(`
          *,
          author:profiles!created_by(id, full_name, email)
        `)
        .order('is_pinned', { ascending: false })
        .order('published_at', { ascending: false })

      // HR/admin 以外は公開済み・有効期限内のみ
      if (!isHR || !filters?.show_all) {
        const now = new Date().toISOString()
        query = query
          .not('published_at', 'is', null)
          .lte('published_at', now)
          .or(`expires_at.is.null,expires_at.gt.${now}`)
      }

      if (filters?.category) {
        query = query.eq('category', filters.category)
      }

      if (filters?.keyword) {
        query = query.or(
          `title.ilike.%${filters.keyword}%,body.ilike.%${filters.keyword}%`
        )
      }

      const { data, error: err } = await query
      if (err) throw err
      announcements.value = (data ?? []) as Announcement[]

      // 既読状態を付与
      await attachReadStatus()
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'お知らせの取得に失敗しました'
    } finally {
      loading.value = false
    }
  }

  // ============================================================
  // 既読状態取得・付与
  // ============================================================
  async function attachReadStatus() {
    if (announcements.value.length === 0) return
    const ids = announcements.value.map(a => a.id)
    const { data } = await supabase
      .from('announcement_reads')
      .select('announcement_id')
      .in('announcement_id', ids)
    const readSet = new Set((data ?? []).map((r: { announcement_id: string }) => r.announcement_id))
    announcements.value.forEach(a => {
      a.is_read = readSet.has(a.id)
    })
  }

  // ============================================================
  // 既読登録
  // ============================================================
  async function markAsRead(announcementId: string) {
    const { error: err } = await supabase
      .from('announcement_reads')
      .upsert({ announcement_id: announcementId })
    if (err) throw err
    const target = announcements.value.find(a => a.id === announcementId)
    if (target) target.is_read = true
  }

  // ============================================================
  // 未読数
  // ============================================================
  async function fetchUnreadCount(): Promise<number> {
    const now = new Date().toISOString()
    const { data: published } = await supabase
      .from('announcements')
      .select('id')
      .not('published_at', 'is', null)
      .lte('published_at', now)
      .or(`expires_at.is.null,expires_at.gt.${now}`)
    if (!published || published.length === 0) return 0

    const ids = published.map((a: { id: string }) => a.id)
    const { data: reads } = await supabase
      .from('announcement_reads')
      .select('announcement_id')
      .in('announcement_id', ids)
    const readCount = reads?.length ?? 0
    return ids.length - readCount
  }

  // ============================================================
  // 作成（HR/admin）
  // ============================================================
  async function createAnnouncement(form: AnnouncementFormData): Promise<Announcement> {
    const payload = buildPayload(form)
    const { data, error: err } = await supabase
      .from('announcements')
      .insert(payload)
      .select(`*, author:profiles!created_by(id, full_name, email)`)
      .single()
    if (err) throw new Error(err.message)
    return data as Announcement
  }

  // ============================================================
  // 更新（HR/admin）
  // ============================================================
  async function updateAnnouncement(
    id: string,
    form: AnnouncementFormData
  ): Promise<Announcement> {
    const payload = buildPayload(form)
    const { data, error: err } = await supabase
      .from('announcements')
      .update(payload)
      .eq('id', id)
      .select(`*, author:profiles!created_by(id, full_name, email)`)
      .single()
    if (err) throw new Error(err.message)
    return data as Announcement
  }

  // ============================================================
  // 削除（HR/admin）
  // ============================================================
  async function deleteAnnouncement(id: string): Promise<void> {
    const { error: err } = await supabase
      .from('announcements')
      .delete()
      .eq('id', id)
    if (err) throw new Error(err.message)
  }

  // ============================================================
  // ヘルパー
  // ============================================================
  function buildPayload(form: AnnouncementFormData) {
    return {
      title:        form.title.trim(),
      body:         form.body.trim(),
      category:     form.category,
      is_pinned:    form.is_pinned,
      published_at: form.published_at || null,
      expires_at:   form.expires_at   || null,
    }
  }

  return {
    announcements,
    loading,
    error,
    fetchAnnouncements,
    markAsRead,
    fetchUnreadCount,
    createAnnouncement,
    updateAnnouncement,
    deleteAnnouncement,
  }
}
