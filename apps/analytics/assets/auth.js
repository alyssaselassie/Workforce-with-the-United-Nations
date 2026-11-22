// Workplace Relief Map Dashboard: sign-in and the secure results service (Supabase).
// The session is kept in memory only: closing or reloading the page signs you out, and nothing about
// the account is written to the browser's storage.
window.AssessmentAuth = (function () {
  'use strict';
  const cfg = window.ANALYTICS_CONFIG || {};
  const base = String(cfg.supabaseUrl || '').replace(/\/+$/, '');
  const key = String(cfg.supabaseKey || '');
  const fn = String(cfg.resultsFunction || 'assessment-release');
  // https in production; http://localhost or 127.0.0.1 only for the Supabase CLI's local development stack.
  const configured = /^(https:\/\/|http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$))/.test(base) && Boolean(key);
  let session = null;

  const errorText = (body, fallback) => (body && (body.error_description || body.msg || body.message || (typeof body.error === 'string' && body.error !== 'invalid_grant' ? body.error : ''))) || fallback;

  async function call(url, opts) {
    try {
      return await fetch(url, Object.assign({ credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer' }, opts));
    } catch (e) {
      throw new Error('The results service could not be reached. Check your internet connection and try again.');
    }
  }

  async function signIn(email, password) {
    if (!configured) throw new Error('Sign-in is not set up for this dashboard.');
    const res = await call(`${base}/auth/v1/token?grant_type=password`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', apikey: key }, body: JSON.stringify({ email, password })
    });
    let body = {};
    try { body = await res.json(); } catch (e) { body = {}; }
    if (!res.ok || !body.access_token) {
      throw new Error(res.status === 400 || res.status === 401 ? 'The email or password is not correct.' : errorText(body, `Sign-in failed (error ${res.status}).`));
    }
    session = { token: body.access_token, email: (body.user && body.user.email) || email, since: new Date() };
    return session;
  }

  async function fetchRelease() {
    if (!session) throw Object.assign(new Error('Sign in to view results.'), { code: 401 });
    const res = await call(`${base}/functions/v1/${encodeURIComponent(fn)}`, {
      method: 'GET', headers: { Authorization: `Bearer ${session.token}`, apikey: key }
    });
    let body = {};
    try { body = await res.json(); } catch (e) { body = {}; }
    if (res.status === 401) { session = null; throw Object.assign(new Error(errorText(body, 'Your session has expired. Sign in again.')), { code: 401 }); }
    if (res.status === 403) { throw Object.assign(new Error(errorText(body, 'This account is not authorized to view assessment results.')), { code: 403 }); }
    if (!res.ok) throw Object.assign(new Error(errorText(body, `The results service returned an error (${res.status}). Try again later.`)), { code: res.status });
    return body;
  }

  async function signOut() {
    const s = session;
    session = null;
    if (!s || !configured) return;
    try { await call(`${base}/auth/v1/logout`, { method: 'POST', headers: { Authorization: `Bearer ${s.token}`, apikey: key } }); } catch (e) { /* signed out locally anyway */ }
  }

  return { configured, signIn, fetchRelease, signOut, session: () => session };
})();
