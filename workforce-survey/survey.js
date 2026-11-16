// UN Workforce Experience Survey: every question is multiple choice and required, and there is a
// review screen before submitting. On this website, answers are saved only in this browser.
(function () {
  'use strict';
  const W = window.WorkforceSurvey;
  const $ = (id) => document.getElementById(id);
  const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // Demo mode (survey.html?demo=1): answers join the demonstration data on this device, never real responses.
  const DEMO_MODE = new URLSearchParams(window.location.search).get('demo') === '1';
  let store = null;
  try { store = W.deviceStore(window.localStorage, DEMO_MODE ? W.CONFIG.demoStorageKey : W.CONFIG.storageKey); store.count(); } catch (e) { store = null; }

  // ---------- questions and pages ----------
  const Q = {
    CONSENT: { id: W.CONSENT.id, text: W.CONSENT.text, options: W.CONSENT.options.map((label, i) => ({ value: String(i + 1), label })) },
    ENTITY: { id: W.ENTITY_Q.id, text: W.ENTITY_Q.text, help: W.ENTITY_Q.help, list: true, options: W.ENTITIES.map((e) => ({ value: e.id, label: e.name })) },
    FUNCTION: { id: W.FUNCTION_Q.id, text: W.FUNCTION_Q.text, help: W.FUNCTION_Q.help, list: true, options: W.FUNCTIONS.map((f) => ({ value: f.id, label: f.name })) }
  };
  const itemQ = (c, it, i) => ({ id: it.id, num: `${c.letter}${i + 1}`, text: it.text, scale: true,
    options: W.SCALES[c.scale].options.map((label, j) => ({ value: String(j + 1), label })), na: { value: String(W.NA.code), label: W.NA.label } });

  const PAGES = [
    { id: 'welcome', eyebrow: 'Welcome', title: W.SURVEY_TITLE, body: [W.TEXT.intro], facts: W.TEXT.privacy, questions: [Q.CONSENT] },
    { id: 'work', eyebrow: 'About your work', title: 'About your work', body: ['These two answers are used only to group results. Nothing is shown for a group of fewer than 10 people.'], questions: [Q.ENTITY, Q.FUNCTION] }
  ].concat(
    W.CATEGORIES.map((c) => ({ id: c.id, eyebrow: `Section ${c.letter} of F`, section: `Section ${c.letter}`, title: c.name, body: [c.intro], caution: c.caution, questions: c.items.map((it, i) => itemQ(c, it, i)) })),
    [{ id: 'review', eyebrow: 'Review', title: 'Review your answers', review: true }]
  );
  const ALL_Q = PAGES.flatMap((p) => p.questions || []);
  const Q_BY_ID = Object.fromEntries(ALL_Q.map((q) => [q.id, q]));
  const labelOf = (q, v) => (q.na && v === q.na.value ? q.na.label : (q.options.find((o) => o.value === v) || {}).label || '');
  const qName = (q) => (q.num ? `${q.num}. ${q.text}` : q.text);

  const state = { answers: {}, history: [], current: 'welcome', fromReview: false, busy: false, flagged: [] };
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

  function storageNote() {
    if (!store) return 'This browser does not allow the website to save data, so answers cannot be recorded here.';
    return DEMO_MODE
      ? 'Demo mode: your answers are added to the fictional demonstration data on this device, so you can watch the dashboard update. They are not real survey responses and are not sent anywhere.'
      : 'On this website prototype, your answers are saved only in this browser, on this device, so that the results dashboard on this device can include them. They are not sent to any server.';
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
        }).join('')}</dl></section>`).join('')}</div>`;
  }

  function pageHtml(page) {
    if (page.review) return reviewHtml();
    return `<p class="sv-eyebrow">${esc(page.eyebrow)}</p><h1 class="sv-title" id="sv-h" tabindex="-1">${esc(page.title)}</h1>
      ${page.body.map((t) => `<p class="sv-lead">${esc(t)}</p>`).join('')}
      ${page.caution ? `<p class="sv-note">${esc(page.caution)}</p>` : ''}
      ${page.facts ? `<ul class="sv-facts">${page.facts.map((t) => `<li>${esc(t)}</li>`).join('')}</ul><p class="sv-note">${esc(storageNote())}</p>` : ''}
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

  function showSaveError(text) {
    const box = $('sv-errors');
    box.innerHTML = `<h2>Your answers could not be saved</h2><p>${esc(text)}</p>`;
    box.hidden = false;
    box.focus();
  }

  // ---------- endings ----------
  function finish(kind, saved) {
    const thanks = kind === 'thanks';
    $('sv-page').innerHTML = `<p class="sv-eyebrow">${thanks ? 'Submitted' : 'Finished'}</p><h1 class="sv-title" id="sv-h" tabindex="-1">Thank you</h1>
      <p class="sv-lead">${esc(thanks ? W.TEXT.thanks : W.TEXT.declined)}</p>
      ${thanks ? (DEMO_MODE
        ? `<p class="sv-note">Demo mode: your answers were added to the fictional demonstration data on this device (${saved === 1 ? '1 demo response' : `${saved} demo responses`} so far). Open the dashboard to see the counts and charts update.</p>`
        : `<p class="sv-note">Website prototype: your response was saved in this browser only, with an anonymous ID. ${saved === 1 ? '1 response is' : `${saved} responses are`} now stored on this device. Results appear on the dashboard once a group reaches ${W.CONFIG.minGroupSize} responses.</p>`) : ''}
      <div class="sv-end-links"><button type="button" class="sv-btn sv-back" id="sv-again">Start a new response</button>${thanks ? `<a class="sv-btn sv-next" href="./?source=${DEMO_MODE ? 'demo' : 'device'}">See the results dashboard</a>` : ''}</div>`;
    $('sv-nav').hidden = true;
    clearErrors();
    if (thanks) {
      const bar = $('sv-progress');
      bar.setAttribute('aria-valuenow', '100');
      bar.setAttribute('aria-valuetext', 'Survey submitted');
      bar.querySelector('span').style.width = '100%';
      $('sv-count').textContent = 'Submitted';
    }
    state.answers = {};
    state.history = [];
    state.current = null;
    state.fromReview = false;
    state.busy = false;
    $('sv-next').removeAttribute('aria-disabled');
    $('sv-again').addEventListener('click', () => { state.current = 'welcome'; render(true); });
    focusTitle();
  }

  function submit() {
    if (state.busy) return;
    const missing = ALL_Q.filter((q) => state.answers[q.id] == null);
    if (missing.length) { showErrors(missing, true); return; }
    state.busy = true;
    $('sv-next').setAttribute('aria-disabled', 'true');
    let saved;
    try {
      const r = W.makeResponse({ entity: state.answers.ENTITY, function: state.answers.FUNCTION, answers: Object.fromEntries(W.ITEMS.map((it) => [it.id, Number(state.answers[it.id])])) },
        DEMO_MODE ? { period: W.demoPeriod() } : {});
      if (!store) throw new Error('this browser does not allow the website to save data.');
      saved = store.add(r);
    } catch (err) {
      state.busy = false;
      $('sv-next').removeAttribute('aria-disabled');
      showSaveError(`Nothing was saved: ${err.message}`);
      return;
    }
    finish('thanks', saved);
  }

  // ---------- events ----------
  function goTo(id) {
    state.fromReview = true;
    state.current = id;
    render(true);
  }

  function init() {
    if (DEMO_MODE) {
      document.body.classList.add('is-demo');
      $('sv-mode-note').innerHTML = '<strong>Demo mode:</strong> answers join the fictional demonstration data on this device, so you can watch the dashboard update. <a href="./">Results dashboard</a>';
      $('sv-brand').textContent = 'UN Workforce Experience Survey · Demo';
    }
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
      if (page.id === 'welcome' && state.answers.CONSENT !== '1') { finish('declined'); return; } // "No" ends the survey
      if (state.fromReview) { state.fromReview = false; state.current = 'review'; render(true); return; }
      state.history.push(state.current);
      state.current = PAGES[index() + 1].id;
      render(true);
    });
    $('sv-back').addEventListener('click', () => {
      if (state.fromReview) { state.fromReview = false; state.current = 'review'; render(true); return; }
      if (state.history.length) { state.current = state.history.pop(); render(true); }
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
