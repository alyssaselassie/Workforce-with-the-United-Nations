// Mission map: an interactive, spinning D3 globe, filters, a table and a detail panel.
(async function () {
  'use strict';
  const { esc } = App;

  const VERIFY = {
    'confirmed': { label: 'Confirmed', cls: 'text-bg-success' },
    'check-status': { label: 'Check status', cls: 'text-bg-warning' },
    'check-listing': { label: 'Check listing', cls: 'text-bg-secondary' }
  };
  const STATUS = {
    active: { label: 'Active', cls: 'text-bg-light border' },
    closing: { label: 'Closing', cls: 'text-bg-warning' }
  };
  const ATLAS = 'https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/';
  // Markers closer than this on screen (in pixels) are merged into one.
  const GROUP_PIXELS = 26;
  // Degrees per millisecond: about one turn a minute.
  const SPIN_SPEED = 0.006;
  const START = { center: [18, 12], zoom: 1 };
  const MIN_ZOOM = 0.8;
  const MAX_ZOOM = 8;
  // Load the detailed map once the view is zoomed in this far.
  const DETAIL_ZOOM = 2.2;
  // Pastel patchwork for countries, so neighbors are easy to tell apart.
  const LAND = ['#c7ecd6', '#fde3c3', '#dcd4fb', '#cde5fb', '#fbeaa5', '#f8d1de', '#d7edc4', '#f2dccb'];
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const els = {
    search: document.getElementById('f-search'),
    type: document.getElementById('f-type'),
    region: document.getElementById('f-region'),
    form: document.getElementById('filters'),
    legend: document.getElementById('legend'),
    chips: document.getElementById('region-chips'),
    rows: document.getElementById('mission-rows'),
    count: document.getElementById('count'),
    panel: document.getElementById('mission-panel'),
    notice: document.getElementById('data-notice'),
    concluded: document.getElementById('concluded'),
    globe: document.getElementById('globe'),
    tip: document.getElementById('g-tip'),
    passport: document.getElementById('passport')
  };

  let data, scenarios;
  let selectedId = null;
  let globe = null;

  try {
    [data, scenarios] = await Promise.all([App.loadMissions(), App.loadScenarios()]);
  } catch (err) {
    App.showError(els.panel, err);
    return;
  }

  const byId = Object.fromEntries(data.missions.map((m) => [m.id, m]));
  const scenarioById = Object.fromEntries(scenarios.scenarios.map((s) => [s.id, s]));

  // A scenario is linked to a mission if either side lists the other.
  function linkedScenarios(m) {
    const ids = new Set(m.scenarioIds || []);
    scenarios.scenarios.forEach((s) => { if (s.missionIds.includes(m.id)) ids.add(s.id); });
    return [...ids].map((id) => scenarioById[id]).filter(Boolean);
  }

  function typeBadge(m) {
    const t = data.types[m.type];
    return `<span class="badge type-badge" style="background:${t.color}">${esc(t.label)}</span>`;
  }

  // ---------- filters ----------
  Object.entries(data.types).forEach(([key, t]) => {
    els.type.insertAdjacentHTML('beforeend', `<option value="${key}">${esc(t.label)}</option>`);
  });
  const regionNames = Object.keys(data.regions).filter((r) => data.missions.some((m) => m.region === r));
  regionNames.forEach((r) => els.region.insertAdjacentHTML('beforeend', `<option>${esc(r)}</option>`));
  els.legend.innerHTML = Object.values(data.types).map((t) => `
    <span class="type-chip" style="--chip:${t.color}"><span class="legend-dot" style="background:${t.color}"></span>${esc(t.label)}</span>`).join('');

  els.chips.innerHTML = `
    <button type="button" class="region-chip" data-region="" style="--chip:#2f6fd0" aria-pressed="true"><i class="bi bi-globe2" aria-hidden="true"></i> Whole world</button>
    ${regionNames.map((r) => `
      <button type="button" class="region-chip" data-region="${esc(r)}" style="--chip:${data.regions[r].color}" aria-pressed="false">
        <span class="legend-dot" style="background:${data.regions[r].color}"></span>${esc(r)}
        <span class="chip-count">${data.missions.filter((m) => m.region === r).length}</span>
      </button>`).join('')}`;

  function syncChips() {
    els.chips.querySelectorAll('.region-chip').forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.region === els.region.value)));
  }

  // ---------- field passport ----------
  // Opening a mission stamps it. Region chips show how many of their missions are stamped.
  function syncPassport() {
    const stamps = Game.stamps();
    const stamped = data.missions.filter((m) => stamps[m.id]);
    const regions = regionNames.filter((r) => stamped.some((m) => m.region === r));
    const share = Math.round((stamped.length / data.missions.length) * 100);
    els.chips.querySelectorAll('.region-chip[data-region]:not([data-region=""])').forEach((chip) => {
      const all = data.missions.filter((m) => m.region === chip.dataset.region);
      const done = all.filter((m) => stamps[m.id]).length;
      chip.querySelector('.chip-count').textContent = stamped.length ? `${done}/${all.length}` : all.length;
      chip.title = `${done} of ${all.length} missions stamped`;
    });
    if (!els.passport) return;
    els.passport.innerHTML = `
      <span class="passport-icon" aria-hidden="true"><i class="bi bi-passport"></i></span>
      <div>
        <div class="fw-bold">Field passport</div>
        <div class="small text-muted-2">${stamped.length
          ? `<strong>${stamped.length}</strong> of ${data.missions.length} missions stamped · <strong>${regions.length}</strong> of ${regionNames.length} regions`
          : 'Open any mission to stamp your passport.'}</div>
      </div>
      <div class="progress" role="progressbar" aria-label="Missions stamped" aria-valuenow="${share}" aria-valuemin="0" aria-valuemax="100"><div class="progress-bar" style="width:${share}%"></div></div>
      <span class="xp-avail">+${Game.XP.stamp} XP per mission · +${Game.XP.region} XP per new region</span>`;
  }

  els.chips.addEventListener('click', (e) => {
    const chip = e.target.closest('.region-chip');
    if (!chip) return;
    els.region.value = chip.dataset.region;
    syncChips();
    refresh();
    if (!globe) return;
    if (chip.dataset.region) globe.showRegion(data.regions[chip.dataset.region]);
    else globe.showWorld();
  });

  const preset = App.param('type');
  if (preset && data.types[preset]) els.type.value = preset;

  function filtered() {
    const q = els.search.value.trim().toLowerCase();
    return data.missions.filter((m) => {
      if (els.type.value && m.type !== els.type.value) return false;
      if (els.region.value && m.region !== els.region.value) return false;
      if (!q) return true;
      return [m.acronym, m.name, m.region, ...m.scope].join(' ').toLowerCase().includes(q);
    });
  }

  // ---------- notice ----------
  const unverified = data.missions.filter((m) => m.verification !== 'confirmed').length;
  els.notice.innerHTML = `
    <div class="alert alert-info small d-flex gap-2" role="note">
      <i class="bi bi-patch-check" aria-hidden="true"></i>
      <div>Dataset compiled ${esc(data.meta.compiledOn)}. ${unverified} of ${data.missions.length} entries are flagged
      <em>check status</em> or <em>check listing</em> and should be checked against the
      <a href="${esc(data.meta.primarySource)}" target="_blank" rel="noopener">live directory</a> before a public demonstration.</div>
    </div>`;

  // ---------- globe ----------
  async function createGlobe(el) {
    if (!window.d3 || !window.topojson) throw new Error('The globe library could not load.');
    const toFeatures = (atlas) => topojson.feature(atlas, atlas.objects.countries).features;
    const coarse = toFeatures(await d3.json(`${ATLAS}countries-110m.json`));
    let detailed = null;
    let detailRequested = false;
    let features = coarse;

    let width = el.clientWidth;
    let height = el.clientHeight;
    let radius = Math.min(width, height) / 2 - 18;
    let zoom = START.zoom;
    let missions = [];
    let highlighted = null;
    let spinning = !reduceMotion;
    let dragging = false;
    let hovering = false;
    let flying = false;
    let timer = null;

    const projection = d3.geoOrthographic()
      .rotate([-START.center[0], -START.center[1], 0])
      .translate([width / 2, height / 2])
      .scale(radius * zoom)
      .clipAngle(90)
      .precision(0.6);
    const path = d3.geoPath(projection);
    const graticule = d3.geoGraticule10();
    const keyOf = (f) => f.id || f.properties.name;
    const hash = (s) => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

    const svg = d3.select(el).insert('svg', ':first-child')
      .attr('class', 'globe-svg')
      .attr('width', width)
      .attr('height', height);

    // Gradients: a lit ocean, a soft atmosphere and shading for depth.
    const defs = svg.append('defs');
    const gradient = (id, attrs, stops) => {
      const g = defs.append('radialGradient').attr('id', id);
      Object.entries(attrs).forEach(([k, v]) => g.attr(k, v));
      stops.forEach(([offset, color, opacity]) => g.append('stop').attr('offset', offset).attr('stop-color', color).attr('stop-opacity', opacity));
    };
    gradient('g-ocean', { cx: '38%', cy: '32%', r: '78%' }, [['0%', '#e4f6ff', 1], ['55%', '#9ed4f4', 1], ['100%', '#4f9bd8', 1]]);
    gradient('g-glow', { r: '50%' }, [['86%', '#8fe3ff', 0.55], ['100%', '#8fe3ff', 0]]);
    gradient('g-shade', { cx: '30%', cy: '25%', r: '85%' }, [['0%', '#ffffff', 0.28], ['45%', '#ffffff', 0], ['100%', '#0b1e44', 0.32]]);

    const glow = svg.append('circle').attr('class', 'globe-glow').attr('fill', 'url(#g-glow)');
    const ocean = svg.append('path').attr('class', 'globe-ocean').attr('fill', 'url(#g-ocean)');
    const grid = svg.append('path').attr('class', 'globe-graticule');
    const land = svg.append('g').attr('class', 'globe-land');
    const scope = svg.append('g').attr('class', 'globe-scope');
    const shade = svg.append('path').attr('class', 'globe-shade').attr('fill', 'url(#g-shade)');
    const markers = svg.append('g').attr('class', 'globe-markers');

    function drawLand() {
      land.selectAll('path').data(features, keyOf).join('path')
        .attr('fill', (f) => LAND[hash(keyOf(f)) % LAND.length]);
    }

    // Countries in the selected mandate, filled with the mission type's color.
    function drawScope() {
      const m = highlighted;
      const ids = new Set(m ? m.mapIds || [] : []);
      const color = m ? data.types[m.type].color : '#000';
      scope.selectAll('path')
        .data(features.filter((f) => ids.has(f.id) || ids.has(f.properties.name)), keyOf)
        .join((enter) => enter.append('path').attr('class', 'scope-path')
          .style('opacity', 0)
          .call((s) => s.transition().duration(reduceMotion ? 0 : 700).style('opacity', 1)))
        .attr('fill', color)
        .attr('stroke', d3.color(color).darker(0.8));
    }

    function render() {
      const [cx, cy] = projection.translate();
      const r = projection.scale();
      const sphere = path({ type: 'Sphere' });
      glow.attr('cx', cx).attr('cy', cy).attr('r', r * 1.12);
      ocean.attr('d', sphere);
      shade.attr('d', sphere);
      grid.attr('d', path(graticule));
      land.selectAll('path').attr('d', path);
      scope.selectAll('path').attr('d', path);
      drawMarkers();
    }

    // Group visible locations whose markers would overlap at the current zoom.
    function groups() {
      const [lambda, phi] = projection.rotate();
      const center = [-lambda, -phi];
      const list = [];
      missions.forEach((m) => m.locations.forEach((loc) => {
        const point = [loc.lng, loc.lat];
        if (d3.geoDistance(point, center) > Math.PI / 2 - 0.04) return; // far side of the globe
        const [x, y] = projection(point);
        const g = list.find((q) => Math.hypot(q.x - x, q.y - y) < GROUP_PIXELS);
        if (g) g.items.push({ mission: m, loc });
        else list.push({ x, y, lng: loc.lng, lat: loc.lat, items: [{ mission: m, loc }] });
      }));
      list.forEach((g) => {
        g.ids = [...new Set(g.items.map((i) => i.mission.id))];
        g.key = g.ids.slice().sort().join('|');
      });
      return list;
    }

    function drawMarkers() {
      const showLabels = zoom >= 2.4;
      markers.selectAll('g.globe-pin').data(groups(), (g) => g.key).join((enter) => {
        const pin = enter.append('g').attr('class', 'globe-pin').attr('tabindex', 0).attr('role', 'button');
        pin.append('circle').attr('class', 'pin-pulse');
        pin.append('circle').attr('class', 'pin-dot');
        pin.append('text').attr('class', 'pin-count');
        pin.append('text').attr('class', 'pin-label').attr('x', 13).attr('y', 4);
        const stamp = pin.append('g').attr('class', 'pin-stamp').attr('aria-hidden', 'true');
        stamp.append('circle').attr('r', 5.5);
        stamp.append('text').text('✓');
        pin.on('click', (event, g) => activate(g))
          .on('keydown', (event, g) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              activate(g);
            }
          })
          .on('pointerenter focus', (event, g) => { hovering = true; showTip(g); })
          .on('pointerleave blur', () => { hovering = false; hideTip(); });
        return pin;
      })
        .attr('transform', (g) => `translate(${g.x},${g.y})`)
        .classed('is-active', (g) => g.ids.includes(selectedId))
        .classed('is-visited', (g) => g.ids.every((id) => Game.isStamped(id)))
        .attr('aria-label', (g) => g.ids.map((id) => `${byId[id].acronym}: ${byId[id].name}`).join('; '))
        .each(function (g) {
          const many = g.ids.length > 1;
          const color = many ? '#334155' : data.types[byId[g.ids[0]].type].color;
          const pin = d3.select(this);
          pin.select('.pin-dot').attr('r', many ? 11 : 8).attr('fill', color);
          pin.select('.pin-pulse').attr('r', many ? 11 : 8).attr('stroke', color);
          pin.select('.pin-count').text(many ? g.ids.length : '');
          pin.select('.pin-stamp').attr('transform', many ? 'translate(9,-9)' : 'translate(7,-7)');
          pin.select('.pin-label').text(!many && showLabels ? byId[g.ids[0]].acronym : '');
        });
    }

    function showTip(g) {
      els.tip.innerHTML = g.items.map((i) => `<strong>${esc(i.mission.acronym)}</strong> · ${esc(i.loc.label)}`).join('<br>');
      els.tip.style.left = `${Math.min(g.x + 16, width - 220)}px`;
      els.tip.style.top = `${Math.max(g.y - 14, 8)}px`;
      els.tip.hidden = false;
    }

    function hideTip() {
      els.tip.hidden = true;
    }

    function activate(g) {
      hideTip();
      if (g.ids.length === 1) {
        select(g.ids[0], false);
      } else {
        showGroup(g.items);
        setSpin(false);
        flyTo([g.lng, g.lat], Math.min(Math.max(zoom * 2, 3), MAX_ZOOM));
      }
    }

    // ---------- zoom and detail ----------
    function setZoom(z) {
      zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z));
      projection.scale(radius * zoom);
      if (!flying) useDetail(zoom >= DETAIL_ZOOM);
    }

    // Swap between the light world map and the detailed one (loaded on demand).
    function useDetail(on) {
      if (on && !detailed && !detailRequested) {
        detailRequested = true;
        d3.json(`${ATLAS}countries-50m.json`)
          .then((atlas) => {
            detailed = toFeatures(atlas);
            if (zoom >= DETAIL_ZOOM) useDetail(true);
          })
          .catch(() => { /* keep the light map */ });
      }
      const next = on && detailed ? detailed : coarse;
      if (next === features) return;
      features = next;
      drawLand();
      drawScope();
      render();
    }

    // Turn the globe to a point and zoom, dipping out a little mid-flight.
    function flyTo([lng, lat], z1) {
      const r0 = projection.rotate();
      const r1 = [-lng, -lat, 0];
      r1[0] = r0[0] + ((((r1[0] - r0[0]) % 360) + 540) % 360 - 180);
      const z0 = zoom;
      d3.select(el).interrupt('fly');
      if (reduceMotion) {
        projection.rotate(r1);
        setZoom(z1);
        render();
        return;
      }
      flying = true;
      d3.select(el).transition('fly').duration(1500).ease(d3.easeCubicInOut)
        .tween('fly', () => {
          const rotate = d3.interpolate(r0, r1);
          return (t) => {
            projection.rotate(rotate(t));
            zoom = (z0 + (z1 - z0) * t) * (1 - 0.22 * Math.sin(Math.PI * t));
            projection.scale(radius * zoom);
            render();
          };
        })
        .on('end', () => { flying = false; setZoom(z1); render(); })
        .on('interrupt', () => { flying = false; });
    }

    // Fit the mandate's countries, or zoom in on the office when there are none.
    function viewFor(m) {
      const ids = new Set(m.mapIds || []);
      const pool = detailed || coarse;
      const area = pool.filter((f) => ids.has(f.id) || ids.has(f.properties.name));
      if (!area.length) {
        return { center: [m.locations[0].lng, m.locations[0].lat], zoom: m.multiCountry ? 3.2 : 6 };
      }
      const [[w, s], [e, n]] = d3.geoBounds({ type: 'FeatureCollection', features: area });
      const spanLng = e >= w ? e - w : e - w + 360;
      const extent = Math.max(spanLng, (n - s) * 1.25, 2);
      return { center: [w + spanLng / 2, (s + n) / 2], zoom: Math.max(1.4, Math.min(MAX_ZOOM, 55 / extent)) };
    }

    // ---------- spinning ----------
    const spinButton = document.getElementById('g-spin');
    function setSpin(on) {
      spinning = on;
      spinButton.setAttribute('aria-pressed', String(on));
      spinButton.title = on ? 'Pause spinning' : 'Spin the globe';
      spinButton.innerHTML = `<i class="bi ${on ? 'bi-pause-fill' : 'bi-play-fill'}" aria-hidden="true"></i><span class="visually-hidden">Spin the globe</span>`;
      if (on && !timer) {
        let last = performance.now();
        timer = d3.timer(() => {
          const now = performance.now();
          const dt = Math.min(now - last, 50);
          last = now;
          if (dragging || hovering || flying || document.hidden) return;
          const [lambda, phi, gamma] = projection.rotate();
          projection.rotate([lambda + dt * SPIN_SPEED, phi, gamma]);
          render();
        });
      } else if (!on && timer) {
        timer.stop();
        timer = null;
      }
    }

    // ---------- interaction ----------
    svg.call(d3.drag()
      .filter((event) => !event.ctrlKey && !event.button && !event.target.closest('.globe-pin'))
      .on('start', () => {
        dragging = true;
        d3.select(el).interrupt('fly');
        flying = false;
        el.classList.add('is-dragging');
        hideTip();
      })
      .on('drag', (event) => {
        const [lambda, phi, gamma] = projection.rotate();
        const k = 75 / projection.scale();
        projection.rotate([lambda + event.dx * k, Math.max(-85, Math.min(85, phi - event.dy * k)), gamma]);
        render();
      })
      .on('end', () => {
        dragging = false;
        el.classList.remove('is-dragging');
      }));

    svg.on('wheel', (event) => {
      event.preventDefault();
      d3.select(el).interrupt('fly');
      flying = false;
      setZoom(zoom * Math.exp(-event.deltaY * 0.0015));
      render();
    }, { passive: false });
    svg.on('pointerleave', () => { hovering = false; });

    const center = () => {
      const [lambda, phi] = projection.rotate();
      return [-lambda, -phi];
    };
    spinButton.addEventListener('click', () => setSpin(!spinning));
    document.getElementById('g-in').addEventListener('click', () => flyTo(center(), zoom * 1.6));
    document.getElementById('g-out').addEventListener('click', () => flyTo(center(), zoom / 1.6));
    document.getElementById('g-reset').addEventListener('click', () => api.showWorld());

    new ResizeObserver(() => {
      if (el.clientWidth === width && el.clientHeight === height) return;
      width = el.clientWidth;
      height = el.clientHeight;
      radius = Math.min(width, height) / 2 - 18;
      svg.attr('width', width).attr('height', height);
      projection.translate([width / 2, height / 2]).scale(radius * zoom);
      render();
    }).observe(el);

    drawLand();
    render();
    setSpin(spinning);

    const api = {
      setMissions(list) {
        missions = list;
        drawMarkers();
      },
      focus(m) {
        highlighted = m;
        drawScope();
        setSpin(false);
        const view = viewFor(m);
        flyTo(view.center, view.zoom);
      },
      showRegion(region) {
        setSpin(false);
        flyTo(region.center, region.zoom);
      },
      showWorld() {
        flyTo(START.center, START.zoom);
        if (!reduceMotion) setSpin(true);
      },
      // Exposed for tests and debugging.
      state: () => ({ rotate: projection.rotate(), zoom, spinning, detailed: features === detailed })
    };
    return api;
  }

  try {
    globe = await createGlobe(els.globe);
    els.globe.globe = globe;
  } catch (err) {
    els.globe.classList.add('is-failed');
    els.globe.querySelector('.globe-controls').hidden = true;
    els.globe.insertAdjacentHTML('afterbegin', `
      <div class="globe-message">
        <div><i class="bi bi-wifi-off fs-2" aria-hidden="true"></i>
        <p class="mb-0 mt-2">The globe could not load (are you offline?). You can still use the table below.</p></div>
      </div>`);
  }

  // ---------- table ----------
  function renderRows(missions) {
    els.count.textContent = missions.length;
    if (!missions.length) {
      els.rows.innerHTML = '<tr><td colspan="5" class="text-center text-muted-2 py-4">No entries match these filters.</td></tr>';
      return;
    }
    els.rows.innerHTML = missions.map((m) => `
      <tr class="mission-row${m.id === selectedId ? ' is-active' : ''}" data-id="${m.id}" tabindex="0" aria-label="Show details for ${esc(m.acronym)}">
        <td><strong>${esc(m.acronym)}</strong><div class="small text-muted-2">${esc(m.name)}</div></td>
        <td>${typeBadge(m)}</td>
        <td class="small">${m.scope.map(esc).join(', ')}</td>
        <td><span class="badge ${STATUS[m.status].cls}">${STATUS[m.status].label}</span>
            <span class="badge ${VERIFY[m.verification].cls}">${VERIFY[m.verification].label}</span></td>
        <td class="small"><a href="${esc(m.sourceUrl)}" target="_blank" rel="noopener">Source <i class="bi bi-box-arrow-up-right" aria-hidden="true"></i></a></td>
      </tr>`).join('');
  }

  els.rows.addEventListener('click', (e) => {
    if (e.target.closest('a')) return;
    const row = e.target.closest('.mission-row');
    if (row) select(row.dataset.id, true);
  });
  els.rows.addEventListener('keydown', (e) => {
    const row = e.target.closest('.mission-row');
    if (row && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      select(row.dataset.id, true);
    }
  });

  // ---------- detail panel ----------
  function reflectionPrompts(m) {
    const prompts = [
      `What do I actually know about the history and current context of ${m.scope.length === 1 ? m.scope[0] : 'each country in this mandate'}, and what am I assuming?`,
      'Who among my national colleagues can help me understand local communication norms, and how will I make space for their expertise?',
      'Which groups, such as women, youth, minorities, people with disabilities or displaced people, are least likely to be heard by this mission, and how can I reach them?'
    ];
    if (m.multiCountry) {
      prompts.unshift(`This mandate covers ${m.scope.length > 1 ? m.scope.length + ' countries or areas' : 'a multi-country region'}. How will I avoid generalizing one place's dynamics onto the others?`);
    }
    if (m.scopeNote && /status|terminology|position|resolution 1244/i.test(m.scopeNote)) {
      prompts.push('Which terms are contested in this context, and what is the mission\'s approved terminology?');
    }
    return prompts;
  }

  function showGroup(items) {
    const seen = new Set();
    const unique = items.filter((i) => !seen.has(i.mission.id) && seen.add(i.mission.id));
    els.panel.classList.remove('has-type');
    els.panel.innerHTML = `
      <p class="eyebrow mb-1">Nearby offices</p>
      <h2 class="h5">${unique.length} entries in this area</h2>
      <p class="small text-muted-2">The globe zooms in to separate them. Or choose one:</p>
      <div class="list-group">
        ${unique.map((i) => `<button type="button" class="list-group-item list-group-item-action" data-select="${i.mission.id}">
          <span class="legend-dot" style="background:${data.types[i.mission.type].color}"></span><strong>${esc(i.mission.acronym)}</strong> <span class="small text-muted-2">${esc(i.loc.label)}</span></button>`).join('')}
      </div>`;
  }

  els.panel.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-select]');
    if (btn) select(btn.dataset.select, false);
  });

  function select(id, fromTable) {
    const m = byId[id];
    if (!m) return;
    selectedId = id;
    const t = data.types[m.type];
    const linked = linkedScenarios(m);
    const visit = Game.onMissionExplored(m);

    els.panel.classList.add('has-type');
    els.panel.style.setProperty('--type', t.color);
    els.panel.innerHTML = `
      <p class="eyebrow mb-1"><span class="legend-dot" style="background:${data.regions[m.region].color}"></span>${esc(m.region)}</p>
      <h2 class="h5 mb-1">${esc(m.acronym)}</h2>
      <p class="mb-2">${esc(m.name)}</p>
      <div class="mb-3">${typeBadge(m)}
        <span class="badge ${STATUS[m.status].cls}">${STATUS[m.status].label}</span>
        <span class="badge ${VERIFY[m.verification].cls}" title="${esc(data.meta.verificationLegend[m.verification])}">${VERIFY[m.verification].label}</span>
        <span class="stamp-chip ms-1${visit.stamped ? ' is-new' : ''}"><i class="bi bi-postage" aria-hidden="true"></i> ${visit.stamped ? 'Stamp added' : 'Stamped'}</span>
      </div>

      <h3 class="h6"><i class="bi bi-images" aria-hidden="true"></i> Photos</h3>
      <div class="mission-photos mb-3" id="mission-photos"></div>

      <dl class="small mb-3">
        <dt>Geographic scope${m.multiCountry ? ' <span class="badge text-bg-light border">multi-country / regional</span>' : ''}</dt>
        <dd>${m.scope.map((c) => `<span class="scope-chip">${esc(c)}</span>`).join('')}</dd>
        ${m.scopeNote ? `<dd class="text-muted-2">${esc(m.scopeNote)}</dd>` : ''}
        <dt>Location${m.locations.length > 1 ? 's' : ''}</dt>
        <dd>${m.locations.map((l) => esc(l.label)).join('<br>')}</dd>
        <dt>Established</dt><dd>${esc(m.established)}</dd>
        <dt>Lead department</dt><dd>${esc(t.lead)}</dd>
        ${m.statusNote ? `<dt>Status note</dt><dd>${esc(m.statusNote)}</dd>` : ''}
        <dt>Official source</dt>
        <dd><a href="${esc(m.sourceUrl)}" target="_blank" rel="noopener">${esc(m.sourceUrl.replace(/^https?:\/\//, ''))}</a></dd>
      </dl>

      <h3 class="h6"><i class="bi bi-journal-text" aria-hidden="true"></i> Pre-deployment reflection</h3>
      <ul class="small ps-3">${reflectionPrompts(m).map((p) => `<li class="mb-1">${esc(p)}</li>`).join('')}</ul>
      <p class="small text-muted-2">Treat cultural knowledge as a hypothesis to test with local colleagues, never as a conclusion about individuals.</p>

      <h3 class="h6 mt-3"><i class="bi bi-signpost-split" aria-hidden="true"></i> Practice with linked scenarios</h3>
      ${linked.length ? `<div class="d-grid gap-2">${linked.map((s) => `
        <a class="btn btn-outline-primary btn-sm text-start" href="scenarios.html?id=${s.id}&amp;mission=${m.id}">
          <strong>${esc(s.title)}</strong><br><span class="small">${esc(s.summary)}</span></a>`).join('')}</div>`
        : '<p class="small text-muted-2">No linked scenarios yet.</p>'}`;
    els.panel.scrollTop = 0;

    syncPassport();
    refresh();
    if (globe) globe.focus(m);
    if (window.MissionPhotos) MissionPhotos.render(document.getElementById('mission-photos'), m, () => selectedId === id);
    if (fromTable && window.matchMedia('(max-width: 991.98px)').matches) {
      els.panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  // ---------- recently concluded ----------
  els.concluded.innerHTML = `
    <h2 class="h6 mb-2"><i class="bi bi-archive" aria-hidden="true"></i> Recently concluded (not shown on the globe)</h2>
    <ul class="small mb-0">
      ${data.recentlyConcluded.map((c) => `<li><strong>${esc(c.acronym)}</strong>, ${esc(c.name)} (${esc(c.scope)}): ended ${esc(c.ended)}. ${esc(c.note)}</li>`).join('')}
    </ul>`;

  // ---------- wiring ----------
  function refresh() {
    const list = filtered();
    renderRows(list);
    if (globe) globe.setMissions(list);
  }

  ['input', 'change'].forEach((ev) => els.form.addEventListener(ev, () => { syncChips(); refresh(); }));
  els.region.addEventListener('change', () => {
    if (!globe) return;
    if (els.region.value) globe.showRegion(data.regions[els.region.value]);
    else globe.showWorld();
  });
  els.form.addEventListener('reset', () => setTimeout(() => { syncChips(); refresh(); }, 0));
  els.form.addEventListener('submit', (e) => e.preventDefault());

  syncChips();
  syncPassport();
  refresh();
  const initial = App.param('mission');
  if (initial && byId[initial]) select(initial, true);
})();
