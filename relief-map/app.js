// Relief Maps Tool page: the map (three measure lines, or group lines), tables and loading a
// Qualtrics export. The plain-language summary lives in the chart's accessible description.
(function () {
  'use strict';
  const RM = window.ReliefMap;
  const $ = (id) => document.getElementById(id);
  const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const f1 = (v) => v.toFixed(1);
  const INK = '#1c2333', MUTED = '#5a6275';
  const GROUP_STYLES = [{ color: '#0072b2', marker: 'square' }, { color: '#d55e00', marker: 'triangle' }, { color: '#009e73', marker: 'diamond' }];
  const EVERYONE = { color: '#8b90a0', marker: 'circle', ref: true };
  const AXIS = { MEET: ['Team meetings'], SUPV: ['One-on-ones with', 'your supervisor'], ONLINE: ['Online and', 'hybrid work'],
    SOCIAL: ['Informal and', 'social time'], LEARN: ['Learning and', 'development'], DECIDE: ['Decision-making'] };

  const state = { source: 'sample', people: RM.samplePeople(), comments: null, compare: '' };

  function marker(shape, x, y, color, r) {
    r = r || 4.5;
    const ring = 'stroke="#fff" stroke-width="2" stroke-linejoin="round"';
    const path = (pts) => `<path d="M${pts.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('L')}Z" fill="${color}" ${ring}/>`;
    if (shape === 'square') return `<rect x="${x - r}" y="${y - r}" width="${2 * r}" height="${2 * r}" rx="1" fill="${color}" ${ring}/>`;
    if (shape === 'triangle') { const h = r * 1.3; return path([[x, y - h], [x + h, y + r], [x - h, y + r]]); }
    if (shape === 'diamond') { const h = r * 1.4; return path([[x, y - h], [x + h, y], [x, y + h], [x - h, y]]); }
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="${color}" ${ring}/>`;
  }
  const swatch = (s) => `<svg width="30" height="14" aria-hidden="true" focusable="false"><line x1="1" x2="29" y1="7" y2="7" stroke="${s.color}" stroke-width="2"/>${marker(s.marker, 15, 7, s.color, s.ref ? 3.5 : 4)}</svg>`;

  // What the chart shows now: the three measures, or one identity question's groups.
  function view() {
    if (!state.compare) {
      const m = RM.map(state.people);
      return { lines: m.lines, notes: [], summary: RM.summary(state.people), map: m };
    }
    const g = RM.groups(state.people, state.compare);
    const lines = g.lines.map((l, i) => Object.assign({ key: l.key, label: l.label, values: l.values, g: l.g }, i === 0 ? EVERYONE : GROUP_STYLES[i - 1]));
    return { lines, notes: g.notes, summary: RM.groupSummary(g), groups: g };
  }

  function chart(v) {
    const small = $('chart').clientWidth < 600;
    const W = small ? 360 : 1000, H = small ? 340 : 420;
    const m = small ? { l: 30, r: 12, t: 16, b: 66 } : { l: 150, r: 230, t: 20, b: 64 };
    const pw = W - m.l - m.r, ph = H - m.t - m.b, n = RM.SETTINGS.length;
    const x = (i) => m.l + ((i + 0.5) * pw) / n;
    const y = (val) => m.t + ((5 - val) / 4) * ph;
    const out = [`<rect x="${m.l}" y="${y(3)}" width="${pw}" height="${y(1) - y(3)}" fill="#faf6f3"/>`];
    const words = { 5: 'Strongly agree', 4: 'Agree', 3: 'Neutral', 2: 'Disagree', 1: 'Strongly disagree' };
    for (let s = 1; s <= 5; s += 1) {
      out.push(`<line x1="${m.l}" x2="${m.l + pw}" y1="${y(s)}" y2="${y(s)}" stroke="${s === 3 ? '#cfd2dd' : '#ecebf2'}" stroke-width="1"/>`);
      out.push(`<text x="${m.l - 10}" y="${y(s) + 4.5}" text-anchor="end" font-size="13" font-weight="700" fill="${INK}">${s}</text>`);
      if (!small) out.push(`<text x="${m.l - 26}" y="${y(s) + 4.5}" text-anchor="end" font-size="12.5" fill="${MUTED}">${words[s]}</text>`);
    }
    RM.SETTINGS.forEach((st, i) => {
      const lines = small ? [st.short] : AXIS[st.id];
      const top = m.t + ph + 22 + (small && i % 2 ? 18 : 0);
      lines.forEach((t, li) => out.push(`<text x="${x(i).toFixed(1)}" y="${top + li * 16}" text-anchor="middle" font-size="${small ? 12.5 : 13}" font-weight="600" fill="${INK}">${esc(t)}</text>`));
    });
    out.push(`<line class="rm-cross" x1="0" x2="0" y1="${m.t}" y2="${m.t + ph}" stroke="#9aa0ad" stroke-width="1" visibility="hidden"/>`);
    v.lines.forEach((l) => {
      let d = '', pen = false;
      l.values.forEach((val, i) => {
        if (val.hidden) { pen = false; return; }
        d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)} ${y(val.mean).toFixed(1)}`;
        pen = true;
      });
      if (d) out.push(`<path d="${d}" fill="none" stroke="${l.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`);
    });
    v.lines.forEach((l) => l.values.forEach((val, i) => { if (!val.hidden) out.push(marker(l.marker, x(i), y(val.mean), l.color, l.ref ? 3.5 : 4.5)); }));
    if (!small) {
      // Labels at the right, joined to each line's last point.
      const labels = v.lines.map((l) => {
        let last = -1;
        l.values.forEach((val, i) => { if (!val.hidden) last = i; });
        return last < 0 ? null : { l, x0: x(last), y0: y(l.values[last].mean), y: y(l.values[last].mean) };
      }).filter(Boolean).sort((a, b) => a.y - b.y);
      for (let i = 1; i < labels.length; i += 1) labels[i].y = Math.max(labels[i].y, labels[i - 1].y + 19);
      const over = labels.length ? labels[labels.length - 1].y - (m.t + ph) : 0;
      if (over > 0) { labels[labels.length - 1].y -= over; for (let i = labels.length - 2; i >= 0; i -= 1) labels[i].y = Math.min(labels[i].y, labels[i + 1].y - 19); }
      const lx = m.l + pw + 24;
      labels.forEach((lb) => {
        out.push(`<path d="M${(lb.x0 + 8).toFixed(1)} ${lb.y0.toFixed(1)}L${(m.l + pw + 6).toFixed(1)} ${lb.y0.toFixed(1)}L${lx - 4} ${lb.y.toFixed(1)}" fill="none" stroke="#b9bdc8" stroke-width="1"/>`);
        out.push(marker(lb.l.marker, lx + 4, lb.y, lb.l.color, lb.l.ref ? 3.5 : 4));
        out.push(`<text x="${lx + 14}" y="${(lb.y + 4.5).toFixed(1)}" font-size="13" font-weight="${lb.l.ref ? 600 : 700}" fill="${lb.l.ref ? MUTED : INK}">${esc(lb.l.label)}</text>`);
      });
    }
    RM.SETTINGS.forEach((st, i) => {
      const text = `${st.label}: ${v.lines.map((l) => `${l.label} ${l.values[i].hidden ? 'hidden' : f1(l.values[i].mean)}`).join('; ')}`;
      out.push(`<rect class="rm-hit" data-i="${i}" x="${(m.l + (i * pw) / n).toFixed(1)}" y="${m.t}" width="${(pw / n).toFixed(1)}" height="${ph}" fill="transparent" tabindex="0" aria-label="${esc(text)}"/>`);
    });
    const title = state.compare ? `Relief Map by ${RM.IDENTITY.find((q) => q.id === state.compare).label.toLowerCase()}` : 'Relief Map: three measures in six workplace settings';
    return `<svg viewBox="0 0 ${W} ${H}" role="group" aria-labelledby="rm-title rm-desc" xmlns="http://www.w3.org/2000/svg" data-x0="${m.l}" data-pw="${pw}" data-n="${n}" data-w="${W}">
      <title id="rm-title">${esc(title)}</title><desc id="rm-desc">${esc(v.summary.join(' '))} Every value is also in The numbers.</desc>${out.join('')}</svg>`;
  }

  function bindTips(v) {
    const svg = $('chart').querySelector('svg');
    const tip = $('rm-tip');
    const cross = svg.querySelector('.rm-cross');
    const show = (rect) => {
      const i = Number(rect.dataset.i);
      const box = svg.getBoundingClientRect();
      const scale = box.width / Number(svg.dataset.w);
      const cx = Number(svg.dataset.x0) + ((i + 0.5) * Number(svg.dataset.pw)) / Number(svg.dataset.n);
      cross.setAttribute('x1', cx); cross.setAttribute('x2', cx); cross.setAttribute('visibility', 'visible');
      const rows = v.lines.slice().sort((a, b) => (b.values[i].hidden ? -9 : b.values[i].mean) - (a.values[i].hidden ? -9 : a.values[i].mean));
      tip.innerHTML = `<p class="rm-tip-h">${esc(RM.SETTINGS[i].label)}</p><ul>${rows.map((l) => `<li>${swatch(l)}<span>${esc(l.label)}</span><strong>${l.values[i].hidden ? 'Hidden' : f1(l.values[i].mean)}</strong></li>`).join('')}</ul>`;
      tip.hidden = false;
      let left = box.left + window.scrollX + cx * scale + 14;
      if (left + tip.offsetWidth > window.scrollX + document.documentElement.clientWidth - 8) left = box.left + window.scrollX + cx * scale - tip.offsetWidth - 14;
      tip.style.left = `${Math.max(window.scrollX + 8, left)}px`;
      tip.style.top = `${box.top + window.scrollY + Math.max(8, (box.height - tip.offsetHeight) / 2)}px`;
    };
    const hide = () => { tip.hidden = true; cross.setAttribute('visibility', 'hidden'); };
    svg.querySelectorAll('.rm-hit').forEach((r) => {
      ['mouseenter', 'focus', 'click'].forEach((ev) => r.addEventListener(ev, () => show(r)));
      ['mouseleave', 'blur'].forEach((ev) => r.addEventListener(ev, hide));
    });
    svg.addEventListener('keydown', (e) => { if (e.key === 'Escape') hide(); });
  }

  const cell = (val) => (val.hidden ? '<td class="is-hidden">Hidden</td>' : `<td>${f1(val.mean)}</td>`);

  function render() {
    const v = view();
    $('chart').innerHTML = chart(v);
    bindTips(v);
    $('legend').innerHTML = v.lines.map((l) => {
      const size = l.key === 'all' ? state.people.length : (l.g != null ? state.people.filter((p) => p.ident[state.compare] === l.g).length : null);
      return `<li>${swatch(l)}<span>${esc(l.label)}${size != null ? ` <span class="text-secondary">(${size} people)</span>` : ''}</span></li>`;
    }).join('');
    $('notes').innerHTML = v.notes.map((t) => `<p>${esc(t)}</p>`).join('');
    // Table: settings down the side, lines across.
    const extra = v.map ? '<th scope="col">Average</th><th scope="col">Not experienced</th>' : '';
    const ne = RM.notExperienced(state.people);
    $('data-table').innerHTML = `<caption class="visually-hidden">Average answer (1 to 5) in each setting</caption>
      <thead><tr><th scope="col">Setting</th>${v.lines.map((l) => `<th scope="col">${esc(l.label)}</th>`).join('')}${extra}</tr></thead>
      <tbody>${RM.SETTINGS.map((s, i) => `<tr><th scope="row">${esc(s.label)}</th>${v.lines.map((l) => cell(l.values[i])).join('')}${v.map ? `${cell(v.map.settings[i])}<td>${Math.round(ne[i].share * 100)}%</td>` : ''}</tr>`).join('')}</tbody>`;
    $('dims-table').innerHTML = `<caption class="visually-hidden">Average answer for each of the five dimensions</caption>
      <thead><tr><th scope="col">Dimension</th><th scope="col">Average</th></tr></thead>
      <tbody>${RM.dimensionAverages(state.people).map((d) => `<tr><th scope="row">${esc(d.dim.label)}</th>${cell(d)}</tr>`).join('')}</tbody>`;
    $('overall').innerHTML = `<ul class="rm-bars">${RM.overall(state.people).map((o) => `<li class="rm-bar-row"><div class="rm-bar-line"><span>${esc(o.item.text)}</span>${o.hidden
      ? '<span class="is-hidden">Hidden</span></div>'
      : `<span class="rm-bar-pct">${Math.round(o.agree * 100)}% agree</span></div><div class="rm-bar" aria-hidden="true"><span style="width:${(o.agree * 100).toFixed(1)}%"></span></div>`}</li>`).join('')}</ul>`;
  }

  function setSource(kind, data) {
    state.source = kind;
    state.people = data.people;
    $('data-tag').textContent = kind === 'sample' ? `Fictional team of ${data.people.length}` : `Your data: ${data.people.length} people`;
    $('data-tag').classList.toggle('is-real', kind !== 'sample');
    $('use-sample').hidden = kind === 'sample';
    render();
  }

  function init() {
    $('compare').innerHTML = '<option value="">Three measures</option>' + RM.IDENTITY.map((q) => `<option value="${q.id}">By ${esc(q.label.toLowerCase())}</option>`).join('');
    setSource('sample', { people: state.people });
    $('compare').addEventListener('change', (e) => { state.compare = e.target.value; render(); });
    $('csv-file').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const msg = $('file-msg');
        try {
          const data = RM.readExport(reader.result);
          if (!data.people.length) throw new Error('The file has no answers yet.');
          setSource('file', data);
          const left = [data.declined ? `${data.declined} who said no` : '', data.tests ? `${data.tests} tests or previews` : ''].filter(Boolean);
          msg.className = 'rm-msg text-success';
          msg.textContent = `Loaded ${data.people.length} people${left.length ? ` (left out: ${left.join(', ')})` : ''}.`;
          if (data.identifying) {
            msg.className = 'rm-msg text-danger';
            msg.textContent += ' Warning: this file has identifying details. Turn on "Anonymize responses" in Qualtrics and export again.';
          }
        } catch (err) {
          msg.className = 'rm-msg text-danger';
          msg.textContent = err.message;
        }
        e.target.value = '';
      };
      reader.readAsText(file);
    });
    $('use-sample').addEventListener('click', () => { setSource('sample', { people: RM.samplePeople() }); $('file-msg').textContent = ''; });
    let small = $('chart').clientWidth < 600;
    window.addEventListener('resize', () => {
      const now = $('chart').clientWidth < 600;
      if (now !== small) { small = now; render(); }
      $('rm-tip').hidden = true;
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
