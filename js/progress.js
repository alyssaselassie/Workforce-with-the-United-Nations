// Progress dashboard: competency totals, completed scenarios, reflections.
(async function () {
  'use strict';
  const { esc, COMPETENCIES } = App;
  const root = document.getElementById('progress-root');

  let S;
  try {
    S = await App.loadScenarios();
  } catch (err) {
    App.showError(root, err);
    return;
  }
  const biasById = Object.fromEntries(S.biases.map((b) => [b.id, b]));

  function render() {
    const p = App.Progress.get();
    const done = S.scenarios.filter((s) => p.completed[s.id]);
    const totals = App.Progress.totals();

    if (!done.length) {
      root.innerHTML = `
        <div class="surface p-5 text-center">
          <i class="bi bi-bar-chart fs-1 text-muted-2" aria-hidden="true"></i>
          <p class="mt-2">You haven't completed any scenarios yet.</p>
          <a class="btn btn-primary" href="scenarios.html">Start your first scenario</a>
        </div>`;
      return;
    }

    // Which biases came up most often in the learner's choices.
    const tagCounts = {};
    done.forEach((s) => (p.completed[s.id].biasTags || []).forEach((t) => { tagCounts[t] = (tagCounts[t] || 0) + 1; }));
    const topTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);
    const weakest = COMPETENCIES.slice().sort((a, b) => App.pct(totals[a]) - App.pct(totals[b]))[0];

    root.innerHTML = `
      <div class="row g-3 mb-4">
        <div class="col-lg-5">
          <div class="surface p-4 h-100">
            <p class="eyebrow mb-1">Competency profile</p>
            <p class="small text-muted-2">${done.length} of ${S.scenarios.length} scenarios completed</p>
            ${COMPETENCIES.map((k) => App.meter(S.competencies[k].label, App.pct(totals[k]), 'mb-3')).join('')}
          </div>
        </div>
        <div class="col-lg-7">
          <div class="surface p-4 h-100">
            <p class="eyebrow mb-1">Focus areas</p>
            <p class="mb-2">Your lowest competency so far is <strong>${esc(S.competencies[weakest].label)}</strong>: <span class="small">${esc(S.competencies[weakest].description)}</span></p>
            ${topTags.length ? `<p class="mb-1">Biases that came up most often in your choices:</p>
              <ul class="small">${topTags.map(([t, n]) => `<li><a href="toolkit.html#bias-${t}">${esc(biasById[t].name)}</a> (${n}×): ${esc(biasById[t].counter)}</li>`).join('')}</ul>`
              : '<p class="small">None of your choices relied on the biases these scenarios target. Try the remaining scenarios to keep practising.</p>'}
            <p class="small text-muted-2 mb-0">These scores reflect choices in fictional scenarios. They are a prompt for reflection, not an assessment of you.</p>
          </div>
        </div>
      </div>

      <h2 class="h5">Completed scenarios</h2>
      <div class="surface table-responsive mb-4">
        <table class="table mb-0 small align-middle">
          <thead><tr><th scope="col">Scenario</th>${COMPETENCIES.map((k) => `<th scope="col">${esc(S.competencies[k].short)}</th>`).join('')}<th scope="col">Attempts</th><th scope="col">Last played</th><th scope="col"><span class="visually-hidden">Actions</span></th></tr></thead>
          <tbody>${done.map((s) => {
            const c = p.completed[s.id];
            return `<tr><td><strong>${esc(s.title)}</strong></td>${COMPETENCIES.map((k) => `<td>${App.pct(c.scores[k])}%</td>`).join('')}
              <td>${c.attempts}</td><td>${new Date(c.at).toLocaleDateString()}</td>
              <td class="no-print"><a class="btn btn-outline-primary btn-sm" href="scenarios.html?id=${s.id}">Replay</a></td></tr>`;
          }).join('')}</tbody>
        </table>
      </div>

      <h2 class="h5">Reflections</h2>
      ${Object.keys(p.reflections).length ? Object.entries(p.reflections).map(([sid, r]) => {
        const s = S.scenarios.find((x) => x.id === sid);
        return s && r.text ? `<div class="surface p-3 mb-2"><p class="small fw-semibold mb-1">${esc(s.title)}</p>
          <p class="small text-muted-2 mb-1">${esc(s.debrief.reflection)}</p><p class="mb-0">${esc(r.text)}</p></div>` : '';
      }).join('') : '<p class="small text-muted-2">No saved reflections yet. Add one at the end of any scenario.</p>'}

      <div class="d-flex flex-wrap gap-2 mt-4 no-print">
        <button class="btn btn-outline-primary" id="export"><i class="bi bi-download" aria-hidden="true"></i> Export my progress</button>
        <button class="btn btn-outline-secondary" onclick="window.print()"><i class="bi bi-printer" aria-hidden="true"></i> Print learning summary</button>
        <button class="btn btn-outline-danger ms-auto" id="reset"><i class="bi bi-arrow-counterclockwise" aria-hidden="true"></i> Reset progress</button>
      </div>`;

    document.getElementById('export').addEventListener('click', () => App.download('cq-navigator-progress.json', App.Progress.get()));
    document.getElementById('reset').addEventListener('click', () => {
      if (window.confirm('Delete all scenario results and reflections stored in this browser?')) {
        App.Progress.reset();
        render();
      }
    });
  }

  render();
})();
