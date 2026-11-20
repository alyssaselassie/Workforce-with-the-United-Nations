// GENERATED COPY. Edit apps/shared/assessment-model.js, then run: node tools/build_assessment.js
// UN Workforce Inclusion & Psychological Safety Assessment: the shared model.
//
// One file, used unchanged by all three parts of the assessment system:
//   - the survey application (apps/survey): the questions, answer scales and validation;
//   - the analytics dashboard (apps/analytics): the department datasets and the anonymity rules;
//   - the results service (supabase/functions/assessment-release): the same anonymity rules on the
//     server, so dashboard users only ever receive aggregated results.
// It runs in the browser (window.AssessmentModel), in Node and in Deno.
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
    // The anonymity threshold: no result is shown for a group of fewer completed responses than this.
    // Raise it if needed; the code refuses anything below 10.
    minGroupSize: 10,
    // Submissions are grouped into reporting periods. Only the period is stored, never the date or time.
    period: 'quarter',
    // Demonstration mode only: practice answers stay in this browser and join the fictional
    // demonstration data. Real responses are never stored in the browser.
    demoStorageKey: 'un-workforce-assessment.demo-responses.v1'
  };

  const TITLE = 'UN Workforce Inclusion & Psychological Safety Assessment';
  const SHORT_TITLE = 'Workforce Assessment';
  const DASHBOARD_TITLE = 'UN Workforce Analytics Dashboard';

  // ---------- who is answering ----------
  // The only grouping question. Department codes are stored; names are shown.
  const DEPARTMENTS = [
    { id: 'HR', short: 'HR', name: 'Human Resources (HR)' },
    { id: 'FIN', short: 'Finance & Accounting', name: 'Finance & Accounting' },
    { id: 'MKT', short: 'Marketing & Communications', name: 'Marketing & Communications' },
    { id: 'RES', short: 'Research & Data Analytics', name: 'Research & Data Analytics' },
    { id: 'IT', short: 'IT', name: 'Information Technology (IT)' },
    { id: 'LEG', short: 'Legal & Compliance', name: 'Legal & Compliance' },
    { id: 'OPS', short: 'Operations & Administration', name: 'Operations & Administration' },
    { id: 'PPM', short: 'Programme & Project Management', name: 'Programme & Project Management' },
    { id: 'POL', short: 'Policy & Strategy', name: 'Policy & Strategy' },
    { id: 'HUM', short: 'Humanitarian & Field Operations', name: 'Humanitarian & Field Operations' },
    { id: 'LEAD', short: 'Leadership & Management', name: 'Leadership & Management' },
    { id: 'OTH', short: 'Other', name: 'Other' }
  ].map((d) => Object.assign(d, { dataset: d.id === 'OTH' ? 'Other Departments Dataset' : `${d.short} Dataset` }));

  const CONSENT = { id: 'CONSENT', text: 'Do you agree to take part in this assessment?', options: ['Yes, I agree to take part', 'No, I do not want to take part'] };
  const DEPARTMENT_Q = { id: 'DEPARTMENT', text: 'Which professional department do you work in?',
    help: 'Choose the one closest to your work. If none fits, choose "Other". This is used only to group answers.' };

  // ---------- answer scales ----------
  // Codes follow the order shown (1 = first option, the most positive wording). Code 98 is the same
  // non-substantive answer on every statement, so a required question never forces a guess; it is
  // reported separately and left out of percentages.
  const NA = { code: 98, label: "Don't know or not applicable" };
  const SCALES = {
    agree: { id: 'agree', name: 'Agreement', options: ['Strongly agree', 'Agree', 'Neither agree nor disagree', 'Disagree', 'Strongly disagree'] },
    frequency: { id: 'frequency', name: 'Frequency', options: ['Always', 'Often', 'Sometimes', 'Rarely', 'Never'] },
    // Unipolar confidence scale; "Somewhat confident" is treated as the middle point.
    confidence: { id: 'confidence', name: 'Confidence', options: ['Very confident', 'Fairly confident', 'Somewhat confident', 'Slightly confident', 'Not at all confident'] },
    // Section G (Relief Map). Code 98 has its own wording here: these questions touch on identity, so
    // anyone can decline, and not everyone takes part in every setting.
    comfort: { id: 'comfort', name: 'Comfort', options: ['Very comfortable', 'Comfortable', 'Neither comfortable nor uncomfortable', 'Uncomfortable', 'Very uncomfortable'], na: 'Prefer not to say or not applicable' }
  };
  const naLabel = (scale) => (SCALES[scale] && SCALES[scale].na) || NA.label;

  // ---------- sources (all real; every item is adapted or new wording, never copied) ----------
  const SOURCES = {
    edmondson: { short: 'Edmondson (1999)', cite: 'Edmondson, A. (1999). Psychological safety and learning behavior in work teams. Administrative Science Quarterly, 44(2), 350–383.', url: 'https://doi.org/10.2307/2666999',
      licence: 'Seven-item team psychological safety scale published in the article. Cite the article; for formal research use the original items unmodified. Items here are adapted, not copied.' },
    copsoq: { short: 'COPSOQ III (Burr et al., 2019)', cite: 'Burr, H., Berthelsen, H., Moncada, S., Nübling, M., Dupret, E., Demiral, Y., et al. (2019). The third version of the Copenhagen Psychosocial Questionnaire. Safety and Health at Work, 10(4), 482–503.', url: 'https://doi.org/10.1016/j.shaw.2019.10.002',
      licence: 'COPSOQ is free to use under CC BY-NC-ND 4.0 and the COPSOQ International Network guidelines (copsoq-network.org/guidelines). Modified items may not be presented as COPSOQ, so these are new items based on its concepts.' },
    nishii: { short: 'Nishii (2013)', cite: 'Nishii, L. H. (2013). The benefits of climate for inclusion for gender-diverse groups. Academy of Management Journal, 56(6), 1754–1774.', url: 'https://doi.org/10.5465/amj.2009.0823' },
    jansen: { short: 'Jansen et al. (2014)', cite: 'Jansen, W. S., Otten, S., van der Zee, K. I., & Jans, L. (2014). Inclusion: Conceptualization and measurement. European Journal of Social Psychology, 44(4), 370–385.', url: 'https://doi.org/10.1002/ejsp.2011' },
    shore: { short: 'Shore et al. (2011)', cite: 'Shore, L. M., Randel, A. E., Chung, B. G., Dean, M. A., Holcombe Ehrhart, K., & Singh, G. (2011). Inclusion and diversity in work groups: A review and model for future research. Journal of Management, 37(4), 1262–1289.', url: 'https://doi.org/10.1177/0149206310385943' },
    colquitt: { short: 'Colquitt (2001)', cite: 'Colquitt, J. A. (2001). On the dimensionality of organizational justice: A construct validation of a measure. Journal of Applied Psychology, 86(3), 386–400.', url: 'https://doi.org/10.1037/0021-9010.86.3.386' },
    detert: { short: 'Detert & Burris (2007)', cite: 'Detert, J. R., & Burris, E. R. (2007). Leadership behavior and employee voice: Is the door really open? Academy of Management Journal, 50(4), 869–884.', url: 'https://doi.org/10.5465/amj.2007.26279183' },
    eisenberger: { short: 'Eisenberger et al. (1986)', cite: 'Eisenberger, R., Huntington, R., Hutchison, S., & Sowa, D. (1986). Perceived organizational support. Journal of Applied Psychology, 71(3), 500–507.', url: 'https://doi.org/10.1037/0021-9010.71.3.500' },
    ang: { short: 'Ang et al. (2007)', cite: 'Ang, S., Van Dyne, L., Koh, C., Ng, K. Y., Templer, K. J., Tay, C., & Chandrasekar, N. A. (2007). Cultural intelligence: Its measurement and effects on cultural judgment and decision making, cultural adaptation and task performance. Management and Organization Review, 3(3), 335–371.', url: 'https://doi.org/10.1111/j.1740-8784.2007.00082.x' },
    greenwald: { short: 'Greenwald & Banaji (1995)', cite: 'Greenwald, A. G., & Banaji, M. R. (1995). Implicit social cognition: Attitudes, self-esteem, and stereotypes. Psychological Review, 102(1), 4–27.', url: 'https://doi.org/10.1037/0033-295X.102.1.4' },
    opm: { short: 'OPM FEVS inclusion index', cite: 'U.S. Office of Personnel Management. Federal Employee Viewpoint Survey: the New Inclusion Quotient (New IQ) index (five habits of inclusion: fair, open, cooperative, supportive, empowering), replaced in 2020 by the DEIA index.', url: 'https://www.opm.gov/fevs/' },
    rodozarate: { short: 'Rodó-Zárate (2023); Relief Maps+', cite: 'Rodó-Zárate, M. (2023). Intersectionality and the spatiality of emotions in feminist research. The Professional Geographer, 75(4), 676–681. Relief Maps+ (INTERMAPS, Universitat Pompeu Fabra, 2024): reliefmaps.upf.edu.', url: 'https://doi.org/10.1080/00330124.2022.2075406',
      licence: 'The Relief Maps method maps how comfortable a person feels in each place in relation to each axis of their identity. Section G adapts that idea to workplace settings and group averages; it is not the original individual-level method.' }
  };

  // ---------- the six areas ----------
  // basis: 'Adapted' = reworded from a published item (quoted in `note`); 'New' = new wording of a
  // published concept, or a new item for UN workplaces.
  const I = (id, concept, text, basis, sources, note) => ({ id, concept, text, basis, sources, note: note || '' });
  const CATEGORIES = [
    { id: 'PS', letter: 'A', name: 'Psychological Safety', scale: 'agree',
      intro: 'Think about the team you work with most closely. How much do you agree with each statement?',
      items: [
        I('PS1', 'Expressing different opinions', 'In my team, I can express an opinion that differs from others\' without fear of negative consequences.', 'New', ['edmondson'], 'New wording of the team psychological safety concept.'),
        I('PS2', 'Asking questions', 'I can ask questions in my team without worrying about how I will be seen.', 'New', ['edmondson'], 'New wording of the team psychological safety concept.'),
        I('PS3', 'Admitting mistakes', 'If I make a mistake in my team, it is not held against me.', 'Adapted', ['edmondson'], 'Reworded positively from "If you make a mistake on this team, it is often held against you."'),
        I('PS4', 'Raising concerns', 'I feel safe raising problems and difficult issues in my team.', 'Adapted', ['edmondson'], 'Adapted from "Members of this team are able to bring up problems and tough issues."'),
        I('PS5', 'Disagreeing with supervisors', 'I can respectfully disagree with my supervisor without fear of negative consequences.', 'New', ['edmondson', 'detert'], 'New item: psychological safety and voice towards leaders.'),
        I('PS6', 'Seeking assistance', 'It is easy to ask colleagues in my team for help.', 'Adapted', ['edmondson', 'copsoq'], 'Reworded positively from "It is difficult to ask other members of this team for help."')
      ] },
    { id: 'IN', letter: 'B', name: 'Workplace Inclusion', scale: 'agree',
      intro: 'Think about your workplace. How much do you agree with each statement?',
      items: [
        I('IN1', 'Sense of belonging', 'I feel that I belong in my team.', 'New', ['jansen', 'shore'], 'New wording of the belonging dimension of inclusion.'),
        I('IN2', 'Equal participation', 'Everyone in my team has an equal opportunity to take part in discussions.', 'New', ['nishii'], 'New wording of inclusion in decision-making.'),
        I('IN3', 'Respect across backgrounds', 'Colleagues are treated with respect whatever their cultural or national background.', 'New', ['copsoq', 'nishii'], 'New wording of the justice and respect concept.'),
        I('IN4', 'Access to opportunities', 'Opportunities such as assignments, training and travel are open to everyone in my team.', 'New', ['nishii'], 'New wording of equitable employment practices.'),
        I('IN5', 'Valuing different perspectives', 'Different perspectives are valued in my team, even when they challenge the usual way of working.', 'New', ['nishii', 'shore'], 'New wording of integration of differences and uniqueness.'),
        I('IN6', 'Fair treatment', 'I am treated fairly at work.', 'New', ['colquitt', 'copsoq'], 'New wording of organizational justice.')
      ] },
    { id: 'CC', letter: 'C', name: 'Cross-Cultural Collaboration', scale: 'confidence',
      intro: 'Think about working with colleagues from different cultural, national, language and professional backgrounds. How confident are you that you can do each of the following?',
      items: [
        I('CC1', 'Communicating across cultures', 'Communicate clearly with colleagues whose language or cultural background differs from yours.', 'New', ['ang'], 'New item informed by the behavioural dimension of cultural intelligence.'),
        I('CC2', 'Adapting working styles', 'Adapt how you work when collaborating with colleagues whose working styles differ from yours.', 'New', ['ang'], 'New item informed by the metacognitive and behavioural dimensions of cultural intelligence.'),
        I('CC3', 'Working as equal partners', 'Work as an equal partner with colleagues across international and national staff, or headquarters and the field.', 'New', [], 'New item for UN workplaces. "Don\'t know or not applicable" covers roles without such colleagues.'),
        I('CC4', 'Resolving misunderstandings', 'Resolve a misunderstanding with a colleague from a different background respectfully.', 'New', ['copsoq'], 'New item related to "Are conflicts resolved in a fair way?"'),
        I('CC5', 'Sharing knowledge across teams', 'Share knowledge and information effectively with colleagues in other teams and duty stations.', 'New', ['copsoq'], 'New item related to information sharing between colleagues.')
      ] },
    { id: 'LM', letter: 'D', name: 'Leadership & Management', scale: 'agree',
      intro: 'Think about your direct supervisor and the management of your office. How much do you agree with each statement?',
      items: [
        I('LM1', 'Fairness of supervisors', 'My supervisor treats all team members fairly.', 'New', ['copsoq', 'colquitt'], 'New wording of justice and respect.'),
        I('LM2', 'Inclusive decision-making', 'My supervisor involves team members in decisions that affect their work.', 'New', ['nishii', 'copsoq'], 'New wording of inclusion in decision-making and influence at work.'),
        I('LM3', 'Openness to feedback', 'My supervisor is open to feedback, including criticism.', 'New', ['detert'], 'New wording of managerial openness.'),
        I('LM4', 'Recognition of contributions', 'My supervisor recognizes everyone\'s contributions, not only the most visible ones.', 'New', ['copsoq'], 'New item related to "Is your work recognised and appreciated by the management?"'),
        I('LM5', 'Transparency', 'Management explains the reasons for decisions that affect staff.', 'New', ['colquitt'], 'New wording of informational justice.'),
        I('LM6', 'Respectful communication', 'My supervisor communicates with team members respectfully.', 'New', ['colquitt'], 'New wording of interpersonal justice.')
      ] },
    { id: 'IB', letter: 'E', name: 'Implicit Bias Awareness', scale: 'frequency', lowerIsBetter: true,
      intro: 'In the past 3 months (or since you joined, if that is more recent), how often have you noticed the following in your workplace?',
      caution: 'These questions ask what you have noticed in workplace practices. They do not measure anyone\'s implicit bias, and results are never about individuals.',
      items: [
        I('IB1', 'Assumptions in workplace decisions', 'Decisions based on assumptions about people\'s backgrounds rather than on evidence', 'New', ['greenwald'], 'New item; perceptions of workplace practices, not a measure of implicit bias.'),
        I('IB2', 'Cultural stereotypes', 'Colleagues using stereotypes about a nationality, culture or region', 'New', [], 'New item.'),
        I('IB3', 'Unequal treatment', 'Colleagues being treated differently because of their nationality, gender, language, age or other background', 'New', ['copsoq'], 'New item related to justice and respect.'),
        I('IB4', 'Bias in recruitment and advancement', 'Factors other than merit affecting who is recruited or promoted', 'New', ['opm'], 'New item related to the "fair" habit of the New IQ inclusion index.'),
        I('IB5', 'Differences in recognition', 'Similar contributions being recognized differently depending on who made them', 'New', ['copsoq'], 'New item related to recognition.'),
        I('IB6', 'Institutional power dynamics', 'Differences in power (for example between headquarters and the field, international and national staff, or senior and junior staff) deciding whose views count', 'New', [], 'New item reflecting a focus on power dynamics in UN workplaces.')
      ] },
    { id: 'OS', letter: 'F', name: 'Organizational Support', scale: 'agree',
      intro: 'Think about your organization as a whole. How much do you agree with each statement?',
      items: [
        I('OS1', 'Access to inclusion training', 'I have access to training on diversity, inclusion and bias.', 'New', [], 'New item.'),
        I('OS2', 'Reporting mechanisms', 'I know how to report discrimination or unfair treatment in my organization.', 'New', [], 'New item.'),
        I('OS3', 'Organizational accountability', 'When discrimination or unfair treatment is reported, my organization takes appropriate action.', 'New', ['nishii'], 'New item related to equitable employment practices.'),
        I('OS4', 'Management support', 'Senior management actively supports diversity and inclusion.', 'New', ['opm'], 'New item related to the "open" habit of the New IQ inclusion index.'),
        I('OS5', 'Professional development', 'I have opportunities for professional development in my organization.', 'New', ['copsoq', 'eisenberger'], 'New wording of possibilities for development and perceived organizational support.')
      ] }
  ];
  CATEGORIES.forEach((c) => c.items.forEach((it) => { it.category = c.id; it.scale = c.scale; }));

  // ---------- G. Relief Map ----------
  // A workplace adaptation of Relief Maps (Rodó-Zárate): for each workplace setting, how comfortable
  // people feel in relation to five parts of who they are, as on the Relief Maps Tool worksheet. The
  // settings run along the bottom of the map, comfort to discomfort up the side, and each identity
  // dimension is one line. No one is asked which gender, age, religion, ethnicity or social class they
  // are: only how comfortable they feel, so the map needs no identity groups and has none to expose.
  const RELIEF = {
    id: 'RM', letter: 'G', name: 'Relief Map', scale: 'comfort',
    intro: 'This section maps where people feel at ease at work. Think about the past 3 months (or since you joined, if that is more recent). For each of five workplace settings, say how comfortable you feel in relation to five parts of who you are. For example, someone may feel at ease in team meetings in relation to their age, but uncomfortable in relation to their gender.',
    note: 'These questions never ask which gender, age, religion, ethnicity or social class you are, only how comfortable you feel.',
    settings: [
      { id: 'TM', name: 'Team meetings', short: 'Team meetings', phrase: 'team meetings', about: 'Meetings of your team, in person or online.' },
      { id: 'SUP', name: 'One-on-one meetings with your supervisor', short: 'Supervisor one-on-ones', phrase: 'one-on-one meetings with your supervisor', about: 'Conversations with your supervisor, in person or online, such as check-ins and performance discussions.' },
      { id: 'HYB', name: 'Hybrid and virtual collaboration', short: 'Hybrid and virtual work', phrase: 'hybrid and virtual collaboration', about: 'Working with colleagues through video calls, chat and shared documents.' },
      { id: 'NET', name: 'Informal networking', short: 'Informal networking', phrase: 'informal networking', about: 'Breaks, social events and conversations outside formal meetings.' },
      { id: 'DEC', name: 'Decision-making spaces', short: 'Decision-making spaces', phrase: 'decision-making spaces', about: 'Meetings and conversations where decisions that affect your work are made.' }
    ],
    // In the order of the Relief Maps worksheet's legend.
    dimensions: [
      { id: 'GEN', name: 'Gender', phrase: 'your gender' },
      { id: 'AGE', name: 'Age', phrase: 'your age' },
      { id: 'REL', name: 'Religious identity', phrase: 'your religious identity (including having no religion)' },
      { id: 'ETH', name: 'Ethnicity', phrase: 'your ethnicity' },
      { id: 'CLS', name: 'Social class', phrase: 'your social class or background' }
    ]
  };
  RELIEF.items = RELIEF.settings.flatMap((s) => RELIEF.dimensions.map((d) => ({
    id: `${RELIEF.id}_${s.id}_${d.id}`, setting: s.id, dimension: d.id, category: RELIEF.id, scale: RELIEF.scale,
    concept: `${s.name}: ${d.name.toLowerCase()}`, short: `In relation to ${d.phrase}`,
    text: `In ${s.phrase}, how comfortable do you feel in relation to ${d.phrase}?`,
    basis: 'New', sources: ['rodozarate'], note: 'New item: comfort in a place in relation to one axis of identity, adapted from Relief Maps to a workplace setting.'
  })));
  const RELIEF_SETTING_BY_ID = Object.fromEntries(RELIEF.settings.map((s) => [s.id, s]));
  const RELIEF_DIMENSION_BY_ID = Object.fromEntries(RELIEF.dimensions.map((d) => [d.id, d]));
  const reliefItem = (settingId, dimensionId) => `${RELIEF.id}_${settingId}_${dimensionId}`;

  // Every required statement: the six areas, then the Relief Map.
  const ITEMS = CATEGORIES.flatMap((c) => c.items).concat(RELIEF.items);
  const AREA_ITEMS = ITEMS.filter((it) => it.category !== RELIEF.id);
  const ITEM_BY_ID = Object.fromEntries(ITEMS.map((it) => [it.id, it]));
  const CATEGORY_BY_ID = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));
  const DEPARTMENT_BY_ID = Object.fromEntries(DEPARTMENTS.map((d) => [d.id, d]));
  const QUESTION_COUNT = ITEMS.length + 2; // plus consent and department

  // Favourable = the two most positive answers. For area E (how often bias is noticed), less often
  // is more favourable. `order` lists codes from most to least favourable, for charts.
  function polarity(categoryId) {
    const c = CATEGORY_BY_ID[categoryId];
    return c.lowerIsBetter
      ? { favourable: [4, 5], neutral: [3], unfavourable: [1, 2], order: [5, 4, 3, 2, 1] }
      : { favourable: [1, 2], neutral: [3], unfavourable: [4, 5], order: [1, 2, 3, 4, 5] };
  }
  const favourableWords = (categoryId) => {
    const c = CATEGORY_BY_ID[categoryId];
    const o = SCALES[c.scale].options;
    return c.lowerIsBetter ? `"${o[3]}" or "${o[4]}"` : `"${o[0]}" or "${o[1]}"`;
  };
  const answerLabel = (itemId, code) => (code === NA.code ? naLabel(ITEM_BY_ID[itemId].scale) : SCALES[ITEM_BY_ID[itemId].scale].options[code - 1]);

  // ---------- Relief Map: values and place types ----------
  // A point on the map is the average answer from 1 (very comfortable) to 5 (very uncomfortable);
  // "prefer not to say or not applicable" is left out. counts = [code 1, ..., code 5, code 98].
  const answered = (counts) => (counts ? counts.slice(0, 5).reduce((a, b) => a + b, 0) : 0);
  function reliefValue(counts) {
    const n = answered(counts);
    return n ? counts.slice(0, 5).reduce((a, c, i) => a + c * (i + 1), 0) / n : null;
  }
  // The four kinds of place on the Relief Maps worksheet. In this workplace adaptation a setting is
  // labelled from its lines (the group's averages), checked in this order. The rule is ours: it is a
  // reading aid for group averages, not part of the original individual-level method.
  const PLACE_TYPES = [
    { id: 'oppression', name: 'Places of oppression', short: 'Oppression', rule: 'the lines average 3 or more: as much discomfort as comfort, or more' },
    { id: 'controversial', name: 'Controversial places', short: 'Controversial', rule: 'the highest and lowest lines are at least 1 point apart: comfort in relation to some identities, discomfort in relation to others' },
    { id: 'relief', name: 'Places of relief', short: 'Relief', rule: 'the lines average 2 or less: comfortable on average' },
    { id: 'neutral', name: 'Neutral places', short: 'Neutral', rule: 'anything in between' }
  ];
  const PLACE_TYPE_BY_ID = Object.fromEntries(PLACE_TYPES.map((p) => [p.id, p]));
  const PLACE_MIN_LINES = 3; // a setting with fewer shown lines is not labelled
  function placeType(values) {
    const v = values.filter((x) => x != null);
    if (v.length < PLACE_MIN_LINES) return null;
    const avg = v.reduce((a, b) => a + b, 0) / v.length;
    if (avg >= 3) return PLACE_TYPE_BY_ID.oppression;
    if (Math.max(...v) - Math.min(...v) >= 1) return PLACE_TYPE_BY_ID.controversial;
    if (avg <= 2) return PLACE_TYPE_BY_ID.relief;
    return PLACE_TYPE_BY_ID.neutral;
  }
  // The Relief Map of one published group: values[setting][dimension] (null where a point is held
  // back) and the place type of each setting.
  function reliefMap(c) {
    if (!c || c.status !== 'published' || !c.relief) return null;
    const values = Object.fromEntries(RELIEF.settings.map((s) => [s.id, Object.fromEntries(RELIEF.dimensions.map((d) => [d.id, reliefValue(c.relief[reliefItem(s.id, d.id)])]))]));
    const types = Object.fromEntries(RELIEF.settings.map((s) => [s.id, placeType(RELIEF.dimensions.map((d) => values[s.id][d.id]))]));
    const shown = RELIEF.items.filter((it) => c.relief[it.id]).length;
    return { values, types, shown };
  }

  const TEXT = {
    intro: `This assessment asks about psychological safety, workplace inclusion, cross-cultural collaboration, leadership and management, awareness of bias in workplace practices and organizational support, and ends with a Relief Map of how comfortable you feel in five workplace settings. It has ${QUESTION_COUNT} multiple-choice questions and takes about 11 minutes. Every question needs an answer; if a statement does not apply to you, choose "${NA.label}" (in the Relief Map section, "${SCALES.comfort.na}").`,
    purpose: 'The results help organizations see, department by department, where people feel safe to speak up, included and supported, and where practices need attention. They are used for organizational learning, never to assess individuals.',
    privacy: [
      'Taking part is voluntary. You can stop at any time before you submit; nothing is recorded until you do.',
      'We do not ask for your name, email, staff ID, entity or duty station. Your response is stored without your IP address or location.',
      'The Relief Map section asks how comfortable you feel in relation to your gender, age, religious identity, ethnicity and social class. It never asks which of these you are, and you can always choose "Prefer not to say".',
      'Your department is used only to group answers, and the date only to assign a reporting period (such as October to December 2026). The exact date and time are not stored.',
      'Results are shown only for groups of at least 10 people, and smaller groups are protected from being worked out from other results. Individual answers are never shown to anyone, including supervisors.'
    ],
    thanks: 'Thank you for taking part. Your answers have been recorded anonymously. Results will be reported only for groups of at least 10 people.',
    declined: 'Thank you. You chose not to take part, so the assessment has ended and nothing was recorded.'
  };

  // ---------- reporting periods ----------
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function periodOf(date) {
    const d = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(d.getTime())) return null;
    return `${d.getUTCFullYear()}-Q${Math.floor(d.getUTCMonth() / 3) + 1}`;
  }
  function periodLabel(id) {
    const m = /^(\d{4})-Q([1-4])$/.exec(String(id));
    if (!m) return String(id);
    const q = Number(m[2]);
    return `Q${q} ${m[1]} (${MONTHS[(q - 1) * 3]}–${MONTHS[(q - 1) * 3 + 2]})`;
  }

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

  const ANSWER_CODES = [1, 2, 3, 4, 5, NA.code];
  const validCode = (code) => ANSWER_CODES.includes(code);

  // Lists what is missing or invalid; an empty list means the response is complete.
  function problems(r) {
    const out = [];
    if (!r || typeof r !== 'object') return ['Not a response.'];
    if (!DEPARTMENT_BY_ID[r.department]) out.push(DEPARTMENT_Q.id);
    if (!/^\d{4}-Q[1-4]$/.test(String(r.period || ''))) out.push('PERIOD');
    ITEMS.forEach((it) => { if (!r.answers || !validCode(r.answers[it.id])) out.push(it.id); });
    if (r.answers && Object.keys(r.answers).some((k) => !ITEM_BY_ID[k])) out.push('UNKNOWN_ANSWER');
    return out;
  }

  // Builds the response record from the survey's answers. Throws if anything is missing, so an
  // incomplete response can never be submitted.
  function makeResponse(input, opts) {
    opts = opts || {};
    const r = {
      id: opts.id || responseId(opts.rand),
      period: opts.period || periodOf(opts.date || new Date()),
      department: input.department,
      answers: Object.fromEntries(ITEMS.map((it) => [it.id, input.answers ? input.answers[it.id] : undefined]))
    };
    const missing = problems(r);
    if (missing.length) throw new Error(`Incomplete response: ${missing.join(', ')}`);
    return r;
  }

  // What the survey sends to the secure database function (supabase: submit_assessment). The
  // database assigns the reporting period itself, so the client cannot choose or backdate it.
  const submissionPayload = (r) => ({ p_department: r.department, p_answers: r.answers });

  // The structured dataset in long form: one row per answer, each tied to its department, reporting
  // period, question and area.
  function longRows(responses) {
    return responses.flatMap((r) => ITEMS.map((it) => ({
      response_id: r.id, department: r.department, period: r.period,
      question_id: it.id, category: it.category, answer_code: r.answers[it.id], answer: answerLabel(it.id, r.answers[it.id])
    })));
  }

  // Separate analytical datasets: one per department, plus the organization-wide dataset.
  function datasets(responses) {
    const byDepartment = Object.fromEntries(DEPARTMENTS.map((d) => [d.id, []]));
    responses.forEach((r) => { if (byDepartment[r.department]) byDepartment[r.department].push(r); });
    return { overall: responses.slice(), byDepartment };
  }

  // ---------- aggregation ----------
  function countAnswers(rs, itemId) {
    const counts = [0, 0, 0, 0, 0, 0]; // codes 1 to 5, then 98 ("don't know", "prefer not to say" or not applicable)
    rs.forEach((r) => { const c = r.answers[itemId]; if (c === NA.code) counts[5] += 1; else if (c >= 1 && c <= 5) counts[c - 1] += 1; });
    return counts;
  }

  // The six areas. (The Relief Map points are added by buildRelease, which holds back small points.)
  function aggregate(rs) {
    const items = {};
    AREA_ITEMS.forEach((it) => { items[it.id] = countAnswers(rs, it.id); });
    const scores = {};
    CATEGORIES.forEach((c) => {
      const pol = polarity(c.id);
      // Per person: favourable answers (y) out of substantive answers (m) in this area.
      const people = rs.map((r) => {
        let y = 0, m = 0;
        c.items.forEach((it) => { const v = r.answers[it.id]; if (v >= 1 && v <= 5) { m += 1; if (pol.favourable.includes(v)) y += 1; } });
        return { y, m };
      }).filter((p) => p.m > 0);
      const sum = (f) => people.reduce((a, p) => a + f(p), 0);
      const Y = sum((p) => p.y), M = sum((p) => p.m), n = people.length;
      const counts = [0, 0, 0, 0, 0, 0];
      c.items.forEach((it) => items[it.id].forEach((v, i) => { counts[i] += v; }));
      const fav = M ? Y / M : null;
      // 95% interval for a ratio of totals, treating each person as a cluster of answers.
      let lo = null, hi = null;
      if (n > 1 && M) {
        const mBar = M / n;
        const v = sum((p) => (p.y - fav * p.m) ** 2) / (n * (n - 1) * mBar * mBar);
        const h = 1.96 * Math.sqrt(v);
        lo = Math.max(0, fav - h); hi = Math.min(1, fav + h);
      }
      const total = counts.slice(0, 5).reduce((a, b) => a + b, 0);
      const share = (codes) => (total ? codes.reduce((a, code) => a + counts[code - 1], 0) / total : null);
      scores[c.id] = { favourable: fav, neutral: share(pol.neutral), unfavourable: share(pol.unfavourable), lo, hi, people: n, answers: M, na: counts[5], counts };
    });
    return { n: rs.length, items, scores };
  }

  // ---------- what may be reported (the anonymity rules) ----------
  // Each reporting period is released on its own: the organization-wide dataset and one dataset per
  // department. With k = the minimum group size:
  //  1. A group is shown only if it has at least k completed responses (primary suppression).
  //  2. The hidden departments together must number 0 or at least k; otherwise the smallest shown
  //     department is also withheld, and so on (secondary suppression). This stops anyone working
  //     out a small department by subtracting the shown departments from the organization total.
  //  3. No result covers more than one period, so periods cannot be subtracted from each other.
  //  4. Hidden groups carry no counts or answers at all, not even their size.
  //  5. Relief Map points (section G) follow the same two rules one point at a time, counting the
  //     people who gave a comfort answer ("prefer not to say" does not count): a point is shown for a
  //     group only with at least k such answers, and the answers held back across departments must
  //     number 0 or at least k, so no point can be worked out from the organization-wide one.
  function protect(groups, k, total) {
    // groups: [{key, n}] -> Map key -> 'published' | 'collecting' | 'protected'. total: the size of the
    // whole they are part of (default: their sum); whatever is not shown counts as hidden.
    const status = new Map();
    groups.forEach((g) => status.set(g.key, g.n >= k ? 'published' : 'collecting'));
    const whole = total == null ? groups.reduce((a, g) => a + g.n, 0) : total;
    let hidden = whole - groups.filter((g) => status.get(g.key) === 'published').reduce((a, g) => a + g.n, 0);
    while (hidden > 0 && hidden < k) {
      const shown = groups.filter((g) => status.get(g.key) === 'published');
      if (!shown.length) break;
      const smallest = shown.reduce((a, g) => (g.n < a.n ? g : a)); // ties: first in list order
      status.set(smallest.key, 'protected');
      hidden += smallest.n;
    }
    return status;
  }

  const RELEASE_FORMAT = 'workforce-assessment-release';

  function buildRelease(responses, opts) {
    opts = opts || {};
    const k = Math.max(CONFIG.minGroupSize, opts.minGroupSize || CONFIG.minGroupSize);
    const complete = responses.filter((r) => !problems(r).length);
    const periods = Array.from(new Set(complete.map((r) => r.period))).sort();
    const release = {
      format: RELEASE_FORMAT, version: 1, title: TITLE, minGroupSize: k,
      source: opts.source || 'unknown', label: opts.label || '', created: opts.created || new Date().toISOString().slice(0, 10),
      periods, data: {}
    };
    periods.forEach((p) => {
      const rs = complete.filter((r) => r.period === p);
      const ds = datasets(rs);
      const out = { overall: null, departments: {} };
      const overallShown = rs.length >= k;
      out.overall = overallShown ? Object.assign({ status: 'published' }, aggregate(rs)) : { status: 'collecting' };
      const st = overallShown
        ? protect(DEPARTMENTS.map((d) => ({ key: d.id, n: ds.byDepartment[d.id].length })), k)
        : new Map(DEPARTMENTS.map((d) => [d.id, 'collecting']));
      DEPARTMENTS.forEach((d) => {
        const s = st.get(d.id);
        out.departments[d.id] = s === 'published' ? Object.assign({ status: s }, aggregate(ds.byDepartment[d.id])) : { status: s };
      });
      if (overallShown) addRelief(out, rs, ds, k);
      release.data[p] = out;
    });
    return release;
  }

  // Relief Map points for the shown groups of one period (rule 5): counts for a point that may be
  // shown, null for one held back.
  function addRelief(out, rs, ds, k) {
    const shown = DEPARTMENTS.filter((d) => out.departments[d.id].status === 'published');
    out.overall.relief = {};
    shown.forEach((d) => { out.departments[d.id].relief = {}; });
    RELIEF.items.forEach((it) => {
      const all = countAnswers(rs, it.id);
      const total = answered(all);
      out.overall.relief[it.id] = total >= k ? all : null;
      const points = shown.map((d) => ({ key: d.id, counts: countAnswers(ds.byDepartment[d.id], it.id) }));
      const st = total >= k ? protect(points.map((pt) => ({ key: pt.key, n: answered(pt.counts) })), k, total) : new Map();
      points.forEach((pt) => { out.departments[pt.key].relief[it.id] = st.get(pt.key) === 'published' ? pt.counts : null; });
    });
  }

  // Checks a release before showing it: right format, threshold not lowered, no published group
  // below the threshold, and no hidden remainder small enough to be worked out by subtraction.
  function checkRelease(rel) {
    if (!rel || rel.format !== RELEASE_FORMAT || rel.version !== 1 || !rel.data || !Array.isArray(rel.periods)) throw new Error('This is not an aggregated results file from this assessment.');
    if (!(rel.minGroupSize >= CONFIG.minGroupSize)) throw new Error(`This file uses a minimum group size below ${CONFIG.minGroupSize}, so it cannot be shown.`);
    const k = rel.minGroupSize;
    rel.periods.forEach((p) => {
      const d = rel.data[p];
      if (!d || !d.overall || !d.departments) throw new Error('The file is incomplete.');
      const cells = [d.overall].concat(Object.values(d.departments));
      if (cells.some((c) => c && c.status === 'published' && !(c.n >= k))) throw new Error('The file contains a group below the minimum size, so it cannot be shown.');
      if (cells.some((c) => c && c.status !== 'published' && (c.n != null || c.items || c.scores || c.relief))) throw new Error('The file contains numbers for a group that should be hidden, so it cannot be shown.');
      if (d.overall.status === 'published') {
        const shown = Object.values(d.departments).filter((c) => c.status === 'published').reduce((a, c) => a + c.n, 0);
        const rest = d.overall.n - shown;
        if (rest < 0 || (rest > 0 && rest < k)) throw new Error('The file would let a small group be worked out by subtraction, so it cannot be shown.');
        checkRelief(d, k);
      } else if (Object.values(d.departments).some((c) => c.status === 'published')) {
        throw new Error('The file is inconsistent, so it cannot be shown.');
      }
    });
    return rel;
  }

  // Rule 5 for one period: every shown Relief Map point has at least k answers, and the answers held
  // back from the departments' points number 0 or at least k.
  function checkRelief(d, k) {
    const deps = Object.values(d.departments).filter((c) => c.status === 'published');
    if (!d.overall.relief) {
      if (deps.some((c) => c.relief)) throw new Error('The file is inconsistent, so it cannot be shown.');
      return; // a release made before section G existed has no Relief Map
    }
    const ok = (x) => Array.isArray(x) && x.length === 6 && x.every((v) => Number.isInteger(v) && v >= 0);
    RELIEF.items.forEach((it) => {
      const o = d.overall.relief[it.id];
      const pts = deps.map((c) => (c.relief ? c.relief[it.id] : null)).filter((x) => x != null);
      if (o == null) { if (pts.length) throw new Error('The file is inconsistent, so it cannot be shown.'); return; }
      if (![o].concat(pts).every(ok)) throw new Error('The file is incomplete.');
      if (answered(o) < k || pts.some((x) => answered(x) < k)) throw new Error('The file contains a Relief Map point with fewer answers than the minimum, so it cannot be shown.');
      const rest = answered(o) - pts.reduce((a, x) => a + answered(x), 0);
      if (rest < 0 || (rest > 0 && rest < k)) throw new Error('The file would let a small group be worked out by subtraction, so it cannot be shown.');
    });
  }

  // One reporting group from a release: department 'ALL' (organization-wide) or a department code.
  function cell(rel, period, department) {
    const d = rel && rel.data[period];
    if (!d) return { status: 'collecting' };
    return department === 'ALL' ? d.overall : d.departments[department] || { status: 'collecting' };
  }

  // ---------- aggregated results as a table (safe to share) ----------
  function releaseRows(rel) {
    const rows = [];
    const push = (period, department, c) => {
      const base = { period, department: department === 'ALL' ? 'All departments' : DEPARTMENT_BY_ID[department].name };
      if (!c || c.status !== 'published') {
        rows.push(Object.assign(base, { status: c && c.status === 'protected' ? 'withheld to protect a smaller group' : `fewer than ${rel.minGroupSize} responses`, group_n: '', category: '', question_id: '', concept: '', answer_code: '', answer: '', count: '', percent: '' }));
        return;
      }
      ITEMS.forEach((it) => {
        const relief = it.category === RELIEF.id;
        const counts = relief ? (c.relief || {})[it.id] : c.items[it.id];
        const category = relief ? `${RELIEF.letter}. ${RELIEF.name}` : CATEGORY_BY_ID[it.category].name;
        if (!counts) {
          rows.push(Object.assign({}, base, { status: `point not shown: fewer than ${rel.minGroupSize} answers, or held back to protect one`, group_n: '', category, question_id: it.id, concept: it.concept, answer_code: '', answer: '', count: '', percent: '' }));
          return;
        }
        const subst = answered(counts);
        ANSWER_CODES.forEach((code, i) => rows.push(Object.assign({}, base, {
          status: 'shown', group_n: c.n, category, question_id: it.id, concept: it.concept, answer_code: code, answer: answerLabel(it.id, code),
          count: counts[i], percent: code === NA.code ? (c.n ? +(100 * counts[i] / c.n).toFixed(1) : '') : (subst ? +(100 * counts[i] / subst).toFixed(1) : '')
        })));
      });
    };
    rel.periods.forEach((p) => {
      const d = rel.data[p];
      push(p, 'ALL', d.overall);
      DEPARTMENTS.forEach((dep) => push(p, dep.id, d.departments[dep.id]));
    });
    return rows;
  }

  const csvCell = (v) => (v == null ? '' : /[",\n\r]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  const toCSV = (rows, cols) => [cols.join(',')].concat(rows.map((r) => cols.map((c) => csvCell(r[c])).join(','))).join('\r\n') + '\r\n';
  const releaseCSV = (rel) => toCSV(releaseRows(rel), ['period', 'department', 'status', 'group_n', 'category', 'question_id', 'concept', 'answer_code', 'answer', 'count', 'percent']);

  // ---------- Qualtrics ----------
  function questions() {
    const list = [
      { id: 'INTRO', type: 'DB', block: 'Introduction', text: `${TITLE}. ${TEXT.intro}` },
      { id: 'PRIVACY', type: 'DB', block: 'Introduction', text: TEXT.privacy.join(' ') },
      { id: CONSENT.id, type: 'MC', block: 'Introduction', text: CONSENT.text, options: CONSENT.options, codes: [1, 2] },
      { id: DEPARTMENT_Q.id, type: 'MC', block: 'Your department', text: `${DEPARTMENT_Q.text} ${DEPARTMENT_Q.help}`, options: DEPARTMENTS.map((d) => d.name), codes: DEPARTMENTS.map((_, i) => i + 1) }
    ];
    CATEGORIES.forEach((c) => {
      const block = `${c.letter}. ${c.name}`;
      list.push({ id: `${c.id}_INTRO`, type: 'DB', block, text: `${block}. ${c.intro}${c.caution ? ` ${c.caution}` : ''}` });
      c.items.forEach((it) => list.push({ id: it.id, type: 'MC', block, text: it.text, options: SCALES[c.scale].options.concat(NA.label), codes: ANSWER_CODES }));
    });
    // Section G: one block (one page) per setting, five questions each.
    RELIEF.settings.forEach((s, i) => {
      const block = `${RELIEF.letter}${i + 1}. ${RELIEF.name}: ${s.name}`;
      if (i === 0) list.push({ id: `${RELIEF.id}_INTRO`, type: 'DB', block, text: `${RELIEF.letter}. ${RELIEF.name}. ${RELIEF.intro} ${RELIEF.note} If you prefer not to answer, or you do not take part in a setting, choose "${SCALES.comfort.na}".` });
      RELIEF.items.filter((it) => it.setting === s.id).forEach((it) => list.push({ id: it.id, type: 'MC', block, text: it.text, options: SCALES.comfort.options.concat(SCALES.comfort.na), codes: ANSWER_CODES }));
    });
    list.push({ id: 'REVIEW', type: 'DB', block: 'Review', text: 'Before you submit: use the Back button to review or change any answer. When you are ready, select the arrow to submit.' });
    return list;
  }

  // Qualtrics Advanced Format TXT (Tools > Import/Export > Import survey). After importing, turn on
  // "Force response" for every question; the TXT format cannot set it.
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

  function codebookRows() {
    const codes = (opts, codesList) => opts.map((o, i) => `${codesList[i]} = ${o}`).join('; ');
    const rows = [
      { question_id: CONSENT.id, section: 'Introduction', concept: 'Consent', question: CONSENT.text, type: 'Single choice (radio)', required: 'Yes', answers: codes(CONSENT.options, [1, 2]), basis: '', sources: '', note: '"No" ends the assessment; nothing is recorded.' },
      { question_id: DEPARTMENT_Q.id, section: 'Your department', concept: 'Professional department', question: DEPARTMENT_Q.text, type: 'Single choice (radio)', required: 'Yes', answers: codes(DEPARTMENTS.map((d) => `${d.name} [${d.id}]`), DEPARTMENTS.map((_, i) => i + 1)), basis: '', sources: '', note: 'Used only to group answers into department datasets. Stored as the code in brackets.' }
    ];
    CATEGORIES.forEach((c) => c.items.forEach((it) => rows.push({
      question_id: it.id, section: `${c.letter}. ${c.name}`, concept: it.concept, question: it.text, type: 'Single choice (radio)', required: 'Yes',
      answers: codes(SCALES[c.scale].options.concat(NA.label), ANSWER_CODES), basis: it.basis,
      sources: it.sources.map((s) => SOURCES[s].short).join('; '), note: `${it.note} Favourable = ${favourableWords(c.id)}.`
    })));
    RELIEF.items.forEach((it) => rows.push({
      question_id: it.id, section: `${RELIEF.letter}. ${RELIEF.name}: ${RELIEF_SETTING_BY_ID[it.setting].name}`, concept: it.concept, question: it.text, type: 'Single choice (radio)', required: 'Yes',
      answers: codes(SCALES.comfort.options.concat(SCALES.comfort.na), ANSWER_CODES), basis: it.basis,
      sources: it.sources.map((s) => SOURCES[s].short).join('; '),
      note: `${it.note} Relief Map line: ${RELIEF_DIMENSION_BY_ID[it.dimension].name}. Point = average answer (1 = very comfortable, 5 = very uncomfortable), leaving out code 98; shown only when at least ${CONFIG.minGroupSize} people gave a comfort answer.`
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
  // dates and any other columns are discarded: only the reporting period is kept.
  function readExport(text) {
    const rows = parseCSV(text);
    if (!rows.length) throw new Error('The file is empty.');
    const head = rows[0].map((h) => h.trim());
    const col = (name) => head.indexOf(name);
    if (col(DEPARTMENT_Q.id) < 0 || !ITEMS.some((it) => col(it.id) >= 0)) throw new Error('This does not look like an export of this assessment: the DEPARTMENT column or question columns such as PS1 are missing.');
    const choice = (raw, labels, codes) => {
      const v = String(raw == null ? '' : raw).trim();
      if (/^\d+$/.test(v)) { const n = Number(v); return codes.includes(n) ? n : null; }
      const i = labels.findIndex((o) => norm(o) === norm(v));
      return i >= 0 ? codes[i] : null;
    };
    const out = { responses: [], declined: 0, incomplete: 0, tests: 0, identifying: false, demo: false, periods: new Set() };
    let demoIds = 0, rowsSeen = 0;
    const dateCol = ['RecordedDate', 'EndDate', 'StartDate'].map(col).find((c) => c >= 0);
    rows.slice(1).forEach((r) => {
      const first = (r[0] || '').trim();
      if (first.startsWith('{"ImportId"') || first === 'Start Date' || first === 'Response ID') return; // extra header rows
      if (String(r[col(DEPARTMENT_Q.id)] || '').length > 60) return; // question-text row
      const status = col('Status') >= 0 ? String(r[col('Status')] || '').trim() : '';
      if (['1', '2', '8', '9', '12', '17'].includes(status) || /preview|test|spam|imported/i.test(status)) { out.tests += 1; return; }
      if (col(CONSENT.id) >= 0 && choice(r[col(CONSENT.id)], CONSENT.options, [1, 2]) !== 1) { out.declined += 1; return; }
      if (IDENTIFYING.some((n) => col(n) >= 0 && String(r[col(n)] || '').trim())) out.identifying = true;
      rowsSeen += 1;
      if (col('ResponseId') >= 0 && /^R_demo\d+$/.test(String(r[col('ResponseId')] || '').trim())) demoIds += 1;
      const finished = col('Finished') >= 0 ? String(r[col('Finished')] || '').trim() : '1';
      const dep = choice(r[col(DEPARTMENT_Q.id)], DEPARTMENTS.map((x) => x.name), DEPARTMENTS.map((_, i) => i + 1));
      const answers = {};
      ITEMS.forEach((it) => { answers[it.id] = col(it.id) >= 0 ? choice(r[col(it.id)], SCALES[it.scale].options.concat(naLabel(it.scale)), ANSWER_CODES) : null; });
      const raw = dateCol != null ? String(r[dateCol] || '').trim() : '';
      const period = raw ? periodOf(raw.replace(' ', 'T') + (/[zZ]|[+-]\d\d:?\d\d$/.test(raw) ? '' : 'Z')) : null;
      const resp = { id: responseId(), period, department: dep ? DEPARTMENTS[dep - 1].id : null, answers };
      if (!/^(1|true)$/i.test(finished) || problems(resp).length) { out.incomplete += 1; return; }
      out.periods.add(period);
      out.responses.push(resp);
    });
    out.periods = Array.from(out.periods).sort();
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

  // Department sizes in the latest demonstration period. They are invented, and set so that the
  // dashboard shows every case: departments that are shown, one still collecting (Legal & Compliance,
  // 8 responses) and one withheld to protect it (Leadership & Management). In a live demo, two more
  // Legal & Compliance answers unlock both.
  const DEMO = {
    periods: ['2026-Q2', '2026-Q3', '2026-Q4'],
    scale: [0.45, 0.8, 1],
    groups: { HR: 15, FIN: 12, MKT: 11, RES: 13, IT: 14, LEG: 8, OPS: 18, PPM: 23, POL: 12, HUM: 26, LEAD: 10, OTH: 11 },
    unlock: { department: 'LEG', needed: 2, alsoShows: 'LEAD' },
    level: { PS: 3.75, IN: 3.65, CC: 3.6, LM: 3.7, IB: 3.35, OS: 3.25 }, // average favourability, 1 to 5
    cuts: [1.6, 2.6, 3.25, 4.35], // latent score -> answer 1 to 5 (5 = most favourable)
    na: { CC3: 0.12, IB4: 0.1, OS3: 0.16 },
    // Section G: the level of discomfort (1 = very comfortable, 5 = very uncomfortable) in each setting
    // in relation to each identity dimension, before random differences. Invented so that the fictional
    // organization-wide map shows each kind of place; they are not findings.
    relief: {
      level: {
        TM: { GEN: 2.45, AGE: 2.3, REL: 2.05, ETH: 2.4, CLS: 2.35 },
        SUP: { GEN: 1.85, AGE: 1.75, REL: 1.5, ETH: 1.7, CLS: 1.8 },
        HYB: { GEN: 2.15, AGE: 2.75, REL: 1.85, ETH: 2.15, CLS: 2.05 },
        NET: { GEN: 2.2, AGE: 1.9, REL: 3.2, ETH: 3.0, CLS: 3.3 },
        DEC: { GEN: 3.35, AGE: 3.2, REL: 2.65, ETH: 3.15, CLS: 3.6 }
      },
      na: { GEN: 0.02, AGE: 0.015, REL: 0.07, ETH: 0.04, CLS: 0.03 }, // "prefer not to say"
      naSetting: { SUP: 0.02, DEC: 0.04 } // plus "not applicable": not everyone takes part
    }
  };
  const demoPeriod = () => DEMO.periods[DEMO.periods.length - 1];

  function demoResponses() {
    const rand = rng(20261117);
    const normal = () => { let u = 0, v = 0; while (!u) u = rand(); while (!v) v = rand(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
    // Small random differences by department: they are noise, not findings about any real department.
    const effect = {};
    DEPARTMENTS.forEach((d) => { effect[d.id] = Object.fromEntries(CATEGORIES.map((c) => [c.id, normal() * 0.12])); });
    // Section G answers come from their own random stream, so the answers to the six areas are the
    // same as before section G was added.
    const rand2 = rng(20261120);
    const normal2 = () => { let u = 0, v = 0; while (!u) u = rand2(); while (!v) v = rand2(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
    const R = DEMO.relief;
    const reliefEffect = {};
    DEPARTMENTS.forEach((d) => { reliefEffect[d.id] = Object.fromEntries(RELIEF.items.map((it) => [it.id, normal2() * 0.22])); });
    const out = [];
    DEMO.periods.forEach((p, pi) => {
      DEPARTMENTS.forEach((d) => {
        const size = Math.round((DEMO.groups[d.id] || 0) * DEMO.scale[pi]);
        for (let i = 0; i < size; i += 1) {
          const person = normal() * 0.6;
          const answers = {};
          CATEGORIES.forEach((c) => c.items.forEach((it) => {
            if (rand() < (DEMO.na[it.id] || 0.03)) { answers[it.id] = NA.code; return; }
            const x = DEMO.level[c.id] + effect[d.id][c.id] + 0.06 * pi + person + normal() * 0.85;
            const v = 1 + DEMO.cuts.filter((cut) => x >= cut).length;
            answers[it.id] = c.lowerIsBetter ? v : 6 - v; // v = 5 is the most favourable answer
          }));
          const ease = normal2() * 0.4; // how at ease this person is in general
          const axis = Object.fromEntries(RELIEF.dimensions.map((dim) => [dim.id, normal2() * 0.35]));
          RELIEF.items.forEach((it) => {
            if (rand2() < R.na[it.dimension] + (R.naSetting[it.setting] || 0)) { answers[it.id] = NA.code; return; }
            const x = R.level[it.setting][it.dimension] + reliefEffect[d.id][it.id] - 0.04 * pi + ease + axis[it.dimension] + normal2() * 0.6;
            answers[it.id] = Math.min(5, Math.max(1, Math.round(x)));
          });
          out.push({ id: responseId(rand), period: p, department: d.id, answers });
        }
      });
    });
    return out;
  }

  // The demonstration data in the layout of a Qualtrics CSV export (numeric values).
  function demoCSV() {
    const meta = ['StartDate', 'EndDate', 'Status', 'IPAddress', 'Progress', 'Duration (in seconds)', 'Finished', 'RecordedDate', 'ResponseId', 'DistributionChannel', 'UserLanguage'];
    const cols = questions().filter((q) => q.type !== 'DB');
    const rand = rng(7);
    const lines = [meta.concat(cols.map((c) => c.id)), meta.concat(cols.map((c) => c.text)), meta.map((m) => `{"ImportId":"${m}"}`).concat(cols.map((c, i) => `{"ImportId":"QID${i + 1}"}`))];
    const month = { Q1: 2, Q2: 5, Q3: 8, Q4: 11 };
    demoResponses().forEach((r, i) => {
      const [y, q] = r.period.split('-');
      const date = `${y}-${String(month[q]).padStart(2, '0')}-${String(1 + (i % 27)).padStart(2, '0')} ${String(9 + (i % 8)).padStart(2, '0')}:${String((i * 7) % 60).padStart(2, '0')}:00`;
      const values = cols.map((c) => {
        if (c.id === CONSENT.id) return 1;
        if (c.id === DEPARTMENT_Q.id) return DEPARTMENTS.findIndex((d) => d.id === r.department) + 1;
        return r.answers[c.id];
      });
      lines.push([date, date, 0, '', 100, 300 + Math.floor(rand() * 300), 1, date, `R_demo${String(i + 1).padStart(5, '0')}`, 'anonymous', 'EN'].concat(values));
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
  const schema = () => ({ departments: DEPARTMENTS.map((d) => d.id), items: ITEMS.map((it) => it.id), codes: ANSWER_CODES.slice() });

  return {
    CONFIG, TITLE, SHORT_TITLE, DASHBOARD_TITLE, DEPARTMENTS, CONSENT, DEPARTMENT_Q, NA, SCALES, SOURCES, CATEGORIES, ITEMS, AREA_ITEMS,
    RELIEF, RELIEF_SETTING_BY_ID, RELIEF_DIMENSION_BY_ID, PLACE_TYPES, PLACE_TYPE_BY_ID, PLACE_MIN_LINES,
    ITEM_BY_ID, CATEGORY_BY_ID, DEPARTMENT_BY_ID, QUESTION_COUNT, ANSWER_CODES, TEXT, DEMO, RELEASE_FORMAT,
    polarity, favourableWords, naLabel, answerLabel, periodOf, periodLabel, responseId, problems, makeResponse, submissionPayload,
    longRows, datasets, countAnswers, aggregate, protect, buildRelease, checkRelease, cell, releaseRows, releaseCSV, questions, qualtricsTxt,
    codebookRows, codebookCSV, parseCSV, readExport, rng, demoResponses, demoCSV, demoStore, demoPeriod, schema,
    answered, reliefItem, reliefValue, placeType, reliefMap
  };
});
