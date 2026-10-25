// Home page deployment globe: each scenario is an exercise set in the context of a UN
// field mission. Choose one and the aircraft flies there on a great-circle route.
(async function () {
  'use strict';
  const { esc } = App;
  const el = document.getElementById('deploy-globe');
  const dock = document.getElementById('deploy-dock');
  const pick = document.getElementById('deploy-pick');
  const card = document.getElementById('agent-card');
  if (!el) return;
  const ATLAS = 'https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/';
  const LAND = ['#c7ecd6', '#fde3c3', '#dcd4fb', '#cde5fb', '#fbeaa5', '#f8d1de', '#d7edc4', '#f2dccb'];
  const HQ = { id: 'hq', name: 'UN Headquarters, New York', lng: -73.97, lat: 40.75 };
  const START = [-2, 15];
  const W = 800;
  const H = 520;
  const RADIUS = 236;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const PLANE = 'M0-18c1.6 0 2.6 2.2 2.6 5.2v5.4l13.4 7.4v3.4L2.6 0v8.6l4.8 3.6v2.6L0 13.2l-7.4 1.6v-2.6l4.8-3.6V0l-13.4 3.4V0l13.4-7.4v-5.4C-2.6-15.8-1.6-18 0-18z';

  let S;
  let M;
  try {
    [S, M] = await Promise.all([App.loadScenarios(), App.loadMissions()]);
  } catch (err) {
    App.showError(dock, err);
    return;
  }
  const missionById = Object.fromEntries(M.missions.map((m) => [m.id, m]));
  // Each exercise sits at the duty station of its mission context (scene.context in the data).
  const dests = S.scenarios.map((s) => {
    const m = missionById[(s.scene || {}).context] || missionById[s.missionIds[0]];
    const loc = m.locations[0];
    return { id: s.id, scenario: s, mission: m, lng: loc.lng, lat: loc.lat, also: s.missionIds.filter((id) => id !== m.id).map((id) => missionById[id]).filter(Boolean) };
  });
  const byId = Object.fromEntries(dests.map((d) => [d.id, d]));
  const here = () => byId[Game.location()] || HQ;
  let sum = null;
  let selected = null;
  let flying = false;

  pick.innerHTML = `<option value="">Choose an exercise…</option>${dests.map((d) =>
    `<option value="${d.id}">${esc(d.scenario.title)} (${esc(d.mission.acronym)})</option>`).join('')}`;

  // ---------- globe ----------
  let countries = null;
  try {
    if (!window.d3 || !window.topojson) throw new Error('no globe library');
    const atlas = await d3.json(`${ATLAS}countries-110m.json`);
    countries = topojson.feature(atlas, atlas.objects.countries).features;
  } catch (err) {
    el.insertAdjacentHTML('afterbegin', `<div class="globe-message"><div><i class="bi bi-wifi-off fs-2" aria-hidden="true"></i>
      <p class="mb-0 mt-2">The globe could not load (are you offline?). Choose an exercise from the list.</p></div></div>`);
  }

  const projection = countries ? d3.geoOrthographic().translate([W / 2, H / 2]).scale(RADIUS).clipAngle(90).precision(0.6) : null;
  const path = countries ? d3.geoPath(projection) : null;
  const hash = (s) => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  let svg = null;

  function center() {
    const [lambda, phi] = projection.rotate();
    return [-lambda, -phi];
  }
  function visible(lng, lat) {
    return d3.geoDistance([lng, lat], center()) < Math.PI / 2 - 0.04;
  }

  function build() {
    el.insertAdjacentHTML('afterbegin', `
      <svg class="globe-svg deploy-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="group" aria-label="Globe of exercise locations. Drag to turn it.">
        <defs>
          <radialGradient id="d-ocean" cx="38%" cy="32%" r="78%"><stop offset="0%" stop-color="#e4f6ff"/><stop offset="55%" stop-color="#9ed4f4"/><stop offset="100%" stop-color="#4f9bd8"/></radialGradient>
          <radialGradient id="d-glow" r="50%"><stop offset="86%" stop-color="#8fe3ff" stop-opacity=".55"/><stop offset="100%" stop-color="#8fe3ff" stop-opacity="0"/></radialGradient>
          <radialGradient id="d-shade" cx="30%" cy="25%" r="85%"><stop offset="0%" stop-color="#fff" stop-opacity=".28"/><stop offset="45%" stop-color="#fff" stop-opacity="0"/><stop offset="100%" stop-color="#0b1e44" stop-opacity=".32"/></radialGradient>
        </defs>
        <circle cx="${W / 2}" cy="${H / 2}" r="${RADIUS * 1.1}" fill="url(#d-glow)"/>
        <path class="d-ocean" fill="url(#d-ocean)"/>
        <path class="globe-graticule d-grid"/>
        <g class="globe-land d-land">${countries.map((f) => `<path fill="${LAND[hash(f.id || f.properties.name) % LAND.length]}"/>`).join('')}</g>
        <path class="d-shade" fill="url(#d-shade)" pointer-events="none"/>
        <path class="d-route" fill="none"/>
        <g class="d-hq" aria-hidden="true"><rect x="-5" y="-5" width="10" height="10" transform="rotate(45)"/><text x="-6" y="22">UN Headquarters</text></g>
        <g class="d-pins">${dests.map((d) => `
          <g class="dest" data-id="${d.id}" role="button" tabindex="0" aria-label="${esc(`${d.scenario.title}. Mission context: ${d.mission.acronym}, ${d.mission.scope[0]}`)}">
            <circle class="dest-pulse" r="13"/><circle class="dest-dot" r="7.5"/>
            <path class="dest-star" d="M0-4.2l1.2 2.5 2.8.4-2 1.9.5 2.7L0 2l-2.5 1.3.5-2.7-2-1.9 2.8-.4z"/>
            <g class="dest-label"><rect y="-30" height="20" rx="10"/><text y="-16" text-anchor="middle"></text></g>
          </g>`).join('')}</g>
        <g class="dest-label d-callout" aria-hidden="true"><rect y="-30" height="20" rx="10"/><text y="-16" text-anchor="middle"></text></g>
        <g class="d-plane" aria-hidden="true"><ellipse class="d-plane-shadow" cx="4" cy="6" rx="12" ry="6"/><path d="${PLANE}"/></g>
      </svg>`);
    svg = el.querySelector('svg');
  }

  // Draw everything for the current rotation. route: [from, to] or null; plane: { at, angle }.
  let route = null;
  let plane = null;
  function render() {
    if (!svg) return;
    svg.querySelector('.d-ocean').setAttribute('d', path({ type: 'Sphere' }));
    svg.querySelector('.d-shade').setAttribute('d', path({ type: 'Sphere' }));
    svg.querySelector('.d-grid').setAttribute('d', path(d3.geoGraticule10()));
    svg.querySelectorAll('.d-land path').forEach((p, i) => p.setAttribute('d', path(countries[i]) || ''));
    svg.querySelector('.d-route').setAttribute('d', route ? path({ type: 'LineString', coordinates: route }) || '' : '');
    const hq = svg.querySelector('.d-hq');
    const [hx, hy] = projection([HQ.lng, HQ.lat]);
    hq.setAttribute('transform', `translate(${hx.toFixed(1)} ${hy.toFixed(1)})`);
    hq.style.display = visible(HQ.lng, HQ.lat) ? '' : 'none';
    svg.querySelectorAll('.dest').forEach((g) => {
      const d = byId[g.dataset.id];
      const [x, y] = projection([d.lng, d.lat]);
      const on = visible(d.lng, d.lat);
      g.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
      g.style.display = on ? '' : 'none';
      g.setAttribute('tabindex', on ? '0' : '-1');
    });
    // The selected pin's label sits in its own layer above the other pins, so neighbors never cover it.
    const callout = svg.querySelector('.d-callout');
    const sd = selected && byId[selected];
    if (sd && visible(sd.lng, sd.lat)) {
      const [x, y] = projection([sd.lng, sd.lat]);
      callout.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
      callout.style.display = 'inline';
    } else {
      callout.style.display = 'none';
    }
    // Parked, the plane sits just beside its location so the pin and medal stay visible.
    const at = plane ? plane.at : [here().lng, here().lat];
    const pg = svg.querySelector('.d-plane');
    const [px, py] = projection(at);
    const [ox, oy] = plane ? [0, 0] : [17, -15];
    pg.setAttribute('transform', `translate(${(px + ox).toFixed(1)} ${(py + oy).toFixed(1)}) rotate(${(plane ? plane.angle : 40).toFixed(1)})`);
    pg.style.display = visible(at[0], at[1]) ? '' : 'none';
  }

  function setLabel(g, d) {
    const label = `${d.mission.acronym} · ${d.mission.scope[0].split(' (')[0]}`;
    g.querySelector('text').textContent = label;
    const w = label.length * 7 + 20;
    const rect = g.querySelector('rect');
    rect.setAttribute('x', -w / 2);
    rect.setAttribute('width', w);
  }

  function decorate() {
    if (!svg) return;
    const marked = questDest();
    svg.querySelectorAll('.dest').forEach((g) => {
      const d = byId[g.dataset.id];
      const medal = sum && sum.medals[d.id];
      g.setAttribute('class', `dest${medal ? ` is-done medal-${medal}` : ''}${selected === d.id ? ' is-selected' : ''}${marked === d.id ? ' is-next' : ''}`);
      setLabel(g.querySelector('.dest-label'), d);
    });
    if (selected) setLabel(svg.querySelector('.d-callout'), byId[selected]);
  }

  // The exercise the next quest points to gets a soft pulse.
  function questDest() {
    const q = sum && sum.next;
    if (!q) return null;
    if (q.id === 'decide') return (dests.find((d) => !sum.medals[d.id]) || {}).id || null;
    if (q.id === 'master') return (dests.find((d) => sum.medals[d.id] !== 'gold') || {}).id || null;
    return null;
  }

  // The angle equal to x (mod 360) that is nearest to ref, so the globe always turns the short way.
  const near = (x, ref) => ref + ((((x - ref) % 360) + 540) % 360 - 180);

  // Turn the globe to a point (shortest way round), then call done.
  function turnTo(lng, lat, done) {
    const r0 = projection.rotate();
    const r1 = [near(-lng, r0[0]), -lat * 0.7, 0];
    if (reduceMotion) {
      projection.rotate(r1);
      render();
      if (done) done();
      return;
    }
    const rot = d3.interpolate(r0, r1);
    const start = performance.now();
    (function frame(now) {
      const t = Math.min(1, (now - start) / 600);
      projection.rotate(rot(d3.easeCubicInOut(t)));
      render();
      if (t < 1) requestAnimationFrame(frame);
      else if (done) done();
    })(start);
  }

  // Fly from the current location to an exercise, with the globe turning beneath the plane.
  function fly(dest) {
    if (flying) return;
    const from = here();
    const a = [from.lng, from.lat];
    const b = [dest.lng, dest.lat];
    const arrive = () => {
      Game.setLocation(dest.id);
      window.location.href = `scenarios.html?id=${dest.id}`;
    };
    if (!svg || reduceMotion) {
      arrive();
      return;
    }
    flying = true;
    const interp = d3.geoInterpolate(a, b);
    const duration = Math.min(2600, 1100 + d3.geoDistance(a, b) * 900);
    turnTo(a[0], a[1], () => {
      const r0 = projection.rotate();
      const start = performance.now();
      (function frame(now) {
        const t = Math.min(1, (now - start) / duration);
        const e = d3.easeCubicInOut(t);
        const p = interp(e);
        const lerp = (x, y) => x + (y - x) * Math.min(1, t * 4);
        projection.rotate([lerp(r0[0], near(-p[0], r0[0])), lerp(r0[1], -p[1] * 0.7), 0]);
        const [x0, y0] = projection(p);
        const [x1, y1] = projection(interp(Math.min(1, e + 0.02)));
        const angle = t < 1 ? (Math.atan2(y1 - y0, x1 - x0) * 180) / Math.PI + 90 : (plane ? plane.angle : 0);
        plane = { at: p, angle };
        route = [a, p];
        render();
        if (t < 1) requestAnimationFrame(frame);
        else setTimeout(arrive, 250);
      })(start);
    });
  }

  // ---------- dock ----------
  function dockHome() {
    const set = Avatar.isSet();
    dock.innerHTML = `
      <div class="dock-icon" aria-hidden="true"><i class="bi bi-airplane"></i></div>
      <div class="flex-grow-1 min-w-0">
        <p class="eyebrow mb-0">How it works</p>
        <h2 class="h5 mb-1">Choose a mission context</h2>
        <p class="small text-muted-2 mb-0"><strong>1</strong> Create your avatar. <strong>2</strong> Choose an exercise on the globe. <strong>3</strong> Fly there and work through the field decision to earn a medal. All scenarios are fictional; the mission shows the kind of context they prepare you for.</p>
      </div>
      ${set ? (sum && sum.next ? Game.nextQuestHtml(sum) : '') : '<button type="button" class="btn btn-accent" data-agent-open><i class="bi bi-person-plus" aria-hidden="true"></i> Create your avatar</button>'}`;
  }

  function dockDest(d) {
    const s = d.scenario;
    const medal = sum && sum.medals[d.id];
    const done = App.Progress.get().completed[d.id];
    dock.innerHTML = `
      <div class="dock-icon" aria-hidden="true">${medal ? Scenes.medal(medal, 34) : '<i class="bi bi-geo-alt-fill"></i>'}</div>
      <div class="flex-grow-1 min-w-0">
        <p class="eyebrow mb-0">Exercise · ${esc(s.role)} · ${s.minutes} min</p>
        <h2 class="h5 mb-1">${esc(s.title)}</h2>
        <p class="small mb-1">${esc(s.summary)}</p>
        <p class="small text-muted-2 mb-0"><i class="bi bi-globe-americas" aria-hidden="true"></i> Mission context: <strong>${esc(d.mission.acronym)}</strong>, ${esc(d.mission.scope[0])}${d.also.length ? `. Also relevant to ${d.also.map((m) => esc(m.acronym)).join(', ')}` : ''}. The scenario itself is fictional.</p>
      </div>
      <div class="d-flex flex-wrap align-items-center gap-2">
        ${done ? Game.starsHtml(Game.stars(Game.overall(done.scores))) : `<span class="xp-avail">Up to +${Game.potential(s)} XP</span>`}
        <button type="button" class="btn btn-accent" id="deploy-go"><i class="bi bi-airplane" aria-hidden="true"></i> Fly there</button>
      </div>`;
    document.getElementById('deploy-go').addEventListener('click', () => fly(d));
  }

  function select(id, focusDock) {
    selected = id || null;
    pick.value = selected || '';
    decorate();
    if (!selected) {
      route = null;
      render();
      dockHome();
      return;
    }
    const d = byId[selected];
    const from = here();
    route = [[from.lng, from.lat], [d.lng, d.lat]];
    dockDest(d);
    if (svg && !visible(d.lng, d.lat)) turnTo(d.lng, d.lat);
    else render();
    if (focusDock) document.getElementById('deploy-go').focus();
  }

  // ---------- wiring ----------
  if (countries) {
    build();
    const start = byId[Game.location()];
    projection.rotate(start ? [-start.lng, -start.lat * 0.7, 0] : [-START[0], -START[1], 0]);
    render();
    d3.select(svg).call(d3.drag()
      .filter((event) => !event.button && !event.target.closest('.dest'))
      .on('drag', (event) => {
        if (flying) return;
        const [lambda, phi] = projection.rotate();
        const k = 75 / projection.scale();
        projection.rotate([lambda + event.dx * k * (W / el.clientWidth), Math.max(-80, Math.min(80, phi - event.dy * k * (W / el.clientWidth))), 0]);
        render();
      }));
    svg.addEventListener('click', (e) => {
      const g = e.target.closest('.dest');
      if (g && !flying) select(g.dataset.id, false);
    });
    svg.addEventListener('keydown', (e) => {
      const g = e.target.closest('.dest');
      if (g && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        select(g.dataset.id, true);
      }
    });
  }
  pick.addEventListener('change', () => select(pick.value, false));

  function drawAgent() {
    if (!card) return;
    const name = String(App.Profile.get().name || '').trim();
    card.innerHTML = `
      <span class="agent-mini">${Avatar.svg(Avatar.get(), { view: 'head', title: 'Your avatar' })}</span>
      <div class="me-1">
        <div class="fw-bold">${esc(name || 'Your avatar')}</div>
        <div class="small text-muted-2">${sum ? `Level ${sum.level.number} · ${esc(sum.level.title)} · ${sum.counts.medals} of ${S.scenarios.length} medals` : ''}</div>
      </div>
      <button type="button" class="btn btn-accent btn-sm text-nowrap" data-agent-open>${Avatar.isSet() ? 'Customize' : 'Create avatar'}</button>`;
  }

  async function refresh() {
    sum = await Game.summary();
    drawAgent();
    decorate();
    if (selected) dockDest(byId[selected]);
    else dockHome();
  }
  await refresh();
  document.addEventListener('game:change', () => refresh().catch(() => {}));
  document.addEventListener('avatar:change', () => refresh().catch(() => {}));
})();
