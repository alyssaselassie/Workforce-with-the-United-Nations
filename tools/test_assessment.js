#!/usr/bin/env node
// Tests for the Workplace Relief Map: the shared model, the anonymity rules, the results service logic
// and the separation of the applications. No dependencies. Usage: node tools/test_assessment.js
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
const person = (over) => ({ id: M.responseId(), answers: fullAnswers(over) });
const many = (n, over) => Array.from({ length: n }, () => person(over));
const copy = (x) => JSON.parse(JSON.stringify(x));

(async () => {
  // ---------- 1. The survey: like the Relief Maps Tool worksheet ----------
  check('five physical workplace spaces', M.RELIEF.spaces.map((s) => s.name).join('|') === "Your desk or workstation|Meeting rooms|Your supervisor's office|Kitchen, break room or cafeteria|Hallways, elevators and entrances");
  check('the lines are the worksheet\'s identity dimensions', M.RELIEF.dimensions.map((d) => d.name).join('|') === 'Gender|Age|Religious identity|Ethnicity|Social class');
  check('one question per space and dimension (25)', M.ITEMS.length === 25 && new Set(M.ITEMS.map((it) => `${it.space}/${it.dimension}`)).size === 25);
  check('comfort scale, very comfortable first, plus "prefer not to say"', M.SCALE.options.join('|') === 'Very comfortable|Comfortable|Neither comfortable nor uncomfortable|Uncomfortable|Very uncomfortable' && M.NA.code === 98 && M.answerLabel(98) === 'Prefer not to say or not applicable' && M.answerLabel(1) === 'Very comfortable');
  check('every question has a basis, note and real source', M.ITEMS.every((it) => it.note && it.basis === 'New' && it.sources.every((s) => M.SOURCES[s] && M.SOURCES[s].cite && /^https:\/\//.test(M.SOURCES[s].url))));
  const qs = M.questions().filter((q) => q.type !== 'DB');
  check(`${M.QUESTION_COUNT} questions, all multiple choice`, qs.length === M.QUESTION_COUNT && M.QUESTION_COUNT === 26 && qs.every((q) => q.type === 'MC' && q.options.length >= 2));
  check('consent first, then the spaces in order', qs[0].id === 'CONSENT' && qs.slice(1).map((q) => q.id).join() === M.ITEMS.map((it) => it.id).join());
  check('no department and no question about the respondent', !qs.some((q) => /department|which (gender|age|religion|ethnicity|class)|what is your|your (name|e-?mail|staff id|nationality)\b/i.test(q.text)) && !('DEPARTMENTS' in M));
  check('questions ask only how comfortable, in a physical space', M.ITEMS.every((it) => /^(At|In) [a-z ',-]+, how comfortable do you feel in relation to your [a-z ()]+\?$/.test(it.text)), M.ITEMS.map((it) => it.text).find((t) => !/^(At|In) /.test(t)));
  check('intro states the real question count and about 5 minutes', M.TEXT.intro.includes(`${M.QUESTION_COUNT} multiple-choice questions`) && /about 5 minutes/.test(M.TEXT.intro));
  const unText = [M.TITLE, M.SHORT_TITLE, M.DASHBOARD_TITLE, M.TEXT.intro, M.TEXT.purpose, M.TEXT.thanks, M.TEXT.declined].concat(M.TEXT.privacy, M.TEXT.qualtricsPrivacy, M.qualtricsTxt(), M.codebookCSV()).join(' ');
  check('nothing in the model is labelled UN', !/\bUN\b|United Nations/.test(unText));

  // ---------- 2. Every question is required ----------
  const input = { answers: fullAnswers() };
  check('complete response accepted', !throws(() => M.makeResponse(input)));
  M.ITEMS.forEach((it) => {
    const a = fullAnswers(); delete a[it.id];
    check(`missing ${it.id} rejected`, throws(() => M.makeResponse({ answers: a })));
  });
  check('invalid codes rejected', [0, 6, 1.5, '1', null].every((v) => throws(() => M.makeResponse({ answers: fullAnswers({ RM_DESK_GEN: v }) }))));
  check('"prefer not to say or not applicable" (98) accepted', !throws(() => M.makeResponse({ answers: fullAnswers({ RM_MEET_REL: 98 }) })));
  check('unknown extra answers rejected', M.problems({ id: 'x', answers: fullAnswers({ XX9: 1 }) }).includes('UNKNOWN_ANSWER'));
  const made = M.makeResponse(input);
  check('stores an anonymous ID and the answers only (no department, date or period)', Object.keys(made).sort().join() === 'answers,id' && /^R-[A-Z0-9]{12}$/.test(made.id) && M.responseId() !== M.responseId());
  check('database payload is the answers only', Object.keys(M.submissionPayload(made)).join() === 'p_answers');

  // ---------- 3. One dataset, one map: the anonymity rules ----------
  let rel = M.buildRelease(many(9));
  check('9 responses: nothing shown, not even the count', rel.result.status === 'collecting' && Object.keys(rel.result).join() === 'status');
  rel = M.buildRelease(many(10));
  check('10 responses: the map is shown with every point', rel.result.status === 'published' && rel.result.n === 10 && M.reliefMap(rel.result).shown === 25);
  rel = M.buildRelease(many(9).concat(many(3, { RM_MEET_REL: 98 })));
  check('a point with fewer than 10 comfort answers carries no numbers', rel.result.n === 12 && rel.result.relief.RM_MEET_REL === null && Array.isArray(rel.result.relief.RM_MEET_GEN) && M.reliefMap(rel.result).shown === 24);
  check('incomplete responses are left out', M.buildRelease(many(9).concat([{ id: 'x', answers: { RM_DESK_GEN: 1 } }])).result.status === 'collecting');
  check('threshold cannot be lowered', M.buildRelease(many(6), { minGroupSize: 5 }).minGroupSize === k);
  check('higher threshold respected', M.buildRelease(many(12), { minGroupSize: 15 }).result.status === 'collecting');
  check('point value: average answer, 98 left out', M.reliefValue([1, 0, 0, 0, 1, 5]) === 3 && M.reliefValue([0, 0, 0, 0, 0, 4]) === null);
  const pt = (v) => (M.placeType(v) || { id: null }).id;
  check('kinds of place: to improve, mixed, comfort, neutral, in that order', pt([3, 3.1, 2.9]) === 'improve' && pt([3.5, 3.4, 2.4]) === 'improve' && pt([1.5, 2.6, 2.2]) === 'mixed' && pt([1.8, 1.9, 2]) === 'comfort' && pt([2.3, 2.5, 2.4]) === 'neutral' && pt([1.2, 3.9, null, null, null]) === null);
  check('kinds of place have plain, positive names', M.PLACE_TYPES.map((t) => t.name).join('|') === 'Places to improve|Mixed places|Places of comfort|Neutral places' && M.PLACE_TYPES.every((t) => t.short && t.one && t.rule));

  // Property test: no published result breaks the rules.
  const rand = M.rng(42);
  const bad = [];
  let trials = 0;
  for (let t = 0; t < 300; t += 1) {
    const rs = Array.from({ length: Math.floor(rand() * 30) }, () => person(Object.fromEntries(M.ITEMS.filter(() => rand() < 0.2).map((it) => [it.id, 98]))));
    const r = M.buildRelease(rs);
    trials += 1;
    const c = r.result;
    if (rs.length < k && c.status !== 'collecting') bad.push(`trial ${t}: shown with ${rs.length} responses`);
    if (c.status === 'published') {
      M.ITEMS.forEach((it) => {
        const real = rs.filter((x) => x.answers[it.id] !== 98).length;
        const p = c.relief[it.id];
        if (p && M.answered(p) !== real) bad.push(`trial ${t}: wrong count for ${it.id}`);
        if (p && real < k) bad.push(`trial ${t}: ${it.id} shown with ${real} answers`);
        if (!p && real >= k) bad.push(`trial ${t}: ${it.id} hidden with ${real} answers`);
      });
    }
    try { M.checkRelease(copy(r)); } catch (e) { bad.push(`trial ${t}: release fails its own check: ${e.message}`); }
  }
  check(`property test over ${trials} random datasets`, !bad.length, bad.slice(0, 5).join('; '));

  // ---------- 4. Demonstration data and the release check ----------
  const demo = M.demoResponses();
  rel = M.buildRelease(demo, { source: 'demo' });
  const map = M.reliefMap(rel.result);
  check('demo: one fictional team of 24', demo.length === 24 && rel.result.n === 24 && map.shown === 25);
  check('demo map shows every kind of place', ['improve', 'mixed', 'comfort', 'neutral'].every((id) => Object.values(map.types).some((tp) => tp && tp.id === id)));
  const steps = M.nextSteps(map);
  check('next steps: places to improve, then mixed places, then what works, a team talk and a later check', steps.map((x) => x.kind).join() === 'improve,mixed,comfort,talk,repeat' && steps[0].space === 'MEET' && steps[1].space === 'BREAK' && steps[1].dimension === 'REL', steps.map((x) => `${x.kind}:${x.space || ''}`).join());
  check('next steps name the space and the line with the most discomfort', steps[0].title === 'Meeting rooms: a place to improve' && /^Discomfort here is highest in relation to [a-z ]+ \(\d\.\d\)\. Agree simple meeting habits/.test(steps[0].text) && /^People feel less at ease here in relation to religious identity \(\d\.\d\) than in relation to age \(\d\.\d\)\./.test(steps[1].text) && /comfort at people's desks and workstations/.test(steps[2].text) && /could help in meeting rooms/.test(steps[2].text), steps.slice(0, 3).map((x) => x.text).join(' / '));
  check('next steps are complete sentences in positive language', steps.every((x) => x.title && /\.$/.test(x.text) && !/undefined|NaN|null/.test(x.title + x.text) && !/bias|racis|discriminat|oppress|controvers/i.test(x.title + x.text)));
  check('next steps never ask who answered', /never about who gave which answers/.test(steps.find((x) => x.kind === 'talk').text) && !steps.some((x) => /which (gender|age|religion|ethnicity|class)/i.test(x.text)));
  const calm = { values: Object.fromEntries(M.RELIEF.spaces.map((s) => [s.id, Object.fromEntries(M.RELIEF.dimensions.map((d) => [d.id, 2.4]))])), shown: 25 };
  calm.types = Object.fromEntries(M.RELIEF.spaces.map((s) => [s.id, M.placeType(M.RELIEF.dimensions.map((d) => calm.values[s.id][d.id]))]));
  check('next steps when no space stands out', M.nextSteps(calm).map((x) => x.kind).join() === 'keep,talk,repeat' && M.nextSteps(null).length === 0);
  check('release passes its own check', !throws(() => M.checkRelease(copy(rel))));
  const tamper = (f) => { const x = copy(rel); f(x); return throws(() => M.checkRelease(x)); };
  check('release with a lower threshold refused', tamper((x) => { x.minGroupSize = 3; }));
  check('release with fewer than 10 responses refused', tamper((x) => { x.result.n = 8; }));
  check('release with a point below the minimum refused', tamper((x) => { x.result.relief.RM_DESK_GEN = [2, 2, 2, 1, 1, 16]; }));
  check('release with a point larger than the group refused', tamper((x) => { x.result.relief.RM_DESK_GEN = [20, 20, 0, 0, 0, 0]; }));
  check('release with numbers while collecting refused', tamper((x) => { x.result = { status: 'collecting', n: 8 }; }));
  check('release in another format refused', tamper((x) => { x.format = 'workforce-assessment-release'; }) && tamper((x) => { x.version = 1; }));
  check('release holds no response IDs or individual answers', !/R-[A-Z0-9]{12}|"answers"/.test(JSON.stringify(rel)));

  // ---------- 5. Qualtrics files ----------
  const txt = M.qualtricsTxt();
  check('Qualtrics file has every question', ['CONSENT'].concat(M.ITEMS.map((it) => it.id)).every((id) => txt.includes(`[[ID:${id}]]`)));
  check('Qualtrics file has no text-entry questions and no department', !/Question:TE/.test(txt) && !/DEPARTMENT/.test(txt));
  check('Qualtrics file sets code 98 on every question', (txt.match(/\[\[Choice:98\]\]/g) || []).length === 25);
  check('Qualtrics file: one block per space', M.RELIEF.spaces.every((s, i) => txt.includes(`[[Block:${i + 1}. ${s.name}]]`)));
  check('codebook marks every question required', M.codebookRows().length === 26 && M.codebookRows().every((r) => r.required === 'Yes'));
  const back = M.readExport(M.demoCSV());
  check('demo export reads back in full, labelled as demo', back.responses.length === demo.length && back.incomplete === 0 && back.demo === true);
  check('export round trip gives the same map', JSON.stringify(M.buildRelease(back.responses, { created: 'x' }).result) === JSON.stringify(M.buildRelease(demo, { created: 'x' }).result));
  const lines = M.demoCSV().split('\r\n');
  const header = lines[0].split(',');
  const edit = (line, col, v) => line.split(',').map((x, i) => (header[i] === col ? v : x)).join(',');
  const partial = M.readExport(lines.slice(0, 3).concat(edit(lines[3], 'RM_DESK_AGE', ''), edit(lines[4], 'Finished', '0'), edit(lines[5], 'CONSENT', '2'), edit(lines[6], 'Status', '1'), edit(lines[7], 'RM_HALL_CLS', '7')).join('\r\n'));
  check('export reader leaves out incomplete, declined, preview and invalid rows', partial.responses.length === 0 && partial.incomplete === 3 && partial.declined === 1 && partial.tests === 1);
  check('export reader refuses other files', throws(() => M.readExport('a,b\n1,2\n')));

  // ---------- 6. Demonstration answers in the browser ----------
  const mem = { data: {}, getItem(key) { return key in this.data ? this.data[key] : null; }, setItem(key, v) { this.data[key] = String(v); }, removeItem(key) { delete this.data[key]; } };
  const store = M.demoStore(mem);
  check('demo store starts empty', store.count() === 0);
  check('demo store refuses incomplete responses', throws(() => store.add({ answers: {} })) && store.count() === 0);
  store.add(M.makeResponse(input));
  check('demo store saves and labels demonstration answers', store.count() === 1 && JSON.parse(mem.data[M.CONFIG.demoStorageKey]).demonstration === true);
  check('demo answers join the demonstration map', M.buildRelease(demo.concat(store.all())).result.n === 25);
  store.clear();
  check('demo store can be cleared', store.count() === 0);

  // ---------- 7. The results service (Edge Function logic) ----------
  const { handleRelease, corsHeaders } = await import(path.join(ROOT, 'supabase/functions/assessment-release/release-handler.mjs'));
  const db = demo.map((r) => ({ answers: r.answers }));
  const users = { 'tok-admin': { id: 'u-admin' }, 'tok-staff': { id: 'u-staff' } };
  const svc = (token, extra) => handleRelease(Object.assign({
    token, model: M, pageSize: 10,
    getUser: async (t) => users[t] || null,
    isAdmin: async (id) => id === 'u-admin',
    fetchRows: async (from, to) => db.slice(from, to + 1)
  }, extra || {}));
  check('service: no token -> 401', (await svc('')).status === 401);
  check('service: invalid token -> 401', (await svc('nope')).status === 401);
  check('service: signed in but not an admin -> 403', (await svc('tok-staff')).status === 403);
  const ok = await svc('tok-admin');
  check('service: admin gets the one aggregated map (all pages read)', ok.status === 200 && ok.body.format === M.RELEASE_FORMAT && ok.body.result.n === demo.length);
  check('service: release passes the dashboard check', !throws(() => M.checkRelease(copy(ok.body))));
  check('service: no individual responses or IDs in the reply', !/"answers"|"S\d+"|R-[A-Z0-9]{12}/.test(JSON.stringify(ok.body)));
  check('service: database error -> 500 without details', (await svc('tok-admin', { fetchRows: async () => { throw new Error('secret detail'); } })).body.error.indexOf('secret') < 0);
  check('service: CORS only for listed dashboard origins', corsHeaders('https://a.github.io', ['https://a.github.io'])['Access-Control-Allow-Origin'] === 'https://a.github.io' && !('Access-Control-Allow-Origin' in corsHeaders('https://evil.example', ['https://a.github.io'])));

  // ---------- 8. Generated files and the separation of the applications ----------
  let fresh = true;
  try { execFileSync(process.execPath, [path.join(ROOT, 'tools/build_assessment.js'), '--check'], { stdio: 'pipe' }); } catch (e) { fresh = false; }
  check('generated copies and files are up to date (node tools/build_assessment.js)', fresh);
  const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
  const listFiles = (dir) => fs.readdirSync(path.join(ROOT, dir), { recursive: true }).map(String).filter((f) => /\.(html|js|css|txt|csv|md)$/.test(f)).map((f) => path.join(dir, f));
  const surveyFiles = listFiles('apps/survey');
  const analyticsFiles = listFiles('apps/analytics');
  const own = (files) => files.filter((f) => !/assessment-model\.js$/.test(f));
  check('survey app never links to or names the dashboard', own(surveyFiles).filter((f) => !/README\.md$/.test(f)).every((f) => !/dashboard|analytics/i.test(read(f))));
  check('survey app pages: home, survey, confirmation, privacy', ['index.html', 'survey.html', 'thanks.html', 'privacy.html'].every((p) => fs.existsSync(path.join(ROOT, 'apps/survey', p))));
  check('positive labels: no "oppression" or "controversial" in the survey or the dashboard', surveyFiles.concat(analyticsFiles).every((f) => !/oppression|controversial/i.test(read(f))), surveyFiles.concat(analyticsFiles).filter((f) => /oppression|controversial/i.test(read(f))).join(', '));
  check('no "UN" labels in the survey or the dashboard', surveyFiles.concat(analyticsFiles).every((f) => !/\bUN\b|United Nations/.test(read(f))), surveyFiles.concat(analyticsFiles).filter((f) => /\bUN\b|United Nations/.test(read(f))).join(', '));
  check('apps load nothing from the Navigator', surveyFiles.concat(analyticsFiles).every((f) => !/\.\.\/(script\.js|styles\.css|js\/)/.test(read(f))));
  check('apps are excluded from the Navigator site build', /^exclude:\s*\n(\s+- .+\n)*\s+- apps\/?\s*$/m.test(read('_config.yml')) && /- supabase/.test(read('_config.yml')));
  check('no service-role key or secret in the apps', own(surveyFiles.concat(analyticsFiles)).every((f) => !/service_role|sb_secret_|SERVICE_ROLE_KEY/.test(read(f))));
  const navigator = ['index.html', 'map.html', 'scenarios.html', 'toolkit.html', 'collaboration.html', 'profile.html', 'progress.html', 'script.js'];
  check('the Navigator no longer links to or embeds the survey', navigator.every((f) => !/workforce-survey\/|Workforce Survey|survey\.html|apps\/survey/.test(read(f))));
  check('database schema stores the answers only', /create table if not exists public\.assessment_responses \(\n  id uuid primary key default gen_random_uuid\(\),\n  answers jsonb not null/.test(read('supabase/migrations/20261117000000_workforce_assessment.sql')) && /submit_assessment\(p_answers jsonb\)/.test(read('supabase/migrations/20261117000000_workforce_assessment.sql')));

  console.log(`${passed} passed, ${failures.length} failed`);
  if (failures.length) { failures.forEach((f) => console.log(`FAIL ${f}`)); process.exit(1); }
})();
