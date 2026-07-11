import { Component } from 'react';
import { DEFAULT_UI_LOCALE } from '@archislop/shared';
import { getUiLocaleBundle } from '../i18n/getUiLocaleBundle.js';
import { readStoredUiLocale } from '../i18n/uiLocaleStorage.js';

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
    const { controls } = getUiLocaleBundle(readStoredUiLocale() ?? DEFAULT_UI_LOCALE);
    const appErrorCopy = controls.appError;

    return (
      <div
        className="app-error-boundary-overlay"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="app-error-boundary-title"
      >
        <div className="app-error-boundary-card">
          <h2 id="app-error-boundary-title" className="app-error-boundary-title">
            {appErrorCopy.title}
          </h2>
          <p className="app-error-boundary-explainer">{appErrorCopy.body}</p>
          <p className="app-error-boundary-message" data-testid="app-error-boundary-message">
            {message}
          </p>
          <div className="app-error-boundary-actions">
            <button
              type="button"
              className="app-error-boundary-reload"
              onClick={this.handleReload}
              data-testid="app-error-boundary-reload"
            >
              {appErrorCopy.reload}
            </button>
          </div>
          {stack || componentStack ? (
            <details className="app-error-boundary-details">
              <summary>{controls.errors.details}</summary>
              {stack ? <pre className="app-error-boundary-stack">{stack}</pre> : null}
              {componentStack ? (
                <pre className="app-error-boundary-stack">{componentStack}</pre>
              ) : null}
            </details>
          ) : null}
        </div>
      </div>
    );
  }
}
