// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import EntryDeskIntro from '../src/components/EntryDeskIntro.jsx';

const COPY = {
  greeting: 'Welcome, {name}',
  role: 'Architect',
  body: 'Turn any idea into a deliverable — pitch below or pick an assignment.'
};

describe('EntryDeskIntro', () => {
  afterEach(() => cleanup());

  it('renders personalized greeting, role, and body copy', () => {
    render(<EntryDeskIntro copy={COPY} userName="Gavin" role="Architect" />);
    expect(screen.getByTestId('entry-desk-intro')).toBeTruthy();
    expect(screen.getByText(/Welcome, Gavin/)).toBeTruthy();
    expect(screen.getByText(/Architect/)).toBeTruthy();
    expect(screen.getByText(COPY.body)).toBeTruthy();
  });

  it('renders nothing when copy is missing', () => {
    const { container } = render(<EntryDeskIntro copy={null} userName="Gavin" />);
    expect(container.firstChild).toBeNull();
  });
});
