// Home page island map: every module and scenario is an island. Pick one, and your
// agent's blimp flies there before the page opens. Finished islands show their medallion.
(async function () {
  'use strict';
  const { esc } = App;
  const map = document.getElementById('isle-svg');
  const dock = document.getElementById('isle-dock');
  const card = document.getElementById('agent-card');
  if (!map) return;
  const INK = '#2a2f45';
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let S;
  try {
    S = await App.loadScenarios();
  } catch (err) {
    App.showError(dock, err);
    return;
  }

  const MODULES = [
    { id: 'base', name: 'Base Camp', kind: 'Home base', landmark: 'camp', x: 140, y: 330, r: 70, text: 'Your home base. Create or customize your field agent, then pick an island.' },
    { id: 'lookout', name: 'Mission Lookout', kind: 'Mission globe', landmark: 'lighthouse', x: 300, y: 158, r: 54, href: 'map.html', text: 'Spin the 3D globe of UN field missions and stamp your field passport.' },
    { id: 'library', name: 'Field Guide Isle', kind: 'Bias toolkit', landmark: 'book', x: 300, y: 505, r: 54, href: 'toolkit.html#check', text: 'The bias library, the PAUSE assumption check and the dimensions framework.' },
    { id: 'detective', name: 'Detective Cove', kind: 'Mini-game', landmark: 'magnifier', x: 470, y: 330, r: 48, href: 'toolkit.html#detective', text: 'Play Bias Detective: name the shortcut in five quick field cases.' },
    { id: 'teamcamp', name: 'Team Camp', kind: 'Team Debrief', landmark: 'campfire', x: 1105, y: 560, r: 52, href: 'collaboration.html', text: 'Run a Team Debrief and reach the four team goals together.' }
  ];
  // Scenario islands, in the order the scenarios appear in the data.
  const SPOTS = [[630, 142], [805, 140], [980, 150], [1118, 282], [640, 306], [815, 290], [985, 330], [640, 478], [812, 462], [962, 492], [1112, 420]];
  const islands = MODULES.concat(S.scenarios.map((s, i) => ({
    id: s.id, scenario: s, name: (s.island || {}).name || s.title, kind: 'Scenario island', landmark: (s.island || {}).landmark || 'hut',
    x: SPOTS[i % SPOTS.length][0], y: SPOTS[i % SPOTS.length][1], r: 46, href: `scenarios.html?id=${s.id}`, text: `${s.title} ${s.summary}`
  })));
  const byId = Object.fromEntries(islands.map((i) => [i.id, i]));
  let selected = null;
  let sum = null;

  // ---------- drawing ----------
  function rng(seed) {
    let v = seed;
    return () => {
      v = (v * 9301 + 49297) % 233280;
      return v / 233280;
    };
  }
  // A smooth, slightly irregular island outline (Catmull-Rom through jittered points).
  function blob(r, seed, squash) {
    const rand = rng(seed);
    const n = 9;
    const pts = Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2;
      const rr = r * (0.84 + rand() * 0.28);
      return [Math.cos(a) * rr, Math.sin(a) * rr * squash];
    });
    const f = (v) => v.toFixed(1);
    let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
    for (let i = 0; i < n; i += 1) {
      const [p0, p1, p2, p3] = [pts[(i - 1 + n) % n], pts[i], pts[(i + 1) % n], pts[(i + 2) % n]];
      d += `C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`;
    }
    return `${d}Z`;
  }

  const L = `stroke="${INK}" stroke-width="2" stroke-linejoin="round"`;
  const LANDMARKS = {
    camp: `<path d="M-30 6L-8-26L14 6z" fill="#ff8a3d" ${L}/><path d="M-8-26V6M-14 6l6-12 6 12" fill="#c4561d" ${L}/><path d="M24 6V-38" ${L}/><path d="M24-38h20l-6 7 6 7H24z" fill="#4aa3ff" ${L}/>`,
    lighthouse: `<path d="M-10 6l4-44h12l4 44z" fill="#fff" ${L}/><path d="M-8.6-8h17.2l-1.2-12H-7.4zM-6.6-30h13.2" fill="#ff5d5d" stroke="${INK}" stroke-width="1.5"/>
      <rect x="-8" y="-48" width="16" height="10" rx="2" fill="#ffd54f" ${L}/><path d="M-12-48L0-58l12 10z" fill="#ff5d5d" ${L}/><path d="M10-44l26-10v14z" fill="#fff6b0" opacity=".9"/>`,
    book: `<path d="M0-4c-10-8-22-8-32-4v-28c10-4 22-4 32 4z" fill="#fff" ${L}/><path d="M0-4c10-8 22-8 32-4v-28c-10-4-22-4-32 4z" fill="#fff" ${L}/>
      <path d="M-26-26h18M-26-18h18M8-26h18M8-18h18" stroke="#4aa3ff" stroke-width="2.4" stroke-linecap="round"/><path d="M0-32V-4" stroke="#c4561d" stroke-width="3"/>`,
    magnifier: `<circle cx="-4" cy="-20" r="15" fill="#d8f0ff" ${L} stroke-width="4"/><path d="M7-9l14 14" stroke="#8a5a36" stroke-width="7" stroke-linecap="round"/><path d="M-12-26a9 9 0 0 1 8-5" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/>`,
    campfire: `<path d="M-38 4L-24-18L-10 4z" fill="#34c389" ${L}/><path d="M10 4L24-18L38 4z" fill="#9b7bf2" ${L}/>
      <path d="M-8 6l16-6M-8 0l16 6" stroke="#8a5a36" stroke-width="4" stroke-linecap="round"/><path d="M0-2c-8-6-4-14 0-20 4 6 9 14 0 20z" fill="#ff8a3d" ${L}/><path d="M0-4c-3-3-2-7 0-10 2 3 4 7 0 10z" fill="#ffd54f"/>`,
    pump: `<rect x="-5" y="-34" width="10" height="38" fill="#2f6fd0" ${L}/><path d="M0-28L22-40" stroke="${INK}" stroke-width="3.5" stroke-linecap="round"/><path d="M-5-22h-12v6" fill="none" stroke="#2f6fd0" stroke-width="5"/><path d="M-26-6h18l-3 10h-12z" fill="#ffc23d" ${L}/>`,
    hut: `<rect x="-20" y="-20" width="40" height="24" rx="4" fill="#f0c98f" ${L}/><path d="M-28-18Q0-56 28-18z" fill="#b8743d" ${L}/><rect x="-6" y="-10" width="12" height="14" rx="6" fill="#7a4b28"/>`,
    office: `<rect x="-22" y="-38" width="44" height="42" fill="#cfe7ff" ${L}/><path d="M-26-38h52l-4-8h-44z" fill="#2f6fd0" ${L}/>
      ${[-14, 4].map((x) => [-30, -18].map((y) => `<rect x="${x}" y="${y}" width="10" height="8" fill="#fff" stroke="${INK}" stroke-width="1.2"/>`).join('')).join('')}<rect x="-5" y="-6" width="10" height="10" fill="#8a5a36"/>`,
    tent: `<path d="M-28 4L0-30L28 4z" fill="#f4f0e6" ${L}/><path d="M-8 4L0-14L8 4z" fill="#9aa7bd"/><path d="M14 4h20" stroke="${INK}" stroke-width="2"/><circle cx="26" cy="-4" r="6" fill="#4aa3ff" ${L}/>`,
    radio: `<path d="M-10 4L0-46L10 4M-6-14h12M-3-30h6" fill="none" stroke="#7d8597" stroke-width="3"/><circle cx="0" cy="-48" r="4" fill="#ff5d5d"/>
      <path d="M8-54q8 6 0 12M14-60q14 12 0 24" fill="none" stroke="#ff5d5d" stroke-width="2.5" stroke-linecap="round"/>`,
    lantern: `<rect x="-22" y="-22" width="30" height="26" fill="#ffe1b3" ${L}/><path d="M-26-22L-7-40L12-22z" fill="#c96a4a" ${L}/>
      <path d="M16-34v8" stroke="${INK}" stroke-width="1.5"/><rect x="11" y="-26" width="10" height="14" rx="4" fill="#ff7b6b" ${L}/>`,
    hall: `<rect x="-26" y="-30" width="52" height="34" fill="#fff4e0" ${L}/><path d="M-30-30L0-48L30-30z" fill="#9b7bf2" ${L}/>${[-18, -6, 6, 18].map((x) => `<rect x="${x - 2}" y="-26" width="4" height="30" fill="#efe2c6" stroke="${INK}" stroke-width="1"/>`).join('')}`,
    farm: `<rect x="-6" y="-30" width="34" height="34" fill="#e8584a" ${L}/><path d="M-10-30L11-46L32-30z" fill="#fff" ${L}/><rect x="5" y="-14" width="12" height="18" fill="#fff" ${L}/>
      ${[0, 1, 2].map((i) => `<path d="M-34 ${-14 + i * 8}h22" stroke="${i % 2 ? '#e9d36a' : '#4f9a43'}" stroke-width="5" stroke-linecap="round"/>`).join('')}`,
    signpost: `<rect x="-3" y="-44" width="6" height="48" fill="#8a5a36"/><path d="M3-42h26l8 7-8 7H3z" fill="#ffc23d" ${L}/><path d="M-3-24h-26l-8 7 8 7h26z" fill="#4aa3ff" ${L}/>`,
    tree: `<rect x="-4" y="-22" width="8" height="26" fill="#7a5230"/><circle cx="0" cy="-32" r="16" fill="#59b35a" ${L}/><path d="M14 2h22M14-6h22" stroke="#e9d36a" stroke-width="5" stroke-linecap="round"/>`
  };

  function landmark(kind, scale) {
    return `<g transform="translate(0 ${-8 * scale}) scale(${scale})">${LANDMARKS[kind] || LANDMARKS.hut}</g>`;
  }

  function status(isle) {
    if (!isle.scenario || !sum) return null;
    return sum.medals[isle.id] || null;
  }

  // The island the next quest points to gets a bouncing marker.
  function questIsland() {
    const q = sum && sum.next;
    if (!q) return null;
    const firstOpen = S.scenarios.find((s) => !sum.medals[s.id]);
    const firstNotGold = S.scenarios.find((s) => sum.medals[s.id] !== 'gold');
    return { profile: 'base', station: 'lookout', regions: 'lookout', spot: 'detective', pause: 'library', voices: 'teamcamp',
      decide: firstOpen && firstOpen.id, master: firstNotGold && firstNotGold.id }[q.id] || null;
  }

  function islandHtml(isle, i) {
    const r = isle.r;
    const medal = status(isle);
    const w = isle.name.length * 8.6 + 26;
    const ly = r * 0.62 + 24;
    const label = `${isle.name}: ${isle.kind}${isle.scenario ? `, ${isle.scenario.title}` : ''}${medal ? `, ${medal} medallion earned` : ''}`;
    return `
      <g class="isle${selected === isle.id ? ' is-selected' : ''}" data-id="${isle.id}" tabindex="0" role="button" aria-label="${esc(label)}" transform="translate(${isle.x} ${isle.y})">
        <g class="isle-body">
          <ellipse cx="0" cy="${r * 0.2}" rx="${r * 1.32}" ry="${r * 0.7}" fill="#7fd3f7" opacity=".55"/>
          <path d="${blob(r, i * 7 + 3, 0.62)}" transform="translate(0 9)" fill="#d6ad62" ${L}/>
          <path d="${blob(r, i * 7 + 3, 0.62)}" fill="#f6dc9a" ${L}/>
          <path d="${blob(r * 0.74, i * 13 + 5, 0.6)}" transform="translate(0 -3)" fill="#86cf6a" stroke="#5aa64a" stroke-width="2"/>
          ${landmark(isle.landmark, r / 52)}
        </g>
        <g class="isle-label"><rect x="${-w / 2}" y="${ly - 15}" width="${w}" height="28" rx="14"/><text x="0" y="${ly + 4}" text-anchor="middle">${esc(isle.name)}</text></g>
        ${medal ? Scenes.medallion(medal, 26).replace('<svg ', `<svg x="${r * 0.62}" y="${-r * 1.05}" `) : ''}
      </g>`;
  }

  function markerHtml(id) {
    const isle = byId[id];
    if (!isle) return '';
    const w = isle.name.length * 8.6 + 26;
    const ly = isle.r * 0.62 + 24;
    return `<g transform="translate(${isle.x} ${isle.y})" aria-hidden="true">
      <ellipse class="isle-glow" cy="${isle.r * 0.1}" rx="${isle.r * 1.42}" ry="${isle.r * 0.82}" fill="none" stroke="#ffd54f" stroke-width="4" stroke-dasharray="10 8"/>
      <g transform="translate(${-w / 2 - 6} ${ly - 1})"><g class="isle-marker"><circle r="14" fill="#ffd54f" ${L} stroke-width="2.5"/>
      <text y="6" text-anchor="middle" font-family="Fredoka, sans-serif" font-weight="700" font-size="19" fill="${INK}">!</text></g></g></g>`;
  }

  function blimpHtml() {
    const head = Avatar.svg(Avatar.get(), { view: 'head' }).replace('<svg ', '<svg x="-15" y="17" width="30" height="30" ');
    return `
      <g id="blimp" aria-hidden="true"><g class="blimp-bob">
        <g class="blimp-hull">
          <path d="M-40 0l-16-14v28z" fill="#ffc23d" ${L}/>
          <ellipse rx="44" ry="20" fill="#ff7b6b" ${L} stroke-width="3"/>
          <path d="M-30-12q30-12 60 0" fill="none" stroke="#fff" stroke-width="3" opacity=".55" stroke-linecap="round"/>
        </g>
        <text y="7" text-anchor="middle" font-family="Fredoka, sans-serif" font-weight="700" font-size="16" fill="#fff" stroke="${INK}" stroke-width=".8">CQ</text>
        <path d="M-14 18l-6 20M14 18l6 20" stroke="${INK}" stroke-width="2"/>
        ${head}
        <rect x="-21" y="38" width="42" height="16" rx="6" fill="#ffd54f" ${L}/>
      </g></g>`;
  }

  // The blimp hovers above an island, or beside it when there is no room above.
  function blimpSpot(isle) {
    const above = isle.y - isle.r - 66;
    return above >= 26 ? { x: isle.x - 6, y: above } : { x: isle.x - isle.r - 52, y: Math.max(26, isle.y - 30) };
  }
  function placeBlimp(p, flip) {
    const b = document.getElementById('blimp');
    b.setAttribute('transform', `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`);
    b.querySelector('.blimp-hull').setAttribute('transform', flip ? 'scale(-1 1)' : '');
  }

  function draw() {
    const marker = questIsland();
    const waves = Array.from({ length: 26 }, (_, i) => {
      const x = (i * 197) % 1180 + 10;
      const y = (i * 131) % 600 + 20;
      return `<path d="M${x} ${y}q8-6 16 0t16 0" fill="none" stroke="#fff" stroke-width="2" opacity=".35" stroke-linecap="round"/>`;
    }).join('');
    map.innerHTML = `
      <defs><linearGradient id="sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3aa7f0"/><stop offset="1" stop-color="#1f7fd6"/></linearGradient></defs>
      <rect width="1200" height="640" fill="url(#sea)"/>${waves}
      <g transform="translate(70 575)" opacity=".85" aria-hidden="true"><circle r="34" fill="none" stroke="#fff" stroke-width="2"/><path d="M0-40l7 33-7 7-7-7zM0 40l7-33-7-7-7 7z" fill="#fff"/><path d="M-40 0l33-7 7 7-7 7zM40 0l-33-7-7 7 7 7z" fill="#cfe9ff"/><text y="-48" text-anchor="middle" font-family="Fredoka, sans-serif" font-size="14" font-weight="700" fill="#fff">N</text></g>
      ${islands.map(islandHtml).join('')}
      ${marker ? markerHtml(marker) : ''}
      <g aria-hidden="true">${[[60, 60, 1], [520, 40, 0.8], [880, 600, 0.9]].map(([x, y, s]) => `<g class="isle-cloud" style="animation-delay:${-x / 20}s"><g transform="translate(${x} ${y}) scale(${s})" fill="#fff" opacity=".8"><ellipse rx="42" ry="15"/><ellipse cx="-18" cy="-9" rx="20" ry="15"/><ellipse cx="14" cy="-13" rx="24" ry="18"/></g></g>`).join('')}</g>
      ${blimpHtml()}`;
    placeBlimp(blimpSpot(byId[Game.island()] || byId.base));
  }

  // ---------- the dock below the map ----------
  function dockHome() {
    const set = window.Avatar && Avatar.isSet();
    dock.innerHTML = `
      <div class="dock-icon" aria-hidden="true"><i class="bi bi-compass fs-3 text-primary"></i></div>
      <div class="flex-grow-1 min-w-0">
        <p class="eyebrow mb-0">How to play</p>
        <h2 class="h5">Pick an island to explore</h2>
        <p class="small text-muted-2 mb-0"><strong>1</strong> Create your field agent. <strong>2</strong> Choose an island and fly there. <strong>3</strong> Help its people through a field dilemma to win the island's medallion.</p>
      </div>
      ${set ? (sum && sum.next ? Game.nextQuestHtml(sum) : '') : '<button type="button" class="btn btn-pop" data-agent-open><i class="bi bi-person-plus" aria-hidden="true"></i> Create your field agent</button>'}`;
  }

  function dockIsland(isle) {
    const medal = status(isle);
    const s = isle.scenario;
    const stars = s && sum && App.Progress.get().completed[s.id] ? Game.stars(Game.overall(App.Progress.get().completed[s.id].scores)) : 0;
    dock.innerHTML = `
      <div class="dock-icon" aria-hidden="true">${medal ? Scenes.medallion(medal, 34) : `<svg viewBox="-40 -60 80 72" width="48" height="44">${LANDMARKS[isle.landmark] || ''}</svg>`}</div>
      <div class="flex-grow-1 min-w-0">
        <p class="eyebrow mb-0">${esc(isle.kind)}${s ? ` · ${esc(s.role)} · ${s.minutes} min` : ''}</p>
        <h2 class="h5 mb-1">${esc(isle.name)}</h2>
        <p class="small text-muted-2 mb-0">${s ? `<strong>${esc(s.title)}</strong> ${esc(s.summary)}` : esc(isle.text)}</p>
      </div>
      <div class="d-flex flex-wrap align-items-center gap-2">
        ${s ? (medal ? Game.starsHtml(stars) : `<span class="xp-avail">Up to +${Game.potential(s)} XP</span>`) : ''}
        ${isle.id === 'base'
          ? '<button type="button" class="btn btn-pop" data-agent-open><i class="bi bi-person-gear" aria-hidden="true"></i> Customize your agent</button>'
          : `<button type="button" class="btn btn-pop" id="isle-go"><i class="bi bi-send" aria-hidden="true"></i> Fly there</button>`}
      </div>`;
    const go = document.getElementById('isle-go');
    if (go) go.addEventListener('click', () => travel(isle));
  }

  function select(id, focusDock) {
    selected = id;
    map.querySelectorAll('.isle').forEach((g) => g.classList.toggle('is-selected', g.dataset.id === id));
    dockIsland(byId[id]);
    if (focusDock) {
      const btn = dock.querySelector('#isle-go, [data-agent-open]');
      if (btn) btn.focus();
    }
  }

  // Fly the blimp along an arc, then open the island's page.
  let flying = false;
  function travel(isle) {
    if (flying) return;
    const from = blimpSpot(byId[Game.island()] || byId.base);
    const to = blimpSpot(isle);
    Game.setIsland(isle.id);
    const arrive = () => { window.location.href = isle.href; };
    if (reduceMotion || (from.x === to.x && from.y === to.y)) {
      placeBlimp(to);
      arrive();
      return;
    }
    flying = true;
    const ctrl = { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - 130 };
    const flip = to.x < from.x;
    const start = performance.now();
    const duration = 1300;
    (function frame(now) {
      const t = Math.min(1, (now - start) / duration);
      const e = t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2;
      const q = (a, b, c) => (1 - e) * (1 - e) * a + 2 * (1 - e) * e * b + e * e * c;
      placeBlimp({ x: q(from.x, ctrl.x, to.x), y: q(from.y, ctrl.y, to.y) }, flip);
      if (t < 1) requestAnimationFrame(frame);
      else arrive();
    })(start);
  }

  map.addEventListener('click', (e) => {
    const g = e.target.closest('.isle');
    if (g) select(g.dataset.id, false);
  });
  map.addEventListener('keydown', (e) => {
    const g = e.target.closest('.isle');
    if (g && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      select(g.dataset.id, true);
    }
  });

  // ---------- your agent ----------
  function drawAgent() {
    if (!card) return;
    const set = Avatar.isSet();
    const name = String(App.Profile.get().name || '').trim();
    card.innerHTML = `
      <span class="agent-mini">${Avatar.svg(Avatar.get(), { view: 'head', title: 'Your field agent' })}</span>
      <div class="me-1">
        <div class="fw-bold">${esc(name || 'Your field agent')}</div>
        <div class="small text-muted-2">${sum ? `Level ${sum.level.number} · ${esc(sum.level.title)} · ${sum.counts.medals} of ${S.scenarios.length} medallions` : ''}</div>
      </div>
      <button type="button" class="btn btn-pop btn-sm text-nowrap" data-agent-open>${set ? 'Customize' : 'Create agent'}</button>`;
  }

  async function refresh() {
    sum = await Game.summary();
    draw();
    drawAgent();
    if (selected) select(selected, false);
    else dockHome();
  }
  await refresh();
  document.addEventListener('game:change', () => refresh().catch(() => {}));
  document.addEventListener('avatar:change', () => refresh().catch(() => {}));
})();
