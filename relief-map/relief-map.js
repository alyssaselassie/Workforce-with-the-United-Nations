// Team Relief Map: survey definitions, Qualtrics export parsing, privacy rules and the
// fictional sample team. Runs in the browser (window.ReliefMap) and in Node (require).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ReliefMap = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------- the survey ----------
  // Each setting is one matrix question; its ID is the export column prefix (TM_1 ... TM_5).
  const SETTINGS = [
    { id: 'TM', label: 'Team meetings', short: 'Meetings', prompt: 'Think about your team meetings, in person or online.' },
    { id: 'SUP', label: 'One-on-ones with supervisor', short: '1-on-1s', prompt: 'Think about one-on-one conversations with your supervisor.' },
    { id: 'VIR', label: 'Virtual and hybrid work', short: 'Virtual', prompt: 'Think about virtual and hybrid collaboration: calls, chat and shared documents.' },
    { id: 'NET', label: 'Informal and social spaces', short: 'Informal', prompt: 'Think about informal moments: breaks, lunches, social events and networking.' },
    { id: 'DEV', label: 'Learning and development', short: 'Learning', prompt: 'Think about training, mentoring and opportunities to grow.' },
    { id: 'DEC', label: 'Decision-making', short: 'Decisions', prompt: 'Think about the spaces where priorities and resources are decided.' }
  ];

  const ITEMS = [
    { key: 'belonging', label: 'Belonging', text: 'I feel that I belong.',
      source: 'New item, informed by the COPSOQ III "sense of community at work" scale and Qualtrics employee experience belonging items.' },
    { key: 'safety', label: 'Psychological safety', text: 'It is safe to take a risk here.',
      source: 'Adapted from Edmondson (1999): "It is safe to take a risk on this team."' },
    { key: 'inclusion', label: 'Inclusion', text: 'My skills and perspective are valued.',
      source: 'Adapted from Edmondson (1999): "my unique skills and talents are valued and utilized."' },
    { key: 'voice', label: 'Voice', text: 'I feel comfortable expressing a different opinion.',
      source: 'Example item from the assignment sheet; related to Edmondson (1999): "able to bring up problems and tough issues."' },
    { key: 'comfort', label: 'Comfort', text: 'I feel at ease.', source: 'New item written for the Relief Map.' }
  ];

  // Answer codes follow the order below: 1 to 5, and 6 for "Does not apply to me".
  const SCALE = ['Strongly disagree', 'Disagree', 'Neither agree nor disagree', 'Agree', 'Strongly agree', 'Does not apply to me'];

  // Optional identity questions. The last option is always "Prefer not to say" and is never plotted.
  const DIMENSIONS = [
    { id: 'D_ROLE', label: 'Role category', question: 'Which best describes your role?',
      options: ['National or local staff', 'International staff', 'Consultant, contractor, intern or volunteer', 'Other', 'Prefer not to say'],
      short: ['National or local staff', 'International staff', 'Consultants and interns', 'Other roles'],
      noun: ['national or local staff', 'international staff', 'consultants and interns', 'people in other roles'] },
    { id: 'D_GENDER', label: 'Gender', question: 'How do you describe your gender?',
      options: ['Woman', 'Man', 'Non-binary or another gender', 'Prefer not to say'],
      short: ['Women', 'Men', 'Non-binary or another gender'],
      noun: ['women', 'men', 'non-binary people and people of another gender'] },
    { id: 'D_AGE', label: 'Age group', question: 'What is your age group?',
      options: ['Under 35', '35 to 49', '50 or older', 'Prefer not to say'],
      short: ['Under 35', '35 to 49', '50 or older'],
      noun: ['people under 35', 'people aged 35 to 49', 'people 50 or older'] },
    { id: 'D_LANG', label: 'Working language', question: 'Do you usually work in a language that is not your first language?',
      options: ['Yes', 'No', 'Prefer not to say'],
      short: ['Second language', 'First language'],
      noun: ['people working in a second language', 'people working in their first language'] },
    { id: 'D_DISAB', label: 'Disability', question: 'Do you identify as a person with a disability?',
      options: ['Yes', 'No', 'Prefer not to say'],
      short: ['With a disability', 'Without a disability'],
      noun: ['persons with disabilities', 'persons without disabilities'] }
  ];

  const REFLECTION = { id: 'REFLECT', question: 'What is one enhancement that would make your team or workplace environment more collaborative and innovative?' };

  const MIN_ITEMS = 3; // a setting score needs at least 3 of its 5 statements answered
  const MIN_GROUP = 5; // smallest group ever shown

  // ---------- scoring ----------
  // Discomfort runs from 1 (very comfortable) to 5 (very uncomfortable), so higher lines mean more
  // discomfort, as in the original Relief Maps.
  function settingScore(answers) {
    const valid = (answers || []).filter((v) => v >= 1 && v <= 5);
    if (valid.length < MIN_ITEMS) return null;
    return 6 - valid.reduce((a, b) => a + b, 0) / valid.length;
  }

  function mean(values) {
    return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
  }

  // Team-level averages for one comparison. Privacy rules, applied to each setting separately:
  // - nothing is shown for fewer than k respondents;
  // - a group is shown only with at least k respondents;
  // - everyone in smaller groups, "Prefer not to say" or no answer is pooled, and the pool must be
  //   empty or at least k, so a hidden group can't be worked out from the others and the team line;
  // - at least two groups must be shown to compare.
  function aggregate(respondents, dimId, k) {
    k = Math.max(MIN_GROUP, k || MIN_GROUP);
    const scored = respondents.map((r) => ({ r, s: Object.fromEntries(SETTINGS.map((st) => [st.id, settingScore(r.answers[st.id])])) }));
    const overall = SETTINGS.map((st) => {
      const vals = scored.map((x) => x.s[st.id]).filter((v) => v != null);
      return vals.length >= k ? { mean: mean(vals), n: vals.length } : { hidden: true, n: vals.length };
    });
    const result = { k, dimension: null, series: [{ key: 'all', label: 'Everyone', values: overall }], notes: [] };
    if (!dimId) return result;

    const dim = DIMENSIONS.find((d) => d.id === dimId);
    result.dimension = dim;
    const groups = dim.options.slice(0, -1).map((label, gi) => ({ key: `${dimId}-${gi}`, label: dim.short[gi] || label, noun: dim.noun[gi] || label, gi, values: [] }));
    const hiddenSettings = [];
    SETTINGS.forEach((st, si) => {
      const valid = scored.filter((x) => x.s[st.id] != null);
      const perGroup = groups.map((g) => valid.filter((x) => x.r.dims[dimId] === g.gi).map((x) => x.s[st.id]));
      const shown = perGroup.map((vals) => vals.length >= k);
      const shownCount = shown.filter(Boolean).length;
      const pooled = valid.length - perGroup.reduce((a, vals, gi) => a + (shown[gi] ? vals.length : 0), 0);
      const ok = valid.length >= k && shownCount >= 2 && (pooled === 0 || pooled >= k);
      if (!ok) hiddenSettings.push(st.label);
      groups.forEach((g, gi) => {
        g.values[si] = ok && shown[gi] ? { mean: mean(perGroup[gi]), n: perGroup[gi].length } : { hidden: true, n: perGroup[gi].length };
      });
    });
    const visible = groups.filter((g) => g.values.some((v) => !v.hidden));
    result.series = result.series.concat(visible);
    if (!visible.length) {
      result.notes.push(`No ${dim.label.toLowerCase()} lines are shown: at least two groups need ${k} or more people, and the people in smaller groups or who chose not to answer must also number 0 or at least ${k}.`);
    } else if (hiddenSettings.length) {
      result.notes.push(`Some ${dim.label.toLowerCase()} points are hidden to protect anonymity (${hiddenSettings.join(', ').toLowerCase()}): there, a group, or the people who chose not to say, number fewer than ${k}.`);
    }
    const smallGroups = groups.filter((g) => !visible.includes(g) && g.values.some((v) => v.n > 0));
    if (visible.length && smallGroups.length) {
      result.notes.push(`Not shown, to protect anonymity: ${smallGroups.map((g) => g.noun).join(', ')} (fewer than ${k} people).`);
    }
    return result;
  }

  // Average by statement for everyone, to see what drives discomfort in each setting.
  function itemAverages(respondents, k) {
    k = Math.max(MIN_GROUP, k || MIN_GROUP);
    return SETTINGS.map((st) => ITEMS.map((_, ii) => {
      const vals = respondents.map((r) => (r.answers[st.id] || [])[ii]).filter((v) => v >= 1 && v <= 5).map((v) => 6 - v);
      return vals.length >= k ? { mean: mean(vals), n: vals.length } : { hidden: true, n: vals.length };
    }));
  }

  // ---------- plain-language summary ----------
  function summarize(agg) {
    const all = agg.series[0].values;
    const shown = SETTINGS.map((st, i) => ({ st, v: all[i] })).filter((x) => !x.v.hidden);
    if (!shown.length) return [`There are not enough responses yet. Results appear once at least ${agg.k} people have answered.`];
    const sorted = shown.slice().sort((a, b) => b.v.mean - a.v.mean);
    const fmt = (x) => `${x.st.label.toLowerCase()} (${x.v.mean.toFixed(1)})`;
    const out = [`For the whole team, discomfort is highest in ${fmt(sorted[0])} and lowest in ${fmt(sorted[sorted.length - 1])}.`];
    const gaps = [];
    const groups = agg.series.slice(1);
    SETTINGS.forEach((st, i) => {
      const pts = groups.map((g) => ({ g, v: g.values[i] })).filter((x) => !x.v.hidden);
      if (pts.length < 2) return;
      pts.sort((a, b) => b.v.mean - a.v.mean);
      gaps.push({ st, hi: pts[0], lo: pts[pts.length - 1], gap: pts[0].v.mean - pts[pts.length - 1].v.mean });
    });
    gaps.sort((a, b) => b.gap - a.gap);
    gaps.filter((x) => x.gap >= 0.3).slice(0, 2).forEach((x) => {
      out.push(`${x === gaps[0] ? 'The biggest gap' : 'Another gap'} is in ${x.st.label.toLowerCase()}: ${x.hi.g.noun} report ${x.hi.v.mean.toFixed(1)}, compared with ${x.lo.v.mean.toFixed(1)} for ${x.lo.g.noun}.`);
    });
    if (agg.dimension && groups.length && !gaps.some((x) => x.gap >= 0.3)) out.push('The groups shown report similar levels of comfort in every setting.');
    return out;
  }

  // ---------- CSV ----------
  function parseCSV(text) {
    const rows = [];
    let row = [], field = '', inQuotes = false;
    text = String(text).replace(/^﻿/, '');
    for (let i = 0; i < text.length; i += 1) {
      const c = text[i];
      if (inQuotes) {
        if (c === '"' && text[i + 1] === '"') { field += '"'; i += 1; }
        else if (c === '"') inQuotes = false;
        else field += c;
      } else if (c === '"') inQuotes = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i += 1;
        row.push(field); rows.push(row); row = []; field = '';
      } else field += c;
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    return rows.filter((r) => r.some((v) => v !== ''));
  }

  const csvCell = (v) => (/[",\n\r]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));

  const IDENTIFYING = ['IPAddress', 'RecipientLastName', 'RecipientFirstName', 'RecipientEmail', 'ExternalReference', 'LocationLatitude', 'LocationLongitude'];

  // Reads a Qualtrics CSV export (numeric values or choice text) of the Relief Map survey.
  function fromQualtrics(text) {
    const rows = parseCSV(text);
    if (!rows.length) throw new Error('The file is empty.');
    const head = rows[0].map((h) => h.trim());
    const col = (name) => head.indexOf(name);
    const matrixCols = SETTINGS.flatMap((st) => ITEMS.map((_, ii) => col(`${st.id}_${ii + 1}`)));
    if (!matrixCols.some((c) => c >= 0)) {
      throw new Error('This file does not look like an export of the Relief Map survey: columns such as TM_1 and DEC_5 are missing.');
    }
    const scaleCode = (raw) => {
      const v = String(raw || '').trim();
      if (!v) return null;
      if (/^\d+$/.test(v)) return Number(v);
      const i = SCALE.findIndex((s) => s.toLowerCase() === v.toLowerCase());
      return i >= 0 ? i + 1 : null;
    };
    const dimCode = (dim, raw) => {
      const v = String(raw || '').trim();
      if (!v) return null;
      if (/^\d+$/.test(v)) { const n = Number(v); return n >= 1 && n <= dim.options.length ? n - 1 : null; }
      const i = dim.options.findIndex((o) => o.toLowerCase() === v.toLowerCase());
      return i >= 0 ? i : null;
    };
    const status = col('Status'), channel = col('DistributionChannel');
    const respondents = [];
    let skipped = 0, comments = 0, identifying = false;
    rows.slice(1).forEach((r) => {
      const first = (r[0] || '').trim();
      if (first.startsWith('{"ImportId"') || first === 'Start Date' || first === 'Response ID') return; // the two extra header rows
      if (matrixCols.some((c) => c >= 0 && r[c] && !scaleCode(r[c]) && /[a-z]{4}/i.test(r[c]) && r[c].length > 30)) return; // question-text row
      const st = status >= 0 ? String(r[status] || '').trim() : '';
      const ch = channel >= 0 ? String(r[channel] || '').trim().toLowerCase() : '';
      if (['1', '2', '8', '9', '12', '17'].includes(st) || /preview|test|spam/i.test(st) || ch === 'preview' || ch === 'test') { skipped += 1; return; }
      if (IDENTIFYING.some((name) => col(name) >= 0 && String(r[col(name)] || '').trim() !== '')) identifying = true;
      const answers = {};
      SETTINGS.forEach((s) => {
        answers[s.id] = ITEMS.map((_, ii) => {
          const c = col(`${s.id}_${ii + 1}`);
          const code = c >= 0 ? scaleCode(r[c]) : null;
          return code >= 1 && code <= 5 ? code : null; // 6, "Does not apply", is not counted
        });
      });
      const dims = {};
      DIMENSIONS.forEach((d) => { const c = col(d.id); dims[d.id] = c >= 0 ? dimCode(d, r[c]) : null; });
      const rc = col(REFLECTION.id);
      if (rc >= 0 && String(r[rc] || '').trim()) comments += 1;
      if (SETTINGS.some((s) => answers[s.id].some((v) => v != null))) respondents.push({ answers, dims });
    });
    return { respondents, skipped, comments, identifying };
  }

  // ---------- the fictional sample team ----------
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

  // Fictional patterns that reflect structural barriers (hierarchy, contract type, language and
  // after-hours socializing), not traits of any group.
  const SAMPLE = {
    size: 48,
    counts: {
      D_ROLE: [21, 15, 7, 0, 5], D_GENDER: [25, 17, 2, 4], D_AGE: [14, 19, 9, 6], D_LANG: [27, 15, 6], D_DISAB: [3, 40, 5]
    },
    base: { TM: 3.95, SUP: 4.05, VIR: 3.7, NET: 3.45, DEV: 3.55, DEC: 3.2 }, // average agreement, 1 to 5
    items: { voice: { TM: -0.15, DEC: -0.25 }, safety: { DEC: -0.2 }, belonging: { NET: -0.1 } },
    effects: {
      'D_ROLE-0': { DEC: -0.75, DEV: -0.35, TM: -0.15 },
      'D_ROLE-1': { DEC: 0.35, DEV: 0.2 },
      'D_ROLE-2': { DEV: -0.85, NET: -0.45, DEC: -0.4 },
      'D_GENDER-0': { NET: -0.55, DEC: -0.2 },
      'D_GENDER-1': { NET: 0.2, DEC: 0.15 },
      'D_AGE-0': { DEC: -0.5, SUP: -0.15 },
      'D_LANG-0': { VIR: -0.9, TM: -0.6, DEC: -0.2 },
      'D_DISAB-0': { NET: -0.6, VIR: -0.3 }
    },
    notApplicable: { DEC: 5, DEV: 2, SUP: 1 },
    themes: [
      ['Share agendas and documents before meetings', 6],
      ['Rotate meeting times across time zones', 4],
      ['Open stretch assignments and training to consultants', 4],
      ['Hold social events during working hours', 3],
      ['Explain how decisions are made, and who decides', 3]
    ],
    comments: [
      'Share the agenda a day ahead so everyone can prepare.',
      'Rotate meeting times so colleagues in other time zones are not always on late calls.',
      'Let consultants join trainings and stretch assignments.',
      'Have team lunches during the day instead of evening drinks.',
      'Explain how priorities are decided and who is in the room.',
      'Use the chat and written input in calls, not only speaking.',
      'Send documents before meetings, not during.',
      'Rotate who chairs the weekly meeting.'
    ]
  };

  function sampleRespondents() {
    const rand = rng(20261113);
    const normal = () => { let u = 0, v = 0; while (!u) u = rand(); while (!v) v = rand(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
    const shuffle = (arr) => { for (let i = arr.length - 1; i > 0; i -= 1) { const j = Math.floor(rand() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
    const people = Array.from({ length: SAMPLE.size }, () => ({ answers: {}, dims: {} }));
    DIMENSIONS.forEach((d) => {
      const pool = shuffle(SAMPLE.counts[d.id].flatMap((n, gi) => Array(n).fill(gi)));
      people.forEach((p, i) => { p.dims[d.id] = pool[i]; });
    });
    const na = {};
    Object.entries(SAMPLE.notApplicable).forEach(([sid, n]) => { na[sid] = new Set(shuffle(people.map((_, i) => i)).slice(0, n)); });
    people.forEach((p, pi) => {
      const personal = normal() * 0.3;
      SETTINGS.forEach((st) => {
        let mu = SAMPLE.base[st.id] + personal;
        DIMENSIONS.forEach((d) => { mu += (SAMPLE.effects[`${d.id}-${p.dims[d.id]}`] || {})[st.id] || 0; });
        p.answers[st.id] = ITEMS.map((it) => {
          if (na[st.id] && na[st.id].has(pi)) return 6;
          if (rand() < 0.02) return null;
          const v = Math.round(mu + ((SAMPLE.items[it.key] || {})[st.id] || 0) + normal() * 0.6);
          return Math.min(5, Math.max(1, v));
        });
      });
      p.comment = rand() < 0.3 ? SAMPLE.comments[Math.floor(rand() * SAMPLE.comments.length)] : '';
    });
    return people;
  }

  // The sample in the layout of a Qualtrics CSV export (numeric values), for testing the import.
  function toQualtricsCSV(people) {
    const meta = ['StartDate', 'EndDate', 'Status', 'IPAddress', 'Progress', 'Duration (in seconds)', 'Finished', 'RecordedDate', 'ResponseId',
      'RecipientLastName', 'RecipientFirstName', 'RecipientEmail', 'ExternalReference', 'LocationLatitude', 'LocationLongitude', 'DistributionChannel', 'UserLanguage'];
    const qCols = SETTINGS.flatMap((st) => ITEMS.map((_, ii) => `${st.id}_${ii + 1}`)).concat(DIMENSIONS.map((d) => d.id), [REFLECTION.id]);
    const text = SETTINGS.flatMap((st) => ITEMS.map((it) => `${st.label}. ${st.prompt} How much do you agree with each statement? - ${it.text}`))
      .concat(DIMENSIONS.map((d) => d.question), [REFLECTION.question]);
    const metaText = ['Start Date', 'End Date', 'Response Type', 'IP Address', 'Progress', 'Duration (in seconds)', 'Finished', 'Recorded Date', 'Response ID',
      'Recipient Last Name', 'Recipient First Name', 'Recipient Email', 'External Data Reference', 'Location Latitude', 'Location Longitude', 'Distribution Channel', 'User Language'];
    const ids = meta.map((m) => `{"ImportId":"${m.replace(/ \(in seconds\)/, '').replace(/^./, (c) => c.toLowerCase())}"}`)
      .concat(SETTINGS.flatMap((st, si) => ITEMS.map((_, ii) => `{"ImportId":"QID${si + 3}_${ii + 1}"}`)), DIMENSIONS.map((_, di) => `{"ImportId":"QID${di + 11}"}`), ['{"ImportId":"QID17_TEXT"}']);
    const rand = rng(7);
    const rid = () => 'R_' + Array.from({ length: 15 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'[Math.floor(rand() * 56)]).join('');
    const lines = [meta.concat(qCols), metaText.concat(text), ids];
    people.forEach((p, i) => {
      const day = 2 + (i % 9), mins = 4 + Math.floor(rand() * 5), secs = mins * 60 + Math.floor(rand() * 60);
      const start = `2026-11-${String(day).padStart(2, '0')} ${String(9 + (i % 8)).padStart(2, '0')}:${String((i * 7) % 60).padStart(2, '0')}:00`;
      const end = start.replace(/(\d\d):(\d\d):00$/, (m, h, mi) => `${h}:${String(Math.min(59, Number(mi) + mins)).padStart(2, '0')}:00`);
      const answers = SETTINGS.flatMap((st) => p.answers[st.id].map((v) => (v == null ? '' : v)));
      const dims = DIMENSIONS.map((d) => p.dims[d.id] + 1);
      lines.push([start, end, 0, '', 100, secs, 1, end, rid(), '', '', '', '', '', '', 'anonymous', 'EN'].concat(answers, dims, [p.comment || '']));
    });
    return lines.map((l) => l.map(csvCell).join(',')).join('\r\n') + '\r\n';
  }

  // ---------- Qualtrics import file (Advanced Format TXT) ----------
  function qualtricsTxt() {
    const out = ['[[AdvancedFormat]]', '', '[[Block:Introduction]]', '',
      '[[Question:DB]]', '[[ID:INTRO]]',
      'Team Relief Map. This short survey (about 6 minutes) asks how you experience six everyday workplace settings. It helps your team see where people feel most included, and where things could improve.',
      '', '[[Question:DB]]', '[[ID:PRIVACY]]',
      'Your answers are anonymous. We do not ask for your name or staff ID, and the survey does not record your IP address or location. Every question is optional, and you can stop at any time. Results are shown only as team averages, and only for groups of at least 5 people. Individual answers are never shared with supervisors, and comments are summarized as themes, never quoted. By continuing, you agree to take part.',
      '', '[[PageBreak]]', '', '[[Block:Workplace settings]]', ''];
    SETTINGS.forEach((st, si) => {
      out.push('[[Question:Matrix]]', `[[ID:${st.id}]]`, `${st.label}. ${st.prompt} How much do you agree with each statement?`, '[[Choices]]');
      ITEMS.forEach((it) => out.push(it.text));
      out.push('[[Answers]]');
      SCALE.forEach((s) => out.push(s));
      out.push('', '[[PageBreak]]', '');
    });
    out.push('[[Block:About you]]', '', '[[Question:DB]]', '[[ID:ABOUT]]',
      'These optional questions let the team see whether experiences differ between groups. A group is shown only when at least 5 people are in it, and you can choose "Prefer not to say" for any question.', '');
    DIMENSIONS.forEach((d) => {
      out.push('[[Question:MC:SingleAnswer:Vertical]]', `[[ID:${d.id}]]`, d.question, '[[Choices]]');
      d.options.forEach((o) => out.push(o));
      out.push('');
    });
    out.push('[[PageBreak]]', '', '[[Block:Reflection]]', '', '[[Question:TE:Essay]]', `[[ID:${REFLECTION.id}]]`,
      `${REFLECTION.question} Please do not include names or details that could identify you or anyone else.`, '',
      '[[Question:DB]]', '[[ID:THANKS]]', 'Thank you. When you are ready, select the arrow to submit your answers.', '');
    return out.join('\n');
  }

  return { SETTINGS, ITEMS, SCALE, DIMENSIONS, REFLECTION, MIN_GROUP, MIN_ITEMS, SAMPLE,
    settingScore, aggregate, itemAverages, summarize, parseCSV, fromQualtrics, sampleRespondents, toQualtricsCSV, qualtricsTxt };
});
