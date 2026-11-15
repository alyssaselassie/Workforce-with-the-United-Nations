// Relief Maps Tool (simple version): the survey, scoring, privacy rules, the Qualtrics import file,
// the export reader and a fictional sample team. Works in the browser (window.ReliefMap) and in Node.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ReliefMap = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const SURVEY_TITLE = 'Relief Maps: Workplace Experience Survey';
  const SCALE = ['Strongly disagree', 'Disagree', 'Neither agree nor disagree', 'Agree', 'Strongly agree']; // 1 to 5
  const MIN_GROUP = 5; // nothing is shown for fewer than 5 answers or people

  // The three lines on the map. Each combines closely related dimensions from the brief.
  const MEASURES = [
    { id: 'SAFE', label: 'Safety and voice', color: '#0072b2', marker: 'square',
      meaning: 'Feeling safe to speak up, ask questions, disagree or make mistakes.', dims: ['PS', 'VOI'] },
    { id: 'BELONG', label: 'Belonging and inclusion', color: '#d55e00', marker: 'triangle',
      meaning: 'Feeling welcome, valued and included.', dims: ['BEL', 'INC'] },
    { id: 'COMFORT', label: 'Comfort', color: '#009e73', marker: 'diamond',
      meaning: 'Feeling at ease rather than tense.', dims: ['COM'] }
  ];

  // The five dimensions of the brief. Every statement measures one of them.
  const DIMENSIONS = [
    { id: 'PS', label: 'Psychological safety' },
    { id: 'BEL', label: 'Belonging' },
    { id: 'INC', label: 'Inclusion' },
    { id: 'VOI', label: 'Voice and participation' },
    { id: 'COM', label: 'Comfort and well-being' }
  ];

  const SETTINGS = [
    { id: 'MEET', label: 'Team meetings', short: 'Meetings', intro: 'Think about your team meetings, in person or online.' },
    { id: 'SUPV', label: 'One-on-ones with your supervisor', short: '1-on-1s', intro: 'Think about one-on-one conversations with your supervisor.' },
    { id: 'ONLINE', label: 'Online and hybrid work', short: 'Online', intro: 'Think about online meetings, calls, chat and shared documents.' },
    { id: 'SOCIAL', label: 'Informal and social time', short: 'Social', intro: 'Think about breaks, lunches, social events and networking.' },
    { id: 'LEARN', label: 'Learning and development', short: 'Learning', intro: 'Think about training, mentoring, feedback and chances to grow.' },
    { id: 'DECIDE', label: 'Decision-making', short: 'Decisions', intro: 'Think about the meetings and conversations where decisions are made.' }
  ];

  // Source labels. Nothing is copied unchanged from a published scale, so nothing is "validated".
  const Q = (text, dim, kind, source) => ({ text, dim, kind, source });
  const STATEMENTS = {
    MEET: {
      SAFE: Q('I feel comfortable expressing a different opinion during team meetings.', 'VOI', 'Brief', 'From the project brief; related to Edmondson (1999), speaking up'),
      BELONG: Q('My contributions in team meetings are taken seriously.', 'INC', 'Brief', 'From the project brief; related to Edmondson (1999), skills and talents valued'),
      COMFORT: Q('I feel at ease in team meetings.', 'COM', 'New', 'New')
    },
    SUPV: {
      SAFE: Q('I can ask my supervisor questions without worrying about negative consequences.', 'PS', 'Brief', 'From the project brief; related to Edmondson (1999), asking for help'),
      BELONG: Q('I can be myself in conversations with my supervisor.', 'BEL', 'New', 'New'),
      COMFORT: Q('I feel at ease in one-on-one conversations with my supervisor.', 'COM', 'New', 'New')
    },
    ONLINE: {
      SAFE: Q('In online meetings, I get a fair chance to speak.', 'VOI', 'New', 'New'),
      BELONG: Q('I feel included in the online conversations that affect my work.', 'INC', 'Brief', 'Adapted from the project brief'),
      COMFORT: Q('I feel at ease when I work with colleagues online.', 'COM', 'New', 'New')
    },
    SOCIAL: {
      SAFE: Q('In informal settings at work, I am accepted for who I am.', 'PS', 'Adapted', 'Adapted from Edmondson (1999): "People on this team sometimes reject others for being different"'),
      BELONG: Q('I feel welcome when colleagues get together informally.', 'BEL', 'New', 'New; informed by COPSOQ III, sense of community at work'),
      COMFORT: Q('I feel at ease in informal conversations with colleagues.', 'COM', 'New', 'New')
    },
    LEARN: {
      SAFE: Q('When I am learning something new at work, it is safe to make mistakes.', 'PS', 'Adapted', 'Adapted from Edmondson (1999): "It is safe to take a risk on this team"'),
      BELONG: Q('I have someone at work, such as a mentor, who supports my growth.', 'BEL', 'New', 'New; informed by COPSOQ III, social support'),
      COMFORT: Q('I feel at ease when I receive feedback on my work.', 'COM', 'New', 'New')
    },
    DECIDE: {
      SAFE: Q('I have opportunities to contribute to important workplace decisions.', 'VOI', 'Brief', 'From the project brief; related to COPSOQ III, influence at work'),
      BELONG: Q('My perspective is considered when decisions that affect my work are made.', 'INC', 'Brief', 'From the project brief'),
      COMFORT: Q('I feel at ease in meetings where decisions are made.', 'COM', 'New', 'New')
    }
  };
  const ITEMS = SETTINGS.flatMap((s) => MEASURES.map((m) => Object.assign({ id: `${s.id}_${m.id}`, setting: s.id, measure: m.id }, STATEMENTS[s.id][m.id])));

  const OVERALL = [
    Object.assign({ id: 'OV_BELONG', topic: 'Overall belonging' }, Q('Overall, I feel a sense of belonging in my workplace.', 'BEL', 'New', 'New; informed by COPSOQ III, sense of community at work')),
    Object.assign({ id: 'OV_SUPPORT', topic: 'Organizational support' }, Q('My organization cares about my well-being.', 'COM', 'Adapted', 'Adapted from Eisenberger et al. (1986): "The organization really cares about my well-being"')),
    Object.assign({ id: 'OV_CONCERNS', topic: 'Raising concerns' }, Q('I feel confident raising a concern at work.', 'VOI', 'Adapted', 'Adapted from Edmondson (1999), bringing up problems and tough issues')),
    Object.assign({ id: 'OV_RESPECT', topic: 'Respect' }, Q('I am treated with respect at work.', 'INC', 'New', 'New; informed by COPSOQ III, recognition')),
    Object.assign({ id: 'OV_COLLAB', topic: 'Collaboration' }, Q('The way my team works encourages collaboration.', 'INC', 'New', 'New'))
  ];

  const CONSENT = { id: 'CONSENT', question: 'Do you agree to take part in this survey?', options: ['Yes, I agree', 'No, I do not want to take part'] };
  const ABOUT_YOU = { id: 'ABOUT_YOU', question: 'Would you like to answer five optional questions about yourself?', options: ['Yes', 'No, skip them'] };

  // Optional identity questions. The first `groups` options can be compared; the rest are never shown.
  const IDENTITY = [
    { id: 'AGE_GROUP', label: 'Age group', question: 'What is your age group?',
      options: ['Under 35', '35 to 49', '50 or older', 'Prefer not to answer'], groups: 3,
      names: ['Under 35', '35 to 49', '50 or older'], source: 'New' },
    { id: 'GENDER', label: 'Gender', question: 'How do you describe your gender?',
      options: ['Woman', 'Man', 'Non-binary or another gender', 'Prefer not to answer'], groups: 3,
      names: ['Women', 'Men', 'Non-binary or another gender'], source: 'New' },
    { id: 'DISABILITY', label: 'Disability or access need', question: 'Do you have a disability, a long-term health condition or an accessibility need?',
      options: ['Yes', 'No', 'Prefer not to answer'], groups: 2,
      names: ['Disability or access need', 'No disability or access need'], source: 'New; for a fuller measure, use the Washington Group Short Set' },
    { id: 'MINORITY', label: 'Racial or ethnic minority', question: 'Do you identify as a member of a racial or ethnic minority in your workplace?',
      options: ['Yes', 'No', 'Not sure', 'Prefer not to answer'], groups: 2,
      names: ['Racial or ethnic minority', 'Not a minority'], source: 'New; works across countries, where categories differ' },
    { id: 'PARENT_DEGREE', label: "Parents' education", question: 'Did either of your parents or guardians have a university degree when you were growing up?',
      options: ['Yes', 'No', 'I don\'t know', 'Prefer not to answer'], groups: 2,
      names: ['A parent had a degree', 'No parent had a degree'], source: 'Adapted from the UK GSS socio-economic background standard' }
  ];

  const REFLECTION = [
    { id: 'IDEA_PLACE', question: 'Is there a particular workplace environment where you feel especially comfortable, included or supported? What contributes to that experience?' },
    { id: 'IDEA_CHANGE', question: 'What is one change that would make your team or workplace environment more collaborative, inclusive and innovative?' }
  ];

  const TEXT = {
    intro: 'This short survey asks how you feel in six everyday workplace settings, from team meetings to decision-making. Your answers are combined with your team\'s to make a Relief Map that shows where people feel safe, included and at ease. It takes about 5 minutes.',
    privacy: 'Taking part is voluntary, and you can skip any question. Your answers are anonymous: we do not collect your name, email, staff ID, IP address or location. Supervisors never see individual answers. Results are shared only as group averages, never for groups of fewer than 5 people. Questions: [team contact email].',
    setting: (s, i) => `${i + 1} of ${SETTINGS.length}: ${s.label}. ${s.intro} How much do you agree?`,
    overall: 'Your workplace overall. How much do you agree?',
    about: 'About you (optional). These questions show whether experiences differ between groups. Groups smaller than 5 are never shown, and you can always choose "Prefer not to answer".',
    ideas: 'Your ideas (optional). Please do not include names or details that could identify anyone.',
    thanks: 'Thank you for taking part. Your answers have been recorded anonymously and will help make your workplace more inclusive. Results will be shared with the whole team as group averages only.',
    declined: 'Thank you. You chose not to take part, so the survey has ended. You can close this window.'
  };

  // ---------- scoring ----------
  const valid = (v) => (typeof v === 'number' && v >= 1 && v <= 5 ? v : null);
  const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const stat = (vals) => (vals.length >= MIN_GROUP
    ? { mean: mean(vals), n: vals.length, agree: vals.filter((v) => v >= 4).length / vals.length }
    : { hidden: true, n: vals.length });
  const answers = (people, id) => people.map((p) => valid(p.items[id])).filter((v) => v != null);

  // A person's score for a setting: the average of their answers there (at least 2 of the 3).
  function settingScore(p, settingId) {
    const vals = MEASURES.map((m) => valid(p.items[`${settingId}_${m.id}`])).filter((v) => v != null);
    return vals.length >= 2 ? mean(vals) : null;
  }

  // The map: one line per measure; each point averages everyone's answer to one statement.
  function map(people) {
    return {
      lines: MEASURES.map((m) => ({ key: m.id, label: m.label, color: m.color, marker: m.marker, values: SETTINGS.map((s) => stat(answers(people, `${s.id}_${m.id}`))) })),
      settings: SETTINGS.map((s) => stat(people.map((p) => settingScore(p, s.id)).filter((v) => v != null)))
    };
  }

  // The five dimensions: every answer to that dimension's statements, in all settings and overall.
  function dimensionAverages(people) {
    return DIMENSIONS.map((d) => {
      const items = ITEMS.concat(OVERALL).filter((it) => it.dim === d.id);
      return Object.assign({ dim: d, statements: items.length }, stat(items.flatMap((it) => answers(people, it.id))));
    });
  }

  const overall = (people) => OVERALL.map((o) => Object.assign({ item: o }, stat(answers(people, o.id))));

  // Groups for one identity question. Privacy rules, for each setting:
  // a group needs at least 5 people; people in smaller groups or who did not say are pooled, and
  // that pool must be 0 or at least 5 (so a hidden group can't be worked out from the others);
  // at least two groups must be shown. Only one identity question is compared at a time.
  function groups(people, identityId) {
    const q = IDENTITY.find((x) => x.id === identityId);
    const lines = q.names.slice(0, q.groups).map((label, g) => ({ key: `${q.id}-${g}`, label, g, values: [] }));
    const everyone = { key: 'all', label: 'Everyone', values: [] };
    let hiddenSettings = 0;
    SETTINGS.forEach((s, i) => {
      const scored = people.map((p) => ({ p, v: settingScore(p, s.id) })).filter((x) => x.v != null);
      everyone.values[i] = stat(scored.map((x) => x.v));
      const per = lines.map((l) => scored.filter((x) => x.p.ident[q.id] === l.g).map((x) => x.v));
      const shown = per.map((v) => v.length >= MIN_GROUP);
      const pooled = scored.length - per.reduce((a, v, g) => a + (shown[g] ? v.length : 0), 0);
      const ok = shown.filter(Boolean).length >= 2 && (pooled === 0 || pooled >= MIN_GROUP);
      if (!ok) hiddenSettings += 1;
      lines.forEach((l, g) => { l.values[i] = ok && shown[g] ? stat(per[g]) : { hidden: true, n: per[g].length }; });
    });
    const visible = lines.filter((l) => l.values.some((v) => !v.hidden));
    const notes = [];
    if (visible.length < 2) notes.push(`This comparison is hidden to protect anonymity: it needs at least two groups of ${MIN_GROUP} or more people, and the people who are left over must also number 0 or at least ${MIN_GROUP}.`);
    else {
      const small = lines.filter((l) => !visible.includes(l) && l.values.some((v) => v.n > 0));
      if (small.length) notes.push(`Not shown, to protect anonymity: ${small.map((l) => l.label.toLowerCase()).join(', ')} (fewer than ${MIN_GROUP} people).`);
      if (hiddenSettings) notes.push('Some settings are hidden to protect anonymity.');
    }
    return { question: q, lines: visible.length >= 2 ? [everyone].concat(visible) : [everyone], notes };
  }

  // ---------- plain-language summary ----------
  const lower = (s) => s.charAt(0).toLowerCase() + s.slice(1);
  function summary(people) {
    const m = map(people);
    const shown = SETTINGS.map((s, i) => ({ s, v: m.settings[i] })).filter((x) => !x.v.hidden).sort((a, b) => b.v.mean - a.v.mean);
    if (!shown.length) return [`Not enough answers yet: results appear once at least ${MIN_GROUP} people have answered.`];
    const out = [`People feel most positive in ${lower(shown[0].s.label)} (${shown[0].v.mean.toFixed(1)}) and least positive in ${lower(shown[shown.length - 1].s.label)} (${shown[shown.length - 1].v.mean.toFixed(1)}).`];
    const points = [];
    m.lines.forEach((l) => l.values.forEach((v, i) => { if (!v.hidden) points.push({ l, s: SETTINGS[i], v }); }));
    points.sort((a, b) => a.v.mean - b.v.mean);
    if (points.length) out.push(`The lowest point is ${lower(points[0].l.label)} in ${lower(points[0].s.label)} (${points[0].v.mean.toFixed(1)}).`);
    return out;
  }

  function groupSummary(result) {
    const lines = result.lines.slice(1);
    if (lines.length < 2) return [];
    let best = null;
    SETTINGS.forEach((s, i) => {
      const pts = lines.filter((l) => !l.values[i].hidden).sort((a, b) => b.values[i].mean - a.values[i].mean);
      if (pts.length < 2) return;
      const gap = pts[0].values[i].mean - pts[pts.length - 1].values[i].mean;
      if (!best || gap > best.gap) best = { s, hi: pts[0], lo: pts[pts.length - 1], gap, i };
    });
    if (!best || best.gap < 0.3) return ['The groups shown have similar experiences in every setting.'];
    return [`The biggest gap is in ${lower(best.s.label)}: ${best.lo.label} ${best.lo.values[best.i].mean.toFixed(1)}, compared with ${best.hi.label} ${best.hi.values[best.i].mean.toFixed(1)}.`];
  }

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
  const norm = (s) => String(s || '').trim().toLowerCase().replace(/[’']/g, "'");

  // Accepts numeric values or choice text. Keeps only real responses from people who agreed.
  function readExport(text) {
    const rows = parseCSV(text);
    if (!rows.length) throw new Error('The file is empty.');
    const head = rows[0].map((h) => h.trim());
    const col = (name) => head.indexOf(name);
    const statementIds = ITEMS.concat(OVERALL).map((it) => it.id);
    if (!statementIds.some((id) => col(id) >= 0)) throw new Error('This does not look like an export of the Relief Maps survey: columns such as MEET_SAFE are missing.');
    const agreement = (raw) => {
      const v = String(raw == null ? '' : raw).trim();
      if (/^\d$/.test(v)) return valid(Number(v));
      const i = SCALE.findIndex((s) => norm(s) === norm(v));
      return i >= 0 ? i + 1 : null;
    };
    const choice = (q, raw) => {
      const v = String(raw == null ? '' : raw).trim();
      if (/^\d+$/.test(v)) { const n = Number(v); return n >= 1 && n <= q.options.length ? n - 1 : null; }
      const i = q.options.findIndex((o) => norm(o) === norm(v));
      return i >= 0 ? i : null;
    };
    const out = { people: [], declined: 0, tests: 0, comments: 0, identifying: false };
    rows.slice(1).forEach((r) => {
      const first = (r[0] || '').trim();
      if (first.startsWith('{"ImportId"') || first === 'Start Date' || first === 'Response ID') return; // extra header rows
      if (statementIds.some((id) => col(id) >= 0 && String(r[col(id)] || '').length > 30)) return; // question-text row
      const status = col('Status') >= 0 ? String(r[col('Status')] || '').trim() : '';
      if (['1', '2', '8', '9', '12', '17'].includes(status) || /preview|test|spam/i.test(status)) { out.tests += 1; return; }
      if (col(CONSENT.id) >= 0 && choice(CONSENT, r[col(CONSENT.id)]) !== 0) { out.declined += 1; return; }
      if (IDENTIFYING.some((n) => col(n) >= 0 && String(r[col(n)] || '').trim())) out.identifying = true;
      const items = {};
      statementIds.forEach((id) => { items[id] = col(id) >= 0 ? agreement(r[col(id)]) : null; });
      const ident = {};
      IDENTITY.forEach((q) => { const c = choice(q, col(q.id) >= 0 ? r[col(q.id)] : ''); ident[q.id] = c != null && c < q.groups ? c : null; });
      REFLECTION.forEach((q) => { if (col(q.id) >= 0 && String(r[col(q.id)] || '').trim() && String(r[col(q.id)]).trim() !== '-99') out.comments += 1; });
      if (Object.values(items).some((v) => v != null)) out.people.push({ items, ident });
    });
    return out;
  }

  // ---------- fictional sample team ----------
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

  // Made-up patterns that reflect common workplace barriers, not traits of any group.
  const SAMPLE = {
    size: 40, declined: 2, skippedAboutYou: 3,
    counts: { AGE_GROUP: [12, 16, 7, 2], GENDER: [18, 15, 2, 2], DISABILITY: [6, 29, 2], MINORITY: [9, 24, 2, 2], PARENT_DEGREE: [21, 12, 2, 2] },
    base: {
      MEET: { SAFE: 3.6, BELONG: 3.9, COMFORT: 3.9 }, SUPV: { SAFE: 4.0, BELONG: 3.9, COMFORT: 4.1 }, ONLINE: { SAFE: 3.5, BELONG: 3.3, COMFORT: 3.6 },
      SOCIAL: { SAFE: 3.7, BELONG: 3.3, COMFORT: 3.6 }, LEARN: { SAFE: 3.4, BELONG: 3.3, COMFORT: 3.4 }, DECIDE: { SAFE: 2.7, BELONG: 2.8, COMFORT: 2.9 }
    },
    overall: { OV_BELONG: 3.8, OV_SUPPORT: 3.4, OV_CONCERNS: 3.2, OV_RESPECT: 4.0, OV_COLLAB: 3.6 },
    effects: { 'GENDER-0': { SOCIAL: -0.45, DECIDE: -0.2 }, 'GENDER-2': { SOCIAL: -0.6 }, 'AGE_GROUP-0': { DECIDE: -0.55 }, 'AGE_GROUP-2': { LEARN: -0.5 },
      'DISABILITY-0': { SOCIAL: -0.55, MEET: -0.3 }, 'MINORITY-0': { SOCIAL: -0.45, DECIDE: -0.25 }, 'PARENT_DEGREE-1': { SOCIAL: -0.3, LEARN: -0.4 } },
    comments: ['Share the agenda before meetings.', 'Explain how decisions are made.', 'Ask quieter colleagues for their views.', 'Hold social events during the day.', 'Open training to everyone.']
  };

  function sampleTeam() {
    const rand = rng(20261115);
    const normal = () => { let u = 0, v = 0; while (!u) u = rand(); while (!v) v = rand(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
    const shuffle = (a) => { for (let i = a.length - 1; i > 0; i -= 1) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    const people = Array.from({ length: SAMPLE.size }, () => ({ items: {}, ident: {}, aboutYou: 0, comments: {} }));
    const skip = new Set(shuffle(people.map((_, i) => i)).slice(0, SAMPLE.skippedAboutYou));
    const answering = people.map((_, i) => i).filter((i) => !skip.has(i));
    IDENTITY.forEach((q) => {
      const pool = shuffle(SAMPLE.counts[q.id].flatMap((c, g) => Array(c).fill(g)));
      people.forEach((p, i) => { p.ident[q.id] = skip.has(i) ? null : pool[answering.indexOf(i)]; });
    });
    people.forEach((p, i) => {
      p.aboutYou = skip.has(i) ? 1 : 0;
      const personal = normal() * 0.35;
      const shift = (key) => IDENTITY.reduce((a, q) => a + (p.ident[q.id] == null ? 0 : (SAMPLE.effects[`${q.id}-${p.ident[q.id]}`] || {})[key] || 0), 0);
      const answer = (mu) => (rand() < 0.01 ? null : Math.min(5, Math.max(1, Math.round(mu + normal() * 0.6))));
      SETTINGS.forEach((s) => MEASURES.forEach((m) => { p.items[`${s.id}_${m.id}`] = answer(SAMPLE.base[s.id][m.id] + personal + shift(s.id)); }));
      OVERALL.forEach((o) => { p.items[o.id] = answer(SAMPLE.overall[o.id] + personal); });
      REFLECTION.forEach((q) => { p.comments[q.id] = rand() < 0.4 ? SAMPLE.comments[Math.floor(rand() * SAMPLE.comments.length)] : ''; });
    });
    return people;
  }

  const samplePeople = () => sampleTeam().map((p) => ({ items: Object.assign({}, p.items), ident: Object.fromEntries(IDENTITY.map((q) => [q.id, p.ident[q.id] != null && p.ident[q.id] < q.groups ? p.ident[q.id] : null])) }));

  // ---------- files ----------
  // Every question in survey order (DB = text only).
  function questions() {
    const list = [
      { id: 'INTRO', type: 'DB', block: 'Introduction', text: `${SURVEY_TITLE}. ${TEXT.intro}` },
      { id: 'PRIVACY', type: 'DB', block: 'Introduction', text: TEXT.privacy },
      { id: CONSENT.id, type: 'MC', block: 'Introduction', text: CONSENT.question, options: CONSENT.options }
    ];
    SETTINGS.forEach((s, i) => {
      list.push({ id: `${s.id}_INTRO`, type: 'DB', block: 'Workplace settings', text: TEXT.setting(s, i), pageBreakBefore: i > 0 });
      MEASURES.forEach((m) => list.push({ id: `${s.id}_${m.id}`, type: 'MC', block: 'Workplace settings', text: STATEMENTS[s.id][m.id].text, options: SCALE }));
    });
    list.push({ id: 'OV_INTRO', type: 'DB', block: 'Overall', text: TEXT.overall });
    OVERALL.forEach((o) => list.push({ id: o.id, type: 'MC', block: 'Overall', text: o.text, options: SCALE }));
    list.push({ id: 'ABOUT_INTRO', type: 'DB', block: 'About you', text: TEXT.about });
    list.push({ id: ABOUT_YOU.id, type: 'MC', block: 'About you', text: ABOUT_YOU.question, options: ABOUT_YOU.options });
    IDENTITY.forEach((q, i) => list.push({ id: q.id, type: 'MC', block: 'About you', text: q.question, options: q.options, pageBreakBefore: i === 0 }));
    list.push({ id: 'IDEAS_INTRO', type: 'DB', block: 'Your ideas', text: TEXT.ideas });
    REFLECTION.forEach((r) => list.push({ id: r.id, type: 'TE', block: 'Your ideas', text: r.question }));
    return list;
  }

  // Qualtrics Advanced Format TXT: Tools > Import/Export > Import survey.
  function qualtricsTxt() {
    const out = ['[[AdvancedFormat]]', ''];
    let block = null;
    questions().forEach((q) => {
      if (q.block !== block) { block = q.block; out.push(`[[Block:${block}]]`, ''); }
      else if (q.pageBreakBefore) out.push('[[PageBreak]]', '');
      if (q.type === 'DB') out.push('[[Question:DB]]', `[[ID:${q.id}]]`, q.text, '');
      else if (q.type === 'TE') out.push('[[Question:TE:Essay]]', `[[ID:${q.id}]]`, q.text, '');
      else out.push('[[Question:MC:SingleAnswer:Vertical]]', `[[ID:${q.id}]]`, q.text, '[[Choices]]', ...q.options, '');
    });
    return out.join('\n');
  }

  // The sample in the layout of a Qualtrics CSV export (numeric values, "Anonymize responses" on).
  function sampleCSV() {
    const cell = (v) => (v == null ? '' : /[",\n\r]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
    const meta = ['StartDate', 'EndDate', 'Status', 'IPAddress', 'Progress', 'Duration (in seconds)', 'Finished', 'RecordedDate', 'ResponseId', 'DistributionChannel', 'UserLanguage'];
    const cols = questions().filter((q) => q.type !== 'DB');
    const rand = rng(7);
    const rid = () => 'R_' + Array.from({ length: 15 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'[Math.floor(rand() * 56)]).join('');
    const lines = [meta.concat(cols.map((c) => c.id)), meta.concat(cols.map((c) => c.text)), meta.map((m) => `{"ImportId":"${m}"}`).concat(cols.map((c, i) => `{"ImportId":"QID${i + 1}"}`))];
    const team = sampleTeam();
    const rows = team.slice(0, 15).concat([null], team.slice(15, 30), [null], team.slice(30));
    rows.forEach((p, i) => {
      const date = `2026-11-${String(3 + (i % 9)).padStart(2, '0')} ${String(9 + (i % 8)).padStart(2, '0')}:${String((i * 7) % 50).padStart(2, '0')}:00`;
      const values = cols.map((c) => {
        if (c.id === CONSENT.id) return p ? 1 : 2;
        if (!p) return '';
        if (c.id === ABOUT_YOU.id) return p.aboutYou + 1;
        const q = IDENTITY.find((x) => x.id === c.id);
        if (q) return p.ident[q.id] == null ? '' : p.ident[q.id] + 1;
        if (c.type === 'TE') return p.comments[c.id];
        return p.items[c.id] == null ? '' : p.items[c.id];
      });
      lines.push([date, date, 0, '', 100, p ? 240 + Math.floor(rand() * 180) : 25, 1, date, rid(), 'anonymous', 'EN'].concat(values));
    });
    return lines.map((l) => l.map(cell).join(',')).join('\r\n') + '\r\n';
  }

  return { SURVEY_TITLE, SCALE, MIN_GROUP, MEASURES, DIMENSIONS, SETTINGS, STATEMENTS, ITEMS, OVERALL, CONSENT, ABOUT_YOU, IDENTITY, REFLECTION, TEXT,
    settingScore, map, dimensionAverages, overall, groups, summary, groupSummary, parseCSV, readExport, sampleTeam, samplePeople, questions, qualtricsTxt, sampleCSV };
});
