// Gamification layer: XP, levels, quests, badges, passport stamps, combos and
// celebrations, shared by every page. It rewards learning actions (exploring a
// context, inclusive decisions, reflection, hearing every voice), never speed,
// and never ranks people against each other.
(function () {
  'use strict';
  const { esc, Store, Progress, COMPETENCIES } = App;
  const KEY = 'uncq.game.v1';
  const SESSIONS_KEY = 'uncq.sessions.v1';
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // XP per learning action. The ledger keeps the best award per key, so repeating
  // an action earns nothing new, and doing it better later earns the difference.
  const XP = {
    decision: { strong: 30, partial: 15, weak: 5 },
    scenario: 40,
    mastery: 25,
    reflection: 20,
    combo: { 3: 15, 5: 25, 8: 40 },
    stamp: 5,
    region: 15,
    bias: 10,
    round: 15,
    rounds: 3,
    perfect: 30,
    pause: { some: 20, all: 50 },
    avatar: 20,
    profile: { name: 20, photo: 10, goal: 10, mission: 10 },
    team: { start: 20, voices: 40, dimensions: 30, decided: 15, actions: 15 }
  };

  const LEVELS = [
    { min: 0, title: 'New Arrival', icon: 'bi-backpack2' },
    { min: 100, title: 'Field Learner', icon: 'bi-book' },
    { min: 250, title: 'Active Listener', icon: 'bi-ear' },
    { min: 450, title: 'Bridge Builder', icon: 'bi-bricks' },
    { min: 700, title: 'Context Analyst', icon: 'bi-binoculars' },
    { min: 1000, title: 'Inclusion Ally', icon: 'bi-people' },
    { min: 1400, title: 'Cultural Navigator', icon: 'bi-compass' },
    { min: 1900, title: 'CQ Champion', icon: 'bi-trophy' }
  ];

  // The deployment path: one quest per step of the learner journey.
  const QUESTS = [
    { id: 'profile', icon: 'bi-person-plus', title: 'Create your avatar', text: 'Choose your look and name in the avatar creator.', href: 'index.html?agent=1', xp: 25, test: (c) => c.avatar || Boolean(c.profile.name) },
    { id: 'station', icon: 'bi-geo-alt', title: 'Visit a duty station', text: 'Open a mission on the globe and read its mandate.', href: 'map.html', xp: 25, test: (c) => c.stamps >= 1 },
    { id: 'decide', icon: 'bi-signpost-split', title: 'Make your first field decision', text: 'Complete any scenario.', href: 'scenarios.html', xp: 30, test: (c) => c.completed >= 1 },
    { id: 'spot', icon: 'bi-search', title: 'Spot 5 biases', text: 'Name 5 different biases in Bias Detective.', href: 'toolkit.html#detective', xp: 30, test: (c) => c.found >= 5 },
    { id: 'pause', icon: 'bi-pause-circle', title: 'PAUSE before you act', text: 'Answer all five steps of the assumption check.', href: 'toolkit.html#check', xp: 30, test: (c) => c.pauseAll },
    { id: 'regions', icon: 'bi-globe2', title: 'Explore 3 regions', text: 'Stamp your field passport in three regions.', href: 'map.html', xp: 30, test: (c) => c.regions >= 3 },
    { id: 'voices', icon: 'bi-megaphone', title: 'Hear every voice', text: 'Run a Team Debrief with input from all four perspectives.', href: 'collaboration.html', xp: 40, test: (c) => Boolean(c.team.voices) },
    { id: 'master', icon: 'bi-stars', title: 'Reach Proficient three times', text: 'Score 75% or more on three scenarios.', href: 'scenarios.html', xp: 50, test: (c) => c.mastered >= 3 }
  ];

  const RATING_LABEL = { strong: 'Strong decision', partial: 'Partly effective decision', weak: 'Learning moment' };

  // ---------- state ----------
  function empty() {
    return {
      xp: 0, ledger: {}, log: [], stamps: {}, combo: { current: 0, best: 0 },
      detective: { found: {}, rounds: 0, perfect: 0, best: 0 }, pause: 0, pauseAll: false, team: {}, seen: [], location: 'hq'
    };
  }
  let cache = null;
  function state() {
    if (!cache) {
      const saved = Store.read(KEY, null);
      cache = Object.assign(empty(), saved && typeof saved.xp === 'number' ? saved : {});
    }
    return cache;
  }
  function save() {
    Store.write(KEY, state());
  }

  function levelFor(xp) {
    let i = 0;
    while (i + 1 < LEVELS.length && xp >= LEVELS[i + 1].min) i += 1;
    const next = LEVELS[i + 1] || null;
    return Object.assign({}, LEVELS[i], {
      number: i + 1,
      next,
      pct: next ? Math.round(((xp - LEVELS[i].min) / (next.min - LEVELS[i].min)) * 100) : 100,
      toNext: next ? next.min - xp : 0
    });
  }

  // Award XP for a learning action. Returns the XP actually gained.
  function award(key, amount, label, icon, opts) {
    const st = state();
    const gain = amount - (st.ledger[key] || 0);
    if (gain <= 0) return 0;
    const before = levelFor(st.xp).number;
    st.ledger[key] = amount;
    st.xp += gain;
    st.log.unshift({ at: new Date().toISOString(), label, xp: gain, icon: icon || 'bi-star-fill' });
    st.log.length = Math.min(st.log.length, 30);
    save();
    if (!(opts && opts.quiet)) toast({ icon, text: label, xp: gain });
    updateChip(true);
    const after = levelFor(st.xp);
    if (after.number > before) {
      toast({ icon: after.icon, text: `Level ${after.number} reached: ${after.title}`, kind: 'level' });
      confetti();
    }
    queueCheck();
    return gain;
  }

  // ---------- summary: level, quests and badges ----------
  async function summary() {
    const [S, M] = await Promise.all([App.loadScenarios(), App.loadMissions()]);
    const st = state();
    const p = Progress.get();
    const done = Object.values(p.completed);
    const totals = Progress.totals();
    const c = {
      profile: App.Profile.get(),
      avatar: Boolean(window.Avatar && Avatar.isSet()),
      completed: done.length,
      mastered: done.filter((x) => overall(x.scores) >= 75).length,
      perfect: done.some((x) => COMPETENCIES.every((k) => App.pct(x.scores[k]) === 100)),
      replayed: done.some((x) => x.attempts > 1),
      reflections: Object.values(p.reflections).filter((r) => r.text).length,
      strong: (k) => done.length >= 3 && App.pct(totals[k]) >= 75,
      sessions: Object.keys(Store.read(SESSIONS_KEY, {})).length,
      stamps: Object.keys(st.stamps).length,
      regions: new Set(Object.values(st.stamps).map((s) => s.region)).size,
      found: Object.keys(st.detective.found).length,
      perfectRounds: st.detective.perfect,
      bestCombo: st.combo.best,
      pauseAll: st.pauseAll,
      team: st.team,
      totals: { scenarios: S.scenarios.length, missions: M.missions.length, regions: Object.keys(M.regions).length, biases: S.biases.length }
    };
    const quests = QUESTS.map((q) => Object.assign({}, q, { done: q.test(c) }));
    // One medal per scenario: gold, silver or bronze, set by the stars earned.
    const medals = {};
    S.scenarios.forEach((sc) => { if (p.completed[sc.id]) medals[sc.id] = medal(stars(overall(p.completed[sc.id].scores))); });
    c.medals = Object.keys(medals).length;
    return { xp: st.xp, level: levelFor(st.xp), quests, next: quests.find((q) => !q.done) || null, badges: badges(c), counts: c, log: st.log, medals };
  }

  function badges(c) {
    const T = c.totals;
    return [
      ['first', 'bi-flag', 'First steps', 'Complete your first scenario', c.completed, 1],
      ['half', 'bi-signpost-2', 'Halfway there', 'Complete 5 scenarios', c.completed, 5],
      ['navigator', 'bi-compass', 'Navigator', `Complete all ${T.scenarios} scenarios`, c.completed, T.scenarios],
      ['clear', 'bi-stars', 'Clear sight', 'Score 100% on every competency in a scenario', Number(c.perfect), 1],
      ['spotter', 'bi-eye', 'Bias spotter', 'Reach 75% Bias Awareness across 3+ scenarios', Number(c.strong('bias')), 1],
      ['harm', 'bi-shield-check', 'Do No Harm champion', 'Reach 75% Do No Harm across 3+ scenarios', Number(c.strong('harm')), 1],
      ['growth', 'bi-arrow-repeat', 'Growth mindset', 'Replay a scenario to improve', Number(c.replayed), 1],
      ['reflective', 'bi-journal-text', 'Reflective practitioner', 'Save 3 reflections', c.reflections, 3],
      ['team', 'bi-people', 'Team player', 'Start a Team Debrief session', c.sessions, 1],
      ['roll', 'bi-fire', 'On a roll', 'Make 3 strong decisions in a row', c.bestCombo, 3],
      ['zone', 'bi-lightning-charge', 'In the zone', 'Make 5 strong decisions in a row', c.bestCombo, 5],
      ['sharp', 'bi-bullseye', 'Sharp eye', 'Play a perfect Bias Detective round', c.perfectRounds, 1],
      ['detective', 'bi-search', 'Bias detective', `Spot all ${T.biases} biases in Bias Detective`, c.found, T.biases],
      ['pause', 'bi-pause-circle', 'PAUSE practitioner', 'Answer all five PAUSE steps', Number(c.pauseAll), 1],
      ['globetrotter', 'bi-globe2', 'Globetrotter', `Stamp your passport in all ${T.regions} regions`, c.regions, T.regions],
      ['passport', 'bi-passport', 'Full passport', `Explore all ${T.missions} missions`, c.stamps, T.missions],
      ['voices', 'bi-megaphone', 'Every voice heard', 'Hear all four perspectives in a Team Debrief', Number(Boolean(c.team.voices)), 1],
      ['picture', 'bi-layers', 'Full picture', 'Discuss every dimension in play in a Team Debrief', Number(Boolean(c.team.dimensions)), 1]
    ].map(([id, icon, name, how, have, need]) => ({ id, icon, name, how, have: Math.min(have, need), need, earned: have >= need }));
  }

  // Award finished quests and announce new badges. Runs after any change, batched.
  let pending = false;
  let running = false;
  function queueCheck() {
    pending = true;
    if (running) return;
    running = true;
    setTimeout(async () => {
      while (pending) {
        pending = false;
        try {
          await runCheck();
        } catch (err) { /* data unavailable: try again on the next change */ }
      }
      running = false;
      document.dispatchEvent(new CustomEvent('game:change'));
    }, 30);
  }

  async function runCheck() {
    const sum = await summary();
    const st = state();
    sum.quests.forEach((q) => { if (q.done) award(`quest:${q.id}`, q.xp, `Quest complete: ${q.title}`, 'bi-flag-fill'); });
    sum.badges.forEach((b) => {
      if (!b.earned || st.seen.includes(b.id)) return;
      st.seen.push(b.id);
      save();
      toast({ icon: b.icon, text: `Badge unlocked: ${b.name}`, kind: 'badge' });
    });
  }

  // ---------- learning actions ----------
  function overall(scores) {
    return Math.round(COMPETENCIES.reduce((a, k) => a + App.pct(scores[k]), 0) / COMPETENCIES.length);
  }
  function stars(pct) {
    return pct >= 75 ? 3 : pct >= 50 ? 2 : 1;
  }
  function medal(n) {
    return ['bronze', 'silver', 'gold'][n - 1];
  }
  // Most XP a scenario can give: strong decisions, completion, Proficient and a reflection.
  function potential(s) {
    return s.steps.length * XP.decision.strong + XP.scenario + XP.mastery + XP.reflection;
  }

  function onDecision(s, step, choice) {
    const st = state();
    const key = `decision:${s.id}:${step}`;
    const replay = Boolean(st.ledger[key]);
    const gain = award(key, XP.decision[choice.rating] || 0, RATING_LABEL[choice.rating] || 'Decision', 'bi-signpost-split', { quiet: true });
    const best = st.ledger[key] >= XP.decision.strong;
    st.combo.current = choice.rating === 'strong' ? st.combo.current + 1 : 0;
    st.combo.best = Math.max(st.combo.best, st.combo.current);
    save();
    let bonus = 0;
    if (XP.combo[st.combo.current]) {
      bonus = award(`combo:${st.combo.current}`, XP.combo[st.combo.current], `Combo ×${st.combo.current}: ${st.combo.current} strong decisions in a row`, 'bi-fire');
    }
    queueCheck();
    return { gain, bonus, replay, best, combo: st.combo.current };
  }

  function onScenarioComplete(s, pct) {
    let gain = award(`scenario:${s.id}`, XP.scenario, `Scenario complete: ${s.title}`, 'bi-check2-circle');
    if (pct >= 75) gain += award(`mastery:${s.id}`, XP.mastery, `Proficient: ${s.title}`, 'bi-stars');
    return gain;
  }

  function onReflection(scenarioId, text) {
    if (String(text || '').trim().length < 20) return 0;
    return award(`reflection:${scenarioId}`, XP.reflection, 'Reflection saved', 'bi-journal-text');
  }

  // Opening a mission stamps the field passport; the first stamp in a region earns a bonus.
  function onMissionExplored(m) {
    const st = state();
    if (st.stamps[m.id]) return { stamped: false, newRegion: false };
    const newRegion = !Object.values(st.stamps).some((x) => x.region === m.region);
    st.stamps[m.id] = { region: m.region, at: new Date().toISOString() };
    save();
    award(`stamp:${m.id}`, XP.stamp, `Passport stamp: ${m.acronym}`, 'bi-postage');
    if (newRegion) award(`region:${m.region}`, XP.region, `New region: ${m.region}`, 'bi-globe2');
    return { stamped: true, newRegion };
  }

  function onBiasSpotted(bias) {
    const st = state();
    const isNew = !st.detective.found[bias.id];
    st.detective.found[bias.id] = true;
    save();
    return isNew ? award(`bias:${bias.id}`, XP.bias, `Bias spotted: ${bias.name}`, 'bi-search', { quiet: true }) : 0;
  }

  function onDetectiveRound(score, total) {
    const st = state();
    st.detective.rounds += 1;
    st.detective.best = Math.max(st.detective.best, score);
    if (score === total) st.detective.perfect += 1;
    save();
    let gain = st.detective.rounds <= XP.rounds ? award(`round:${st.detective.rounds}`, XP.round, 'Bias Detective round complete', 'bi-search') : 0;
    if (score === total) gain += award('round:perfect', XP.perfect, 'Perfect round', 'bi-bullseye');
    queueCheck();
    return gain;
  }

  function onPauseCheck(answered, total) {
    const st = state();
    st.pause = Math.max(st.pause, answered);
    st.pauseAll = st.pauseAll || (total > 0 && answered >= total);
    save();
    if (!answered) return 0;
    return award('pause', st.pauseAll ? XP.pause.all : XP.pause.some, st.pauseAll ? 'Assumption check: all five steps' : 'Assumption check started', 'bi-pause-circle');
  }

  function onAvatar(pr) {
    award('avatar', XP.avatar, 'Avatar created', 'bi-person-badge');
    onProfile(pr);
  }

  function onProfile(pr) {
    if (pr.name) award('profile:name', XP.profile.name, 'Profile created', 'bi-person-check');
    if (pr.photo) award('profile:photo', XP.profile.photo, 'Profile photo added', 'bi-camera');
    if (pr.goal) award('profile:goal', XP.profile.goal, 'Learning goal set', 'bi-bullseye');
    if (pr.mission) award('profile:mission', XP.profile.mission, 'Duty station chosen', 'bi-geo-alt');
    queueCheck();
  }

  // Team goals are cooperative: they describe the session, never an individual.
  const TEAM_LABEL = { start: 'Team Debrief started', voices: 'Team goal: every voice heard', dimensions: 'Team goal: every dimension discussed', decided: 'Team goal: decided together', actions: 'Team goal: actions agreed' };
  function onTeamGoals(goals) {
    const st = state();
    Object.keys(TEAM_LABEL).forEach((g) => {
      if (!goals[g]) return;
      if (!st.team[g]) {
        st.team[g] = true;
        save();
      }
      award(`team:${g}`, XP.team[g], TEAM_LABEL[g], g === 'start' ? 'bi-people' : 'bi-trophy');
    });
    queueCheck();
  }

  // ---------- feedback: nav chip, toasts, confetti ----------
  function chipHtml() {
    const xp = state().xp;
    const lv = levelFor(xp);
    const label = `Level ${lv.number}, ${lv.title}: ${xp} XP${lv.next ? `, ${lv.toNext} XP to ${lv.next.title}` : ''}. Open your progress.`;
    return `
      <a class="xp-chip ms-auto me-2 order-xl-last ms-xl-2 me-xl-0" id="xp-chip" href="progress.html" title="${esc(label)}" aria-label="${esc(label)}">
        <span class="xp-ring" style="--p:${lv.pct}" aria-hidden="true"><span>${lv.number}</span></span>
        <span class="xp-text" aria-hidden="true"><span class="xp-title">${esc(lv.title)}</span><span class="xp-num">${xp} XP</span></span>
      </a>`;
  }

  function updateChip(bump) {
    const chip = document.getElementById('xp-chip');
    if (!chip) return;
    chip.outerHTML = chipHtml();
    if (bump && !reduceMotion) {
      const fresh = document.getElementById('xp-chip');
      fresh.classList.add('is-bump');
      setTimeout(() => fresh.classList.remove('is-bump'), 700);
    }
  }

  function toast({ icon, text, xp, kind }) {
    let box = document.getElementById('game-toasts');
    if (!box) {
      box = document.createElement('div');
      box.id = 'game-toasts';
      box.className = 'game-toasts';
      box.setAttribute('role', 'status');
      box.setAttribute('aria-live', 'polite');
      document.body.appendChild(box);
    }
    const t = document.createElement('div');
    t.className = `game-toast${kind ? ` is-${kind}` : ''}`;
    t.innerHTML = `<span class="gt-icon"><i class="bi ${esc(icon || 'bi-star-fill')}" aria-hidden="true"></i></span>
      <span class="gt-text">${esc(text)}</span>${xp ? `<span class="gt-xp">+${xp} XP</span>` : ''}`;
    box.appendChild(t);
    while (box.children.length > 4) box.firstElementChild.remove();
    setTimeout(() => {
      t.classList.add('is-leaving');
      setTimeout(() => t.remove(), 400);
    }, kind === 'level' ? 5200 : 3600);
  }

  function confetti() {
    if (reduceMotion) return;
    const canvas = document.createElement('canvas');
    canvas.className = 'confetti';
    canvas.setAttribute('aria-hidden', 'true');
    const w = canvas.width = window.innerWidth;
    const h = canvas.height = window.innerHeight;
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    const colors = ['#38b6e8', '#2f6fd0', '#12406f', '#d99a17', '#8c97a8'];
    const bits = Array.from({ length: 90 }, () => ({
      x: w / 2 + (Math.random() - 0.5) * w * 0.35, y: h * 0.3,
      vx: (Math.random() - 0.5) * 13, vy: -Math.random() * 12 - 4,
      size: 5 + Math.random() * 6, rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3,
      color: colors[Math.floor(Math.random() * colors.length)]
    }));
    const start = performance.now();
    (function frame(now) {
      const t = now - start;
      ctx.clearRect(0, 0, w, h);
      ctx.globalAlpha = Math.max(0, 1 - t / 1900);
      bits.forEach((b) => {
        b.vy += 0.33;
        b.vx *= 0.99;
        b.x += b.vx;
        b.y += b.vy;
        b.rot += b.vr;
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(b.rot);
        ctx.fillStyle = b.color;
        ctx.fillRect(-b.size / 2, -b.size / 4, b.size, b.size / 2);
        ctx.restore();
      });
      if (t < 1900) requestAnimationFrame(frame);
      else canvas.remove();
    })(start);
  }

  // ---------- shared views ----------
  function starsHtml(n, max = 3) {
    return `<span class="stars" role="img" aria-label="${n} of ${max} stars">${Array.from({ length: max }, (_, i) =>
      `<i class="bi ${i < n ? 'bi-star-fill' : 'bi-star'}" aria-hidden="true"></i>`).join('')}</span>`;
  }

  function levelHtml(sum) {
    const lv = sum.level;
    return `
      <div class="level-card">
        <div class="level-badge" aria-hidden="true"><i class="bi ${lv.icon}"></i><span class="level-num">${lv.number}</span></div>
        <div class="flex-grow-1 min-w-0">
          <p class="eyebrow mb-0">Level ${lv.number} of ${LEVELS.length}</p>
          <p class="level-title mb-1">${esc(lv.title)}</p>
          <div class="xp-bar" role="progressbar" aria-label="Progress to the next level" aria-valuenow="${lv.pct}" aria-valuemin="0" aria-valuemax="100"><div style="width:${lv.pct}%"></div></div>
          <p class="small text-muted-2 mb-0 mt-1"><strong>${sum.xp} XP</strong> · ${lv.next ? `${lv.toNext} XP to ${esc(lv.next.title)}` : 'Top level reached'}</p>
        </div>
      </div>`;
  }

  function questsHtml(sum) {
    return `
      <ol class="quest-path list-unstyled mb-0">
        ${sum.quests.map((q, i) => {
          const isNext = sum.next && sum.next.id === q.id;
          return `
            <li class="quest${q.done ? ' is-done' : ''}${isNext ? ' is-next' : ''}">
              <a class="quest-link" href="${q.href}" aria-label="Quest ${i + 1}: ${esc(q.title)}. ${q.done ? 'Done' : `${esc(q.text)} Reward ${q.xp} XP`}">
                <span class="quest-icon" aria-hidden="true"><i class="bi ${q.done ? 'bi-check-lg' : q.icon}"></i></span>
                <span class="quest-body">
                  <span class="quest-step">${isNext ? 'Up next' : `Quest ${i + 1}`}</span>
                  <span class="quest-title">${esc(q.title)}</span>
                  <span class="quest-text">${esc(q.text)}</span>
                </span>
                <span class="quest-xp">${q.done ? 'Done' : `+${q.xp} XP`}</span>
              </a>
            </li>`;
        }).join('')}
      </ol>`;
  }

  function nextQuestHtml(sum, cls) {
    if (!sum.next) return `<p class="small mb-0 ${cls || ''}"><i class="bi bi-trophy" aria-hidden="true"></i> Every quest on the deployment path is complete. Keep earning badges.</p>`;
    return `
      <a class="btn btn-primary next-quest ${cls || ''}" href="${sum.next.href}">
        <i class="bi ${sum.next.icon}" aria-hidden="true"></i>
        <span class="text-start">Next quest: ${esc(sum.next.title)}</span>
        <span class="badge text-bg-light ms-auto">+${sum.next.xp} XP</span>
      </a>`;
  }

  // ---------- backup ----------
  function exportState() {
    return JSON.parse(JSON.stringify(state()));
  }
  function importState(data) {
    if (!data || typeof data.xp !== 'number' || typeof data.ledger !== 'object') return false;
    cache = Object.assign(empty(), data);
    save();
    updateChip(false);
    queueCheck();
    return true;
  }
  function reset() {
    cache = empty();
    Store.remove(KEY);
    updateChip(false);
    document.dispatchEvent(new CustomEvent('game:change'));
  }

  document.addEventListener('DOMContentLoaded', queueCheck);

  window.Game = {
    XP,
    LEVELS,
    QUESTS,
    levelFor,
    currentLevel: () => levelFor(state().xp).number,
    summary,
    medal,
    stars,
    starsHtml,
    potential,
    overall,
    onDecision,
    onScenarioComplete,
    onReflection,
    onMissionExplored,
    isStamped: (id) => Boolean(state().stamps[id]),
    stamps: () => state().stamps,
    combo: () => state().combo,
    detective: () => state().detective,
    onBiasSpotted,
    onDetectiveRound,
    onPauseCheck,
    onProfile,
    onAvatar,
    onTeamGoals,
    // Where the learner's aircraft is parked on the home globe.
    location: () => state().location,
    setLocation: (id) => { state().location = id; save(); },
    chipHtml,
    levelHtml,
    questsHtml,
    nextQuestHtml,
    toast,
    exportState,
    importState,
    reset
  };
})();
