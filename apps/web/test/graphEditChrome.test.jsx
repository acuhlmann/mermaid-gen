// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import GraphEditChrome from '../src/components/GraphEditChrome.jsx';
import { GraphEditChromeSlot } from '../src/features/shell/GraphEditChromeSlot.jsx';
import { CONTROLS_EN } from '../src/i18n/locales/controls.en.js';

function hostElement() {
  const host = document.createElement('div');
  host.className = 'diagram-output';
  document.body.appendChild(host);
  return host;
}

const NODE_ANCHOR = {
  left: 120,
  centerY: 80,
  nodeTop: 60,
  nodeBottom: 100,
  nodeLeft: 90,
  nodeRight: 150
};

describe('GraphEditChrome', () => {
  afterEach(() => {
    cleanup();
    document.body.innerHTML = '';
  });

  it('edits a new node label inline on the node, not in a distant panel', () => {
    render(
      <GraphEditChrome
        labelSession={{ kind: 'node', logicalId: 'n1', draft: 'n1', created: true }}
        labelCopy={CONTROLS_EN.graphEdit}
        toolbarAnchor={NODE_ANCHOR}
        onLabelCommit={() => {}}
        onLabelCancel={() => {}}
      />
    );

    const form = document.querySelector('.graph-edit-label-inline.is-new-node');
    expect(form).toBeTruthy();
    expect(form?.style.left).toBe('120px');
    expect(form?.style.top).toBe('80px');
    expect(screen.queryByText(CONTROLS_EN.graphEdit.nameNodeTitle)).toBeNull();
    expect(screen.getByRole('textbox', { name: CONTROLS_EN.graphEdit.nameNodeTitle })).toBeTruthy();
  });

  it('shows connect hint and undo toast without a label form', () => {
    render(
      <GraphEditChrome
        connectHint={CONTROLS_EN.graphEdit.connectHint}
        undoToast={{ message: CONTROLS_EN.graphEdit.deleted }}
        undoLabel={CONTROLS_EN.graphEdit.undo}
        onUndo={() => {}}
        onDismissUndo={() => {}}
      />
    );

    expect(screen.getByText(CONTROLS_EN.graphEdit.connectHint)).toBeTruthy();
    expect(screen.getByText(CONTROLS_EN.graphEdit.deleted)).toBeTruthy();
    expect(document.querySelector('.graph-edit-label-inline')).toBeNull();
  });

  it('waits for the node anchor before showing inline rename', () => {
    render(
      <GraphEditChrome
        labelSession={{ kind: 'node', logicalId: 'A', draft: 'Start' }}
        labelCopy={CONTROLS_EN.graphEdit}
        onLabelCommit={() => {}}
        onLabelCancel={() => {}}
      />
    );

    expect(document.querySelector('.graph-edit-label-inline')).toBeNull();
  });
});

describe('GraphEditChromeSlot', () => {
  afterEach(() => {
    cleanup();
    document.body.innerHTML = '';
  });

  it('portals graph-edit chrome into the diagram surface host', () => {
    const host = hostElement();
    const diagramSurfaceRef = { current: host };

    render(
      <GraphEditChromeSlot
        diagramSurfaceRef={diagramSurfaceRef}
        hasCanvasContent
        contentType="mermaid"
        diagramSource={'flowchart TD\nA --> B'}
        connectHint={CONTROLS_EN.graphEdit.connectHint}
        labelCopy={CONTROLS_EN.graphEdit}
        onLabelCommit={() => {}}
        onLabelCancel={() => {}}
        onUndo={() => {}}
        onDismissUndo={() => {}}
        undoLabel={CONTROLS_EN.graphEdit.undo}
      />
    );

    const hint = host.querySelector('.graph-edit-connect-hint');
    expect(hint).toBeTruthy();
    expect(hint?.textContent).toContain(CONTROLS_EN.graphEdit.connectHint);
  });

  it('portals inline label editing while fullscreen', () => {
    const host = hostElement();
    const diagramSurfaceRef = { current: host };

    render(
      <GraphEditChromeSlot
        diagramSurfaceRef={diagramSurfaceRef}
        hasCanvasContent
        contentType="mermaid"
        diagramSource={'flowchart TD\nA --> B'}
        isFullscreen
        labelSession={{ kind: 'node', logicalId: 'n1', draft: 'n1', created: true }}
        labelCopy={CONTROLS_EN.graphEdit}
        toolbarAnchor={NODE_ANCHOR}
        undoToast={{ message: CONTROLS_EN.graphEdit.linked }}
        undoLabel={CONTROLS_EN.graphEdit.undo}
        onLabelCommit={() => {}}
        onLabelCancel={() => {}}
        onUndo={() => {}}
        onDismissUndo={() => {}}
      />
    );

    const inline = host.querySelector('.graph-edit-label-inline.is-new-node');
    expect(inline).toBeTruthy();
    expect(host.querySelector('.graph-edit-chrome.is-fullscreen')).toBeTruthy();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Review' } });
    fireEvent.submit(inline);
  });
});
