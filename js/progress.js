// Progress hub: level, recent XP, quests and XP rules, then competency totals,
// completed scenarios and reflections.
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

  // The XP rules, shown in full so learners can see exactly what is rewarded.
  function rulesHtml() {
    const X = Game.XP;
    const quests = Game.QUESTS.map((q) => q.xp);
    const rows = [
      ['bi-signpost-split', 'Scenario decision', `${X.decision.strong} strong · ${X.decision.partial} partly effective · ${X.decision.weak} reconsider`],
      ['bi-check2-circle', 'Scenario complete', `${X.scenario}, plus ${X.mastery} for Proficient (75%+)`],
      ['bi-journal-text', 'Reflection saved (20+ characters)', X.reflection],
      ['bi-fire', 'Strong decisions in a row', `${X.combo[3]} for 3 · ${X.combo[5]} for 5 · ${X.combo[8]} for 8`],
      ['bi-postage', 'Passport stamp: open a mission on the globe', `${X.stamp}, plus ${X.region} for each new region`],
      ['bi-search', 'Bias Detective', `${X.bias} per new bias · ${X.round} per round (first ${X.rounds}) · ${X.perfect} for a perfect round`],
      ['bi-pause-circle', 'Assumption check (PAUSE)', `${X.pause.some}, or ${X.pause.all} with all five steps answered`],
      ['bi-people', 'Team Debrief goals', `${X.team.start} to start · ${X.team.voices} every voice · ${X.team.dimensions} every dimension · ${X.team.decided} decide together · ${X.team.actions} actions`],
      ['bi-person-badge', 'Create your avatar', X.avatar],
      ['bi-person-check', 'Profile details', `up to ${Object.values(X.profile).reduce((a, n) => a + n, 0)}`],
      ['bi-flag-fill', 'Quest on the deployment path', `${Math.min(...quests)}–${Math.max(...quests)} each`]
    ];
    return `
      <details class="surface p-4 mb-4 no-print" id="xp-rules">
        <summary class="fw-bold">How XP works</summary>
        <ul class="small mt-3 mb-3">
          <li>XP rewards learning actions: exploring a context, deciding, reflecting and hearing every voice. It never rewards speed.</li>
          <li>Each action pays once. Replaying earns XP only when you do better than before.</li>
          <li>There are no leaderboards: you are only compared with your past self. XP is not a measure of anyone's bias.</li>
        </ul>
        <div class="table-responsive"><table class="table table-sm small mb-0">
          <thead><tr><th scope="col">Action</th><th scope="col">XP</th></tr></thead>
          <tbody>${rows.map(([icon, what, xp]) => `<tr><td><i class="bi ${icon} me-1" aria-hidden="true"></i>${esc(what)}</td><td>${esc(xp)}</td></tr>`).join('')}</tbody>
        </table></div>
      </details>`;
  }

  function gameHtml(sum) {
    const c = sum.counts;
    const stat = (value, label) => `<div class="col-6 col-sm-3 col-lg-6 col-xl-3"><div class="game-stat"><strong>${value}</strong><span class="small text-muted-2">${label}</span></div></div>`;
    return `
      <div class="row g-3 mb-4 no-print">
        <div class="col-lg-6">
          <div class="surface p-4 h-100">
            ${Game.levelHtml(sum)}
            <div class="row g-2 mt-3">
              ${stat(`${sum.badges.filter((b) => b.earned).length}/${sum.badges.length}`, 'Badges')}
              ${stat(`${c.stamps}/${c.totals.missions}`, 'Missions')}
              ${stat(`${c.found}/${c.totals.biases}`, 'Biases')}
              ${stat(`×${c.bestCombo}`, 'Best combo')}
            </div>
            <div class="mt-3">${Game.nextQuestHtml(sum)}</div>
          </div>
        </div>
        <div class="col-lg-6">
          <div class="surface p-4 h-100">
            <h2 class="h5">Recent XP</h2>
            ${sum.log.length ? `<ul class="xp-log list-unstyled mb-0">${sum.log.slice(0, 8).map((e) => `
              <li><span class="gt-icon" aria-hidden="true"><i class="bi ${esc(e.icon)}"></i></span><span class="flex-grow-1 small">${esc(e.label)}</span><span class="gt-xp">+${e.xp} XP</span></li>`).join('')}</ul>`
              : '<p class="small text-muted-2 mb-0">No XP yet. Your first quest is waiting on the deployment path below.</p>'}
          </div>
        </div>
      </div>
      <section class="surface p-4 mb-4 no-print" aria-labelledby="quests-h">
        <div class="d-flex flex-wrap justify-content-between align-items-baseline gap-2 mb-2">
          <h2 class="h5 mb-0" id="quests-h"><i class="bi bi-map" aria-hidden="true"></i> Deployment path</h2>
          <span class="small text-muted-2">${sum.quests.filter((q) => q.done).length} of ${sum.quests.length} quests complete</span>
        </div>
        ${Game.questsHtml(sum)}
      </section>
      ${rulesHtml()}`;
  }

  async function render() {
    const sum = await Game.summary();
    const p = App.Progress.get();
    const done = S.scenarios.filter((s) => p.completed[s.id]);
    const totals = App.Progress.totals();
    const open = (document.getElementById('xp-rules') || {}).open;

    if (!done.length) {
      root.innerHTML = gameHtml(sum) + `
        <div class="surface p-5 text-center">
          <i class="bi bi-bar-chart fs-1 text-muted-2" aria-hidden="true"></i>
          <p class="mt-2">You haven't completed any scenarios yet, so there is no competency profile to show.</p>
          <a class="btn btn-primary" href="scenarios.html">Start your first scenario</a>
        </div>
        <div class="d-flex mt-4 no-print">
          <button class="btn btn-outline-danger ms-auto" id="reset"><i class="bi bi-arrow-counterclockwise" aria-hidden="true"></i> Reset progress</button>
        </div>`;
      wire(open);
      return;
    }

    // Which biases came up most often in the learner's choices.
    const tagCounts = {};
    done.forEach((s) => (p.completed[s.id].biasTags || []).forEach((t) => { tagCounts[t] = (tagCounts[t] || 0) + 1; }));
    const topTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);
    const weakest = COMPETENCIES.slice().sort((a, b) => App.pct(totals[a]) - App.pct(totals[b]))[0];

    root.innerHTML = gameHtml(sum) + `
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
              : '<p class="small">None of your choices relied on the biases these scenarios target. Try the remaining scenarios to keep practicing.</p>'}
            <p class="small text-muted-2 mb-0">These scores reflect choices in fictional scenarios. They are a prompt for reflection, not an assessment of you.</p>
          </div>
        </div>
      </div>

      <h2 class="h5">Completed scenarios</h2>
      <div class="surface table-responsive mb-4">
        <table class="table mb-0 small align-middle">
          <thead><tr><th scope="col">Scenario</th><th scope="col">Stars</th>${COMPETENCIES.map((k) => `<th scope="col">${esc(S.competencies[k].short)}</th>`).join('')}<th scope="col">Attempts</th><th scope="col">Last played</th><th scope="col"><span class="visually-hidden">Actions</span></th></tr></thead>
          <tbody>${done.map((s) => {
            const c = p.completed[s.id];
            return `<tr><td><strong>${esc(s.title)}</strong></td><td>${Game.starsHtml(Game.stars(Game.overall(c.scores)))}</td>${COMPETENCIES.map((k) => `<td>${App.pct(c.scores[k])}%</td>`).join('')}
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

    document.getElementById('export').addEventListener('click', () => App.download('cq-navigator-progress.json', Object.assign({}, App.Progress.get(), { game: Game.exportState() })));
    wire(open);
  }

  function wire(rulesOpen) {
    if (rulesOpen) document.getElementById('xp-rules').open = true;
    document.getElementById('reset').addEventListener('click', () => {
      if (window.confirm('Delete all scenario results, reflections, XP, badges and passport stamps?')) {
        App.Progress.reset();
        Game.reset();
        render();
      }
    });
  }

  render();
  document.addEventListener('game:change', render);
})();
