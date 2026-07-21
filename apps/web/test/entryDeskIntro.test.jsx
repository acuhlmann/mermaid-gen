// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import EntryDeskIntro from '../src/components/EntryDeskIntro.jsx';

const COPY = {
  greeting: 'Welcome, {name}',
  role: 'Architect',
  body: 'Your desk is command central on the floor.',
  deskGuideHeading: 'Open Your desk (the stamp below) to explore:',
  deskGuideHint: 'Grouped like your cube.',
  deskWorkOrderHint: 'Pitch in the Work order field beside Your desk.'
};

const DESK_COPY = {
  sectionSeat: 'Your seat',
  sectionGetUp: 'Get up',
  sectionUnderDesk: 'Under the desk',
  thinking: 'Open your notebook',
  inbox: 'Check your mail',
  slopChat: 'Open Slop Chat',
  im: 'Message someone',
  coffee: 'Get a coffee',
  walk: 'Walk the floor',
  settings: 'Adjust your workstation',
  hrProgress: 'Check my HR progression'
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

  it('renders the desk menu guide when showDeskGuide is set', () => {
    render(
      <EntryDeskIntro
        copy={COPY}
        userName="Alex"
        role="Architect"
        deskCopy={DESK_COPY}
        showDeskGuide
      />
    );
    expect(screen.getByTestId('entry-desk-guide')).toBeTruthy();
    expect(screen.getByText(COPY.deskGuideHeading)).toBeTruthy();
    expect(screen.getByText('Your seat')).toBeTruthy();
    expect(screen.getByText('Get up')).toBeTruthy();
    expect(screen.getByText('Under the desk')).toBeTruthy();
    expect(screen.getByText('Check your mail')).toBeTruthy();
    expect(screen.getByText(COPY.deskWorkOrderHint)).toBeTruthy();
  });

  it('renders nothing when copy is missing', () => {
    const { container } = render(<EntryDeskIntro copy={null} userName="Gavin" />);
    expect(container.firstChild).toBeNull();
  });
});
