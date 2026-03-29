import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import StatusBadge from '@/components/common/StatusBadge.vue'

describe('StatusBadge', () => {
  // ----------------------------------------------------------------
  // employee-status
  // ----------------------------------------------------------------
  describe('type = employee-status', () => {
    it.each([
      ['active',   '在職',   'badge-active'],
      ['inactive', '退職',   'badge-inactive'],
      ['on_leave', '休職中', 'badge-on-leave'],
    ] as const)('value=%s → ラベル=%s, クラス=%s', (value, label, cls) => {
      const wrapper = mount(StatusBadge, {
        props: { type: 'employee-status', value },
      })
      expect(wrapper.text().trim()).toBe(label)
      expect(wrapper.classes()).toContain(cls)
    })

    it('未知の値はそのまま表示される', () => {
      const wrapper = mount(StatusBadge, {
        props: { type: 'employee-status', value: 'unknown_xyz' },
      })
      expect(wrapper.text().trim()).toBe('unknown_xyz')
      expect(wrapper.classes()).toContain('badge-inactive') // フォールバック
    })
  })

  // ----------------------------------------------------------------
  // leave-status
  // ----------------------------------------------------------------
  describe('type = leave-status', () => {
    it.each([
      ['pending',   '承認待ち',   'badge-pending'],
      ['approved',  '承認済み',   'badge-approved'],
      ['rejected',  '却下',       'badge-rejected'],
      ['cancelled', 'キャンセル', 'badge-cancelled'],
    ] as const)('value=%s → ラベル=%s, クラス=%s', (value, label, cls) => {
      const wrapper = mount(StatusBadge, {
        props: { type: 'leave-status', value },
      })
      expect(wrapper.text().trim()).toBe(label)
      expect(wrapper.classes()).toContain(cls)
    })
  })

  // ----------------------------------------------------------------
  // leave-type
  // ----------------------------------------------------------------
  describe('type = leave-type', () => {
    it.each([
      ['annual',      '年次有給休暇'],
      ['sick',        '病気休暇'],
      ['personal',    '私用休暇'],
      ['bereavement', '忌引き休暇'],
      ['other',       'その他'],
    ] as const)('value=%s → ラベル=%s', (value, label) => {
      const wrapper = mount(StatusBadge, {
        props: { type: 'leave-type', value },
      })
      expect(wrapper.text().trim()).toBe(label)
      expect(wrapper.classes()).toContain(`badge-${value}`)
    })
  })

  // ----------------------------------------------------------------
  // showDot prop
  // ----------------------------------------------------------------
  describe('showDot prop', () => {
    it('showDot=true のとき .dot 要素が表示される', () => {
      const wrapper = mount(StatusBadge, {
        props: { type: 'employee-status', value: 'active', showDot: true },
      })
      expect(wrapper.find('.dot').exists()).toBe(true)
    })

    it('showDot 省略時は .dot 要素が存在しない', () => {
      const wrapper = mount(StatusBadge, {
        props: { type: 'employee-status', value: 'active' },
      })
      expect(wrapper.find('.dot').exists()).toBe(false)
    })

    it('showDot=false のとき .dot 要素が存在しない', () => {
      const wrapper = mount(StatusBadge, {
        props: { type: 'employee-status', value: 'active', showDot: false },
      })
      expect(wrapper.find('.dot').exists()).toBe(false)
    })
  })

  // ----------------------------------------------------------------
  // 共通: badge クラスが付与される
  // ----------------------------------------------------------------
  it('span.badge クラスが常に付与される', () => {
    const wrapper = mount(StatusBadge, {
      props: { type: 'leave-status', value: 'pending' },
    })
    expect(wrapper.classes()).toContain('badge')
  })
})
