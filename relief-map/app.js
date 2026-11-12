// Team Relief Map page: chart, legend, tables, summaries and loading a Qualtrics export.
(function () {
  'use strict';
  const RM = window.ReliefMap;
  const $ = (id) => document.getElementById(id);
  const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (v) => v.toFixed(1);

  // Ideas to discuss for the settings where discomfort is highest or groups differ most.
  const OPPORTUNITIES = {
    TM: 'Share agendas and documents a day ahead, open each item with a round so everyone speaks, and accept written input.',
    SUP: 'Hold regular, protected check-ins with open questions, and agree on how feedback flows both ways.',
    VIR: 'Share documents before calls, use captions and the chat, rotate meeting times across time zones and confirm decisions in writing.',
    NET: 'Hold social and networking moments during working hours, vary the formats and make sure newcomers and consultants are invited.',
    DEV: 'Publish training and stretch opportunities openly, with clear criteria, and include consultants and interns where the rules allow.',
    DEC: 'Explain how decisions are made and who makes them, ask for input before decisions are final, and rotate who presents to decision-makers.'
  };

  // Line styles: colour (3:1 contrast or more on white), marker shape and dash, so lines differ without colour.
  const STYLES = [
    { color: '#0072b2', marker: 'square', dash: '' },
    { color: '#d55e00', marker: 'triangle', dash: '8 4' },
    { color: '#117733', marker: 'diamond', dash: '2 4' },
    { color: '#aa3377', marker: 'circle', dash: '10 4 2 4' }
  ];
  const TEAM_ALONE = { color: '#1f2a3c', marker: 'circle', dash: '', width: 3.5 };
  const TEAM_REF = { color: '#7a8496', marker: 'circle', dash: '4 4', width: 2.5 };

  const params = new URLSearchParams(location.search);
  const state = {
    source: 'sample',
    respondents: RM.sampleRespondents(),
    comments: 0,
    compare: RM.DIMENSIONS.some((d) => d.id === params.get('compare')) ? params.get('compare') : null,
    k: [5, 8, 10].includes(Number(params.get('k'))) ? Number(params.get('k')) : 5,
    compact: false
  };

  function styleFor(series, i, total) {
    if (i === 0) return total > 1 ? TEAM_REF : TEAM_ALONE;
    return Object.assign({ width: 3 }, STYLES[(i - 1) % STYLES.length]);
  }

  function marker(shape, x, y, color, size) {
    const s = size || 5.5;
    const common = `fill="${color}" stroke="#fff" stroke-width="1.5"`;
    if (shape === 'square') return `<rect x="${x - s}" y="${y - s}" width="${2 * s}" height="${2 * s}" ${common}/>`;
    if (shape === 'triangle') return `<path d="M${x} ${y - s - 1.5}L${x + s + 1.2} ${y + s}L${x - s - 1.2} ${y + s}Z" ${common}/>`;
    if (shape === 'diamond') return `<path d="M${x} ${y - s - 1.5}L${x + s + 1.5} ${y}L${x} ${y + s + 1.5}L${x - s - 1.5} ${y}Z" ${common}/>`;
    return `<circle cx="${x}" cy="${y}" r="${s}" ${common}/>`;
  }

  function wrap(text, max) {
    const words = text.split(' ');
    const lines = [''];
    words.forEach((w) => {
      const cur = lines[lines.length - 1];
      if (cur && (cur + ' ' + w).length > max) lines.push(w);
      else lines[lines.length - 1] = cur ? cur + ' ' + w : w;
    });
    return lines;
  }

  function groupSize(series) {
    if (series.key === 'all') return state.respondents.length;
    const [dimId, gi] = series.key.split(/-(?=\d+$)/);
    return state.respondents.filter((r) => r.dims[dimId] === Number(gi)).length;
  }

  // ---------- chart ----------
  function chart(agg) {
    const c = state.compact;
    const W = c ? 360 : 880, H = c ? 330 : 400;
    const m = c ? { l: 26, r: 26, t: 30, b: 58 } : { l: 176, r: 190, t: 30, b: 64 };
    const pw = W - m.l - m.r, ph = H - m.t - m.b;
    const x = (i) => m.l + (i * pw) / (RM.SETTINGS.length - 1);
    const y = (v) => m.t + ((5 - v) / 4) * ph;
    const parts = [];
    // Bands: comfortable (1 to 2.5), mixed (2.5 to 3.5), uncomfortable (3.5 to 5).
    [[1, 2.5, '#eaf6ef'], [2.5, 3.5, '#f3f5f9'], [3.5, 5, '#fcefef']].forEach(([a, b, f]) => {
      parts.push(`<rect x="${m.l - 12}" y="${y(b)}" width="${pw + 24}" height="${y(a) - y(b)}" fill="${f}"/>`);
    });
    const words = { 1: 'Very comfortable', 3: 'Neutral', 5: 'Very uncomfortable' };
    for (let v = 1; v <= 5; v += 1) {
      parts.push(`<line x1="${m.l - 12}" x2="${m.l + pw + 12}" y1="${y(v)}" y2="${y(v)}" stroke="#d3d9e4" stroke-width="1"/>`);
      parts.push(`<text x="${m.l - 16}" y="${y(v) + 4.5}" text-anchor="end" font-size="13" font-weight="700">${v}</text>`);
      if (!c && words[v]) parts.push(`<text x="${m.l - 34}" y="${y(v) + 4.5}" text-anchor="end" font-size="12.5" fill="#5b6678">${words[v]}</text>`);
    }
    parts.push(`<text x="${m.l - 12}" y="${m.t - 12}" font-size="12" fill="#5b6678">↑ More discomfort</text>`);
    RM.SETTINGS.forEach((st, i) => {
      // On small screens, short labels on two staggered rows so neighbours never collide.
      const lines = c ? [st.short] : wrap(st.label, 15);
      const top = m.t + ph + 22 + (c && i % 2 ? 17 : 0);
      lines.forEach((ln, li) => parts.push(`<text x="${x(i)}" y="${top + li * 16}" text-anchor="middle" font-size="${c ? 12.5 : 13.5}" font-weight="700">${esc(ln)}</text>`));
    });
    const total = agg.series.length;
    const labels = [];
    agg.series.forEach((s, si) => {
      const st = styleFor(s, si, total);
      let d = '';
      let pen = false;
      s.values.forEach((v, i) => {
        if (v.hidden) { pen = false; return; }
        d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v.mean).toFixed(1)}`;
        pen = true;
      });
      if (d) parts.push(`<path d="${d}" fill="none" stroke="${st.color}" stroke-width="${st.width}" stroke-linejoin="round" stroke-linecap="round"${st.dash ? ` stroke-dasharray="${st.dash}"` : ''}/>`);
      s.values.forEach((v, i) => {
        if (v.hidden) return;
        const tip = `${s.label}, ${RM.SETTINGS[i].label}: ${fmt(v.mean)} (${v.n} answers)`;
        parts.push(`<g class="rm-pt"><title>${esc(tip)}</title>${marker(st.marker, x(i), y(v.mean), st.color, si === 0 && total > 1 ? 4.5 : 5.5)}</g>`);
      });
      const last = s.values[s.values.length - 1];
      if (!c && !last.hidden && !(si === 0 && total > 1)) labels.push({ y: y(last.mean), text: s.label, color: st.color });
    });
    // Direct labels beside the last point, nudged apart so they never overlap.
    labels.sort((a, b) => a.y - b.y);
    for (let i = 1; i < labels.length; i += 1) labels[i].y = Math.max(labels[i].y, labels[i - 1].y + 17);
    const overflow = labels.length ? labels[labels.length - 1].y - (m.t + ph + 8) : 0;
    if (overflow > 0) labels.forEach((l) => { l.y -= overflow; });
    labels.forEach((l) => parts.push(`<text x="${m.l + pw + 18}" y="${l.y + 4.5}" font-size="13.5" font-weight="800" fill="${l.color}">${esc(l.text)}</text>`));

    const title = `Relief Map: average discomfort in six workplace settings, ${agg.dimension ? `by ${agg.dimension.label.toLowerCase()}` : 'for everyone'}`;
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="rm-title rm-desc" xmlns="http://www.w3.org/2000/svg">
      <title id="rm-title">${esc(title)}</title><desc id="rm-desc">${esc(RM.summarize(agg).join(' '))} The table below lists every value.</desc>${parts.join('')}</svg>`;
  }

  function legend(agg) {
    const total = agg.series.length;
    return agg.series.map((s, si) => {
      const st = styleFor(s, si, total);
      const sw = `<svg width="34" height="14" aria-hidden="true"><line x1="1" x2="33" y1="7" y2="7" stroke="${st.color}" stroke-width="${st.width}"${st.dash ? ` stroke-dasharray="${st.dash}"` : ''}/>${marker(st.marker, 17, 7, st.color, 4.5)}</svg>`;
      const label = si === 0 && total > 1 ? 'Everyone (team average)' : s.label;
      return `<li>${sw}<span>${esc(label)} <span class="text-secondary">(${groupSize(s)} people)</span></span></li>`;
    }).join('');
  }

  function table(agg) {
    const head = `<caption>Average discomfort by setting (1 = very comfortable, 5 = very uncomfortable), with the number of answers.</caption>
      <thead><tr><th scope="col">Group</th>${RM.SETTINGS.map((s) => `<th scope="col">${esc(s.label)}</th>`).join('')}</tr></thead>`;
    const rows = agg.series.map((s) => `<tr><th scope="row">${esc(s.label)}</th>${s.values.map((v) => (v.hidden
      ? '<td class="is-hidden">Hidden</td>'
      : `<td>${fmt(v.mean)} <span class="rm-n">n ${v.n}</span></td>`)).join('')}</tr>`).join('');
    return `${head}<tbody>${rows}</tbody>`;
  }

  function itemTable() {
    const avg = RM.itemAverages(state.respondents, state.k);
    const head = `<caption>Average discomfort by statement, for everyone (higher = less agreement).</caption>
      <thead><tr><th scope="col">Setting</th>${RM.ITEMS.map((it) => `<th scope="col">${esc(it.label)}</th>`).join('')}</tr></thead>`;
    const rows = RM.SETTINGS.map((st, si) => `<tr><th scope="row">${esc(st.label)}</th>${avg[si].map((v) => (v.hidden
      ? '<td class="is-hidden">Hidden</td>' : `<td>${fmt(v.mean)}</td>`)).join('')}</tr>`).join('');
    return `${head}<tbody>${rows}</tbody>`;
  }

  // ---------- what the map suggests ----------
  function insights() {
    const everyone = RM.aggregate(state.respondents, null, state.k);
    const shown = RM.SETTINGS.map((st, i) => ({ st, v: everyone.series[0].values[i] })).filter((x) => !x.v.hidden);
    if (!shown.length) return `<p class="mb-0">Not enough responses yet: insights appear once at least ${state.k} people have answered.</p>`;
    const top = shown.slice().sort((a, b) => b.v.mean - a.v.mean).slice(0, 2);
    const bullets = [`Across the team, <strong>${esc(top[0].st.label.toLowerCase())}</strong> (${fmt(top[0].v.mean)}) and <strong>${esc(top[1].st.label.toLowerCase())}</strong> (${fmt(top[1].v.mean)}) feel the least comfortable.`];
    const focus = top.map((t) => t.st.id);
    const gaps = [];
    RM.DIMENSIONS.forEach((d) => {
      const agg = RM.aggregate(state.respondents, d.id, state.k);
      const groups = agg.series.slice(1);
      RM.SETTINGS.forEach((st, i) => {
        const pts = groups.map((g) => ({ g, v: g.values[i] })).filter((p) => !p.v.hidden).sort((a, b) => b.v.mean - a.v.mean);
        if (pts.length >= 2) gaps.push({ st, hi: pts[0], lo: pts[pts.length - 1], gap: pts[0].v.mean - pts[pts.length - 1].v.mean, dim: d });
      });
    });
    gaps.sort((a, b) => b.gap - a.gap);
    const seenDims = new Set();
    gaps.filter((g) => g.gap >= 0.5).forEach((g) => {
      if (seenDims.has(g.dim.id) || seenDims.size >= 4) return;
      seenDims.add(g.dim.id);
      bullets.push(`In <strong>${esc(g.st.label.toLowerCase())}</strong>, ${esc(g.hi.g.noun)} report more discomfort (${fmt(g.hi.v.mean)}) than ${esc(g.lo.g.noun)} (${fmt(g.lo.v.mean)}).`);
      if (!focus.includes(g.st.id)) focus.push(g.st.id);
    });
    if (!seenDims.size) bullets.push('Where groups can be compared, they report similar levels of comfort.');
    const ideas = focus.slice(0, 4).map((id) => `<li><strong>${esc(RM.SETTINGS.find((s) => s.id === id).label)}:</strong> ${esc(OPPORTUNITIES[id])}</li>`).join('');
    return `<p class="small text-secondary mb-2">${state.source === 'sample' ? 'Based on the fictional sample team.' : 'Based on your loaded results.'} Hidden groups are left out.</p>
      <h3 class="h6">What stands out</h3><ul class="rm-insights">${bullets.map((b) => `<li>${b}</li>`).join('')}</ul>
      <h3 class="h6">Inclusion opportunities to discuss</h3><ul class="rm-insights">${ideas}</ul>
      <p class="small mb-0"><strong>Read it with care:</strong> the map shows how people experience a setting, not what any group is like. Discuss it with the whole team before acting, never try to identify who answered, and let the team choose its own actions.</p>`;
  }

  function themes() {
    if (state.source === 'sample') {
      return `<p class="small text-secondary">Themes from the fictional sample team's answers to "${esc(RM.REFLECTION.question)}" Individual comments are never shown.</p>
        <ul class="mb-0">${RM.SAMPLE.themes.map(([t, n]) => `<li>${esc(t)} <span class="text-secondary">(${n} mentions)</span></li>`).join('')}</ul>`;
    }
    return `<p class="mb-0">${state.comments} ${state.comments === 1 ? 'person' : 'people'} left a suggestion. To protect anonymity, this page never shows comments. Read them privately in Qualtrics, group them into themes, and share only the themes with the team.</p>`;
  }

  // ---------- page ----------
  function renderCompare() {
    const opts = [{ id: '', label: 'Everyone' }].concat(RM.DIMENSIONS.map((d) => ({ id: d.id, label: d.label })));
    $('compare').innerHTML = opts.map((o) => `<button type="button" class="btn btn-sm btn-outline-primary" data-dim="${o.id}" aria-pressed="${(state.compare || '') === o.id}">${esc(o.label)}</button>`).join('');
  }

  function render() {
    state.compact = $('chart').clientWidth < 560;
    const agg = RM.aggregate(state.respondents, state.compare, state.k);
    $('map-sub').textContent = agg.dimension ? `by ${agg.dimension.label.toLowerCase()}` : 'everyone';
    $('chart').innerHTML = chart(agg);
    $('legend').innerHTML = legend(agg);
    $('notes').innerHTML = agg.notes.map((n) => `<p>${esc(n)}</p>`).join('');
    $('summary').innerHTML = RM.summarize(agg).map((s) => `<p>${esc(s)}</p>`).join('');
    $('data-table').innerHTML = table(agg);
    $('item-table').innerHTML = itemTable();
    $('insights').innerHTML = insights();
    $('themes').innerHTML = themes();
    document.querySelectorAll('#compare button').forEach((b) => b.setAttribute('aria-pressed', String((state.compare || '') === b.dataset.dim)));
  }

  function setSource(kind, data) {
    state.source = kind;
    state.respondents = data.respondents;
    state.comments = data.comments || 0;
    $('source-line').innerHTML = kind === 'sample'
      ? '<strong>Fictional sample team</strong> (48 people)'
      : `<strong>Your Qualtrics export</strong> (${data.respondents.length} responses)`;
    $('data-tag').textContent = kind === 'sample' ? 'Fictional data' : 'Your data';
    $('data-tag').classList.toggle('is-real', kind !== 'sample');
    $('use-sample').hidden = kind === 'sample';
    render();
  }

  function init() {
    $('settings-list').innerHTML = RM.SETTINGS.map((s) => `<li><strong>${esc(s.label)}:</strong> ${esc(s.prompt.replace(/^Think about /, '').replace(/^./, (ch) => ch.toUpperCase()))}</li>`).join('');
    $('items-list').innerHTML = RM.ITEMS.map((it) => `<li><strong>${esc(it.label)}:</strong> "${esc(it.text)}" ${esc(it.source)}</li>`).join('');
    $('min-group').value = String(state.k);
    renderCompare();
    render();
    $('compare').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-dim]');
      if (!b) return;
      state.compare = b.dataset.dim || null;
      render();
    });
    $('min-group').addEventListener('change', (e) => { state.k = Number(e.target.value); render(); });
    $('csv-file').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const msg = $('file-msg');
        try {
          const data = RM.fromQualtrics(reader.result);
          if (!data.respondents.length) throw new Error('The file has no usable responses yet.');
          setSource('file', data);
          msg.className = 'small mt-2 text-success';
          msg.textContent = `Loaded ${data.respondents.length} responses${data.skipped ? `, leaving out ${data.skipped} previews or tests` : ''}.`;
          if (data.identifying) {
            msg.className = 'small mt-2 text-danger';
            msg.textContent += ' Warning: this file includes identifying fields such as IP addresses, locations or contact details. Turn on "Anonymize responses" in Qualtrics, export again and delete this copy.';
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
      const now = $('chart').clientWidth < 560;
      if (now !== wasCompact) { wasCompact = now; render(); }
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
