'use client'

import { Component, type ReactNode } from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: React.ErrorInfo | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo)
    this.setState({ error, errorInfo })
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
    // Reload the page to reset the app state
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-4">
          <div className="flex flex-col items-center gap-4 max-w-md text-center">
            <div className="relative">
              <div className="w-20 h-20 rounded-2xl bg-red-100 flex items-center justify-center shadow-lg">
                <AlertCircle className="w-10 h-10 text-red-600" />
              </div>
            </div>
            <div className="flex flex-col items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Something went wrong</h1>
              <p className="text-sm text-gray-600">
                {this.state.error?.message || 'An unexpected error occurred'}
              </p>
              {this.state.errorInfo && (
                <details className="mt-4 text-left">
                  <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
                    View details
                  </summary>
                  <pre className="mt-2 p-4 bg-gray-100 rounded-lg text-xs text-gray-700 overflow-auto max-h-48">
                    {this.state.errorInfo.componentStack}
                  </pre>
                </details>
              )}
            </div>
            <Button 
              onClick={this.handleRetry}
              className="mt-4 bg-emerald-600 hover:bg-emerald-700"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Reload App
            </Button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
