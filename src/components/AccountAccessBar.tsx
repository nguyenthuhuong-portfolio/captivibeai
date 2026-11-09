import { LogIn, LogOut, UserRound } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../hooks/useLanguage'

/** Compact Google sign-in / account action for the single-row application header. */
export function AccountAccessBar() {
  const { configured, loading, user, signInWithGoogle, signOut } = useAuth()
  const { t } = useLanguage()

  if (!configured) return null

  if (loading) {
    return <span className="inline-flex size-9 items-center justify-center text-muted-foreground sm:size-10" aria-label={t('account.loading')}><UserRound className="size-4 animate-pulse" /></span>
  }

  return user ? (
    <button
      type="button"
      onClick={() => void signOut().catch((error) => console.error('[captivibe] sign out failed', error))}
      title={`${t('account.signOut')} · ${user.email ?? ''}`}
      aria-label={`${t('account.signOut')} · ${user.email ?? ''}`}
      className="inline-flex size-9 cursor-pointer items-center justify-center rounded-xl border border-border bg-card text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:size-10"
    >
      <LogOut className="size-4" aria-hidden="true" />
    </button>
  ) : (
    <button
      type="button"
      onClick={() => void signInWithGoogle().catch((error) => console.error('[captivibe] Google sign-in failed', error))}
      title={t('account.signIn')}
      aria-label={t('account.signIn')}
      className="inline-flex size-9 cursor-pointer items-center justify-center rounded-xl bg-primary text-on-primary shadow-sm transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:size-10"
    >
      <LogIn className="size-4" aria-hidden="true" />
    </button>
  )
}
