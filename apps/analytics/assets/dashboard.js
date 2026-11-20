// UN Workforce Analytics Dashboard: one page per department with six graphs (one per area), and one
// table that compares all departments. Every number comes from an aggregated release
// (AssessmentModel.buildRelease): groups under the minimum size carry no numbers at all, and individual
// answers never reach this page.
(function () {
  'use strict';
  const M = window.AssessmentModel;
  const A = window.AssessmentAuth;
  const cfg = window.ANALYTICS_CONFIG || {};
  const $ = (id) => document.getElementById(id);
  const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pct = (v) => (v == null ? '–' : `${Math.round(v * 100)}%`);
  const K = M.CONFIG.minGroupSize;

  // Answers given in the demonstration survey in this browser are added to the demonstration data.
  let demoStore = null;
  try { demoStore = M.demoStore(window.localStorage); demoStore.count(); } catch (e) { demoStore = null; }
  let demoBase = null;
  let demoRelease = null;
  let liveRelease = null;

  const state = { source: null, view: 'dept', department: 'ALL', period: null, liveAt: null };

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

  // ---------- pieces ----------
  const heading = (title, meta) => `<div class="ad-set-head"><h2>${esc(title)}</h2>${meta ? `<p>${esc(meta)}</p>` : ''}</div>`;
  const message = (title, text) => `<div class="ad-empty"><h3>${esc(title)}</h3><p>${esc(text)}</p></div>`;
  const hiddenText = (c) => (c && c.status === 'protected' ? 'Hidden to protect a smaller group' : 'Not enough responses yet');

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
    out.innerHTML = heading(title, `${c.n} responses · ${when}`) + `<div class="ad-cards">${M.CATEGORIES.map((cat) => card(c, cat)).join('')}</div>`;
  }

  // Darker blue = more favourable. The value is always printed in the cell.
  const level = (v) => 1 + [0.5, 0.6, 0.7, 0.8].filter((b) => v >= b).length;

  function renderCompare(rel) {
    const out = $('compare-out');
    if (!rel || !rel.periods.length) { out.innerHTML = heading('Compare departments', '') + message('No responses yet', `Results appear once there are at least ${K} responses.`); return; }
    const row = (id, label) => {
      const c = M.cell(rel, state.period, id);
      if (c.status !== 'published') return `<tr class="is-off"><th scope="row">${esc(label)}</th><td colspan="${M.CATEGORIES.length + 1}">${hiddenText(c)}</td></tr>`;
      const name = id === 'ALL' ? esc(label) : `<button type="button" class="ad-link" data-department="${id}">${esc(label)}</button>`;
      return `<tr${id === 'ALL' ? ' class="is-all"' : ''}><th scope="row">${name}</th><td class="ad-n">${c.n}</td>${M.CATEGORIES.map((cat) => {
        const v = c.scores[cat.id].favourable;
        return `<td class="ad-heat l${level(v)}">${pct(v)}</td>`;
      }).join('')}</tr>`;
    };
    out.innerHTML = heading('Compare departments', `% favourable in each area · ${M.periodLabel(state.period)}`)
      + `<div class="ad-table-wrap" tabindex="0" role="region" aria-label="Comparison table">
        <table class="ad-compare">
          <caption class="visually-hidden">Percentage of favourable answers, by department and area</caption>
          <thead><tr><th scope="col">Department</th><th scope="col">Responses</th>${M.CATEGORIES.map((cat) => `<th scope="col"><span class="ad-letter" aria-hidden="true">${cat.letter}</span><span class="ad-col-name">${esc(cat.name)}</span></th>`).join('')}</tr></thead>
          <tbody>${row('ALL', 'All departments')}${M.DEPARTMENTS.map((d) => row(d.id, d.short)).join('')}</tbody>
        </table></div>
        <div class="ad-key"><span>Less favourable</span><span class="ad-heat l1" aria-hidden="true"></span><span class="ad-heat l2" aria-hidden="true"></span><span class="ad-heat l3" aria-hidden="true"></span><span class="ad-heat l4" aria-hidden="true"></span><span class="ad-heat l5" aria-hidden="true"></span><span>More favourable</span></div>
        <p class="ad-hint">Select a department to see its six graphs. Differences of a few points can be due to chance, especially in smaller departments.</p>`;
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
    renderNotice(rel);
    fillSelects(rel);
    renderDept(rel);
    renderCompare(rel);
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
      tip.style.top = `${r.top + window.scrollY - tip.offsetHeight - 8}px`;
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
    render();
    showView('dept');
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
      render();
      showView('dept');
      $('dept-out').scrollIntoView({ block: 'start' });
    });

    // Demonstration answers given in another tab of this browser update the charts.
    window.addEventListener('storage', (e) => { if (state.source === 'demo' && [M.CONFIG.demoStorageKey, null].includes(e.key)) render(); });
    document.addEventListener('visibilitychange', () => { if (!document.hidden && state.source === 'demo') render(); });

    // ?demo=1 opens the demonstration directly; #compare opens the comparison.
    if (new URLSearchParams(window.location.search).get('demo') === '1') {
      open('demo');
      if (window.location.hash === '#compare') showView('compare');
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
