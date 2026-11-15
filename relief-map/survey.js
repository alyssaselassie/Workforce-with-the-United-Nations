// Relief Maps survey preview: the exact questions, order, random rotation and logic of the Qualtrics
// survey, on one mobile-first page. Nothing is saved or sent: answers live in memory until the tab
// is closed or the preview is restarted.
(function () {
  'use strict';
  const RM = window.ReliefMap;
  const $ = (id) => document.getElementById(id);
  const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const after = (text, prefix) => (text.startsWith(prefix) ? text.slice(prefix.length) : text).trim();
  const sentences = (text) => text.split(/\.\s+/).map((s, i, a) => (i < a.length - 1 ? `${s}.` : s));
  const N = RM.SETTINGS.length;

  const fresh = () => ({ answers: {}, picks: {}, history: [], current: 'intro', ended: null });
  let state = fresh();
  let showAll = false;

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i -= 1) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  // Like Qualtrics' random subset: 3 of the 5 statements, in random order, fixed for this visit.
  function pick(sid) {
    if (!state.picks[sid]) state.picks[sid] = shuffle(RM.DIMENSIONS.map((d) => d.id)).slice(0, RM.SHOWN_PER_SETTING);
    return state.picks[sid];
  }

  const likert = (it) => ({ id: it.id, text: it.text, options: RM.SCALE, item: it });
  const choice = (q, required) => ({ id: q.id, text: q.question, options: q.options, required: !!required, ident: q.groups ? q : null });

  function allPages() {
    const list = [{
      id: 'intro', eyebrow: 'Welcome', title: RM.SURVEY_TITLE,
      body: [after(RM.TEXT.intro, `${RM.SURVEY_TITLE}.`)], facts: sentences(RM.TEXT.privacy), questions: [choice(RM.CONSENT, true)]
    }];
    RM.SETTINGS.forEach((st, si) => {
      const eyebrow = `Setting ${si + 1} of ${N}`;
      if (st.id === 'VIR') list.push({ id: 'VIR_SCREEN', eyebrow, title: st.label, body: [], questions: [choice(RM.VIR_USE)] });
      const dims = showAll ? RM.DIMENSIONS.map((d) => d.id) : pick(st.id);
      list.push({
        id: st.id, eyebrow, title: st.label, body: [`${st.intro} How much do you agree with each statement?`],
        note: showAll ? `Reviewer view: all ${RM.DIMENSIONS.length} statements. Each participant sees ${RM.SHOWN_PER_SETTING} of them, chosen at random.` : '',
        questions: dims.map((did) => likert(RM.ITEMS.find((it) => it.id === RM.itemId(st.id, did)))),
        when: st.id === 'VIR' ? () => state.answers[RM.VIR_USE.id] !== 1 : null
      });
    });
    list.push({ id: 'OVERALL', eyebrow: 'Your workplace overall', title: 'Your workplace as a whole', body: [after(RM.TEXT.overallIntro, 'Your workplace overall.')], questions: RM.OVERALL.map(likert) });
    list.push({ id: 'ABOUT', eyebrow: 'About you', title: 'About you (optional)', body: [after(RM.TEXT.aboutIntro, 'About you (optional).')], questions: [choice(RM.ID_OPTIN)] });
    list.push({
      id: 'IDENTITY', eyebrow: 'About you', title: 'About you (optional)', body: ['Choose the answer that fits best. You can skip any question.'],
      questions: RM.IDENTITY.map((q) => choice(q)), when: () => state.answers[RM.ID_OPTIN.id] === 0
    });
    list.push({ id: 'REFLECT', eyebrow: 'Your ideas', title: 'Your ideas (optional)', body: [after(RM.TEXT.reflectIntro, 'Your ideas (optional).')], questions: RM.REFLECTION.map((r) => ({ id: r.id, text: r.question, essay: true })) });
    return list;
  }
  const visiblePages = () => allPages().filter((p) => !p.when || p.when());

  function metaHtml(q) {
    if (!showAll) return '';
    let text = '';
    if (q.item) {
      const d = RM.DIMENSIONS.find((x) => x.id === q.item.dim);
      text = `${q.item.construct || d.label} · ${RM.SOURCE_KINDS[q.item.kind].label}: ${q.item.note}`;
    } else if (q.ident) text = `${RM.SOURCE_KINDS[q.ident.kind].label}: ${q.ident.note}`;
    return text ? `<p class="sv-meta">${esc(text)}</p>` : '';
  }

  function questionHtml(q) {
    if (q.essay) {
      return `<div class="sv-q"><label class="sv-q-text" for="f-${q.id}">${esc(q.text)}</label>
        <textarea id="f-${q.id}" name="${q.id}" rows="4">${esc(state.answers[q.id] || '')}</textarea></div>`;
    }
    const opts = q.options.map((o, oi) => `<label class="sv-opt"><input type="radio" name="${q.id}" value="${oi}"${state.answers[q.id] === oi ? ' checked' : ''}${q.required ? ' required' : ''}><span class="sv-dot" aria-hidden="true"></span><span class="sv-opt-text">${esc(o)}</span></label>`).join('');
    return `<fieldset class="sv-q" id="q-${q.id}"${q.required ? ' aria-required="true"' : ''}>
      <legend class="sv-q-text">${esc(q.text)}${q.required ? ' <span class="sv-req">Required</span>' : ''}</legend>${metaHtml(q)}
      <div class="sv-options">${opts}</div></fieldset>`;
  }

  function setProgress(pct) {
    const bar = $('sv-progress');
    bar.setAttribute('aria-valuenow', String(pct));
    bar.setAttribute('aria-valuetext', `${pct}% complete`);
    bar.querySelector('span').style.width = `${pct}%`;
  }

  function focusHeading() {
    window.scrollTo(0, 0);
    const h = $('sv-h');
    if (h) h.focus({ preventScroll: true });
  }

  function render(moveFocus) {
    const list = visiblePages();
    const i = Math.max(0, list.findIndex((p) => p.id === state.current));
    const page = list[i];
    state.current = page.id;
    $('sv-page').innerHTML = `<p class="sv-eyebrow">${esc(page.eyebrow)}</p>
      <h1 class="sv-title" id="sv-h" tabindex="-1">${esc(page.title)}</h1>
      ${page.body.map((t) => `<p class="sv-lead">${esc(t)}</p>`).join('')}
      ${page.facts ? `<ul class="sv-facts">${page.facts.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
      ${page.note ? `<p class="sv-note">${esc(page.note)}</p>` : ''}
      <div class="sv-questions">${page.questions.map(questionHtml).join('')}</div>`;
    $('sv-error').hidden = true;
    $('sv-nav').hidden = false;
    $('sv-back').hidden = i === 0;
    $('sv-next').textContent = i === list.length - 1 ? 'Submit' : 'Next';
    setProgress(Math.round((i / list.length) * 100));
    if (moveFocus) focusHeading();
  }

  function end(kind) {
    state.ended = kind;
    const thanks = kind === 'thanks';
    $('sv-page').innerHTML = `<p class="sv-eyebrow">${thanks ? 'Survey complete' : 'Survey ended'}</p>
      <h1 class="sv-title" id="sv-h" tabindex="-1">Thank you</h1>
      <p class="sv-lead">${esc(thanks ? RM.TEXT.thanks : RM.TEXT.declined)}</p>
      <p class="sv-note">Preview complete: nothing was saved or sent.</p>
      <div class="sv-end-links"><button type="button" class="sv-btn sv-back" id="sv-again">Restart the preview</button><a class="sv-btn sv-next" href="./">See the Relief Map</a></div>`;
    $('sv-nav').hidden = true;
    $('sv-error').hidden = true;
    setProgress(100);
    $('sv-again').addEventListener('click', restart);
    focusHeading();
  }

  function showError(msg, fieldsetId) {
    const err = $('sv-error');
    err.textContent = msg;
    err.hidden = false;
    const fs = $(fieldsetId);
    if (fs) {
      fs.setAttribute('aria-invalid', 'true');
      fs.setAttribute('aria-describedby', 'sv-error');
      const first = fs.querySelector('input');
      if (first) first.focus();
    }
  }

  function restart() {
    state = fresh();
    render(true);
  }

  function init() {
    render(false);
    const form = $('sv-form');
    form.addEventListener('change', (e) => {
      const t = e.target;
      if (t.type === 'radio') {
        state.answers[t.name] = Number(t.value);
        const fs = t.closest('fieldset');
        if (fs && fs.getAttribute('aria-invalid')) { fs.removeAttribute('aria-invalid'); $('sv-error').hidden = true; }
      }
    });
    form.addEventListener('input', (e) => { if (e.target.tagName === 'TEXTAREA') state.answers[e.target.name] = e.target.value; });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (state.ended) return;
      if (state.current === 'intro') {
        const c = state.answers[RM.CONSENT.id];
        if (c == null) { showError('Please choose an answer to continue.', `q-${RM.CONSENT.id}`); return; }
        if (c === 1) { end('declined'); return; }
      }
      const list = visiblePages();
      const i = list.findIndex((p) => p.id === state.current);
      if (i === list.length - 1) { end('thanks'); return; }
      state.history.push(state.current);
      state.current = list[i + 1].id;
      render(true);
    });
    $('sv-back').addEventListener('click', () => {
      if (!state.history.length) return;
      state.current = state.history.pop();
      render(true);
    });
    $('sv-all').addEventListener('change', (e) => {
      showAll = e.target.checked;
      if (!state.ended) render(false);
    });
    $('sv-restart').addEventListener('click', restart);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
