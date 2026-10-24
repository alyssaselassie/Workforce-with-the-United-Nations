// Bias toolkit: PAUSE, CQ, principles, assumption-check worksheet and bias library.
(async function () {
  'use strict';
  const { esc } = App;
  const DRAFT_KEY = 'uncq.assumptionCheck.v1';

  let S;
  try {
    S = await App.loadScenarios();
  } catch (err) {
    App.showError(document.getElementById('toolkit-root'), err);
    return;
  }
  const F = S.frameworks;

  document.getElementById('pause-list').innerHTML = F.pause.map((p) => `
    <div class="d-flex gap-3 mb-3"><span class="pause-letter" aria-hidden="true">${p.letter}</span>
    <div><strong>${esc(p.name)}</strong><div class="small">${esc(p.text)}</div></div></div>`).join('');

  document.getElementById('cq-list').innerHTML = F.cqCapabilities.map((c) => `
    <p class="mb-2"><strong>${esc(c.name)}:</strong> <span class="small">${esc(c.question)}</span></p>`).join('');

  document.getElementById('dims-intro').textContent = F.dimensionsIntro;
  document.getElementById('dims-rule').textContent = F.dimensionsRule;
  document.getElementById('dims-grid').innerHTML = Object.entries(S.dimensions).map(([id, d]) => `
    <div class="col-md-6 col-lg-3">
      <article class="card dim-card dim-${id} h-100">
        <div class="card-body">
          <div class="dim-icon mb-2"><i class="bi ${esc(d.icon)}" aria-hidden="true"></i></div>
          <h3 class="h6 mb-1">${esc(d.label)}</h3>
          <p class="small mb-2">${esc(d.description)}</p>
          <p class="small mb-2"><strong>Ask:</strong> ${esc(d.ask)}</p>
          <ul class="small text-muted-2 ps-3 mb-0">${d.examples.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
        </div>
      </article>
    </div>`).join('');

  document.getElementById('hp-list').innerHTML = F.humanitarianPrinciples.map((h) => `
    <p class="mb-2"><strong>${esc(h.name)}:</strong> <span class="small">${esc(h.text)}</span></p>`).join('');

  // ---------- bias library ----------
  const scenarioCount = {};
  S.scenarios.forEach((s) => s.biasFocus.forEach((b) => { scenarioCount[b] = (scenarioCount[b] || 0) + 1; }));
  const grid = document.getElementById('bias-grid');
  function drawBiases(q) {
    const list = S.biases.filter((b) => !q || [b.name, b.definition, b.fieldExample].join(' ').toLowerCase().includes(q));
    grid.innerHTML = list.map((b) => `
      <div class="col-md-6 col-lg-4">
        <article class="card bias-card h-100" id="bias-${b.id}">
          <div class="card-body">
            <h3 class="mb-2">${esc(b.name)}</h3>
            <dl class="small mb-2">
              <dt>What it is</dt><dd>${esc(b.definition)}</dd>
              <dt>In the field</dt><dd>${esc(b.fieldExample)}</dd>
              <dt>Counter-strategy</dt><dd>${esc(b.counter)}</dd>
            </dl>
            ${scenarioCount[b.id] ? `<a class="small" href="scenarios.html">Practiced in ${scenarioCount[b.id]} scenario${scenarioCount[b.id] > 1 ? 's' : ''}</a>` : ''}
          </div>
        </article>
      </div>`).join('') || '<p class="text-muted-2">No biases match your search.</p>';
  }
  document.getElementById('bias-search').addEventListener('input', (e) => drawBiases(e.target.value.trim().toLowerCase()));
  drawBiases('');
  if (location.hash) {
    const target = document.querySelector(location.hash);
    if (target) {
      target.classList.add('border-primary');
      target.scrollIntoView({ block: 'center' });
    }
  }

  // ---------- assumption check ----------
  const form = document.getElementById('check-form');
  document.getElementById('ck-steps').innerHTML = F.pause.map((p, i) => `
    <div class="mb-3">
      <label class="form-label" for="ck-${i}"><span class="badge text-bg-primary me-1">${p.letter}</span> <strong>${esc(p.name)}:</strong> <span class="small text-muted-2">${esc(p.text)}</span></label>
      <textarea class="form-control" id="ck-${i}" rows="2"></textarea>
    </div>`).join('');

  const fields = ['ck-decision', ...F.pause.map((_, i) => `ck-${i}`)].map((fid) => document.getElementById(fid));
  const draft = App.Store.read(DRAFT_KEY, null);
  if (Array.isArray(draft)) fields.forEach((f, i) => { f.value = draft[i] || ''; });
  form.addEventListener('input', () => App.Store.write(DRAFT_KEY, fields.map((f) => f.value)));
  form.addEventListener('reset', () => {
    App.Store.remove(DRAFT_KEY);
    document.getElementById('ck-output').innerHTML = '';
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const [decision, ...answers] = fields.map((f) => f.value.trim());
    const blanks = F.pause.filter((_, i) => !answers[i]).map((p) => p.name);
    const text = [`Decision: ${decision}`, ...F.pause.map((p, i) => `${p.letter}: ${p.name}: ${answers[i] || '(not answered)'}`)].join('\n');
    document.getElementById('ck-output').innerHTML = `
      <div class="surface p-4">
        <h3 class="h6">Assumption check summary</h3>
        ${blanks.length ? `<div class="alert alert-warning small py-2">Steps not yet answered: ${blanks.map(esc).join(', ')}. Gaps here are often where bias hides.</div>` : '<div class="alert alert-success small py-2">All five PAUSE steps answered.</div>'}
        <pre class="small bg-light p-3 rounded mb-2" style="white-space:pre-wrap">${esc(text)}</pre>
        <div class="d-flex gap-2 no-print">
          <button class="btn btn-outline-primary btn-sm" id="ck-copy"><i class="bi bi-clipboard" aria-hidden="true"></i> Copy</button>
          <button class="btn btn-outline-secondary btn-sm" onclick="window.print()"><i class="bi bi-printer" aria-hidden="true"></i> Print</button>
          <span class="small text-muted-2 align-self-center" id="ck-msg" role="status"></span>
        </div>
      </div>`;
    document.getElementById('ck-copy').addEventListener('click', async () => {
      const msg = document.getElementById('ck-msg');
      try {
        await navigator.clipboard.writeText(text);
        msg.textContent = 'Copied.';
      } catch (err) {
        msg.textContent = 'Copy failed. Select the text and copy it manually.';
      }
    });
  });
})();
