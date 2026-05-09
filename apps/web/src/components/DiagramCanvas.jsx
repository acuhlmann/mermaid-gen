import { useMemo } from 'react';
import mermaid from 'mermaid';

mermaid.initialize({ startOnLoad: false, theme: 'default' });

function renderSvg(source) {
  const escaped = source
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');

  return `<pre class=\"mermaid-fallback\">${escaped}</pre>`;
}

export default function DiagramCanvas({ mermaidSource, revisionId }) {
  const markup = useMemo(() => renderSvg(mermaidSource), [mermaidSource]);

  return (
    <section className="diagram-canvas">
      <header>
        <h2>Live Diagram</h2>
        <span>Revision {revisionId}</span>
      </header>
      <div className="diagram-output" dangerouslySetInnerHTML={{ __html: markup }} />
    </section>
  );
}
