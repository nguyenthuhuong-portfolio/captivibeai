import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { BookOpen, CheckCircle2, Globe2, LoaderCircle, LockKeyhole, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../hooks/useLanguage'

interface AnalysisResult {
  source_status: 'analyzed' | 'url_unavailable' | 'text_only'
  summary: string
  recommended_style: string
  hook_patterns: string[]
  structure_patterns: string[]
  emoji_guidance: string
  tone_patterns: string[]
  cta_patterns: string[]
  hashtag_patterns: string[]
  do_patterns: string[]
  avoid_patterns: string[]
  quality_score: number
}

interface Props {
  open: boolean
  onClose: () => void
}

interface PersonalReference { id: string; title: string; platform: string; category: string; created_at: string }

const CATEGORY_KEYS = {
  general: 'community.category.general',
  beauty: 'community.category.beauty',
  fashion: 'community.category.fashion',
  food: 'community.category.food',
  technology: 'community.category.technology',
  lifestyle: 'community.category.lifestyle',
  education: 'community.category.education',
} as const

export function CommunityContributionDialog({ open, onClose }: Props) {
  const { configured, session, signInWithGoogle } = useAuth()
  const { t } = useLanguage()
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [platform, setPlatform] = useState('instagram')
  const [category, setCategory] = useState('general')
  const [referenceText, setReferenceText] = useState('')
  const [scope, setScope] = useState<'personal' | 'community'>('personal')
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [failure, setFailure] = useState('')
  const [personalItems, setPersonalItems] = useState<PersonalReference[]>([])

  useEffect(() => {
    if (!open || !supabase || !session?.user) return
    let active = true
    void supabase.from('learning_references').select('id,title,platform,category,created_at')
      .eq('source_type', 'personal').eq('submitted_by', session.user.id)
      .order('created_at', { ascending: false }).limit(20)
      .then(({ data }) => { if (active) setPersonalItems((data ?? []) as PersonalReference[]) })
    return () => { active = false }
  }, [open, session?.user?.id])

  if (!open) return null

  function resetAndClose() {
    if (busy) return
    setMessage('')
    setFailure('')
    onClose()
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFailure('')
    setMessage('')
    if (!supabase || !session?.user) {
      setFailure(t('community.errorLogin'))
      return
    }
    if (!url.trim() && !referenceText.trim()) {
      setFailure(t('community.errorContent'))
      return
    }
    if (scope === 'community' && !consent) {
      setFailure(t('community.errorConsent'))
      return
    }

    setBusy(true)
    try {
      if (scope === 'community') {
        const { error } = await supabase.from('learning_references').insert({
          submitted_by: session.user.id,
          source_type: 'community',
          status: 'pending',
          title: title.trim() || t('community.community'),
          source_url: url.trim() || null,
          platform,
          category,
          reference_text: referenceText.trim() || null,
          consent_to_global: true,
        })
        if (error) throw error
        setMessage(t('community.successCommunity'))
      } else {
        const response = await fetch('/api/learning/analyze', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            scope: 'personal', title: title.trim(), sourceUrl: url.trim(),
            referenceText: referenceText.trim(), platform, category,
          }),
        })
        const result = await response.json().catch(() => null)
        if (!response.ok) throw new Error(result?.code || 'learning_analysis_failed')
        const analysis = result as AnalysisResult
        if (analysis.source_status === 'url_unavailable' && !referenceText.trim()) {
          throw new Error(t('community.errorUrlUnavailable'))
        }
        const { data: reference, error: referenceError } = await supabase
          .from('learning_references')
          .insert({
            submitted_by: session.user.id,
            source_type: 'personal', status: 'approved',
            title: title.trim() || t('community.personal'),
            source_url: url.trim() || null, platform, category,
            reference_text: referenceText.trim() || null,
            consent_to_global: false,
          })
          .select('id')
          .single()
        if (referenceError) throw referenceError
        const { error: patternError } = await supabase.from('learning_patterns').insert({
          reference_id: reference.id,
          user_id: session.user.id,
          scope: 'personal', status: 'approved',
          title: title.trim() || t('community.personal'),
          platform, category, pattern: analysis,
          quality_score: analysis.quality_score,
        })
        if (patternError) {
          // Roll back the source row so a failed pattern insert cannot leave an orphan reference.
          await supabase.from('learning_references').delete().eq('id', reference.id)
          throw patternError
        }
        const { data: savedItems } = await supabase.from('learning_references').select('id,title,platform,category,created_at')
          .eq('source_type', 'personal').eq('submitted_by', session.user.id)
          .order('created_at', { ascending: false }).limit(20)
        setPersonalItems((savedItems ?? []) as PersonalReference[])
        setMessage(analysis.source_status === 'url_unavailable'
          ? t('community.successPersonalUrl')
          : t('community.successPersonal'))
      }
      setTitle('')
      setUrl('')
      setReferenceText('')
      setConsent(false)
    } catch (error) {
      setFailure(error instanceof Error ? error.message : t('community.errorSave'))
    } finally {
      setBusy(false)
    }
  }

  async function deletePersonalReference(id: string) {
    if (!supabase) return
    const { error } = await supabase.from('learning_references').delete().eq('id', id)
    if (error) setFailure(error.message)
    else setPersonalItems((items) => items.filter((item) => item.id !== id))
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-3 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) resetAndClose() }}>
      <section role="dialog" aria-modal="true" aria-labelledby="contribution-title" className="max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="mb-1 flex items-center gap-2 text-primary"><BookOpen className="size-5"/><span className="text-xs font-bold uppercase tracking-wider">{t('community.eyebrow')}</span></div>
            <h2 id="contribution-title" className="text-xl font-bold text-foreground">{t('community.title')}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t('community.subtitle')}</p>
          </div>
          <button type="button" onClick={resetAndClose} className="cursor-pointer rounded-lg p-2 text-muted-foreground hover:bg-muted" aria-label={t('community.close')}><X className="size-5"/></button>
        </div>

        {!configured ? (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-foreground"><strong>{t('community.supabaseMissingTitle')}.</strong> {t('community.supabaseMissingBody')}</div>
        ) : !session ? (
          <div className="space-y-3 rounded-xl bg-muted p-4">
            <p className="text-sm text-foreground">{t('community.signInPrompt')}</p>
            <button type="button" onClick={() => void signInWithGoogle()} className="flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-4 font-semibold text-on-primary transition-colors hover:bg-primary-hover"><Globe2 className="size-4"/> {t('community.continueGoogle')}</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setScope('personal')} className={`cursor-pointer rounded-xl border p-3 text-left transition-colors ${scope === 'personal' ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted'}`}>
                <LockKeyhole className="mb-1 size-4"/><span className="block text-sm font-semibold">{t('community.personal')}</span><span className="text-xs text-muted-foreground">{t('community.personalHint')}</span>
              </button>
              <button type="button" onClick={() => setScope('community')} className={`cursor-pointer rounded-xl border p-3 text-left transition-colors ${scope === 'community' ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted'}`}>
                <Globe2 className="mb-1 size-4"/><span className="block text-sm font-semibold">{t('community.community')}</span><span className="text-xs text-muted-foreground">{t('community.communityHint')}</span>
              </button>
            </div>
            <label className="block space-y-1"><span className="text-sm font-medium">{t('community.titleLabel')}</span><input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} placeholder={t('community.titlePlaceholder')} className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground"/></label>
            <label className="block space-y-1"><span className="text-sm font-medium">{t('community.urlLabel')}</span><input type="url" value={url} onChange={(event) => setUrl(event.target.value)} maxLength={2048} placeholder={t('community.urlPlaceholder')} className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground"/></label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1"><span className="text-sm font-medium">{t('community.platform')}</span><select value={platform} onChange={(event) => setPlatform(event.target.value)} className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground"><option value="instagram">Instagram</option><option value="tiktok">TikTok</option><option value="facebook">Facebook</option><option value="x">X</option><option value="all">{t('community.platformAll')}</option></select></label>
              <label className="block space-y-1"><span className="text-sm font-medium">{t('community.category')}</span><select value={category} onChange={(event) => setCategory(event.target.value)} className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground"><option value="general">{t('community.category.general')}</option><option value="beauty">{t('community.category.beauty')}</option><option value="fashion">{t('community.category.fashion')}</option><option value="food">{t('community.category.food')}</option><option value="technology">{t('community.category.technology')}</option><option value="lifestyle">{t('community.category.lifestyle')}</option><option value="education">{t('community.category.education')}</option></select></label>
            </div>
            <label className="block space-y-1"><span className="text-sm font-medium">{t('community.contentLabel')}</span><textarea value={referenceText} onChange={(event) => setReferenceText(event.target.value)} maxLength={12000} rows={5} placeholder={t('community.contentPlaceholder')} className="w-full resize-y rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground"/></label>
            {scope === 'community' && <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-border p-3 text-sm"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-1"/><span>{t('community.consent')}</span></label>}
            {message && <p className="flex items-start gap-2 rounded-xl bg-emerald-500/10 p-3 text-sm text-emerald-700"><CheckCircle2 className="mt-0.5 size-4 shrink-0"/>{message}</p>}
            {failure && <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{failure}</p>}
            <button type="submit" disabled={busy || (!url.trim() && !referenceText.trim())} className="flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-4 font-semibold text-on-primary transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50">
              {busy ? <LoaderCircle className="size-4 animate-spin"/> : <BookOpen className="size-4"/>}
              {busy ? (scope === 'personal' ? t('community.analyzing') : t('community.sending')) : (scope === 'personal' ? t('community.savePersonal') : t('community.submitCommunity'))}
            </button>
            {scope === 'personal' && personalItems.length > 0 && (
              <div className="border-t border-border pt-4">
                <h3 className="mb-2 text-sm font-semibold">{t('community.savedTitle')}</h3>
                <div className="space-y-2">
                  {personalItems.map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
                      <div className="min-w-0"><p className="truncate text-sm font-medium">{item.title}</p><p className="text-xs text-muted-foreground">{item.platform} · {CATEGORY_KEYS[item.category as keyof typeof CATEGORY_KEYS] ? t(CATEGORY_KEYS[item.category as keyof typeof CATEGORY_KEYS]) : item.category}</p></div>
                      <button type="button" onClick={() => void deletePersonalReference(item.id)} className="cursor-pointer rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-destructive" aria-label={t('community.deletePersonal', { name: item.title })}><X className="size-4"/></button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </form>
        )}
      </section>
    </div>
  )
}
