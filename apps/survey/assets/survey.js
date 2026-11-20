// UN Workforce Inclusion & Psychological Safety Assessment: the questionnaire.
// Every question is multiple choice and required; a progress indicator and a review screen come
// before submitting. Submitting is handled by site.js (secure database, or demonstration mode).
(function () {
  'use strict';
  const M = window.AssessmentModel;
  const S = window.AssessmentSite;
  const $ = (id) => document.getElementById(id);
  const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---------- questions and pages ----------
  const Q = {
    CONSENT: { id: M.CONSENT.id, text: M.CONSENT.text, options: M.CONSENT.options.map((label, i) => ({ value: String(i + 1), label })) },
    DEPARTMENT: { id: M.DEPARTMENT_Q.id, text: M.DEPARTMENT_Q.text, help: M.DEPARTMENT_Q.help, list: true, options: M.DEPARTMENTS.map((d) => ({ value: d.id, label: d.name })) }
  };
  const itemQ = (letter, it, i, text) => ({ id: it.id, num: `${letter}${i + 1}`, text: text || it.text, scale: true,
    options: M.SCALES[it.scale].options.map((label, j) => ({ value: String(j + 1), label })), na: { value: String(M.NA.code), label: M.naLabel(it.scale) } });
  const R = M.RELIEF;
  const LAST = R.letter; // sections A to G

  const PAGES = [
    { id: 'welcome', eyebrow: 'Before you start', title: 'Taking part', body: [M.TEXT.intro], facts: M.TEXT.privacy, questions: [Q.CONSENT] },
    { id: 'department', eyebrow: 'Your department', title: 'Your department', body: [`This is the only question about you. It is used only to group answers, and no result is shown for a group of fewer than ${M.CONFIG.minGroupSize} people.`], questions: [Q.DEPARTMENT] }
  ].concat(
    M.CATEGORIES.map((c) => ({ id: c.id, eyebrow: `Section ${c.letter} of ${LAST}`, section: `Section ${c.letter}`, title: c.name, body: [c.intro], caution: c.caution, scaleName: M.SCALES[c.scale].name, questions: c.items.map((it, i) => itemQ(c.letter, it, i)) })),
    // Section G, the Relief Map: one page per workplace setting, one question per identity dimension.
    R.settings.map((s, si) => {
      const items = R.items.filter((it) => it.setting === s.id);
      return {
        id: `${R.id}-${s.id}`, eyebrow: `Section ${R.letter}: ${R.name} · ${si + 1} of ${R.settings.length}`, section: `Section ${R.letter}`, title: s.name,
        body: (si === 0 ? [R.intro] : []).concat(`${s.about} In ${s.phrase}, how comfortable do you feel in relation to each part of who you are?`),
        caution: `${R.note} If you prefer not to answer, or you do not take part in this setting, choose "${M.SCALES.comfort.na}".`,
        scaleName: M.SCALES.comfort.name, naHint: true,
        questions: items.map((it, i) => itemQ(R.letter, it, si * items.length + i, it.short))
      };
    }),
    [{ id: 'review', eyebrow: 'Review', title: 'Review your answers', review: true }]
  );
  const ALL_Q = PAGES.flatMap((p) => p.questions || []);
  const Q_BY_ID = Object.fromEntries(ALL_Q.map((q) => [q.id, q]));
  const labelOf = (q, v) => (q.na && v === q.na.value ? q.na.label : (q.options.find((o) => o.value === v) || {}).label || '');
  const qName = (q) => (q.num ? `${q.num}. ${q.text}` : q.text);

  const state = { answers: {}, history: [], current: 'welcome', fromReview: false, busy: false, flagged: [], done: false };
  const index = () => PAGES.findIndex((p) => p.id === state.current);

  // ---------- rendering ----------
  function optionHtml(q, o, extra) {
    const checked = state.answers[q.id] === o.value ? ' checked' : '';
    return `<label class="sv-opt${extra ? ` ${extra}` : ''}"><input type="radio" name="${q.id}" value="${esc(o.value)}"${checked} required><span class="sv-dot" aria-hidden="true"></span><span>${esc(o.label)}</span></label>`;
  }

  function questionHtml(q) {
    return `<fieldset class="sv-q" id="q-${q.id}"${q.help ? ` aria-describedby="help-${q.id}"` : ''}>
      <legend class="sv-q-text">${q.num ? `<span class="sv-q-num">${q.num}</span> ` : ''}${esc(q.text)} <span class="sv-req">Required</span></legend>
      ${q.help ? `<p class="sv-help" id="help-${q.id}">${esc(q.help)}</p>` : ''}
      <p class="sv-q-error" id="err-${q.id}" hidden>Choose an answer to continue.</p>
      <div class="sv-options${q.scale ? ' is-scale' : q.list ? ' is-list' : ''}">${q.options.map((o) => optionHtml(q, o)).join('')}</div>
      ${q.na ? `<div class="sv-options">${optionHtml(q, q.na, 'sv-opt-na')}</div>` : ''}
    </fieldset>`;
  }

  function reviewHtml() {
    const sections = PAGES.filter((p) => p.questions && p.id !== 'welcome');
    return `<p class="sv-eyebrow">Review</p><h1 class="sv-title" id="sv-h" tabindex="-1">Review your answers</h1>
      <p class="sv-lead">Check your answers before you submit. Select Change to edit a section. Every question needs an answer.</p>
      <div class="sv-review">${sections.map((p) => `<section aria-labelledby="rv-${p.id}">
        <div class="sv-review-head"><h2 id="rv-${p.id}">${esc(p.section ? `${p.section}: ${p.title}` : p.title)}</h2>
          <button type="button" class="sv-change" data-goto="${p.id}" aria-label="Change answers in ${esc(p.title)}">Change</button></div>
        <dl>${p.questions.map((q) => {
          const v = state.answers[q.id];
          return `<dt>${esc(qName(q))}</dt><dd${v == null ? ' class="is-missing"' : ''}>${v == null ? 'Not answered' : esc(labelOf(q, v))}</dd>`;
        }).join('')}</dl></section>`).join('')}</div>
      <p class="sv-note">${S.mode === 'live'
        ? 'When you submit, your answers are sent to the secure database with your department. Your name, email, staff ID and IP address are not part of the response.'
        : 'Demonstration version: when you submit, your answers stay in this browser as demonstration data. Nothing is collected.'}</p>`;
  }

  function pageHtml(page) {
    if (page.review) return reviewHtml();
    return `<p class="sv-eyebrow">${esc(page.eyebrow)}</p><h1 class="sv-title" id="sv-h" tabindex="-1">${esc(page.title)}</h1>
      ${page.body.map((t) => `<p class="sv-lead">${esc(t)}</p>`).join('')}
      ${page.scaleName ? `<p class="sv-scale-note">Answer scale: ${esc(page.scaleName.toLowerCase())}.${page.naHint ? '' : ` If a statement does not apply to you, choose "${esc(M.NA.label)}".`}</p>` : ''}
      ${page.caution ? `<p class="sv-note">${esc(page.caution)}</p>` : ''}
      ${page.facts ? `<ul class="sv-facts">${page.facts.map((t) => `<li>${esc(t)}</li>`).join('')}</ul><p class="sv-more"><a href="privacy.html${S.demoQuery}" target="_blank" rel="noopener">Read the full privacy statement</a> (opens in a new tab).</p>` : ''}
      <p class="sv-all-required">All questions are required.</p>
      <div class="sv-questions">${page.questions.map(questionHtml).join('')}</div>`;
  }

  function progress() {
    const answered = ALL_Q.filter((q) => state.answers[q.id] != null).length;
    const pct = Math.round((answered / ALL_Q.length) * 100);
    const bar = $('sv-progress');
    bar.setAttribute('aria-valuenow', String(pct));
    bar.setAttribute('aria-valuetext', `${answered} of ${ALL_Q.length} questions answered`);
    bar.querySelector('span').style.width = `${pct}%`;
    const i = index();
    $('sv-count').textContent = i >= 0 ? `Step ${i + 1} of ${PAGES.length} · ${answered} of ${ALL_Q.length} answered` : `${answered} of ${ALL_Q.length} answered`;
  }

  function focusTitle() {
    window.scrollTo(0, 0);
    const h = $('sv-h');
    if (h) h.focus({ preventScroll: true });
  }

  function render(moveFocus) {
    const i = index();
    const page = PAGES[i];
    $('sv-page').innerHTML = pageHtml(page);
    clearErrors();
    $('sv-nav').hidden = false;
    $('sv-back').hidden = i === 0 && !state.fromReview;
    $('sv-back').textContent = state.fromReview ? 'Back to review' : 'Back';
    $('sv-next').textContent = page.review ? 'Submit my answers' : state.fromReview ? 'Save and return to review' : 'Next';
    progress();
    if (moveFocus) focusTitle();
  }

  // ---------- errors ----------
  function markError(q, on) {
    const fs = $(`q-${q.id}`);
    if (!fs) return;
    fs.classList.toggle('has-error', on);
    $(`err-${q.id}`).hidden = !on;
    // Only point to the error message while it is shown.
    const ids = [q.help ? `help-${q.id}` : '', on ? `err-${q.id}` : ''].filter(Boolean).join(' ');
    if (ids) fs.setAttribute('aria-describedby', ids); else fs.removeAttribute('aria-describedby');
  }

  function clearErrors() {
    state.flagged = [];
    $('sv-errors').hidden = true;
    $('sv-errors').innerHTML = '';
  }

  function summary(missing, onReview) {
    const box = $('sv-errors');
    const n = missing.length;
    box.innerHTML = `<h2>${n === 1 ? 'There is 1 question to answer' : `There are ${n} questions to answer`}</h2>
      <ul>${missing.map((q) => (onReview
        ? `<li><a href="#" data-goto="${PAGES.find((p) => (p.questions || []).includes(q)).id}">${esc(qName(q))}</a></li>`
        : `<li><a href="#q-${q.id}" data-focus="${q.id}">${esc(qName(q))}</a></li>`)).join('')}</ul>`;
    box.hidden = !n;
  }

  function showErrors(missing, onReview) {
    state.flagged = missing.map((q) => q.id);
    missing.forEach((q) => markError(q, true));
    summary(missing, onReview);
    window.scrollTo(0, 0);
    $('sv-errors').focus({ preventScroll: true });
  }

  function showSubmitError(text) {
    const box = $('sv-errors');
    box.innerHTML = `<h2>Your answers were not submitted</h2><p>${esc(text)}</p><p>Your answers are still here: select "Submit my answers" to try again.</p>`;
    box.hidden = false;
    window.scrollTo(0, 0);
    box.focus({ preventScroll: true });
  }

  // ---------- endings ----------
  function declined() {
    $('sv-page').innerHTML = `<p class="sv-eyebrow">Finished</p><h1 class="sv-title" id="sv-h" tabindex="-1">Thank you</h1>
      <p class="sv-lead">${esc(M.TEXT.declined)}</p>
      <div class="sv-end-links"><a class="sv-btn sv-back" href="index.html${S.demoQuery}">Return to the start</a></div>`;
    $('sv-nav').hidden = true;
    clearErrors();
    state.answers = {};
    state.history = [];
    state.current = null;
    state.done = true;
    focusTitle();
  }

  function submit() {
    if (state.busy) return;
    const missing = ALL_Q.filter((q) => state.answers[q.id] == null);
    if (missing.length) { showErrors(missing, true); return; }
    state.busy = true;
    const btn = $('sv-next');
    btn.setAttribute('aria-disabled', 'true');
    btn.textContent = 'Submitting…';
    let input;
    try {
      input = { department: state.answers.DEPARTMENT, answers: Object.fromEntries(M.ITEMS.map((it) => [it.id, Number(state.answers[it.id])])) };
    } catch (e) { input = null; }
    S.submit(input).then(() => {
      state.done = true;
      window.location.replace(`thanks.html${S.demoQuery || (S.mode === 'demo' ? '?demo=1' : '')}`);
    }).catch((err) => {
      state.busy = false;
      btn.removeAttribute('aria-disabled');
      btn.textContent = 'Submit my answers';
      showSubmitError(err && err.message ? err.message : 'Something went wrong.');
    });
  }

  // ---------- events ----------
  function goTo(id) {
    state.fromReview = true;
    state.current = id;
    render(true);
  }

  function init() {
    render(false);
    const form = $('sv-form');
    form.addEventListener('change', (e) => {
      if (e.target.type !== 'radio' || !Q_BY_ID[e.target.name]) return;
      state.answers[e.target.name] = e.target.value;
      if (state.flagged.includes(e.target.name)) {
        markError(Q_BY_ID[e.target.name], false);
        state.flagged = state.flagged.filter((id) => id !== e.target.name);
        summary(state.flagged.map((id) => Q_BY_ID[id]), false);
      }
      progress();
    });
    form.addEventListener('click', (e) => {
      const go = e.target.closest('[data-goto]');
      if (go) { e.preventDefault(); goTo(go.dataset.goto); return; }
      const link = e.target.closest('[data-focus]');
      if (link) {
        e.preventDefault();
        const input = document.querySelector(`#q-${link.dataset.focus} input`);
        if (input) { input.scrollIntoView({ block: 'center' }); input.focus({ preventScroll: true }); }
      }
    });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (state.current == null) return;
      const page = PAGES[index()];
      if (page.review) { submit(); return; }
      const missing = page.questions.filter((q) => state.answers[q.id] == null);
      if (missing.length) { showErrors(missing, false); return; }
      if (page.id === 'welcome' && state.answers.CONSENT !== '1') { declined(); return; } // "No" ends the assessment
      if (state.fromReview) { state.fromReview = false; state.current = 'review'; render(true); return; }
      state.history.push(state.current);
      state.current = PAGES[index() + 1].id;
      render(true);
    });
    $('sv-back').addEventListener('click', () => {
      if (state.fromReview) { state.fromReview = false; state.current = 'review'; render(true); return; }
      if (state.history.length) { state.current = state.history.pop(); render(true); }
    });
    // Warn before leaving with unsent answers (nothing is saved until submission).
    window.addEventListener('beforeunload', (e) => {
      if (state.done || !Object.keys(state.answers).some((id) => id !== 'CONSENT')) return;
      e.preventDefault();
      e.returnValue = '';
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
