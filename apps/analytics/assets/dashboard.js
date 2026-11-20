// UN Workforce Analytics Dashboard. For each department: a Relief Map (a workplace adaptation of
// Rodó-Zárate's Relief Maps, with the six areas across and comfort to discomfort up the side) and six
// graphs, one per area. Compare departments: one small Relief Map per department and a table of the
// numbers. Every number comes from an aggregated release (AssessmentModel.buildRelease): groups under
// the minimum size carry no numbers at all, and individual answers never reach this page.
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

  // Answers given in the demonstration survey in this browser are added to the demonstration data.
  let demoStore = null;
  try { demoStore = M.demoStore(window.localStorage); demoStore.count(); } catch (e) { demoStore = null; }
  let demoBase = null;
  let demoRelease = null;
  let liveRelease = null;

  const state = { source: null, view: 'dept', department: 'ALL', period: null, liveAt: null };
  const charts = new Map(); // chart id -> { series, compact, label }

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

  // Relief Map value for one area: the average answer from 1 (the most favourable answer, comfort) to
  // 5 (the least favourable, discomfort), whatever the scale. "Don't know / N/A" is left out.
  function discomfort(catId, counts) {
    const order = M.polarity(catId).order;
    let n = 0;
    let sum = 0;
    for (let code = 1; code <= 5; code += 1) {
      n += counts[code - 1];
      sum += counts[code - 1] * (order.indexOf(code) + 1);
    }
    return n ? sum / n : null;
  }
  const reliefValues = (c) => CATS.map((cat) => discomfort(cat.id, c.scores[cat.id].counts));

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

  // Split an area's long name into at most two lines for the axis.
  function twoLines(text, max) {
    const words = text.split(' ');
    let a = '';
    while (words.length && (a + ' ' + words[0]).trim().length <= max) a = (a + ' ' + words.shift()).trim();
    return [a || words.shift(), words.join(' ')].filter(Boolean);
  }

  function reliefSvg(chart, width) {
    const { series, compact, label } = chart;
    const W = Math.max(compact ? 250 : 300, Math.round(width));
    const narrow = !compact && W < 640;
    const H = compact ? 168 : narrow ? 270 : 340;
    const m = compact ? { l: 22, r: 12, t: 14, b: 26 } : narrow ? { l: 26, r: 14, t: 30, b: 34 } : { l: 92, r: 128, t: 26, b: 58 };
    const pw = W - m.l - m.r;
    const ph = H - m.t - m.b;
    const band = pw / CATS.length;
    const x = (i) => m.l + band * (i + 0.5);
    const y = (v) => m.t + ((5 - v) / 4) * ph; // 5 (discomfort) at the top, 1 (comfort) at the bottom
    const out = [];
    // Grid: 1 to 5, with the neutral middle (3) dashed.
    for (let v = 1; v <= 5; v += 1) {
      out.push(`<line class="${v === 3 ? 'rm-mid' : 'rm-grid'}" x1="${m.l}" x2="${m.l + pw}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/>`);
    }
    if (!compact && !narrow) {
      out.push(`<text class="rm-end" x="${m.l - 12}" y="${y(5) + 4}" text-anchor="end">Discomfort</text>`);
      out.push(`<text class="rm-end" x="${m.l - 12}" y="${y(1) + 4}" text-anchor="end">Comfort</text>`);
      out.push(`<text class="rm-tick" x="${m.l - 12}" y="${y(3) + 4}" text-anchor="end">Neutral</text>`);
    } else if (narrow) {
      out.push(`<text class="rm-end" x="${m.l}" y="${m.t - 12}">Higher = more discomfort</text>`);
    }
    // Area labels across the bottom.
    CATS.forEach((cat, i) => {
      if (compact || narrow) {
        out.push(`<text class="rm-cat" x="${x(i).toFixed(1)}" y="${H - m.b + 18}" text-anchor="middle">${cat.letter}</text>`);
        return;
      }
      const lines = twoLines(cat.name, Math.max(9, Math.floor(band / 7.6) - 3));
      out.push(`<text class="rm-cat" x="${x(i).toFixed(1)}" y="${H - m.b + 20}" text-anchor="middle"><tspan class="rm-letter">${cat.letter}.</tspan> ${esc(lines[0])}${lines[1] ? `<tspan x="${x(i).toFixed(1)}" dy="15">${esc(lines[1])}</tspan>` : ''}</text>`);
    });
    // Lines: the reference first, so the department is drawn on top.
    const drawn = series.slice().sort((a, b) => (a.ref === b.ref ? 0 : a.ref ? -1 : 1));
    drawn.forEach((s) => {
      const segs = [];
      let cur = [];
      s.values.forEach((v, i) => { if (v == null) { if (cur.length) segs.push(cur); cur = []; } else cur.push({ x: x(i), y: y(v) }); });
      if (cur.length) segs.push(cur);
      segs.forEach((pts) => out.push(`<path class="rm-line ${s.ref ? 'is-ref' : 'is-main'}" d="${curve(pts)}"/>`));
      s.values.forEach((v, i) => {
        if (v != null) out.push(`<circle class="rm-dot ${s.ref ? 'is-ref' : 'is-main'}" cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="${compact ? 3.5 : 4.5}"/>`);
      });
    });
    // Direct labels at the right end of each line.
    if (!compact && !narrow) {
      const lx = x(CATS.length - 1) + 12;
      const ends = series.map((s) => ({ s, v: s.values[s.values.length - 1] })).filter((e) => e.v != null)
        .map((e) => { const lines = twoLines(e.s.name, 17); return { s: e.s, lines, y: y(e.v) - ((lines.length - 1) * 14) / 2 }; })
        .sort((a, b) => a.y - b.y);
      for (let i = 1; i < ends.length; i += 1) {
        const minY = ends[i - 1].y + ends[i - 1].lines.length * 14 + 4;
        if (ends[i].y < minY) ends[i].y = minY;
      }
      ends.forEach((e) => out.push(`<text class="rm-label ${e.s.ref ? 'is-ref' : 'is-main'}" x="${lx.toFixed(1)}" y="${(e.y + 4).toFixed(1)}">${e.lines.map((t, k) => (k ? `<tspan x="${lx.toFixed(1)}" dy="14">${esc(t)}</tspan>` : esc(t))).join('')}</text>`));
    }
    // Hover columns: a guide line and the values of every line for that area.
    CATS.forEach((cat, i) => {
      const tip = series.map((s) => `${s.name}: ${one(s.values[i])}${s.fav ? ` (${pct(s.fav[i])} favourable)` : ''}`).join(' · ');
      out.push(`<g class="rm-hit" data-t="${esc(`${cat.letter}. ${cat.name}`)}" data-v="${esc(tip)}"><rect x="${(m.l + band * i).toFixed(1)}" y="${m.t - 6}" width="${band.toFixed(1)}" height="${ph + 12}" fill="transparent"/><line class="rm-guide" x1="${x(i).toFixed(1)}" x2="${x(i).toFixed(1)}" y1="${m.t}" y2="${m.t + ph}"/></g>`);
    });
    const summary = `${label}. Average answer in each area, from 1 (most comfortable) to 5 (most discomfort): `
      + series.map((s) => `${s.name}: ${CATS.map((cat, i) => `${cat.letter} ${one(s.values[i])}`).join(', ')}`).join('; ') + '.';
    return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(summary)}">${out.join('')}</svg>`;
  }

  function drawCharts() {
    document.querySelectorAll('[data-chart]').forEach((el) => {
      const chart = charts.get(el.dataset.chart);
      if (!chart || !el.offsetParent) return; // hidden panels are drawn when they are shown
      const w = el.clientWidth;
      if (w && Number(el.dataset.w) !== w) { el.innerHTML = reliefSvg(chart, w); el.dataset.w = String(w); }
    });
  }

  function chartSlot(id, chart) {
    charts.set(id, chart);
    return `<div class="ad-relief${chart.compact ? ' is-compact' : ''}" data-chart="${id}"></div>`;
  }

  const legend = (series) => (series.length < 2 ? '' : `<ul class="ad-lines" aria-label="Lines">${series.map((s) => `<li><span class="ad-line-key ${s.ref ? 'is-ref' : 'is-main'}" aria-hidden="true"></span>${esc(s.name)}</li>`).join('')}</ul>`);

  // ---------- pieces ----------
  const heading = (title, meta) => `<div class="ad-set-head"><h2>${esc(title)}</h2>${meta ? `<p>${esc(meta)}</p>` : ''}</div>`;
  const message = (title, text) => `<div class="ad-empty"><h3>${esc(title)}</h3><p>${esc(text)}</p></div>`;
  const hiddenText = (c) => (c && c.status === 'protected' ? 'Hidden to protect a smaller group' : 'Not enough responses yet');
  const areaName = (i) => `${CATS[i].letter}. ${CATS[i].name}`;

  // A short reading of the map: where discomfort is highest and lowest, and the biggest difference
  // from all departments. Descriptive only.
  function insights(values, ref, n) {
    const idx = values.map((v, i) => i).filter((i) => values[i] != null);
    if (!idx.length) return '';
    const hi = idx.reduce((a, b) => (values[b] > values[a] ? b : a));
    const lo = idx.reduce((a, b) => (values[b] < values[a] ? b : a));
    const items = [
      `<li><strong>Highest point (least comfort):</strong> ${esc(areaName(hi))} (${one(values[hi])}), a possible place to start.</li>`,
      `<li><strong>Lowest point (most comfort):</strong> ${esc(areaName(lo))} (${one(values[lo])}).</li>`
    ];
    const above = idx.filter((i) => values[i] > 3);
    if (above.length) items.push(`<li><strong>Above neutral (more discomfort than comfort):</strong> ${above.map((i) => esc(areaName(i))).join(', ')}.</li>`);
    if (ref) {
      const diffs = idx.filter((i) => ref[i] != null).map((i) => ({ i, d: values[i] - ref[i] }));
      const big = diffs.reduce((a, b) => (Math.abs(b.d) > Math.abs(a.d) ? b : a), { d: 0 });
      items.push(Math.abs(big.d) >= 0.2
        ? `<li><strong>Biggest difference from all departments:</strong> ${esc(areaName(big.i))}, ${one(Math.abs(big.d))} ${big.d > 0 ? 'higher (more discomfort)' : 'lower (more comfort)'}.</li>`
        : '<li><strong>Compared with all departments:</strong> within 0.2 in every area.</li>');
    }
    items.push(`<li class="ad-insight-note">Based on ${n} responses. Small differences can be due to chance.</li>`);
    return `<ul class="ad-insights">${items.join('')}</ul>`;
  }

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

  const CREDIT = 'A workplace adaptation of Relief Maps (Rodó-Zárate) and the NYU Intersectionality Lab\'s Relief Maps Tool: the six areas stand in for places, and the dashed line shows all departments.';
  const areaKey = () => `<p class="ad-key-areas">${CATS.map((cat) => `<span><b>${cat.letter}</b> ${esc(cat.name)}</span>`).join('')}</p>`;

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
    const values = reliefValues(c);
    const fav = CATS.map((cat) => c.scores[cat.id].favourable);
    const all = M.cell(rel, state.period, 'ALL');
    const ref = d && all.status === 'published' ? reliefValues(all) : null;
    const series = [{ name: d ? d.short : 'All departments', values, fav }];
    if (ref) series.push({ name: 'All departments', values: ref, fav: CATS.map((cat) => all.scores[cat.id].favourable), ref: true });
    out.innerHTML = heading(title, `${c.n} responses · ${when}`)
      + `<section class="ad-relief-card" aria-labelledby="relief-h">
          <div class="ad-relief-head"><h3 id="relief-h">Relief Map</h3>
            <p>Each point is the average answer in one area, from 1 (most comfortable) to 5 (most discomfort). Lines that rise show more discomfort.</p></div>
          ${chartSlot('dept', { series, compact: false, label: `Relief Map for ${title}` })}
          <div class="ad-narrow-key">${areaKey()}</div>
          ${legend(series)}
          ${insights(values, ref, c.n)}
          <p class="ad-credit">${esc(d ? CREDIT : CREDIT.replace(', and the dashed line shows all departments', ''))}</p>
        </section>
        <h3 class="ad-section-h">The six areas in detail</h3>
        <p class="ad-section-p">Each bar is the share of favourable answers to one statement.</p>
        <div class="ad-cards">${CATS.map((cat) => card(c, cat)).join('')}</div>`;
  }

  function renderCompare(rel) {
    const out = $('compare-out');
    if (!rel || !rel.periods.length) { out.innerHTML = heading('Compare departments', '') + message('No responses yet', `Results appear once there are at least ${K} responses.`); return; }
    const all = M.cell(rel, state.period, 'ALL');
    const ref = all.status === 'published' ? reliefValues(all) : null;
    const tiles = M.DEPARTMENTS.map((d) => {
      const c = M.cell(rel, state.period, d.id);
      if (c.status !== 'published') {
        return `<li class="ad-mini is-off" data-row="${d.id}"><div class="ad-mini-head"><span class="ad-mini-name">${esc(d.short)}</span><span class="ad-mini-n">&nbsp;</span></div><p class="ad-mini-msg">${hiddenText(c)}</p></li>`;
      }
      const series = [{ name: d.short, values: reliefValues(c), fav: CATS.map((cat) => c.scores[cat.id].favourable) }];
      if (ref) series.push({ name: 'All departments', values: ref, fav: CATS.map((cat) => all.scores[cat.id].favourable), ref: true });
      return `<li class="ad-mini" data-row="${d.id}"><div class="ad-mini-head"><button type="button" class="ad-link" data-department="${d.id}">${esc(d.short)}</button><span class="ad-mini-n">${c.n} responses</span></div>
        ${chartSlot(`mini-${d.id}`, { series, compact: true, label: `Relief Map for ${d.name}` })}</li>`;
    }).join('');
    const row = (id, label) => {
      const c = M.cell(rel, state.period, id);
      if (c.status !== 'published') return `<tr class="is-off" data-row="${id}"><th scope="row">${esc(label)}</th><td colspan="${CATS.length + 1}">${hiddenText(c)}</td></tr>`;
      return `<tr data-row="${id}"${id === 'ALL' ? ' class="is-all"' : ''}><th scope="row">${esc(label)}</th><td class="ad-n">${c.n}</td>${reliefValues(c).map((v) => `<td>${one(v)}</td>`).join('')}</tr>`;
    };
    out.innerHTML = heading('Compare departments', `Relief Maps · ${M.periodLabel(state.period)}`)
      + `<div class="ad-compare-key">${legend([{ name: 'Department' }, { name: 'All departments', ref: true }])}
          ${areaKey()}
          <p class="ad-hint">Higher means more discomfort (average answer from 1, most comfortable, to 5). Select a department to open its Relief Map and six graphs.</p></div>
        <ul class="ad-multiples">${tiles}</ul>
        <details class="ad-numbers"><summary>Show the numbers</summary>
          <div class="ad-table-wrap" tabindex="0" role="region" aria-label="Relief Map numbers">
          <table class="ad-compare">
            <caption class="visually-hidden">Average answer in each area, from 1 (most comfortable) to 5 (most discomfort), by department</caption>
            <thead><tr><th scope="col">Department</th><th scope="col">Responses</th>${CATS.map((cat) => `<th scope="col"><span class="ad-letter" aria-hidden="true">${cat.letter}</span><span class="ad-col-name">${esc(cat.name)}</span></th>`).join('')}</tr></thead>
            <tbody>${row('ALL', 'All departments')}${M.DEPARTMENTS.map((d) => row(d.id, d.short)).join('')}</tbody>
          </table></div></details>`;
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

  // ---------- tooltips (mouse) ----------
  function bindTips() {
    const tip = $('ad-tip');
    const show = (el, ev) => {
      tip.innerHTML = `<strong>${esc(el.dataset.t)}</strong>${esc(el.dataset.v)}`;
      tip.hidden = false;
      const r = el.getBoundingClientRect();
      let left = (ev && ev.pageX ? ev.pageX : r.left + window.scrollX + r.width / 2) + 12;
      if (left + tip.offsetWidth > window.scrollX + document.documentElement.clientWidth - 8) left -= tip.offsetWidth + 24;
      tip.style.left = `${Math.max(window.scrollX + 8, left)}px`;
      const top = ev && ev.pageY ? ev.pageY - tip.offsetHeight - 14 : r.top + window.scrollY - tip.offsetHeight - 8;
      tip.style.top = `${Math.max(window.scrollY + 8, top)}px`;
    };
    document.addEventListener('mousemove', (e) => { const el = e.target.closest('[data-t]'); if (el) show(el, e); else tip.hidden = true; });
    window.addEventListener('scroll', () => { tip.hidden = true; }, { passive: true });
  }

  // ---------- opening and closing ----------
  function open(source) {
    state.source = source;
    state.department = 'ALL';
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
    $('compare-out').addEventListener('click', (e) => {
      const b = e.target.closest('[data-department]');
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
