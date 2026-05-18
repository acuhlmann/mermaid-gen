import { Component } from 'react';

export default class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { error, info: null };
  }

  componentDidCatch(error, info) {
    console.error('AppErrorBoundary caught error:', error, info);
    this.setState({ info });
  }

  handleReload = () => {
    if (typeof window !== 'undefined') window.location.reload();
  };

  render() {
    const { error, info } = this.state;
    if (!error) return this.props.children;

    const message = error?.message ?? String(error);
    const stack = error?.stack ?? '';
    const componentStack = info?.componentStack ?? '';

    return (
      <div className="app-error-boundary-overlay" role="alertdialog" aria-modal="true" aria-labelledby="app-error-boundary-title">
        <div className="app-error-boundary-card">
          <h2 id="app-error-boundary-title" className="app-error-boundary-title">Something went wrong</h2>
          <p className="app-error-boundary-explainer">
            The app hit an unexpected error and stopped rendering. Reload to recover.
          </p>
          <p className="app-error-boundary-message" data-testid="app-error-boundary-message">{message}</p>
          <div className="app-error-boundary-actions">
            <button
              type="button"
              className="app-error-boundary-reload"
              onClick={this.handleReload}
              data-testid="app-error-boundary-reload"
            >
              Reload app
            </button>
          </div>
          {stack || componentStack ? (
            <details className="app-error-boundary-details">
              <summary>Error details</summary>
              {stack ? <pre className="app-error-boundary-stack">{stack}</pre> : null}
              {componentStack ? <pre className="app-error-boundary-stack">{componentStack}</pre> : null}
            </details>
          ) : null}
        </div>
      </div>
    );
  }
}
