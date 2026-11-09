import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { AlertTriangle, RotateCw } from 'lucide-react'
import { useLanguage } from '../hooks/useLanguage'

interface ErrorBoundaryProps {
  children: ReactNode
  title: string
  body: string
  reloadLabel: string
}

interface ErrorBoundaryState {
  crashed: boolean
}

/**
 * The last line of defence: one broken component costs its own subtree, not the whole app.
 *
 * The fallback is deliberately plain and honest — an explanation, a note that the history lives in
 * storage rather than in this tree, and a way out. The failure itself goes to the console for a
 * developer and never to the screen, so no stack trace or internal detail is ever shown to a user.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { crashed: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { crashed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[captivibe] a component crashed', error, info.componentStack)
  }

  render() {
    if (!this.state.crashed) return this.props.children

    return (
      <div className="app-shell flex min-h-screen items-center justify-center p-6">
        <div
          role="alert"
          className="glass-strong w-full max-w-md rounded-2xl p-6 text-center shadow-xl"
        >
          <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
            <AlertTriangle className="size-6" aria-hidden="true" />
          </span>
          <h1 className="mt-4 text-lg font-bold text-foreground">{this.props.title}</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{this.props.body}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-6 inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-on-primary shadow-sm transition duration-200 hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <RotateCw className="size-4" aria-hidden="true" />
            {this.props.reloadLabel}
          </button>
        </div>
      </div>
    )
  }
}

/** Reads the words from the active dictionary, so the fallback is written in the user's language. */
export function AppErrorBoundary({ children }: { children: ReactNode }) {
  const { t } = useLanguage()

  return (
    <ErrorBoundary
      title={t('crash.title')}
      body={t('crash.body')}
      reloadLabel={t('crash.reload')}
    >
      {children}
    </ErrorBoundary>
  )
}
