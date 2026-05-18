// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import AppErrorBoundary from '../src/components/AppErrorBoundary.jsx';

function Boom({ message = 'kaboom' }) {
  throw new Error(message);
}

describe('AppErrorBoundary', () => {
  let consoleErrorSpy;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    consoleErrorSpy.mockRestore();
  });

  it('renders children when nothing throws', () => {
    render(
      <AppErrorBoundary>
        <p>healthy</p>
      </AppErrorBoundary>
    );
    expect(screen.getByText('healthy')).toBeTruthy();
  });

  it('catches a render-time error and shows the fallback card', () => {
    render(
      <AppErrorBoundary>
        <Boom message="render fail" />
      </AppErrorBoundary>
    );
    expect(screen.getByText('Something went wrong')).toBeTruthy();
    expect(screen.getByTestId('app-error-boundary-message').textContent).toContain('render fail');
    expect(screen.getByTestId('app-error-boundary-reload')).toBeTruthy();
  });

  it('reload button calls window.location.reload', () => {
    const originalLocation = window.location;
    const reload = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, reload }
    });
    try {
      render(
        <AppErrorBoundary>
          <Boom />
        </AppErrorBoundary>
      );
      fireEvent.click(screen.getByTestId('app-error-boundary-reload'));
      expect(reload).toHaveBeenCalledTimes(1);
    } finally {
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: originalLocation
      });
    }
  });
});
