// Team debrief: local, exportable discussion sessions built around a scenario.
(async function () {
  'use strict';
  const { esc, Store, uid } = App;
  const SESSIONS_KEY = 'uncq.sessions.v1';
  const CURRENT_KEY = 'uncq.currentSession.v1';
  const PERSPECTIVES = ['National staff', 'International staff', 'Uniformed personnel', 'Community liaison / partner', 'Other / prefer not to say'];
  const KEYS = 'ABCDEFG';

  const ws = document.getElementById('workspace');
  let S;
  try {
    S = await App.loadScenarios();
  } catch (err) {
    App.showError(ws, err);
    return;
  }
  const scenarioById = Object.fromEntries(S.scenarios.map((s) => [s.id, s]));

  let sessions = Store.read(SESSIONS_KEY, {});
  let currentId = Store.read(CURRENT_KEY, null);
  let tab = 'discuss';

  function save() {
    Store.write(SESSIONS_KEY, sessions);
    Store.write(CURRENT_KEY, currentId);
  }
  const current = () => sessions[currentId];

  // ---------- new session ----------
  const selScenario = document.getElementById('ns-scenario');
  selScenario.innerHTML = S.scenarios.map((s) => `<option value="${s.id}">${esc(s.title)}</option>`).join('');
  const preset = App.param('scenario');
  if (preset && scenarioById[preset]) selScenario.value = preset;

  document.getElementById('new-session').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = uid();
    sessions[id] = {
      id,
      title: document.getElementById('ns-title').value.trim(),
      scenarioId: selScenario.value,
      facilitator: document.getElementById('ns-facilitator').value.trim(),
      createdAt: new Date().toISOString(),
      contributions: [],
      votes: {},
      revealed: {},
      actions: []
    };
    currentId = id;
    tab = 'discuss';
    save();
    e.target.reset();
    if (preset && scenarioById[preset]) selScenario.value = preset;
    render();
  });

  // ---------- session list ----------
  function renderList() {
    const list = Object.values(sessions).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    document.getElementById('session-list').innerHTML = list.length ? list.map((s) => `
      <button type="button" class="list-group-item list-group-item-action${s.id === currentId ? ' active' : ''}" data-open="${s.id}">
        <strong>${esc(s.title)}</strong><br>
        <span class="${s.id === currentId ? '' : 'text-muted-2'}">${esc((scenarioById[s.scenarioId] || {}).title || 'Unknown scenario')} · ${new Date(s.createdAt).toLocaleDateString()}</span>
      </button>`).join('') : '<p class="text-muted-2 mb-0">No saved sessions yet.</p>';
  }
  document.getElementById('session-list').addEventListener('click', (e) => {
    const b = e.target.closest('[data-open]');
    if (!b) return;
    currentId = b.dataset.open;
    save();
    render();
  });

  // ---------- import ----------
  document.getElementById('import-file').addEventListener('change', async (e) => {
    const msg = document.getElementById('import-msg');
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const incoming = JSON.parse(await file.text());
      if (!incoming || !incoming.id || !Array.isArray(incoming.contributions) || !scenarioById[incoming.scenarioId]) {
        throw new Error('This file is not a Team Debrief session export.');
      }
      sessions[incoming.id] = sessions[incoming.id] ? merge(sessions[incoming.id], incoming) : sanitize(incoming);
      currentId = incoming.id;
      save();
      render();
      msg.className = 'small mt-2 mb-0 text-success';
      msg.textContent = `Imported "${incoming.title}".`;
    } catch (err) {
      msg.className = 'small mt-2 mb-0 text-danger';
      msg.textContent = `Import failed: ${err.message}`;
    }
  });

  function sanitize(s) {
    return {
      id: String(s.id),
      title: String(s.title || 'Imported session'),
      scenarioId: s.scenarioId,
      facilitator: String(s.facilitator || ''),
      createdAt: s.createdAt || new Date().toISOString(),
      contributions: (s.contributions || []).filter((c) => c && c.id),
      votes: s.votes || {},
      revealed: s.revealed || {},
      actions: (s.actions || []).filter((a) => a && a.id)
    };
  }

  // Union lists by id; for vote tallies keep the higher count so re-importing never double counts.
  function merge(a, b) {
    b = sanitize(b);
    const byId = (x, y) => {
      const map = new Map(x.map((i) => [i.id, i]));
      y.forEach((i) => { if (!map.has(i.id)) map.set(i.id, i); });
      return [...map.values()];
    };
    const votes = JSON.parse(JSON.stringify(a.votes));
    Object.entries(b.votes).forEach(([step, tally]) => {
      votes[step] = votes[step] || {};
      Object.entries(tally).forEach(([c, n]) => { votes[step][c] = Math.max(votes[step][c] || 0, n); });
    });
    return Object.assign({}, a, {
      contributions: byId(a.contributions, b.contributions),
      actions: byId(a.actions, b.actions),
      votes,
      revealed: Object.assign({}, b.revealed, a.revealed)
    });
  }

  // ---------- workspace ----------
  function render() {
    renderList();
    const s = current();
    if (!s) return;
    const sc = scenarioById[s.scenarioId];
    const tabs = [['discuss', 'Discuss', 'bi-chat-dots'], ['vote', 'Group vote', 'bi-hand-index'], ['actions', 'Action plan', 'bi-list-check'], ['summary', 'Summary', 'bi-file-text']];
    const goals = teamGoals(s, sc);

    ws.innerHTML = `
      <div class="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
        <div>
          <p class="eyebrow mb-1">Debrief session</p>
          <h2 class="h4 mb-0">${esc(s.title)}</h2>
          <p class="small text-muted-2 mb-0">Scenario: <a href="scenarios.html?id=${sc.id}">${esc(sc.title)}</a>${s.facilitator ? ` · Facilitator: ${esc(s.facilitator)}` : ''}</p>
        </div>
        <div class="d-flex gap-2 no-print">
          <button class="btn btn-outline-primary btn-sm" id="export"><i class="bi bi-download" aria-hidden="true"></i> Export</button>
          <button class="btn btn-outline-danger btn-sm" id="delete"><i class="bi bi-trash" aria-hidden="true"></i> Delete</button>
        </div>
      </div>
      ${goalsPanel(goals)}
      <ul class="nav nav-tabs mb-3 no-print" role="tablist">
        ${tabs.map(([k, label, icon]) => `<li class="nav-item" role="presentation">
          <button class="nav-link${tab === k ? ' active' : ''}" role="tab" aria-selected="${tab === k}" data-tab="${k}"><i class="bi ${icon}" aria-hidden="true"></i> ${label}</button></li>`).join('')}
      </ul>
      <div id="tab-body"></div>`;

    ws.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.tab; render(); }));
    document.getElementById('export').addEventListener('click', () => {
      const safe = s.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase().replace(/^-|-$/g, '') || 'session';
      App.download(`debrief-${safe}.json`, s);
    });
    document.getElementById('delete').addEventListener('click', () => {
      if (!window.confirm(`Delete "${s.title}"? Export it first if you want to keep a copy.`)) return;
      delete sessions[currentId];
      currentId = null;
      save();
      renderList();
      ws.innerHTML = '<div class="surface p-4 text-center text-muted-2">Session deleted.</div>';
    });

    const body = document.getElementById('tab-body');
    ({ discuss, vote, actions, summary })[tab](body, s, sc);
    Game.onTeamGoals(Object.assign({ start: true }, Object.fromEntries(goals.map((g) => [g.id, g.have >= g.need]))));
  }

  // Cooperative goals for the whole team. They describe the session, never a person.
  function teamGoals(s, sc) {
    const dims = inPlay(sc);
    return [
      { id: 'voices', icon: 'bi-megaphone', label: 'Every voice heard', hint: 'National, international, uniformed and community voices',
        have: PERSPECTIVES.slice(0, 4).filter((p) => s.contributions.some((c) => c.perspective === p)).length, need: 4 },
      { id: 'dimensions', icon: 'bi-layers', label: 'Every dimension discussed', hint: 'Tag each comment with the dimension it raises',
        have: dims.filter((d) => s.contributions.some((c) => c.dimension === d)).length, need: dims.length },
      { id: 'decided', icon: 'bi-hand-index', label: 'Decide together', hint: 'Vote on each decision, then reveal the guidance',
        have: sc.steps.filter((_, si) => s.revealed[si] && Object.values(s.votes[si] || {}).some((n) => n > 0)).length, need: sc.steps.length },
      { id: 'actions', icon: 'bi-list-check', label: 'Agree on actions', hint: 'Add at least one action point',
        have: Math.min(s.actions.length, 1), need: 1 }
    ];
  }

  function goalsPanel(goals) {
    const done = goals.filter((g) => g.have >= g.need).length;
    return `
      <div class="surface p-3 mb-3" id="team-goals">
        <div class="d-flex flex-wrap justify-content-between align-items-baseline gap-2 mb-2">
          <p class="eyebrow mb-0"><i class="bi bi-trophy" aria-hidden="true"></i> Team goals</p>
          <span class="small text-muted-2">${done} of ${goals.length} complete · shared by the whole team, no individual scores</span>
        </div>
        <div class="row g-2">
          ${goals.map((g) => {
            const met = g.have >= g.need;
            return `
              <div class="col-sm-6">
                <div class="team-goal${met ? ' is-done' : ''}">
                  <span class="tg-icon" aria-hidden="true"><i class="bi ${met ? 'bi-check-lg' : g.icon}"></i></span>
                  <div class="flex-grow-1 min-w-0">
                    <div class="d-flex justify-content-between gap-2 small"><strong>${esc(g.label)}</strong><span class="text-muted-2">${g.have}/${g.need}</span></div>
                    <div class="tg-bar" aria-hidden="true"><div style="width:${Math.round((g.have / g.need) * 100)}%"></div></div>
                    <div class="text-muted-2 mt-1" style="font-size:.72rem">${esc(g.hint)}</div>
                  </div>
                </div>
              </div>`;
          }).join('')}
        </div>
      </div>`;
  }

  // --- Discuss ---
  function discuss(body, s, sc) {
    const counts = {};
    s.contributions.forEach((c) => { counts[c.perspective] = (counts[c.perspective] || 0) + 1; });
    const missing = PERSPECTIVES.slice(0, 4).filter((p) => !counts[p]);

    body.innerHTML = `
      <div class="surface p-3 mb-3">
        <p class="eyebrow mb-1">Discussion prompts</p>
        <ol class="small mb-2">${sc.steps.map((st) => `<li class="mb-1">${esc(st.prompt)}</li>`).join('')}</ol>
        <p class="small mb-2"><strong>Reflection:</strong> ${esc(sc.debrief.reflection)}</p>
        <p class="small mb-0"><strong>Dimensions in play:</strong> ${inPlay(sc).map((d) => App.dimChip(S, d)).join(' ')}</p>
      </div>
      <form class="surface p-3 mb-3 no-print" id="contrib-form">
        <div class="row g-2">
          <div class="col-sm-6">
            <label class="form-label small" for="c-author">Name (optional)</label>
            <input class="form-control" id="c-author" placeholder="Leave blank to stay anonymous">
          </div>
          <div class="col-sm-6">
            <label class="form-label small" for="c-perspective">Perspective</label>
            <select class="form-select" id="c-perspective">${PERSPECTIVES.map((p) => `<option>${esc(p)}</option>`).join('')}</select>
          </div>
          <div class="col-sm-6">
            <label class="form-label small" for="c-pause">Related PAUSE step</label>
            <select class="form-select" id="c-pause"><option value="">None</option>${S.frameworks.pause.map((p) => `<option value="${p.letter}">${p.letter}: ${esc(p.name)}</option>`).join('')}</select>
          </div>
          <div class="col-sm-6">
            <label class="form-label small" for="c-dim">Dimension it raises</label>
            <select class="form-select" id="c-dim"><option value="">None</option>${Object.entries(S.dimensions).map(([id, d]) => `<option value="${id}">${esc(d.label)}</option>`).join('')}</select>
          </div>
          <div class="col-12">
            <label class="form-label small" for="c-text">Contribution</label>
            <textarea class="form-control" id="c-text" rows="3" required placeholder="What would you do, and why? What might others be missing?"></textarea>
          </div>
        </div>
        <button class="btn btn-primary mt-2" type="submit"><i class="bi bi-send" aria-hidden="true"></i> Add to wall</button>
      </form>
      ${s.contributions.length && missing.length ? `<div class="alert alert-warning small py-2"><i class="bi bi-person-exclamation" aria-hidden="true"></i> <strong>Ask who's missing:</strong> no contributions yet from ${missing.map(esc).join(', ')}.</div>` : ''}
      <div id="wall">${s.contributions.length ? s.contributions.slice().reverse().map((c) => `
        <div class="card contrib-card mb-2"><div class="card-body py-2">
          <div class="d-flex justify-content-between align-items-start gap-2">
            <div class="small text-muted-2">${esc(c.author || 'Anonymous')} · ${esc(c.perspective)}${c.pause ? ` · <span class="badge text-bg-primary">${esc(c.pause)}</span>` : ''}${c.dimension ? ` · ${App.dimChip(S, c.dimension)}` : ''}</div>
            <div class="d-flex gap-1 no-print">
              <button class="btn btn-sm btn-outline-secondary" data-plus="${c.id}" aria-label="Agree with this contribution"><i class="bi bi-hand-thumbs-up" aria-hidden="true"></i> ${c.votes || 0}</button>
              <button class="btn btn-sm btn-outline-secondary" data-act="${c.id}" title="Turn into an action point" aria-label="Turn into an action point"><i class="bi bi-list-check" aria-hidden="true"></i></button>
              <button class="btn btn-sm btn-outline-danger" data-del="${c.id}" aria-label="Remove contribution"><i class="bi bi-x" aria-hidden="true"></i></button>
            </div>
          </div>
          <p class="mb-0 mt-1">${esc(c.text)}</p>
        </div></div>`).join('') : '<p class="text-muted-2 small">No contributions yet.</p>'}</div>`;

    document.getElementById('contrib-form').addEventListener('submit', (e) => {
      e.preventDefault();
      s.contributions.push({
        id: uid(),
        author: document.getElementById('c-author').value.trim(),
        perspective: document.getElementById('c-perspective').value,
        pause: document.getElementById('c-pause').value,
        dimension: document.getElementById('c-dim').value,
        text: document.getElementById('c-text').value.trim(),
        votes: 0,
        at: new Date().toISOString()
      });
      save();
      render();
    });
    document.getElementById('wall').addEventListener('click', (e) => {
      const plus = e.target.closest('[data-plus]');
      const del = e.target.closest('[data-del]');
      const act = e.target.closest('[data-act]');
      if (plus) s.contributions.find((c) => c.id === plus.dataset.plus).votes += 1;
      else if (del) s.contributions = s.contributions.filter((c) => c.id !== del.dataset.del);
      else if (act) {
        const c = s.contributions.find((x) => x.id === act.dataset.act);
        s.actions.push({ id: uid(), text: c.text, owner: '', done: false });
        tab = 'actions';
      } else return;
      save();
      render();
    });
  }

  // Dimensions the scenario involves, in the framework's order.
  function inPlay(sc) {
    return Object.keys(S.dimensions).filter((d) => (sc.dimensions || []).includes(d));
  }

  // Before voting: which dimensions in play has the team actually discussed?
  function dimensionCheck(s, sc) {
    const counts = {};
    s.contributions.forEach((c) => { if (c.dimension) counts[c.dimension] = (counts[c.dimension] || 0) + 1; });
    const notYet = inPlay(sc).filter((d) => !counts[d]);
    return `
      <div class="surface p-3 mb-3" id="dimension-check">
        <p class="eyebrow mb-1">Dimension check before voting</p>
        <p class="small mb-2">Which of these dimensions are in play in this case, and which is missing from the discussion?</p>
        <div class="d-flex flex-wrap gap-3 mb-2">${inPlay(sc).map((d) => `<span>${App.dimChip(S, d)} <span class="small text-muted-2">${counts[d] || 0} comment${counts[d] === 1 ? '' : 's'}</span></span>`).join('')}</div>
        ${notYet.length ? `<div class="alert alert-warning small py-2 mb-0"><strong>Not discussed yet:</strong> ${notYet.map((d) => esc(S.dimensions[d].label)).join(', ')}. When someone raises it, tag their comment on the Discuss tab.</div>`
          : '<p class="small text-success mb-0"><i class="bi bi-check-circle" aria-hidden="true"></i> Every dimension in play has been discussed.</p>'}
      </div>`;
  }

  // --- Vote ---
  function vote(body, s, sc) {
    body.innerHTML = dimensionCheck(s, sc) + sc.steps.map((st, si) => {
      const tally = s.votes[si] || {};
      const total = Object.values(tally).reduce((a, n) => a + n, 0);
      const revealed = s.revealed[si];
      return `
        <div class="surface p-3 mb-3">
          <p class="eyebrow mb-1">Decision ${si + 1}</p>
          <p class="mb-3">${esc(st.prompt)}</p>
          ${st.choices.map((c, ci) => {
            const n = tally[ci] || 0;
            const share = total ? Math.round((n / total) * 100) : 0;
            return `
              <div class="mb-3">
                <div class="d-flex justify-content-between gap-2 align-items-start">
                  <div class="small"><strong>${KEYS[ci]}.</strong> ${esc(c.text)} ${revealed ? App.ratingBadge(c.rating) : ''}</div>
                  <div class="btn-group btn-group-sm flex-shrink-0 no-print" role="group" aria-label="Adjust votes for option ${KEYS[ci]}">
                    <button class="btn btn-outline-secondary" data-v="${si}:${ci}:-1" aria-label="Remove a vote">−</button>
                    <span class="btn btn-light disabled" aria-live="polite">${n}</span>
                    <button class="btn btn-outline-primary" data-v="${si}:${ci}:1" aria-label="Add a vote">+</button>
                  </div>
                </div>
                <div class="vote-bar mt-1" aria-hidden="true"><div style="width:${share}%"></div></div>
                ${revealed ? `<p class="small text-muted-2 mt-1 mb-0">${esc(c.feedback)}</p>` : ''}
              </div>`;
          }).join('')}
          <button class="btn btn-sm ${revealed ? 'btn-outline-secondary' : 'btn-primary'} no-print" data-reveal="${si}">
            ${revealed ? 'Hide guidance' : 'Reveal guidance'}</button>
          ${revealed && total ? `<p class="small mt-2 mb-0"><strong>Discuss:</strong> where did the group's choice differ from the guidance, and what in your context might justify that, or reveal a shared blind spot?</p>` : ''}
        </div>`;
    }).join('');

    body.addEventListener('click', (e) => {
      const v = e.target.closest('[data-v]');
      const r = e.target.closest('[data-reveal]');
      if (v) {
        const [si, ci, d] = v.dataset.v.split(':').map(Number);
        s.votes[si] = s.votes[si] || {};
        s.votes[si][ci] = Math.max(0, (s.votes[si][ci] || 0) + d);
      } else if (r) {
        s.revealed[r.dataset.reveal] = !s.revealed[r.dataset.reveal];
      } else return;
      save();
      render();
    });
  }

  // --- Actions ---
  function actions(body, s) {
    body.innerHTML = `
      <form class="surface p-3 mb-3 no-print" id="action-form">
        <div class="row g-2 align-items-end">
          <div class="col-md-7"><label class="form-label small" for="a-text">Action point</label><input class="form-control" id="a-text" required placeholder="e.g. Schedule separate women's consultation with female staff"></div>
          <div class="col-md-3"><label class="form-label small" for="a-owner">Owner</label><input class="form-control" id="a-owner"></div>
          <div class="col-md-2"><button class="btn btn-primary w-100" type="submit">Add</button></div>
        </div>
      </form>
      <ul class="list-group" id="action-list">
        ${s.actions.length ? s.actions.map((a) => `
          <li class="list-group-item d-flex gap-2 align-items-start">
            <input class="form-check-input mt-1" type="checkbox" id="act-${a.id}" data-done="${a.id}" ${a.done ? 'checked' : ''}>
            <label class="flex-grow-1 ${a.done ? 'text-decoration-line-through text-muted-2' : ''}" for="act-${a.id}">${esc(a.text)}${a.owner ? ` <span class="badge text-bg-light border">${esc(a.owner)}</span>` : ''}</label>
            <button class="btn btn-sm btn-outline-danger no-print" data-rm="${a.id}" aria-label="Remove action"><i class="bi bi-x" aria-hidden="true"></i></button>
          </li>`).join('') : '<li class="list-group-item text-muted-2 small">No action points yet. Add them here, or from the discussion wall.</li>'}
      </ul>`;

    document.getElementById('action-form').addEventListener('submit', (e) => {
      e.preventDefault();
      s.actions.push({ id: uid(), text: document.getElementById('a-text').value.trim(), owner: document.getElementById('a-owner').value.trim(), done: false });
      save();
      render();
    });
    document.getElementById('action-list').addEventListener('change', (e) => {
      const d = e.target.closest('[data-done]');
      if (!d) return;
      s.actions.find((a) => a.id === d.dataset.done).done = d.checked;
      save();
      render();
    });
    document.getElementById('action-list').addEventListener('click', (e) => {
      const rm = e.target.closest('[data-rm]');
      if (!rm) return;
      s.actions = s.actions.filter((a) => a.id !== rm.dataset.rm);
      save();
      render();
    });
  }

  // --- Summary ---
  function summary(body, s, sc) {
    const counts = {};
    s.contributions.forEach((c) => { counts[c.perspective] = (counts[c.perspective] || 0) + 1; });
    const top = s.contributions.slice().sort((a, b) => (b.votes || 0) - (a.votes || 0)).slice(0, 5);
    body.innerHTML = `
      <div class="surface p-4">
        <h3 class="h5">${esc(s.title)}: debrief summary</h3>
        <p class="small text-muted-2">Scenario: ${esc(sc.title)} · ${new Date(s.createdAt).toLocaleString()}${s.facilitator ? ` · Facilitator: ${esc(s.facilitator)}` : ''}</p>
        <h4 class="h6 mt-3">Participation by perspective</h4>
        <p class="small">${PERSPECTIVES.map((p) => `${esc(p)}: <strong>${counts[p] || 0}</strong>`).join(' · ')}</p>
        <h4 class="h6 mt-3">Dimensions discussed</h4>
        <p class="small">${Object.entries(S.dimensions).map(([id, d]) => `${esc(d.label)}: <strong>${s.contributions.filter((c) => c.dimension === id).length}</strong>`).join(' · ')}</p>
        <h4 class="h6 mt-3">Group decisions</h4>
        <ul class="small">${sc.steps.map((st, si) => {
          const tally = s.votes[si] || {};
          const entries = Object.entries(tally).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
          if (!entries.length) return `<li>Decision ${si + 1}: no votes recorded.</li>`;
          const [ci, n] = entries[0];
          return `<li>Decision ${si + 1}: most votes for <strong>${KEYS[ci]}</strong> (${n}), rated <em>${esc(st.choices[ci].rating)}</em> in the guidance.</li>`;
        }).join('')}</ul>
        <h4 class="h6 mt-3">Most-endorsed contributions</h4>
        ${top.length ? `<ul class="small">${top.map((c) => `<li>${esc(c.text)} <span class="text-muted-2">(${esc(c.perspective)}, ${c.votes || 0} agree)</span></li>`).join('')}</ul>` : '<p class="small text-muted-2">None.</p>'}
        <h4 class="h6 mt-3">Action plan</h4>
        ${s.actions.length ? `<ul class="small">${s.actions.map((a) => `<li>${a.done ? '✓ ' : ''}${esc(a.text)}${a.owner ? ` (${esc(a.owner)})` : ''}</li>`).join('')}</ul>` : '<p class="small text-muted-2">None.</p>'}
        <p class="small text-muted-2 mt-3 mb-0">Generated by the CQ &amp; Bias Navigator learning prototype. This is not an official UN record.</p>
        <button class="btn btn-outline-secondary btn-sm mt-3 no-print" onclick="window.print()"><i class="bi bi-printer" aria-hidden="true"></i> Print summary</button>
      </div>`;
  }

  if (!current()) currentId = null;
  render();
  if (!currentId) renderList();
})();
