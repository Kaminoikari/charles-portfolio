// React error boundary. Without one, any uncaught render error unmounts the
// whole root and blanks the SPA — the worst outcome for a recruiter-facing
// portfolio. Used twice: once at the top level (with a reload fallback) and once
// around the chat widget (fallback=null) so a chat rendering failure degrades to
// a closed widget instead of taking down nav, pages, and content with it.

import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  // What to show when a descendant throws during render. Pass null to render
  // nothing (degrade silently); omit for the default full-screen reload panel.
  fallback?: ReactNode
}

interface State {
  hasError: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack)
  }

  render() {
    if (!this.state.hasError) return this.props.children
    if ('fallback' in this.props) return this.props.fallback
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg-primary px-6 text-center">
        <p className="font-mono text-sm text-text-secondary">Something went wrong.</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded border border-accent-mars/50 px-4 py-2 font-mono text-sm text-accent-mars transition-colors hover:bg-accent-mars/10"
        >
          Reload
        </button>
      </div>
    )
  }
}
