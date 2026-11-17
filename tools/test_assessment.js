#!/usr/bin/env node
// Tests for the UN Workforce Inclusion & Psychological Safety Assessment: the shared model, the
// anonymity rules, the results service logic and the separation of the three applications.
// No dependencies. Usage: node tools/test_assessment.js
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const M = require('../apps/shared/assessment-model.js');

const ROOT = path.join(__dirname, '..');
let passed = 0;
const failures = [];
function check(name, ok, detail) {
  if (ok) passed += 1;
  else failures.push(`${name}${detail ? `: ${detail}` : ''}`);
}
const throws = (fn) => { try { fn(); return false; } catch (e) { return true; } };
const k = M.CONFIG.minGroupSize;

const fullAnswers = (over) => Object.assign(Object.fromEntries(M.ITEMS.map((it) => [it.id, 2])), over || {});
const person = (department, period, over) => ({ id: M.responseId(), period: period || '2026-Q4', department, answers: fullAnswers(over) });
const many = (n, department, period, over) => Array.from({ length: n }, () => person(department, period, over));

(async () => {
  // ---------- 1. The instrument ----------
  check('12 departments, in the order given', M.DEPARTMENTS.map((d) => d.name).join('|') === 'Human Resources (HR)|Finance & Accounting|Marketing & Communications|Research & Data Analytics|Information Technology (IT)|Legal & Compliance|Operations & Administration|Programme & Project Management|Policy & Strategy|Humanitarian & Field Operations|Leadership & Management|Other');
  check('one dataset name per department', new Set(M.DEPARTMENTS.map((d) => d.dataset)).size === 12 && M.DEPARTMENT_BY_ID.HR.dataset === 'HR Dataset' && M.DEPARTMENT_BY_ID.OTH.dataset === 'Other Departments Dataset');
  check('six areas A to F, named as given', M.CATEGORIES.map((c) => `${c.letter}. ${c.name}`).join('|') === 'A. Psychological Safety|B. Workplace Inclusion|C. Cross-Cultural Collaboration|D. Leadership & Management|E. Implicit Bias Awareness|F. Organizational Support');
  check('statements per area 6,6,5,6,6,5', M.CATEGORIES.map((c) => c.items.length).join() === '6,6,5,6,6,5');
  check('agreement, frequency and confidence scales all used', new Set(M.CATEGORIES.map((c) => c.scale)).size === 3);
  check('agreement scale in order', M.SCALES.agree.options.join('|') === 'Strongly agree|Agree|Neither agree nor disagree|Disagree|Strongly disagree');
  check('frequency scale in order', M.SCALES.frequency.options.join('|') === 'Always|Often|Sometimes|Rarely|Never');
  check('confidence scale, five points, most confident first', M.SCALES.confidence.options.length === 5 && /^Very confident$/.test(M.SCALES.confidence.options[0]) && /^Not at all confident$/.test(M.SCALES.confidence.options[4]));
  check('one scale per area', M.CATEGORIES.every((c) => c.items.every((it) => it.scale === c.scale)));
  check('every statement has a basis and note; sources exist', M.ITEMS.every((it) => it.note && ['Adapted', 'New'].includes(it.basis) && it.sources.every((s) => M.SOURCES[s])));
  check('every source has a citation and a link', Object.values(M.SOURCES).every((s) => s.cite && /^https:\/\//.test(s.url)));
  const qs = M.questions().filter((q) => q.type !== 'DB');
  check(`${M.QUESTION_COUNT} questions, all multiple choice`, qs.length === M.QUESTION_COUNT && M.QUESTION_COUNT === 36 && qs.every((q) => q.type === 'MC' && q.options.length >= 2));
  check('consent first, then department, then the statements', qs[0].id === 'CONSENT' && qs[1].id === 'DEPARTMENT' && qs[2].id === 'PS1');
  check('the only question about the respondent is the department; no identifiers asked', qs.filter((q) => !M.ITEM_BY_ID[q.id]).map((q) => q.id).join() === 'CONSENT,DEPARTMENT' && !qs.some((q) => /\byour (name|e-?mail|staff id|duty station|entity|age|gender|nationality)\b/i.test(q.text)));
  check('intro states the real question count', M.TEXT.intro.includes(`${M.QUESTION_COUNT} multiple-choice questions`));

  // ---------- 2. Every question is required ----------
  const input = { department: 'HUM', answers: fullAnswers() };
  check('complete response accepted', !throws(() => M.makeResponse(input, { date: '2026-11-16T12:00:00Z' })));
  check('missing department rejected', throws(() => M.makeResponse(Object.assign({}, input, { department: null }))));
  check('unknown department rejected', throws(() => M.makeResponse(Object.assign({}, input, { department: 'XYZ' }))));
  M.ITEMS.forEach((it) => {
    const a = fullAnswers(); delete a[it.id];
    check(`missing ${it.id} rejected`, throws(() => M.makeResponse(Object.assign({}, input, { answers: a }))));
  });
  check('invalid code rejected', throws(() => M.makeResponse(Object.assign({}, input, { answers: fullAnswers({ PS1: 7 }) }))));
  check('"don\'t know or not applicable" (98) accepted', !throws(() => M.makeResponse(Object.assign({}, input, { answers: fullAnswers({ CC3: 98 }) }))));
  check('unknown extra answers rejected by the validator', M.problems({ id: 'x', period: '2026-Q4', department: 'HR', answers: fullAnswers({ XX9: 1 }) }).includes('UNKNOWN_ANSWER'));
  const made = M.makeResponse(input, { date: '2026-11-16T12:00:00Z' });
  check('stores department, period and answers only', Object.keys(made).sort().join() === 'answers,department,id,period' && made.period === '2026-Q4');
  check('anonymous response ID', /^R-[A-Z0-9]{12}$/.test(made.id) && M.responseId() !== M.responseId());
  check('database payload has no ID or period (the database assigns the period)', Object.keys(M.submissionPayload(made)).sort().join() === 'p_answers,p_department');
  check('period labels (UTC)', M.periodLabel('2026-Q4') === 'Q4 2026 (Oct–Dec)' && M.periodOf('2026-03-31T12:00:00Z') === '2026-Q1' && M.periodOf('2026-04-01T00:30:00Z') === '2026-Q2');

  // ---------- 3. Separate datasets ----------
  const mixed = many(12, 'HR').concat(many(11, 'IT'), many(3, 'LEG'));
  const ds = M.datasets(mixed);
  check('one dataset per department', Object.keys(ds.byDepartment).length === 12);
  check('department datasets hold only their department', Object.entries(ds.byDepartment).every(([id, rs]) => rs.every((r) => r.department === id)));
  check('department datasets add up to the overall dataset', Object.values(ds.byDepartment).reduce((a, rs) => a + rs.length, 0) === ds.overall.length);
  const rows = M.longRows(mixed.slice(0, 1));
  check('long rows: department, period, question, area, answer', rows.length === 34 && ['response_id', 'department', 'period', 'question_id', 'category', 'answer_code', 'answer'].every((c) => c in rows[0]));

  // ---------- 4. Threshold and suppression ----------
  let rel = M.buildRelease(many(9, 'HR'));
  check('9 responses: nothing shown', rel.data['2026-Q4'].overall.status === 'collecting' && rel.data['2026-Q4'].departments.HR.status === 'collecting');
  rel = M.buildRelease(many(10, 'HR'));
  check('10 responses: department and overall shown', rel.data['2026-Q4'].overall.n === 10 && rel.data['2026-Q4'].departments.HR.n === 10);
  rel = M.buildRelease(many(20, 'HR').concat(many(12, 'IT'), many(4, 'LEG')));
  let d = rel.data['2026-Q4'];
  check('small department hidden', d.departments.LEG.status === 'collecting');
  check('smallest shown department withheld to protect it', d.departments.IT.status === 'protected' && d.departments.HR.status === 'published');
  check('hidden groups carry no numbers, not even their size', ['LEG', 'IT', 'FIN'].every((id) => Object.keys(d.departments[id]).join() === 'status'));
  rel = M.buildRelease(many(20, 'HR').concat(many(6, 'IT'), many(5, 'LEG')));
  d = rel.data['2026-Q4'];
  check('two small departments together (11) need no extra withholding', d.departments.HR.status === 'published' && d.departments.IT.status === 'collecting' && d.departments.LEG.status === 'collecting');
  check('threshold cannot be lowered', M.buildRelease(many(6, 'HR'), { minGroupSize: 5 }).minGroupSize === k);
  check('higher threshold respected', M.buildRelease(many(12, 'HR'), { minGroupSize: 15 }).data['2026-Q4'].departments.HR.status === 'collecting');
  rel = M.buildRelease(many(10, 'HR', '2026-Q3').concat(many(10, 'HR', '2026-Q4')));
  check('each period released separately', rel.periods.join() === '2026-Q3,2026-Q4' && rel.data['2026-Q3'].departments.HR.n === 10 && rel.data['2026-Q4'].departments.HR.n === 10);
  const one = M.aggregate(many(10, 'HR', '2026-Q4', { PS1: 1 }));
  check('scores: favourable share and interval', one.scores.PS.favourable === 1 && one.scores.PS.lo != null && one.items.PS1[0] === 10);
  check('area E: less often is favourable', M.polarity('IB').favourable.join() === '4,5' && M.favourableWords('IB') === '"Rarely" or "Never"');
  check('confidence area favourable = very or fairly confident', M.favourableWords('CC') === '"Very confident" or "Fairly confident"');

  // ---------- 5. Property test: no combination of shown results reveals a small group ----------
  const rand = M.rng(42);
  let trials = 0;
  const violations = [];
  for (let t = 0; t < 400; t += 1) {
    const rs = [];
    M.DEPARTMENTS.forEach((dep) => { if (rand() < 0.75) rs.push(...many(Math.floor(rand() * 18), dep.id)); });
    const dd = M.buildRelease(rs).data['2026-Q4'];
    if (!dd) continue;
    trials += 1;
    const n = (id) => rs.filter((x) => x.department === id).length;
    const shown = (c) => c.status === 'published';
    const cells = [dd.overall].concat(Object.values(dd.departments));
    if (cells.some((c) => shown(c) && c.n < k)) violations.push(`trial ${t}: shown group below ${k}`);
    if (cells.some((c) => !shown(c) && Object.keys(c).length !== 1)) violations.push(`trial ${t}: hidden group carries numbers`);
    if (shown(dd.overall)) {
      const rest = M.DEPARTMENTS.filter((dep) => !shown(dd.departments[dep.id])).reduce((a, dep) => a + n(dep.id), 0);
      if (rest > 0 && rest < k) violations.push(`trial ${t}: overall minus shown departments = ${rest}`);
      M.DEPARTMENTS.forEach((dep) => { if (shown(dd.departments[dep.id]) && dd.departments[dep.id].n !== n(dep.id)) violations.push(`trial ${t}: wrong n for ${dep.id}`); });
    } else if (M.DEPARTMENTS.some((dep) => shown(dd.departments[dep.id]))) violations.push(`trial ${t}: department shown while the overall group is hidden`);
    try { M.checkRelease(JSON.parse(JSON.stringify(M.buildRelease(rs)))); } catch (e) { violations.push(`trial ${t}: release fails its own check: ${e.message}`); }
  }
  check(`property test over ${trials} random datasets`, trials > 300 && !violations.length, violations.slice(0, 5).join('; '));

  // ---------- 6. Demonstration data and release files ----------
  const demo = M.demoResponses();
  rel = M.buildRelease(demo, { source: 'demo' });
  const q4 = rel.data['2026-Q4'];
  check('demo covers three periods', rel.periods.join() === '2026-Q2,2026-Q3,2026-Q4');
  check('demo shows every case: shown, collecting, withheld', q4.departments.HUM.status === 'published' && q4.departments.LEG.status === 'collecting' && q4.departments.LEAD.status === 'protected');
  const unlocked = M.buildRelease(demo.concat(Array.from({ length: M.DEMO.unlock.needed }, () => M.makeResponse({ department: 'LEG', answers: fullAnswers() }, { period: M.demoPeriod() }))));
  check('live demo: two Legal & Compliance answers unlock it and Leadership & Management', unlocked.data['2026-Q4'].departments.LEG.n === 10 && unlocked.data['2026-Q4'].departments.LEAD.status === 'published');
  check('release passes its own check', !throws(() => M.checkRelease(JSON.parse(JSON.stringify(rel)))));
  const tamper = (f) => { const x = JSON.parse(JSON.stringify(rel)); f(x); return throws(() => M.checkRelease(x)); };
  check('release with a lower threshold refused', tamper((x) => { x.minGroupSize = 3; }));
  check('release with a small shown group refused', tamper((x) => { x.data['2026-Q4'].departments.LEG = { status: 'published', n: 8, items: {}, scores: {} }; }));
  check('release with numbers on a hidden group refused', tamper((x) => { x.data['2026-Q4'].departments.LEG = { status: 'collecting', n: 8 }; }));
  check('release that allows subtraction refused', tamper((x) => { x.data['2026-Q4'].departments.LEAD = Object.assign({ status: 'published' }, M.aggregate(demo.filter((r) => r.period === '2026-Q4' && r.department === 'LEAD'))); }));
  check('release with another format refused', tamper((x) => { x.format = 'workforce-survey-release'; }));
  const json = JSON.stringify(rel);
  check('release holds no response IDs', !/R-[A-Z0-9]{12}/.test(json));
  const csvRows = M.releaseRows(rel);
  check('aggregated CSV: hidden groups have no numbers', csvRows.filter((r) => r.status !== 'shown').every((r) => r.count === '' && r.group_n === ''));
  check('aggregated CSV: percentages add to 100 per question', (() => {
    const g = csvRows.filter((r) => r.status === 'shown' && r.department === 'Humanitarian & Field Operations' && r.period === '2026-Q4' && r.question_id === 'PS1' && r.answer_code !== 98);
    return Math.abs(g.reduce((a, r) => a + r.percent, 0) - 100) < 0.6;
  })());

  // ---------- 7. Qualtrics files ----------
  const txt = M.qualtricsTxt();
  check('Qualtrics file has every question', ['CONSENT', 'DEPARTMENT'].concat(M.ITEMS.map((it) => it.id)).every((id) => txt.includes(`[[ID:${id}]]`)));
  check('Qualtrics file has no text-entry questions', !/Question:TE/.test(txt));
  check('Qualtrics file sets code 98 on every statement', (txt.match(/\[\[Choice:98\]\]/g) || []).length === 34);
  check('codebook marks every question required', M.codebookRows().every((r) => r.required === 'Yes'));
  const back = M.readExport(M.demoCSV());
  check('demo export reads back in full, labelled as demo', back.responses.length === demo.length && back.incomplete === 0 && back.demo === true);
  check('export round trip gives the same results', JSON.stringify(M.buildRelease(back.responses, { source: 'demo' }).data) === JSON.stringify(rel.data));
  const lines = M.demoCSV().split('\r\n');
  const header = lines[0].split(',');
  const edit = (line, col, v) => line.split(',').map((x, i) => (header[i] === col ? v : x)).join(',');
  const partial = M.readExport(lines.slice(0, 3).concat(edit(lines[3], 'PS3', ''), edit(lines[4], 'Finished', '0'), edit(lines[5], 'CONSENT', '2'), edit(lines[6], 'Status', '1'), edit(lines[7], 'DEPARTMENT', '13')).join('\r\n'));
  check('export reader leaves out incomplete, declined, preview and invalid rows', partial.responses.length === 0 && partial.incomplete === 3 && partial.declined === 1 && partial.tests === 1);
  check('export reader refuses other files', throws(() => M.readExport('a,b\n1,2\n')));

  // ---------- 8. Demonstration answers in the browser ----------
  const mem = { data: {}, getItem(key) { return key in this.data ? this.data[key] : null; }, setItem(key, v) { this.data[key] = String(v); }, removeItem(key) { delete this.data[key]; } };
  const store = M.demoStore(mem);
  check('demo store starts empty', store.count() === 0);
  check('demo store refuses incomplete responses', throws(() => store.add({ department: 'HR', period: '2026-Q4', answers: {} })) && store.count() === 0);
  store.add(M.makeResponse(input, { period: M.demoPeriod() }));
  check('demo store saves and labels demonstration answers', store.count() === 1 && JSON.parse(mem.data[M.CONFIG.demoStorageKey]).demonstration === true);
  check('demo answers use the latest demonstration period', store.all()[0].period === '2026-Q4');
  store.clear();
  check('demo store can be cleared', store.count() === 0);
  check('the model defines no browser storage for real responses', !('storageKey' in M.CONFIG));

  // ---------- 9. The results service (Edge Function logic) ----------
  const { handleRelease, corsHeaders } = await import(path.join(ROOT, 'supabase/functions/assessment-release/release-handler.mjs'));
  const db = demo.map((r) => ({ period: r.period, department: r.department, answers: r.answers }));
  const users = { 'tok-admin': { id: 'u-admin' }, 'tok-staff': { id: 'u-staff' } };
  const svc = (token, extra) => handleRelease(Object.assign({
    token, model: M, pageSize: 50,
    getUser: async (t) => users[t] || null,
    isAdmin: async (id) => id === 'u-admin',
    fetchRows: async (from, to) => db.slice(from, to + 1)
  }, extra || {}));
  check('service: no token -> 401', (await svc('')).status === 401);
  check('service: invalid token -> 401', (await svc('nope')).status === 401);
  check('service: signed in but not an admin -> 403', (await svc('tok-staff')).status === 403);
  const ok = await svc('tok-admin');
  check('service: admin gets the aggregated release (all pages read)', ok.status === 200 && ok.body.format === M.RELEASE_FORMAT && ok.body.data['2026-Q4'].overall.n === demo.filter((r) => r.period === '2026-Q4').length);
  check('service: release passes the dashboard check', !throws(() => M.checkRelease(JSON.parse(JSON.stringify(ok.body)))));
  check('service: no individual responses or IDs in the reply', !/"answers":\{|"S\d+"|R-[A-Z0-9]{12}|"department":"/.test(JSON.stringify(ok.body)));
  check('service: database error -> 500 without details', (await svc('tok-admin', { fetchRows: async () => { throw new Error('secret detail'); } })).body.error.indexOf('secret') < 0);
  check('service: CORS only for listed dashboard origins', corsHeaders('https://a.github.io', ['https://a.github.io'])['Access-Control-Allow-Origin'] === 'https://a.github.io' && !('Access-Control-Allow-Origin' in corsHeaders('https://evil.example', ['https://a.github.io'])));

  // ---------- 10. Generated files and the separation of the three applications ----------
  let fresh = true;
  try { execFileSync(process.execPath, [path.join(ROOT, 'tools/build_assessment.js'), '--check'], { stdio: 'pipe' }); } catch (e) { fresh = false; }
  check('generated copies and files are up to date (node tools/build_assessment.js)', fresh);
  const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
  const listFiles = (dir) => fs.readdirSync(path.join(ROOT, dir), { recursive: true }).map(String).filter((f) => /\.(html|js|css|txt|csv)$/.test(f)).map((f) => path.join(dir, f));
  const surveyFiles = listFiles('apps/survey');
  const analyticsFiles = listFiles('apps/analytics');
  const own = (files) => files.filter((f) => !/assessment-model\.js$/.test(f));
  check('survey app never links to or names the dashboard', own(surveyFiles).every((f) => !/dashboard|analytics/i.test(read(f))), own(surveyFiles).filter((f) => /dashboard|analytics/i.test(read(f))).join(', '));
  check('survey app pages: home, survey, confirmation, privacy', ['index.html', 'survey.html', 'thanks.html', 'privacy.html'].every((p) => fs.existsSync(path.join(ROOT, 'apps/survey', p))));
  check('apps load nothing from the Navigator', surveyFiles.concat(analyticsFiles).every((f) => !/\.\.\/(script\.js|styles\.css|js\/)/.test(read(f))));
  check('apps are excluded from the Navigator site build', /^exclude:\s*\n(\s+- .+\n)*\s+- apps\/?\s*$/m.test(read('_config.yml')) && /- supabase/.test(read('_config.yml')));
  check('no service-role key or secret in the apps', own(surveyFiles.concat(analyticsFiles)).every((f) => !/service_role|sb_secret_|SERVICE_ROLE_KEY/.test(read(f))));
  const navigator = ['index.html', 'map.html', 'scenarios.html', 'toolkit.html', 'collaboration.html', 'profile.html', 'progress.html', 'script.js'];
  check('the Navigator no longer links to or embeds the survey', navigator.every((f) => !/workforce-survey\/|Workforce Survey|survey\.html|apps\/survey/.test(read(f))));

  console.log(`${passed} passed, ${failures.length} failed`);
  if (failures.length) { failures.forEach((f) => console.log(`FAIL ${f}`)); process.exit(1); }
})();
