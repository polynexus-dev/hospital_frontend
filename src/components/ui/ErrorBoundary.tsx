import { Component, type ErrorInfo, type ReactNode } from "react"


interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught React UI Error:", error, errorInfo)
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-page flex items-center justify-center p-6 text-center text-ink">
          <div className="bg-surface border border-border rounded-xl p-8 max-w-md shadow-2xl">
            <div className="text-3xl mb-3">⚠️</div>
            <h2 className="text-lg font-bold text-ink mb-2">Something went wrong</h2>
            <p className="text-xs text-ink-4 mb-4">
              An unexpected UI error occurred. Please refresh or click retry below.
            </p>
            {this.state.error && (
              <pre className="bg-page p-2.5 rounded text-[11px] font-mono text-danger-text overflow-x-auto mb-4 text-left max-h-32">
                {this.state.error.message}
              </pre>
            )}
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null })
                window.location.reload()
              }}
              className="w-full py-2 bg-brand text-white font-bold text-xs rounded-lg shadow-sm hover:bg-brand-strong transition-colors"
            >
              🔄 Retry & Reload Application
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
