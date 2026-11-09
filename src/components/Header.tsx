import { BookOpen, Eye, History, MoreHorizontal, ShieldCheck, Sparkles, Moon, Sun } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { Language } from '../types'
import { useLanguage } from '../hooks/useLanguage'
import { useAuth } from '../contexts/AuthContext'
import { AccountAccessBar } from './AccountAccessBar'

const LANGUAGES: { id: Language; label: string }[] = [
  { id: 'vi', label: 'VI' },
  { id: 'en', label: 'EN' },
]

interface HeaderProps {
  theme: 'light' | 'dark'
  onToggleTheme: () => void
  onOpenHistory: () => void
  onOpenPreview: () => void
  historyCount: number
  onOpenContribution: () => void
}

/** Minimal one-row application header. Secondary destinations live in the More menu. */
export function Header({
  theme,
  onToggleTheme,
  onOpenHistory,
  onOpenPreview,
  historyCount,
  onOpenContribution,
}: HeaderProps) {
  const { language, setLanguage, t } = useLanguage()
  const { isAdmin } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    function handlePointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false)
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [menuOpen])

  const themeLabel = theme === 'dark' ? t('header.themeToLight') : t('header.themeToDark')

  return (
    <header className="sticky top-0 z-30 w-full shrink-0 border-b border-border/70 bg-card/95 px-3 pb-2 pt-[calc(0.5rem+env(safe-area-inset-top,0px))] sm:px-6 sm:py-3">
      <div className="mx-auto flex w-full max-w-[1440px] items-center justify-between gap-2">
        <a href="/" className="flex min-w-0 items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="CaptiVibe AI home">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-on-primary shadow-sm sm:size-10">
            <Sparkles className="size-5" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[15px] font-bold tracking-tight text-foreground sm:text-base">CaptiVibe AI</span>
            <span className="hidden text-[11px] text-muted-foreground md:block">{t('app.subtitle')}</span>
          </span>
        </a>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={onOpenPreview}
            aria-label={t('preview.openStudio')}
            title={t('preview.openStudio')}
            className="inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-primary/25 bg-primary/10 px-2.5 text-xs font-bold text-primary transition-colors hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-10 sm:px-3"
          >
            <Eye className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">{t('preview.openStudio')}</span>
          </button>

          <button
            type="button"
            onClick={onOpenHistory}
            aria-label={t('header.history')}
            title={t('header.history')}
            className="relative inline-flex size-9 cursor-pointer items-center justify-center rounded-xl border border-border bg-card text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:size-10"
          >
            <History className="size-4" aria-hidden="true" />
            {historyCount > 0 && (
              <span className="absolute -right-1 -top-1 inline-flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-on-primary">
                {historyCount > 99 ? '99+' : historyCount}
              </span>
            )}
          </button>

          <AccountAccessBar />

          <div ref={menuRef} className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((current) => !current)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label={t('header.more')}
              title={t('header.more')}
              className={`inline-flex size-9 cursor-pointer items-center justify-center rounded-xl border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:size-10 ${
                menuOpen
                  ? 'border-primary/40 bg-primary/10 text-primary'
                  : 'border-border bg-card text-foreground hover:bg-muted'
              }`}
            >
              <MoreHorizontal className="size-5" aria-hidden="true" />
            </button>

            {menuOpen && (
              <div role="menu" aria-label={t('header.more')} className="absolute right-0 top-full z-50 mt-2 w-60 rounded-2xl border border-border bg-card p-2 shadow-xl">
                <div className="px-2 pb-2 pt-1">
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{t('header.language')}</p>
                  <div role="group" aria-label={t('header.language')} className="flex gap-1 rounded-xl bg-muted p-1">
                    {LANGUAGES.map((item) => {
                      const active = language === item.id
                      return (
                        <button
                          key={item.id}
                          type="button"
                          aria-pressed={active}
                          onClick={() => setLanguage(item.id)}
                          className={`min-h-9 flex-1 cursor-pointer rounded-lg px-3 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${active ? 'bg-primary text-on-primary shadow-sm' : 'text-muted-foreground hover:bg-card hover:text-foreground'}`}
                        >
                          {item.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
                <div className="my-1 h-px bg-border" role="separator" />
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => { onOpenContribution(); setMenuOpen(false) }}
                  className="flex min-h-10 w-full cursor-pointer items-center gap-2.5 rounded-xl px-2.5 text-left text-sm font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <BookOpen className="size-4 text-muted-foreground" aria-hidden="true" />
                  {t('account.inspiration')}
                </button>
                {isAdmin && (
                  <a
                    href="/admin"
                    role="menuitem"
                    onClick={() => setMenuOpen(false)}
                    className="flex min-h-10 w-full cursor-pointer items-center gap-2.5 rounded-xl px-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <ShieldCheck className="size-4 text-muted-foreground" aria-hidden="true" />
                    {t('account.openAdmin')}
                  </a>
                )}
                <div className="my-1 h-px bg-border" role="separator" />
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => { onToggleTheme(); setMenuOpen(false) }}
                  className="flex min-h-10 w-full cursor-pointer items-center gap-2.5 rounded-xl px-2.5 text-left text-sm font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {theme === 'dark' ? <Sun className="size-4 text-muted-foreground" /> : <Moon className="size-4 text-muted-foreground" />}
                  {themeLabel}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
