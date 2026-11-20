// UN Workforce Analytics Dashboard. For each department: a Relief Map laid out like the Relief Maps
// Tool worksheet (the workplace settings along the bottom, each labelled with its kind of place;
// comfort at the bottom and discomfort at the top; one coloured line per identity dimension: gender,
// age, religious identity, ethnicity and social class), then six graphs, one per area of the
// assessment. Compare departments: one small Relief Map per department and tables of the numbers.
// Every number comes from an aggregated release (AssessmentModel.buildRelease): groups and Relief Map
// points under the minimum size carry no numbers at all, and individual answers never reach this page.
(function () {
  'use strict';
  const M = window.AssessmentModel;
  const A = window.AssessmentAuth;
  const cfg = window.ANALYTICS_CONFIG || {};
  const $ = (id) => document.getElementById(id);
  const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pct = (v) => (v == null ? '–' : `${Math.round(v * 100)}%`);
  const one = (v) => (v == null ? '–' : v.toFixed(1));
  const K = M.CONFIG.minGroupSize;
  const CATS = M.CATEGORIES;
  const R = M.RELIEF;
  const SETTINGS = R.settings;
  const DIMS = R.dimensions;
  // Line colours: the worksheet's hues (orange, dark blue, pink, green, red), set dark enough for 3:1
  // contrast on white and checked for colour-vision deficiencies across every pair of lines.
  const COLORS = { GEN: '#d67c15', AGE: '#0244be', REL: '#ef3cb3', ETH: '#077952', CLS: '#d02107' };

  // Answers given in the demonstration survey in this browser are added to the demonstration data.
  let demoStore = null;
  try { demoStore = M.demoStore(window.localStorage); demoStore.count(); } catch (e) { demoStore = null; }
  let demoBase = null;
  let demoRelease = null;
  let liveRelease = null;

  const state = { source: null, view: 'dept', department: 'ALL', period: null, liveAt: null, pinned: null };
  const charts = new Map(); // chart id -> { map, ref, compact, label }

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

  // Share of favourable answers to one statement ("don't know / N/A" left out).
  function favourable(catId, counts) {
    const answered = counts.slice(0, 5).reduce((a, b) => a + b, 0);
    const fav = M.polarity(catId).favourable.reduce((a, code) => a + counts[code - 1], 0);
    return { share: answered ? fav / answered : null, fav, answered, na: counts[5] };
  }

  // Average answer in one of the six areas, from 1 (the most favourable answer) to 5 (the least
  // favourable), whatever the scale. Used in the comparison table.
  function areaAverage(catId, counts) {
    const order = M.polarity(catId).order;
    let n = 0;
    let sum = 0;
    for (let code = 1; code <= 5; code += 1) {
      n += counts[code - 1];
      sum += counts[code - 1] * (order.indexOf(code) + 1);
    }
    return n ? sum / n : null;
  }

  const typeName = (t) => (t ? t.name : 'Too few answers');
  const valueText = (v) => (v == null ? `not shown (fewer than ${K} answers)` : one(v));

  // ---------- Relief Map chart (SVG) ----------
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

  // The worksheet layout: settings across, Comfort (1) at the bottom and Discomfort (5) at the top,
  // one line per identity dimension. Wide: full labels with the kind of place under each setting.
  // Narrow and compact (small multiples): numbered settings, with a key outside the chart.
  function reliefSvg(chart, width) {
    const { map, ref, compact, label } = chart;
    const W = Math.max(compact ? 240 : 290, Math.round(width));
    const narrow = compact || W < 640;
    const H = compact ? 176 : narrow ? 280 : 400;
    const m = compact ? { l: 16, r: 12, t: 12, b: 26 } : narrow ? { l: 76, r: 14, t: 16, b: 34 } : { l: 104, r: 26, t: 20, b: 80 };
    const pw = W - m.l - m.r;
    const ph = H - m.t - m.b;
    const band = pw / SETTINGS.length;
    const x = (i) => m.l + band * (i + 0.5);
    const y = (v) => m.t + ((5 - v) / 4) * ph;
    const out = [];
    // Axes as on the worksheet: a vertical axis on the left and a baseline at "Comfort".
    out.push(`<line class="rm-mid" x1="${m.l}" x2="${m.l + pw}" y1="${y(3).toFixed(1)}" y2="${y(3).toFixed(1)}"/>`);
    out.push(`<line class="rm-axis" x1="${m.l}" x2="${m.l}" y1="${(y(5) - 4).toFixed(1)}" y2="${y(1).toFixed(1)}"/>`);
    out.push(`<line class="rm-axis" x1="${m.l}" x2="${m.l + pw}" y1="${y(1).toFixed(1)}" y2="${y(1).toFixed(1)}"/>`);
    if (!compact) {
      out.push(`<text class="rm-end" x="${m.l - 12}" y="${(y(5) + 5).toFixed(1)}" text-anchor="end">Discomfort</text>`);
      out.push(`<text class="rm-end" x="${m.l - 12}" y="${(y(1) + 5).toFixed(1)}" text-anchor="end">Comfort</text>`);
      out.push(`<text class="rm-tick" x="${m.l - 12}" y="${(y(3) + 4).toFixed(1)}" text-anchor="end">Neutral</text>`);
    }
    // Settings along the bottom, each with its kind of place in brackets on one shared line.
    const longTypes = band >= 150;
    const names = SETTINGS.map((s) => wrap(s.short, Math.max(10, Math.floor(band / 8)), 2));
    const kindY = y(1) + 24 + 16 * (Math.max(...names.map((n) => n.length)) - 1) + 18;
    SETTINGS.forEach((s, i) => {
      const cx = x(i).toFixed(1);
      if (narrow) {
        out.push(`<text class="rm-num" x="${cx}" y="${H - m.b + (compact ? 17 : 21)}" text-anchor="middle">${i + 1}</text>`);
        return;
      }
      const t = map.types[s.id];
      const kind = t ? `(${longTypes ? t.name : t.short})` : '(Too few answers)';
      out.push(`<text class="rm-cat" text-anchor="middle">${names[i].map((l, j) => `<tspan x="${cx}" y="${(y(1) + 24 + 16 * j).toFixed(1)}">${esc(l)}</tspan>`).join('')}<tspan class="rm-kind" x="${cx}" y="${kindY.toFixed(1)}">${esc(kind)}</tspan></text>`);
    });
    // Hover columns: the values of every line in one setting.
    SETTINGS.forEach((s, i) => {
      const rows = DIMS.map((d) => {
        const v = map.values[s.id][d.id];
        const r = ref ? ref.values[s.id][d.id] : null;
        return `${d.name}: ${valueText(v)}${v != null && r != null ? ` (all departments ${one(r)})` : ''}`;
      });
      out.push(`<g class="rm-hit" data-t="${esc(`${s.name} (${typeName(map.types[s.id])})`)}" data-v="${esc(rows.join('\n'))}"><rect x="${(m.l + band * i).toFixed(1)}" y="${m.t - 8}" width="${band.toFixed(1)}" height="${ph + 16}" fill="transparent"/><line class="rm-guide" x1="${x(i).toFixed(1)}" x2="${x(i).toFixed(1)}" y1="${m.t}" y2="${y(1).toFixed(1)}"/></g>`);
    });
    // One line per identity dimension, in the worksheet's legend order. A held-back point leaves a gap.
    DIMS.forEach((d) => {
      const vals = SETTINGS.map((s) => map.values[s.id][d.id]);
      const segs = [];
      let cur = [];
      vals.forEach((v, i) => { if (v == null) { if (cur.length) segs.push(cur); cur = []; } else cur.push({ x: x(i), y: y(v) }); });
      if (cur.length) segs.push(cur);
      const tip = SETTINGS.map((s, i) => `${s.short}: ${valueText(vals[i])}`).join('\n');
      const paths = segs.map((pts) => `<path class="rm-line-hit" d="${curve(pts)}"/><path class="rm-line" stroke="${COLORS[d.id]}" d="${curve(pts)}"/>`).join('');
      const dots = vals.map((v, i) => (v == null ? '' : `<circle class="rm-dot" fill="${COLORS[d.id]}" cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="${compact ? 3.5 : 5.5}"/>`)).join('');
      out.push(`<g class="rm-series" data-dim="${d.id}" data-t="${esc(d.name)}" data-v="${esc(tip)}">${paths}${dots}</g>`);
    });
    const summary = `${label}. Average answer from 1 (very comfortable) to 5 (very uncomfortable). `
      + SETTINGS.map((s) => `${s.name} (${typeName(map.types[s.id])}): ${DIMS.map((d) => `${d.name} ${valueText(map.values[s.id][d.id])}`).join(', ')}`).join('; ') + '.';
    return `<svg class="rm-svg${narrow && !compact ? ' is-narrow' : ''}" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(summary)}">${out.join('')}</svg>`;
  }

  function drawCharts() {
    document.querySelectorAll('[data-chart]').forEach((el) => {
      const chart = charts.get(el.dataset.chart);
      if (!chart || !el.offsetParent) return; // hidden panels are drawn when they are shown
      const w = el.clientWidth;
      if (w && Number(el.dataset.w) !== w) {
        el.innerHTML = reliefSvg(chart, w);
        el.dataset.w = String(w);
        const card = el.closest('.ad-relief-card');
        if (card && !chart.compact) card.classList.toggle('is-narrow', w < 640);
      }
    });
    applyFocus();
  }

  function chartSlot(id, chart) {
    charts.set(id, chart);
    return `<div class="ad-relief${chart.compact ? ' is-compact' : ''}" data-chart="${id}"></div>`;
  }

  // The legend, as on the worksheet: a coloured line and dot per identity dimension. Selecting one
  // highlights its line (select it again to show all lines).
  const legend = () => `<ul class="rm-legend" aria-label="Lines: identity dimensions">${DIMS.map((d) => `<li><button type="button" class="rm-key" data-dim="${d.id}" aria-pressed="${state.pinned === d.id}"><span class="rm-swatch" style="--c:${COLORS[d.id]}" aria-hidden="true"></span>${esc(d.name)}</button></li>`).join('')}</ul>`;
  const settingsKey = (map) => `<ol class="rm-settings" aria-label="Workplace settings">${SETTINGS.map((s) => `<li>${esc(s.name)}${map ? ` <span class="rm-settings-kind">(${esc(typeName(map.types[s.id]))})</span>` : ''}</li>`).join('')}</ol>`;

  // Highlight one line: the one pinned from a legend, or the one under the pointer.
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
  const heading = (title, meta) => `<div class="ad-set-head"><h2>${esc(title)}</h2>${meta ? `<p>${esc(meta)}</p>` : ''}</div>`;
  const message = (title, text) => `<div class="ad-empty"><h3>${esc(title)}</h3><p>${esc(text)}</p></div>`;
  const hiddenText = (c) => (c && c.status === 'protected' ? 'Hidden to protect a smaller group' : 'Not enough responses yet');

  // A short, descriptive reading of the map.
  function insights(map, ref, n) {
    const pts = [];
    SETTINGS.forEach((s) => DIMS.forEach((d) => { const v = map.values[s.id][d.id]; if (v != null) pts.push({ s, d, v }); }));
    if (!pts.length) return '';
    const hi = pts.reduce((a, b) => (b.v > a.v ? b : a));
    const lo = pts.reduce((a, b) => (b.v < a.v ? b : a));
    const items = [
      `<li><strong>Most discomfort:</strong> ${esc(hi.d.name)} in ${esc(hi.s.name.toLowerCase())} (${one(hi.v)}), a possible place to start.</li>`,
      `<li><strong>Most comfort:</strong> ${esc(lo.d.name)} in ${esc(lo.s.name.toLowerCase())} (${one(lo.v)}).</li>`
    ];
    M.PLACE_TYPES.filter((t) => t.id !== 'neutral').forEach((t) => {
      const where = SETTINGS.filter((s) => map.types[s.id] && map.types[s.id].id === t.id);
      if (!where.length) return;
      const detail = (s) => {
        if (t.id !== 'controversial') return esc(s.name);
        const v = DIMS.map((d) => ({ d, v: map.values[s.id][d.id] })).filter((e) => e.v != null);
        const top = v.reduce((a, b) => (b.v > a.v ? b : a));
        const bottom = v.reduce((a, b) => (b.v < a.v ? b : a));
        return `${esc(s.name)} (${esc(top.d.name.toLowerCase())} ${one(top.v)}, ${esc(bottom.d.name.toLowerCase())} ${one(bottom.v)})`;
      };
      items.push(`<li><strong>${esc(t.name)}:</strong> ${where.map(detail).join('; ')}.</li>`);
    });
    if (ref) {
      const diffs = [];
      SETTINGS.forEach((s) => DIMS.forEach((d) => {
        const v = map.values[s.id][d.id];
        const r = ref.values[s.id][d.id];
        if (v != null && r != null) diffs.push({ s, d, diff: v - r });
      }));
      const big = diffs.reduce((a, b) => (Math.abs(b.diff) > Math.abs(a.diff) ? b : a), { diff: 0 });
      items.push(Math.abs(big.diff) >= 0.3
        ? `<li><strong>Biggest difference from all departments:</strong> ${esc(big.d.name)} in ${esc(big.s.name.toLowerCase())}, ${one(Math.abs(big.diff))} ${big.diff > 0 ? 'higher (more discomfort)' : 'lower (more comfort)'}.</li>`
        : '<li><strong>Compared with all departments:</strong> within 0.3 on every point.</li>');
    }
    const missing = SETTINGS.length * DIMS.length - map.shown;
    items.push(`<li class="ad-insight-note">Based on ${n} responses.${missing ? ` ${missing} ${missing === 1 ? 'point is' : 'points are'} not shown, to protect anonymity (fewer than ${K} answers, or held back so a smaller group cannot be worked out).` : ''} Small differences can be due to chance.</li>`);
    return `<ul class="ad-insights">${items.join('')}</ul>`;
  }

  // The numbers behind the map: one row per line, one column per setting.
  function reliefTable(map, title) {
    return `<details class="ad-numbers"><summary>Show the numbers</summary>
      <div class="ad-table-wrap" tabindex="0" role="region" aria-label="Relief Map numbers">
      <table class="ad-compare rm-table">
        <caption class="visually-hidden">Relief Map for ${esc(title)}: average answer from 1 (very comfortable) to 5 (very uncomfortable), by identity dimension and workplace setting</caption>
        <thead><tr><th scope="col">Line</th>${SETTINGS.map((s) => `<th scope="col">${esc(s.short)}</th>`).join('')}</tr></thead>
        <tbody>${DIMS.map((d) => `<tr><th scope="row"><span class="rm-swatch" style="--c:${COLORS[d.id]}" aria-hidden="true"></span>${esc(d.name)}</th>${SETTINGS.map((s) => {
          const v = map.values[s.id][d.id];
          return v == null ? '<td class="is-held">–<span class="visually-hidden"> not shown</span></td>' : `<td>${one(v)}</td>`;
        }).join('')}</tr>`).join('')}
        <tr class="is-all"><th scope="row">Kind of place</th>${SETTINGS.map((s) => `<td>${esc(map.types[s.id] ? map.types[s.id].short : '–')}</td>`).join('')}</tr></tbody>
      </table></div>
      <p class="ad-hint">– = not shown: fewer than ${K} people answered, or held back so that a smaller group cannot be worked out. "Prefer not to say or not applicable" is left out of every average.</p></details>`;
  }

  const howLabelled = () => `<details class="ad-numbers"><summary>How settings are labelled</summary>
    <p class="ad-hint">Each point is the average answer from 1 (very comfortable) to 5 (very uncomfortable). Each setting is labelled with one of the four kinds of place on the Relief Maps worksheet, checked in this order:</p>
    <ol class="rm-rules">${M.PLACE_TYPES.map((t) => `<li><strong>${esc(t.name)}:</strong> ${esc(t.rule)}.</li>`).join('')}</ol>
    <p class="ad-hint">A setting is labelled only when at least ${M.PLACE_MIN_LINES} of its ${DIMS.length} points are shown. The labels describe a group's averages, never a person.</p></details>`;

  function card(c, cat) {
    const rows = cat.items.map((it) => {
      const f = favourable(cat.id, c.items[it.id]);
      const tip = f.share == null
        ? `Everyone answered "${M.NA.label}".`
        : `${pct(f.share)} favourable: ${f.fav} of ${f.answered} answers${f.na ? ` (${f.na} more answered "${M.NA.label}")` : ''}`;
      return `<li data-t="${esc(it.text)}" data-v="${esc(tip)}">
        <span class="ad-row-top"><span class="ad-row-label">${esc(it.concept)}<span class="visually-hidden">: ${esc(it.text)}</span></span><span class="ad-row-val">${pct(f.share)}</span></span>
        <span class="ad-track" aria-hidden="true"><span class="ad-fill" style="width:${f.share == null ? 0 : (f.share * 100).toFixed(1)}%"></span></span>
      </li>`;
    }).join('');
    return `<section class="ad-card" aria-labelledby="cat-${cat.id}">
      <div class="ad-card-head">
        <h3 id="cat-${cat.id}"><span class="ad-letter" aria-hidden="true">${cat.letter}</span>${esc(cat.name)}</h3>
        <p class="ad-score"><strong>${pct(c.scores[cat.id].favourable)}</strong> favourable</p>
      </div>
      <ul class="ad-rows">${rows}</ul>
      <p class="ad-card-foot">${cat.caution ? 'What people notice at work, not a measure of anyone\'s bias. ' : ''}Favourable = ${esc(M.favourableWords(cat.id))}${cat.lowerIsBetter ? ' (less often is better)' : ''}.</p>
    </section>`;
  }

  const CREDIT = 'A workplace adaptation of Relief Maps (Rodó-Zárate, 2023; Relief Maps+, INTERMAPS) and the NYU Intersectionality Lab\'s Relief Maps Tool. It shows group averages for workplace settings, not individual maps, and no one is asked which gender, age, religion, ethnicity or social class they are.';

  // ---------- views ----------
  function renderDept(rel) {
    const d = state.department === 'ALL' ? null : M.DEPARTMENT_BY_ID[state.department];
    const title = d ? d.name : 'All departments';
    const out = $('dept-out');
    if (!rel || !rel.periods.length) { out.innerHTML = heading(title, '') + message('No responses yet', `Results appear once there are at least ${K} responses.`); return; }
    const when = M.periodLabel(state.period);
    const c = M.cell(rel, state.period, state.department);
    if (c.status !== 'published') {
      out.innerHTML = heading(title, when) + (c.status === 'protected'
        ? message(hiddenText(c), `Showing this department would let someone work out the answers of a group of fewer than ${K} people. It will appear when more responses arrive.`)
        : message(hiddenText(c), `Results appear once ${d ? 'this department has' : 'there are'} at least ${K} responses in this period.`));
      return;
    }
    const map = M.reliefMap(c);
    const ref = d ? M.reliefMap(M.cell(rel, state.period, 'ALL')) : null;
    let relief;
    if (!map) relief = message('No Relief Map in these results', 'These results were produced before the Relief Map section was added to the assessment.');
    else if (!map.shown) relief = message('Not enough answers for a Relief Map yet', `A point appears once at least ${K} people in the group have answered it.`);
    else {
      relief = `<p class="rm-sub">How comfortable people feel in five workplace settings, in relation to five parts of who they are. Each line is one identity dimension: the higher the line, the more discomfort.</p>
        <div class="rm-layout">${chartSlot('dept', { map, ref, compact: false, label: `Relief Map for ${title}` })}${legend()}</div>
        <div class="rm-narrow-key">${settingsKey(map)}</div>
        ${insights(map, ref, c.n)}
        ${reliefTable(map, title)}
        ${howLabelled()}
        <p class="ad-credit">${esc(CREDIT)}</p>`;
    }
    out.innerHTML = heading(title, `${c.n} responses · ${when}`)
      + `<section class="ad-relief-card" aria-labelledby="relief-h"><h3 id="relief-h" class="rm-title">Relief Map</h3>${relief}</section>
        <h3 class="ad-section-h">The six areas in detail</h3>
        <p class="ad-section-p">Each bar is the share of favourable answers to one statement.</p>
        <div class="ad-cards">${CATS.map((cat) => card(c, cat)).join('')}</div>`;
  }

  function renderCompare(rel) {
    const out = $('compare-out');
    if (!rel || !rel.periods.length) { out.innerHTML = heading('Compare departments', '') + message('No responses yet', `Results appear once there are at least ${K} responses.`); return; }
    const tiles = M.DEPARTMENTS.map((d) => {
      const c = M.cell(rel, state.period, d.id);
      const map = M.reliefMap(c);
      if (c.status !== 'published' || !map || !map.shown) {
        const why = c.status !== 'published' ? hiddenText(c) : 'Not enough answers for a Relief Map yet';
        return `<li class="ad-mini is-off" data-row="${d.id}"><div class="ad-mini-head"><span class="ad-mini-name">${esc(d.short)}</span><span class="ad-mini-n">&nbsp;</span></div><p class="ad-mini-msg">${why}</p></li>`;
      }
      const held = SETTINGS.length * DIMS.length - map.shown;
      return `<li class="ad-mini" data-row="${d.id}"><div class="ad-mini-head"><button type="button" class="ad-link" data-department="${d.id}">${esc(d.short)}</button><span class="ad-mini-n">${c.n} responses${held ? ` · ${held} ${held === 1 ? 'point' : 'points'} not shown` : ''}</span></div>
        ${chartSlot(`mini-${d.id}`, { map, ref: null, compact: true, label: `Relief Map for ${d.name}` })}</li>`;
    }).join('');
    const typeRow = (id, label) => {
      const c = M.cell(rel, state.period, id);
      const map = M.reliefMap(c);
      if (c.status !== 'published') return `<tr class="is-off" data-row="${id}"><th scope="row">${esc(label)}</th><td colspan="${SETTINGS.length}">${hiddenText(c)}</td></tr>`;
      if (!map) return `<tr class="is-off" data-row="${id}"><th scope="row">${esc(label)}</th><td colspan="${SETTINGS.length}">No Relief Map in these results</td></tr>`;
      return `<tr data-row="${id}"${id === 'ALL' ? ' class="is-all"' : ''}><th scope="row">${esc(label)}</th>${SETTINGS.map((s) => `<td>${esc(map.types[s.id] ? map.types[s.id].short : '–')}</td>`).join('')}</tr>`;
    };
    const areaRow = (id, label) => {
      const c = M.cell(rel, state.period, id);
      if (c.status !== 'published') return `<tr class="is-off" data-row="${id}"><th scope="row">${esc(label)}</th><td colspan="${CATS.length + 1}">${hiddenText(c)}</td></tr>`;
      return `<tr data-row="${id}"${id === 'ALL' ? ' class="is-all"' : ''}><th scope="row">${esc(label)}</th><td class="ad-n">${c.n}</td>${CATS.map((cat) => `<td>${one(areaAverage(cat.id, c.scores[cat.id].counts))}</td>`).join('')}</tr>`;
    };
    const rows = (f) => f('ALL', 'All departments') + M.DEPARTMENTS.map((d) => f(d.id, d.short)).join('');
    out.innerHTML = heading('Compare departments', `Relief Maps · ${M.periodLabel(state.period)}`)
      + `<div class="ad-compare-key">${legend()}${settingsKey(null)}
          <p class="ad-hint">Higher means more discomfort (average answer from 1, very comfortable, to 5, very uncomfortable). Select a department to open its Relief Map and six graphs.</p></div>
        <ul class="ad-multiples">${tiles}</ul>
        <details class="ad-numbers"><summary>Kinds of place by department</summary>
          <div class="ad-table-wrap" tabindex="0" role="region" aria-label="Kinds of place by department">
          <table class="ad-compare">
            <caption class="visually-hidden">The kind of place of each workplace setting, by department, as labelled on the Relief Map</caption>
            <thead><tr><th scope="col">Department</th>${SETTINGS.map((s) => `<th scope="col">${esc(s.short)}</th>`).join('')}</tr></thead>
            <tbody>${rows(typeRow)}</tbody>
          </table></div></details>
        <details class="ad-numbers"><summary>The six areas by department</summary>
          <div class="ad-table-wrap" tabindex="0" role="region" aria-label="The six areas by department">
          <table class="ad-compare">
            <caption class="visually-hidden">Average answer in each area, from 1 (most favourable) to 5 (least favourable), by department</caption>
            <thead><tr><th scope="col">Department</th><th scope="col">Responses</th>${CATS.map((cat) => `<th scope="col"><span class="ad-letter" aria-hidden="true">${cat.letter}</span><span class="ad-col-name">${esc(cat.name)}</span></th>`).join('')}</tr></thead>
            <tbody>${rows(areaRow)}</tbody>
          </table></div>
          <p class="ad-hint">Average answer in each area, from 1 (the most favourable answer) to 5 (the least favourable).</p></details>`;
  }

  function fillSelects(rel) {
    const periods = rel ? rel.periods : [];
    if (!periods.includes(state.period)) state.period = periods.length ? periods[periods.length - 1] : null;
    $('period').innerHTML = periods.length
      ? periods.slice().reverse().map((p) => `<option value="${esc(p)}"${p === state.period ? ' selected' : ''}>${esc(M.periodLabel(p))}</option>`).join('')
      : '<option value="">No responses yet</option>';
    $('period').disabled = periods.length < 2;
    const label = (id, name) => {
      const c = rel && state.period ? M.cell(rel, state.period, id) : null;
      return c && c.status === 'published' ? name : `${name} (${c && c.status === 'protected' ? 'hidden' : 'not enough responses'})`;
    };
    $('department').innerHTML = [['ALL', 'All departments']].concat(M.DEPARTMENTS.map((d) => [d.id, d.name]))
      .map(([id, name]) => `<option value="${id}"${id === state.department ? ' selected' : ''}>${esc(label(id, name))}</option>`).join('');
  }

  function renderNotice(rel) {
    const el = $('notice');
    if (state.source === 'demo') {
      const extra = rel ? rel.extra || 0 : 0;
      const survey = cfg.surveyUrl ? `${String(cfg.surveyUrl).replace(/\/?$/, '/')}survey.html?demo=1` : '';
      el.className = 'ad-notice is-demo';
      el.innerHTML = `<p><strong>Demonstration data:</strong> fictional responses, not real results.${extra ? ` Includes ${extra} ${extra === 1 ? 'answer' : 'answers'} you gave in the demonstration survey in this browser.` : ''}</p>
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
      el.innerHTML = `<span class="ad-who">Signed in${s ? ` as <strong>${esc(s.email)}</strong>` : ''}</span><button type="button" class="ad-btn ad-btn-on-dark" id="refresh">Refresh</button><button type="button" class="ad-btn ad-btn-on-dark" id="sign-out">Sign out</button>`;
    } else if (state.source === 'demo') {
      el.innerHTML = '<span class="ad-who">Demonstration</span><button type="button" class="ad-btn ad-btn-on-dark" id="exit-demo">Exit</button>';
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
    fillSelects(rel);
    renderDept(rel);
    renderCompare(rel);
    drawCharts();
  }

  // ---------- tabs ----------
  const TABS = ['dept', 'compare'];
  function showView(name, focus) {
    state.view = name;
    TABS.forEach((t) => {
      const on = t === name;
      $(`tab-${t}`).setAttribute('aria-selected', String(on));
      $(`tab-${t}`).tabIndex = on ? 0 : -1;
      $(`panel-${t}`).hidden = !on;
    });
    $('department-field').hidden = name !== 'dept';
    drawCharts();
    if (focus) $(`tab-${name}`).focus();
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
    state.department = 'ALL';
    state.pinned = null;
    $('gate').hidden = true;
    $('app').hidden = false;
    showView('dept');
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

    TABS.forEach((t, i) => {
      $(`tab-${t}`).addEventListener('click', () => showView(t));
      $(`tab-${t}`).addEventListener('keydown', (e) => {
        if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(e.key)) return;
        e.preventDefault();
        const n = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: TABS.length - 1 }[e.key];
        showView(TABS[(n + TABS.length) % TABS.length], true);
      });
    });
    $('department').addEventListener('change', (e) => { state.department = e.target.value; render(); });
    $('period').addEventListener('change', (e) => { state.period = e.target.value; render(); });
    $('app').addEventListener('click', (e) => {
      const key = e.target.closest('.rm-key');
      if (key) { state.pinned = state.pinned === key.dataset.dim ? null : key.dataset.dim; applyFocus(); return; }
      const b = e.target.closest('#compare-out [data-department]');
      if (!b) return;
      state.department = b.dataset.department;
      showView('dept');
      render();
      $('dept-out').scrollIntoView({ block: 'start' });
    });

    // Demonstration answers given in another tab of this browser update the charts.
    window.addEventListener('storage', (e) => { if (state.source === 'demo' && [M.CONFIG.demoStorageKey, null].includes(e.key)) render(); });
    document.addEventListener('visibilitychange', () => { if (!document.hidden && state.source === 'demo') render(); });
    let timer = null;
    window.addEventListener('resize', () => { clearTimeout(timer); timer = setTimeout(drawCharts, 120); });

    // ?demo=1 opens the demonstration directly; #compare opens the comparison.
    if (new URLSearchParams(window.location.search).get('demo') === '1') {
      open('demo');
      if (window.location.hash === '#compare') showView('compare');
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
