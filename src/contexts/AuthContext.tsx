import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

interface AuthContextValue {
  configured: boolean
  loading: boolean
  adminLoading: boolean
  session: Session | null
  user: User | null
  isAdmin: boolean
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
  refreshAdmin: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(Boolean(supabase))
  const [adminLoading, setAdminLoading] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }

    let active = true
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return
      if (!error) setSession(data.session)
      setLoading(false)
    }).catch(() => {
      if (active) setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  const refreshAdmin = useCallback(async () => {
    if (!supabase || !session?.user) {
      setIsAdmin(false)
      setAdminLoading(false)
      return
    }
    setAdminLoading(true)
    try {
      const { data, error } = await supabase
        .from('admin_roles')
        .select('user_id')
        .eq('user_id', session.user.id)
        .maybeSingle()
      setIsAdmin(!error && Boolean(data?.user_id))
    } catch {
      setIsAdmin(false)
    } finally {
      setAdminLoading(false)
    }
  }, [session?.user?.id])

  useEffect(() => {
    void refreshAdmin()
  }, [refreshAdmin])

  const signInWithGoogle = useCallback(async () => {
    if (!supabase) throw new Error('supabase_not_configured')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    if (error) throw error
  }, [])

  const signOut = useCallback(async () => {
    if (!supabase) return
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    setIsAdmin(false)
    setAdminLoading(false)
  }, [])

  const value = useMemo<AuthContextValue>(() => ({
    configured: Boolean(supabase),
    loading,
    adminLoading,
    session,
    user: session?.user ?? null,
    isAdmin,
    signInWithGoogle,
    signOut,
    refreshAdmin,
  }), [loading, adminLoading, session, isAdmin, signInWithGoogle, signOut, refreshAdmin])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
