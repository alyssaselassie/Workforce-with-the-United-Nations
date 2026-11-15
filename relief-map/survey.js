// Relief Maps survey preview: the same questions, order and logic as the Qualtrics survey, on one
// mobile-first page. Nothing is saved or sent.
(function () {
  'use strict';
  const RM = window.ReliefMap;
  const $ = (id) => document.getElementById(id);
  const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const after = (text, start) => (text.startsWith(start) ? text.slice(start.length) : text).trim();

  let answers = {}, history = [], current = 'welcome';

  const choice = (q, required) => ({ id: q.id, text: q.question, options: q.options, required });
  const agree = (it) => ({ id: it.id, text: it.text, options: RM.SCALE });

  // The pages, in order. `show` is the display logic: the identity page only follows a "Yes".
  const PAGES = [
    { id: 'welcome', eyebrow: 'Welcome', title: RM.SURVEY_TITLE, body: [RM.TEXT.intro],
      facts: RM.TEXT.privacy.split(/\.\s+/).map((s, i, a) => (i < a.length - 1 ? `${s}.` : s)), questions: [choice(RM.CONSENT, true)] }
  ].concat(RM.SETTINGS.map((s, i) => ({
    id: s.id, eyebrow: `${i + 1} of ${RM.SETTINGS.length}`, title: s.label, body: [`${s.intro} How much do you agree?`],
    questions: RM.MEASURES.map((m) => agree(RM.ITEMS.find((it) => it.id === `${s.id}_${m.id}`)))
  })), [
    { id: 'overall', eyebrow: 'Almost done', title: 'Your workplace overall', body: ['How much do you agree?'], questions: RM.OVERALL.map(agree) },
    { id: 'about', eyebrow: 'Optional', title: 'About you', body: [after(RM.TEXT.about, 'About you (optional).')], questions: [choice(RM.ABOUT_YOU)] },
    { id: 'identity', eyebrow: 'Optional', title: 'About you', body: ['Choose the answer that fits best, or skip any question.'], questions: RM.IDENTITY.map((q) => choice(q)), show: () => answers[RM.ABOUT_YOU.id] === 0 },
    { id: 'ideas', eyebrow: 'Optional', title: 'Your ideas', body: [after(RM.TEXT.ideas, 'Your ideas (optional).')], questions: RM.REFLECTION.map((r) => ({ id: r.id, text: r.question, essay: true })) }
  ]);
  const visible = () => PAGES.filter((p) => !p.show || p.show());

  function questionHtml(q) {
    if (q.essay) return `<div class="sv-q"><label class="sv-q-text" for="f-${q.id}">${esc(q.text)}</label><textarea id="f-${q.id}" name="${q.id}" rows="4">${esc(answers[q.id] || '')}</textarea></div>`;
    return `<fieldset class="sv-q" id="q-${q.id}"${q.required ? ' aria-required="true"' : ''}><legend class="sv-q-text">${esc(q.text)}${q.required ? ' <span class="sv-req">Required</span>' : ''}</legend>
      <div class="sv-options">${q.options.map((o, i) => `<label class="sv-opt"><input type="radio" name="${q.id}" value="${i}"${answers[q.id] === i ? ' checked' : ''}${q.required ? ' required' : ''}><span class="sv-dot" aria-hidden="true"></span><span>${esc(o)}</span></label>`).join('')}</div></fieldset>`;
  }

  function progress(pct) {
    const bar = $('sv-progress');
    bar.setAttribute('aria-valuenow', String(pct));
    bar.setAttribute('aria-valuetext', `${pct}% complete`);
    bar.querySelector('span').style.width = `${pct}%`;
  }

  function focusTitle() {
    window.scrollTo(0, 0);
    $('sv-h').focus({ preventScroll: true });
  }

  function render(moveFocus) {
    const pages = visible();
    const i = pages.findIndex((p) => p.id === current);
    const page = pages[i];
    $('sv-page').innerHTML = `<p class="sv-eyebrow">${esc(page.eyebrow)}</p><h1 class="sv-title" id="sv-h" tabindex="-1">${esc(page.title)}</h1>
      ${page.body.map((t) => `<p class="sv-lead">${esc(t)}</p>`).join('')}
      ${page.facts ? `<ul class="sv-facts">${page.facts.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
      <div class="sv-questions">${page.questions.map(questionHtml).join('')}</div>`;
    $('sv-error').hidden = true;
    $('sv-nav').hidden = false;
    $('sv-back').hidden = i === 0;
    $('sv-next').textContent = i === pages.length - 1 ? 'Submit' : 'Next';
    progress(Math.round((i / pages.length) * 100));
    if (moveFocus) focusTitle();
  }

  function finish(text) {
    $('sv-page').innerHTML = `<p class="sv-eyebrow">Finished</p><h1 class="sv-title" id="sv-h" tabindex="-1">Thank you</h1><p class="sv-lead">${esc(text)}</p>
      <p class="sv-note">This was a preview: nothing was saved.</p>
      <div class="sv-end-links"><button type="button" class="sv-btn sv-back" id="sv-again">Start again</button><a class="sv-btn sv-next" href="./">See the Relief Map</a></div>`;
    $('sv-nav').hidden = true;
    $('sv-error').hidden = true;
    progress(100);
    $('sv-again').addEventListener('click', () => { answers = {}; history = []; current = 'welcome'; render(true); });
    focusTitle();
  }

  function init() {
    render(false);
    const form = $('sv-form');
    form.addEventListener('change', (e) => {
      if (e.target.type !== 'radio') return;
      answers[e.target.name] = Number(e.target.value);
      const fs = e.target.closest('fieldset');
      if (fs.getAttribute('aria-invalid')) { fs.removeAttribute('aria-invalid'); $('sv-error').hidden = true; }
    });
    form.addEventListener('input', (e) => { if (e.target.tagName === 'TEXTAREA') answers[e.target.name] = e.target.value; });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (current === 'welcome') {
        const c = answers[RM.CONSENT.id];
        if (c == null) {
          const fs = $(`q-${RM.CONSENT.id}`);
          $('sv-error').textContent = 'Please choose an answer to continue.';
          $('sv-error').hidden = false;
          fs.setAttribute('aria-invalid', 'true');
          fs.setAttribute('aria-describedby', 'sv-error');
          fs.querySelector('input').focus();
          return;
        }
        if (c === 1) { finish(RM.TEXT.declined); return; } // consent branch: "No" ends the survey
      }
      const pages = visible();
      const i = pages.findIndex((p) => p.id === current);
      if (i === pages.length - 1) { finish(RM.TEXT.thanks); return; }
      history.push(current);
      current = pages[i + 1].id;
      render(true);
    });
    $('sv-back').addEventListener('click', () => { if (history.length) { current = history.pop(); render(true); } });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
