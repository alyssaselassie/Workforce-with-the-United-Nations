// Home page: headline stats and competency overview.
(async function () {
  'use strict';
  const { esc } = App;
  const ICONS = { cq: 'bi-globe2', bias: 'bi-eye', evidence: 'bi-clipboard-data', harm: 'bi-shield-heart' };

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
