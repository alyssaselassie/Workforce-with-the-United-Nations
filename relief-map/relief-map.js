// Relief Maps Tool: the survey (single source of truth for every question), scoring, missing-data
// and privacy rules, Qualtrics import/export helpers and the fictional sample team.
// Runs in the browser (window.ReliefMap) and in Node (require).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ReliefMap = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const VERSION = '2.0';
  const PROJECT_TITLE = 'Relief Maps Tool: Visualizing Well-Being Across Work & Learning Spaces';
  const SURVEY_TITLE = 'Relief Maps: Workplace Experience Survey';

  // ---------- design constants ----------
  const SCALE = ['Strongly disagree', 'Disagree', 'Neither agree nor disagree', 'Agree', 'Strongly agree']; // codes 1 to 5
  const SKIPPED = -99;          // Qualtrics export option "Recode seen but unanswered questions as -99"
  const SHOWN_PER_SETTING = 3;  // each person sees 3 of the 5 statements in a setting, picked at random (evenly)
  const MIN_SETTING_ITEMS = 2;  // a person's setting score needs at least 2 answers from the 3 statements they saw
  const MIN_OVERALL_ITEMS = 3;  // the overall index needs at least 3 of the 5 overall statements
  const MIN_GROUP = 5;          // no number is ever shown for fewer than 5 answers
  const MIN_THEME = 3;          // a comment theme is reported only if at least 3 people raised it

  // Score bands (higher = more positive).
  const BANDS = [
    { min: 4, key: 'strong', label: 'Strong', text: '4.0 or higher: most people agree' },
    { min: 3, key: 'mixed', label: 'Mixed', text: '3.0 to 3.9: mixed or lukewarm' },
    { min: 1, key: 'concern', label: 'Area of concern', text: 'below 3.0: more disagreement than agreement' }
  ];
  const band = (v) => BANDS.find((b) => v >= b.min) || BANDS[BANDS.length - 1];

  // ---------- references ----------
  const REFS = {
    edmondson: { short: 'Edmondson (1999)', full: 'Edmondson, A. (1999). Psychological safety and learning behavior in work teams. Administrative Science Quarterly, 44(2), 350–383.', url: 'https://doi.org/10.2307/2666999' },
    copsoq: { short: 'COPSOQ III (Burr et al., 2019)', full: 'Burr, H., Berthelsen, H., Moncada, S., et al. (2019). The third version of the Copenhagen Psychosocial Questionnaire. Safety and Health at Work, 10(4), 482–503.', url: 'https://doi.org/10.1016/j.shaw.2019.10.002' },
    spos: { short: 'Eisenberger et al. (1986)', full: 'Eisenberger, R., Huntington, R., Hutchison, S., & Sowa, D. (1986). Perceived organizational support. Journal of Applied Psychology, 71(3), 500–507.', url: 'https://doi.org/10.1037/0021-9010.71.3.500' },
    gss: { short: 'UK GSS harmonised standard', full: 'Government Statistical Service (UK). Socio-economic background harmonised standard. Analysis Function, UK Civil Service.', url: 'https://analysisfunction.civilservice.gov.uk/policy-store/socio-economic-background-harmonised-standard/' },
    wg: { short: 'Washington Group (WG-SS)', full: 'Washington Group on Disability Statistics. The Washington Group Short Set on Functioning (WG-SS).', url: 'https://www.washingtongroup-disability.com/' },
    rodo: { short: 'Rodó-Zárate (2023)', full: 'Rodó-Zárate, M. (2023). Intersectionality and the spatiality of emotions in feminist research. The Professional Geographer, 75(4), 676–681.', url: 'https://doi.org/10.1080/00330124.2022.2075406' },
    qualtrics: { short: 'Qualtrics support', full: 'Qualtrics XM support: Question Randomization, Security Survey Options (Anonymize responses), Data Export Options, Survey Accessibility and Mobile Survey Optimization.', url: 'https://www.qualtrics.com/support/' }
  };

  // How each question came about. No question is used unchanged from a published scale, so none of
  // them should be described as validated: testing reliability and validity is part of the pilot.
  const SOURCE_KINDS = {
    adapted: { label: 'Adapted', text: 'Adapted from an item in an established instrument; the wording was changed, so it is not validated in this form.' },
    brief: { label: 'From the project brief', text: 'Wording from the project brief, related to an established instrument where noted.' },
    new: { label: 'New', text: 'Newly written for this survey, informed by the concept noted.' }
  };

  // ---------- the five experience dimensions (the lines on the Relief Map) ----------
  // Colours were checked with a colour-vision validator; each line also has its own marker shape.
  const DIMENSIONS = [
    { id: 'PS', label: 'Psychological safety', short: 'Safety', noun: 'psychological safety', color: '#0072b2', marker: 'square',
      definition: 'Feeling able to take interpersonal risks (asking questions, admitting mistakes, raising problems, being different) without fear of negative consequences.',
      basis: 'Edmondson (1999)' },
    { id: 'BEL', label: 'Belonging', short: 'Belonging', noun: 'belonging', color: '#a44a8c', marker: 'circle',
      definition: 'Feeling accepted, connected and part of the group, with supportive relationships.',
      basis: 'COPSOQ III: Sense of community at work; social support' },
    { id: 'INC', label: 'Inclusion', short: 'Inclusion', noun: 'inclusion', color: '#d55e00', marker: 'triangle',
      definition: 'Being valued, treated fairly and given equal access to information, relationships and opportunities.',
      basis: 'Edmondson (1999); COPSOQ III: Organizational justice; Possibilities for development' },
    { id: 'VOI', label: 'Voice and participation', short: 'Voice', noun: 'voice and participation', color: '#009e73', marker: 'diamond',
      definition: 'Being able to speak up, take part and influence what happens, and being listened to.',
      basis: 'Edmondson (1999); COPSOQ III: Influence at work; Social support from supervisor' },
    { id: 'COM', label: 'Comfort and well-being', short: 'Comfort', noun: 'comfort and well-being', color: '#7d6608', marker: 'triangle-down',
      definition: 'Feeling at ease, rather than tense or anxious, in the setting.',
      basis: 'Relief Maps: comfort and discomfort in places (Rodó-Zárate)' }
  ];

  // ---------- the six workplace settings (the x axis) ----------
  const SETTINGS = [
    { id: 'TM', label: 'Team meetings', short: 'Meetings',
      focus: 'Expressing opinions, taking part in discussions and disagreeing respectfully.',
      intro: 'Think about your team meetings, in person or online.' },
    { id: 'SUP', label: 'One-on-ones with supervisor', short: '1-on-1s',
      focus: 'Raising concerns, receiving feedback and asking questions.',
      intro: 'Think about one-on-one conversations with your supervisor, in person or online.' },
    { id: 'VIR', label: 'Virtual and hybrid work', short: 'Virtual',
      focus: 'Taking part in online meetings, communicating remotely and feeling included.',
      intro: 'Think about online meetings, calls, chat and shared documents.' },
    { id: 'NET', label: 'Informal and social spaces', short: 'Informal',
      focus: 'Connecting with colleagues and building professional relationships.',
      intro: 'Think about breaks, lunches, social events and networking with colleagues.' },
    { id: 'DEV', label: 'Learning and development', short: 'Learning',
      focus: 'Mentoring, training, growth opportunities and constructive feedback.',
      intro: 'Think about training, mentoring, feedback and chances to grow.' },
    { id: 'DEC', label: 'Decision-making', short: 'Decisions',
      focus: 'Contributing ideas, influencing decisions and having your perspective considered.',
      intro: 'Think about the meetings and conversations where priorities, plans and resources are decided.' }
  ];

  // ---------- the 30 statements: one per dimension in every setting ----------
  // Export tag = setting + dimension (TM_PS ... DEC_COM). All are positively worded, so 5 is always
  // the most positive answer and nothing needs reverse scoring.
  const S = (text, kind, refs, note) => ({ text, kind, refs, note });
  const STATEMENTS = {
    TM: {
      PS: S('In team meetings, I can admit a mistake without it being held against me.', 'adapted', ['edmondson'],
        'Edmondson (1999): "If you make a mistake on this team, it is often held against you" (reworded positively).'),
      BEL: S('In team meetings, I feel part of the group.', 'new', ['copsoq'], 'COPSOQ III: Sense of community at work.'),
      INC: S('My contributions in team meetings are taken seriously.', 'brief', ['edmondson'],
        'Related to Edmondson (1999): "my unique skills and talents are valued and utilized."'),
      VOI: S('I feel comfortable expressing a different opinion during team meetings.', 'brief', ['edmondson'],
        'Related to Edmondson (1999): "Members of this team are able to bring up problems and tough issues."'),
      COM: S('I feel at ease in team meetings.', 'new', ['rodo'], 'Comfort and discomfort in places, as in Relief Maps.')
    },
    SUP: {
      PS: S('I can ask my supervisor questions without worrying about negative consequences.', 'brief', ['edmondson'],
        'Related to Edmondson (1999): "It is difficult to ask other members of this team for help" (reworded positively).'),
      BEL: S('I can be myself in conversations with my supervisor.', 'new', [], 'Authenticity: being accepted as you are.'),
      INC: S('The feedback I get from my supervisor is fair.', 'new', ['copsoq'], 'COPSOQ III: Organizational justice (fair treatment).'),
      VOI: S('My supervisor listens when I raise a concern.', 'adapted', ['copsoq'],
        'COPSOQ III: Social support from supervisor (a supervisor who is willing to listen to your problems at work).'),
      COM: S('I feel at ease in one-on-one conversations with my supervisor.', 'new', ['rodo'], 'Comfort and discomfort in places, as in Relief Maps.')
    },
    VIR: {
      PS: S('In online meetings, I can ask for clarification without feeling judged.', 'adapted', ['edmondson'],
        'Edmondson (1999): "It is difficult to ask other members of this team for help" (reworded positively).'),
      BEL: S('I feel connected to my colleagues when we work remotely.', 'new', ['copsoq'], 'COPSOQ III: Sense of community at work.'),
      INC: S('I am included in the online conversations that matter for my work.', 'brief', [],
        'Based on the example "I feel included in conversations that affect my work."'),
      VOI: S('In online and hybrid meetings, I get a fair chance to speak.', 'new', [], 'Participation: equal speaking time online.'),
      COM: S('I feel at ease when I collaborate online.', 'new', ['rodo'], 'Comfort and discomfort in places, as in Relief Maps.')
    },
    NET: {
      PS: S('In informal settings at work, I am accepted for who I am.', 'adapted', ['edmondson'],
        'Edmondson (1999): "People on this team sometimes reject others for being different" (reworded positively).'),
      BEL: S('I feel welcome when colleagues get together informally.', 'new', ['copsoq'], 'COPSOQ III: Sense of community at work.'),
      INC: S('I have opportunities to build professional relationships at work.', 'new', [], 'Equal access to informal networks.'),
      VOI: S('I can take part in social activities at work as much as I would like.', 'new', [],
        'Participation, including barriers such as timing, cost, caring duties or accessibility.'),
      COM: S('I feel at ease in informal conversations with colleagues.', 'new', ['rodo'], 'Comfort and discomfort in places, as in Relief Maps.')
    },
    DEV: {
      PS: S('When I am learning something new at work, it is safe to make mistakes.', 'adapted', ['edmondson'],
        'Edmondson (1999): "It is safe to take a risk on this team."'),
      BEL: S('I have someone at work, such as a mentor, who supports my growth.', 'new', ['copsoq'],
        'COPSOQ III: Social support from colleagues and supervisor (supportive relationships).'),
      INC: S('I have fair access to learning and development opportunities.', 'new', ['copsoq'], 'COPSOQ III: Possibilities for development.'),
      VOI: S('I have a say in my own learning and development.', 'adapted', ['copsoq'],
        'COPSOQ III: Influence at work (influence over decisions about your work), applied to development.'),
      COM: S('I feel at ease when I receive feedback on my work.', 'new', ['rodo'], 'Comfort and discomfort in places, as in Relief Maps.')
    },
    DEC: {
      PS: S('It is safe for me to question a decision.', 'adapted', ['edmondson'], 'Edmondson (1999): "It is safe to take a risk on this team."'),
      BEL: S('When decisions are discussed, I feel like a full member of the team.', 'new', [], 'Belonging in spaces of power.'),
      INC: S('My perspective is considered when decisions that affect my work are made.', 'brief', [],
        'Based on "feeling that perspectives are considered."'),
      VOI: S('I have opportunities to contribute to important workplace decisions.', 'brief', ['copsoq'],
        'Related to COPSOQ III: Influence at work.'),
      COM: S('I feel at ease in meetings where decisions are made.', 'new', ['rodo'], 'Comfort and discomfort in places, as in Relief Maps.')
    }
  };

  const ITEMS = SETTINGS.flatMap((st) => DIMENSIONS.map((d) => Object.assign({ id: `${st.id}_${d.id}`, setting: st.id, dim: d.id }, STATEMENTS[st.id][d.id])));
  const itemId = (sid, did) => `${sid}_${did}`;

  // ---------- section 3: overall workplace experience (everyone sees all five) ----------
  const OVERALL = [
    Object.assign({ id: 'OV_BEL', construct: 'Overall belonging', dim: 'BEL' },
      S('Overall, I feel a sense of belonging in my workplace.', 'new', ['copsoq'], 'COPSOQ III: Sense of community at work.')),
    Object.assign({ id: 'OV_SUP', construct: 'Perceived organizational support', dim: 'COM' },
      S('My organization cares about my well-being.', 'adapted', ['spos'],
        'Survey of Perceived Organizational Support (Eisenberger et al., 1986): "The organization really cares about my well-being."')),
    Object.assign({ id: 'OV_CON', construct: 'Confidence to raise concerns', dim: 'VOI' },
      S('I feel confident raising a concern at work without fear of negative consequences.', 'adapted', ['edmondson'],
        'Edmondson (1999): "Members of this team are able to bring up problems and tough issues."')),
    Object.assign({ id: 'OV_RES', construct: 'Respect', dim: 'INC' },
      S('I am treated with respect at work.', 'new', ['copsoq'], 'COPSOQ III: Recognition (respect) and Organizational justice.')),
    Object.assign({ id: 'OV_COL', construct: 'Collaborative ways of working', dim: 'INC' },
      S('My team\'s ways of working encourage collaboration.', 'new', ['copsoq'], 'COPSOQ III: Sense of community at work (cooperation between colleagues).'))
  ];

  // ---------- consent, screener and opt-in ----------
  const CONSENT = { id: 'CONSENT', question: 'I have read the information above and understand that taking part is voluntary and anonymous. Do you agree to take part?',
    options: ['Yes, I agree to take part', 'No, I do not want to take part'] };
  const VIR_USE = { id: 'VIR_USE', question: 'In your current role, do you take part in online meetings, calls or other remote collaboration?',
    options: ['Yes', 'No'] };
  const ID_OPTIN = { id: 'ID_OPTIN', question: 'Would you like to answer these optional questions?',
    options: ['Yes, show me the questions', 'No, skip this part'] };

  // ---------- section 4: optional identity questions ----------
  // `groups` = how many leading options are plotted as groups; the rest ("Not sure", "I don't know",
  // "Prefer not to answer") are never plotted and are pooled for privacy.
  const IDENTITY = [
    { id: 'D_AGE', label: 'Age group', question: 'What is your age group?',
      options: ['Under 35', '35 to 49', '50 or older', 'Prefer not to answer'], groups: 3,
      short: ['Under 35', '35 to 49', '50 or older'], noun: ['people under 35', 'people aged 35 to 49', 'people aged 50 or older'],
      kind: 'new', refs: [], note: 'Three broad bands keep groups large enough to report.' },
    { id: 'D_GENDER', label: 'Gender', question: 'How do you describe your gender?',
      options: ['Woman', 'Man', 'Non-binary or another gender identity', 'Prefer not to answer'], groups: 3,
      short: ['Women', 'Men', 'Non-binary or another gender'], noun: ['women', 'men', 'non-binary people and people of another gender'],
      kind: 'new', refs: [], note: 'No write-in box, so no answer can identify anyone.' },
    { id: 'D_DISAB', label: 'Disability or accessibility', question: 'Do you identify as having a disability, a long-term health condition or an accessibility need?',
      options: ['Yes', 'No', 'Prefer not to answer'], groups: 2,
      short: ['Disability or access need', 'No disability or access need'],
      noun: ['people with a disability, long-term condition or access need', 'people without one'],
      kind: 'new', refs: ['wg'], note: 'Self-identification. For an internationally comparable measure, use the Washington Group Short Set on Functioning (six questions).' },
    { id: 'D_ETHN', label: 'Racial or ethnic minority', question: 'Do you identify as a member of a racial or ethnic minority in your workplace?',
      options: ['Yes', 'No', 'Not sure', 'Prefer not to answer'], groups: 2,
      short: ['Racial or ethnic minority', 'Not a minority'], noun: ['people from a racial or ethnic minority', 'people not in a minority'],
      kind: 'new', refs: [], note: 'Racial and ethnic categories differ between countries, so the question asks about minority status in the workplace. This also keeps groups large enough to report.' },
    { id: 'D_SES', label: "Parents' education", question: 'When you were about 14, did either of your parents or guardians have a university degree (or equivalent)?',
      options: ['Yes', 'No', 'I don\'t know', 'Prefer not to answer'], groups: 2,
      short: ['A parent had a degree', 'No parent had a degree'], noun: ['people with a parent who had a degree', 'people whose parents had no degree'],
      kind: 'adapted', refs: ['gss'], note: 'Adapted from the UK GSS socio-economic background harmonised standard (highest parental qualification at about age 14).' }
  ];

  // ---------- section 5: open reflection ----------
  const REFLECTION = [
    { id: 'REFLECT_1', question: 'Is there a particular workplace environment where you feel especially comfortable, included or supported? What contributes to that experience?' },
    { id: 'REFLECT_2', question: 'What is one change that would make your team or workplace environment more collaborative, inclusive and innovative?' }
  ];

  // ---------- participant-facing text ----------
  const CONTACT = '[research team email]';
  const TEXT = {
    intro: `${SURVEY_TITLE}. This short survey asks how comfortable, included and heard you feel in six everyday workplace settings, such as team meetings, online work and decision-making. Answers from the whole team are combined into a Relief Map that shows where people feel at ease and where there may be barriers. It takes about 5 minutes.`,
    privacy: `Taking part is voluntary: you can skip any question and stop at any time. The survey is anonymous: it does not ask for your name, email or staff ID, and it does not record your IP address or location. Individual answers are never shared with supervisors or anyone else in the organization. Results are reported only as group averages, and never for groups of fewer than ${MIN_GROUP} people. Questions about the survey: ${CONTACT}.`,
    settingIntro: (st, i) => `Setting ${i + 1} of ${SETTINGS.length}: ${st.label}. ${st.intro} How much do you agree with each statement?`,
    virScreen: `Setting 3 of ${SETTINGS.length}: Virtual and hybrid work.`,
    overallIntro: 'Your workplace overall. These statements are about your workplace as a whole. How much do you agree with each one?',
    aboutIntro: `About you (optional). These questions help us see whether experiences differ between groups, so that barriers can be found and removed. Groups of fewer than ${MIN_GROUP} people are never shown, and only one question is compared at a time. You can skip any question or choose "Prefer not to answer".`,
    reflectIntro: 'Your ideas (optional). Please do not include names or details that could identify you or anyone else. Comments are read only by the research team and are reported as themes, never word for word.',
    thanks: `Thank you for taking part. Your answers have been recorded anonymously. They will be combined with your colleagues' answers to create a team Relief Map, so your team can see where people feel comfortable and included, and where things can improve. Results will be shared with the whole team, only as group averages for groups of ${MIN_GROUP} or more people.`,
    declined: 'Thank you for considering this survey. You have chosen not to take part, so no more questions will be asked. You can close this window.'
  };

  // Ideas to discuss for settings that score low or where groups differ.
  const OPPORTUNITIES = {
    TM: 'Share agendas and papers a day ahead, open each item with a round so everyone speaks, rotate who chairs, and accept written input.',
    SUP: 'Hold regular, protected check-ins with open questions, and agree how feedback flows in both directions.',
    VIR: 'Share documents before calls, turn on captions, use the chat and hand-raise, rotate meeting times across time zones and confirm decisions in writing.',
    NET: 'Hold social and networking moments during working hours, vary the formats (not only after-work drinks), make venues accessible and invite newcomers personally.',
    DEV: 'Publish training, mentoring and stretch opportunities openly with clear criteria, and check who has received them.',
    DEC: 'Explain how decisions are made and by whom, ask for input before decisions are final, and report back on how input was used.'
  };

  // ---------- helpers ----------
  const mean = (vals) => (vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null);
  const valid = (v) => (typeof v === 'number' && v >= 1 && v <= 5 ? v : null);
  const round1 = (v) => Math.round(v * 10) / 10;

  // A person's setting score: the mean of their valid answers in that setting (at least 2 needed).
  function settingScore(r, sid) {
    const vals = DIMENSIONS.map((d) => valid(r.items[itemId(sid, d.id)])).filter((v) => v != null);
    return vals.length >= MIN_SETTING_ITEMS ? mean(vals) : null;
  }

  // A person's overall index: the mean of their valid overall answers (at least 3 of 5 needed).
  function overallIndex(r) {
    const vals = OVERALL.map((o) => valid(r.items[o.id])).filter((v) => v != null);
    return vals.length >= MIN_OVERALL_ITEMS ? mean(vals) : null;
  }

  const stat = (vals, k) => (vals.length >= k
    ? { mean: mean(vals), n: vals.length, agree: vals.filter((v) => v >= 4).length / vals.length }
    : { hidden: true, n: vals.length });
  const kOf = (k) => Math.max(MIN_GROUP, Number(k) || MIN_GROUP);

  // Item-level statistics for every statement (cells of the map) and every overall statement.
  function itemStats(respondents, k) {
    k = kOf(k);
    const out = {};
    ITEMS.concat(OVERALL).forEach((it) => {
      const raw = respondents.map((r) => r.items[it.id]);
      const vals = raw.map(valid).filter((v) => v != null);
      out[it.id] = Object.assign(stat(vals, k), { skipped: raw.filter((v) => v === SKIPPED).length });
    });
    return out;
  }

  // The Relief Map for everyone: one line per dimension across the six settings, plus each
  // setting's overall score (mean of person-level setting scores) and each dimension's average
  // across settings (mean of its visible cells).
  function dimensionMap(respondents, k) {
    k = kOf(k);
    const cells = itemStats(respondents, k);
    const series = DIMENSIONS.map((d) => ({ key: d.id, label: d.label, dim: d, values: SETTINGS.map((st) => cells[itemId(st.id, d.id)]) }));
    const settings = SETTINGS.map((st) => stat(respondents.map((r) => settingScore(r, st.id)).filter((v) => v != null), k));
    const dimAverages = series.map((s) => {
      const vis = s.values.filter((v) => !v.hidden);
      return vis.length ? { mean: mean(vis.map((v) => v.mean)), settings: vis.length } : { hidden: true };
    });
    const notes = [];
    const hiddenCells = [];
    series.forEach((s) => s.values.forEach((v, i) => { if (v.hidden) hiddenCells.push(`${s.dim.short.toLowerCase()} in ${SETTINGS[i].label.toLowerCase()}`); }));
    if (hiddenCells.length && hiddenCells.length < ITEMS.length) notes.push(`Hidden because fewer than ${k} people answered: ${hiddenCells.join(', ')}.`);
    return { k, series, settings, dimAverages, cells, notes, respondents: respondents.length };
  }

  // Group comparison for one identity question. measure = 'ALL' (setting score) or a dimension id.
  // Privacy rules, applied to each setting separately:
  // - a group is shown only with at least k answers;
  // - people in smaller groups, those who chose "Prefer not to answer", "Not sure" or "I don't know",
  //   and those who skipped the question are pooled; the pool must be empty or at least k, so a
  //   hidden group can never be worked out from the team line and the other groups;
  // - at least two groups must be shown to compare;
  // - only one identity question is compared at a time, so intersections are never shown.
  function groupMap(respondents, identId, measure, k) {
    k = kOf(k);
    const q = IDENTITY.find((d) => d.id === identId);
    if (!q) throw new Error(`Unknown identity question: ${identId}`);
    measure = measure && measure !== 'ALL' ? measure : 'ALL';
    const value = (r, sid) => (measure === 'ALL' ? settingScore(r, sid) : valid(r.items[itemId(sid, measure)]));
    const groups = q.short.map((label, gi) => ({ key: `${q.id}-${gi}`, label, noun: q.noun[gi], gi, values: [] }));
    const everyone = { key: 'all', label: 'Everyone', values: [] };
    const hiddenSettings = [];
    SETTINGS.forEach((st, si) => {
      const scored = respondents.map((r) => ({ r, v: value(r, st.id) })).filter((x) => x.v != null);
      everyone.values[si] = stat(scored.map((x) => x.v), k);
      const perGroup = groups.map((g) => scored.filter((x) => x.r.ident[q.id] === g.gi).map((x) => x.v));
      const shown = perGroup.map((vals) => vals.length >= k);
      const shownCount = shown.filter(Boolean).length;
      const pooled = scored.length - perGroup.reduce((a, vals, gi) => a + (shown[gi] ? vals.length : 0), 0);
      const ok = scored.length >= k && shownCount >= 2 && (pooled === 0 || pooled >= k);
      if (!ok) hiddenSettings.push(st.label);
      groups.forEach((g, gi) => {
        g.values[si] = ok && shown[gi] ? stat(perGroup[gi], k) : { hidden: true, n: perGroup[gi].length };
      });
    });
    const visible = groups.filter((g) => g.values.some((v) => !v.hidden));
    const notes = [];
    const what = measure === 'ALL' ? 'overall experience' : DIMENSIONS.find((d) => d.id === measure).noun;
    if (!visible.length) {
      notes.push(`No ${q.label.toLowerCase()} comparison can be shown for ${what}: at least two groups need ${k} or more answers in a setting, and the people in smaller groups or who did not say must also number 0 or at least ${k}.`);
    } else if (hiddenSettings.length) {
      notes.push(`Some points are hidden to protect anonymity (${hiddenSettings.join(', ').toLowerCase()}): there, a group, or the people who did not say, gave fewer than ${k} answers.`);
    }
    const small = groups.filter((g) => !visible.includes(g) && g.values.some((v) => v.n > 0));
    if (visible.length && small.length) notes.push(`Not shown, to protect anonymity: ${small.map((g) => g.noun).join(', ')} (fewer than ${k} answers).`);
    if (measure !== 'ALL') notes.push(`Each person answers 3 of the 5 statements in a setting, so a single dimension has fewer answers per group than the overall score.`);
    return { k, question: q, measure, series: [everyone].concat(visible), allGroups: groups, notes };
  }

  // Overall section: each statement plus the overall index.
  function overallStats(respondents, k) {
    k = kOf(k);
    const cells = itemStats(respondents, k);
    return {
      items: OVERALL.map((o) => Object.assign({ item: o }, cells[o.id])),
      index: stat(respondents.map(overallIndex).filter((v) => v != null), k)
    };
  }

  // ---------- plain-language findings ----------
  function lowerFirst(s) { return s.charAt(0).toLowerCase() + s.slice(1); }

  function summarizeMap(map) {
    const shown = SETTINGS.map((st, i) => ({ st, v: map.settings[i] })).filter((x) => !x.v.hidden);
    if (!shown.length) return [`There are not enough answers yet. Results appear once at least ${map.k} people have answered.`];
    const sorted = shown.slice().sort((a, b) => b.v.mean - a.v.mean);
    const f = (x) => `${lowerFirst(x.st.label)} (${x.v.mean.toFixed(1)})`;
    const out = [`Across all five dimensions, people feel most positive in ${f(sorted[0])} and least positive in ${f(sorted[sorted.length - 1])}.`];
    const cells = [];
    map.series.forEach((s) => s.values.forEach((v, i) => { if (!v.hidden) cells.push({ s, st: SETTINGS[i], v }); }));
    cells.sort((a, b) => a.v.mean - b.v.mean);
    if (cells.length >= 2) {
      out.push(`The lowest points on the map are ${lowerFirst(cells[0].s.dim.noun)} in ${lowerFirst(cells[0].st.label)} (${cells[0].v.mean.toFixed(1)}) and ${lowerFirst(cells[1].s.dim.noun)} in ${lowerFirst(cells[1].st.label)} (${cells[1].v.mean.toFixed(1)}).`);
    }
    const dims = map.series.map((s, i) => ({ s, a: map.dimAverages[i] })).filter((x) => !x.a.hidden).sort((a, b) => b.a.mean - a.a.mean);
    if (dims.length >= 2) {
      out.push(`Averaged across settings, ${dims[0].s.dim.noun} is the strongest dimension (${dims[0].a.mean.toFixed(1)}) and ${dims[dims.length - 1].s.dim.noun} the weakest (${dims[dims.length - 1].a.mean.toFixed(1)}).`);
    }
    return out;
  }

  function summarizeGroups(agg) {
    const groups = agg.series.slice(1);
    const what = agg.measure === 'ALL' ? 'overall experience' : DIMENSIONS.find((d) => d.id === agg.measure).noun;
    if (groups.length < 2) return [`No ${agg.question.label.toLowerCase()} comparison can be shown for ${what} with the current privacy setting.`];
    const gaps = [];
    SETTINGS.forEach((st, i) => {
      const pts = groups.map((g) => ({ g, v: g.values[i] })).filter((x) => !x.v.hidden).sort((a, b) => b.v.mean - a.v.mean);
      if (pts.length >= 2) gaps.push({ st, hi: pts[0], lo: pts[pts.length - 1], gap: pts[0].v.mean - pts[pts.length - 1].v.mean });
    });
    gaps.sort((a, b) => b.gap - a.gap);
    const out = [];
    gaps.filter((g) => g.gap >= 0.3).slice(0, 2).forEach((g, i) => {
      out.push(`${i === 0 ? 'The biggest gap' : 'Another gap'} in ${what} is in ${lowerFirst(g.st.label)}: ${g.lo.g.noun} score ${g.lo.v.mean.toFixed(1)}, compared with ${g.hi.v.mean.toFixed(1)} for ${g.hi.g.noun}.`);
    });
    if (!out.length) out.push(`The groups shown report similar ${what} in every setting (differences under 0.3).`);
    return out;
  }

  // Findings for the whole data set, used by the page and by the written guide.
  function insights(respondents, k) {
    k = kOf(k);
    const map = dimensionMap(respondents, k);
    const bullets = summarizeMap(map);
    const focus = [];
    const shown = SETTINGS.map((st, i) => ({ st, v: map.settings[i] })).filter((x) => !x.v.hidden).sort((a, b) => a.v.mean - b.v.mean);
    shown.slice(0, 2).forEach((x) => focus.push(x.st.id));
    const gaps = [];
    IDENTITY.forEach((q) => {
      const agg = groupMap(respondents, q.id, 'ALL', k);
      const groups = agg.series.slice(1);
      SETTINGS.forEach((st, i) => {
        const pts = groups.map((g) => ({ g, v: g.values[i] })).filter((p) => !p.v.hidden).sort((a, b) => b.v.mean - a.v.mean);
        if (pts.length >= 2) gaps.push({ q, st, hi: pts[0], lo: pts[pts.length - 1], gap: pts[0].v.mean - pts[pts.length - 1].v.mean });
      });
    });
    gaps.sort((a, b) => b.gap - a.gap);
    const groupLines = [];
    const seen = new Set();
    gaps.filter((g) => g.gap >= 0.4).forEach((g) => {
      if (seen.has(g.q.id) || seen.size >= 4) return;
      seen.add(g.q.id);
      groupLines.push(`In ${lowerFirst(g.st.label)}, ${g.lo.g.noun} report a less positive experience (${g.lo.v.mean.toFixed(1)}) than ${g.hi.g.noun} (${g.hi.v.mean.toFixed(1)}).`);
      if (!focus.includes(g.st.id)) focus.push(g.st.id);
    });
    if (!groupLines.length) groupLines.push('Where groups can be compared, they report similar experiences (differences under 0.4).');
    const ov = overallStats(respondents, k);
    const ovShown = ov.items.filter((o) => !o.hidden).sort((a, b) => a.mean - b.mean);
    const overall = [];
    if (ovShown.length) {
      const lo = ovShown[0], hi = ovShown[ovShown.length - 1];
      overall.push(`Of the overall statements, the most agreement is with "${hi.item.text}" (${hi.mean.toFixed(1)}; ${Math.round(hi.agree * 100)}% agree) and the least with "${lo.item.text}" (${lo.mean.toFixed(1)}; ${Math.round(lo.agree * 100)}% agree).`);
    }
    return { map: bullets, groups: groupLines, overall, focus: focus.slice(0, 4), opportunities: focus.slice(0, 4).map((id) => ({ setting: SETTINGS.find((s) => s.id === id), text: OPPORTUNITIES[id] })) };
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

  const csvCell = (v) => (v == null ? '' : /[",\n\r]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  const toCSV = (lines) => lines.map((l) => l.map(csvCell).join(',')).join('\r\n') + '\r\n';

  const IDENTIFYING = ['IPAddress', 'RecipientLastName', 'RecipientFirstName', 'RecipientEmail', 'ExternalReference', 'LocationLatitude', 'LocationLongitude'];
  const TIMESTAMPS = ['StartDate', 'EndDate', 'RecordedDate'];
  const norm = (s) => String(s || '').trim().toLowerCase().replace(/[’']/g, "'");

  // Reads a Qualtrics CSV export of this survey (numeric values or choice text; with or without the
  // two extra header rows). Keeps only consenting, real responses.
  function fromQualtrics(text) {
    const rows = parseCSV(text);
    if (!rows.length) throw new Error('The file is empty.');
    const head = rows[0].map((h) => h.trim());
    const col = (name) => head.indexOf(name);
    const itemCols = ITEMS.concat(OVERALL).map((it) => col(it.id));
    if (!itemCols.some((c) => c >= 0)) {
      if (col('TM_1') >= 0) throw new Error('This looks like an export of the earlier version of the survey (columns TM_1 to DEC_5). Load an export of the current survey, which has columns such as TM_PS and DEC_COM.');
      throw new Error('This file does not look like an export of the Relief Maps survey: columns such as TM_PS and DEC_COM are missing.');
    }
    const likert = (raw) => {
      const v = String(raw == null ? '' : raw).trim();
      if (!v) return null;
      if (/^-?\d+(\.0+)?$/.test(v)) { const n = Number(v); return n === SKIPPED ? SKIPPED : n >= 1 && n <= 5 ? n : null; }
      const i = SCALE.findIndex((s) => norm(s) === norm(v));
      return i >= 0 ? i + 1 : null;
    };
    const option = (q, raw) => {
      const v = String(raw == null ? '' : raw).trim();
      if (!v) return null;
      if (/^-?\d+$/.test(v)) { const n = Number(v); return n >= 1 && n <= q.options.length ? n - 1 : null; }
      const i = q.options.findIndex((o) => norm(o) === norm(v));
      return i >= 0 ? i : null;
    };
    const textRow = (r) => itemCols.some((c) => c >= 0 && r[c] && r[c].trim().length > 25 && likert(r[c]) == null);
    const status = col('Status'), channel = col('DistributionChannel'), consentCol = col(CONSENT.id);
    const result = { respondents: [], previews: 0, declined: 0, noConsent: 0, comments: { REFLECT_1: 0, REFLECT_2: 0 },
      identifying: false, timestamps: false, consentColumn: consentCol >= 0, missing: [] };
    result.missing = ITEMS.concat(OVERALL).map((it) => it.id).filter((id) => col(id) < 0);
    rows.slice(1).forEach((r) => {
      const first = (r[0] || '').trim();
      if (first.startsWith('{"ImportId"') || first === 'Start Date' || first === 'Response ID' || textRow(r)) return;
      const st = status >= 0 ? String(r[status] || '').trim() : '';
      const ch = channel >= 0 ? String(r[channel] || '').trim().toLowerCase() : '';
      if (['1', '2', '8', '9', '12', '17'].includes(st) || /preview|test|spam/i.test(st) || ch === 'preview' || ch === 'test') { result.previews += 1; return; }
      if (consentCol >= 0) {
        const c = option(CONSENT, r[consentCol]);
        if (c === 1) { result.declined += 1; return; }
        if (c !== 0) { result.noConsent += 1; return; }
      }
      if (IDENTIFYING.some((name) => col(name) >= 0 && String(r[col(name)] || '').trim() !== '')) result.identifying = true;
      if (TIMESTAMPS.some((name) => col(name) >= 0 && String(r[col(name)] || '').trim() !== '')) result.timestamps = true;
      const items = {};
      ITEMS.concat(OVERALL).forEach((it, i) => { items[it.id] = itemCols[i] >= 0 ? likert(r[itemCols[i]]) : null; });
      const ident = {};
      IDENTITY.forEach((q) => { const c = col(q.id); ident[q.id] = c >= 0 ? option(q, r[c]) : null; });
      const vc = col(VIR_USE.id), oc = col(ID_OPTIN.id);
      REFLECTION.forEach((q) => { const c = col(q.id); const v = c >= 0 ? String(r[c] || '').trim() : ''; if (v && v !== String(SKIPPED)) result.comments[q.id] += 1; });
      if (!Object.values(items).some((v) => valid(v) != null)) return;
      result.respondents.push({ items, ident, vir: vc >= 0 ? option(VIR_USE, r[vc]) : null, optin: oc >= 0 ? option(ID_OPTIN, r[oc]) : null });
    });
    return result;
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

  // The ten ways to pick 3 of 5 statements; the sample cycles through them so every statement is
  // shown equally often, like Qualtrics' "Evenly present elements".
  const COMBOS = [];
  for (let a = 0; a < 5; a += 1) for (let b = a + 1; b < 5; b += 1) for (let c = b + 1; c < 5; c += 1) COMBOS.push([a, b, c]);

  // Fictional patterns that reflect structural barriers (hierarchy, informal networks, access to
  // development, accessible venues), not traits of any group. Values are average agreement, 1 to 5.
  const SAMPLE = {
    size: 60,
    declined: 2,
    optedOut: 8,
    virNo: 5,
    counts: { D_AGE: [18, 23, 9, 2], D_GENDER: [27, 20, 2, 3], D_DISAB: [7, 41, 4], D_ETHN: [11, 34, 4, 3], D_SES: [29, 16, 4, 3] },
    base: {
      TM: { PS: 3.55, BEL: 3.95, INC: 3.75, VOI: 3.65, COM: 3.85 },
      SUP: { PS: 3.95, BEL: 3.85, INC: 3.7, VOI: 3.9, COM: 4.05 },
      VIR: { PS: 3.6, BEL: 3.15, INC: 3.3, VOI: 3.4, COM: 3.55 },
      NET: { PS: 3.7, BEL: 3.4, INC: 3.1, VOI: 3.3, COM: 3.6 },
      DEV: { PS: 3.45, BEL: 3.3, INC: 3.15, VOI: 3.35, COM: 3.4 },
      DEC: { PS: 2.95, BEL: 3.05, INC: 2.75, VOI: 2.6, COM: 2.9 }
    },
    overall: { OV_BEL: 3.75, OV_SUP: 3.35, OV_CON: 3.25, OV_RES: 3.95, OV_COL: 3.6 },
    // Effects by group: { setting: shift for every dimension, or { dim: shift } }.
    effects: {
      'D_GENDER-0': { NET: { all: -0.35, BEL: -0.25, INC: -0.25 }, DEC: -0.2, OV_CON: -0.2 },
      'D_GENDER-2': { NET: -0.6, TM: -0.4 },
      'D_AGE-0': { DEC: { all: -0.45, VOI: -0.3, INC: -0.2 }, DEV: 0.1, OV_CON: -0.3 },
      'D_AGE-2': { DEV: { all: -0.4, INC: -0.25 } },
      'D_DISAB-0': { NET: -0.55, TM: -0.35 },
      'D_ETHN-0': { NET: { all: -0.45, BEL: -0.25 }, TM: { BEL: -0.35 }, DEC: -0.3, OV_BEL: -0.4 },
      'D_SES-1': { NET: -0.35, DEV: { all: -0.4, INC: -0.2 }, OV_SUP: -0.2 }
    },
    themes: {
      REFLECT_1: [
        ['One-on-ones with a supportive supervisor', 15],
        ['Small project groups working toward a shared goal', 10],
        ['Team meetings with a clear agenda and a chair who invites everyone in', 7],
        ['Learning sessions where questions are welcome', 5],
        ['Informal coffee chats in small groups', 4],
        ['Mentoring conversations', 2]
      ],
      REFLECT_2: [
        ['Explain decisions, and the reasons for them, to the whole team', 12],
        ['Ask for input before decisions are final', 9],
        ['Rotate who chairs meetings and invite quieter voices first', 8],
        ['Share agendas and documents before online meetings, and turn on captions', 7],
        ['Hold social activities at different times and places, not only after work', 6],
        ['Open training and stretch assignments to everyone, with clear criteria', 6],
        ['Set up mentoring for newer and junior colleagues', 4],
        ['Offer a quiet room for focused work', 2]
      ]
    },
    comments: {
      REFLECT_1: ['My one-on-ones, because my supervisor listens and follows up.', 'Small project teams where everyone has a clear role.',
        'Meetings with an agenda sent in advance.', 'Learning sessions where it is fine to ask basic questions.', 'Coffee breaks with a few colleagues.'],
      REFLECT_2: ['Tell the whole team how decisions were made and why.', 'Ask for our views before a decision is final.',
        'Rotate who chairs the weekly meeting and let quieter people speak first.', 'Send documents before online meetings and use captions.',
        'Plan some social activities during the day, not only after work.', 'Make training opportunities open to everyone, with clear criteria.',
        'Pair new colleagues with a mentor.']
    }
  };

  function effectFor(eff, sid, did) {
    if (eff == null || eff[sid] == null) return 0;
    const e = eff[sid];
    if (typeof e === 'number') return e;
    return (e.all || 0) + (did ? e[did] || 0 : 0);
  }

  function sampleTeam() {
    const rand = rng(20261115);
    const normal = () => { let u = 0, v = 0; while (!u) u = rand(); while (!v) v = rand(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
    const shuffle = (arr) => { for (let i = arr.length - 1; i > 0; i -= 1) { const j = Math.floor(rand() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
    const n = SAMPLE.size;
    const people = Array.from({ length: n }, () => ({ consent: 0, items: {}, ident: {}, vir: 0, optin: 0, text: {} }));
    const order = shuffle(people.map((_, i) => i));
    const optedOut = new Set(order.slice(0, SAMPLE.optedOut));
    const virNo = new Set(shuffle(people.map((_, i) => i)).slice(0, SAMPLE.virNo));
    const inIdentity = people.map((_, i) => i).filter((i) => !optedOut.has(i));
    IDENTITY.forEach((q) => {
      const pool = shuffle(SAMPLE.counts[q.id].flatMap((c, gi) => Array(c).fill(gi)));
      people.forEach((p) => { p.ident[q.id] = null; });
      inIdentity.forEach((pi, j) => { people[pi].ident[q.id] = pool[j]; });
    });
    people.forEach((p, pi) => {
      p.optin = optedOut.has(pi) ? 1 : 0;
      p.vir = virNo.has(pi) ? 1 : 0;
      const personal = normal() * 0.4;
      const effs = IDENTITY.map((q) => (p.ident[q.id] == null ? null : SAMPLE.effects[`${q.id}-${p.ident[q.id]}`])).filter(Boolean);
      const answer = (mu) => (rand() < 0.03 ? SKIPPED : Math.min(5, Math.max(1, Math.round(mu + normal() * 0.65))));
      SETTINGS.forEach((st, si) => {
        const combo = COMBOS[(pi * 7 + si * 3) % COMBOS.length];
        DIMENSIONS.forEach((d, di) => {
          const id = itemId(st.id, d.id);
          if ((st.id === 'VIR' && p.vir === 1) || !combo.includes(di)) { p.items[id] = null; return; }
          const mu = SAMPLE.base[st.id][d.id] + personal + effs.reduce((a, e) => a + effectFor(e, st.id, d.id), 0);
          p.items[id] = answer(mu);
        });
      });
      OVERALL.forEach((o) => {
        const mu = SAMPLE.overall[o.id] + personal + effs.reduce((a, e) => a + (typeof e[o.id] === 'number' ? e[o.id] : 0), 0);
        p.items[o.id] = answer(mu);
      });
      if (p.optin === 0) IDENTITY.forEach((q) => { if (rand() < 0.02) p.ident[q.id] = 'skip'; });
      REFLECTION.forEach((q, qi) => {
        const list = SAMPLE.comments[q.id];
        p.text[q.id] = rand() < (qi === 0 ? 0.45 : 0.55) ? list[Math.floor(rand() * list.length)] : '';
      });
    });
    return people;
  }

  // Respondents in the form the scoring functions use (as they would come from a Qualtrics export).
  function sampleRespondents() {
    return sampleTeam().map((p) => ({
      items: Object.assign({}, p.items),
      ident: Object.fromEntries(IDENTITY.map((q) => [q.id, typeof p.ident[q.id] === 'number' ? p.ident[q.id] : null])),
      vir: p.vir, optin: p.optin
    }));
  }

  // ---------- Qualtrics export layout ----------
  const META = ['StartDate', 'EndDate', 'Status', 'IPAddress', 'Progress', 'Duration (in seconds)', 'Finished', 'RecordedDate', 'ResponseId',
    'RecipientLastName', 'RecipientFirstName', 'RecipientEmail', 'ExternalReference', 'LocationLatitude', 'LocationLongitude', 'DistributionChannel', 'UserLanguage'];
  const META_TEXT = ['Start Date', 'End Date', 'Response Type', 'IP Address', 'Progress', 'Duration (in seconds)', 'Finished', 'Recorded Date', 'Response ID',
    'Recipient Last Name', 'Recipient First Name', 'Recipient Email', 'External Data Reference', 'Location Latitude', 'Location Longitude', 'Distribution Channel', 'User Language'];

  // Every question in survey order, as the Qualtrics import creates it (DB = text only, no data column).
  function questionOrder() {
    const q = [];
    q.push({ id: 'INTRO', type: 'DB', block: 'Introduction', text: TEXT.intro });
    q.push({ id: 'PRIVACY', type: 'DB', block: 'Introduction', text: TEXT.privacy });
    q.push({ id: CONSENT.id, type: 'MC', block: 'Introduction', text: CONSENT.question, options: CONSENT.options });
    SETTINGS.forEach((st, si) => {
      if (st.id === 'VIR') {
        q.push({ id: 'VIR_SCREEN', type: 'DB', block: 'Virtual screener', text: TEXT.virScreen });
        q.push({ id: VIR_USE.id, type: 'MC', block: 'Virtual screener', text: VIR_USE.question, options: VIR_USE.options });
      }
      q.push({ id: `${st.id}_INTRO`, type: 'DB', block: st.label, text: TEXT.settingIntro(st, si) });
      DIMENSIONS.forEach((d) => q.push({ id: itemId(st.id, d.id), type: 'MC', block: st.label, text: STATEMENTS[st.id][d.id].text, options: SCALE, likert: true }));
    });
    q.push({ id: 'OV_INTRO', type: 'DB', block: 'Overall', text: TEXT.overallIntro });
    OVERALL.forEach((o) => q.push({ id: o.id, type: 'MC', block: 'Overall', text: o.text, options: SCALE, likert: true }));
    q.push({ id: 'ABOUT', type: 'DB', block: 'About you', text: TEXT.aboutIntro });
    q.push({ id: ID_OPTIN.id, type: 'MC', block: 'About you', text: ID_OPTIN.question, options: ID_OPTIN.options, pageBreakAfter: true });
    IDENTITY.forEach((d) => q.push({ id: d.id, type: 'MC', block: 'About you', text: d.question, options: d.options }));
    q.push({ id: 'REFLECT_INTRO', type: 'DB', block: 'Your ideas', text: TEXT.reflectIntro });
    REFLECTION.forEach((r) => q.push({ id: r.id, type: 'TE', block: 'Your ideas', text: r.question }));
    q.forEach((x, i) => { x.qid = `QID${i + 1}`; });
    return q;
  }

  const DATA_COLUMNS = () => questionOrder().filter((x) => x.type !== 'DB');

  // The sample in the layout of a Qualtrics CSV export: numeric values, seen-but-unanswered = -99,
  // not shown = blank, "Anonymize responses" on (identifying fields empty).
  function toQualtricsCSV() {
    const cols = DATA_COLUMNS();
    const rand = rng(7);
    const rid = () => 'R_' + Array.from({ length: 15 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'[Math.floor(rand() * 56)]).join('');
    const lines = [META.concat(cols.map((c) => c.id)), META_TEXT.concat(cols.map((c) => c.text)),
      META.map((m) => `{"ImportId":"${m.replace(/ \(in seconds\)/, '').replace(/^./, (ch) => ch.toLowerCase())}"}`)
        .concat(cols.map((c) => `{"ImportId":"${c.qid}${c.type === 'TE' ? '_TEXT' : ''}"}`))];
    const people = sampleTeam();
    const declined = Array.from({ length: SAMPLE.declined }, () => ({ consent: 1 }));
    const all = people.slice(0, 20).concat([declined[0]], people.slice(20, 41), [declined[1]], people.slice(41));
    all.forEach((p, i) => {
      const day = 2 + (i % 9), mins = p.consent === 1 ? 0 : 4 + Math.floor(rand() * 4), secs = p.consent === 1 ? 20 + Math.floor(rand() * 40) : mins * 60 + Math.floor(rand() * 60);
      const start = `2026-11-${String(day).padStart(2, '0')} ${String(9 + (i % 8)).padStart(2, '0')}:${String((i * 7) % 50).padStart(2, '0')}:00`;
      const end = start.replace(/(\d\d):(\d\d):00$/, (m, h, mi) => `${h}:${String(Number(mi) + mins + 1).padStart(2, '0')}:00`);
      const values = cols.map((c) => {
        if (c.id === CONSENT.id) return p.consent + 1;
        if (p.consent === 1) return '';
        if (c.id === VIR_USE.id) return p.vir + 1;
        if (c.id === ID_OPTIN.id) return p.optin + 1;
        const q = IDENTITY.find((d) => d.id === c.id);
        if (q) return p.ident[q.id] === 'skip' ? SKIPPED : p.ident[q.id] == null ? '' : p.ident[q.id] + 1;
        if (c.type === 'TE') return p.text[c.id] || '';
        const v = p.items[c.id];
        return v == null ? '' : v;
      });
      lines.push([start, end, 0, '', 100, secs, 1, end, rid(), '', '', '', '', '', '', 'anonymous', 'EN'].concat(values));
    });
    return toCSV(lines);
  }

  // ---------- Qualtrics import file (Advanced Format TXT) ----------
  // Creates every block, question, answer choice and export tag. Randomization, logic, survey flow
  // and options are set afterwards in Qualtrics (see the implementation guide).
  function qualtricsTxt() {
    const out = ['[[AdvancedFormat]]', ''];
    let block = null;
    questionOrder().forEach((q) => {
      if (q.block !== block) { block = q.block; out.push(`[[Block:${block}]]`, ''); }
      if (q.type === 'DB') out.push('[[Question:DB]]', `[[ID:${q.id}]]`, q.text, '');
      else if (q.type === 'TE') out.push('[[Question:TE:Essay]]', `[[ID:${q.id}]]`, q.text, '');
      else {
        out.push('[[Question:MC:SingleAnswer:Vertical]]', `[[ID:${q.id}]]`, q.text, '[[Choices]]');
        q.options.forEach((o) => out.push(o));
        out.push('');
        if (q.pageBreakAfter) out.push('[[PageBreak]]', '');
      }
    });
    return out.join('\n');
  }

  // ---------- codebook ----------
  const sourceText = (x) => `${SOURCE_KINDS[x.kind].label}. ${x.note}`;
  function codebookRows() {
    const rows = [];
    const scaleCodes = SCALE.map((s, i) => `${i + 1} = ${s}`).join('; ') + `; ${SKIPPED} = seen but not answered; blank = not shown`;
    const optCodes = (opts) => opts.map((o, i) => `${i + 1} = ${o}`).join('; ');
    const shown = (it) => (it.setting === 'VIR' ? `3 of 5 in this setting, at random (evenly); only if ${VIR_USE.id} is not "No"` : it.setting ? '3 of 5 in this setting, at random (evenly)' : 'Everyone who consents');
    rows.push({ variable: 'Status', section: 'System', question: 'Response type', type: 'System', values: '0 = normal response; 1 = preview; 2 = test; 8 = spam', required: '', shownTo: '', construct: '', setting: '', source: 'Qualtrics. Keep only 0 (and 4 = imported, 16 = offline).' });
    rows.push({ variable: 'Progress / Finished', section: 'System', question: 'Share of the survey completed / finished or not', type: 'System', values: '0 to 100 / 1 = finished, 0 = not', required: '', shownTo: '', construct: '', setting: '', source: 'Qualtrics. Partial responses are kept: every statistic uses the answers that exist.' });
    rows.push({ variable: 'StartDate, EndDate, RecordedDate', section: 'System', question: 'Timestamps', type: 'System', values: 'Date and time', required: '', shownTo: '', construct: '', setting: '', source: 'Qualtrics. Not needed for analysis: delete before sharing the file, because times can help identify people.' });
    rows.push({ variable: CONSENT.id, section: '1. Introduction and consent', question: CONSENT.question, type: 'Multiple choice, single answer', values: optCodes(CONSENT.options), required: 'Required (force response)', shownTo: 'Everyone', construct: 'Informed consent', setting: '', source: 'Standard research consent. "No" ends the survey (survey flow branch).' });
    ITEMS.forEach((it) => {
      const st = SETTINGS.find((s) => s.id === it.setting), d = DIMENSIONS.find((x) => x.id === it.dim);
      if (it.dim === 'PS' && it.setting === 'VIR') {
        rows.push({ variable: VIR_USE.id, section: '2. Workplace experience', question: VIR_USE.question, type: 'Multiple choice, single answer', values: optCodes(VIR_USE.options), required: 'Optional', shownTo: 'Everyone who consents', construct: 'Screener (setting applies)', setting: st.label, source: 'New. "No" skips the virtual and hybrid statements (survey flow branch).' });
      }
      rows.push({ variable: it.id, section: '2. Workplace experience', question: it.text, type: 'Multiple choice, single answer (5-point agreement)', values: scaleCodes, required: 'Optional', shownTo: shown(it), construct: d.label, setting: st.label, source: sourceText(it) });
    });
    OVERALL.forEach((o) => rows.push({ variable: o.id, section: '3. Overall workplace experience', question: o.text, type: 'Multiple choice, single answer (5-point agreement)', values: scaleCodes, required: 'Optional', shownTo: 'Everyone who consents', construct: o.construct, setting: 'Overall', source: sourceText(o) }));
    rows.push({ variable: ID_OPTIN.id, section: '4. About you (optional)', question: ID_OPTIN.question, type: 'Multiple choice, single answer', values: optCodes(ID_OPTIN.options), required: 'Optional', shownTo: 'Everyone who consents', construct: 'Opt-in to identity questions', setting: '', source: 'New. Only "Yes" shows the identity questions (display logic).' });
    IDENTITY.forEach((q) => rows.push({ variable: q.id, section: '4. About you (optional)', question: q.question, type: 'Multiple choice, single answer', values: `${optCodes(q.options)}; ${SKIPPED} = seen but not answered; blank = not shown`, required: 'Optional', shownTo: `Only if ${ID_OPTIN.id} = 1`, construct: `Identity: ${q.label.toLowerCase()}`, setting: '', source: sourceText(q) }));
    REFLECTION.forEach((r) => rows.push({ variable: r.id, section: '5. Open-ended reflection (optional)', question: r.question, type: 'Text entry (essay)', values: 'Free text', required: 'Optional', shownTo: 'Everyone who consents', construct: r.id === 'REFLECT_1' ? 'Supportive environments' : 'Ideas for change', setting: '', source: 'From the project brief. Read only by the research team; report themes raised by 3 or more people, never quotes.' }));
    return rows;
  }

  const CODEBOOK_HEADERS = [['variable', 'Variable (export tag)'], ['section', 'Section'], ['question', 'Question wording'], ['type', 'Qualtrics question type'],
    ['values', 'Values and codes'], ['required', 'Required'], ['shownTo', 'Shown to'], ['construct', 'Construct'], ['setting', 'Setting'], ['source', 'Source']];
  function codebookCSV() {
    return toCSV([CODEBOOK_HEADERS.map((h) => h[1])].concat(codebookRows().map((r) => CODEBOOK_HEADERS.map((h) => r[h[0]]))));
  }

  return {
    VERSION, PROJECT_TITLE, SURVEY_TITLE, SCALE, SKIPPED, SHOWN_PER_SETTING, MIN_SETTING_ITEMS, MIN_OVERALL_ITEMS, MIN_GROUP, MIN_THEME,
    BANDS, band, REFS, SOURCE_KINDS, DIMENSIONS, SETTINGS, STATEMENTS, ITEMS, OVERALL, CONSENT, VIR_USE, ID_OPTIN, IDENTITY, REFLECTION,
    TEXT, CONTACT, OPPORTUNITIES, SAMPLE, COMBOS, itemId, round1,
    settingScore, overallIndex, itemStats, dimensionMap, groupMap, overallStats, summarizeMap, summarizeGroups, insights,
    parseCSV, fromQualtrics, sampleTeam, sampleRespondents, questionOrder, toQualtricsCSV, qualtricsTxt, codebookRows, codebookCSV, CODEBOOK_HEADERS
  };
});
