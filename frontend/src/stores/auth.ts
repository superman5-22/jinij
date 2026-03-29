import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/types'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const session = ref<Session | null>(null)
  const profile = ref<Profile | null>(null)
  const initializing = ref(true)

  const isAuthenticated = computed(() => !!user.value)
  const isAdmin = computed(() => profile.value?.role === 'admin')
  const isHR = computed(() => ['admin', 'hr'].includes(profile.value?.role ?? ''))
  const isManager = computed(() =>
    ['admin', 'hr', 'manager'].includes(profile.value?.role ?? '')
  )
  const displayName = computed(
    () => profile.value?.full_name ?? user.value?.email ?? 'ゲスト'
  )

  async function initialize() {
    initializing.value = true
    try {
      const { data: { session: current } } = await supabase.auth.getSession()
      if (current) {
        session.value = current
        user.value = current.user
        await fetchProfile()
      }
    } finally {
      initializing.value = false
    }

    supabase.auth.onAuthStateChange(async (_event, newSession) => {
      session.value = newSession
      user.value = newSession?.user ?? null
      if (newSession) {
        await fetchProfile()
      } else {
        profile.value = null
      }
    })
  }

  async function fetchProfile() {
    if (!user.value) return
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.value.id)
      .single()
    if (!error && data) profile.value = data as Profile
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    await fetchProfile()
  }

  async function signOut() {
    await supabase.auth.signOut()
    user.value = null
    session.value = null
    profile.value = null
  }

  return {
    user, session, profile, initializing,
    isAuthenticated, isAdmin, isHR, isManager, displayName,
    initialize, signIn, signOut, fetchProfile,
  }
})
