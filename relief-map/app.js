// Relief Maps Tool page: the Relief Map (dimension lines or group lines), tables, the overall
// panel, findings, comment themes and loading a Qualtrics export.
(function () {
  'use strict';
  const RM = window.ReliefMap;
  const $ = (id) => document.getElementById(id);
  const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const f1 = (v) => v.toFixed(1);
  const pct = (v) => `${Math.round(v * 100)}%`;
  const INK = '#1c2333', MUTED = '#5a6275';

  // Group lines: colours checked for colour-vision differences, each with its own marker shape.
  const GROUP_STYLES = [
    { color: '#0072b2', marker: 'square' },
    { color: '#d55e00', marker: 'triangle' },
    { color: '#009e73', marker: 'diamond' }
  ];
  const EVERYONE_REF = { color: '#8b90a0', marker: 'circle', ref: true };
  // Axis labels, broken by hand so neighbours never collide.
  const AXIS = { TM: ['Team meetings'], SUP: ['One-on-ones', 'with supervisor'], VIR: ['Virtual and', 'hybrid work'],
    NET: ['Informal and', 'social spaces'], DEV: ['Learning and', 'development'], DEC: ['Decision-making'] };

  const params = new URLSearchParams(location.search);
  const MEASURES = ['ALL'].concat(RM.DIMENSIONS.map((d) => d.id));
  const state = {
    source: 'sample',
    respondents: RM.sampleRespondents(),
    comments: null,
    view: params.get('view') === 'groups' ? 'groups' : 'dims',
    q: RM.IDENTITY.some((d) => d.id === params.get('q')) ? params.get('q') : 'D_AGE',
    measure: MEASURES.includes(params.get('m')) ? params.get('m') : 'ALL',
    k: [5, 8, 10].includes(Number(params.get('k'))) ? Number(params.get('k')) : 5,
    compact: false
  };

  function wrap(text, max) {
    const lines = [''];
    text.split(' ').forEach((w) => {
      const cur = lines[lines.length - 1];
      if (cur && (cur + ' ' + w).length > max) lines.push(w);
      else lines[lines.length - 1] = cur ? cur + ' ' + w : w;
    });
    return lines;
  }

  function markerSvg(shape, x, y, color, r) {
    r = r || 4.5;
    const ring = 'stroke="#fff" stroke-width="2" stroke-linejoin="round"';
    const p = (pts) => `<path d="M${pts.map((q) => `${q[0].toFixed(1)} ${q[1].toFixed(1)}`).join('L')}Z" fill="${color}" ${ring}/>`;
    if (shape === 'square') return `<rect x="${x - r}" y="${y - r}" width="${2 * r}" height="${2 * r}" rx="1" fill="${color}" ${ring}/>`;
    if (shape === 'triangle') { const h = r * 1.3; return p([[x, y - h], [x + h, y + r], [x - h, y + r]]); }
    if (shape === 'triangle-down') { const h = r * 1.3; return p([[x, y + h], [x + h, y - r], [x - h, y - r]]); }
    if (shape === 'diamond') { const h = r * 1.4; return p([[x, y - h], [x + h, y], [x, y + h], [x - h, y]]); }
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="${color}" ${ring}/>`;
  }

  const swatch = (s) => `<svg width="30" height="14" aria-hidden="true" focusable="false"><line x1="1" x2="29" y1="7" y2="7" stroke="${s.color}" stroke-width="2"/>${markerSvg(s.marker, 15, 7, s.color, s.ref ? 3.5 : 4)}</svg>`;

  // ---------- what to draw ----------
  function currentSeries() {
    if (state.view === 'dims') {
      const map = RM.dimensionMap(state.respondents, state.k);
      const series = map.series.map((s, i) => ({ key: s.key, label: s.label, color: s.dim.color, marker: s.dim.marker, values: s.values, avg: map.dimAverages[i] }));
      return { kind: 'dims', map, series, notes: map.notes, summary: RM.summarizeMap(map) };
    }
    const agg = RM.groupMap(state.respondents, state.q, state.measure, state.k);
    const series = agg.series.map((s, i) => Object.assign({ key: s.key, label: s.label, values: s.values, gi: s.gi },
      i === 0 ? EVERYONE_REF : GROUP_STYLES[(i - 1) % GROUP_STYLES.length]));
    return { kind: 'groups', agg, series, notes: agg.notes, summary: RM.summarizeGroups(agg) };
  }

  function measureLabel(m) {
    return m === 'ALL' ? 'overall experience (all five dimensions)' : RM.DIMENSIONS.find((d) => d.id === m).label.toLowerCase();
  }

  // ---------- chart ----------
  function chartSvg(view) {
    const c = state.compact;
    const series = view.series;
    const W = c ? 360 : 1000, H = c ? 360 : 430;
    const m = c ? { l: 30, r: 12, t: 16, b: 68 } : { l: 150, r: 220, t: 20, b: 66 };
    const pw = W - m.l - m.r, ph = H - m.t - m.b;
    const n = RM.SETTINGS.length;
    const x = (i) => m.l + ((i + 0.5) * pw) / n;
    const y = (v) => m.t + ((5 - v) / 4) * ph;
    const parts = [];
    parts.push(`<rect x="${m.l}" y="${y(3)}" width="${pw}" height="${y(1) - y(3)}" fill="#fbf3ee"/>`);
    if (!c) parts.push(`<text x="${m.l + 10}" y="${y(1) - 10}" font-size="12" fill="#8a4b2f">Below 3: more disagreement than agreement</text>`);
    const words = { 5: 'Strongly agree', 4: 'Agree', 3: 'Neutral', 2: 'Disagree', 1: 'Strongly disagree' };
    for (let v = 1; v <= 5; v += 1) {
      parts.push(`<line x1="${m.l}" x2="${m.l + pw}" y1="${y(v)}" y2="${y(v)}" stroke="${v === 3 ? '#c4c9d6' : '#e4e7ee'}" stroke-width="1"/>`);
      parts.push(`<text x="${m.l - 10}" y="${y(v) + 4.5}" text-anchor="end" font-size="13" font-weight="700" fill="${INK}">${v}</text>`);
      if (!c) parts.push(`<text x="${m.l - 26}" y="${y(v) + 4.5}" text-anchor="end" font-size="12.5" fill="${MUTED}">${words[v]}</text>`);
    }
    RM.SETTINGS.forEach((st, i) => {
      const lines = c ? [st.short] : AXIS[st.id] || wrap(st.label, 15);
      const top = m.t + ph + 22 + (c && i % 2 ? 18 : 0);
      lines.forEach((ln, li) => parts.push(`<text x="${x(i).toFixed(1)}" y="${top + li * 16}" text-anchor="middle" font-size="${c ? 12.5 : 13.5}" font-weight="600" fill="${INK}">${esc(ln)}</text>`));
    });
    parts.push(`<line class="rm-cross" x1="0" x2="0" y1="${m.t}" y2="${m.t + ph}" stroke="#9aa0ad" stroke-width="1" visibility="hidden"/>`);
    series.forEach((s) => {
      let d = '', pen = false;
      s.values.forEach((v, i) => {
        if (v.hidden) { pen = false; return; }
        d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v.mean).toFixed(1)}`;
        pen = true;
      });
      if (d) parts.push(`<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`);
    });
    series.forEach((s) => s.values.forEach((v, i) => { if (!v.hidden) parts.push(markerSvg(s.marker, x(i), y(v.mean), s.color, s.ref ? 3.5 : 4.5)); }));

    // Direct labels at the right, joined to each line's last point by a thin leader line.
    if (!c) {
      const labels = series.map((s) => {
        let li = -1;
        s.values.forEach((v, i) => { if (!v.hidden) li = i; });
        return li < 0 ? null : { s, x0: x(li), y0: y(s.values[li].mean), y: y(s.values[li].mean) };
      }).filter(Boolean).sort((a, b) => a.y - b.y);
      const gap = 19;
      for (let i = 1; i < labels.length; i += 1) labels[i].y = Math.max(labels[i].y, labels[i - 1].y + gap);
      const over = labels.length ? labels[labels.length - 1].y - (m.t + ph) : 0;
      if (over > 0) {
        labels[labels.length - 1].y -= over;
        for (let i = labels.length - 2; i >= 0; i -= 1) labels[i].y = Math.min(labels[i].y, labels[i + 1].y - gap);
      }
      const lx = m.l + pw + 24;
      labels.forEach((l) => {
        parts.push(`<path d="M${(l.x0 + 8).toFixed(1)} ${l.y0.toFixed(1)}L${(m.l + pw + 6).toFixed(1)} ${l.y0.toFixed(1)}L${lx - 4} ${l.y.toFixed(1)}" fill="none" stroke="#b9bdc8" stroke-width="1"/>`);
        parts.push(markerSvg(l.s.marker, lx + 4, l.y, l.s.color, l.s.ref ? 3.5 : 4));
        parts.push(`<text x="${lx + 14}" y="${(l.y + 4.5).toFixed(1)}" font-size="13" font-weight="${l.s.ref ? 600 : 700}" fill="${l.s.ref ? MUTED : INK}">${esc(l.s.label)}</text>`);
      });
    }
    // Hover and keyboard layer: one target per setting.
    RM.SETTINGS.forEach((st, i) => {
      parts.push(`<rect class="rm-hit" data-i="${i}" x="${(m.l + (i * pw) / n).toFixed(1)}" y="${m.t}" width="${(pw / n).toFixed(1)}" height="${ph}" fill="transparent" tabindex="0" focusable="true" aria-label="${esc(columnText(view, i))}"/>`);
    });
    const title = view.kind === 'dims'
      ? 'Relief Map: average agreement on five experience dimensions in six workplace settings, everyone'
      : `Relief Map: ${measureLabel(view.agg.measure)} by ${view.agg.question.label.toLowerCase()}`;
    return `<svg viewBox="0 0 ${W} ${H}" role="group" aria-labelledby="rm-title rm-desc" xmlns="http://www.w3.org/2000/svg" data-x0="${m.l}" data-pw="${pw}" data-n="${n}" data-w="${W}">
      <title id="rm-title">${esc(title)}</title><desc id="rm-desc">${esc(view.summary.join(' '))} Move through the settings with the Tab key to hear each value; the table below lists every value.</desc>${parts.join('')}</svg>`;
  }

  function valueText(v) { return v.hidden ? 'hidden' : `${f1(v.mean)} (${v.n} answers)`; }
  function columnText(view, i) {
    return `${RM.SETTINGS[i].label}: ${view.series.map((s) => `${s.label} ${valueText(s.values[i])}`).join('; ')}`;
  }

  function tipHtml(view, i) {
    const rows = view.series.map((s) => ({ s, v: s.values[i] })).sort((a, b) => (b.v.hidden ? -9 : b.v.mean) - (a.v.hidden ? -9 : a.v.mean));
    return `<p class="rm-tip-h">${esc(RM.SETTINGS[i].label)}</p><ul>${rows.map((r) => `<li>${swatch(r.s)}<span>${esc(r.s.label)}</span><strong>${r.v.hidden ? 'Hidden' : f1(r.v.mean)}</strong><em>${r.v.hidden ? '' : `${r.v.n}`}</em></li>`).join('')}</ul><p class="rm-tip-n">Number of answers in grey.</p>`;
  }

  function bindHover(view) {
    const svg = $('chart').querySelector('svg');
    const tip = $('rm-tip');
    const cross = svg.querySelector('.rm-cross');
    const show = (rect) => {
      const i = Number(rect.dataset.i);
      const box = svg.getBoundingClientRect();
      const scale = box.width / Number(svg.dataset.w);
      const cx = Number(svg.dataset.x0) + ((i + 0.5) * Number(svg.dataset.pw)) / Number(svg.dataset.n);
      cross.setAttribute('x1', cx); cross.setAttribute('x2', cx); cross.setAttribute('visibility', 'visible');
      tip.innerHTML = tipHtml(view, i);
      tip.hidden = false;
      const tw = tip.offsetWidth, th = tip.offsetHeight;
      let left = box.left + window.scrollX + cx * scale + 14;
      if (left + tw > window.scrollX + document.documentElement.clientWidth - 8) left = box.left + window.scrollX + cx * scale - tw - 14;
      left = Math.max(window.scrollX + 8, left);
      const top = box.top + window.scrollY + Math.max(8, (box.height - th) / 2);
      tip.style.left = `${left}px`;
      tip.style.top = `${top}px`;
    };
    const hide = () => { tip.hidden = true; cross.setAttribute('visibility', 'hidden'); };
    svg.querySelectorAll('.rm-hit').forEach((r) => {
      r.addEventListener('mouseenter', () => show(r));
      r.addEventListener('focus', () => show(r));
      r.addEventListener('click', () => show(r));
      r.addEventListener('mouseleave', hide);
      r.addEventListener('blur', hide);
    });
    svg.addEventListener('keydown', (e) => { if (e.key === 'Escape') hide(); });
  }

  // ---------- legend, tables ----------
  function groupSize(s) {
    if (s.key === 'all') return state.respondents.length;
    return state.respondents.filter((r) => r.ident[state.q] === s.gi).length;
  }

  function legendHtml(view) {
    return view.series.map((s) => {
      const extra = view.kind === 'dims'
        ? (s.avg.hidden ? '' : `average ${f1(s.avg.mean)}`)
        : `${groupSize(s)} people`;
      const label = s.key === 'all' ? 'Everyone (team average)' : s.label;
      return `<li>${swatch(s)}<span>${esc(label)}${extra ? ` <span class="text-secondary">(${extra})</span>` : ''}</span></li>`;
    }).join('');
  }

  const cell = (v) => (v.hidden ? '<td class="is-hidden">Hidden</td>' : `<td>${f1(v.mean)} <span class="rm-n">n ${v.n}</span></td>`);

  function tableHtml(view) {
    const heads = RM.SETTINGS.map((s) => `<th scope="col">${esc(s.label)}</th>`).join('');
    if (view.kind === 'dims') {
      const map = view.map;
      const visibleSettings = map.settings.filter((v) => !v.hidden);
      const rows = view.series.map((s) => `<tr><th scope="row">${esc(s.label)}</th>${s.values.map(cell).join('')}<td>${s.avg.hidden ? '<span class="is-hidden">Hidden</span>' : `<strong>${f1(s.avg.mean)}</strong>`}</td></tr>`).join('');
      const total = `<tr class="rm-total"><th scope="row">All five dimensions (setting score)</th>${map.settings.map(cell).join('')}<td>${visibleSettings.length ? `<strong>${f1(visibleSettings.reduce((a, v) => a + v.mean, 0) / visibleSettings.length)}</strong>` : ''}</td></tr>`;
      return `<caption>Average agreement (1 to 5, higher is more positive) by dimension and setting, with the number of answers (n).</caption>
        <thead><tr><th scope="col">Dimension</th>${heads}<th scope="col">Average across settings</th></tr></thead><tbody>${rows}${total}</tbody>`;
    }
    const agg = view.agg;
    const all = [agg.series[0]].concat(agg.allGroups);
    const rows = all.map((s) => `<tr><th scope="row">${esc(s.key === 'all' ? 'Everyone' : s.label)}</th>${s.values.map(cell).join('')}</tr>`).join('');
    return `<caption>${esc(measureLabel(agg.measure).replace(/^./, (ch) => ch.toUpperCase()))} by ${esc(agg.question.label.toLowerCase())} (1 to 5, higher is more positive), with the number of answers (n). Hidden = protected for anonymity.</caption>
      <thead><tr><th scope="col">Group</th>${heads}</tr></thead><tbody>${rows}</tbody>`;
  }

  function itemTableHtml() {
    const stats = RM.itemStats(state.respondents, state.k);
    const rows = RM.ITEMS.map((it) => {
      const s = stats[it.id];
      const st = RM.SETTINGS.find((x) => x.id === it.setting), d = RM.DIMENSIONS.find((x) => x.id === it.dim);
      return `<tr><td>${esc(st.label)}</td><td>${esc(d.label)}</td><td class="rm-wrap">${esc(it.text)}</td>${s.hidden ? '<td class="is-hidden">Hidden</td><td></td>' : `<td>${f1(s.mean)}</td><td>${pct(s.agree)}</td>`}<td>${s.n}</td><td>${s.skipped}</td></tr>`;
    }).join('');
    return `<caption>Each statement: average (1 to 5), share who agree or strongly agree, number of answers and number who saw it but skipped it.</caption>
      <thead><tr><th scope="col">Setting</th><th scope="col">Dimension</th><th scope="col">Statement</th><th scope="col">Average</th><th scope="col">% agree</th><th scope="col">Answers</th><th scope="col">Skipped</th></tr></thead><tbody>${rows}</tbody>`;
  }

  function overallHtml() {
    const ov = RM.overallStats(state.respondents, state.k);
    const rows = ov.items.map((o) => `<li class="rm-bar-row">
        <p class="mb-1">${esc(o.item.text)} <span class="rm-n">${esc(o.item.construct)}</span></p>
        ${o.hidden ? '<p class="small is-hidden mb-0">Hidden: fewer answers than the minimum.</p>' : `<div class="rm-bar" aria-hidden="true"><span style="width:${(o.agree * 100).toFixed(1)}%"></span></div>
        <p class="small text-secondary mb-0"><strong class="text-body">${pct(o.agree)} agree</strong> · average ${f1(o.mean)} · ${o.n} answers</p>`}
      </li>`).join('');
    const idx = ov.index.hidden ? 'Hidden' : `${f1(ov.index.mean)} (${ov.index.n} people)`;
    return `<ul class="rm-bars">${rows}</ul><p class="small mb-0"><strong>Overall index</strong> (each person's average of the five, at least 3 answered): ${idx}.</p>`;
  }

  // ---------- findings and themes ----------
  function insightsHtml() {
    const ins = RM.insights(state.respondents, state.k);
    const list = (arr) => `<ul class="rm-insights">${arr.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>`;
    const ideas = ins.opportunities.map((o) => `<li><strong>${esc(o.setting.label)}:</strong> ${esc(o.text)}</li>`).join('');
    return `<p class="small text-secondary mb-2">${state.source === 'sample' ? 'Based on the fictional sample team.' : 'Based on your loaded results.'} Hidden groups and points are left out.</p>
      <h3 class="h6">Across the map</h3>${list(ins.map)}
      <h3 class="h6">Differences between groups (overall experience)</h3>${list(ins.groups)}
      ${ins.overall.length ? `<h3 class="h6">Overall workplace experience</h3>${list(ins.overall)}` : ''}
      ${ideas ? `<h3 class="h6">Ideas to discuss for these settings</h3><ul class="rm-insights">${ideas}</ul>` : ''}
      <p class="small mb-0"><strong>Read it with care:</strong> the map shows how people experience a setting, not what any group is like. Gaps point to barriers to remove, not to people to fix. Discuss the map with the whole team before acting, never try to work out who answered, and let the team choose its own actions.</p>`;
  }

  function themesHtml() {
    if (state.source === 'sample') {
      return RM.REFLECTION.map((q) => {
        const all = RM.SAMPLE.themes[q.id];
        const shown = all.filter((t) => t[1] >= RM.MIN_THEME);
        const hidden = all.length - shown.length;
        return `<h3 class="h6">${esc(q.question)}</h3>
          <ul class="mb-1">${shown.map(([t, n]) => `<li>${esc(t)} <span class="text-secondary">(${n} people)</span></li>`).join('')}</ul>
          <p class="small text-secondary">${hidden ? `${hidden} ${hidden === 1 ? 'theme' : 'themes'} raised by fewer than ${RM.MIN_THEME} people ${hidden === 1 ? 'is' : 'are'} not shown. ` : ''}Themes from the fictional sample team; individual comments are never shown.</p>`;
      }).join('');
    }
    const c = state.comments || { REFLECT_1: 0, REFLECT_2: 0 };
    return `<p class="mb-0">${c.REFLECT_1} ${c.REFLECT_1 === 1 ? 'person' : 'people'} answered the first open question and ${c.REFLECT_2} the second. To protect anonymity, this page never shows comments. Read them privately in Qualtrics, group them into themes, and report only themes raised by at least ${RM.MIN_THEME} people.</p>`;
  }

  // ---------- page ----------
  function syncUrl() {
    const p = new URLSearchParams();
    if (state.view === 'groups') { p.set('view', 'groups'); p.set('q', state.q); p.set('m', state.measure); }
    if (state.k !== 5) p.set('k', String(state.k));
    const qs = p.toString();
    history.replaceState(null, '', qs ? `?${qs}` : location.pathname);
  }

  function render() {
    state.compact = $('chart').clientWidth < 600;
    const view = currentSeries();
    $('map-sub').textContent = view.kind === 'dims' ? 'experience dimensions, everyone' : `${measureLabel(state.measure)} by ${view.agg.question.label.toLowerCase()}`;
    $('chart').innerHTML = chartSvg(view);
    bindHover(view);
    $('legend').innerHTML = legendHtml(view);
    $('notes').innerHTML = view.notes.map((t) => `<p>${esc(t)}</p>`).join('');
    $('summary').innerHTML = view.summary.map((t) => `<p>${esc(t)}</p>`).join('');
    $('data-table').innerHTML = tableHtml(view);
    $('item-table').innerHTML = itemTableHtml();
    $('overall').innerHTML = overallHtml();
    $('insights').innerHTML = insightsHtml();
    $('themes').innerHTML = themesHtml();
    document.querySelectorAll('#view button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === state.view)));
    $('group-controls').hidden = state.view !== 'groups';
    syncUrl();
  }

  function setSource(kind, data) {
    state.source = kind;
    state.respondents = data.respondents;
    state.comments = data.comments || null;
    $('source-line').innerHTML = kind === 'sample'
      ? `<strong>Fictional sample team</strong> (${data.respondents.length} people)`
      : `<strong>Your Qualtrics export</strong> (${data.respondents.length} responses)`;
    $('data-tag').textContent = kind === 'sample' ? 'Fictional data' : 'Your data';
    $('data-tag').classList.toggle('is-real', kind !== 'sample');
    $('use-sample').hidden = kind === 'sample';
    render();
  }

  function init() {
    $('group-q').innerHTML = RM.IDENTITY.map((q) => `<option value="${q.id}">${esc(q.label)}</option>`).join('');
    $('measure').innerHTML = MEASURES.map((m) => `<option value="${m}">${m === 'ALL' ? 'Overall experience (all five)' : esc(RM.DIMENSIONS.find((d) => d.id === m).label)}</option>`).join('');
    $('group-q').value = state.q;
    $('measure').value = state.measure;
    $('min-group').value = String(state.k);
    $('dims-list').innerHTML = RM.DIMENSIONS.map((d) => `<li><strong>${esc(d.label)}:</strong> ${esc(d.definition)} <span class="text-secondary">(${esc(d.basis)})</span></li>`).join('');
    $('refs').innerHTML = Object.values(RM.REFS).map((r) => `<li>${esc(r.full)} <a href="${esc(r.url)}">${esc(r.url)}</a></li>`).join('');
    $('source-line').innerHTML = `<strong>Fictional sample team</strong> (${state.respondents.length} people)`;
    render();
    $('view').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-view]');
      if (!b) return;
      state.view = b.dataset.view;
      render();
    });
    $('group-q').addEventListener('change', (e) => { state.q = e.target.value; render(); });
    $('measure').addEventListener('change', (e) => { state.measure = e.target.value; render(); });
    $('min-group').addEventListener('change', (e) => { state.k = Number(e.target.value); render(); });
    $('csv-file').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const msg = $('file-msg');
        try {
          const data = RM.fromQualtrics(reader.result);
          if (!data.respondents.length) throw new Error('The file has no usable responses yet: no consenting response has any answers.');
          setSource('file', data);
          const left = [];
          if (data.declined) left.push(`${data.declined} who chose not to take part`);
          if (data.noConsent) left.push(`${data.noConsent} without a consent answer`);
          if (data.previews) left.push(`${data.previews} previews or tests`);
          msg.className = 'small mt-2 text-success';
          msg.textContent = `Loaded ${data.respondents.length} responses${left.length ? `, leaving out ${left.join(', ')}` : ''}.`;
          if (data.missing.length) msg.textContent += ` ${data.missing.length} survey columns are missing from the file, so some points stay empty.`;
          if (data.identifying) {
            msg.className = 'small mt-2 text-danger';
            msg.textContent += ' Warning: this file includes identifying fields such as IP addresses, locations or contact details. Turn on "Anonymize responses" in Qualtrics, export again and delete this copy.';
          } else if (data.timestamps) {
            msg.textContent += ' Tip: delete the date and time columns before sharing the file; they are not needed and could help identify people.';
          }
        } catch (err) {
          msg.className = 'small mt-2 text-danger';
          msg.textContent = err.message;
        }
        e.target.value = '';
      };
      reader.readAsText(file);
    });
    $('use-sample').addEventListener('click', () => {
      setSource('sample', { respondents: RM.sampleRespondents() });
      $('file-msg').textContent = '';
    });
    let wasCompact = state.compact;
    window.addEventListener('resize', () => {
      const now = $('chart').clientWidth < 600;
      if (now !== wasCompact) { wasCompact = now; render(); }
      $('rm-tip').hidden = true;
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
