// Workplace Relief Map Dashboard: one graph for one dataset, laid out like the Relief Maps Tool
// worksheet. The five workplace spaces run along the bottom, each labelled with its kind of place;
// comfort is at the bottom and discomfort at the top; and each identity dimension (gender, age,
// religious identity, ethnicity, social class) is one coloured line. Every number comes from an
// aggregated release (AssessmentModel.buildRelease): nothing is shown until enough people have taken
// part, no point carries fewer answers than the minimum, and individual answers never reach this page.
(function () {
  'use strict';
  const M = window.AssessmentModel;
  const A = window.AssessmentAuth;
  const cfg = window.ANALYTICS_CONFIG || {};
  const $ = (id) => document.getElementById(id);
  const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const one = (v) => (v == null ? '–' : v.toFixed(1));
  const K = M.CONFIG.minGroupSize;
  const SPACES = M.RELIEF.spaces;
  const DIMS = M.RELIEF.dimensions;
  // Line colours: the worksheet's hues (orange, dark blue, pink, green, red), set dark enough for 3:1
  // contrast on white and checked for colour-vision deficiencies across every pair of lines.
  const COLORS = { GEN: '#d67c15', AGE: '#0244be', REL: '#ef3cb3', ETH: '#077952', CLS: '#d02107' };

  // Answers given in the demonstration survey in this browser are added to the demonstration data.
  let demoStore = null;
  try { demoStore = M.demoStore(window.localStorage); demoStore.count(); } catch (e) { demoStore = null; }
  let demoBase = null;
  let demoRelease = null;
  let liveRelease = null;

  const state = { source: null, liveAt: null, pinned: null };
  const charts = new Map(); // chart id -> { map, label }

  // ---------- data ----------
  function release() {
    if (state.source === 'demo') {
      const extra = demoStore ? demoStore.all() : [];
      if (!demoRelease || demoRelease.extra !== extra.length) {
        demoBase = demoBase || M.demoResponses();
        demoRelease = M.buildRelease(demoBase.concat(extra), { source: 'demo', label: 'Demonstration data' });
        demoRelease.extra = extra.length;
      }
      return demoRelease;
    }
    return state.source === 'live' ? liveRelease : null;
  }

  const typeName = (t) => (t ? t.name : 'Too few answers');
  const valueText = (v) => (v == null ? `not shown (fewer than ${K} answers)` : one(v));

  // ---------- the Relief Map (SVG) ----------
  // A smooth line through every point that never overshoots them (monotone cubic interpolation).
  function curve(pts) {
    if (pts.length === 1) return `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
    const n = pts.length;
    const m = [];
    for (let i = 0; i < n - 1; i += 1) m.push((pts[i + 1].y - pts[i].y) / (pts[i + 1].x - pts[i].x));
    const t = [m[0]];
    for (let i = 1; i < n - 1; i += 1) t.push(m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2);
    t.push(m[n - 2]);
    for (let i = 0; i < n - 1; i += 1) {
      if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; continue; }
      const a = t[i] / m[i];
      const b = t[i + 1] / m[i];
      const s = a * a + b * b;
      if (s > 9) { const k = 3 / Math.sqrt(s); t[i] = k * a * m[i]; t[i + 1] = k * b * m[i]; }
    }
    let d = `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
    for (let i = 0; i < n - 1; i += 1) {
      const h = (pts[i + 1].x - pts[i].x) / 3;
      d += `C${(pts[i].x + h).toFixed(1)},${(pts[i].y + h * t[i]).toFixed(1)} ${(pts[i + 1].x - h).toFixed(1)},${(pts[i + 1].y - h * t[i + 1]).toFixed(1)} ${pts[i + 1].x.toFixed(1)},${pts[i + 1].y.toFixed(1)}`;
    }
    return d;
  }

  // Split a label into lines of at most `max` characters.
  function wrap(text, max, lines) {
    const words = text.split(' ');
    const out = [];
    while (words.length && out.length < lines) {
      let line = words.shift();
      while (words.length && `${line} ${words[0]}`.length <= max) line += ` ${words.shift()}`;
      out.push(line);
    }
    if (words.length) out[out.length - 1] += ` ${words.join(' ')}`;
    return out;
  }

  // The worksheet layout: spaces across, Comfort (1) at the bottom and Discomfort (5) at the top, one
  // line per identity dimension. Wide: full labels with the kind of place under each space. Narrow:
  // numbered spaces, with a key below the chart.
  function reliefSvg(chart, width) {
    const { map, label } = chart;
    const W = Math.max(290, Math.round(width));
    const narrow = W < 640;
    const H = narrow ? 280 : 400;
    const m = narrow ? { l: 76, r: 14, t: 16, b: 34 } : { l: 104, r: 26, t: 20, b: 80 };
    const pw = W - m.l - m.r;
    const ph = H - m.t - m.b;
    const band = pw / SPACES.length;
    const x = (i) => m.l + band * (i + 0.5);
    const y = (v) => m.t + ((5 - v) / 4) * ph;
    const out = [];
    // Axes as on the worksheet: a vertical axis on the left and a baseline at "Comfort".
    out.push(`<line class="rm-mid" x1="${m.l}" x2="${m.l + pw}" y1="${y(3).toFixed(1)}" y2="${y(3).toFixed(1)}"/>`);
    out.push(`<line class="rm-axis" x1="${m.l}" x2="${m.l}" y1="${(y(5) - 4).toFixed(1)}" y2="${y(1).toFixed(1)}"/>`);
    out.push(`<line class="rm-axis" x1="${m.l}" x2="${m.l + pw}" y1="${y(1).toFixed(1)}" y2="${y(1).toFixed(1)}"/>`);
    out.push(`<text class="rm-end" x="${m.l - 12}" y="${(y(5) + 5).toFixed(1)}" text-anchor="end">Discomfort</text>`);
    out.push(`<text class="rm-end" x="${m.l - 12}" y="${(y(1) + 5).toFixed(1)}" text-anchor="end">Comfort</text>`);
    out.push(`<text class="rm-tick" x="${m.l - 12}" y="${(y(3) + 4).toFixed(1)}" text-anchor="end">Neutral</text>`);
    // Spaces along the bottom, each with its kind of place in brackets on one shared line.
    const longTypes = band >= 150;
    const names = SPACES.map((s) => wrap(s.short, Math.max(10, Math.floor(band / 8)), 2));
    const kindY = y(1) + 24 + 16 * (Math.max(...names.map((n) => n.length)) - 1) + 18;
    SPACES.forEach((s, i) => {
      const cx = x(i).toFixed(1);
      if (narrow) {
        out.push(`<text class="rm-num" x="${cx}" y="${H - m.b + 21}" text-anchor="middle">${i + 1}</text>`);
        return;
      }
      const t = map.types[s.id];
      const kind = t ? `(${longTypes ? t.name : t.short})` : '(Too few answers)';
      out.push(`<text class="rm-cat" text-anchor="middle">${names[i].map((l, j) => `<tspan x="${cx}" y="${(y(1) + 24 + 16 * j).toFixed(1)}">${esc(l)}</tspan>`).join('')}<tspan class="rm-kind" x="${cx}" y="${kindY.toFixed(1)}">${esc(kind)}</tspan></text>`);
    });
    // Hover columns: the values of every line in one space.
    SPACES.forEach((s, i) => {
      const rows = DIMS.map((d) => `${d.name}: ${valueText(map.values[s.id][d.id])}`);
      out.push(`<g class="rm-hit" data-t="${esc(`${s.name} (${typeName(map.types[s.id])})`)}" data-v="${esc(rows.join('\n'))}"><rect x="${(m.l + band * i).toFixed(1)}" y="${m.t - 8}" width="${band.toFixed(1)}" height="${ph + 16}" fill="transparent"/><line class="rm-guide" x1="${x(i).toFixed(1)}" x2="${x(i).toFixed(1)}" y1="${m.t}" y2="${y(1).toFixed(1)}"/></g>`);
    });
    // One line per identity dimension, in the worksheet's legend order. A held-back point leaves a gap.
    DIMS.forEach((d) => {
      const vals = SPACES.map((s) => map.values[s.id][d.id]);
      const segs = [];
      let cur = [];
      vals.forEach((v, i) => { if (v == null) { if (cur.length) segs.push(cur); cur = []; } else cur.push({ x: x(i), y: y(v) }); });
      if (cur.length) segs.push(cur);
      const tip = SPACES.map((s, i) => `${s.short}: ${valueText(vals[i])}`).join('\n');
      const paths = segs.map((pts) => `<path class="rm-line-hit" d="${curve(pts)}"/><path class="rm-line" stroke="${COLORS[d.id]}" d="${curve(pts)}"/>`).join('');
      const dots = vals.map((v, i) => (v == null ? '' : `<circle class="rm-dot" fill="${COLORS[d.id]}" cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="5.5"/>`)).join('');
      out.push(`<g class="rm-series" data-dim="${d.id}" data-t="${esc(d.name)}" data-v="${esc(tip)}">${paths}${dots}</g>`);
    });
    const summary = `${label}. Average answer from 1 (very comfortable) to 5 (very uncomfortable). `
      + SPACES.map((s) => `${s.name} (${typeName(map.types[s.id])}): ${DIMS.map((d) => `${d.name} ${valueText(map.values[s.id][d.id])}`).join(', ')}`).join('; ') + '.';
    return `<svg class="rm-svg${narrow ? ' is-narrow' : ''}" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(summary)}">${out.join('')}</svg>`;
  }

  function drawCharts() {
    document.querySelectorAll('[data-chart]').forEach((el) => {
      const chart = charts.get(el.dataset.chart);
      if (!chart || !el.offsetParent) return;
      const w = el.clientWidth;
      if (w && Number(el.dataset.w) !== w) {
        el.innerHTML = reliefSvg(chart, w);
        el.dataset.w = String(w);
        const card = el.closest('.ad-relief-card');
        if (card) card.classList.toggle('is-narrow', w < 640);
      }
    });
    applyFocus();
  }

  function chartSlot(id, chart) {
    charts.set(id, chart);
    return `<div class="ad-relief" data-chart="${id}"></div>`;
  }

  // The legend, as on the worksheet: a coloured line and dot per identity dimension. Selecting one
  // highlights its line (select it again to show all lines).
  const legend = () => `<ul class="rm-legend" aria-label="Lines: identity dimensions">${DIMS.map((d) => `<li><button type="button" class="rm-key" data-dim="${d.id}" aria-pressed="${state.pinned === d.id}"><span class="rm-swatch" style="--c:${COLORS[d.id]}" aria-hidden="true"></span>${esc(d.name)}</button></li>`).join('')}</ul>`;
  const spacesKey = (map) => `<ol class="rm-settings" aria-label="Workplace spaces">${SPACES.map((s) => `<li>${esc(s.name)} <span class="rm-settings-kind">(${esc(typeName(map.types[s.id]))})</span></li>`).join('')}</ol>`;

  // Highlight one line: the one pinned from the legend, or the one under the pointer.
  let hoverDim = null;
  function applyFocus() {
    const dim = hoverDim || state.pinned;
    document.querySelectorAll('.rm-series').forEach((g) => {
      g.classList.toggle('is-faded', !!dim && g.dataset.dim !== dim);
      if (dim && g.dataset.dim === dim && g.nextElementSibling) g.parentNode.appendChild(g); // draw it on top
    });
    document.querySelectorAll('.rm-key').forEach((b) => {
      b.setAttribute('aria-pressed', String(state.pinned === b.dataset.dim));
      b.classList.toggle('is-faded', !!dim && b.dataset.dim !== dim);
    });
  }

  // ---------- pieces ----------
  const message = (title, text) => `<div class="ad-empty"><h2>${esc(title)}</h2><p>${esc(text)}</p></div>`;

  // A short, descriptive reading of the map.
  function insights(map, n) {
    const pts = [];
    SPACES.forEach((s) => DIMS.forEach((d) => { const v = map.values[s.id][d.id]; if (v != null) pts.push({ s, d, v }); }));
    if (!pts.length) return '';
    const hi = pts.reduce((a, b) => (b.v > a.v ? b : a));
    const lo = pts.reduce((a, b) => (b.v < a.v ? b : a));
    const items = [
      `<li><strong>Most discomfort:</strong> ${esc(hi.d.name)} ${esc(hi.s.where)} (${one(hi.v)}).</li>`,
      `<li><strong>Most comfort:</strong> ${esc(lo.d.name)} ${esc(lo.s.where)} (${one(lo.v)}).</li>`
    ];
    M.PLACE_TYPES.filter((t) => t.id !== 'neutral').forEach((t) => {
      const where = SPACES.filter((s) => map.types[s.id] && map.types[s.id].id === t.id);
      if (!where.length) return;
      const detail = (s) => {
        if (t.id !== 'mixed') return esc(s.team);
        const v = DIMS.map((d) => ({ d, v: map.values[s.id][d.id] })).filter((e) => e.v != null);
        const top = v.reduce((a, b) => (b.v > a.v ? b : a));
        const bottom = v.reduce((a, b) => (b.v < a.v ? b : a));
        return `${esc(s.team)} (${esc(top.d.name.toLowerCase())} ${one(top.v)}, ${esc(bottom.d.name.toLowerCase())} ${one(bottom.v)})`;
      };
      items.push(`<li><strong>${esc(t.name)}:</strong> ${where.map(detail).join('; ')}.</li>`);
    });
    const missing = SPACES.length * DIMS.length - map.shown;
    items.push(`<li class="ad-insight-note">Based on ${n} responses.${missing ? ` ${missing} ${missing === 1 ? 'point is' : 'points are'} not shown because fewer than ${K} people answered ${missing === 1 ? 'it' : 'them'}.` : ''} Small differences can be due to chance.</li>`);
    return `<ul class="ad-insights">${items.join('')}</ul>`;
  }

  // The numbers behind the map: one row per line, one column per space.
  function reliefTable(map) {
    return `<details class="ad-numbers"><summary>Show the numbers</summary>
      <div class="ad-table-wrap" tabindex="0" role="region" aria-label="Relief Map numbers">
      <table class="ad-compare rm-table">
        <caption class="visually-hidden">Relief Map: average answer from 1 (very comfortable) to 5 (very uncomfortable), by identity dimension and workplace space</caption>
        <thead><tr><th scope="col">Line</th>${SPACES.map((s) => `<th scope="col">${esc(s.short)}</th>`).join('')}</tr></thead>
        <tbody>${DIMS.map((d) => `<tr><th scope="row"><span class="rm-swatch" style="--c:${COLORS[d.id]}" aria-hidden="true"></span>${esc(d.name)}</th>${SPACES.map((s) => {
          const v = map.values[s.id][d.id];
          return v == null ? '<td class="is-held">–<span class="visually-hidden"> not shown</span></td>' : `<td>${one(v)}</td>`;
        }).join('')}</tr>`).join('')}
        <tr class="is-all"><th scope="row">Kind of place</th>${SPACES.map((s) => `<td>${esc(map.types[s.id] ? map.types[s.id].short : '–')}</td>`).join('')}</tr></tbody>
      </table></div>
      <p class="ad-hint">– = not shown: fewer than ${K} people answered. "Prefer not to say or not applicable" is left out of every average.</p></details>`;
  }

  // Suggested next steps: practical ideas chosen from the pattern on the map (AssessmentModel.nextSteps).
  function nextSteps(map) {
    const steps = M.nextSteps(map);
    if (!steps.length) return '';
    return `<section class="ad-steps" aria-labelledby="steps-h"><h2 id="steps-h">Suggested next steps</h2>
      <p class="ad-hint">Ideas for the team to discuss, chosen from the pattern on the map. They are starting points, not findings.</p>
      <ol class="ad-steps-list">${steps.map((s) => `<li data-kind="${esc(s.kind)}"><strong>${esc(s.title)}.</strong> ${esc(s.text)}</li>`).join('')}</ol></section>`;
  }

  const howLabelled = () => `<details class="ad-numbers"><summary>How spaces are labelled</summary>
    <p class="ad-hint">Each point is the average answer from 1 (very comfortable) to 5 (very uncomfortable). Each space is labelled with one of four kinds of place, adapted from the Relief Maps worksheet and checked in this order:</p>
    <ol class="rm-rules">${M.PLACE_TYPES.map((t) => `<li><strong>${esc(t.name)}:</strong> ${esc(t.rule)}.</li>`).join('')}</ol>
    <p class="ad-hint">A space is labelled only when at least ${M.PLACE_MIN_LINES} of its ${DIMS.length} points are shown. The labels describe the group's averages, never a person.</p></details>`;

  const CREDIT = 'A workplace adaptation of Relief Maps (Rodó-Zárate, 2023; Relief Maps+, INTERMAPS) and the NYU Intersectionality Lab\'s Relief Maps Tool. It shows group averages for workplace spaces, not individual maps, and no one is asked which gender, age, religion, ethnicity or social class they are.';

  // ---------- the one view ----------
  function renderMap(rel) {
    const out = $('map-out');
    const c = rel ? rel.result : null;
    if (!c || c.status !== 'published') {
      out.innerHTML = message('Not enough responses yet', `The map appears once at least ${K} people have taken part.`);
      return;
    }
    const map = M.reliefMap(c);
    if (!map.shown) { out.innerHTML = message('Not enough answers yet', `A point appears once at least ${K} people have answered it.`); return; }
    out.innerHTML = `<p class="rm-sub">How comfortable people feel in five workplace spaces, in relation to five parts of who they are. Each line is one identity dimension: the higher the line, the more discomfort. Based on ${c.n} responses.</p>
      <div class="rm-layout">${chartSlot('map', { map, label: 'Relief Map' })}${legend()}</div>
      <div class="rm-narrow-key">${spacesKey(map)}</div>
      ${insights(map, c.n)}
      ${nextSteps(map)}
      ${reliefTable(map)}
      ${howLabelled()}
      <p class="ad-credit">${esc(CREDIT)}</p>`;
  }

  function renderNotice(rel) {
    const el = $('notice');
    if (state.source === 'demo') {
      const extra = rel ? rel.extra || 0 : 0;
      const survey = cfg.surveyUrl ? `${String(cfg.surveyUrl).replace(/\/?$/, '/')}survey.html?demo=1` : '';
      el.className = 'ad-notice is-demo';
      el.innerHTML = `<p><strong>Demonstration data:</strong> fictional responses from one team, not real results.${extra ? ` Includes ${extra} ${extra === 1 ? 'answer' : 'answers'} you gave in the demonstration survey in this browser.` : ''}</p>
        <p class="ad-notice-actions">${survey ? `<a href="${esc(survey)}" target="_blank" rel="noopener">Take the demonstration survey</a>` : ''}${extra ? '<button type="button" class="ad-link" id="clear-demo">Remove my demonstration answers</button>' : ''}</p>`;
      return;
    }
    el.className = 'ad-notice is-live';
    el.innerHTML = `<p><strong>Live results</strong>, updated ${esc(state.liveAt ? state.liveAt.toLocaleString() : '')}.</p>`;
  }

  function renderSession() {
    const el = $('session');
    if (state.source === 'live') {
      const s = A.session();
      el.innerHTML = `<span class="ad-who">Signed in${s ? ` as <strong>${esc(s.email)}</strong>` : ''}</span><button type="button" class="ad-btn ad-btn-chip" id="refresh">Refresh</button><button type="button" class="ad-btn ad-btn-chip" id="sign-out">Sign out</button>`;
    } else if (state.source === 'demo') {
      el.innerHTML = '<span class="ad-who">Demonstration</span><button type="button" class="ad-btn ad-btn-chip" id="exit-demo">Exit</button>';
    } else {
      el.innerHTML = '';
    }
  }

  function render() {
    renderSession();
    if (!state.source) return;
    const rel = release();
    charts.clear();
    hoverDim = null;
    $('ad-tip').hidden = true;
    renderNotice(rel);
    renderMap(rel);
    drawCharts();
  }

  // ---------- tooltips and line highlighting (mouse) ----------
  function bindTips() {
    const tip = $('ad-tip');
    const show = (el, ev) => {
      tip.innerHTML = `<strong>${esc(el.dataset.t)}</strong><span>${esc(el.dataset.v)}</span>`;
      tip.hidden = false;
      const r = el.getBoundingClientRect();
      let left = (ev && ev.pageX ? ev.pageX : r.left + window.scrollX + r.width / 2) + 12;
      if (left + tip.offsetWidth > window.scrollX + document.documentElement.clientWidth - 8) left -= tip.offsetWidth + 24;
      tip.style.left = `${Math.max(window.scrollX + 8, left)}px`;
      const top = ev && ev.pageY ? ev.pageY - tip.offsetHeight - 14 : r.top + window.scrollY - tip.offsetHeight - 8;
      tip.style.top = `${Math.max(window.scrollY + 8, top)}px`;
    };
    document.addEventListener('mousemove', (e) => {
      const el = e.target.closest('[data-t]');
      if (el) show(el, e); else tip.hidden = true;
      const series = e.target.closest('.rm-series, .rm-key');
      const dim = series ? series.dataset.dim : null;
      if (dim !== hoverDim) { hoverDim = dim; applyFocus(); }
    });
    window.addEventListener('scroll', () => { tip.hidden = true; }, { passive: true });
  }

  // ---------- opening and closing ----------
  function open(source) {
    state.source = source;
    state.pinned = null;
    $('gate').hidden = true;
    $('app').hidden = false;
    render();
    $('app-h').focus();
  }

  function close(msg) {
    state.source = null;
    $('app').hidden = true;
    $('gate').hidden = false;
    render();
    window.scrollTo(0, 0);
    $('gate-h').focus();
    setMsg(msg || '', msg ? 'ok' : '');
  }

  async function loadLive() {
    liveRelease = M.checkRelease(await A.fetchRelease());
    state.liveAt = new Date();
  }

  function setMsg(text, kind) {
    const el = $('signin-msg');
    el.className = `ad-msg${kind ? ` is-${kind}` : ''}`;
    el.textContent = text || '';
  }

  function init() {
    document.querySelectorAll('.js-k').forEach((el) => { el.textContent = String(K); });
    bindTips();

    if (!A.configured) {
      $('signin-form').hidden = true;
      $('signin-off').hidden = false;
    }
    $('open-demo').addEventListener('click', () => open('demo'));
    $('signin-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = $('email').value.trim();
      const password = $('password').value;
      if (!email || !password) { setMsg('Enter your email and password.', 'error'); return; }
      const btn = $('signin-btn');
      btn.disabled = true;
      setMsg('Signing in…');
      try {
        await A.signIn(email, password);
        await loadLive();
        $('password').value = '';
        setMsg('');
        open('live');
      } catch (err) {
        if (err.code === 403) await A.signOut();
        setMsg(err.message, 'error');
      } finally {
        btn.disabled = false;
      }
    });

    $('session').addEventListener('click', async (e) => {
      if (e.target.closest('#exit-demo')) close();
      if (e.target.closest('#sign-out')) { await A.signOut(); liveRelease = null; close('You are signed out.'); }
      if (e.target.closest('#refresh')) {
        try { await loadLive(); render(); } catch (err) {
          if (err.code === 401) { liveRelease = null; close(); setMsg(err.message, 'error'); return; }
          window.alert(err.message);
        }
      }
    });
    $('notice').addEventListener('click', (e) => { if (e.target.closest('#clear-demo') && demoStore) { demoStore.clear(); render(); } });
    $('app').addEventListener('click', (e) => {
      const key = e.target.closest('.rm-key');
      if (key) { state.pinned = state.pinned === key.dataset.dim ? null : key.dataset.dim; applyFocus(); }
    });

    // Demonstration answers given in another tab of this browser update the map.
    window.addEventListener('storage', (e) => { if (state.source === 'demo' && [M.CONFIG.demoStorageKey, null].includes(e.key)) render(); });
    document.addEventListener('visibilitychange', () => { if (!document.hidden && state.source === 'demo') render(); });
    let timer = null;
    window.addEventListener('resize', () => { clearTimeout(timer); timer = setTimeout(drawCharts, 120); });

    // ?demo=1 opens the demonstration directly.
    if (new URLSearchParams(window.location.search).get('demo') === '1') open('demo');
  }

  document.addEventListener('DOMContentLoaded', init);
})();
