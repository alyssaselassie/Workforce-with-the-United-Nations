#!/usr/bin/env node
// Tests for the workforce survey model and its anonymity rules. No dependencies.
// Usage: node tools/test_workforce_survey.js
'use strict';
const W = require('../workforce-survey/workforce-survey.js');

let passed = 0;
const failures = [];
function check(name, ok, detail) {
  if (ok) passed += 1;
  else failures.push(`${name}${detail ? `: ${detail}` : ''}`);
}
const throws = (fn) => { try { fn(); return false; } catch (e) { return true; } };
const k = W.CONFIG.minGroupSize;

// A complete set of answers (every statement "Agree"), optionally changed.
const fullAnswers = (over) => Object.assign(Object.fromEntries(W.ITEMS.map((it) => [it.id, 2])), over || {});
const person = (entity, func, period, over) => ({ id: W.responseId(), period: period || '2026-Q4', entity, function: func, answers: fullAnswers(over) });
const many = (n, entity, func, period, over) => Array.from({ length: n }, () => person(entity, func, period, over));

// ---------- 1. The instrument ----------
check('14 entities, in the order given', W.ENTITIES.map((e) => e.id).join() === 'DPPA,DPO,OCHA,UNDP,UNICEF,UNHCR,WFP,WHO,DMSPC,DOS,OHCHR,UNWOMEN,OLA,OTHER');
check('entity names as given', W.ENTITIES[4].name === "United Nations Children's Fund (UNICEF)" && W.ENTITIES[13].name === 'Other UN entity or office' && W.ENTITIES[11].name === 'UN Women');
check('one dataset name per entity', W.ENTITIES.map((e) => e.dataset).join('|').includes('UN Women Dataset') && W.ENTITIES[13].dataset === 'Other Entities Dataset');
check('10 professional functions', W.FUNCTIONS.length === 10 && W.FUNCTIONS[0].name === 'Humanitarian / Field Operations' && W.FUNCTIONS[9].name === 'Other');
check('six categories A to F', W.CATEGORIES.map((c) => c.letter + c.id).join() === 'APS,BIN,CCC,DLM,EIB,FOS');
check('items per category 6,6,5,6,6,5', W.CATEGORIES.map((c) => c.items.length).join() === '6,6,5,6,6,5');
check('agreement scale in the order given', W.SCALES.agree.options.join('|') === 'Strongly agree|Agree|Neither agree nor disagree|Disagree|Strongly disagree');
check('frequency scale in the order given', W.SCALES.frequency.options.join('|') === 'Always|Often|Sometimes|Rarely|Never');
check('one scale per category', W.CATEGORIES.every((c) => c.items.every((it) => it.scale === c.scale)));
check('every item has a source note and basis', W.ITEMS.every((it) => it.note && ['Adapted', 'New'].includes(it.basis) && it.sources.every((s) => W.SOURCES[s])));
check('every cited source has a full citation and link', Object.values(W.SOURCES).every((s) => s.cite && /^https:\/\//.test(s.url)));
const qs = W.questions().filter((q) => q.type !== 'DB');
check('37 questions, all multiple choice', qs.length === 37 && qs.every((q) => q.type === 'MC'));
check('entity and function come before the statements', qs[1].id === 'ENTITY' && qs[2].id === 'FUNCTION');

// ---------- 2. Every question is required ----------
const input = { entity: 'OCHA', function: 'HUM', answers: fullAnswers() };
check('complete response is accepted', !throws(() => W.makeResponse(input, { date: '2026-11-16' })));
check('missing entity is rejected', throws(() => W.makeResponse(Object.assign({}, input, { entity: null }))));
check('missing function is rejected', throws(() => W.makeResponse(Object.assign({}, input, { function: '' }))));
check('unknown entity is rejected', throws(() => W.makeResponse(Object.assign({}, input, { entity: 'XYZ' }))));
W.ITEMS.forEach((it) => {
  const a = fullAnswers(); delete a[it.id];
  check(`missing ${it.id} is rejected`, throws(() => W.makeResponse(Object.assign({}, input, { answers: a }))));
});
check('invalid answer code is rejected', throws(() => W.makeResponse(Object.assign({}, input, { answers: fullAnswers({ PS1: 7 }) }))));
check('"don\'t know or not applicable" (98) is a valid answer', !throws(() => W.makeResponse(Object.assign({}, input, { answers: fullAnswers({ CC2: 98 }) }))));
const made = W.makeResponse(input, { date: new Date(2026, 10, 16) });
check('stores the reporting period, not the date', made.period === '2026-Q4' && !('date' in made) && Object.keys(made).sort().join() === 'answers,entity,function,id,period');
check('anonymous response ID', /^R-[A-Z0-9]{12}$/.test(made.id));
check('two IDs differ', W.responseId() !== W.responseId());
check('period labels', W.periodLabel('2026-Q4') === 'Q4 2026 (Oct–Dec)' && W.periodOf('2026-03-31T12:00') === '2026-Q1');

// ---------- 3. Separate datasets ----------
const mixed = many(12, 'OCHA', 'HUM').concat(many(11, 'UNDP', 'PRG'), many(3, 'OLA', 'LEG'));
const ds = W.datasets(mixed);
check('one dataset per entity', Object.keys(ds.byEntity).length === 14);
check('entity datasets hold only their entity', Object.entries(ds.byEntity).every(([id, rs]) => rs.every((r) => r.entity === id)));
check('entity datasets add up to the overall dataset', Object.values(ds.byEntity).reduce((a, rs) => a + rs.length, 0) === ds.overall.length);
const rows = W.longRows(mixed.slice(0, 1));
check('long rows carry entity, function, question, category, answer and period', rows.length === 34 && ['response_id', 'entity', 'function', 'period', 'question_id', 'category', 'answer_code', 'answer'].every((c) => c in rows[0]));
check('long row category matches the question', rows.every((r) => W.ITEM_BY_ID[r.question_id].category === r.category));

// ---------- 4. Threshold ----------
let rel = W.buildRelease(many(9, 'OCHA', 'HUM'));
check('9 responses: nothing shown', rel.data['2026-Q4'].overall.status === 'collecting' && rel.data['2026-Q4'].entities.OCHA.status === 'collecting');
rel = W.buildRelease(many(10, 'OCHA', 'HUM'));
check('10 responses: entity and overall shown', rel.data['2026-Q4'].overall.status === 'published' && rel.data['2026-Q4'].entities.OCHA.n === 10);
check('10 responses, one function: function group shown', rel.data['2026-Q4'].functions.OCHA.HUM.n === 10);
rel = W.buildRelease(many(12, 'OCHA', 'HUM').concat(many(9, 'OCHA', 'PRG'), many(15, 'UNDP', 'PRG')));
const q4 = rel.data['2026-Q4'];
check('threshold applies to the filtered group (OCHA x PRG = 9 hidden)', q4.functions.OCHA.PRG.status !== 'published');
check('OCHA x HUM withheld too, or OCHA - HUM would reveal the 9', q4.functions.OCHA.HUM.status === 'protected');
check('withheld groups carry no numbers', Object.keys(q4.functions.OCHA.HUM).join() === 'status' && Object.keys(q4.functions.OCHA.PRG).join() === 'status');
check('threshold cannot be lowered', W.buildRelease(many(6, 'OCHA', 'HUM'), { minGroupSize: 5 }).minGroupSize === k);
check('custom higher threshold respected', W.buildRelease(many(12, 'OCHA', 'HUM'), { minGroupSize: 15 }).data['2026-Q4'].entities.OCHA.status === 'collecting');

// Entity-level secondary suppression: overall minus shown entities must not reveal a small group.
rel = W.buildRelease(many(20, 'OCHA', 'HUM').concat(many(12, 'UNDP', 'PRG'), many(4, 'OLA', 'LEG')));
let d = rel.data['2026-Q4'];
check('small entity hidden', d.entities.OLA.status === 'collecting');
check('smallest shown entity withheld to protect it', d.entities.UNDP.status === 'protected' && d.entities.OCHA.status === 'published');
check('functions of a withheld entity are withheld', Object.values(d.functions.UNDP).every((c) => c.status === 'protected'));

// Periods are separate: no result mixes periods.
rel = W.buildRelease(many(10, 'OCHA', 'HUM', '2026-Q3').concat(many(10, 'OCHA', 'HUM', '2026-Q4')));
check('each period released separately', rel.periods.join() === '2026-Q3,2026-Q4' && rel.data['2026-Q3'].entities.OCHA.n === 10 && rel.data['2026-Q4'].entities.OCHA.n === 10);

// ---------- 5. Property test: no combination of shown results reveals a small group ----------
const rand = W.rng(42);
let trials = 0, violations = [];
for (let t = 0; t < 300; t += 1) {
  const rs = [];
  W.ENTITIES.forEach((e) => {
    if (rand() < 0.3) return;
    W.FUNCTIONS.forEach((f) => { if (rand() < 0.35) rs.push(...many(Math.floor(rand() * 16), e.id, f.id)); });
  });
  const r2 = W.buildRelease(rs);
  const dd = r2.data['2026-Q4'];
  if (!dd) continue;
  trials += 1;
  const n = (e, f) => rs.filter((x) => x.entity === e && (!f || x.function === f)).length;
  const shown = (c) => c.status === 'published';
  const cells = [dd.overall].concat(Object.values(dd.entities), Object.values(dd.functions).flatMap((x) => Object.values(x)), Object.values(dd.orgFunctions));
  if (cells.some((c) => shown(c) && c.n < k)) violations.push(`trial ${t}: shown group below ${k}`);
  if (cells.some((c) => !shown(c) && Object.keys(c).length !== 1)) violations.push(`trial ${t}: hidden group carries numbers`);
  if (shown(dd.overall)) {
    const rest = W.ENTITIES.filter((e) => !shown(dd.entities[e.id])).reduce((a, e) => a + n(e.id), 0);
    if (rest > 0 && rest < k) violations.push(`trial ${t}: overall minus shown entities = ${rest}`);
  }
  W.ENTITIES.forEach((e) => {
    if (!shown(dd.entities[e.id])) { if (W.FUNCTIONS.some((f) => shown(dd.functions[e.id][f.id]))) violations.push(`trial ${t}: function shown under hidden ${e.id}`); return; }
    if (dd.entities[e.id].n !== n(e.id)) violations.push(`trial ${t}: wrong n for ${e.id}`);
    const rest = W.FUNCTIONS.filter((f) => !shown(dd.functions[e.id][f.id])).reduce((a, f) => a + n(e.id, f.id), 0);
    if (rest > 0 && rest < k) violations.push(`trial ${t}: ${e.id} minus shown functions = ${rest}`);
  });
  W.FUNCTIONS.forEach((f) => {
    const sum = W.ENTITIES.filter((e) => shown(dd.functions[e.id][f.id])).reduce((a, e) => a + dd.functions[e.id][f.id].n, 0);
    const c = dd.orgFunctions[f.id];
    if ((shown(c) ? c.n : 0) !== sum) violations.push(`trial ${t}: organization-wide ${f.id} is not the sum of shown groups`);
  });
}
check(`property test over ${trials} random datasets`, trials > 200 && !violations.length, violations.slice(0, 5).join('; '));

// ---------- 6. Release files ----------
const demo = W.demoResponses();
rel = W.buildRelease(demo, { source: 'demo' });
check('demo covers three periods', rel.periods.join() === '2026-Q2,2026-Q3,2026-Q4');
check('demo shows each case: shown, collecting, withheld', rel.data['2026-Q4'].entities.OCHA.status === 'published' && rel.data['2026-Q4'].entities.OLA.status === 'collecting' && rel.data['2026-Q4'].functions.UNICEF.HUM.status === 'protected');
check('release passes its own check', !throws(() => W.checkRelease(JSON.parse(JSON.stringify(rel)))));
const lowered = JSON.parse(JSON.stringify(rel)); lowered.minGroupSize = 3;
check('release with a lower threshold is refused', throws(() => W.checkRelease(lowered)));
const tampered = JSON.parse(JSON.stringify(rel)); tampered.data['2026-Q4'].entities.OLA = { status: 'published', n: 6, items: {}, scores: {} };
check('release with a small shown group is refused', throws(() => W.checkRelease(tampered)));
const json = JSON.stringify(rel);
check('release holds no response IDs', !/R-[A-Z0-9]{12}/.test(json));
const csvRows = W.releaseRows(rel);
check('aggregated CSV marks hidden groups without numbers', csvRows.filter((r) => r.status !== 'shown').every((r) => r.count === '' && r.group_n === ''));
check('aggregated CSV percentages add to 100 per question', (() => {
  const g = csvRows.filter((r) => r.status === 'shown' && r.entity === 'OCHA' && r.function === 'All functions' && r.period === '2026-Q4' && r.question_id === 'PS1' && r.answer_code !== 98);
  return Math.abs(g.reduce((a, r) => a + r.percent, 0) - 100) < 0.6;
})());

// ---------- 7. Qualtrics files ----------
const txt = W.qualtricsTxt();
check('Qualtrics file has every question ID', ['CONSENT', 'ENTITY', 'FUNCTION'].concat(W.ITEMS.map((it) => it.id)).every((id) => txt.includes(`[[ID:${id}]]`)));
check('Qualtrics file has no text-entry questions', !/Question:TE/.test(txt));
check('Qualtrics file sets code 98', (txt.match(/\[\[Choice:98\]\]/g) || []).length === 34);
check('codebook marks every question required', W.codebookRows().every((r) => r.required === 'Yes'));
const back = W.readExport(W.demoCSV());
check('demo export reads back in full', back.responses.length === demo.length && back.incomplete === 0 && back.tests === 0);
const relBack = W.buildRelease(back.responses, { source: 'demo' });
check('export round trip gives the same results', JSON.stringify(relBack.data) === JSON.stringify(rel.data));
const lines = W.demoCSV().split('\r\n');
const header = lines[0].split(',');
const cut = lines.slice(0, 3).concat(lines[3].split(',').map((v, i) => (header[i] === 'PS3' ? '' : v)).join(','), lines[4].split(',').map((v, i) => (header[i] === 'Finished' ? '0' : v)).join(','), lines[5].split(',').map((v, i) => (header[i] === 'CONSENT' ? '2' : v)).join(','), lines[6].split(',').map((v, i) => (header[i] === 'Status' ? '1' : v)).join(','));
const partial = W.readExport(cut.join('\r\n'));
check('export reader leaves out incomplete, declined and preview responses', partial.responses.length === 0 && partial.incomplete === 2 && partial.declined === 1 && partial.tests === 1);
check('export reader refuses other files', throws(() => W.readExport('a,b\n1,2\n')));

// ---------- 8. Responses saved in this browser ----------
const mem = { data: {}, getItem(key) { return key in this.data ? this.data[key] : null; }, setItem(key, v) { this.data[key] = String(v); }, removeItem(key) { delete this.data[key]; } };
const store = W.deviceStore(mem);
check('store starts empty', store.count() === 0);
check('store refuses incomplete responses', throws(() => store.add({ entity: 'OCHA', function: 'HUM', period: '2026-Q4', answers: {} })) && store.count() === 0);
store.add(made);
check('store saves complete responses', store.count() === 1 && store.all()[0].id === made.id);
store.clear();
check('store can be cleared', store.count() === 0);
const demoStore = W.deviceStore(mem, W.CONFIG.demoStorageKey);
demoStore.add(W.makeResponse(input, { period: W.demoPeriod() }));
check('demo answers are kept apart from real responses', demoStore.count() === 1 && store.count() === 0 && W.CONFIG.demoStorageKey !== W.CONFIG.storageKey);
check('demo answers use the latest demonstration period', demoStore.all()[0].period === '2026-Q4');
const live = W.buildRelease(W.demoResponses().concat(Array.from({ length: 2 }, () => W.makeResponse({ entity: 'DMSPC', function: 'HR', answers: fullAnswers() }, { period: W.demoPeriod() }))));
check('live demo: two DMSPC answers unlock the DMSPC dataset', W.buildRelease(W.demoResponses()).data['2026-Q4'].entities.DMSPC.status === 'collecting' && live.data['2026-Q4'].entities.DMSPC.status === 'published' && live.data['2026-Q4'].entities.DMSPC.n === 10);

console.log(`${passed} passed, ${failures.length} failed`);
if (failures.length) { failures.forEach((f) => console.log(`FAIL ${f}`)); process.exit(1); }
