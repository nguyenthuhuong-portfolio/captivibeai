import { FileText, Sparkles } from 'lucide-react'
import { useLanguage } from '../hooks/useLanguage'

type WorkspaceSection = 'inputs' | 'results'

interface WorkspaceTabsProps {
  value: WorkspaceSection
  onChange: (value: WorkspaceSection) => void
  hasResults: boolean
}

/** A single, predictable workspace switcher shared by desktop and mobile. */
export function WorkspaceTabs({ value, onChange, hasResults }: WorkspaceTabsProps) {
  const { t } = useLanguage()

  return (
    <div
      className="mx-auto flex w-full max-w-xl items-center gap-1 rounded-2xl border border-border/70 bg-card/90 p-1.5 shadow-sm"
      role="tablist"
      aria-label={t('workspace.sections')}
    >
      <button
        type="button"
        role="tab"
        id="workspace-tab-inputs"
        aria-selected={value === 'inputs'}
        aria-controls="workspace-panel-inputs"
        onClick={() => onChange('inputs')}
        className={`inline-flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
          value === 'inputs'
            ? 'bg-primary text-on-primary shadow-sm'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
        }`}
      >
        <FileText className="size-4" aria-hidden="true" />
        {t('workspace.inputs')}
      </button>
      <button
        type="button"
        role="tab"
        id="workspace-tab-results"
        aria-selected={value === 'results'}
        aria-controls="workspace-panel-results"
        onClick={() => onChange('results')}
        className={`relative inline-flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
          value === 'results'
            ? 'bg-primary text-on-primary shadow-sm'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
        }`}
      >
        <Sparkles className="size-4" aria-hidden="true" />
        {t('workspace.results')}
        {hasResults && <span className="size-1.5 rounded-full bg-emerald-500" aria-label={t('workspace.hasResults')} />}
      </button>
    </div>
  )
}
