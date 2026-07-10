import React from 'react';

// Minimal error boundary so a render crash shows a message instead of a blank
// screen (and so we never ship a silent white-out).
export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('[SABD] render error', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            padding: 24,
            fontFamily: 'monospace',
            fontSize: 13,
            color: '#E4573D',
            background: '#171A24',
            minHeight: '100dvh',
            whiteSpace: 'pre-wrap',
          }}
        >
          SABD crashed: {this.state.error.message}
          {'\n\n'}
          {this.state.error.stack}
        </div>
      );
    }
    return this.props.children;
  }
}
