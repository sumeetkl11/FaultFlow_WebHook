'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  componentName?: string;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught in component:', this.props.componentName || 'Component', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="rounded-xl border border-rose-800/60 bg-rose-950/40 p-5 text-slate-200 backdrop-blur-md shadow-lg">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-rose-500/20 text-rose-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white">
                {this.props.componentName ? `${this.props.componentName} Failed to Render` : 'Component Error'}
              </h4>
              <p className="text-xs text-rose-300/80 mt-0.5">
                {this.state.error?.message || 'A malformed telemetry frame or rendering exception occurred.'}
              </p>
            </div>
          </div>
          <button
            onClick={this.handleReset}
            className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-900/60 hover:bg-rose-800 text-xs font-medium text-white transition border border-rose-700/50"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reset Component</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
