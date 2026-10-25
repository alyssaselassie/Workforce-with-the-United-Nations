// Home page: level, deployment path quests, headline stats and competency overview.
(async function () {
  'use strict';
  const { esc } = App;
  const ICONS = { cq: 'bi-globe2', bias: 'bi-eye', evidence: 'bi-clipboard-data', harm: 'bi-shield-check' };

  // Returning learners see their name instead of the sign-up prompt.
  const firstName = String(App.Profile.get().name || '').trim().split(/\s+/)[0];
  if (firstName) {
    const btn = document.getElementById('hero-profile');
    btn.href = 'profile.html';
    btn.innerHTML = `<i class="bi bi-person-circle" aria-hidden="true"></i> Welcome back, ${esc(firstName)}`;
  }

  // Level, quick stats, next quest and the quest path. Redrawn when XP changes.
  async function drawGame() {
    const sum = await Game.summary();
    const c = sum.counts;
    const stat = (value, label) => `<div class="col-6"><div class="game-stat"><strong>${value}</strong><span class="small text-muted-2">${label}</span></div></div>`;
    document.getElementById('home-level').innerHTML = Game.levelHtml(sum);
    document.getElementById('home-game-stats').innerHTML = [
      stat(`${sum.badges.filter((b) => b.earned).length}/${sum.badges.length}`, 'Badges'),
      stat(`${c.stamps}/${c.totals.missions}`, 'Missions explored'),
      stat(`${c.found}/${c.totals.biases}`, 'Biases spotted'),
      stat(`×${c.bestCombo}`, 'Best combo')
    ].join('');
    document.getElementById('home-next').innerHTML = Game.nextQuestHtml(sum, 'w-100');
    document.getElementById('home-quests').innerHTML = Game.questsHtml(sum);
    document.getElementById('path-count').textContent = `${sum.quests.filter((q) => q.done).length} of ${sum.quests.length} quests complete`;
  }
  drawGame().catch((err) => App.showError(document.getElementById('home-quests'), err));
  document.addEventListener('game:change', () => drawGame().catch(() => {}));

  try {
    const [missions, scenarios] = await Promise.all([App.loadMissions(), App.loadScenarios()]);
    const countries = new Set();
    missions.missions.forEach((m) => m.scope.forEach((c) => countries.add(c)));

    document.getElementById('stat-missions').textContent = missions.missions.length;
    document.getElementById('stat-countries').textContent = countries.size;
    document.getElementById('stat-scenarios').textContent = scenarios.scenarios.length;
    document.getElementById('stat-done').textContent = Object.keys(App.Progress.get().completed).length;

    document.getElementById('competency-list').innerHTML = Object.entries(scenarios.competencies).map(([key, c]) => `
      <div class="col-md-6 col-lg-3">
        <div class="surface p-3 h-100">
          <div class="module-icon mb-2"><i class="bi ${ICONS[key]}" aria-hidden="true"></i></div>
          <h3 class="h6 mb-1">${esc(c.label)}</h3>
          <p class="small text-muted-2 mb-0">${esc(c.description)}</p>
        </div>
      </div>`).join('');
  } catch (err) {
    App.showError(document.getElementById('competency-list'), err);
  }
})();
