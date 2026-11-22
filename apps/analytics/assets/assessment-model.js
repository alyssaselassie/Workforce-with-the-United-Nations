// GENERATED COPY. Edit apps/shared/assessment-model.js, then run: node tools/build_assessment.js
// Workplace Relief Map: the shared model.
//
// One file, used unchanged by all three parts of the system:
//   - the survey application (apps/survey): the questions, the answer scale and validation;
//   - the dashboard (apps/analytics): the Relief Map and the anonymity rules;
//   - the results service (supabase/functions/assessment-release): the same anonymity rules on the
//     server, so dashboard users only ever receive aggregated results.
// It runs in the browser (window.AssessmentModel), in Node and in Deno.
//
// It follows the Relief Maps Tool worksheet: one survey, one combined dataset and one graph. Workplace
// spaces run along the bottom of the map, comfort to discomfort up the side, and each identity
// dimension (gender, age, religious identity, ethnicity, social class) is one line. Respondents are
// never asked which gender, age, religion, ethnicity or social class they are, or their department:
// only how comfortable they feel.
//
// Source of truth: apps/shared/assessment-model.js. `node tools/build_assessment.js` copies it into
// each application and regenerates the Qualtrics file, codebook, demonstration export and database
// schema, so every part stays in step.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AssessmentModel = factory();
})(typeof globalThis !== 'undefined' ? globalThis : typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------- settings ----------
  const CONFIG = {
    // The anonymity threshold: nothing is shown until at least this many people have taken part, and a
    // point on the map only when at least this many people have answered it. The code refuses
    // anything below 10.
    minGroupSize: 10,
    // Demonstration mode only: practice answers stay in this browser and join the fictional
    // demonstration data. Real responses are never stored in the browser.
    demoStorageKey: 'workplace-relief-map.demo-responses.v1'
  };

  const TITLE = 'Workplace Relief Map Survey';
  const SHORT_TITLE = 'Relief Map Survey';
  const DASHBOARD_TITLE = 'Workplace Relief Map Dashboard';

  const CONSENT = { id: 'CONSENT', text: 'Do you agree to take part in this survey?', options: ['Yes, I agree to take part', 'No, I do not want to take part'] };

  // ---------- the answer scale ----------
  // Codes follow the order shown (1 = very comfortable). Code 98 lets anyone decline: these questions
  // touch on identity, and not everyone uses every space. It is left out of every average.
  const NA = { code: 98, label: 'Prefer not to say or not applicable' };
  const SCALE = { id: 'comfort', name: 'Comfort', options: ['Very comfortable', 'Comfortable', 'Neither comfortable nor uncomfortable', 'Uncomfortable', 'Very uncomfortable'] };
  const ANSWER_CODES = [1, 2, 3, 4, 5, NA.code];

  // ---------- sources (real; the questions are new wording) ----------
  const SOURCES = {
    rodozarate: { short: 'Rodó-Zárate (2023); Relief Maps+', cite: 'Rodó-Zárate, M. (2023). Intersectionality and the spatiality of emotions in feminist research. The Professional Geographer, 75(4), 676–681. Relief Maps+ (INTERMAPS, Universitat Pompeu Fabra, 2024): reliefmaps.upf.edu.', url: 'https://doi.org/10.1080/00330124.2022.2075406',
      licence: 'The Relief Maps method maps how comfortable a person feels in each place in relation to each axis of their identity. This survey adapts that idea to workplace spaces and group averages; it is not the original individual-level method.' }
  };

  // ---------- the Relief Map ----------
  // Five physical workplace spaces (the places on the map) and the five identity dimensions of the
  // Relief Maps Tool worksheet (the lines), in the order of the worksheet's legend.
  const RELIEF = {
    name: 'Relief Map',
    intro: 'This survey maps where people feel at ease at work. Think about the past 3 months (or since you joined, if that is more recent). For each of five workplace spaces, say how comfortable you feel there in relation to five parts of who you are. For example, someone may feel at ease in meeting rooms in relation to their age, but uncomfortable in relation to their gender.',
    note: 'These questions never ask which gender, age, religion, ethnicity or social class you are, only how comfortable you feel.',
    spaces: [
      { id: 'DESK', name: 'Your desk or workstation', short: 'Your desk', phrase: 'at your desk or workstation', about: 'Where you do most of your work, including open-plan areas.' },
      { id: 'MEET', name: 'Meeting rooms', short: 'Meeting rooms', phrase: 'in meeting rooms', about: 'Rooms where meetings and presentations take place.' },
      { id: 'SUP', name: "Your supervisor's office", short: "Supervisor's office", phrase: "in your supervisor's office", about: 'Or wherever you usually meet your supervisor in person.' },
      { id: 'BREAK', name: 'Kitchen, break room or cafeteria', short: 'Break room', phrase: 'in the kitchen, break room or cafeteria', about: 'Shared spaces where people eat, take breaks and chat.' },
      { id: 'HALL', name: 'Hallways, elevators and entrances', short: 'Hallways', phrase: 'in hallways, elevators and entrances', about: 'The shared spaces you pass through every day.' }
    ],
    dimensions: [
      { id: 'GEN', name: 'Gender', phrase: 'your gender' },
      { id: 'AGE', name: 'Age', phrase: 'your age' },
      { id: 'REL', name: 'Religious identity', phrase: 'your religious identity (including having no religion)' },
      { id: 'ETH', name: 'Ethnicity', phrase: 'your ethnicity' },
      { id: 'CLS', name: 'Social class', phrase: 'your social class or background' }
    ]
  };
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  RELIEF.items = RELIEF.spaces.flatMap((s) => RELIEF.dimensions.map((d) => ({
    id: `RM_${s.id}_${d.id}`, space: s.id, dimension: d.id,
    concept: `${s.name}: ${d.name.toLowerCase()}`, short: `In relation to ${d.phrase}`,
    text: `${cap(s.phrase)}, how comfortable do you feel in relation to ${d.phrase}?`,
    basis: 'New', sources: ['rodozarate'], note: 'New item: comfort in a place in relation to one axis of identity, adapted from Relief Maps to a physical workplace space.'
  })));
  const ITEMS = RELIEF.items;
  const ITEM_BY_ID = Object.fromEntries(ITEMS.map((it) => [it.id, it]));
  const SPACE_BY_ID = Object.fromEntries(RELIEF.spaces.map((s) => [s.id, s]));
  const DIMENSION_BY_ID = Object.fromEntries(RELIEF.dimensions.map((d) => [d.id, d]));
  const reliefItem = (spaceId, dimensionId) => `RM_${spaceId}_${dimensionId}`;
  const QUESTION_COUNT = ITEMS.length + 1; // plus consent

  const answerLabel = (code) => (code === NA.code ? NA.label : SCALE.options[code - 1]);

  // ---------- points and kinds of place ----------
  // A point on the map is the average answer from 1 (very comfortable) to 5 (very uncomfortable);
  // "prefer not to say or not applicable" is left out. counts = [code 1, ..., code 5, code 98].
  const answered = (counts) => (counts ? counts.slice(0, 5).reduce((a, b) => a + b, 0) : 0);
  function reliefValue(counts) {
    const n = answered(counts);
    return n ? counts.slice(0, 5).reduce((a, c, i) => a + c * (i + 1), 0) / n : null;
  }
  // The four kinds of place on the Relief Maps worksheet. In this workplace adaptation a space is
  // labelled from its lines (the group's averages), checked in this order. The rule is ours: it is a
  // reading aid for group averages, not part of the original individual-level method.
  const PLACE_TYPES = [
    { id: 'oppression', name: 'Places of oppression', short: 'Oppression', rule: 'the lines average 3 or more: as much discomfort as comfort, or more' },
    { id: 'controversial', name: 'Controversial places', short: 'Controversial', rule: 'the highest and lowest lines are at least 1 point apart: comfort in relation to some identities, discomfort in relation to others' },
    { id: 'relief', name: 'Places of relief', short: 'Relief', rule: 'the lines average 2 or less: comfortable on average' },
    { id: 'neutral', name: 'Neutral places', short: 'Neutral', rule: 'anything in between' }
  ];
  const PLACE_TYPE_BY_ID = Object.fromEntries(PLACE_TYPES.map((p) => [p.id, p]));
  const PLACE_MIN_LINES = 3; // a space with fewer shown lines is not labelled
  function placeType(values) {
    const v = values.filter((x) => x != null);
    if (v.length < PLACE_MIN_LINES) return null;
    const avg = v.reduce((a, b) => a + b, 0) / v.length;
    if (avg >= 3) return PLACE_TYPE_BY_ID.oppression;
    if (Math.max(...v) - Math.min(...v) >= 1) return PLACE_TYPE_BY_ID.controversial;
    if (avg <= 2) return PLACE_TYPE_BY_ID.relief;
    return PLACE_TYPE_BY_ID.neutral;
  }
  // The Relief Map of a published result: values[space][dimension] (null where a point is held back)
  // and the kind of place of each space.
  function reliefMap(c) {
    if (!c || c.status !== 'published' || !c.relief) return null;
    const values = Object.fromEntries(RELIEF.spaces.map((s) => [s.id, Object.fromEntries(RELIEF.dimensions.map((d) => [d.id, reliefValue(c.relief[reliefItem(s.id, d.id)])]))]));
    const types = Object.fromEntries(RELIEF.spaces.map((s) => [s.id, placeType(RELIEF.dimensions.map((d) => values[s.id][d.id]))]));
    const shown = ITEMS.filter((it) => c.relief[it.id]).length;
    return { values, types, shown };
  }

  const TEXT = {
    intro: `This short, anonymous survey asks how comfortable you feel in five everyday workplace spaces, in relation to your gender, age, religious identity, ethnicity and social class. It never asks which of these you are. It has ${QUESTION_COUNT} multiple-choice questions and takes about 5 minutes. Every question needs an answer; you can always choose "${NA.label}".`,
    purpose: 'Your answers are combined with everyone else\'s into one Relief Map, which shows where people feel at ease at work and where they do not. It is used to learn and to improve workplaces, never to assess individuals.',
    privacy: [
      'Taking part is voluntary. You can stop at any time before you submit; nothing is recorded until you do.',
      'We do not ask for your name, email, staff ID or department. Your response is stored without your IP address, your location or the date and time you took part.',
      'The survey asks how comfortable you feel in relation to your gender, age, religious identity, ethnicity and social class. It never asks which of these you are.',
      'Results are shown only as one combined map, once at least 10 people have taken part, and each point on it only when at least 10 people have answered it. Individual answers are never shown to anyone, including supervisors.'
    ],
    // Qualtrics records response dates and keeps unfinished responses unless told otherwise, so its
    // copy of the survey says only what holds there once "Anonymize responses" is on.
    qualtricsPrivacy: [
      'Taking part is voluntary, and you can stop at any time.',
      'We do not ask for your name, email, staff ID or department, and responses are anonymized, so your IP address and location are not recorded.',
      'The survey asks how comfortable you feel in relation to your gender, age, religious identity, ethnicity and social class. It never asks which of these you are.',
      'Results are shown only as one combined map, and each point on it only when at least 10 people have answered it. Individual answers are never shown to anyone, including supervisors.'
    ],
    thanks: 'Thank you for taking part. Your answers have been recorded anonymously and will only ever be shown combined with everyone else\'s.',
    declined: 'Thank you. You chose not to take part, so the survey has ended and nothing was recorded.'
  };

  // ---------- responses ----------
  // An anonymous response identifier: random, not derived from anything about the person or device.
  function responseId(rand) {
    const alphabet = 'ABCDEFGHJKMNPQRSTVWXYZ23456789';
    let bytes;
    if (rand) bytes = Array.from({ length: 12 }, () => Math.floor(rand() * 256));
    else if (typeof crypto !== 'undefined' && crypto.getRandomValues) bytes = Array.from(crypto.getRandomValues(new Uint8Array(12)));
    else bytes = Array.from({ length: 12 }, () => Math.floor(Math.random() * 256));
    return `R-${bytes.map((b) => alphabet[b % alphabet.length]).join('')}`;
  }

  const validCode = (code) => ANSWER_CODES.includes(code);

  // Lists what is missing or invalid; an empty list means the response is complete.
  function problems(r) {
    const out = [];
    if (!r || typeof r !== 'object' || !r.answers || typeof r.answers !== 'object') return ['Not a response.'];
    ITEMS.forEach((it) => { if (!validCode(r.answers[it.id])) out.push(it.id); });
    if (Object.keys(r.answers).some((k) => !ITEM_BY_ID[k])) out.push('UNKNOWN_ANSWER');
    return out;
  }

  // Builds the response record from the survey's answers: an anonymous ID and the answer codes,
  // nothing else. Throws if anything is missing, so an incomplete response can never be submitted.
  function makeResponse(input, opts) {
    opts = opts || {};
    const r = { id: opts.id || responseId(opts.rand), answers: Object.fromEntries(ITEMS.map((it) => [it.id, input && input.answers ? input.answers[it.id] : undefined])) };
    const missing = problems(r);
    if (missing.length) throw new Error(`Incomplete response: ${missing.join(', ')}`);
    return r;
  }

  // What the survey sends to the secure database function (supabase: submit_assessment).
  const submissionPayload = (r) => ({ p_answers: r.answers });

  // ---------- aggregation ----------
  function countAnswers(rs, itemId) {
    const counts = [0, 0, 0, 0, 0, 0]; // codes 1 to 5, then 98 ("prefer not to say or not applicable")
    rs.forEach((r) => { const c = r.answers[itemId]; if (c === NA.code) counts[5] += 1; else if (c >= 1 && c <= 5) counts[c - 1] += 1; });
    return counts;
  }

  // ---------- what may be reported (the anonymity rules) ----------
  // All responses form one dataset and one map. With k = the minimum group size:
  //  1. Nothing is shown until at least k people have submitted a complete response.
  //  2. Each point (a space and an identity dimension) is shown only when at least k people gave a
  //     comfort answer to it ("prefer not to say" does not count); otherwise it carries no numbers.
  //  3. There are no subgroups (no departments, periods or identity groups), so no small group can be
  //     worked out by subtracting one result from another.
  const RELEASE_FORMAT = 'workplace-relief-map-release';
  const RELEASE_VERSION = 2;

  function buildRelease(responses, opts) {
    opts = opts || {};
    const k = Math.max(CONFIG.minGroupSize, opts.minGroupSize || CONFIG.minGroupSize);
    const rs = responses.filter((r) => !problems(r).length);
    let result = { status: 'collecting' };
    if (rs.length >= k) {
      const relief = {};
      ITEMS.forEach((it) => { const c = countAnswers(rs, it.id); relief[it.id] = answered(c) >= k ? c : null; });
      result = { status: 'published', n: rs.length, relief };
    }
    return {
      format: RELEASE_FORMAT, version: RELEASE_VERSION, title: TITLE, minGroupSize: k,
      source: opts.source || 'unknown', label: opts.label || '', created: opts.created || new Date().toISOString().slice(0, 10),
      result
    };
  }

  // Checks a release before showing it: right format, threshold not lowered, enough responses, every
  // shown point with enough answers, and no numbers at all while the group is still too small.
  function checkRelease(rel) {
    if (!rel || rel.format !== RELEASE_FORMAT || rel.version !== RELEASE_VERSION || !rel.result) throw new Error('This is not an aggregated results file from this survey.');
    if (!(rel.minGroupSize >= CONFIG.minGroupSize)) throw new Error(`This file uses a minimum group size below ${CONFIG.minGroupSize}, so it cannot be shown.`);
    const k = rel.minGroupSize;
    const c = rel.result;
    if (c.status === 'published') {
      if (!(Number.isInteger(c.n) && c.n >= k)) throw new Error('The file contains a group below the minimum size, so it cannot be shown.');
      if (!c.relief || typeof c.relief !== 'object') throw new Error('The file is incomplete.');
      const ok = (x) => Array.isArray(x) && x.length === 6 && x.every((v) => Number.isInteger(v) && v >= 0);
      ITEMS.forEach((it) => {
        const x = c.relief[it.id];
        if (x == null) return;
        if (!ok(x) || x.reduce((a, b) => a + b, 0) > c.n) throw new Error('The file is incomplete.');
        if (answered(x) < k) throw new Error('The file contains a Relief Map point with fewer answers than the minimum, so it cannot be shown.');
      });
    } else if (c.status !== 'collecting' || Object.keys(c).length !== 1) {
      throw new Error('The file contains numbers for a group that should be hidden, so it cannot be shown.');
    }
    return rel;
  }

  // ---------- Qualtrics ----------
  function questions() {
    const list = [
      { id: 'INTRO', type: 'DB', block: 'Introduction', text: `${TITLE}. ${TEXT.intro}` },
      { id: 'PRIVACY', type: 'DB', block: 'Introduction', text: TEXT.qualtricsPrivacy.join(' ') },
      { id: CONSENT.id, type: 'MC', block: 'Introduction', text: CONSENT.text, options: CONSENT.options, codes: [1, 2] }
    ];
    // One block (one page) per space, five questions each.
    RELIEF.spaces.forEach((s, i) => {
      const block = `${i + 1}. ${s.name}`;
      if (i === 0) list.push({ id: 'RM_INTRO', type: 'DB', block, text: `${RELIEF.intro} ${RELIEF.note} If you prefer not to answer, or you do not use a space, choose "${NA.label}".` });
      ITEMS.filter((it) => it.space === s.id).forEach((it) => list.push({ id: it.id, type: 'MC', block, text: it.text, options: SCALE.options.concat(NA.label), codes: ANSWER_CODES }));
    });
    list.push({ id: 'REVIEW', type: 'DB', block: 'Review', text: 'That was the last question. When you are ready, select the arrow to submit your answers.' });
    return list;
  }

  // Qualtrics Advanced Format TXT (in a survey: Tools > Import/Export > Import survey). After importing,
  // turn on "Force response" for every question and "Anonymize responses" in Survey options; the TXT
  // format cannot set them.
  function qualtricsTxt() {
    const out = ['[[AdvancedFormat]]', ''];
    let block = null;
    questions().forEach((q) => {
      if (q.block !== block) { block = q.block; out.push(`[[Block:${block}]]`, ''); }
      if (q.type === 'DB') { out.push('[[Question:DB]]', `[[ID:${q.id}]]`, q.text, ''); return; }
      out.push('[[Question:MC:SingleAnswer:Vertical]]', `[[ID:${q.id}]]`, q.text, '[[AdvancedChoices]]');
      q.options.forEach((o, i) => out.push(`[[Choice:${q.codes[i]}]]`, o));
      out.push('');
    });
    return out.join('\n');
  }

  const csvCell = (v) => (v == null ? '' : /[",\n\r]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  const toCSV = (rows, cols) => [cols.join(',')].concat(rows.map((r) => cols.map((c) => csvCell(r[c])).join(','))).join('\r\n') + '\r\n';

  function codebookRows() {
    const codes = (opts, codesList) => opts.map((o, i) => `${codesList[i]} = ${o}`).join('; ');
    const rows = [
      { question_id: CONSENT.id, section: 'Introduction', concept: 'Consent', question: CONSENT.text, type: 'Single choice (radio)', required: 'Yes', answers: codes(CONSENT.options, [1, 2]), basis: '', sources: '', note: '"No" ends the survey; nothing is recorded.' }
    ];
    ITEMS.forEach((it) => rows.push({
      question_id: it.id, section: `${RELIEF.spaces.findIndex((s) => s.id === it.space) + 1}. ${SPACE_BY_ID[it.space].name}`, concept: it.concept, question: it.text, type: 'Single choice (radio)', required: 'Yes',
      answers: codes(SCALE.options.concat(NA.label), ANSWER_CODES), basis: it.basis,
      sources: it.sources.map((s) => SOURCES[s].short).join('; '),
      note: `${it.note} Relief Map line: ${DIMENSION_BY_ID[it.dimension].name}. Point = average answer (1 = very comfortable, 5 = very uncomfortable), leaving out code 98; shown only when at least ${CONFIG.minGroupSize} people gave a comfort answer.`
    }));
    return rows;
  }
  const codebookCSV = () => toCSV(codebookRows(), ['question_id', 'section', 'concept', 'question', 'type', 'required', 'answers', 'basis', 'sources', 'note']);

  // ---------- reading a Qualtrics export ----------
  function parseCSV(text) {
    const rows = [];
    let row = [], field = '', quoted = false;
    text = String(text).replace(/^﻿/, '');
    for (let i = 0; i < text.length; i += 1) {
      const c = text[i];
      if (quoted) {
        if (c === '"' && text[i + 1] === '"') { field += '"'; i += 1; }
        else if (c === '"') quoted = false;
        else field += c;
      } else if (c === '"') quoted = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i += 1;
        row.push(field); rows.push(row); row = []; field = '';
      } else field += c;
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    return rows.filter((r) => r.some((v) => v !== ''));
  }

  const IDENTIFYING = ['IPAddress', 'RecipientLastName', 'RecipientFirstName', 'RecipientEmail', 'ExternalReference', 'LocationLatitude', 'LocationLongitude'];
  const norm = (s) => String(s == null ? '' : s).trim().toLowerCase().replace(/[’']/g, "'");

  // Reads a Qualtrics CSV export (numeric values or choice text). Keeps only finished responses from
  // people who agreed, with every question answered; the rest are counted and left out. Response IDs,
  // dates and every other column are discarded: only the answer codes are kept.
  function readExport(text) {
    const rows = parseCSV(text);
    if (!rows.length) throw new Error('The file is empty.');
    const head = rows[0].map((h) => h.trim());
    const col = (name) => head.indexOf(name);
    if (!ITEMS.some((it) => col(it.id) >= 0)) throw new Error(`This does not look like an export of this survey: question columns such as ${ITEMS[0].id} are missing.`);
    const choice = (raw, labels, codes) => {
      const v = String(raw == null ? '' : raw).trim();
      if (/^\d+$/.test(v)) { const n = Number(v); return codes.includes(n) ? n : null; }
      const i = labels.findIndex((o) => norm(o) === norm(v));
      return i >= 0 ? codes[i] : null;
    };
    const out = { responses: [], declined: 0, incomplete: 0, tests: 0, identifying: false, demo: false };
    let demoIds = 0, rowsSeen = 0;
    rows.slice(1).forEach((r) => {
      const first = (r[0] || '').trim();
      if (first.startsWith('{"ImportId"') || first === 'Start Date' || first === 'Response ID') return; // extra header rows
      if (ITEMS.some((it) => col(it.id) >= 0 && String(r[col(it.id)] || '').length > 60)) return; // question-text row
      const status = col('Status') >= 0 ? String(r[col('Status')] || '').trim() : '';
      if (['1', '2', '8', '9', '12', '17'].includes(status) || /preview|test|spam|imported/i.test(status)) { out.tests += 1; return; }
      if (col(CONSENT.id) >= 0 && choice(r[col(CONSENT.id)], CONSENT.options, [1, 2]) !== 1) { out.declined += 1; return; }
      if (IDENTIFYING.some((n) => col(n) >= 0 && String(r[col(n)] || '').trim())) out.identifying = true;
      rowsSeen += 1;
      if (col('ResponseId') >= 0 && /^R_demo\d+$/.test(String(r[col('ResponseId')] || '').trim())) demoIds += 1;
      const finished = col('Finished') >= 0 ? String(r[col('Finished')] || '').trim() : '1';
      const answers = {};
      ITEMS.forEach((it) => { answers[it.id] = col(it.id) >= 0 ? choice(r[col(it.id)], SCALE.options.concat(NA.label), ANSWER_CODES) : null; });
      const resp = { id: responseId(), answers };
      if (!/^(1|true)$/i.test(finished) || problems(resp).length) { out.incomplete += 1; return; }
      out.responses.push(resp);
    });
    out.demo = rowsSeen > 0 && demoIds === rowsSeen; // the demonstration export stays labelled as demonstration data
    return out;
  }

  // ---------- demonstration data (synthetic; never mixed with real responses) ----------
  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // One fictional team. The levels of discomfort (1 = very comfortable, 5 = very uncomfortable) are
  // invented so that the demonstration map shows each kind of place; they are not findings.
  const DEMO = {
    size: 24,
    level: {
      DESK: { GEN: 1.75, AGE: 1.7, REL: 1.5, ETH: 1.7, CLS: 1.8 },
      MEET: { GEN: 3.45, AGE: 3.25, REL: 2.7, ETH: 3.15, CLS: 3.4 },
      SUP: { GEN: 2.5, AGE: 2.45, REL: 2.05, ETH: 2.35, CLS: 2.6 },
      BREAK: { GEN: 2.15, AGE: 1.85, REL: 3.2, ETH: 3.0, CLS: 3.15 },
      HALL: { GEN: 2.45, AGE: 2.1, REL: 1.95, ETH: 2.3, CLS: 2.2 }
    },
    na: { GEN: 0.02, AGE: 0.015, REL: 0.07, ETH: 0.04, CLS: 0.03 }, // "prefer not to say"
    naSpace: { SUP: 0.03 } // plus "not applicable": not everyone meets their supervisor in person
  };

  function demoResponses() {
    const rand = rng(20261122);
    const normal = () => { let u = 0, v = 0; while (!u) u = rand(); while (!v) v = rand(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
    const out = [];
    for (let i = 0; i < DEMO.size; i += 1) {
      const ease = normal() * 0.4; // how at ease this person is in general
      const axis = Object.fromEntries(RELIEF.dimensions.map((d) => [d.id, normal() * 0.35]));
      const answers = {};
      ITEMS.forEach((it) => {
        if (rand() < DEMO.na[it.dimension] + (DEMO.naSpace[it.space] || 0)) { answers[it.id] = NA.code; return; }
        const x = DEMO.level[it.space][it.dimension] + ease + axis[it.dimension] + normal() * 0.6;
        answers[it.id] = Math.min(5, Math.max(1, Math.round(x)));
      });
      out.push({ id: responseId(rand), answers });
    }
    return out;
  }

  // The demonstration data in the layout of a Qualtrics CSV export (numeric values).
  function demoCSV() {
    const meta = ['StartDate', 'EndDate', 'Status', 'IPAddress', 'Progress', 'Duration (in seconds)', 'Finished', 'RecordedDate', 'ResponseId', 'DistributionChannel', 'UserLanguage'];
    const cols = questions().filter((q) => q.type !== 'DB');
    const rand = rng(7);
    const lines = [meta.concat(cols.map((c) => c.id)), meta.concat(cols.map((c) => c.text)), meta.map((m) => `{"ImportId":"${m}"}`).concat(cols.map((c, i) => `{"ImportId":"QID${i + 1}"}`))];
    demoResponses().forEach((r, i) => {
      const date = `2026-11-${String(2 + (i % 18)).padStart(2, '0')} ${String(9 + (i % 8)).padStart(2, '0')}:${String((i * 7) % 60).padStart(2, '0')}:00`;
      const values = cols.map((c) => (c.id === CONSENT.id ? 1 : r.answers[c.id]));
      lines.push([date, date, 0, '', 100, 120 + Math.floor(rand() * 240), 1, date, `R_demo${String(i + 1).padStart(5, '0')}`, 'anonymous', 'EN'].concat(values));
    });
    return lines.map((l) => l.map(csvCell).join(',')).join('\r\n') + '\r\n';
  }

  // ---------- demonstration answers saved in this browser ----------
  // Used only in demonstration mode. Real responses go to the secure database and are never stored
  // in the browser.
  function demoStore(storage, key) {
    key = key || CONFIG.demoStorageKey;
    const read = () => {
      try {
        const v = JSON.parse(storage.getItem(key) || 'null');
        return v && Array.isArray(v.responses) ? v.responses.filter((r) => !problems(r).length) : [];
      } catch (e) { return []; }
    };
    return {
      all: read,
      count: () => read().length,
      add(r) {
        if (problems(r).length) throw new Error('Incomplete response: not saved.');
        const list = read();
        list.push(r);
        storage.setItem(key, JSON.stringify({ version: 1, demonstration: true, responses: list }));
        return list.length;
      },
      clear() { storage.removeItem(key); }
    };
  }

  // The lists the database checks submissions against (used to generate the SQL schema).
  const schema = () => ({ items: ITEMS.map((it) => it.id), codes: ANSWER_CODES.slice() });

  return {
    CONFIG, TITLE, SHORT_TITLE, DASHBOARD_TITLE, CONSENT, NA, SCALE, SOURCES, RELIEF, ITEMS, ITEM_BY_ID, SPACE_BY_ID, DIMENSION_BY_ID,
    PLACE_TYPES, PLACE_TYPE_BY_ID, PLACE_MIN_LINES, QUESTION_COUNT, ANSWER_CODES, TEXT, DEMO, RELEASE_FORMAT, RELEASE_VERSION,
    answerLabel, responseId, problems, makeResponse, submissionPayload, countAnswers, answered, reliefItem, reliefValue, placeType, reliefMap,
    buildRelease, checkRelease, questions, qualtricsTxt, codebookRows, codebookCSV, parseCSV, readExport, rng, demoResponses, demoCSV, demoStore, schema
  };
});
