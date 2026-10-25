// Scenario library (no ?id) and scenario player (?id=...).
(async function () {
  'use strict';
  const { esc, COMPETENCIES } = App;
  const root = document.getElementById('scenario-root');
  const KEYS = 'ABCDEFG';

  let S, M;
  try {
    [S, M] = await Promise.all([App.loadScenarios(), App.loadMissions()]);
  } catch (err) {
    App.showError(root, err);
    return;
  }
  const missionById = Object.fromEntries(M.missions.map((m) => [m.id, m]));
  const biasById = Object.fromEntries(S.biases.map((b) => [b.id, b]));
  const scenarioById = Object.fromEntries(S.scenarios.map((s) => [s.id, s]));

  function missionsFor(s) {
    const ids = new Set(s.missionIds);
    M.missions.forEach((m) => { if ((m.scenarioIds || []).includes(s.id)) ids.add(m.id); });
    return [...ids].map((id) => missionById[id]).filter(Boolean);
  }

  const id = App.param('id');
  if (id && scenarioById[id]) play(scenarioById[id]);
  else library();

  // ================= library =================
  function library() {
    const progress = App.Progress.get();
    const missionFilter = App.param('mission') || '';
    const allMissions = [...new Set(S.scenarios.flatMap((s) => missionsFor(s).map((m) => m.id)))]
      .map((mid) => missionById[mid]).sort((a, b) => a.acronym.localeCompare(b.acronym));

    const finished = S.scenarios.filter((s) => progress.completed[s.id]);
    const starCount = finished.reduce((a, s) => a + Game.stars(Game.overall(progress.completed[s.id].scores)), 0);
    const share = Math.round((finished.length / S.scenarios.length) * 100);

    root.innerHTML = `
      <div class="mb-3 no-print">${Scenes.mentorTip('Every scenario is an island. Finish one to win its medallion: bronze, silver or gold.')}</div>
      <div class="surface p-3 mb-3 d-flex flex-wrap align-items-center gap-3 lib-progress">
        <span><strong>${finished.length}</strong> of ${S.scenarios.length} scenarios complete</span>
        <span><i class="bi bi-star-fill text-warning" aria-hidden="true"></i> <strong>${starCount}</strong> of ${S.scenarios.length * 3} stars</span>
        <span><i class="bi bi-fire text-danger" aria-hidden="true"></i> Best combo ×${Game.combo().best}</span>
        <div class="progress flex-grow-1" role="progressbar" aria-label="Scenarios complete" aria-valuenow="${share}" aria-valuemin="0" aria-valuemax="100"><div class="progress-bar" style="width:${share}%"></div></div>
      </div>
      <div class="row g-2 mb-3 no-print">
        <div class="col-md-5">
          <label class="form-label small fw-semibold" for="lib-mission">Mission context</label>
          <select class="form-select" id="lib-mission">
            <option value="">All missions</option>
            ${allMissions.map((m) => `<option value="${m.id}" ${m.id === missionFilter ? 'selected' : ''}>${esc(m.acronym)}: ${esc(m.name)}</option>`).join('')}
          </select>
        </div>
        <div class="col-md-4">
          <label class="form-label small fw-semibold" for="lib-bias">Bias focus</label>
          <select class="form-select" id="lib-bias">
            <option value="">Any bias</option>
            ${S.biases.map((b) => `<option value="${b.id}">${esc(b.name)}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="row g-3" id="lib-grid"></div>
      <p class="small text-muted-2 mt-4 mb-0"><i class="bi bi-info-circle" aria-hidden="true"></i> ${esc(S.meta.note)}</p>`;

    const grid = document.getElementById('lib-grid');
    const selMission = document.getElementById('lib-mission');
    const selBias = document.getElementById('lib-bias');

    function draw() {
      const list = S.scenarios.filter((s) =>
        (!selMission.value || missionsFor(s).some((m) => m.id === selMission.value)) &&
        (!selBias.value || s.biasFocus.includes(selBias.value)));
      grid.innerHTML = list.length ? list.map((s) => {
        const done = progress.completed[s.id];
        const overall = done ? Game.overall(done.scores) : null;
        const ctx = selMission.value ? `&amp;mission=${selMission.value}` : '';
        return `
          <div class="col-md-6 col-lg-4">
            <div class="card h-100">
              <div class="card-body d-flex flex-column">
                <div class="d-flex justify-content-between align-items-start gap-2 mb-2">
                  <span class="small text-muted-2"><i class="bi bi-person-badge" aria-hidden="true"></i> ${esc(s.role)} · ${s.minutes} min</span>
                  ${done ? `<span class="badge text-bg-success">Done · ${overall}%</span>` : '<span class="badge new-pill">New</span>'}
                </div>
                <h2 class="h5">${esc(s.title)}</h2>
                ${done ? `<div class="mb-2">${Game.starsHtml(Game.stars(overall))}</div>` : ''}
                <p class="text-muted-2 small">${esc(s.summary)}</p>
                <div class="mb-3">${s.biasFocus.map((b) => `<span class="scope-chip">${esc(biasById[b].name)}</span>`).join('')}</div>
                <p class="small text-muted-2 mb-3">Contexts: ${missionsFor(s).map((m) => esc(m.acronym)).join(', ')}</p>
                <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mt-auto">
                  <a class="btn btn-primary" href="scenarios.html?id=${s.id}${ctx}">${done ? 'Replay' : 'Start'} scenario</a>
                  ${done ? '' : `<span class="xp-avail">Up to +${Game.potential(s)} XP</span>`}
                </div>
              </div>
            </div>
          </div>`;
      }).join('') : '<div class="col-12"><p class="text-muted-2">No scenarios match these filters.</p></div>';
    }
    selMission.addEventListener('change', draw);
    selBias.addEventListener('change', draw);
    draw();
  }

  // ================= player =================
  function play(s) {
    const ctxMission = missionById[App.param('mission')];
    const state = { step: -1, choices: [], earned: {}, max: {}, tags: new Set(), missed: new Set(), xp: 0 };
    COMPETENCIES.forEach((k) => { state.earned[k] = 0; state.max[k] = 0; });
    document.title = `${s.title} · Scenarios`;
    document.body.classList.add('is-playing');
    const isle = s.island || { name: s.title, theme: 'village', npc: { name: 'Colleague', look: 'colleague' } };
    const npcSpec = Avatar.NPC[isle.npc.look] || Avatar.NPC.colleague;
    const me = () => String(App.Profile.get().name || '').trim().split(/\s+/)[0] || 'You';

    // The island scene: your agent on the left, the story character and the mentor on the right.
    function scene(o) {
      return Scenes.stage({
        theme: isle.theme, prop: isle.prop, sky: isle.sky, banner: o.banner, bubbles: o.bubbles || [],
        caption: `${isle.name}: your agent, ${isle.npc.name} and ${Scenes.MENTOR.name}.`,
        actors: [
          { id: 'you', name: me(), spec: Avatar.get(), x: 13, look: 'right', mood: o.you, anim: o.youAnim },
          { id: 'npc', name: isle.npc.name, spec: npcSpec, x: 63, look: 'left', mood: o.npc, anim: o.npcAnim },
          { id: 'mentor', name: Scenes.MENTOR.name, spec: Avatar.NPC.mentor, x: 86, look: 'left', mood: o.mentor, anim: o.mentorAnim }
        ]
      });
    }
    const mentorSays = (text) => ({ side: 'right', who: Scenes.MENTOR.name, text });

    function header() {
      const dots = s.steps.map((_, i) => `<span class="${i < state.step ? 'done' : i === state.step ? 'current' : ''}"></span>`).join('');
      return `
        <nav aria-label="breadcrumb" class="no-print"><ol class="breadcrumb small mb-2">
          <li class="breadcrumb-item"><a href="scenarios.html">Scenarios</a></li>
          <li class="breadcrumb-item active" aria-current="page">${esc(s.title)}</li></ol></nav>
        <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
          <div>
            <span class="island-tag mb-1"><i class="bi bi-geo-alt-fill" aria-hidden="true"></i> ${esc(isle.name)}</span>
            <h2 class="h3 mb-1">${esc(s.title)}</h2>
            <p class="small text-muted-2 mb-0"><i class="bi bi-person-badge" aria-hidden="true"></i> You are a <strong>${esc(s.role)}</strong>
            ${ctxMission ? ` · Context: <a href="map.html?mission=${ctxMission.id}">${esc(ctxMission.acronym)}</a>` : ''}</p>
          </div>
          ${state.step >= 0 && state.step < s.steps.length ? `<div class="text-end"><div class="step-dots" aria-hidden="true">${dots}</div>
            <div class="small text-muted-2 mt-1">Decision ${state.step + 1} of ${s.steps.length}</div></div>` : ''}
        </div>`;
    }

    // --- intro ---
    function intro() {
      root.innerHTML = header() + scene({ youAnim: 'walk', bubbles: [mentorSays(`Welcome to ${isle.name}! You're the ${s.role} here. Ready to help?`)] }) + `
        <div class="row g-3">
          <div class="col-lg-7">
            <div class="surface p-4 h-100">
              <p class="eyebrow mb-1">Setting</p>
              <p>${esc(s.setting)}</p>
              <p class="eyebrow mb-1">This scenario explores</p>
              <ul class="small">${s.biasFocus.map((b) => `<li><strong>${esc(biasById[b].name)}</strong>: ${esc(biasById[b].definition)}</li>`).join('')}</ul>
              <p class="eyebrow mb-1">Dimensions in play</p>
              <div class="mb-1">${orderDims(s.dimensions).map((d) => App.dimChip(S, d)).join(' ')}</div>
              <p class="small text-muted-2 mb-3">A person cannot be defined by a single dimension. <a href="toolkit.html#dimensions">About the dimensions</a></p>
              <button class="btn btn-pop btn-lg" id="begin">Begin scenario <i class="bi bi-arrow-right" aria-hidden="true"></i></button>
            </div>
          </div>
          <div class="col-lg-5">
            <div class="surface p-4 h-100">
              <p class="eyebrow mb-2">Before you begin: PAUSE</p>
              ${S.frameworks.pause.map((p) => `
                <div class="d-flex gap-2 mb-2"><span class="pause-letter" aria-hidden="true">${p.letter}</span>
                <div class="small"><strong>${esc(p.name)}</strong><br>${esc(p.text)}</div></div>`).join('')}
            </div>
          </div>
        </div>`;
      document.getElementById('begin').addEventListener('click', () => { state.step = 0; renderStep(); });
    }

    // --- one decision ---
    function renderStep() {
      const step = s.steps[state.step];
      root.innerHTML = header() + scene({
        npc: 'think',
        bubbles: [{ side: 'think', text: '?', x: 63 }, mentorSays(state.step === 0 ? 'What will you do? Take a breath first.' : 'Next challenge. What now?')]
      }) + `
        <div class="surface p-4">
          <div class="story-box mb-3"><p class="lead mb-0">${esc(step.prompt)}</p></div>
          ${step.context ? `<div class="context-note p-3 small mb-3"><i class="bi bi-info-circle" aria-hidden="true"></i> <strong>Context:</strong> ${esc(step.context)}</div>` : ''}
          <fieldset>
            <legend class="small fw-semibold text-muted-2">Choose your response</legend>
            <div class="d-grid gap-2" id="choices">
              ${step.choices.map((c, i) => `
                <button type="button" class="choice-btn" data-i="${i}">
                  <span class="choice-key" aria-hidden="true">${KEYS[i]}</span><span>${esc(c.text)}</span>
                </button>`).join('')}
            </div>
          </fieldset>
          <p class="kbd-hint mt-2 mb-0">Tip: press <kbd>A</kbd>–<kbd>${KEYS[step.choices.length - 1]}</kbd> to choose, then <kbd>Enter</kbd> to continue.</p>
          <div id="feedback" class="mt-3" tabindex="-1"></div>
        </div>`;
      document.getElementById('choices').addEventListener('click', (e) => {
        const btn = e.target.closest('.choice-btn');
        if (btn && !btn.disabled) choose(step, Number(btn.dataset.i));
      });
    }

    function choose(step, i) {
      const choice = step.choices[i];
      state.choices.push(i);
      COMPETENCIES.forEach((k) => {
        state.earned[k] += choice.scores[k];
        state.max[k] += Math.max(...step.choices.map((c) => c.scores[k]));
      });
      choice.biasTags.forEach((t) => state.tags.add(t));
      (choice.missed || []).forEach((d) => state.missed.add(d));
      const tested = orderDims(App.stepDimensions(step));
      const missed = orderDims(choice.missed || []);
      const reward = Game.onDecision(s, state.step, choice);
      state.xp += reward.gain + reward.bonus;
      const react = { strong: ['grin', 'jump'], partial: ['think', 'tilt'], weak: ['oops', 'shake'] }[choice.rating] || ['think', ''];
      document.getElementById('stage').outerHTML = scene({
        you: react[0], youAnim: react[1], npc: choice.rating === 'strong' ? 'grin' : 'think',
        mentor: react[0], mentorAnim: choice.rating === 'strong' ? 'jump' : '',
        bubbles: [{ side: 'left', who: me(), text: choice.text }, mentorSays(Scenes.reaction(choice.rating, state.step))]
      });

      document.querySelectorAll('.choice-btn').forEach((b, idx) => {
        b.disabled = true;
        b.classList.add(idx === i ? 'is-chosen' : 'is-dimmed');
        if (idx === i) b.setAttribute('aria-pressed', 'true');
      });

      const best = step.choices.reduce((bi, c, idx) => (sum(c) > sum(step.choices[bi]) ? idx : bi), 0);
      const fb = document.getElementById('feedback');
      fb.innerHTML = `
        <div class="feedback-box rating-${choice.rating} p-3">
          <div class="d-flex flex-wrap align-items-center gap-2 mb-2">${App.ratingBadge(choice.rating)}
            ${reward.gain ? `<span class="xp-pop">+${reward.gain} XP</span>`
              : reward.replay ? `<span class="xp-pop is-zero">${reward.best ? 'Full XP already earned for this decision' : 'No new XP: only a stronger choice than last time earns more'}</span>` : ''}
            ${reward.combo >= 2 ? `<span class="combo-chip"><i class="bi bi-fire" aria-hidden="true"></i> Combo ×${reward.combo}${reward.bonus ? ` · +${reward.bonus} XP` : ''}</span>` : ''}
          </div>
          <p class="mb-2">${esc(choice.feedback)}</p>
          <div class="d-flex flex-wrap gap-1 mb-2">
            ${COMPETENCIES.map((k) => `<span class="score-chip" title="${esc(S.competencies[k].label)}">${esc(S.competencies[k].short)} <strong>${choice.scores[k]}/3</strong></span>`).join('')}
          </div>
          ${choice.biasTags.length ? `<p class="small mb-2"><i class="bi bi-eye" aria-hidden="true"></i> <strong>Bias at play:</strong>
            ${choice.biasTags.map((t) => `${esc(biasById[t].name)}. <em>Counter-strategy:</em> ${esc(biasById[t].counter)}`).join(' ')}</p>` : ''}
          ${tested.length ? `<p class="small mb-2 dim-line"><i class="bi bi-layers" aria-hidden="true"></i> <strong>Dimensions:</strong>
            ${missed.length ? `this choice overlooks ${missed.map((d) => App.dimChip(S, d)).join(' ')}`
              : `this choice accounts for every dimension in play ${tested.map((d) => App.dimChip(S, d)).join(' ')}`}</p>` : ''}
          ${best !== i ? `<details class="small"><summary>See the strongest option</summary>
            <p class="mt-2 mb-0"><strong>${KEYS[best]}.</strong> ${esc(step.choices[best].feedback)}</p></details>` : ''}
        </div>
        <div class="text-end mt-3">
          <button class="btn btn-primary" id="next">${state.step + 1 < s.steps.length ? 'Next decision' : 'See results'} <i class="bi bi-arrow-right" aria-hidden="true"></i></button>
        </div>`;
      fb.focus();
      document.getElementById('next').addEventListener('click', () => {
        state.step += 1;
        if (state.step < s.steps.length) renderStep();
        else finish();
        window.scrollTo({ top: root.offsetTop - 80, behavior: 'smooth' });
      });
    }

    // Keep dimensions in the framework's order: position, place, emotion, voice.
    function orderDims(list) {
      return Object.keys(S.dimensions).filter((d) => list.includes(d));
    }

    function sum(c) {
      return COMPETENCIES.reduce((a, k) => a + c.scores[k], 0);
    }

    // --- results ---
    function finish() {
      const scores = {};
      COMPETENCIES.forEach((k) => { scores[k] = { earned: state.earned[k], max: state.max[k] }; });
      App.Progress.record(s.id, { scores, choices: state.choices, biasTags: [...state.tags] });
      const saved = (App.Progress.get().reflections[s.id] || {}).text || '';
      const overall = Game.overall(scores);
      state.xp += Game.onScenarioComplete(s, overall);
      const tier = Game.medal(Game.stars(overall));
      const next = S.scenarios[(S.scenarios.indexOf(s) + 1) % S.scenarios.length];

      root.innerHTML = header() + scene({
        you: 'grin', youAnim: 'jump', npc: 'grin', mentor: 'grin', mentorAnim: 'jump',
        banner: `${Scenes.medallion(tier, 40, `${tier} medallion`)}<span>Island complete!</span>`,
        bubbles: [mentorSays(`You earned the ${tier} medallion of ${isle.name}!`)]
      }) + `
        <div class="row g-3">
          <div class="col-lg-5">
            <div class="surface p-4 h-100">
              <p class="eyebrow mb-1">Your result</p>
              <div class="d-flex flex-wrap align-items-center gap-3 mb-2"><div class="stat">${overall}%</div><span class="result-stars">${Game.starsHtml(Game.stars(overall))}</span></div>
              <p class="small mb-3">${state.xp ? `<span class="xp-pop">+${state.xp} XP</span> earned this time` : '<span class="xp-pop is-zero">No new XP this time</span> Replays earn XP only when you improve.'}</p>
              ${COMPETENCIES.map((k) => App.meter(S.competencies[k].label, App.pct(scores[k]), 'mb-3')).join('')}
              ${state.tags.size ? `<p class="small mb-0"><strong>Biases that shaped your choices:</strong> ${[...state.tags].map((t) => esc(biasById[t].name)).join(', ')}.
                <a href="toolkit.html#bias-${[...state.tags][0]}">Review in the toolkit</a>.</p>`
              : '<p class="small mb-0">None of your choices relied on the biases this scenario targets. Well done.</p>'}
              <p class="small mt-3 mb-0"><strong>Dimensions:</strong>
                ${state.missed.size ? `you overlooked ${orderDims([...state.missed]).map((d) => App.dimChip(S, d)).join(' ')}`
                  : 'you accounted for every dimension in play.'}</p>
            </div>
          </div>
          <div class="col-lg-7">
            <div class="surface p-4 h-100">
              <p class="eyebrow mb-1">Key takeaways</p>
              <ul>${s.debrief.takeaways.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
              <label class="form-label fw-semibold mt-2" for="reflection">Personal reflection</label>
              <p class="small text-muted-2 mb-1">${esc(s.debrief.reflection)}</p>
              <textarea class="form-control mb-2" id="reflection" rows="4" placeholder="Your reflection is kept for this demo session.">${esc(saved)}</textarea>
              <div class="d-flex flex-wrap gap-2 align-items-center">
                <button class="btn btn-outline-primary btn-sm" id="save-ref"><i class="bi bi-save" aria-hidden="true"></i> Save reflection</button>
                <span class="small text-muted-2" id="save-msg" role="status"></span>
              </div>
            </div>
          </div>
        </div>
        <div class="d-flex flex-wrap gap-2 mt-3 no-print">
          <a class="btn btn-primary" href="collaboration.html?scenario=${s.id}"><i class="bi bi-people" aria-hidden="true"></i> Discuss with your team</a>
          <a class="btn btn-outline-primary" href="scenarios.html?id=${next.id}">Next scenario: ${esc(next.title)}</a>
          <a class="btn btn-outline-secondary" href="scenarios.html?id=${s.id}${ctxMission ? '&amp;mission=' + ctxMission.id : ''}">Replay</a>
          <a class="btn btn-outline-secondary" href="progress.html">My progress</a>
        </div>
        <div class="surface p-3 mt-3 d-flex flex-wrap align-items-center justify-content-between gap-3 no-print" id="result-game"></div>`;

      // Level and next quest; refreshed when quest rewards land.
      async function drawGame() {
        const box = document.getElementById('result-game');
        if (!box) return;
        const sum = await Game.summary();
        box.innerHTML = `<div class="flex-grow-1" style="max-width:28rem">${Game.levelHtml(sum)}</div>${Game.nextQuestHtml(sum)}`;
      }
      drawGame();
      document.addEventListener('game:change', drawGame);

      document.getElementById('save-ref').addEventListener('click', () => {
        const text = document.getElementById('reflection').value.trim();
        const ok = App.Progress.saveReflection(s.id, text);
        const xp = ok ? Game.onReflection(s.id, text) : 0;
        document.getElementById('save-msg').textContent = !ok ? 'Could not save. Browser storage is unavailable.'
          : xp ? `Saved. +${xp} XP` : text.length < 20 ? 'Saved. Write a little more (20+ characters) to earn XP.' : 'Saved.';
      });
    }

    // Keyboard play: A–D answer, Enter (or N) moves on. Typing in a field is never intercepted.
    document.addEventListener('keydown', (e) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.target.closest('input, textarea, select, [contenteditable="true"]')) return;
      const key = e.key.toUpperCase();
      const option = KEYS.includes(key) && root.querySelector(`.choice-btn[data-i="${KEYS.indexOf(key)}"]:not(:disabled)`);
      if (option) {
        e.preventDefault();
        option.click();
        return;
      }
      const next = document.getElementById('next');
      if (next && (key === 'N' || (e.key === 'Enter' && !e.target.closest('button, a')))) {
        e.preventDefault();
        next.click();
      }
    });

    intro();
  }
})();
