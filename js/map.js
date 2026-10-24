// Mission map: Leaflet map + filterable table + detail panel.
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
  // Pins closer than this on screen (in pixels) are merged into one.
  const GROUP_PIXELS = 24;

  const els = {
    search: document.getElementById('f-search'),
    type: document.getElementById('f-type'),
    region: document.getElementById('f-region'),
    form: document.getElementById('filters'),
    legend: document.getElementById('legend'),
    rows: document.getElementById('mission-rows'),
    count: document.getElementById('count'),
    panel: document.getElementById('mission-panel'),
    notice: document.getElementById('data-notice'),
    concluded: document.getElementById('concluded')
  };

  let data, scenarios, map, markerLayer;
  let selectedId = null;

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
  [...new Set(data.missions.map((m) => m.region))].sort().forEach((r) => {
    els.region.insertAdjacentHTML('beforeend', `<option>${esc(r)}</option>`);
  });
  els.legend.innerHTML = Object.values(data.types)
    .map((t) => `<span class="me-3"><span class="legend-dot" style="background:${t.color}"></span>${esc(t.label)}</span>`)
    .join('');

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

  // ---------- map ----------
  const hasLeaflet = typeof window.L !== 'undefined';
  if (hasLeaflet) {
    map = L.map('map', { worldCopyJump: true, minZoom: 2 }).setView([18, 20], 2);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 12,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
    markerLayer = L.layerGroup().addTo(map);
  } else {
    document.getElementById('map').innerHTML = `
      <div class="p-4 text-center">
        <i class="bi bi-wifi-off fs-2" aria-hidden="true"></i>
        <p class="mb-0 mt-2">The map library could not load (are you offline?). You can still use the table below.</p>
      </div>`;
  }

  // Group locations whose pins would overlap on screen at the current zoom,
  // so crowded areas (e.g. the Eastern Mediterranean) share one numbered pin.
  function groupLocations(missions) {
    const zoom = map.getZoom();
    const groups = [];
    missions.forEach((m) => {
      m.locations.forEach((loc) => {
        const pt = map.project([loc.lat, loc.lng], zoom);
        const g = groups.find((x) => x.pt.distanceTo(pt) < GROUP_PIXELS);
        const entry = { mission: m, loc };
        if (g) g.items.push(entry);
        else groups.push({ pt, lat: loc.lat, lng: loc.lng, items: [entry] });
      });
    });
    return groups;
  }

  function renderMarkers(missions) {
    if (!hasLeaflet) return;
    markerLayer.clearLayers();
    groupLocations(missions).forEach((g) => {
      const ids = [...new Set(g.items.map((i) => i.mission.id))];
      const first = byId[ids[0]];
      const color = ids.length > 1 ? '#334155' : data.types[first.type].color;
      const active = ids.includes(selectedId) ? ' is-active' : '';
      const icon = L.divIcon({
        className: '',
        html: `<span class="map-pin${active}" style="background:${color}">${ids.length > 1 ? ids.length : ''}</span>`,
        iconSize: [26, 26],
        iconAnchor: [13, 13]
      });
      const title = ids.map((id) => byId[id].acronym).join(', ');
      const marker = L.marker([g.lat, g.lng], { icon, title, keyboard: true, alt: title });
      marker.bindTooltip(g.items.map((i) => `<strong>${esc(i.mission.acronym)}</strong> · ${esc(i.loc.label)}`).join('<br>'));
      marker.on('click', () => {
        if (ids.length === 1) select(ids[0], false);
        else showGroup(g.items);
      });
      markerLayer.addLayer(marker);
    });
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
      prompts.unshift(`This mandate covers ${m.scope.length > 1 ? m.scope.length + ' countries or areas' : 'a multi-country region'}. How will I avoid generalising one place's dynamics onto the others?`);
    }
    if (m.scopeNote && /status|terminology|position|resolution 1244/i.test(m.scopeNote)) {
      prompts.push('Which terms are contested in this context, and what is the mission\'s approved terminology?');
    }
    return prompts;
  }

  function showGroup(items) {
    const seen = new Set();
    const unique = items.filter((i) => !seen.has(i.mission.id) && seen.add(i.mission.id));
    els.panel.innerHTML = `
      <p class="eyebrow mb-1">Nearby offices</p>
      <h2 class="h5">${unique.length} entries in this area</h2>
      <p class="small text-muted-2">Zoom in to separate them, or choose one:</p>
      <div class="list-group">
        ${unique.map((i) => `<button type="button" class="list-group-item list-group-item-action" data-select="${i.mission.id}">
          <strong>${esc(i.mission.acronym)}</strong> <span class="small text-muted-2">${esc(i.loc.label)}</span></button>`).join('')}
      </div>`;
  }

  els.panel.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-select]');
    if (btn) select(btn.dataset.select, false);
  });

  function select(id, fly) {
    const m = byId[id];
    if (!m) return;
    selectedId = id;
    const t = data.types[m.type];
    const linked = linkedScenarios(m);

    els.panel.innerHTML = `
      <p class="eyebrow mb-1">${esc(m.region)}</p>
      <h2 class="h5 mb-1">${esc(m.acronym)}</h2>
      <p class="mb-2">${esc(m.name)}</p>
      <div class="mb-3">${typeBadge(m)}
        <span class="badge ${STATUS[m.status].cls}">${STATUS[m.status].label}</span>
        <span class="badge ${VERIFY[m.verification].cls}" title="${esc(data.meta.verificationLegend[m.verification])}">${VERIFY[m.verification].label}</span>
      </div>

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

      <h3 class="h6 mt-3"><i class="bi bi-signpost-split" aria-hidden="true"></i> Practise with linked scenarios</h3>
      ${linked.length ? `<div class="d-grid gap-2">${linked.map((s) => `
        <a class="btn btn-outline-primary btn-sm text-start" href="scenarios.html?id=${s.id}&amp;mission=${m.id}">
          <strong>${esc(s.title)}</strong><br><span class="small">${esc(s.summary)}</span></a>`).join('')}</div>`
        : '<p class="small text-muted-2">No linked scenarios yet.</p>'}`;

    if (fly && hasLeaflet) {
      map.flyTo([m.locations[0].lat, m.locations[0].lng], Math.max(map.getZoom(), 5), { duration: 0.6 });
    }
    refresh();
    if (fly && window.matchMedia('(max-width: 991.98px)').matches) {
      els.panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  // ---------- recently concluded ----------
  els.concluded.innerHTML = `
    <h2 class="h6 mb-2"><i class="bi bi-archive" aria-hidden="true"></i> Recently concluded (not shown on the map)</h2>
    <ul class="small mb-0">
      ${data.recentlyConcluded.map((c) => `<li><strong>${esc(c.acronym)}</strong>, ${esc(c.name)} (${esc(c.scope)}): ended ${esc(c.ended)}. ${esc(c.note)}</li>`).join('')}
    </ul>`;

  // ---------- wiring ----------
  function refresh() {
    const list = filtered();
    renderRows(list);
    renderMarkers(list);
  }

  ['input', 'change'].forEach((ev) => els.form.addEventListener(ev, refresh));
  if (hasLeaflet) map.on('zoomend', () => renderMarkers(filtered()));
  els.form.addEventListener('reset', () => setTimeout(refresh, 0));
  els.form.addEventListener('submit', (e) => e.preventDefault());

  refresh();
  const initial = App.param('mission');
  if (initial && byId[initial]) select(initial, true);
})();
