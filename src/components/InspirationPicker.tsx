import { useEffect, useMemo, useState } from 'react'
import { Check, LoaderCircle, Sparkles, X } from 'lucide-react'
import { useLanguage } from '../hooks/useLanguage'
import { supabase } from '../lib/supabase'
import type { PreviewPlatform, ProductForm } from '../types'

interface InspirationRow {
  id: string
  title: string
  platform: string
  category: string
  quality_score: number | null
  pattern: Record<string, unknown>
}

interface Props {
  selectedIds: string[]
  onChange: (ids: string[]) => void
  form: ProductForm
  platform: PreviewPlatform
}

const CATEGORY_TERMS: Record<string, string[]> = {
  beauty: ['mỹ phẩm', 'serum', 'kem dưỡng', 'skincare', 'son', 'makeup', 'beauty'],
  fashion: ['quần áo', 'áo', 'váy', 'giày', 'túi', 'thời trang', 'fashion'],
  food: ['đồ ăn', 'món ăn', 'nhà hàng', 'cafe', 'cà phê', 'food'],
  technology: ['điện thoại', 'laptop', 'máy tính', 'tai nghe', 'công nghệ', 'tech'],
  education: ['khóa học', 'học tập', 'ielts', 'giáo dục', 'education'],
  lifestyle: ['lifestyle', 'gia dụng', 'trang trí', 'nội thất'],
}

function patternSummary(pattern: Record<string, unknown>) {
  const value = pattern.recommended_style || pattern.summary
  return typeof value === 'string' ? value : ''
}

export function InspirationPicker({ selectedIds, onChange, form, platform }: Props) {
  const { t } = useLanguage()
  const [rows, setRows] = useState<InspirationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    let active = true
    if (!supabase) {
      setLoading(false)
      setFailed(true)
      return
    }
    void supabase
      .from('learning_patterns')
      .select('id,title,platform,category,quality_score,pattern')
      .eq('scope', 'global')
      .eq('status', 'approved')
      .order('quality_score', { ascending: false, nullsFirst: false })
      .limit(30)
      .then(({ data, error }) => {
        if (!active) return
        setFailed(Boolean(error))
        setRows(error ? [] : (data ?? []) as InspirationRow[])
        setLoading(false)
      })
    return () => { active = false }
  }, [])

  const rankedRows = useMemo(() => {
    const brief = `${form.productName} ${form.description} ${form.customAudience ?? ''}`.toLocaleLowerCase()
    return [...rows].sort((a, b) => {
      const score = (row: InspirationRow) => {
        const platformFit = row.platform === platform ? 5 : row.platform === 'all' ? 2 : 0
        const categoryFit = (CATEGORY_TERMS[row.category] ?? []).some((term) => brief.includes(term)) ? 3 : 0
        return platformFit + categoryFit + (row.quality_score ?? 0) / 100
      }
      return score(b) - score(a)
    })
  }, [rows, form.productName, form.description, form.customAudience, platform])

  function toggle(id: string) {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((item) => item !== id))
      return
    }
    if (selectedIds.length >= 2) return
    onChange([...selectedIds, id])
  }

  function autoPick() {
    const next = rankedRows
      .filter((row) => row.platform === platform || row.platform === 'all')
      .slice(0, 2)
      .map((row) => row.id)
    onChange(next.length ? next : rankedRows.slice(0, 2).map((row) => row.id))
  }

  const visibleRows = expanded ? rankedRows : rankedRows.slice(0, 5)

  return (
    <section className="rounded-2xl border border-border bg-card/70 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Sparkles className="size-4 text-primary" aria-hidden="true" />
            {t('inspiration.title')}
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">{selectedIds.length}/2</span>
          </div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{t('inspiration.hint')}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button type="button" onClick={autoPick} disabled={loading || rows.length === 0} className="inline-flex min-h-8 items-center gap-1 rounded-lg bg-primary/10 px-2.5 text-xs font-semibold text-primary hover:bg-primary/15 disabled:opacity-50">
            <Sparkles className="size-3.5" />{t('inspiration.autoPick')}
          </button>
          {selectedIds.length > 0 && <button type="button" onClick={() => onChange([])} className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-xs font-semibold text-muted-foreground hover:bg-muted"><X className="size-3.5" />{t('inspiration.clear')}</button>}
        </div>
      </div>

      {loading ? (
        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"><LoaderCircle className="size-3.5 animate-spin" />{t('inspiration.loading')}</div>
      ) : failed ? (
        <p className="mt-3 text-xs text-muted-foreground">{t('inspiration.unavailable')}</p>
      ) : rows.length === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed border-border p-3 text-xs leading-5 text-muted-foreground">{t('inspiration.empty')}</p>
      ) : (
        <div className="mt-3 space-y-2">
          {visibleRows.map((row) => {
            const selected = selectedIds.includes(row.id)
            const disabled = !selected && selectedIds.length >= 2
            return (
              <button key={row.id} type="button" aria-pressed={selected} disabled={disabled} onClick={() => toggle(row.id)} className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors ${selected ? 'border-primary bg-primary/5' : 'border-border bg-background hover:border-primary/40'} disabled:cursor-not-allowed disabled:opacity-45`}>
                <span className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border ${selected ? 'border-primary bg-primary text-on-primary' : 'border-border bg-card'}`}>{selected && <Check className="size-3.5" />}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-foreground">{row.title}</span>
                  <span className="mt-0.5 block text-[11px] text-muted-foreground">{row.platform} · {row.category}</span>
                  {patternSummary(row.pattern) && <span className="mt-1 block line-clamp-2 text-xs leading-5 text-muted-foreground">{patternSummary(row.pattern)}</span>}
                </span>
                {selected && <span className="shrink-0 text-[10px] font-bold uppercase text-primary">{t('inspiration.selected')}</span>}
              </button>
            )
          })}
          {rankedRows.length > 5 && <button type="button" onClick={() => setExpanded((value) => !value)} className="w-full py-1 text-xs font-semibold text-primary">{expanded ? t('inspiration.showLess') : t('inspiration.showMore', { count: rankedRows.length - 5 })}</button>}
        </div>
      )}
    </section>
  )
}
