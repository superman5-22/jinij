import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useNotifications } from '@/composables/useNotifications'
import type { Notification } from '@/types'

// ----------------------------------------------------------------
// Supabase モック（vi.hoisted でホイスティング前に変数を確保）
// ----------------------------------------------------------------
const { mockFrom, mockChannel, mockRemoveChannel } = vi.hoisted(() => {
  const mockChannel = {
    on:        vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockReturnThis(),
  }
  return {
    mockFrom:          vi.fn(),
    mockChannel,
    mockRemoveChannel: vi.fn(),
  }
})

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from:          mockFrom,
    channel:       vi.fn(() => mockChannel),
    removeChannel: mockRemoveChannel,
  },
}))

// テスト用通知データ
const makeNotification = (overrides: Partial<Notification> = {}): Notification => ({
  id:         'n-001',
  user_id:    'user-001',
  type:       'leave_approved',
  title:      '休暇申請が承認されました',
  message:    '2026年04月01日 から 2026年04月03日 の休暇申請が承認されました。',
  related_id: 'lr-001',
  is_read:    false,
  created_at: '2026-03-29T10:00:00Z',
  ...overrides,
})

// ----------------------------------------------------------------
// チェーン可能なクエリビルダーモックを作成するヘルパー
// select チェーン: from → select → eq → order → limit（最終が Promise）
// update チェーン: from → update → eq（最終が Promise）
//               : from → update → in（最終が Promise）
// ----------------------------------------------------------------
function buildSelectMock(resolvedValue: { data: Notification[] | null; error: null | Error }) {
  // 全メソッドが chain を返し、limit だけ Promise を返す
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  chain['select'] = vi.fn().mockReturnValue(chain)
  chain['eq']     = vi.fn().mockReturnValue(chain)
  chain['order']  = vi.fn().mockReturnValue(chain)
  chain['limit']  = vi.fn().mockResolvedValue(resolvedValue)
  return chain
}

function buildUpdateEqMock(resolvedValue: { error: null | Error }) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  chain['update'] = vi.fn().mockReturnValue(chain)
  chain['eq']     = vi.fn().mockResolvedValue(resolvedValue)
  return chain
}

function buildUpdateInMock(resolvedValue: { error: null | Error }) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  chain['update'] = vi.fn().mockReturnValue(chain)
  chain['in']     = vi.fn().mockResolvedValue(resolvedValue)
  return chain
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ================================================================
describe('useNotifications', () => {
  // ----------------------------------------------------------------
  describe('初期状態', () => {
    it('notifications は空配列', () => {
      const { notifications } = useNotifications('user-001')
      expect(notifications.value).toEqual([])
    })

    it('loading は false', () => {
      const { loading } = useNotifications('user-001')
      expect(loading.value).toBe(false)
    })

    it('error は null', () => {
      const { error } = useNotifications('user-001')
      expect(error.value).toBeNull()
    })

    it('unreadCount は 0', () => {
      const { unreadCount } = useNotifications('user-001')
      expect(unreadCount.value).toBe(0)
    })
  })

  // ----------------------------------------------------------------
  describe('unreadCount（算出プロパティ）', () => {
    it('未読通知の数を正しく返す', () => {
      const { notifications, unreadCount } = useNotifications('user-001')
      notifications.value = [
        makeNotification({ id: 'n1', is_read: false }),
        makeNotification({ id: 'n2', is_read: true }),
        makeNotification({ id: 'n3', is_read: false }),
      ]
      expect(unreadCount.value).toBe(2)
    })

    it('全件既読の場合は 0', () => {
      const { notifications, unreadCount } = useNotifications('user-001')
      notifications.value = [
        makeNotification({ id: 'n1', is_read: true }),
        makeNotification({ id: 'n2', is_read: true }),
      ]
      expect(unreadCount.value).toBe(0)
    })

    it('通知が 0 件の場合は 0', () => {
      const { notifications, unreadCount } = useNotifications('user-001')
      notifications.value = []
      expect(unreadCount.value).toBe(0)
    })
  })

  // ----------------------------------------------------------------
  describe('fetchNotifications', () => {
    it('正常取得: notifications が更新される', async () => {
      const mockData = [
        makeNotification({ id: 'n1' }),
        makeNotification({ id: 'n2', is_read: true }),
      ]
      mockFrom.mockReturnValue(buildSelectMock({ data: mockData, error: null }))

      const { notifications, loading, fetchNotifications } = useNotifications('user-001')
      await fetchNotifications()

      expect(notifications.value).toEqual(mockData)
      expect(loading.value).toBe(false)
    })

    it('userId が空の場合は何もしない', async () => {
      const { notifications, fetchNotifications } = useNotifications('')
      await fetchNotifications()
      expect(mockFrom).not.toHaveBeenCalled()
      expect(notifications.value).toEqual([])
    })

    it('エラー時: error にメッセージがセットされ notifications は変わらない', async () => {
      const chain = buildSelectMock({ data: null, error: null })
      chain['limit'] = vi.fn().mockRejectedValue(new Error('接続失敗'))
      mockFrom.mockReturnValue(chain)

      const { notifications, error, fetchNotifications } = useNotifications('user-001')
      notifications.value = [makeNotification()]
      await fetchNotifications()

      expect(error.value).toBe('接続失敗')
      expect(notifications.value).toEqual([makeNotification()]) // 変わらない
    })
  })

  // ----------------------------------------------------------------
  describe('markAsRead', () => {
    it('指定 id の通知を既読に変更する', async () => {
      mockFrom.mockReturnValue(buildUpdateEqMock({ error: null }))

      const { notifications, markAsRead } = useNotifications('user-001')
      notifications.value = [makeNotification({ id: 'n1', is_read: false })]

      await markAsRead('n1')

      expect(notifications.value[0].is_read).toBe(true)
    })

    it('存在しない id の場合は状態を変えない', async () => {
      mockFrom.mockReturnValue(buildUpdateEqMock({ error: null }))

      const { notifications, markAsRead } = useNotifications('user-001')
      notifications.value = [makeNotification({ id: 'n1', is_read: false })]

      await markAsRead('not-exist')

      expect(notifications.value[0].is_read).toBe(false)
    })

    it('Supabase エラー時は例外を投げる', async () => {
      mockFrom.mockReturnValue(buildUpdateEqMock({ error: new Error('更新失敗') }))

      const { markAsRead } = useNotifications('user-001')
      await expect(markAsRead('n1')).rejects.toThrow('更新失敗')
    })
  })

  // ----------------------------------------------------------------
  describe('markAllAsRead', () => {
    it('未読通知が 0 件のときは supabase.from を呼ばない', async () => {
      const { notifications, markAllAsRead } = useNotifications('user-001')
      notifications.value = [makeNotification({ is_read: true })]

      await markAllAsRead()

      expect(mockFrom).not.toHaveBeenCalled()
    })

    it('未読通知を全て既読にする', async () => {
      const inMock = buildUpdateInMock({ error: null })
      mockFrom.mockReturnValue(inMock)

      const { notifications, markAllAsRead } = useNotifications('user-001')
      notifications.value = [
        makeNotification({ id: 'n1', is_read: false }),
        makeNotification({ id: 'n2', is_read: false }),
        makeNotification({ id: 'n3', is_read: true }),
      ]

      await markAllAsRead()

      expect(notifications.value.every(n => n.is_read)).toBe(true)
      // in() に未読 id が渡されること
      expect(inMock['in']).toHaveBeenCalledWith('id', ['n1', 'n2'])
    })

    it('Supabase エラー時は例外を投げる', async () => {
      mockFrom.mockReturnValue(buildUpdateInMock({ error: new Error('一括更新失敗') }))

      const { notifications, markAllAsRead } = useNotifications('user-001')
      notifications.value = [makeNotification({ is_read: false })]

      await expect(markAllAsRead()).rejects.toThrow('一括更新失敗')
    })
  })

  // ----------------------------------------------------------------
  describe('subscribeRealtime / unsubscribeRealtime', () => {
    it('userId が空のとき subscribeRealtime は channel を作らない', async () => {
      const { supabase } = await import('@/lib/supabase')
      const channelSpy = vi.spyOn(supabase, 'channel')
      const { subscribeRealtime } = useNotifications('')
      subscribeRealtime()
      expect(channelSpy).not.toHaveBeenCalled()
    })

    it('unsubscribeRealtime は channel を削除する', () => {
      const { subscribeRealtime, unsubscribeRealtime } = useNotifications('user-001')

      subscribeRealtime()
      unsubscribeRealtime()

      expect(mockRemoveChannel).toHaveBeenCalledOnce()
    })

    it('2 回 unsubscribe しても removeChannel は 1 回しか呼ばれない', () => {
      const { subscribeRealtime, unsubscribeRealtime } = useNotifications('user-001')

      subscribeRealtime()
      unsubscribeRealtime()
      unsubscribeRealtime() // 2回目は channel が null

      expect(mockRemoveChannel).toHaveBeenCalledOnce()
    })
  })
})
