// UN Workforce Inclusion & Psychological Safety Assessment: shared page behaviour.
// Works out whether the assessment is connected to the secure database (live) or running as a
// demonstration, shows that on every page, and submits responses.
(function () {
  'use strict';
  const M = window.AssessmentModel;
  const cfg = window.ASSESSMENT_CONFIG || {};
  const params = new URLSearchParams(window.location.search);
  // https in production; http://localhost or 127.0.0.1 only for the Supabase CLI's local development stack.
  const configured = Boolean(cfg.supabaseUrl && cfg.supabaseKey && /^(https:\/\/|http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$))/.test(cfg.supabaseUrl));
  // ?demo=1 always runs a demonstration, even when the database is connected (for presentations).
  const mode = configured && params.get('demo') !== '1' ? 'live' : 'demo';
  document.documentElement.dataset.mode = mode;

  // Keep ?demo=1 on links between the assessment's own pages.
  function keepDemo() {
    if (params.get('demo') !== '1') return;
    document.querySelectorAll('a[href]').forEach((a) => {
      const href = a.getAttribute('href');
      if (!/^[a-z]+\.html(#.*)?$/.test(href) || href.includes('demo=1')) return;
      const [file, hash] = href.split('#');
      a.setAttribute('href', `${file}?demo=1${hash ? `#${hash}` : ''}`);
    });
  }

  function banner() {
    const el = document.getElementById('mode-banner');
    if (!el) return;
    if (mode === 'live') { el.hidden = true; return; }
    el.hidden = false;
    (el.querySelector('.as-wrap') || el).innerHTML = configured
      ? '<p><strong>Demonstration version.</strong> You opened the practice version: answers are not collected. They stay in this browser and are labelled as demonstration data.</p>'
      : '<p><strong>Demonstration version.</strong> This copy of the assessment is not connected to a secure database, so answers are not collected. They stay in this browser and are labelled as demonstration data.</p>';
  }

  // Shows the paragraphs written for the current mode (data-mode-only="live" or "demo").
  function modeText() {
    document.querySelectorAll('[data-mode-only]').forEach((el) => { el.hidden = el.dataset.modeOnly !== mode; });
  }

  async function submitLive(response) {
    const base = cfg.supabaseUrl.replace(/\/+$/, '');
    const headers = { 'Content-Type': 'application/json', apikey: cfg.supabaseKey };
    // Older "anon" keys are tokens and also go in the Authorization header; new publishable keys do not.
    if (/^eyJ/.test(cfg.supabaseKey)) headers.Authorization = `Bearer ${cfg.supabaseKey}`;
    let res;
    try {
      res = await fetch(`${base}/rest/v1/rpc/submit_assessment`, {
        method: 'POST', headers, body: JSON.stringify(M.submissionPayload(response)),
        credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer'
      });
    } catch (e) {
      throw new Error('The secure database could not be reached. Check your internet connection and try again.');
    }
    if (!res.ok) {
      let detail = '';
      try { detail = (await res.json()).message || ''; } catch (e) { detail = ''; }
      throw new Error(detail ? `The database did not accept the response: ${detail}` : `The database did not accept the response (error ${res.status}). Try again in a moment.`);
    }
  }

  function submitDemo(response) {
    let store;
    try { store = M.demoStore(window.localStorage); store.count(); } catch (e) { store = null; }
    if (!store) throw new Error('This browser does not allow the page to save data, so the demonstration answer could not be kept.');
    return store.add(response);
  }

  // Returns a promise. Live: sends the response to the database. Demonstration: keeps it in this
  // browser, in the latest demonstration period.
  function submit(input) {
    if (mode === 'live') {
      const response = M.makeResponse(input);
      return submitLive(response);
    }
    const response = M.makeResponse(input, { period: M.demoPeriod() });
    return Promise.resolve().then(() => submitDemo(response));
  }

  window.AssessmentSite = { mode, configured, submit, demoQuery: params.get('demo') === '1' ? '?demo=1' : '' };
  document.addEventListener('DOMContentLoaded', () => {
    banner();
    modeText();
    keepDemo();
    document.querySelectorAll('.js-count').forEach((el) => { el.textContent = String(M.QUESTION_COUNT); });
    document.querySelectorAll('.js-k').forEach((el) => { el.textContent = String(M.CONFIG.minGroupSize); });
    const year = document.getElementById('year');
    if (year) year.textContent = String(new Date().getFullYear());
  });
})();
