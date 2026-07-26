/**
 * Self-contained Visitor Badge check-in HTML (no React / no SPA assets).
 */

export function renderVisitorBadgePage({ errorMessage = '' } = {}) {
  const errorHtml = errorMessage
    ? `<p class="err" role="alert">${escapeHtml(errorMessage)}</p>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Visitor Badge · ArchiSlop Corp.</title>
  <style>
    :root {
      --bg0: #1a2332;
      --bg1: #243044;
      --ink: #e8eef6;
      --muted: #9aadc4;
      --accent: #c4a35a;
      --err: #e07a6a;
      --field: #0f1620;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      font-family: "Segoe UI", system-ui, sans-serif;
      color: var(--ink);
      background:
        radial-gradient(ellipse 80% 60% at 20% 10%, #2a3d55 0%, transparent 55%),
        radial-gradient(ellipse 70% 50% at 90% 80%, #1e2a1a 0%, transparent 50%),
        linear-gradient(160deg, var(--bg0), var(--bg1));
    }
    .card {
      width: min(26rem, calc(100vw - 2rem));
      padding: 1.75rem 1.5rem 1.5rem;
      border: 1px solid rgba(196, 163, 90, 0.35);
      background: rgba(15, 22, 32, 0.72);
      backdrop-filter: blur(6px);
    }
    .eyebrow {
      margin: 0 0 0.35rem;
      font-size: 0.72rem;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--accent);
    }
    h1 {
      margin: 0 0 0.5rem;
      font-size: 1.45rem;
      font-weight: 650;
      letter-spacing: 0.02em;
    }
    .sub {
      margin: 0 0 1.25rem;
      font-size: 0.92rem;
      line-height: 1.45;
      color: var(--muted);
    }
    label {
      display: block;
      margin-bottom: 0.35rem;
      font-size: 0.8rem;
      color: var(--muted);
    }
    input[type="password"] {
      width: 100%;
      padding: 0.7rem 0.75rem;
      border: 1px solid rgba(154, 173, 196, 0.35);
      background: var(--field);
      color: var(--ink);
      font-size: 1rem;
    }
    input[type="password"]:focus {
      outline: 2px solid rgba(196, 163, 90, 0.55);
      outline-offset: 1px;
    }
    button {
      margin-top: 1rem;
      width: 100%;
      padding: 0.75rem 1rem;
      border: 1px solid var(--accent);
      background: transparent;
      color: var(--ink);
      font-size: 0.95rem;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      cursor: pointer;
    }
    button:hover { background: rgba(196, 163, 90, 0.15); }
    button:disabled { opacity: 0.55; cursor: wait; }
    .err {
      margin: 0 0 0.85rem;
      font-size: 0.88rem;
      color: var(--err);
    }
    .foot {
      margin: 1.1rem 0 0;
      font-size: 0.75rem;
      color: var(--muted);
    }
  </style>
</head>
<body>
  <main class="card">
    <p class="eyebrow">ArchiSlop Corp. · Reception</p>
    <h1>Visitor Badge</h1>
    <p class="sub">Sign in at the desk. Door codes never expire — unlike the temporary admin password from 2017.</p>
    ${errorHtml}
    <form id="badge-form" autocomplete="current-password">
      <label for="door-code">Door code</label>
      <input id="door-code" name="doorCode" type="password" required autofocus maxlength="256" />
      <button type="submit" id="submit-btn">Check in</button>
    </form>
    <p class="foot">Badge processing: 3–5 business days. Floor access is immediate if IT remembered to flip the switch.</p>
  </main>
  <script>
    const form = document.getElementById('badge-form');
    const btn = document.getElementById('submit-btn');
    const errEl = document.querySelector('.err');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      btn.disabled = true;
      try {
        const doorCode = document.getElementById('door-code').value;
        const res = await fetch('/api/visitor-badge', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ doorCode })
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          const msg = data.error || 'That door code is not on the list.';
          if (errEl) errEl.textContent = msg;
          else {
            const p = document.createElement('p');
            p.className = 'err';
            p.setAttribute('role', 'alert');
            p.textContent = msg;
            form.before(p);
          }
          btn.disabled = false;
          return;
        }
        location.assign('/');
      } catch {
        if (errEl) errEl.textContent = 'Reception phone is down. Try again.';
        btn.disabled = false;
      }
    });
  </script>
</body>
</html>`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
