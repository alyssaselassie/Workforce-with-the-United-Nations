// Workforce Survey & Analytics: entity dashboards, comparison and documentation. Every chart is
// drawn from the aggregated release (WorkforceSurvey.buildRelease), which holds only groups that meet
// the anonymity threshold: individual answers never reach the page.
(function () {
  'use strict';
  const W = window.WorkforceSurvey;
  const $ = (id) => document.getElementById(id);
  const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pct = (v) => (v == null ? '–' : `${Math.round(v * 100)}%`);
  const K = W.CONFIG.minGroupSize;
  const REPO = 'https://github.com/alyssaselassie/Workforce-with-the-United-Nations/blob/main/';

  let store = null;
  try { store = W.deviceStore(window.localStorage); store.count(); } catch (e) { store = null; }

  const releases = { demo: null, device: null, file: null };
  const state = {
    source: 'demo', file: null, entity: 'ALL', func: 'ALL', category: 'ALL', period: null,
    compare: { entities: ['OCHA', 'UNDP', 'UNICEF'], func: 'ALL', category: 'ALL', period: null }
  };

  // ---------- data ----------
  function release() {
    if (state.source === 'demo') {
      if (!releases.demo) { const rs = W.demoResponses(); releases.demo = W.buildRelease(rs, { source: 'demo', label: 'Demonstration data' }); releases.demo.responses = rs.length; }
      return releases.demo;
    }
    if (state.source === 'device') {
      const rs = store ? store.all() : [];
      releases.device = W.buildRelease(rs, { source: 'device', label: 'Responses on this device' });
      releases.device.responses = rs.length;
      return releases.device;
    }
    return releases.file;
  }
  const isDemo = (rel) => rel && rel.source === 'demo';
  const latest = (rel) => (rel && rel.periods.length ? rel.periods[rel.periods.length - 1] : null);
  const entityName = (id) => (id === 'ALL' ? 'All entities' : W.ENTITY_BY_ID[id].short);
  const funcName = (id) => (id === 'ALL' ? 'All functions' : W.FUNCTION_BY_ID[id].name);

  // ---------- source banner ----------
  function banner(rel) {
    const el = $('source-banner');
    if (state.source === 'demo' || isDemo(rel)) {
      el.className = 'ws-banner is-demo';
      el.innerHTML = `<p><strong>Demonstration data.</strong> ${rel && rel.responses ? `${rel.responses} synthetic responses` : 'Synthetic responses'} generated for this prototype in ${rel ? rel.periods.length : 3} reporting periods. They are not real survey results, and differences between entities are random: they say nothing about any real UN entity.</p>`;
      return;
    }
    el.className = 'ws-banner is-real';
    if (state.source === 'device') {
      const n = store ? store.count() : 0;
      el.innerHTML = `<p><strong>Responses on this device.</strong> ${n === 0 ? 'No responses yet.' : `${n} ${n === 1 ? 'response' : 'responses'} submitted with the survey page in this browser.`} They are stored only in this browser: they are not shared with other people or devices, and this is not an organization-wide database. Charts update automatically when a response is submitted.</p>
        ${n ? '<button type="button" class="ws-btn ws-btn-outline ws-btn-small" id="clear-device"><i class="bi bi-trash3" aria-hidden="true"></i> Delete the responses stored on this device</button>' : '<p><a href="survey.html">Take the survey on this device</a></p>'}`;
      return;
    }
    const f = state.file || {};
    el.innerHTML = f.kind === 'release'
      ? `<p><strong>Imported file: ${esc(f.name)}.</strong> Aggregated results (minimum group size ${rel.minGroupSize}, created ${esc(rel.created)}). The file contains no individual answers.</p>`
      : `<p><strong>Imported file: ${esc(f.name)}.</strong> ${f.count} complete responses from a Qualtrics export, read in this browser only: nothing is uploaded, and response IDs and dates are discarded.</p>`;
  }

  function sourceChip(rel) {
    if (isDemo(rel)) return '<li class="is-demo">Demonstration data</li>';
    if (state.source === 'device') return '<li class="is-real">Responses on this device</li>';
    return `<li class="is-real">Imported: ${esc((state.file || {}).name || 'file')}</li>`;
  }

  // ---------- filters ----------
  const opt = (value, label, selected) => `<option value="${esc(value)}"${selected ? ' selected' : ''}>${esc(label)}</option>`;
  function fillSelects(rel) {
    const periods = rel ? rel.periods : [];
    if (!periods.includes(state.period)) state.period = latest(rel);
    if (!periods.includes(state.compare.period)) state.compare.period = latest(rel);
    const periodOpts = (sel) => (periods.length ? periods.slice().reverse().map((p) => opt(p, W.periodLabel(p), p === sel)).join('') : opt('', 'No responses yet', true));
    $('f-period').innerHTML = periodOpts(state.period);
    $('c-period').innerHTML = periodOpts(state.compare.period);
    $('f-period').disabled = $('c-period').disabled = !periods.length;
    $('f-entity').innerHTML = opt('ALL', 'All entities (overall dataset)', state.entity === 'ALL') + W.ENTITIES.map((e) => opt(e.id, e.name, state.entity === e.id)).join('');
    const funcs = (sel) => opt('ALL', 'All functions', sel === 'ALL') + W.FUNCTIONS.map((f) => opt(f.id, f.name, sel === f.id)).join('');
    $('f-function').innerHTML = funcs(state.func);
    $('c-function').innerHTML = funcs(state.compare.func);
    const cats = (sel) => opt('ALL', 'All six categories', sel === 'ALL') + W.CATEGORIES.map((c) => opt(c.id, `${c.letter}. ${c.name}`, sel === c.id)).join('');
    $('f-category').innerHTML = cats(state.category);
    $('c-category').innerHTML = cats(state.compare.category);
  }

  // ---------- entity navigation ----------
  function chip(c) {
    if (c && c.status === 'published') return `<span class="ws-chip">${c.n}<span class="visually-hidden"> responses</span></span>`;
    if (c && c.status === 'protected') return '<span class="ws-chip is-held">Withheld</span>';
    return '<span class="ws-chip is-wait">Collecting</span>';
  }
  function renderNav(rel) {
    const item = (id, label, cls) => {
      const c = rel && state.period ? W.cell(rel, state.period, id, state.func) : null;
      return `<li${cls ? ` class="${cls}"` : ''}><button type="button" data-entity="${id}"${state.entity === id ? ' aria-current="true"' : ''}><span>${esc(label)}</span>${chip(c)}</button></li>`;
    };
    $('entity-nav').innerHTML = item('ALL', 'Overall dataset', 'is-overall') + W.ENTITIES.map((e) => item(e.id, e.short)).join('');
  }

  // ---------- charts ----------
  // One stacked bar: segments from most to least favourable, then the count of "don't know".
  function rowHtml(label, sub, counts, catId, id) {
    const cat = W.CATEGORY_BY_ID[catId];
    const pol = W.polarity(catId);
    const options = W.SCALES[cat.scale].options;
    const subst = counts.slice(0, 5).reduce((a, b) => a + b, 0);
    const na = counts[5];
    const fav = subst ? pol.favourable.reduce((a, code) => a + counts[code - 1], 0) / subst : null;
    const parts = pol.order.map((code, i) => ({ code, n: counts[code - 1], share: subst ? counts[code - 1] / subst : 0, cls: `c${i + 1}`, label: options[code - 1] }));
    const aria = `${label}: ${parts.map((p) => `${pct(p.share)} ${p.label.toLowerCase()}`).join(', ')}${na ? `; ${na} ${W.NA.label.toLowerCase()}` : ''}.`;
    const bar = subst
      ? `<div class="ws-bar" role="img" aria-label="${esc(aria)}">${parts.filter((p) => p.n).map((p) => `<span class="ws-seg-bar ${p.cls}" style="flex:${p.share.toFixed(4)} 1 0" data-t="${esc(p.label)}" data-v="${esc(`${pct(p.share)} (${p.n} of ${subst})`)}">${p.share >= 0.09 ? pct(p.share) : ''}</span>`).join('')}</div>`
      : `<p class="ws-low">Everyone answered "${esc(W.NA.label)}".</p>`;
    return `<li class="ws-row"${id ? ` data-item="${id}"` : ''}><span class="ws-row-label">${esc(label)}${sub || na ? `<small>${sub ? esc(sub) : ''}${sub && na ? ' · ' : ''}${na ? `${na} don't know or N/A` : ''}</small>` : ''}</span>${bar}<span class="ws-row-fav">${pct(fav)}<small>n=${subst}</small></span></li>`;
  }

  function legendHtml(catId) {
    const cat = W.CATEGORY_BY_ID[catId];
    const pol = W.polarity(catId);
    const options = W.SCALES[cat.scale].options;
    return `<ul class="ws-legend" aria-label="Answer colours">${pol.order.map((code, i) => `<li><span class="ws-swatch c${i + 1}" aria-hidden="true"></span>${esc(options[code - 1])}</li>`).join('')}<li><span class="ws-swatch is-na" aria-hidden="true"></span>${esc(W.NA.label)}: counted separately</li></ul>`;
  }

  function trendSvg(points, width) {
    const W0 = Math.max(260, Math.min(560, width || 520)), H = 150, m = { l: 44, r: 30, t: 22, b: 30 };
    const pw = W0 - m.l - m.r, ph = H - m.t - m.b;
    const x = (i) => m.l + (points.length === 1 ? pw / 2 : (i * pw) / (points.length - 1));
    const y = (v) => m.t + (1 - v) * ph;
    const out = [];
    [0, 0.5, 1].forEach((v) => {
      out.push(`<line x1="${m.l}" x2="${m.l + pw}" y1="${y(v)}" y2="${y(v)}" stroke="${v === 0 ? '#c3c2b7' : '#e1e0d9'}" stroke-width="1"/>`);
      out.push(`<text x="${m.l - 8}" y="${y(v) + 4}" text-anchor="end" font-size="11.5" fill="#5d6475">${v * 100}%</text>`);
    });
    points.forEach((p, i) => out.push(`<text x="${x(i)}" y="${H - 8}" text-anchor="middle" font-size="11.5" fill="#3a4256">${esc(p.label)}</text>`));
    let d = '', pen = false;
    points.forEach((p, i) => { if (p.v == null) { pen = false; return; } d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.v).toFixed(1)}`; pen = true; });
    out.push(`<path d="${d}" fill="none" stroke="#1c5cab" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`);
    const shown = points.map((p, i) => Object.assign({ i }, p)).filter((p) => p.v != null);
    shown.forEach((p, j) => {
      out.push(`<circle cx="${x(p.i)}" cy="${y(p.v)}" r="4.5" fill="#1c5cab" stroke="#fff" stroke-width="2"><title>${esc(`${p.label}: ${pct(p.v)} favourable (n=${p.n})`)}</title></circle>`);
      if (j === 0 || j === shown.length - 1) out.push(`<text x="${x(p.i)}" y="${y(p.v) - 10}" text-anchor="middle" font-size="12" font-weight="700" fill="#16213a">${pct(p.v)}</text>`);
    });
    return `<svg viewBox="0 0 ${W0} ${H}" width="${W0}" height="${H}" role="img" aria-label="${esc(`Percentage favourable by reporting period: ${points.map((p) => `${p.label} ${p.v == null ? 'not shown' : pct(p.v)}`).join(', ')}.`)}">${out.join('')}</svg>`;
  }

  function trendPoints(rel, catId) {
    return rel.periods.map((p) => {
      const c = W.cell(rel, p, state.entity, state.func);
      const m = /^(\d{4})-Q(\d)$/.exec(p);
      return { label: m ? `Q${m[2]} ${m[1]}` : p, v: c.status === 'published' ? c.scores[catId].favourable : null, n: c.n };
    });
  }

  function trendBlock(rel, catId) {
    if (trendPoints(rel, catId).filter((p) => p.v != null).length < 2) return '<div class="ws-trend"><h4>Change over time</h4><p>A trend line appears once this group has results in at least two reporting periods.</p></div>';
    return `<div class="ws-trend"><h4>Change over time: % favourable</h4><div class="ws-trend-chart" data-cat="${catId}"></div></div>`;
  }

  function drawTrends(rel) {
    document.querySelectorAll('.ws-trend-chart').forEach((el) => { el.innerHTML = trendSvg(trendPoints(rel, el.dataset.cat), el.clientWidth); });
  }

  function numbersTable(c, cat) {
    const options = W.SCALES[cat.scale].options;
    return `<details class="ws-details"><summary>Show the numbers</summary><div class="table-responsive" tabindex="0" role="region" aria-label="${esc(cat.name)}: the numbers"><table class="ws-table">
      <caption class="visually-hidden">${esc(cat.name)}: answers to each question (count and share of answers excluding "${esc(W.NA.label)}")</caption>
      <thead><tr><th scope="col">Question</th>${options.map((o) => `<th scope="col">${esc(o)}</th>`).join('')}<th scope="col">Don't know / N/A</th><th scope="col">Favourable</th></tr></thead>
      <tbody>${cat.items.map((it) => {
        const counts = c.items[it.id];
        const subst = counts.slice(0, 5).reduce((a, b) => a + b, 0);
        const fav = subst ? W.polarity(cat.id).favourable.reduce((a, code) => a + counts[code - 1], 0) / subst : null;
        return `<tr><th scope="row">${esc(it.concept)}<br><small class="text-secondary">${esc(it.text)}</small></th>${counts.slice(0, 5).map((n) => `<td>${n}<br><small>${subst ? pct(n / subst) : '–'}</small></td>`).join('')}<td>${counts[5]}</td><td>${pct(fav)}</td></tr>`;
      }).join('')}</tbody></table></div></details>`;
  }

  function categoryCard(rel, c, cat) {
    const s = c.scores[cat.id];
    const favWords = cat.lowerIsBetter ? '"Rarely" or "Never" (less often is better)' : '"Strongly agree" or "Agree"';
    return `<section class="ws-card" aria-labelledby="cat-${cat.id}">
      <div class="ws-card-head">
        <div><h3 id="cat-${cat.id}">${cat.letter}. ${esc(cat.name)}</h3>
          <p class="ws-card-meta">${esc(state.entity === 'ALL' ? 'All entities' : W.ENTITY_BY_ID[state.entity].dataset)} · ${esc(W.periodLabel(state.period))} · ${c.n} responses · ${esc(W.SCALES[cat.scale].name)} scale</p></div>
        <div class="ws-headline"><strong>${pct(s.favourable)}</strong><span>favourable${s.lo != null ? ` (95% CI ${pct(s.lo)}–${pct(s.hi)})` : ''}</span></div>
      </div>
      ${cat.caution ? `<p class="ws-caution"><i class="bi bi-info-circle" aria-hidden="true"></i> Perceptions of bias in workplace practices, not a measure of anyone's implicit bias. Favourable = ${favWords}.</p>` : `<p class="ws-caution">Favourable = ${favWords}. ${pct(s.neutral)} neutral, ${pct(s.unfavourable)} unfavourable.</p>`}
      ${legendHtml(cat.id)}
      <ul class="ws-rows">${cat.items.map((it) => rowHtml(it.concept, '', c.items[it.id], cat.id, it.id)).join('')}</ul>
      ${trendBlock(rel, cat.id)}
      ${numbersTable(c, cat)}
    </section>`;
  }

  function overviewCard(c) {
    return `<section class="ws-card" aria-labelledby="ov-h">
      <div class="ws-card-head"><div><h3 id="ov-h">All six categories</h3><p class="ws-card-meta">Every answer in each category combined. Favourable = the two most positive answers.</p></div>
        <div class="ws-headline"><strong>${c.n}</strong><span>completed responses</span></div></div>
      <ul class="ws-legend" aria-label="Answer colours"><li><span class="ws-swatch c1" aria-hidden="true"></span>Most favourable</li><li><span class="ws-swatch c2" aria-hidden="true"></span>Favourable</li><li><span class="ws-swatch c3" aria-hidden="true"></span>Neutral</li><li><span class="ws-swatch c4" aria-hidden="true"></span>Unfavourable</li><li><span class="ws-swatch c5" aria-hidden="true"></span>Most unfavourable</li></ul>
      <ul class="ws-rows">${W.CATEGORIES.map((cat) => rowHtml(`${cat.letter}. ${cat.name}`, W.SCALES[cat.scale].name, c.scores[cat.id].counts, cat.id)).join('')}</ul>
    </section>`;
  }

  // ---------- the dashboard ----------
  function datasetHead(rel, c) {
    const e = state.entity === 'ALL' ? null : W.ENTITY_BY_ID[state.entity];
    const title = e ? e.dataset : 'Overall dataset';
    const sub = e ? e.name : 'All UN entities and offices combined';
    const n = c && c.status === 'published' ? `<li class="is-n">${c.n} responses</li>` : '';
    const orgFunc = !e && state.func !== 'ALL' && c && c.status === 'published'
      ? `<p class="ws-note-inline">Organization-wide results for one function combine the ${c.entities} entity ${c.entities === 1 ? 'group' : 'groups'} in this function that can be shown. Smaller groups are left out to protect anonymity, so this can be fewer than everyone in this function.</p>` : '';
    return `<div class="ws-set-head"><h2>${esc(title)}</h2><p class="ws-set-name">${esc(sub)}</p>
      <ul class="ws-meta">${state.period ? `<li>${esc(W.periodLabel(state.period))}</li>` : ''}<li>${esc(funcName(state.func))}</li>${n}${sourceChip(rel)}</ul>${orgFunc}</div>`;
  }

  function withheldHtml(c) {
    const filtered = state.func !== 'ALL';
    if (c && c.status === 'protected') {
      return `<div class="ws-callout"><h3><i class="bi bi-shield-lock" aria-hidden="true"></i>Results withheld to protect a smaller group</h3>
        <p>This group has enough responses, but showing it next to the other results would let someone work out the answers of a group smaller than ${K} by subtraction.</p>
        <p>It will appear automatically when more responses arrive.</p></div>`;
    }
    return `<div class="ws-callout"><h3><i class="bi bi-hourglass-split" aria-hidden="true"></i>Results are being collected</h3>
      <p>Results are being collected. Aggregated insights will become available once the minimum response threshold has been reached.</p>
      <p>Minimum: ${K} completed responses for this ${filtered ? 'filtered group (the threshold applies to the group you selected, not just the entity)' : 'group'}. Individual answers are never shown.</p></div>`;
  }

  function renderDash(rel) {
    const out = $('dash');
    if (!rel || !rel.periods.length) {
      out.innerHTML = `${datasetHead(rel, null)}<div class="ws-callout"><h3><i class="bi bi-inbox" aria-hidden="true"></i>No responses yet</h3>
        <p>Results are being collected. Aggregated insights will become available once the minimum response threshold has been reached.</p>
        <p>${state.source === 'device' ? 'Responses submitted with the survey page in this browser appear here. ' : ''}Results appear once a group reaches ${K} completed responses.</p></div>`;
      return;
    }
    const c = W.cell(rel, state.period, state.entity, state.func);
    if (!c || c.status !== 'published') { out.innerHTML = datasetHead(rel, c) + withheldHtml(c); return; }
    const cats = state.category === 'ALL' ? W.CATEGORIES : [W.CATEGORY_BY_ID[state.category]];
    out.innerHTML = datasetHead(rel, c) + (state.category === 'ALL' ? overviewCard(c) : '') + cats.map((cat) => categoryCard(rel, c, cat)).join('');
    drawTrends(rel);
  }

  // ---------- comparison ----------
  function dotPanel(cat, rows, ref) {
    const axis = [0, 25, 50, 75, 100];
    return `<section class="ws-card" aria-labelledby="cmp-${cat.id}">
      <div class="ws-card-head"><div><h3 id="cmp-${cat.id}">${cat.letter}. ${esc(cat.name)}</h3><p class="ws-card-meta">% favourable with 95% confidence interval${ref ? ' · dashed line: all entities' : ''}</p></div></div>
      <div class="ws-dotplot" role="img" aria-label="${esc(`${cat.name}, % favourable: ${rows.map((r) => `${r.label} ${pct(r.s.favourable)} (n=${r.n})`).join('; ')}${ref ? `; all entities ${pct(ref.favourable)}` : ''}.`)}">
        ${rows.map((r) => `<div class="ws-dot-row"><span class="ws-dot-label">${esc(r.label)} <small>n=${r.n}</small></span>
          <span class="ws-dot-track">${ref ? `<span class="ws-ref" style="left:${(ref.favourable * 100).toFixed(1)}%"></span>` : ''}${r.s.lo != null ? `<span class="ws-ci" style="left:${(r.s.lo * 100).toFixed(1)}%;width:${((r.s.hi - r.s.lo) * 100).toFixed(1)}%"></span>` : ''}<span class="ws-dot" style="left:${(r.s.favourable * 100).toFixed(1)}%" data-t="${esc(r.label)}" data-v="${esc(`${pct(r.s.favourable)} favourable${r.s.lo != null ? `, 95% CI ${pct(r.s.lo)}–${pct(r.s.hi)}` : ''} (n=${r.n})`)}"></span></span>
          <span class="ws-dot-val">${pct(r.s.favourable)}</span></div>`).join('')}
        <div class="ws-dot-row ws-dot-axis" aria-hidden="true"><span></span><span class="ws-dot-track is-axis">${axis.map((a) => `<span style="left:${a}%">${a}%</span>`).join('')}</span><span></span></div>
      </div>
    </section>`;
  }

  function renderCompare(rel) {
    const cs = state.compare;
    const box = $('c-entities');
    const period = cs.period;
    box.innerHTML = W.ENTITIES.map((e) => {
      const c = rel && period ? W.cell(rel, period, e.id, cs.func) : null;
      const ok = c && c.status === 'published';
      const note = ok ? `n=${c.n}` : c && c.status === 'protected' ? 'withheld' : 'collecting';
      return `<label><input type="checkbox" value="${e.id}"${ok && cs.entities.includes(e.id) ? ' checked' : ''}${ok ? '' : ' disabled'}> ${esc(e.short)} <span class="ws-hint">${note}</span></label>`;
    }).join('');
    const out = $('compare-out');
    if (!rel || !period) { out.innerHTML = '<div class="ws-callout"><h3>No responses yet</h3><p>Results are being collected. Aggregated insights will become available once the minimum response threshold has been reached.</p></div>'; return; }
    const picked = W.ENTITIES.filter((e) => cs.entities.includes(e.id)).map((e) => ({ e, c: W.cell(rel, period, e.id, cs.func) })).filter((x) => x.c.status === 'published');
    const head = `<ul class="ws-meta"><li>${esc(W.periodLabel(period))}</li><li>${esc(funcName(cs.func))}</li>${sourceChip(rel)}</ul>`;
    if (picked.length < 2) {
      out.innerHTML = `${head}<div class="ws-callout"><h3>Choose at least two entities</h3><p>Only entities whose results can be shown for this period${cs.func === 'ALL' ? '' : ' and function'} can be compared.</p></div>`;
      return;
    }
    const warns = [];
    const ns = picked.map((x) => x.c.n);
    if (Math.max(...ns) >= 3 * Math.min(...ns)) warns.push(`Sample sizes differ a lot (n = ${Math.min(...ns)} to ${Math.max(...ns)}). Results for smaller groups are less precise: where the confidence intervals overlap, the difference may be due to chance.`);
    if (cs.func === 'ALL') {
      const mix = rel.data[period].mix || {};
      const ids = picked.map((x) => x.e.id);
      const differ = ids.some((a, i) => ids.slice(i + 1).some((b) => (mix[`${a}|${b}`] || mix[`${b}|${a}`] || 0) >= 0.5));
      if (differ) {
        const top = picked.map((x) => {
          const fs = W.FUNCTIONS.map((f) => ({ f, c: rel.data[period].functions[x.e.id][f.id] })).filter((y) => y.c.status === 'published').sort((a, b) => b.c.n - a.c.n);
          return fs.length ? `${x.e.short}: ${pct(fs[0].c.n / x.c.n)} ${fs[0].f.name}` : `${x.e.short}: no function group large enough to show`;
        });
        warns.push(`These entities have different mixes of professional functions (${top.join('; ')}). Some differences may reflect role mix rather than workplace culture. To compare like with like, choose a professional function above.`);
      }
    }
    const ref = W.cell(rel, period, 'ALL', cs.func);
    const cats = cs.category === 'ALL' ? W.CATEGORIES : [W.CATEGORY_BY_ID[cs.category]];
    const table = `<details class="ws-details" open><summary>Show the numbers</summary><div class="table-responsive" tabindex="0" role="region" aria-label="Comparison: the numbers"><table class="ws-table">
      <caption class="visually-hidden">% favourable by entity and category, with 95% confidence intervals</caption>
      <thead><tr><th scope="col">Entity</th><th scope="col">Responses</th>${cats.map((c) => `<th scope="col">${c.letter}. ${esc(c.name)}</th>`).join('')}</tr></thead>
      <tbody>${picked.map((x) => `<tr><th scope="row">${esc(x.e.short)}</th><td>${x.c.n}</td>${cats.map((c) => { const s = x.c.scores[c.id]; return `<td>${pct(s.favourable)}<br><small>${s.lo != null ? `${pct(s.lo)}–${pct(s.hi)}` : ''}</small></td>`; }).join('')}</tr>`).join('')}
      ${ref && ref.status === 'published' ? `<tr><th scope="row">All entities</th><td>${ref.n}</td>${cats.map((c) => `<td>${pct(ref.scores[c.id].favourable)}</td>`).join('')}</tr>` : ''}</tbody></table></div></details>`;
    out.innerHTML = head + warns.map((w) => `<p class="ws-warn"><i class="bi bi-exclamation-triangle" aria-hidden="true"></i><span>${esc(w)}</span></p>`).join('')
      + cats.map((cat) => dotPanel(cat, picked.map((x) => ({ label: x.e.short, n: x.c.n, s: x.c.scores[cat.id] })), ref && ref.status === 'published' ? ref.scores[cat.id] : null)).join('')
      + `<section class="ws-card">${table}<p class="ws-note-inline">Prototype note: this website has no user accounts, so anyone with the data can compare. In a live system, limit comparisons to authorized dashboard users.</p></section>`;
  }

  // ---------- about ----------
  function aboutHtml() {
    const src = Object.values(W.SOURCES);
    return `<h2>What the survey measures</h2>
      <p>${W.ITEMS.length} statements in six categories, plus consent, entity and professional function: 37 multiple-choice questions, all required. One answer scale per category. If a statement does not apply, people choose "${esc(W.NA.label)}", which is counted but left out of percentages.</p>
      <div class="table-responsive" tabindex="0" role="region" aria-label="Measurement categories"><table class="ws-table"><caption class="visually-hidden">Measurement categories</caption>
        <thead><tr><th scope="col">Category</th><th scope="col">Statements</th><th scope="col">Scale</th><th scope="col">Favourable</th></tr></thead>
        <tbody>${W.CATEGORIES.map((c) => `<tr><th scope="row">${c.letter}. ${esc(c.name)}</th><td>${c.items.length}</td><td>${esc(W.SCALES[c.scale].options.join(' · '))}</td><td>${c.lowerIsBetter ? 'Rarely or Never' : 'Strongly agree or Agree'}</td></tr>`).join('')}</tbody></table></div>
      ${W.CATEGORIES.map((c) => `<details class="ws-details"><summary>${c.letter}. ${esc(c.name)}: the statements and their sources</summary><ol>${c.items.map((it) => `<li><strong>${esc(it.text)}</strong><br><small>${esc(it.concept)} · ${esc(it.basis)}${it.sources.length ? ` · ${esc(it.sources.map((s) => W.SOURCES[s].short).join('; '))}` : ''}. ${esc(it.note)}</small></li>`).join('')}</ol></details>`).join('')}
      <p class="ws-note-inline">Questions are adapted from, or are new wording of, published concepts; none is copied from a licensed instrument. Category E asks what people notice in workplace practices: it is not a measure of anyone's implicit bias. Scores are descriptive and are not validated measurements.</p>

      <h2>How results are protected</h2>
      <ul>
        <li><strong>Minimum group size: ${K} completed responses.</strong> Nothing is shown for a smaller group, including every filtered group (entity, function and period together). Before then the dashboard says that results are being collected.</li>
        <li><strong>No working out small groups by subtraction.</strong> If the groups that cannot be shown add up to fewer than ${K}, the next-smallest group is withheld too, so no small group can be calculated from the totals.</li>
        <li><strong>Function results only inside an entity.</strong> Organization-wide results for one function add up entity groups that are already shown, so filtering and comparing cannot reveal anything new.</li>
        <li><strong>Each reporting period on its own.</strong> No result covers several periods, so periods cannot be subtracted from each other. Only the period is stored, never the date or time.</li>
        <li><strong>No individual answers, ever.</strong> Charts and downloads use group totals only. Groups that are not shown carry no numbers at all, not even their exact size.</li>
        <li><strong>Demonstration data are never mixed with real responses.</strong> Each data source is shown on its own and labelled on every chart.</li>
      </ul>
      <p>The threshold is set in <code>workforce-survey/workforce-survey.js</code> (<code>CONFIG.minGroupSize</code>). It can be raised, but not lowered below ${K}. The rules are tested in <code>tools/test_workforce_survey.js</code>.</p>

      <h2>Where the data are stored</h2>
      <ul>
        <li><strong>Demonstration data</strong> are generated in your browser from a fixed seed. They are synthetic.</li>
        <li><strong>This device:</strong> the survey page saves each submitted response in this browser's local storage: a random ID, the entity, the function, the reporting period and the answers. Nothing is sent to a server, so responses from other people's devices never appear here, and anyone using this browser can delete them.</li>
        <li><strong>Imported file:</strong> a Qualtrics export is read in your browser and never uploaded. Response IDs and dates are discarded. Keep raw exports in access-controlled storage, never in this public repository.</li>
        <li><strong>Aggregated results files</strong> (CSV or JSON, below) hold only groups that can be shown, so they can be shared with entity focal points, who can load the JSON file here without seeing any individual answers.</li>
      </ul>
      <div class="ws-callout"><h3><i class="bi bi-cloud-slash" aria-hidden="true"></i>Limits of this website</h3>
        <p>This is a static GitHub Pages site. On its own it cannot collect responses from many people into one shared, live database: the "This device" view only includes responses submitted in the same browser.</p>
        <p>For real data collection, run the survey in Qualtrics (import the survey file below), and either load the export here or add a small server that applies these same rules and releases only aggregated results. Both options, and what each needs (accounts, permissions, costs and credentials), are set out in the <a href="${REPO}docs/workforce-survey-data-architecture.md">data architecture note</a>. Nothing has been connected without approval.</p></div>

      <h2>Downloads</h2>
      <ul class="ws-files">
        <li><a href="workforce-survey-qualtrics.txt" download><span class="ws-ext">TXT</span><span>Survey file for Qualtrics</span></a></li>
        <li><a href="workforce-survey-codebook.csv" download><span class="ws-ext">CSV</span><span>Codebook: questions, codes, sources</span></a></li>
        <li><a href="demo-qualtrics-export.csv" download><span class="ws-ext">CSV</span><span>Demonstration export (synthetic)</span></a></li>
        <li><button type="button" id="dl-csv"><span class="ws-ext">CSV</span><span>Aggregated results, current data</span></button></li>
        <li><button type="button" id="dl-json"><span class="ws-ext">JSON</span><span>Aggregated results file, current data</span></button></li>
      </ul>

      <h2>Sources and licences</h2>
      <ol class="ws-refs">${src.map((s) => `<li>${esc(s.cite)} <a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.url.replace(/^https:\/\//, ''))}</a>${s.licence ? `<br><small>${esc(s.licence)}</small>` : ''}</li>`).join('')}</ol>
      <p class="ws-note-inline">The earlier settings-based pilot remains available as the <a href="../relief-map/">Relief Maps Tool</a>.</p>`;
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
  function exportName(ext) {
    const rel = release();
    const tag = isDemo(rel) ? 'demonstration' : state.source === 'device' ? 'this-device' : 'imported';
    return `workforce-survey-aggregated-${tag}.${ext}`;
  }

  // ---------- tooltips ----------
  function bindTips() {
    const tip = $('ws-tip');
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

  // ---------- wiring ----------
  function renderAll() {
    const rel = release();
    banner(rel);
    fillSelects(rel);
    renderNav(rel);
    renderDash(rel);
    renderCompare(rel);
    const n = store ? store.count() : 0;
    $('device-n').textContent = store ? `(${n})` : '(unavailable)';
  }

  function setSource(src) {
    state.source = src;
    const input = document.querySelector(`input[name="source"][value="${src}"]`);
    if (input) input.checked = true;
    renderAll();
  }

  function readFile(file) {
    const msg = $('file-msg');
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result);
        let note = '';
        if (/\.json$/i.test(file.name) || /^\s*\{/.test(text)) {
          releases.file = W.checkRelease(JSON.parse(text));
          state.file = { name: file.name, kind: 'release' };
          note = `Loaded aggregated results: ${releases.file.periods.length} reporting ${releases.file.periods.length === 1 ? 'period' : 'periods'}.`;
        } else {
          const data = W.readExport(text);
          if (!data.responses.length) throw new Error('The file has no complete responses.');
          releases.file = W.buildRelease(data.responses, { source: data.demo ? 'demo' : 'file', label: file.name });
          releases.file.responses = data.responses.length;
          state.file = { name: file.name, kind: 'responses', count: data.responses.length };
          const left = [data.declined ? `${data.declined} who did not consent` : '', data.incomplete ? `${data.incomplete} incomplete` : '', data.tests ? `${data.tests} previews or tests` : ''].filter(Boolean);
          note = `Loaded ${data.responses.length} complete responses${left.length ? ` (left out: ${left.join(', ')})` : ''}.`;
          if (data.identifying) note += ' Warning: this file has identifying details (such as IP addresses or names). Turn on "Anonymize responses" in Qualtrics and export again; do not share this file.';
        }
        msg.className = `ws-msg ${/Warning/.test(note) ? 'is-error' : 'is-ok'}`;
        msg.textContent = note;
        $('src-file').disabled = false;
        setSource('file');
      } catch (err) {
        msg.className = 'ws-msg is-error';
        msg.textContent = err instanceof SyntaxError ? 'This file could not be read.' : err.message;
      }
    };
    reader.readAsText(file);
  }

  function showTab(name) {
    const btn = $(`tab-${name}`);
    if (btn && window.bootstrap) window.bootstrap.Tab.getOrCreateInstance(btn).show();
  }

  function init() {
    $('about').innerHTML = aboutHtml();
    document.querySelectorAll('.js-k').forEach((el) => { el.textContent = String(K); });
    if (!store) { $('src-device').disabled = true; }
    const params = new URLSearchParams(window.location.search);
    if (params.get('source') === 'device' && store) state.source = 'device';
    setSource(state.source);

    document.querySelectorAll('input[name="source"]').forEach((el) => el.addEventListener('change', () => { if (el.checked) setSource(el.value); }));
    $('file-input').addEventListener('change', (e) => { const f = e.target.files[0]; if (f) readFile(f); e.target.value = ''; });
    $('source-banner').addEventListener('click', (e) => {
      if (!e.target.closest('#clear-device')) return;
      if (window.confirm('Delete every survey response stored in this browser? This cannot be undone.')) { store.clear(); renderAll(); }
    });
    const on = (id, fn) => $(id).addEventListener('change', (e) => { fn(e.target.value); renderAll(); });
    on('f-entity', (v) => { state.entity = v; });
    on('f-function', (v) => { state.func = v; });
    on('f-category', (v) => { state.category = v; });
    on('f-period', (v) => { state.period = v; });
    on('c-function', (v) => { state.compare.func = v; });
    on('c-category', (v) => { state.compare.category = v; });
    on('c-period', (v) => { state.compare.period = v; });
    $('c-entities').addEventListener('change', (e) => {
      if (e.target.type !== 'checkbox') return;
      const set = new Set(state.compare.entities);
      if (e.target.checked) set.add(e.target.value); else set.delete(e.target.value);
      state.compare.entities = Array.from(set);
      renderCompare(release());
    });
    $('entity-nav').addEventListener('click', (e) => {
      const b = e.target.closest('[data-entity]');
      if (!b) return;
      state.entity = b.dataset.entity;
      renderAll();
      $('dash').scrollIntoView({ block: 'start', behavior: 'smooth' });
    });
    $('about').addEventListener('click', (e) => {
      if (e.target.closest('#dl-csv')) download(exportName('csv'), W.releaseCSV(release()), 'text/csv');
      if (e.target.closest('#dl-json')) { const r = Object.assign({}, release()); delete r.responses; download(exportName('json'), JSON.stringify(r, null, 1), 'application/json'); }
    });
    document.querySelectorAll('[data-tab-link]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); showTab(a.dataset.tabLink); $('main').scrollIntoView({ behavior: 'smooth' }); }));
    if (window.location.hash === '#about' || window.location.hash === '#compare') showTab(window.location.hash.slice(1));

    // Live updates: a response submitted in another tab of this browser redraws the charts.
    window.addEventListener('storage', (e) => { if (e.key === W.CONFIG.storageKey || e.key === null) renderAll(); });
    document.addEventListener('visibilitychange', () => { if (!document.hidden && state.source === 'device') renderAll(); });
    let wide = window.innerWidth;
    window.addEventListener('resize', () => { if (Math.abs(window.innerWidth - wide) > 40) { wide = window.innerWidth; drawTrends(release()); } });
    bindTips();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
