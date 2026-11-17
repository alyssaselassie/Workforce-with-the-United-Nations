// UN Workforce Analytics Dashboard: department datasets, six graphs per department, a comparison
// view and documentation. Every chart is drawn from an aggregated release (AssessmentModel.buildRelease),
// which holds only groups that meet the anonymity threshold: individual answers never reach this page.
(function () {
  'use strict';
  const M = window.AssessmentModel;
  const A = window.AssessmentAuth;
  const cfg = window.ANALYTICS_CONFIG || {};
  const $ = (id) => document.getElementById(id);
  const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pct = (v) => (v == null ? '–' : `${Math.round(v * 100)}%`);
  const K = M.CONFIG.minGroupSize;

  const ICON = {
    lock: '<path d="M7 11V8a5 5 0 0 1 10 0v3"/><rect x="4.5" y="11" width="15" height="10" rx="2"/>',
    wait: '<path d="M6 3h12M6 21h12M7 3c0 5 10 5 10 9s-10 4-10 9M17 3c0 5-10 5-10 9s10 4 10 9"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
    warn: '<path d="M12 3 2 20h20Z"/><path d="M12 10v4M12 17v.5"/>',
    inbox: '<path d="M3 13h5l2 3h4l2-3h5"/><path d="M5 5h14l2 8v6H3v-6Z"/>',
    refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>'
  };
  const icon = (n) => `<svg class="ad-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[n]}</svg>`;

  let demoStore = null;
  try { demoStore = M.demoStore(window.localStorage); demoStore.count(); } catch (e) { demoStore = null; }
  let demoBase = null;

  const releases = { live: null, demo: null, file: null };
  const state = {
    source: null, file: null, liveAt: null, department: 'ALL', category: 'ALL', period: null,
    compare: { departments: ['HUM', 'PPM', 'HR'], category: 'ALL', period: null }
  };

  // ---------- data ----------
  function release() {
    if (state.source === 'demo') {
      // The synthetic demonstration data plus any answers given in the demonstration survey in this browser.
      const extra = demoStore ? demoStore.all() : [];
      if (!releases.demo || releases.demo.extra !== extra.length) {
        demoBase = demoBase || M.demoResponses();
        releases.demo = M.buildRelease(demoBase.concat(extra), { source: 'demo', label: 'Demonstration data' });
        releases.demo.responses = demoBase.length;
        releases.demo.extra = extra.length;
      }
      return releases.demo;
    }
    return state.source ? releases[state.source] : null;
  }
  const isDemo = (rel) => rel && rel.source === 'demo';
  const latest = (rel) => (rel && rel.periods.length ? rel.periods[rel.periods.length - 1] : null);
  const deptName = (id) => (id === 'ALL' ? 'All departments' : M.DEPARTMENT_BY_ID[id].short);

  // ---------- source banner and chips ----------
  function banner(rel) {
    const el = $('source-banner');
    if (state.source === 'demo' || isDemo(rel)) {
      el.className = 'ad-banner is-demo';
      const extra = state.source === 'demo' && rel ? rel.extra || 0 : 0;
      const survey = cfg.surveyUrl ? `${String(cfg.surveyUrl).replace(/\/?$/, '/')}survey.html?demo=1` : '';
      const u = M.DEMO.unlock;
      el.innerHTML = `<p><strong>Demonstration data (fictional).</strong> ${rel && rel.responses ? `${rel.responses} synthetic responses` : 'Synthetic responses'} in ${rel ? rel.periods.length : 3} reporting periods${extra ? `, plus ${extra} ${extra === 1 ? 'answer' : 'answers'} given in the demonstration survey in this browser` : ''}. They are not real results, and differences between departments are random.</p>
        ${state.source === 'demo' ? `<p>Live demonstration: in ${esc(M.periodLabel(M.demoPeriod()))}, ${esc(M.DEPARTMENT_BY_ID[u.department].name)} has fewer than ${K} responses, so its results are still being collected and ${esc(M.DEPARTMENT_BY_ID[u.alsoShows].name)} is withheld to protect it. ${u.needed} demonstration answers for ${esc(M.DEPARTMENT_BY_ID[u.department].name)}, given in the same browser, unlock both.</p>
        <p class="ad-banner-actions">${survey ? `<a class="ad-btn ad-btn-quiet ad-btn-small" href="${esc(survey)}" target="_blank" rel="noopener">Take the demonstration survey</a>` : ''}${extra ? '<button type="button" class="ad-btn ad-btn-quiet ad-btn-small" id="clear-demo">Remove demonstration answers</button>' : ''}</p>` : ''}`;
      return;
    }
    el.className = 'ad-banner is-real';
    if (state.source === 'live') {
      el.innerHTML = `<p><strong>Live results</strong> from the secure results service, retrieved ${esc(state.liveAt ? state.liveAt.toLocaleString() : '')}. Only aggregated groups reach this page; groups under ${K} responses carry no numbers.</p>
        <p class="ad-banner-actions"><button type="button" class="ad-btn ad-btn-quiet ad-btn-small" id="refresh-live">${icon('refresh')} Refresh results</button></p>`;
      return;
    }
    const f = state.file || {};
    el.innerHTML = f.kind === 'release'
      ? `<p><strong>Results file: ${esc(f.name)}.</strong> Aggregated results (minimum group size ${rel.minGroupSize}, created ${esc(rel.created)}). The file contains no individual answers.</p>`
      : `<p><strong>Results file: ${esc(f.name)}.</strong> ${f.count} complete responses from a Qualtrics export, read in this browser only: nothing is uploaded, and response IDs and dates are discarded.</p>`;
  }

  function sourceChip(rel) {
    if (isDemo(rel)) return '<li class="is-demo">Demonstration data</li>';
    if (state.source === 'live') return '<li class="is-real">Live results</li>';
    return `<li class="is-real">File: ${esc((state.file || {}).name || 'results')}</li>`;
  }

  function sessionBar() {
    const el = $('session');
    if (!state.source) { el.innerHTML = ''; return; }
    if (state.source === 'live') {
      const s = A.session();
      el.innerHTML = `<span class="ad-who">Signed in${s ? ` as <strong>${esc(s.email)}</strong>` : ''}</span><button type="button" class="ad-btn ad-btn-on-dark" id="sign-out">Sign out</button>`;
      return;
    }
    el.innerHTML = `<span class="ad-who">${state.source === 'demo' ? 'Demonstration · no sign-in' : 'Results file · not signed in'}</span><button type="button" class="ad-btn ad-btn-on-dark" id="close-source">Close</button>`;
  }

  // ---------- filters ----------
  const opt = (value, label, selected) => `<option value="${esc(value)}"${selected ? ' selected' : ''}>${esc(label)}</option>`;
  function fillSelects(rel) {
    const periods = rel ? rel.periods : [];
    if (!periods.includes(state.period)) state.period = latest(rel);
    if (!periods.includes(state.compare.period)) state.compare.period = latest(rel);
    const periodOpts = (sel) => (periods.length ? periods.slice().reverse().map((p) => opt(p, M.periodLabel(p), p === sel)).join('') : opt('', 'No responses yet', true));
    $('f-period').innerHTML = periodOpts(state.period);
    $('c-period').innerHTML = periodOpts(state.compare.period);
    $('f-period').disabled = $('c-period').disabled = !periods.length;
    $('f-department').innerHTML = opt('ALL', 'All departments (overall dataset)', state.department === 'ALL') + M.DEPARTMENTS.map((d) => opt(d.id, d.name, state.department === d.id)).join('');
    const cats = (sel) => opt('ALL', 'All six areas', sel === 'ALL') + M.CATEGORIES.map((c) => opt(c.id, `${c.letter}. ${c.name}`, sel === c.id)).join('');
    $('f-category').innerHTML = cats(state.category);
    $('c-category').innerHTML = cats(state.compare.category);
  }

  // ---------- department navigation ----------
  function chip(c) {
    if (c && c.status === 'published') return `<span class="ad-chip">${c.n}<span class="visually-hidden"> responses</span></span>`;
    if (c && c.status === 'protected') return '<span class="ad-chip is-held">Withheld</span>';
    return '<span class="ad-chip is-wait">Collecting</span>';
  }
  function renderNav(rel) {
    const item = (id, label, cls) => {
      const c = rel && state.period ? M.cell(rel, state.period, id) : null;
      return `<li${cls ? ` class="${cls}"` : ''}><button type="button" data-department="${id}"${state.department === id ? ' aria-current="true"' : ''}><span>${esc(label)}</span>${chip(c)}</button></li>`;
    };
    $('department-nav').innerHTML = item('ALL', 'Overall dataset', 'is-overall') + M.DEPARTMENTS.map((d) => item(d.id, d.short)).join('');
  }

  // ---------- charts ----------
  // One stacked bar: segments from most to least favourable, then the count of "don't know".
  function rowHtml(label, sub, counts, catId, id) {
    const cat = M.CATEGORY_BY_ID[catId];
    const pol = M.polarity(catId);
    const options = M.SCALES[cat.scale].options;
    const subst = counts.slice(0, 5).reduce((a, b) => a + b, 0);
    const na = counts[5];
    const fav = subst ? pol.favourable.reduce((a, code) => a + counts[code - 1], 0) / subst : null;
    const parts = pol.order.map((code, i) => ({ code, n: counts[code - 1], share: subst ? counts[code - 1] / subst : 0, cls: `c${i + 1}`, label: options[code - 1] }));
    const aria = `${label}: ${parts.map((p) => `${pct(p.share)} ${p.label.toLowerCase()}`).join(', ')}${na ? `; ${na} ${M.NA.label.toLowerCase()}` : ''}.`;
    const bar = subst
      ? `<div class="ad-bar" role="img" aria-label="${esc(aria)}">${parts.filter((p) => p.n).map((p) => `<span class="ad-seg ${p.cls}" style="flex:${p.share.toFixed(4)} 1 0" data-t="${esc(p.label)}" data-v="${esc(`${pct(p.share)} (${p.n} of ${subst})`)}">${p.share >= 0.09 ? pct(p.share) : ''}</span>`).join('')}</div>`
      : `<p class="ad-low">Everyone answered "${esc(M.NA.label)}".</p>`;
    return `<li class="ad-row"${id ? ` data-item="${id}"` : ''}><span class="ad-row-label">${esc(label)}${sub || na ? `<small>${sub ? esc(sub) : ''}${sub && na ? ' · ' : ''}${na ? `${na} don't know or N/A` : ''}</small>` : ''}</span>${bar}<span class="ad-row-fav">${pct(fav)}<small>n=${subst}</small></span></li>`;
  }

  function legendHtml(catId) {
    const cat = M.CATEGORY_BY_ID[catId];
    const pol = M.polarity(catId);
    const options = M.SCALES[cat.scale].options;
    return `<ul class="ad-legend" aria-label="Answer colours">${pol.order.map((code, i) => `<li><span class="ad-swatch c${i + 1}" aria-hidden="true"></span>${esc(options[code - 1])}</li>`).join('')}<li><span class="ad-swatch is-na" aria-hidden="true"></span>${esc(M.NA.label)}: counted separately</li></ul>`;
  }

  function trendSvg(points, width) {
    const W0 = Math.max(260, Math.min(560, width || 520)), H = 150, m = { l: 44, r: 30, t: 22, b: 30 };
    const pw = W0 - m.l - m.r, ph = H - m.t - m.b;
    const x = (i) => m.l + (points.length === 1 ? pw / 2 : (i * pw) / (points.length - 1));
    const y = (v) => m.t + (1 - v) * ph;
    const out = [];
    [0, 0.5, 1].forEach((v) => {
      out.push(`<line x1="${m.l}" x2="${m.l + pw}" y1="${y(v)}" y2="${y(v)}" stroke="${v === 0 ? '#c3c8d2' : '#e3e7ee'}" stroke-width="1"/>`);
      out.push(`<text x="${m.l - 8}" y="${y(v) + 4}" text-anchor="end" font-size="11.5" fill="#4f5a6b">${v * 100}%</text>`);
    });
    points.forEach((p, i) => out.push(`<text x="${x(i)}" y="${H - 8}" text-anchor="middle" font-size="11.5" fill="#33405a">${esc(p.label)}</text>`));
    let d = '', pen = false;
    points.forEach((p, i) => { if (p.v == null) { pen = false; return; } d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.v).toFixed(1)}`; pen = true; });
    out.push(`<path d="${d}" fill="none" stroke="#0072bc" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`);
    const shown = points.map((p, i) => Object.assign({ i }, p)).filter((p) => p.v != null);
    shown.forEach((p, j) => {
      out.push(`<circle cx="${x(p.i)}" cy="${y(p.v)}" r="4.5" fill="#0072bc" stroke="#fff" stroke-width="2"><title>${esc(`${p.label}: ${pct(p.v)} favourable (n=${p.n})`)}</title></circle>`);
      if (j === 0 || j === shown.length - 1) out.push(`<text x="${x(p.i)}" y="${y(p.v) - 10}" text-anchor="middle" font-size="12" font-weight="700" fill="#13294b">${pct(p.v)}</text>`);
    });
    return `<svg viewBox="0 0 ${W0} ${H}" width="${W0}" height="${H}" role="img" aria-label="${esc(`Percentage favourable by reporting period: ${points.map((p) => `${p.label} ${p.v == null ? 'not shown' : pct(p.v)}`).join(', ')}.`)}">${out.join('')}</svg>`;
  }

  function trendPoints(rel, catId) {
    return rel.periods.map((p) => {
      const c = M.cell(rel, p, state.department);
      const m = /^(\d{4})-Q(\d)$/.exec(p);
      return { label: m ? `Q${m[2]} ${m[1]}` : p, v: c.status === 'published' ? c.scores[catId].favourable : null, n: c.n };
    });
  }

  function trendBlock(rel, catId) {
    if (trendPoints(rel, catId).filter((p) => p.v != null).length < 2) return '<div class="ad-trend"><h4>Change over time</h4><p>A trend line appears once this dataset has results in at least two reporting periods.</p></div>';
    return `<div class="ad-trend"><h4>Change over time: % favourable</h4><div class="ad-trend-chart" data-cat="${catId}"></div></div>`;
  }

  function drawTrends(rel) {
    document.querySelectorAll('.ad-trend-chart').forEach((el) => { el.innerHTML = trendSvg(trendPoints(rel, el.dataset.cat), el.clientWidth); });
  }

  function numbersTable(c, cat) {
    const options = M.SCALES[cat.scale].options;
    return `<details class="ad-details"><summary>Show the numbers</summary><div class="ad-table-wrap" tabindex="0" role="region" aria-label="${esc(cat.name)}: the numbers"><table class="ad-table">
      <caption class="visually-hidden">${esc(cat.name)}: answers to each statement (count and share of answers excluding "${esc(M.NA.label)}")</caption>
      <thead><tr><th scope="col">Statement</th>${options.map((o) => `<th scope="col">${esc(o)}</th>`).join('')}<th scope="col">Don't know / N/A</th><th scope="col">Favourable</th></tr></thead>
      <tbody>${cat.items.map((it) => {
        const counts = c.items[it.id];
        const subst = counts.slice(0, 5).reduce((a, b) => a + b, 0);
        const fav = subst ? M.polarity(cat.id).favourable.reduce((a, code) => a + counts[code - 1], 0) / subst : null;
        return `<tr><th scope="row">${esc(it.concept)}<br><small>${esc(it.text)}</small></th>${counts.slice(0, 5).map((n) => `<td>${n}<br><small>${subst ? pct(n / subst) : '–'}</small></td>`).join('')}<td>${counts[5]}</td><td>${pct(fav)}</td></tr>`;
      }).join('')}</tbody></table></div></details>`;
  }

  function categoryCard(rel, c, cat) {
    const s = c.scores[cat.id];
    const dataset = state.department === 'ALL' ? 'Overall dataset' : M.DEPARTMENT_BY_ID[state.department].dataset;
    return `<section class="ad-card" aria-labelledby="cat-${cat.id}">
      <div class="ad-card-head">
        <div><h3 id="cat-${cat.id}">${cat.letter}. ${esc(cat.name)}</h3>
          <p class="ad-card-meta">${esc(dataset)} · ${esc(M.periodLabel(state.period))} · ${c.n} responses · ${esc(M.SCALES[cat.scale].name)} scale</p></div>
        <div class="ad-headline"><strong>${pct(s.favourable)}</strong><span>favourable${s.lo != null ? ` (95% CI ${pct(s.lo)}–${pct(s.hi)})` : ''}</span></div>
      </div>
      ${cat.caution
        ? `<p class="ad-caution">${icon('info')} What people notice in workplace practices; not a measure of anyone's implicit bias. Favourable = ${esc(M.favourableWords(cat.id))} (less often is better).</p>`
        : `<p class="ad-caution">Favourable = ${esc(M.favourableWords(cat.id))}. ${pct(s.neutral)} in the middle, ${pct(s.unfavourable)} unfavourable.</p>`}
      ${legendHtml(cat.id)}
      <ul class="ad-rows">${cat.items.map((it) => rowHtml(it.concept, '', c.items[it.id], cat.id, it.id)).join('')}</ul>
      ${trendBlock(rel, cat.id)}
      ${numbersTable(c, cat)}
    </section>`;
  }

  function overviewCard(c) {
    return `<section class="ad-card" aria-labelledby="ov-h">
      <div class="ad-card-head"><div><h3 id="ov-h">All six areas at a glance</h3><p class="ad-card-meta">Every answer in each area combined. Favourable = the two most positive answers.</p></div>
        <div class="ad-headline"><strong>${c.n}</strong><span>completed responses</span></div></div>
      <ul class="ad-legend" aria-label="Answer colours"><li><span class="ad-swatch c1" aria-hidden="true"></span>Most favourable</li><li><span class="ad-swatch c2" aria-hidden="true"></span>Favourable</li><li><span class="ad-swatch c3" aria-hidden="true"></span>Middle</li><li><span class="ad-swatch c4" aria-hidden="true"></span>Unfavourable</li><li><span class="ad-swatch c5" aria-hidden="true"></span>Most unfavourable</li></ul>
      <ul class="ad-rows">${M.CATEGORIES.map((cat) => rowHtml(`${cat.letter}. ${cat.name}`, M.SCALES[cat.scale].name, c.scores[cat.id].counts, cat.id)).join('')}</ul>
    </section>`;
  }

  // ---------- one department's dashboard ----------
  function datasetHead(rel, c) {
    const d = state.department === 'ALL' ? null : M.DEPARTMENT_BY_ID[state.department];
    const n = c && c.status === 'published' ? `<li class="is-n">${c.n} responses</li>` : '';
    return `<div class="ad-set-head"><h2>${esc(d ? d.dataset : 'Overall dataset')}</h2><p class="ad-set-name">${esc(d ? d.name : 'All departments combined')}</p>
      <ul class="ad-meta">${state.period ? `<li>${esc(M.periodLabel(state.period))}</li>` : ''}${n}${sourceChip(rel)}</ul></div>`;
  }

  function withheldHtml(c) {
    if (c && c.status === 'protected') {
      return `<div class="ad-callout"><h3>${icon('lock')}Results withheld to protect a smaller group</h3>
        <p>This department has enough responses, but showing it next to the other results would let someone work out the answers of a group smaller than ${K} by subtraction.</p>
        <p>It will appear automatically when more responses arrive.</p></div>`;
    }
    return `<div class="ad-callout"><h3>${icon('wait')}Results are being collected</h3>
      <p>Results are being collected. Aggregated insights will become available once the minimum response threshold has been reached.</p>
      <p>Minimum: ${K} completed responses for this dataset in the selected reporting period. Individual answers are never shown.</p></div>`;
  }

  function renderDash(rel) {
    const out = $('dash');
    if (!rel || !rel.periods.length) {
      out.innerHTML = `${datasetHead(rel, null)}<div class="ad-callout"><h3>${icon('inbox')}No responses yet</h3>
        <p>Results are being collected. Aggregated insights will become available once the minimum response threshold has been reached.</p></div>`;
      return;
    }
    const c = M.cell(rel, state.period, state.department);
    if (!c || c.status !== 'published') { out.innerHTML = datasetHead(rel, c) + withheldHtml(c); return; }
    const cats = state.category === 'ALL' ? M.CATEGORIES : [M.CATEGORY_BY_ID[state.category]];
    out.innerHTML = datasetHead(rel, c) + (state.category === 'ALL' ? overviewCard(c) : '') + cats.map((cat) => categoryCard(rel, c, cat)).join('');
    drawTrends(rel);
  }

  // ---------- comparison ----------
  function dotPanel(cat, rows, ref) {
    const axis = [0, 25, 50, 75, 100];
    return `<section class="ad-card" aria-labelledby="cmp-${cat.id}">
      <div class="ad-card-head"><div><h3 id="cmp-${cat.id}">${cat.letter}. ${esc(cat.name)}</h3><p class="ad-card-meta">% favourable with 95% confidence interval${ref ? ' · dashed line: all departments' : ''}</p></div></div>
      <div class="ad-dotplot" role="img" aria-label="${esc(`${cat.name}, % favourable: ${rows.map((r) => `${r.label} ${pct(r.s.favourable)} (n=${r.n})`).join('; ')}${ref ? `; all departments ${pct(ref.favourable)}` : ''}.`)}">
        ${rows.map((r) => `<div class="ad-dot-row"><span class="ad-dot-label">${esc(r.label)} <small>n=${r.n}</small></span>
          <span class="ad-dot-track">${ref ? `<span class="ad-ref" style="left:${(ref.favourable * 100).toFixed(1)}%"></span>` : ''}${r.s.lo != null ? `<span class="ad-ci" style="left:${(r.s.lo * 100).toFixed(1)}%;width:${((r.s.hi - r.s.lo) * 100).toFixed(1)}%"></span>` : ''}<span class="ad-dot" style="left:${(r.s.favourable * 100).toFixed(1)}%" data-t="${esc(r.label)}" data-v="${esc(`${pct(r.s.favourable)} favourable${r.s.lo != null ? `, 95% CI ${pct(r.s.lo)}–${pct(r.s.hi)}` : ''} (n=${r.n})`)}"></span></span>
          <span class="ad-dot-val">${pct(r.s.favourable)}</span></div>`).join('')}
        <div class="ad-dot-row ad-dot-axis" aria-hidden="true"><span></span><span class="ad-dot-track is-axis">${axis.map((a) => `<span style="left:${a}%">${a}%</span>`).join('')}</span><span></span></div>
      </div>
    </section>`;
  }

  function renderCompare(rel) {
    const cs = state.compare;
    const period = cs.period;
    $('c-departments').innerHTML = M.DEPARTMENTS.map((d) => {
      const c = rel && period ? M.cell(rel, period, d.id) : null;
      const ok = c && c.status === 'published';
      const note = ok ? `n=${c.n}` : c && c.status === 'protected' ? 'withheld' : 'collecting';
      return `<label><input type="checkbox" value="${d.id}"${ok && cs.departments.includes(d.id) ? ' checked' : ''}${ok ? '' : ' disabled'}> ${esc(d.short)} <span class="ad-hint">${note}</span></label>`;
    }).join('');
    const out = $('compare-out');
    if (!rel || !period) { out.innerHTML = '<div class="ad-callout"><h3>No responses yet</h3><p>Results are being collected. Aggregated insights will become available once the minimum response threshold has been reached.</p></div>'; return; }
    const picked = M.DEPARTMENTS.filter((d) => cs.departments.includes(d.id)).map((d) => ({ d, c: M.cell(rel, period, d.id) })).filter((x) => x.c.status === 'published');
    const head = `<ul class="ad-meta"><li>${esc(M.periodLabel(period))}</li>${sourceChip(rel)}</ul>`;
    if (picked.length < 2) {
      out.innerHTML = `${head}<div class="ad-callout"><h3>Choose at least two departments</h3><p>Only departments whose results can be shown for this reporting period can be compared.</p></div>`;
      return;
    }
    const warns = [];
    const ns = picked.map((x) => x.c.n);
    if (Math.max(...ns) >= 3 * Math.min(...ns)) warns.push(`Sample sizes differ a lot (n = ${Math.min(...ns)} to ${Math.max(...ns)}). Results for smaller departments are less precise: where the confidence intervals overlap, the difference may be due to chance.`);
    if (picked.some((x) => x.c.n < 20)) warns.push('Some departments have fewer than 20 responses, so their percentages can move a lot with a few answers. Read differences of a few points as similar.');
    const ref = M.cell(rel, period, 'ALL');
    const cats = cs.category === 'ALL' ? M.CATEGORIES : [M.CATEGORY_BY_ID[cs.category]];
    const table = `<details class="ad-details" open><summary>Show the numbers</summary><div class="ad-table-wrap" tabindex="0" role="region" aria-label="Comparison: the numbers"><table class="ad-table">
      <caption class="visually-hidden">% favourable by department and area, with 95% confidence intervals</caption>
      <thead><tr><th scope="col">Department</th><th scope="col">Responses</th>${cats.map((c) => `<th scope="col">${c.letter}. ${esc(c.name)}</th>`).join('')}</tr></thead>
      <tbody>${picked.map((x) => `<tr><th scope="row">${esc(x.d.short)}</th><td>${x.c.n}</td>${cats.map((c) => { const s = x.c.scores[c.id]; return `<td>${pct(s.favourable)}<br><small>${s.lo != null ? `${pct(s.lo)}–${pct(s.hi)}` : ''}</small></td>`; }).join('')}</tr>`).join('')}
      ${ref && ref.status === 'published' ? `<tr><th scope="row">All departments</th><td>${ref.n}</td>${cats.map((c) => `<td>${pct(ref.scores[c.id].favourable)}</td>`).join('')}</tr>` : ''}</tbody></table></div></details>`;
    out.innerHTML = head + warns.map((w) => `<p class="ad-warn">${icon('warn')}<span>${esc(w)}</span></p>`).join('')
      + cats.map((cat) => dotPanel(cat, picked.map((x) => ({ label: x.d.short, n: x.c.n, s: x.c.scores[cat.id] })), ref && ref.status === 'published' ? ref.scores[cat.id] : null)).join('')
      + `<section class="ad-card">${table}</section>`;
  }

  // ---------- about ----------
  function aboutHtml() {
    const src = Object.values(M.SOURCES);
    return `<h2>What the assessment measures</h2>
      <p>${M.ITEMS.length} statements in six areas, plus consent and department: ${M.QUESTION_COUNT} multiple-choice questions, all required. Each area uses one answer scale: agreement, frequency or confidence. If a statement does not apply, people choose "${esc(M.NA.label)}", which is counted but left out of percentages.</p>
      <div class="ad-table-wrap" tabindex="0" role="region" aria-label="The six areas"><table class="ad-table"><caption class="visually-hidden">The six areas</caption>
        <thead><tr><th scope="col">Area</th><th scope="col">Statements</th><th scope="col">Scale</th><th scope="col">Favourable</th></tr></thead>
        <tbody>${M.CATEGORIES.map((c) => `<tr><th scope="row">${c.letter}. ${esc(c.name)}</th><td>${c.items.length}</td><td>${esc(M.SCALES[c.scale].options.join(' · '))}</td><td>${esc(M.favourableWords(c.id))}</td></tr>`).join('')}</tbody></table></div>
      ${M.CATEGORIES.map((c) => `<details class="ad-details"><summary>${c.letter}. ${esc(c.name)}: the statements and their sources</summary><ol>${c.items.map((it) => `<li><strong>${esc(it.text)}</strong><br><small>${esc(it.concept)} · ${esc(it.basis)}${it.sources.length ? ` · ${esc(it.sources.map((s) => M.SOURCES[s].short).join('; '))}` : ''}. ${esc(it.note)}</small></li>`).join('')}</ol></details>`).join('')}
      <p class="ad-note-inline">Statements are adapted from, or are new wording of, published concepts; none is copied from a licensed instrument. Area E asks what people notice in workplace practices: it is not a measure of anyone's implicit bias. Scores are descriptive, not validated measurements.</p>

      <h2 id="privacy-h" tabindex="-1">How respondents are protected</h2>
      <ul>
        <li><strong>Minimum group size: ${K} completed responses.</strong> Nothing is shown for a smaller department, or for the whole organization, in a reporting period. Until then the dashboard says that results are being collected.</li>
        <li><strong>No working out small groups by subtraction.</strong> If the departments that cannot be shown add up to fewer than ${K}, the next-smallest department is withheld too, so no small group can be calculated from the organization total.</li>
        <li><strong>Each reporting period on its own.</strong> No result covers several periods, so periods cannot be subtracted from each other. Only the quarter is stored, never the date or time.</li>
        <li><strong>No individual answers, ever.</strong> With live results, responses are aggregated on the server and only group totals reach this page. Hidden groups carry no numbers at all, not even their size.</li>
        <li><strong>Separate datasets.</strong> Each department has its own dataset and its own six graphs; comparisons use only departments that can be shown.</li>
        <li><strong>Demonstration data is never mixed with real results.</strong> Each source is opened on its own and labelled on every chart.</li>
      </ul>

      <h2>Where the data comes from</h2>
      <ul>
        <li><strong>Live results</strong> (after signing in): the separate survey application sends each response to a secure database that respondents can write to but nobody can read through the public connection. A server-side results service checks that you are signed in and authorized, applies the rules above and returns aggregated results only.</li>
        <li><strong>Demonstration</strong>: fictional responses generated in this browser from a fixed seed, plus any answers given in the demonstration version of the survey in the same browser.</li>
        <li><strong>Results files</strong>: a Qualtrics export (CSV) or an aggregated results file (JSON) is read in this browser and never uploaded. Response IDs and dates are discarded. Keep raw exports in access-controlled storage.</li>
      </ul>

      <h2>Downloads</h2>
      <ul class="ad-files">
        <li><a href="downloads/assessment-qualtrics.txt" download><span class="ad-ext">TXT</span><span>The assessment, for import into Qualtrics</span></a></li>
        <li><a href="downloads/assessment-codebook.csv" download><span class="ad-ext">CSV</span><span>Codebook: questions, codes and sources</span></a></li>
        <li><a href="downloads/demo-qualtrics-export.csv" download><span class="ad-ext">CSV</span><span>Demonstration export (synthetic)</span></a></li>
        <li><button type="button" id="dl-csv"><span class="ad-ext">CSV</span><span>Aggregated results, current source</span></button></li>
        <li><button type="button" id="dl-json"><span class="ad-ext">JSON</span><span>Aggregated results file, current source</span></button></li>
      </ul>

      <h2>Sources and licences</h2>
      <ol class="ad-refs">${src.map((s) => `<li>${esc(s.cite)} <a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.url.replace(/^https:\/\//, ''))}</a>${s.licence ? `<br><small>${esc(s.licence)}</small>` : ''}</li>`).join('')}</ol>`;
  }

  // ---------- downloads ----------
  function download(name, text, type) {
    const blob = new Blob([text], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
  }
  const exportName = (ext) => `workforce-assessment-aggregated-${isDemo(release()) ? 'demonstration' : state.source === 'live' ? 'live' : 'file'}.${ext}`;

  // ---------- tooltips ----------
  function bindTips() {
    const tip = $('ad-tip');
    const show = (el, ev) => {
      tip.innerHTML = `<strong>${esc(el.dataset.t)}</strong>${esc(el.dataset.v)}`;
      tip.hidden = false;
      const r = el.getBoundingClientRect();
      let left = (ev && ev.pageX ? ev.pageX : r.left + window.scrollX + r.width / 2) + 12;
      if (left + tip.offsetWidth > window.scrollX + document.documentElement.clientWidth - 8) left -= tip.offsetWidth + 24;
      tip.style.left = `${Math.max(window.scrollX + 8, left)}px`;
      tip.style.top = `${r.top + window.scrollY - tip.offsetHeight - 8}px`;
    };
    document.addEventListener('mouseover', (e) => { const el = e.target.closest('[data-t]'); if (el) show(el, e); });
    document.addEventListener('mousemove', (e) => { const el = e.target.closest('[data-t]'); if (el) show(el, e); });
    document.addEventListener('mouseout', (e) => { if (e.target.closest('[data-t]')) tip.hidden = true; });
    window.addEventListener('scroll', () => { tip.hidden = true; }, { passive: true });
  }

  // ---------- tabs ----------
  const TABS = ['dash', 'compare', 'about'];
  function showTab(name, focus) {
    TABS.forEach((t) => {
      const on = t === name;
      const tab = $(`tab-${t}`);
      tab.setAttribute('aria-selected', String(on));
      tab.tabIndex = on ? 0 : -1;
      $(`panel-${t}`).hidden = !on;
    });
    if (focus) $(`tab-${name}`).focus();
    if (name === 'dash') drawTrends(release());
  }
  function bindTabs() {
    TABS.forEach((t, i) => {
      const tab = $(`tab-${t}`);
      tab.addEventListener('click', () => showTab(t));
      tab.addEventListener('keydown', (e) => {
        const n = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: TABS.length - 1 }[e.key];
        if (n == null) return;
        e.preventDefault();
        showTab(TABS[(n + TABS.length) % TABS.length], true);
      });
    });
  }

  // ---------- views ----------
  function renderAll() {
    const rel = release();
    sessionBar();
    if (!state.source) return;
    banner(rel);
    fillSelects(rel);
    renderNav(rel);
    renderDash(rel);
    renderCompare(rel);
  }

  function openSource(src) {
    state.source = src;
    $('gate').hidden = true;
    $('app').hidden = false;
    renderAll();
    showTab('dash');
    $('app-h').focus({ preventScroll: false });
  }

  function closeSource() {
    state.source = null;
    state.file = null;
    releases.file = null;
    $('app').hidden = true;
    $('gate').hidden = false;
    renderAll();
    window.scrollTo(0, 0);
    $('gate-h').focus();
  }

  async function loadLive() {
    const rel = M.checkRelease(await A.fetchRelease());
    releases.live = rel;
    state.liveAt = new Date();
  }

  function setMsg(id, text, kind) {
    const el = $(id);
    el.className = `ad-msg${kind ? ` is-${kind}` : ''}`;
    el.textContent = text || '';
  }

  function readFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result);
        let note = '';
        if (/\.json$/i.test(file.name) || /^\s*\{/.test(text)) {
          releases.file = M.checkRelease(JSON.parse(text));
          state.file = { name: file.name, kind: 'release' };
          note = `Opened aggregated results: ${releases.file.periods.length} reporting ${releases.file.periods.length === 1 ? 'period' : 'periods'}.`;
        } else {
          const data = M.readExport(text);
          if (!data.responses.length) throw new Error('The file has no complete responses.');
          releases.file = M.buildRelease(data.responses, { source: data.demo ? 'demo' : 'file', label: file.name });
          releases.file.responses = data.responses.length;
          state.file = { name: file.name, kind: 'responses', count: data.responses.length };
          const left = [data.declined ? `${data.declined} who did not consent` : '', data.incomplete ? `${data.incomplete} incomplete` : '', data.tests ? `${data.tests} previews or tests` : ''].filter(Boolean);
          note = `Opened ${data.responses.length} complete responses${left.length ? ` (left out: ${left.join(', ')})` : ''}.`;
          if (data.identifying) note += ' Warning: this file has identifying details (such as IP addresses or names). Turn on "Anonymize responses" in Qualtrics and export again; do not share this file.';
        }
        setMsg('file-msg', note, /Warning/.test(note) ? 'error' : 'ok');
        openSource('file');
      } catch (err) {
        setMsg('file-msg', err instanceof SyntaxError ? 'This file could not be read.' : err.message, 'error');
      }
    };
    reader.readAsText(file);
  }

  function init() {
    $('about').innerHTML = aboutHtml();
    document.querySelectorAll('.js-k').forEach((el) => { el.textContent = String(K); });
    bindTabs();
    bindTips();

    // Gate: sign in, demonstration, or a results file.
    if (!A.configured) {
      $('signin-form').hidden = true;
      $('signin-off').hidden = false;
    }
    $('signin-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = $('email').value.trim(), password = $('password').value;
      if (!email || !password) { setMsg('signin-msg', 'Enter your email and password.', 'error'); return; }
      const btn = $('signin-btn');
      btn.disabled = true;
      setMsg('signin-msg', 'Signing in…');
      try {
        await A.signIn(email, password);
        await loadLive();
        $('password').value = '';
        setMsg('signin-msg', '');
        openSource('live');
      } catch (err) {
        if (err.code === 403) await A.signOut();
        setMsg('signin-msg', err.message, 'error');
      } finally {
        btn.disabled = false;
      }
    });
    $('open-demo').addEventListener('click', () => openSource('demo'));
    $('file-input').addEventListener('change', (e) => { const f = e.target.files[0]; if (f) readFile(f); e.target.value = ''; });

    // Header: sign out or close the current source.
    $('session').addEventListener('click', async (e) => {
      if (e.target.closest('#sign-out')) { await A.signOut(); releases.live = null; closeSource(); setMsg('signin-msg', 'You are signed out.', 'ok'); }
      if (e.target.closest('#close-source')) closeSource();
    });
    $('source-banner').addEventListener('click', async (e) => {
      if (e.target.closest('#clear-demo')) { demoStore.clear(); renderAll(); return; }
      if (e.target.closest('#refresh-live')) {
        try { await loadLive(); renderAll(); } catch (err) {
          if (err.code === 401) { closeSource(); setMsg('signin-msg', err.message, 'error'); return; }
          window.alert(err.message);
        }
      }
    });

    const on = (id, fn, all) => $(id).addEventListener('change', (e) => { fn(e.target.value); if (all) renderAll(); else renderCompare(release()); });
    on('f-department', (v) => { state.department = v; }, true);
    on('f-category', (v) => { state.category = v; }, true);
    on('f-period', (v) => { state.period = v; }, true);
    on('c-category', (v) => { state.compare.category = v; });
    on('c-period', (v) => { state.compare.period = v; });
    $('c-departments').addEventListener('change', (e) => {
      if (e.target.type !== 'checkbox') return;
      const set = new Set(state.compare.departments);
      if (e.target.checked) set.add(e.target.value); else set.delete(e.target.value);
      state.compare.departments = Array.from(set);
      renderCompare(release());
    });
    $('department-nav').addEventListener('click', (e) => {
      const b = e.target.closest('[data-department]');
      if (!b) return;
      state.department = b.dataset.department;
      renderAll();
      $('dash').scrollIntoView({ block: 'start', behavior: 'smooth' });
    });
    $('about').addEventListener('click', (e) => {
      if (e.target.closest('#dl-csv')) download(exportName('csv'), M.releaseCSV(release()), 'text/csv');
      if (e.target.closest('#dl-json')) { const r = Object.assign({}, release()); delete r.responses; delete r.extra; download(exportName('json'), JSON.stringify(r, null, 1), 'application/json'); }
    });

    // Demonstration answers given in another tab of this browser redraw the charts.
    window.addEventListener('storage', (e) => { if (state.source === 'demo' && [M.CONFIG.demoStorageKey, null].includes(e.key)) renderAll(); });
    document.addEventListener('visibilitychange', () => { if (!document.hidden && state.source === 'demo') renderAll(); });
    let wide = window.innerWidth;
    window.addEventListener('resize', () => { if (state.source && Math.abs(window.innerWidth - wide) > 40) { wide = window.innerWidth; drawTrends(release()); } });

    const params = new URLSearchParams(window.location.search);
    if (params.get('demo') === '1') {
      openSource('demo');
      if (window.location.hash === '#compare') showTab('compare');
      else if (window.location.hash === '#about') showTab('about');
    }
    renderAll();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
