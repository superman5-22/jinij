import { ref, computed } from 'vue'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Notification } from '@/types'

export function useNotifications(userId: string) {
  const notifications = ref<Notification[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  let channel: RealtimeChannel | null = null

  const unreadCount = computed(() =>
    notifications.value.filter(n => !n.is_read).length
  )

  async function fetchNotifications() {
    if (!userId) return
    loading.value = true
    error.value = null
    try {
      const { data, error: err } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20)
      if (err) throw err
      notifications.value = (data ?? []) as Notification[]
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : '通知の取得に失敗しました'
    } finally {
      loading.value = false
    }
  }

  async function markAsRead(id: string) {
    const { error: err } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)
    if (err) throw err
    const target = notifications.value.find(n => n.id === id)
    if (target) target.is_read = true
  }

  async function markAllAsRead() {
    const unreadIds = notifications.value
      .filter(n => !n.is_read)
      .map(n => n.id)
    if (unreadIds.length === 0) return

    const { error: err } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .in('id', unreadIds)
    if (err) throw err
    notifications.value.forEach(n => { n.is_read = true })
  }

  function subscribeRealtime() {
    if (!userId) return
    channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          notifications.value.unshift(payload.new as Notification)
        }
      )
      .subscribe()
  }

  function unsubscribeRealtime() {
    if (channel) {
      supabase.removeChannel(channel)
      channel = null
    }
  }

  return {
    notifications,
    loading,
    error,
    unreadCount,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    subscribeRealtime,
    unsubscribeRealtime,
  }
}
