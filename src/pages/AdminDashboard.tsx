import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { ArrowLeft, BookOpen, Check, ExternalLink, LoaderCircle, LogIn, LogOut, Plus, RefreshCw, Save, ShieldCheck, Sparkles, X } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { useLanguage } from '../hooks/useLanguage'
import type { TranslationKey } from '../lib/i18n'

interface ReferenceRow {
  id: string
  submitted_by: string | null
  source_type: 'developer' | 'community' | 'personal'
  status: 'pending' | 'approved' | 'rejected'
  title: string
  source_url: string | null
  platform: string
  category: string
  reference_text: string | null
  created_at: string
}

interface GlobalDnaSourceRow {
  id?: string
  position: number
  title: string
  source_text: string
}

interface GlobalDnaProfile {
  brand_voice: string
  hook_patterns: string[]
  rhythm_and_structure: string
  emoji_style: string
  persuasion_patterns: string[]
  cta_style: string
  wording_preferences: string[]
  do_rules: string[]
  avoid_rules: string[]
}

interface GlobalDnaVersionRow {
  id: string
  version: number
  profile: GlobalDnaProfile
  source_count: number
  status: 'draft' | 'active' | 'archived'
  created_at: string
  activated_at: string | null
}

const emptyDnaSources = (): GlobalDnaSourceRow[] => Array.from({ length: 10 }, (_, index) => ({
  position: index + 1,
  title: `Bài mẫu ${String(index + 1).padStart(2, '0')}`,
  source_text: '',
}))

interface Analysis {
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

const emptyForm = { title: '', sourceUrl: '', platform: 'instagram', category: 'general', referenceText: '' }

export function AdminDashboard() {
  const { configured, loading, adminLoading, session, user, isAdmin, signInWithGoogle, signOut, refreshAdmin } = useAuth()
  const { t, language } = useLanguage()
  const [rows, setRows] = useState<ReferenceRow[]>([])
  const [patternsCount, setPatternsCount] = useState(0)
  const [pendingCount, setPendingCount] = useState(0)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [loadingRows, setLoadingRows] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [form, setForm] = useState(emptyForm)
  const [showForm, setShowForm] = useState(false)
  const [dnaSources, setDnaSources] = useState<GlobalDnaSourceRow[]>(emptyDnaSources)
  const [dnaProfiles, setDnaProfiles] = useState<GlobalDnaVersionRow[]>([])
  const [dnaBusy, setDnaBusy] = useState(false)

  const loadDashboard = useCallback(async () => {
    if (!supabase || !isAdmin) return
    setLoadingRows(true)
    setError('')
    const [referenceResult, patternResult, pendingResult] = await Promise.all([
      supabase.from('learning_references').select('*').neq('source_type', 'personal').order('created_at', { ascending: false }).limit(100),
      supabase.from('learning_patterns').select('id', { count: 'exact', head: true }).eq('scope', 'global').eq('status', 'approved'),
      supabase.from('learning_references').select('id', { count: 'exact', head: true }).eq('source_type', 'community').eq('status', 'pending'),
    ])
    if (referenceResult.error) setError(referenceResult.error.message)
    else setRows((referenceResult.data ?? []) as ReferenceRow[])
    setPatternsCount(patternResult.count ?? 0)
    setPendingCount(pendingResult.count ?? 0)
    setLoadingRows(false)
  }, [isAdmin])

  const loadGlobalDna = useCallback(async () => {
    if (!supabase || !isAdmin) return
    const [sourceResult, profileResult] = await Promise.all([
      supabase.from('global_dna_sources').select('id,position,title,source_text').order('position', { ascending: true }),
      supabase.from('global_style_profiles').select('id,version,profile,source_count,status,created_at,activated_at').order('version', { ascending: false }).limit(6),
    ])
    if (sourceResult.error) setError(sourceResult.error.message)
    else {
      const saved = (sourceResult.data ?? []) as GlobalDnaSourceRow[]
      setDnaSources(emptyDnaSources().map((fallback) => saved.find((row) => row.position === fallback.position) ?? fallback))
    }
    if (profileResult.error) setError(profileResult.error.message)
    else setDnaProfiles((profileResult.data ?? []) as GlobalDnaVersionRow[])
  }, [isAdmin])

  useEffect(() => { void loadDashboard() }, [loadDashboard])
  useEffect(() => { void loadGlobalDna() }, [loadGlobalDna])

  function validatedDnaSourceRows() {
    if (!user?.id) {
      setError(t('admin.dnaError'))
      return null
    }
    const normalized = [...dnaSources].sort((a, b) => a.position - b.position).map((row) => ({
      position: row.position,
      title: row.title.trim(),
      source_text: row.source_text.trim(),
      created_by: user.id,
    }))
    const incomplete = normalized.findIndex((row) => !row.title || row.source_text.length < 30 || row.source_text.length > 5000)
    if (incomplete >= 0) {
      setError(t('admin.dnaValidationSource', { number: incomplete + 1 }))
      return null
    }
    const totalChars = normalized.reduce((sum, row) => sum + row.source_text.length, 0)
    if (totalChars > 30000) {
      setError(t('admin.dnaValidationTotal'))
      return null
    }
    return normalized
  }

  async function persistDnaSources() {
    if (!supabase || !user) return false
    const normalized = validatedDnaSourceRows()
    if (!normalized) return false
    const { error: saveError } = await supabase.from('global_dna_sources').upsert(normalized, { onConflict: 'position' })
    if (saveError) throw saveError
    return true
  }

  async function saveDnaSources() {
    setDnaBusy(true)
    setError('')
    setSuccess('')
    try {
      if (!await persistDnaSources()) return
      setSuccess(t('admin.dnaSourcesSaved'))
      await loadGlobalDna()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('admin.dnaError'))
    } finally {
      setDnaBusy(false)
    }
  }

  async function buildDnaDraft() {
    if (!session) return
    setDnaBusy(true)
    setError('')
    setSuccess('')
    try {
      if (!await persistDnaSources()) return
      const response = await fetch('/api/learning/dna/build', {
        method: 'POST',
        headers: { authorization: `Bearer ${session.access_token}` },
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(body?.code || `dna_build_failed_${response.status}`)
      setSuccess(t('admin.dnaDraftCreated', { version: body.version }))
      await loadGlobalDna()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('admin.dnaError'))
    } finally {
      setDnaBusy(false)
    }
  }

  async function activateDnaVersion(profile: GlobalDnaVersionRow) {
    if (!session || !window.confirm(t('admin.dnaActivateConfirm', { version: profile.version }))) return
    setDnaBusy(true)
    setError('')
    setSuccess('')
    try {
      const response = await fetch('/api/learning/dna/activate', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ profileId: profile.id }),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(body?.code || `dna_activation_failed_${response.status}`)
      setSuccess(t('admin.dnaActivated', { version: profile.version }))
      await loadGlobalDna()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('admin.dnaError'))
    } finally {
      setDnaBusy(false)
    }
  }

  async function analyzeAndPublish(reference: ReferenceRow) {
    if (!supabase || !session) return
    setBusyId(reference.id)
    setError('')
    setSuccess('')
    try {
      const response = await fetch('/api/learning/analyze', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          scope: 'global', title: reference.title, sourceUrl: reference.source_url ?? '',
          referenceText: reference.reference_text ?? '', platform: reference.platform, category: reference.category,
        }),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(body?.code || `analysis_failed_${response.status}`)
      const analysis = body as Analysis
      if (analysis.source_status === 'url_unavailable' && !reference.reference_text?.trim()) {
        throw new Error(t('admin.errorUrlUnavailable'))
      }

      const { error: patternError } = await supabase.from('learning_patterns').upsert({
        reference_id: reference.id, user_id: null, scope: 'global', status: 'approved',
        title: reference.title, platform: reference.platform, category: reference.category,
        pattern: analysis, quality_score: analysis.quality_score,
      }, { onConflict: 'reference_id,scope' })
      if (patternError) throw patternError

      const { error: updateError } = await supabase.from('learning_references').update({ status: 'approved', analyzed_at: new Date().toISOString() }).eq('id', reference.id)
      if (updateError) throw updateError
      setSuccess(t('admin.successPublished', { title: reference.title }))
      await loadDashboard()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('admin.errorAnalysis'))
    } finally {
      setBusyId(null)
    }
  }

  async function rejectReference(reference: ReferenceRow) {
    if (!supabase) return
    setBusyId(reference.id)
    const { error: updateError } = await supabase.from('learning_references').update({ status: 'rejected' }).eq('id', reference.id)
    if (updateError) setError(updateError.message)
    else setSuccess(t('admin.successRejected', { title: reference.title }))
    setBusyId(null)
    await loadDashboard()
  }

  async function deleteReference(reference: ReferenceRow) {
    if (!supabase || !window.confirm(t('admin.deleteReferenceConfirm', { title: reference.title }))) return
    const { error: deleteError } = await supabase.from('learning_references').delete().eq('id', reference.id)
    if (deleteError) setError(deleteError.message)
    else setSuccess(t('admin.successDeleted', { title: reference.title }))
    await loadDashboard()
  }

  async function saveReferenceText(referenceId: string, referenceText: string) {
    if (!supabase) return
    const { error: updateError } = await supabase.from('learning_references')
      .update({ reference_text: referenceText.trim() || null })
      .eq('id', referenceId)
    if (updateError) setError(updateError.message)
    else {
      setSuccess(t('admin.successUpdated'))
      await loadDashboard()
    }
  }

  async function addDeveloperReference(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || !user) return
    if (!form.sourceUrl.trim() && !form.referenceText.trim()) {
      setError(t('admin.errorNeedContent'))
      return
    }
    setBusyId('new')
    setError('')
    try {
      const { data, error: insertError } = await supabase.from('learning_references').insert({
        submitted_by: user.id, source_type: 'developer', status: 'pending',
        title: form.title.trim() || t('admin.referenceTitle'), source_url: form.sourceUrl.trim() || null,
        platform: form.platform, category: form.category, reference_text: form.referenceText.trim() || null,
        consent_to_global: true,
      }).select('*').single()
      if (insertError) throw insertError
      setForm(emptyForm)
      setShowForm(false)
      await analyzeAndPublish(data as ReferenceRow)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('admin.errorAdd'))
      setBusyId(null)
    }
  }

  const approvedRows = useMemo(() => rows.filter((row) => row.status === 'approved'), [rows])
  const pendingRows = useMemo(() => rows.filter((row) => row.status === 'pending'), [rows])

  if (!configured) {
    return <AdminShell><StateCard title={t('admin.notConfiguredTitle')} body={t('admin.notConfiguredBody')} /></AdminShell>
  }

  if (loading || (session && adminLoading)) return <AdminShell><StateCard title={t('admin.checkingAccess')} body="" /></AdminShell>

  if (!session) {
    return <AdminShell><StateCard title={t('admin.loginTitle')} body={t('admin.loginBody')} action={<button type="button" onClick={() => void signInWithGoogle()} className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl bg-primary px-4 font-semibold text-on-primary transition-colors hover:bg-primary-hover"><LogIn className="size-4"/> {t('admin.loginAction')}</button>} /></AdminShell>
  }

  if (!isAdmin) {
    return <AdminShell><StateCard title={t('admin.noPermissionTitle')} body={t('admin.noPermissionBody', { email: user?.email ?? '' })} action={<div className="flex flex-wrap gap-2"><button onClick={() => void refreshAdmin()} className="cursor-pointer rounded-xl border border-border px-4 py-2 text-sm font-semibold">{t('admin.checkPermission')}</button><button onClick={() => void signOut()} className="cursor-pointer rounded-xl border border-border px-4 py-2 text-sm font-semibold"><LogOut className="mr-2 inline size-4"/>{t('admin.signOut')}</button></div>} /></AdminShell>
  }

  return (
    <AdminShell>
      <header className="mb-7 flex flex-wrap items-center justify-between gap-3">
        <div><div className="mb-1 flex items-center gap-2 text-primary"><ShieldCheck className="size-5"/><span className="text-xs font-bold uppercase tracking-wider">{t('admin.console')}</span></div><h1 className="text-2xl font-bold text-foreground sm:text-3xl">{t('admin.title')}</h1><p className="mt-1 text-sm text-muted-foreground">{t('admin.subtitle')}</p></div>
        <div className="flex items-center gap-2"><button onClick={() => { void loadDashboard(); void loadGlobalDna() }} className="inline-flex size-10 cursor-pointer items-center justify-center rounded-xl border border-border bg-card text-foreground transition-colors hover:bg-muted" title={t('admin.refresh')}><RefreshCw className="size-4"/></button><button onClick={() => void signOut()} className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted"><LogOut className="size-4"/>{t('admin.signOut')}</button></div>
      </header>

      {error && <div role="alert" className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
      {success && <div role="status" className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700">{success}</div>}

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Metric icon={<BookOpen className="size-5"/>} label={t('admin.globalPatterns')} value={patternsCount}/>
        <Metric icon={<RefreshCw className="size-5"/>} label={t('admin.pendingReview')} value={pendingCount}/>
        <Metric icon={<Check className="size-5"/>} label={t('admin.approvedSources')} value={approvedRows.length}/>
      </div>

      <section className="mb-8 space-y-4 rounded-2xl border border-primary/25 bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-2 text-primary"><Sparkles className="size-5"/><span className="text-xs font-bold uppercase tracking-wider">{t('admin.dnaEyebrow')}</span></div>
            <h2 className="text-xl font-bold">{t('admin.dnaTitle')}</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">{t('admin.dnaDescription')}</p>
          </div>
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">{t('admin.dnaGlobalBadge')}</span>
        </div>
        <div className="rounded-xl border border-border bg-background p-3 text-sm leading-6 text-muted-foreground">{t('admin.dnaOwnershipNote')}</div>
        <div className="grid gap-3 lg:grid-cols-2">
          {dnaSources.map((source) => (
            <label key={source.position} className="block rounded-xl border border-border bg-background p-3">
              <span className="mb-2 block text-sm font-semibold">{t('admin.dnaPostLabel', { number: source.position })}</span>
              <input value={source.title} onChange={(event) => setDnaSources((old) => old.map((row) => row.position === source.position ? { ...row, title: event.target.value } : row))} maxLength={120} className="mb-2 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm" placeholder={t('admin.dnaPostTitlePlaceholder', { number: source.position })}/>
              <textarea value={source.source_text} onChange={(event) => setDnaSources((old) => old.map((row) => row.position === source.position ? { ...row, source_text: event.target.value } : row))} maxLength={5000} rows={5} className="w-full resize-y rounded-lg border border-border bg-card px-3 py-2 text-sm leading-6" placeholder={t('admin.dnaPostTextPlaceholder')}/>
              <div className="mt-1 text-right text-[11px] text-muted-foreground">{source.source_text.length.toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US')}/5,000</div>
            </label>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <p className="max-w-xl text-xs leading-5 text-muted-foreground">{t('admin.dnaInputHint')}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={dnaBusy} onClick={() => void saveDnaSources()} className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50">{dnaBusy ? <LoaderCircle className="size-4 animate-spin"/> : <Save className="size-4"/>}{t('admin.dnaSaveSources')}</button>
            <button type="button" disabled={dnaBusy} onClick={() => void buildDnaDraft()} className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-on-primary transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50">{dnaBusy ? <LoaderCircle className="size-4 animate-spin"/> : <Sparkles className="size-4"/>}{t('admin.dnaBuildDraft')}</button>
          </div>
        </div>
        <div className="space-y-3 border-t border-border pt-4">
          <div><h3 className="text-sm font-bold">{t('admin.dnaVersionsTitle')}</h3><p className="text-xs text-muted-foreground">{t('admin.dnaVersionsHint')}</p></div>
          {dnaProfiles.length === 0 ? <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">{t('admin.dnaNoVersions')}</p> : dnaProfiles.map((profile) => (
            <article key={profile.id} className="rounded-xl border border-border bg-background p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2"><span className="font-semibold">{t('admin.dnaVersion', { version: profile.version })}</span><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${profile.status === 'active' ? 'bg-emerald-500/10 text-emerald-700' : profile.status === 'draft' ? 'bg-amber-500/10 text-amber-700' : 'bg-muted text-muted-foreground'}`}>{t(`admin.dnaStatus.${profile.status}` as TranslationKey)}</span></div>
                <div className="flex items-center gap-2">{profile.status !== 'active' && <button type="button" disabled={dnaBusy} onClick={() => void activateDnaVersion(profile)} className="inline-flex min-h-9 cursor-pointer items-center gap-1 rounded-lg bg-primary px-3 text-xs font-semibold text-on-primary hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"><Check className="size-3"/>{t('admin.dnaActivate')}</button>}</div>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{new Date(profile.created_at).toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US')} · {t('admin.dnaSourceCount', { count: profile.source_count })}</p>
              <DnaProfilePreview profile={profile.profile} />
            </article>
          ))}
        </div>
      </section>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-bold text-foreground">{t('admin.referencesTitle')}</h2><p className="text-sm text-muted-foreground">{t('admin.referencesSubtitle')}</p></div><button onClick={() => setShowForm((value) => !value)} className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-on-primary transition-colors hover:bg-primary-hover"><Plus className="size-4"/> {t('admin.addReference')}</button></div>

      {showForm && <form onSubmit={(event) => void addDeveloperReference(event)} className="mb-6 grid gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-2">
        <label className="space-y-1 text-sm font-medium sm:col-span-2">{t('admin.referenceTitle')}<input value={form.title} onChange={(event) => setForm((old) => ({ ...old, title: event.target.value }))} maxLength={120} className="w-full rounded-xl border border-border bg-background px-3 py-2.5 font-normal" placeholder={t('admin.referenceTitlePlaceholder')}/></label>
        <label className="space-y-1 text-sm font-medium sm:col-span-2">{t('admin.referenceUrl')}<input type="url" value={form.sourceUrl} onChange={(event) => setForm((old) => ({ ...old, sourceUrl: event.target.value }))} maxLength={2048} className="w-full rounded-xl border border-border bg-background px-3 py-2.5 font-normal" placeholder="https://..."/></label>
        <label className="space-y-1 text-sm font-medium">{t('admin.platform')}<select value={form.platform} onChange={(event) => setForm((old) => ({ ...old, platform: event.target.value }))} className="w-full rounded-xl border border-border bg-background px-3 py-2.5 font-normal"><option value="instagram">Instagram</option><option value="tiktok">TikTok</option><option value="facebook">Facebook</option><option value="x">X</option><option value="all">{t('admin.platformAll')}</option></select></label>
        <label className="space-y-1 text-sm font-medium">{t('admin.category')}<select value={form.category} onChange={(event) => setForm((old) => ({ ...old, category: event.target.value }))} className="w-full rounded-xl border border-border bg-background px-3 py-2.5 font-normal"><option value="general">{t('community.category.general')}</option><option value="beauty">{t('community.category.beauty')}</option><option value="fashion">{t('community.category.fashion')}</option><option value="food">{t('community.category.food')}</option><option value="technology">{t('community.category.technology')}</option><option value="lifestyle">{t('community.category.lifestyle')}</option><option value="education">{t('community.category.education')}</option></select></label>
        <label className="space-y-1 text-sm font-medium sm:col-span-2">{t('admin.referenceContent')}<textarea value={form.referenceText} onChange={(event) => setForm((old) => ({ ...old, referenceText: event.target.value }))} maxLength={12000} rows={5} className="w-full rounded-xl border border-border bg-background px-3 py-2.5 font-normal" placeholder={t('admin.referenceContentPlaceholder')}/></label>
        <div className="flex flex-wrap gap-2 sm:col-span-2"><button type="submit" disabled={busyId === 'new'} className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-on-primary transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50">{busyId === 'new' ? <LoaderCircle className="size-4 animate-spin"/> : <Sparkles className="size-4"/>}{t('admin.analyzePublish')}</button><button type="button" onClick={() => setShowForm(false)} className="cursor-pointer rounded-xl border border-border px-4 text-sm font-semibold hover:bg-muted">{t('admin.cancel')}</button></div>
      </form>}

      <section className="space-y-3">
        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">{t('admin.pendingSection', { count: pendingRows.length })}</h3>
        {loadingRows ? <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin"/>{t('admin.loading')}</div> : pendingRows.length === 0 ? <div className="rounded-2xl border border-dashed border-border p-7 text-center text-sm text-muted-foreground">{t('admin.emptyPending')}</div> : pendingRows.map((row) => <ReferenceCard key={row.id} row={row} busy={busyId === row.id} onApprove={() => void analyzeAndPublish(row)} onReject={() => void rejectReference(row)} onSaveText={(value) => saveReferenceText(row.id, value)}/>)}
      </section>
      <section className="mt-8 space-y-3">
        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">{t('admin.approvedRecent', { count: approvedRows.length })}</h3>
        {approvedRows.slice(0, 20).map((row) => <ReferenceCard key={row.id} row={row} busy={false} readOnly onDelete={() => void deleteReference(row)}/>)}
      </section>
    </AdminShell>
  )
}

function DnaProfilePreview({ profile }: { profile: GlobalDnaProfile }) {
  const { t } = useLanguage()
  const fields: Array<[string, string | string[]]> = [
    [t('admin.dnaFieldVoice'), profile.brand_voice],
    [t('admin.dnaFieldHooks'), profile.hook_patterns],
    [t('admin.dnaFieldRhythm'), profile.rhythm_and_structure],
    [t('admin.dnaFieldEmoji'), profile.emoji_style],
    [t('admin.dnaFieldPersuasion'), profile.persuasion_patterns],
    [t('admin.dnaFieldCta'), profile.cta_style],
    [t('admin.dnaFieldWords'), profile.wording_preferences],
    [t('admin.dnaFieldDo'), profile.do_rules],
    [t('admin.dnaFieldAvoid'), profile.avoid_rules],
  ]
  return <details className="mt-3 rounded-lg border border-border bg-card px-3 py-2"><summary className="cursor-pointer text-xs font-semibold text-primary">{t('admin.dnaPreview')}</summary><div className="mt-3 space-y-3">{fields.map(([label, value]) => <div key={label}><h4 className="mb-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{label}</h4>{Array.isArray(value) ? <ul className="list-disc space-y-1 pl-4 text-xs leading-5 text-foreground">{value.map((item) => <li key={item}>{item}</li>)}</ul> : <p className="whitespace-pre-wrap text-xs leading-5 text-foreground">{value}</p>}</div>)}</div></details>
}

function AdminShell({ children }: { children: ReactNode }) {
  return <main className="min-h-screen bg-background px-4 py-6 text-foreground sm:px-6"><div className="mx-auto max-w-5xl">{children}</div></main>
}
function StateCard({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  const { t } = useLanguage()
  return <section className="mx-auto mt-16 max-w-lg rounded-2xl border border-border bg-card p-6 text-center shadow-sm"><ShieldCheck className="mx-auto mb-3 size-9 text-primary"/><h1 className="text-xl font-bold">{title}</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>{action && <div className="mt-5 flex justify-center">{action}</div>}<a href="/" className="mt-5 inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-primary"><ArrowLeft className="size-4"/>{/* use the active interface language */} {t('admin.backToApp')}</a></section>
}
function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return <div className="rounded-2xl border border-border bg-card p-4"><div className="mb-3 text-primary">{icon}</div><div className="text-2xl font-bold tabular-nums">{value}</div><div className="text-xs text-muted-foreground">{label}</div></div>
}
function ReferenceCard({ row, busy, onApprove, onReject, onSaveText, onDelete, readOnly = false }: { row: ReferenceRow; busy: boolean; onApprove?: () => void; onReject?: () => void; onSaveText?: (value: string) => void; onDelete?: () => void; readOnly?: boolean }) {
  const { t, language } = useLanguage()
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(row.reference_text ?? '')
  const categoryKeys: Record<string, TranslationKey> = {
    general: 'community.category.general', beauty: 'community.category.beauty',
    fashion: 'community.category.fashion', food: 'community.category.food',
    technology: 'community.category.technology', lifestyle: 'community.category.lifestyle',
    education: 'community.category.education',
  }
  const statusKey = `admin.status.${row.status}` as TranslationKey
  return <article className="rounded-2xl border border-border bg-card p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><div className="mb-1 flex flex-wrap items-center gap-2"><h4 className="font-semibold">{row.title}</h4><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${row.source_type === 'developer' ? 'bg-blue-500/10 text-blue-600' : 'bg-emerald-500/10 text-emerald-600'}`}>{row.source_type === 'developer' ? t('admin.sourceDeveloper') : row.source_type === 'community' ? t('community.community') : t('community.personal')}</span><span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">{row.platform} · {categoryKeys[row.category] ? t(categoryKeys[row.category]) : row.category}</span></div><p className="text-xs text-muted-foreground">{new Date(row.created_at).toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US')} · {t(statusKey)}</p>{row.source_url && <a href={row.source_url} target="_blank" rel="noreferrer" className="mt-2 inline-flex max-w-full items-center gap-1 truncate text-xs text-primary"><ExternalLink className="size-3 shrink-0"/>{row.source_url}</a>}{row.reference_text && <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm text-muted-foreground">{row.reference_text}</p>}
        {!readOnly && onSaveText && <div className="mt-2">{editing ? <div className="space-y-2"><textarea value={text} onChange={(event) => setText(event.target.value)} maxLength={12000} rows={4} className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" placeholder={t('community.contentPlaceholder')}/><div className="flex gap-2"><button type="button" onClick={() => { onSaveText(text); setEditing(false) }} className="cursor-pointer rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-on-primary transition-colors hover:bg-primary-hover">{t('admin.saveContent')}</button><button type="button" onClick={() => setEditing(false)} className="cursor-pointer rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-muted">{t('admin.cancel')}</button></div></div> : <button type="button" onClick={() => setEditing(true)} className="cursor-pointer text-xs font-semibold text-primary">{row.reference_text ? t('admin.editReference') : t('admin.addReferenceContent')}</button>}</div>}
      </div>{readOnly && onDelete && <button type="button" onClick={onDelete} className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-destructive" title={t('admin.deleteReferenceTitle')}><X className="size-4"/></button>}{!readOnly && <div className="flex shrink-0 flex-wrap gap-2"><button type="button" disabled={busy} onClick={onApprove} className="inline-flex min-h-9 cursor-pointer items-center gap-1 rounded-lg bg-primary px-3 text-xs font-semibold text-on-primary transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50">{busy ? <LoaderCircle className="size-3 animate-spin"/> : <Check className="size-3"/>}{t('admin.approve')}</button><button type="button" disabled={busy} onClick={onReject} className="inline-flex min-h-9 cursor-pointer items-center gap-1 rounded-lg border border-border px-3 text-xs font-semibold text-muted-foreground hover:bg-muted disabled:cursor-not-allowed"><X className="size-3"/>{t('admin.reject')}</button></div>}</div></article>
}
