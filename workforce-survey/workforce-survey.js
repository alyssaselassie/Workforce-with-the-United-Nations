// UN Workforce Experience Survey: the questions, answer scales and sources; the per-entity datasets;
// the anonymity rules that decide what may be reported; the Qualtrics import file and export reader;
// and the clearly labelled demonstration data. Works in the browser (window.WorkforceSurvey) and in
// Node, so the same rules can run on a server that releases only aggregated results.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.WorkforceSurvey = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------- settings ----------
  const CONFIG = {
    // The anonymity threshold: no result is shown for a group of fewer completed responses than this.
    // It applies to every reporting group, including entity x function filters. Raise it if needed;
    // do not lower it below 10 without advice from your data-protection focal point.
    minGroupSize: 10,
    // How submissions are grouped into reporting periods. Only the period is stored, never the date.
    period: 'quarter',
    // Browser storage for the website prototype (responses submitted on this device only).
    storageKey: 'un-workforce-survey.responses.v1' // not 'uncq.': the site's demo-mode cleanup removes those keys on every page load
  };

  const SURVEY_TITLE = 'UN Workforce Experience Survey';

  // ---------- who is answering ----------
  const ENTITIES = [
    { id: 'DPPA', short: 'DPPA', name: 'Department of Political and Peacebuilding Affairs (DPPA)' },
    { id: 'DPO', short: 'DPO', name: 'Department of Peace Operations (DPO)' },
    { id: 'OCHA', short: 'OCHA', name: 'Office for the Coordination of Humanitarian Affairs (OCHA)' },
    { id: 'UNDP', short: 'UNDP', name: 'United Nations Development Programme (UNDP)' },
    { id: 'UNICEF', short: 'UNICEF', name: "United Nations Children's Fund (UNICEF)" },
    { id: 'UNHCR', short: 'UNHCR', name: 'United Nations High Commissioner for Refugees (UNHCR)' },
    { id: 'WFP', short: 'WFP', name: 'World Food Programme (WFP)' },
    { id: 'WHO', short: 'WHO', name: 'World Health Organization (WHO)' },
    { id: 'DMSPC', short: 'DMSPC', name: 'Department of Management Strategy, Policy and Compliance (DMSPC)' },
    { id: 'DOS', short: 'DOS', name: 'Department of Operational Support (DOS)' },
    { id: 'OHCHR', short: 'OHCHR', name: 'Office of the High Commissioner for Human Rights (OHCHR)' },
    { id: 'UNWOMEN', short: 'UN Women', name: 'UN Women' },
    { id: 'OLA', short: 'OLA', name: 'United Nations Office of Legal Affairs (OLA)' },
    { id: 'OTHER', short: 'Other entities', name: 'Other UN entity or office' }
  ].map((e) => Object.assign(e, { dataset: e.id === 'OTHER' ? 'Other Entities Dataset' : `${e.short} Dataset` }));

  const FUNCTIONS = [
    { id: 'HUM', name: 'Humanitarian / Field Operations' },
    { id: 'POL', name: 'Political Affairs / Peacekeeping' },
    { id: 'HR', name: 'Human Resources' },
    { id: 'ADM', name: 'Administration / Operations' },
    { id: 'COM', name: 'Communications / Public Information' },
    { id: 'RES', name: 'Research / Data / Analytics' },
    { id: 'PRG', name: 'Programme Management / Development' },
    { id: 'LEG', name: 'Legal / Policy' },
    { id: 'LEAD', name: 'Leadership / Management' },
    { id: 'OTH', name: 'Other' }
  ];

  const CONSENT = { id: 'CONSENT', text: 'Do you agree to take part in this survey?', options: ['Yes, I agree to take part', 'No, I do not want to take part'] };
  const ENTITY_Q = { id: 'ENTITY', text: 'Which UN entity or office do you work for?',
    help: 'Choose the one that best describes where you work. The list includes Secretariat departments and offices, funds and programmes, and specialized agencies. If yours is not listed, choose "Other UN entity or office".' };
  const FUNCTION_Q = { id: 'FUNCTION', text: 'Which professional function best describes your work?', help: 'Choose the closest match.' };

  // ---------- answer scales ----------
  // Codes follow the order shown (1 = first option). Code 98 is the same non-substantive answer on
  // every statement, so a required question never forces a guess; it is reported separately and
  // left out of percentages.
  const NA = { code: 98, label: "Don't know or not applicable" };
  const SCALES = {
    agree: { id: 'agree', name: 'Agreement', options: ['Strongly agree', 'Agree', 'Neither agree nor disagree', 'Disagree', 'Strongly disagree'] },
    frequency: { id: 'frequency', name: 'Frequency', options: ['Always', 'Often', 'Sometimes', 'Rarely', 'Never'] }
  };
  // The confidence scale in the brief is not used: as written, "Slightly confident" sits below the
  // neutral point, so the scale is not balanced. None of the six categories needs it.

  // ---------- sources (all real, checked; every item is adapted or new wording, never copied) ----------
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
    opm: { short: 'OPM FEVS inclusion index', cite: 'U.S. Office of Personnel Management. Federal Employee Viewpoint Survey: the New Inclusion Quotient (New IQ) index (five habits of inclusion: fair, open, cooperative, supportive, empowering), replaced in 2020 by the DEIA index.', url: 'https://www.opm.gov/fevs/' }
  };

  // ---------- the six measurement categories ----------
  // basis: 'Adapted' = reworded from a published item (quoted in `note`); 'New' = new wording of a
  // published concept, or a new item for UN workplaces.
  const I = (id, concept, text, basis, sources, note) => ({ id, concept, text, basis, sources, note: note || '' });
  const CATEGORIES = [
    { id: 'PS', letter: 'A', name: 'Psychological safety', scale: 'agree',
      intro: 'Think about the team you work with most closely. How much do you agree with each statement?',
      items: [
        I('PS1', 'Expressing different opinions', 'In my team, I can express an opinion that differs from others\' without fear of negative consequences.', 'New', ['edmondson'], 'New wording of the team psychological safety concept.'),
        I('PS2', 'Asking questions', 'I can ask questions in my team without worrying about how I will be seen.', 'New', ['edmondson'], 'New wording of the team psychological safety concept.'),
        I('PS3', 'Admitting mistakes', 'If I make a mistake in my team, it is not held against me.', 'Adapted', ['edmondson'], 'Reworded positively from "If you make a mistake on this team, it is often held against you."'),
        I('PS4', 'Raising concerns', 'I feel safe raising problems and difficult issues in my team.', 'Adapted', ['edmondson'], 'Adapted from "Members of this team are able to bring up problems and tough issues."'),
        I('PS5', 'Disagreeing with supervisors', 'I can respectfully disagree with my supervisor without fear of negative consequences.', 'New', ['edmondson', 'detert'], 'New item: psychological safety and voice towards leaders.'),
        I('PS6', 'Seeking assistance', 'It is easy to ask colleagues in my team for help.', 'Adapted', ['edmondson', 'copsoq'], 'Reworded positively from "It is difficult to ask other members of this team for help."')
      ] },
    { id: 'IN', letter: 'B', name: 'Workplace inclusion', scale: 'agree',
      intro: 'Think about your workplace. How much do you agree with each statement?',
      items: [
        I('IN1', 'Sense of belonging', 'I feel that I belong in my team.', 'New', ['jansen', 'shore'], 'New wording of the belonging dimension of inclusion.'),
        I('IN2', 'Equal participation', 'Everyone in my team has an equal opportunity to take part in discussions.', 'New', ['nishii'], 'New wording of inclusion in decision-making.'),
        I('IN3', 'Respect across cultural backgrounds', 'Colleagues are treated with respect whatever their cultural or national background.', 'New', ['copsoq', 'nishii'], 'New wording of the justice and respect concept.'),
        I('IN4', 'Access to opportunities', 'Opportunities such as assignments, training and travel are open to everyone in my team.', 'New', ['nishii'], 'New wording of equitable employment practices.'),
        I('IN5', 'Recognition of different perspectives', 'Different perspectives are valued in my team, even when they challenge the usual way of working.', 'New', ['nishii', 'shore'], 'New wording of integration of differences and uniqueness.'),
        I('IN6', 'Fair treatment', 'I am treated fairly at work.', 'New', ['colquitt', 'copsoq'], 'New wording of organizational justice.')
      ] },
    { id: 'CC', letter: 'C', name: 'Cross-cultural collaboration', scale: 'agree',
      intro: 'Think about working with colleagues from different cultural, national and professional backgrounds. How much do you agree with each statement?',
      items: [
        I('CC1', 'Communication across cultural differences', 'People in my team communicate effectively across cultural and language differences.', 'New', ['ang'], 'New item informed by cultural intelligence research.'),
        I('CC2', 'International and national staff', 'International and national staff in my workplace work together as equal partners.', 'New', [], 'New item for UN workplaces. "Don\'t know or not applicable" covers offices without national staff.'),
        I('CC3', 'Understanding different working styles', 'Colleagues make an effort to understand working styles that differ from their own.', 'New', ['ang'], 'New item informed by cultural intelligence research.'),
        I('CC4', 'Handling misunderstandings', 'When misunderstandings arise between colleagues from different backgrounds, they are resolved respectfully.', 'New', ['copsoq'], 'New item related to "Are conflicts resolved in a fair way?"'),
        I('CC5', 'Sharing knowledge across teams', 'Knowledge and information are shared openly across teams and duty stations.', 'Adapted', ['copsoq'], 'Reworded positively from "Do the employees withhold information from each other?"')
      ] },
    { id: 'LM', letter: 'D', name: 'Leadership and management', scale: 'agree',
      intro: 'Think about your direct supervisor and the management of your office. How much do you agree with each statement?',
      items: [
        I('LM1', 'Fairness of supervisors', 'My supervisor treats all team members fairly.', 'New', ['copsoq', 'colquitt'], 'New wording of justice and respect.'),
        I('LM2', 'Inclusive decision-making', 'My supervisor involves team members in decisions that affect their work.', 'New', ['nishii', 'copsoq'], 'New wording of inclusion in decision-making and influence at work.'),
        I('LM3', 'Openness to feedback', 'My supervisor is open to feedback, including criticism.', 'New', ['detert'], 'New wording of managerial openness.'),
        I('LM4', 'Recognition of contributions', 'My supervisor recognizes everyone\'s contributions, not only the most visible ones.', 'New', ['copsoq'], 'New item related to "Is your work recognised and appreciated by the management?"'),
        I('LM5', 'Transparency', 'Management explains the reasons for decisions that affect staff.', 'New', ['colquitt'], 'New wording of informational justice.'),
        I('LM6', 'Respectful communication', 'My supervisor communicates with team members respectfully.', 'New', ['colquitt'], 'New wording of interpersonal justice.')
      ] },
    { id: 'IB', letter: 'E', name: 'Implicit bias and organizational awareness', scale: 'frequency', lowerIsBetter: true,
      intro: 'In the past 3 months (or since you joined, if that is more recent), how often have you noticed the following in your workplace?',
      caution: 'These questions ask what you have noticed in workplace practices. They do not measure anyone\'s implicit bias, and results are never about individuals.',
      items: [
        I('IB1', 'Assumptions in workplace decisions', 'Decisions based on assumptions about people\'s backgrounds rather than on evidence', 'New', ['greenwald'], 'New item; perceptions of workplace practices, not a measure of implicit bias.'),
        I('IB2', 'Cultural stereotypes', 'Colleagues using stereotypes about a nationality, culture or region', 'New', [], 'New item.'),
        I('IB3', 'Unequal treatment', 'Colleagues being treated differently because of their nationality, gender, language, age or other background', 'New', ['copsoq'], 'New item related to justice and respect.'),
        I('IB4', 'Bias in recruitment and advancement', 'Factors other than merit affecting who is recruited or promoted', 'New', ['opm'], 'New item related to the "fair" habit of the New IQ inclusion index.'),
        I('IB5', 'Differences in recognition', 'Similar contributions being recognized differently depending on who made them', 'New', ['copsoq'], 'New item related to recognition.'),
        I('IB6', 'Institutional power dynamics', 'Differences in power (for example between headquarters and the field, international and national staff, or senior and junior staff) deciding whose views count', 'New', [], 'New item reflecting the Bias Toolkit\'s focus on power dynamics.')
      ] },
    { id: 'OS', letter: 'F', name: 'Organizational support', scale: 'agree',
      intro: 'Think about your organization as a whole. How much do you agree with each statement?',
      items: [
        I('OS1', 'Access to diversity and inclusion training', 'I have access to training on diversity, inclusion and bias.', 'New', [], 'New item.'),
        I('OS2', 'Reporting mechanisms', 'I know how to report discrimination or unfair treatment in my organization.', 'New', [], 'New item.'),
        I('OS3', 'Organizational accountability', 'When discrimination or unfair treatment is reported, my organization takes appropriate action.', 'New', ['nishii'], 'New item related to equitable employment practices.'),
        I('OS4', 'Management support', 'Senior management actively supports diversity and inclusion.', 'New', ['opm'], 'New item related to the "open" habit of the New IQ inclusion index.'),
        I('OS5', 'Professional development', 'I have opportunities for professional development in my organization.', 'New', ['copsoq', 'eisenberger'], 'New wording of possibilities for development and perceived organizational support.')
      ] }
  ];
  CATEGORIES.forEach((c) => c.items.forEach((it) => { it.category = c.id; it.scale = c.scale; }));
  const ITEMS = CATEGORIES.flatMap((c) => c.items);
  const ITEM_BY_ID = Object.fromEntries(ITEMS.map((it) => [it.id, it]));
  const CATEGORY_BY_ID = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));
  const ENTITY_BY_ID = Object.fromEntries(ENTITIES.map((e) => [e.id, e]));
  const FUNCTION_BY_ID = Object.fromEntries(FUNCTIONS.map((f) => [f.id, f]));

  // Favourable = the two most positive answers. For category E (frequency of noticing bias), less
  // often is more favourable. `order` lists codes from most to least favourable, for charts.
  function polarity(categoryId) {
    const c = CATEGORY_BY_ID[categoryId];
    return c.lowerIsBetter
      ? { favourable: [4, 5], neutral: [3], unfavourable: [1, 2], order: [5, 4, 3, 2, 1] }
      : { favourable: [1, 2], neutral: [3], unfavourable: [4, 5], order: [1, 2, 3, 4, 5] };
  }
  const answerLabel = (itemId, code) => (code === NA.code ? NA.label : SCALES[ITEM_BY_ID[itemId].scale].options[code - 1]);

  const TEXT = {
    intro: 'This survey asks about psychological safety, inclusion, cross-cultural collaboration, leadership, bias in workplace practices and organizational support. It has 37 multiple-choice questions and takes about 8 minutes. Every question needs an answer; if a statement does not apply to you, choose "Don\'t know or not applicable".',
    privacy: [
      'Taking part is voluntary. You can stop at any time before you submit, and nothing is recorded until you do.',
      'We do not ask for your name, email, staff ID or duty station, and we do not record your IP address or location.',
      'Your entity and professional function are used only to group answers, and the date only to assign a reporting period (such as October to December 2026).',
      'Results are shown only for groups of at least 10 people. Individual answers are never shown to anyone, including supervisors.'
    ],
    thanks: 'Thank you for taking part. Your answers have been recorded anonymously. Results will be shared only as group results, for groups of at least 10 people.',
    declined: 'Thank you. You chose not to take part, so the survey has ended and nothing was recorded.'
  };

  // ---------- reporting periods ----------
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function periodOf(date) {
    const d = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(d.getTime())) return null;
    return `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`;
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

  const validCode = (code) => (Number.isInteger(code) && code >= 1 && code <= 5) || code === NA.code;

  // Lists what is missing or invalid; an empty list means the response is complete.
  function problems(r) {
    const out = [];
    if (!r || typeof r !== 'object') return ['Not a response.'];
    if (!ENTITY_BY_ID[r.entity]) out.push(ENTITY_Q.id);
    if (!FUNCTION_BY_ID[r.function]) out.push(FUNCTION_Q.id);
    if (!/^\d{4}-Q[1-4]$/.test(String(r.period || ''))) out.push('PERIOD');
    ITEMS.forEach((it) => { if (!r.answers || !validCode(r.answers[it.id])) out.push(it.id); });
    return out;
  }

  // Builds the stored record from the survey's answers. Throws if anything is missing, so an
  // incomplete survey can never be saved.
  function makeResponse(input, opts) {
    opts = opts || {};
    const r = {
      id: opts.id || responseId(opts.rand),
      period: opts.period || periodOf(opts.date || new Date()),
      entity: input.entity,
      function: input.function,
      answers: Object.fromEntries(ITEMS.map((it) => [it.id, input.answers ? input.answers[it.id] : undefined]))
    };
    const missing = problems(r);
    if (missing.length) throw new Error(`Incomplete response: ${missing.join(', ')}`);
    return r;
  }

  // The structured dataset in long form: one row per answer, each tied to its entity, function,
  // reporting period, question and category.
  function longRows(responses) {
    return responses.flatMap((r) => ITEMS.map((it) => ({
      response_id: r.id, entity: r.entity, function: r.function, period: r.period,
      question_id: it.id, category: it.category, answer_code: r.answers[it.id], answer: answerLabel(it.id, r.answers[it.id])
    })));
  }

  // Separate analytical datasets: one per entity, plus the organization-wide dataset.
  function datasets(responses) {
    const byEntity = Object.fromEntries(ENTITIES.map((e) => [e.id, []]));
    responses.forEach((r) => { if (byEntity[r.entity]) byEntity[r.entity].push(r); });
    return { overall: responses.slice(), byEntity };
  }

  // ---------- aggregation ----------
  function aggregate(rs) {
    const items = {};
    ITEMS.forEach((it) => {
      const counts = [0, 0, 0, 0, 0, 0]; // codes 1 to 5, then "don't know or not applicable"
      rs.forEach((r) => { const c = r.answers[it.id]; if (c === NA.code) counts[5] += 1; else if (c >= 1 && c <= 5) counts[c - 1] += 1; });
      items[it.id] = counts;
    });
    const scores = {};
    CATEGORIES.forEach((c) => {
      const pol = polarity(c.id);
      // Per person: favourable answers (y) out of substantive answers (m) in this category.
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
  // Each reporting period is released on its own, as a tree: organization -> entity -> entity x
  // function. Rules, with k = minimum group size:
  //  1. A group is shown only if it has at least k completed responses (primary suppression).
  //  2. Within each parent, the hidden siblings together must number 0 or at least k; otherwise
  //     the smallest shown sibling is also withheld, and so on (secondary suppression). This stops
  //     anyone working out a small group by subtracting the shown groups from the parent total.
  //  3. Function groups are only released inside a released entity.
  //  4. Organization-wide function results add up released entity x function groups only, so
  //     they never reveal anything new.
  //  5. No result covers more than one period, so periods cannot be subtracted from each other.
  // Withheld groups carry no counts or answers at all.
  function protect(groups, k) {
    // groups: [{key, n}] -> Map key -> 'published' | 'collecting' | 'protected'
    const status = new Map();
    groups.forEach((g) => status.set(g.key, g.n >= k ? 'published' : 'collecting'));
    let hidden = groups.filter((g) => status.get(g.key) !== 'published').reduce((a, g) => a + g.n, 0);
    while (hidden > 0 && hidden < k) {
      const shown = groups.filter((g) => status.get(g.key) === 'published');
      if (!shown.length) break;
      const smallest = shown.reduce((a, g) => (g.n < a.n ? g : a)); // ties: first in list order
      status.set(smallest.key, 'protected');
      hidden += smallest.n;
    }
    return status;
  }

  function buildRelease(responses, opts) {
    opts = opts || {};
    const k = Math.max(CONFIG.minGroupSize, opts.minGroupSize || CONFIG.minGroupSize);
    const complete = responses.filter((r) => !problems(r).length);
    const periods = Array.from(new Set(complete.map((r) => r.period))).sort();
    const release = {
      format: 'workforce-survey-release', version: 1, survey: SURVEY_TITLE, minGroupSize: k,
      source: opts.source || 'unknown', label: opts.label || '', created: opts.created || new Date().toISOString().slice(0, 10),
      periods, data: {}
    };
    periods.forEach((p) => {
      const rs = complete.filter((r) => r.period === p);
      const ds = datasets(rs);
      const out = { overall: null, entities: {}, functions: {}, orgFunctions: {}, mix: {} };
      const overallShown = rs.length >= k;
      out.overall = overallShown ? Object.assign({ status: 'published' }, aggregate(rs)) : { status: 'collecting' };
      const eStatus = overallShown
        ? protect(ENTITIES.map((e) => ({ key: e.id, n: ds.byEntity[e.id].length })), k)
        : new Map(ENTITIES.map((e) => [e.id, 'collecting']));
      const published = {};
      ENTITIES.forEach((e) => {
        const st = eStatus.get(e.id);
        out.entities[e.id] = st === 'published' ? Object.assign({ status: st }, aggregate(ds.byEntity[e.id])) : { status: st };
        out.functions[e.id] = {};
        if (st !== 'published') {
          FUNCTIONS.forEach((f) => { out.functions[e.id][f.id] = { status: st }; }); // hidden with their entity
          return;
        }
        const byF = Object.fromEntries(FUNCTIONS.map((f) => [f.id, ds.byEntity[e.id].filter((r) => r.function === f.id)]));
        const fStatus = protect(FUNCTIONS.map((f) => ({ key: f.id, n: byF[f.id].length })), k);
        published[e.id] = {};
        FUNCTIONS.forEach((f) => {
          const fs = fStatus.get(f.id);
          out.functions[e.id][f.id] = fs === 'published' ? Object.assign({ status: fs }, aggregate(byF[f.id])) : { status: fs };
          if (fs === 'published') published[e.id][f.id] = byF[f.id];
        });
      });
      // Rule 4: organization-wide function results from released entity x function groups only.
      FUNCTIONS.forEach((f) => {
        const parts = Object.keys(published).filter((e) => published[e][f.id]);
        const rsF = parts.flatMap((e) => published[e][f.id]);
        out.orgFunctions[f.id] = rsF.length ? Object.assign({ status: 'published', entities: parts.length }, aggregate(rsF)) : { status: 'collecting' };
      });
      // Respondent mix for fair comparisons, from released function groups plus one "other" bucket
      // (which anyone can already work out), so it reveals nothing new.
      const mixOf = (e) => {
        const n = out.entities[e].n, v = {};
        let rest = n;
        FUNCTIONS.forEach((f) => { const c = out.functions[e][f.id]; if (c.status === 'published') { v[f.id] = c.n / n; rest -= c.n; } });
        v._rest = rest / n;
        return v;
      };
      const shownE = ENTITIES.filter((e) => out.entities[e.id].status === 'published').map((e) => e.id);
      shownE.forEach((a, i) => shownE.slice(i + 1).forEach((b) => {
        const va = mixOf(a), vb = mixOf(b);
        const keys = new Set(Object.keys(va).concat(Object.keys(vb)));
        let tvd = 0;
        keys.forEach((key) => { tvd += Math.abs((va[key] || 0) - (vb[key] || 0)); });
        out.mix[`${a}|${b}`] = Math.round((tvd / 2) * 20) / 20;
      }));
      release.data[p] = out;
    });
    return release;
  }

  // Checks a release file before showing it: right format, threshold not lowered, and no published
  // group below the threshold.
  function checkRelease(rel) {
    if (!rel || rel.format !== 'workforce-survey-release' || rel.version !== 1 || !rel.data || !Array.isArray(rel.periods)) throw new Error('This is not an aggregated results file from this survey.');
    if (!(rel.minGroupSize >= CONFIG.minGroupSize)) throw new Error(`This file uses a minimum group size below ${CONFIG.minGroupSize}, so it cannot be shown.`);
    const k = rel.minGroupSize;
    const bad = (c) => c && c.status === 'published' && !(c.n >= k);
    rel.periods.forEach((p) => {
      const d = rel.data[p];
      if (!d) throw new Error('The file is incomplete.');
      const cells = [d.overall].concat(Object.values(d.entities || {}), Object.values(d.functions || {}).flatMap((x) => Object.values(x)), Object.values(d.orgFunctions || {}));
      if (cells.some(bad)) throw new Error('The file contains a group below the minimum size, so it cannot be shown.');
    });
    return rel;
  }

  // One reporting group from a release: entity 'ALL' or an id; func 'ALL' or an id.
  function cell(rel, period, entity, func) {
    const d = rel.data[period];
    if (!d) return { status: 'collecting' };
    if (entity === 'ALL') return func === 'ALL' ? d.overall : d.orgFunctions[func];
    return func === 'ALL' ? d.entities[entity] : (d.functions[entity] || {})[func] || { status: 'collecting' };
  }

  // ---------- aggregated results as a table (safe to share) ----------
  function releaseRows(rel) {
    const rows = [];
    const push = (period, entity, func, c) => {
      const base = { period, entity: entity === 'ALL' ? 'All entities' : ENTITY_BY_ID[entity].short, function: func === 'ALL' ? 'All functions' : FUNCTION_BY_ID[func].name };
      if (!c || c.status !== 'published') { rows.push(Object.assign(base, { status: c && c.status === 'protected' ? 'withheld to protect a smaller group' : `fewer than ${rel.minGroupSize} responses`, group_n: '', category: '', question_id: '', concept: '', answer_code: '', answer: '', count: '', percent: '' })); return; }
      ITEMS.forEach((it) => {
        const counts = c.items[it.id];
        const subst = counts.slice(0, 5).reduce((a, b) => a + b, 0);
        [1, 2, 3, 4, 5, NA.code].forEach((code, i) => rows.push(Object.assign({}, base, {
          status: 'shown', group_n: c.n, category: CATEGORY_BY_ID[it.category].name, question_id: it.id, concept: it.concept, answer_code: code, answer: answerLabel(it.id, code),
          count: counts[i], percent: code === NA.code ? (c.n ? +(100 * counts[i] / c.n).toFixed(1) : '') : (subst ? +(100 * counts[i] / subst).toFixed(1) : '')
        })));
      });
    };
    rel.periods.forEach((p) => {
      const d = rel.data[p];
      push(p, 'ALL', 'ALL', d.overall);
      FUNCTIONS.forEach((f) => push(p, 'ALL', f.id, d.orgFunctions[f.id]));
      ENTITIES.forEach((e) => {
        push(p, e.id, 'ALL', d.entities[e.id]);
        if (d.entities[e.id].status === 'published') FUNCTIONS.forEach((f) => push(p, e.id, f.id, d.functions[e.id][f.id]));
      });
    });
    return rows;
  }

  const csvCell = (v) => (v == null ? '' : /[",\n\r]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  const toCSV = (rows, cols) => [cols.join(',')].concat(rows.map((r) => cols.map((c) => csvCell(r[c])).join(','))).join('\r\n') + '\r\n';
  const releaseCSV = (rel) => toCSV(releaseRows(rel), ['period', 'entity', 'function', 'status', 'group_n', 'category', 'question_id', 'concept', 'answer_code', 'answer', 'count', 'percent']);

  // ---------- Qualtrics ----------
  function questions() {
    const list = [
      { id: 'INTRO', type: 'DB', block: 'Introduction', text: `${SURVEY_TITLE}. ${TEXT.intro}` },
      { id: 'PRIVACY', type: 'DB', block: 'Introduction', text: TEXT.privacy.join(' ') },
      { id: CONSENT.id, type: 'MC', block: 'Introduction', text: CONSENT.text, options: CONSENT.options, codes: [1, 2] },
      { id: ENTITY_Q.id, type: 'MC', block: 'About your work', text: `${ENTITY_Q.text} ${ENTITY_Q.help}`, options: ENTITIES.map((e) => e.name), codes: ENTITIES.map((_, i) => i + 1) },
      { id: FUNCTION_Q.id, type: 'MC', block: 'About your work', text: FUNCTION_Q.text, options: FUNCTIONS.map((f) => f.name), codes: FUNCTIONS.map((_, i) => i + 1), pageBreakBefore: true }
    ];
    CATEGORIES.forEach((c) => {
      const block = `${c.letter}. ${c.name}`;
      list.push({ id: `${c.id}_INTRO`, type: 'DB', block, text: `${block}. ${c.intro}${c.caution ? ` ${c.caution}` : ''}` });
      c.items.forEach((it) => list.push({ id: it.id, type: 'MC', block, text: it.text, options: SCALES[c.scale].options.concat(NA.label), codes: [1, 2, 3, 4, 5, NA.code] }));
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
      else if (q.pageBreakBefore) out.push('[[PageBreak]]', '');
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
      { question_id: CONSENT.id, section: 'Introduction', concept: 'Consent', question: CONSENT.text, type: 'Single choice (radio)', required: 'Yes', answers: codes(CONSENT.options, [1, 2]), basis: '', sources: '', note: '"No" ends the survey; nothing is recorded.' },
      { question_id: ENTITY_Q.id, section: 'About your work', concept: 'Organizational entity', question: ENTITY_Q.text, type: 'Single choice (radio)', required: 'Yes', answers: codes(ENTITIES.map((e) => e.name), ENTITIES.map((_, i) => i + 1)), basis: '', sources: '', note: 'Used only to group answers into entity datasets.' },
      { question_id: FUNCTION_Q.id, section: 'About your work', concept: 'Professional function', question: FUNCTION_Q.text, type: 'Single choice (radio)', required: 'Yes', answers: codes(FUNCTIONS.map((f) => f.name), FUNCTIONS.map((_, i) => i + 1)), basis: '', sources: '', note: 'Used only to filter results within an entity.' }
    ];
    CATEGORIES.forEach((c) => c.items.forEach((it) => rows.push({
      question_id: it.id, section: `${c.letter}. ${c.name}`, concept: it.concept, question: it.text, type: 'Single choice (radio)', required: 'Yes',
      answers: codes(SCALES[c.scale].options.concat(NA.label), [1, 2, 3, 4, 5, NA.code]), basis: it.basis,
      sources: it.sources.map((s) => SOURCES[s].short).join('; '), note: `${it.note}${c.lowerIsBetter ? ' Favourable = Rarely or Never.' : ' Favourable = Strongly agree or Agree.'}`
    })));
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

  // Reads a Qualtrics CSV export (numeric values or choice text). Keeps only finished responses
  // from people who agreed, with every question answered; the rest are counted and left out.
  // Response IDs, dates and any other columns are discarded: only the reporting period is kept.
  function readExport(text) {
    const rows = parseCSV(text);
    if (!rows.length) throw new Error('The file is empty.');
    const head = rows[0].map((h) => h.trim());
    const col = (name) => head.indexOf(name);
    if (col(ENTITY_Q.id) < 0 || !ITEMS.some((it) => col(it.id) >= 0)) throw new Error('This does not look like an export of this survey: the ENTITY column or question columns such as PS1 are missing.');
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
      if (col(ENTITY_Q.id) >= 0 && String(r[col(ENTITY_Q.id)] || '').length > 60) return; // question-text row
      const status = col('Status') >= 0 ? String(r[col('Status')] || '').trim() : '';
      if (['1', '2', '8', '9', '12', '17'].includes(status) || /preview|test|spam|imported/i.test(status)) { out.tests += 1; return; }
      if (col(CONSENT.id) >= 0 && choice(r[col(CONSENT.id)], CONSENT.options, [1, 2]) !== 1) { out.declined += 1; return; }
      if (IDENTIFYING.some((n) => col(n) >= 0 && String(r[col(n)] || '').trim())) out.identifying = true;
      rowsSeen += 1;
      if (col('ResponseId') >= 0 && /^R_demo\d+$/.test(String(r[col('ResponseId')] || '').trim())) demoIds += 1;
      const finished = col('Finished') >= 0 ? String(r[col('Finished')] || '').trim() : '1';
      const e = choice(r[col(ENTITY_Q.id)], ENTITIES.map((x) => x.name), ENTITIES.map((_, i) => i + 1));
      const f = col(FUNCTION_Q.id) >= 0 ? choice(r[col(FUNCTION_Q.id)], FUNCTIONS.map((x) => x.name), FUNCTIONS.map((_, i) => i + 1)) : null;
      const answers = {};
      ITEMS.forEach((it) => { answers[it.id] = col(it.id) >= 0 ? choice(r[col(it.id)], SCALES[it.scale].options.concat(NA.label), [1, 2, 3, 4, 5, NA.code]) : null; });
      const raw = dateCol != null ? String(r[dateCol] || '').trim() : '';
      const period = raw ? periodOf(raw.replace(' ', 'T')) : null;
      const resp = { id: responseId(), period, entity: e ? ENTITIES[e - 1].id : null, function: f ? FUNCTIONS[f - 1].id : null, answers };
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

  // Group sizes per entity and function in the latest demonstration period. They are invented, and
  // set so the dashboard shows every case: groups that are shown, groups still collecting, and a
  // group withheld to protect a smaller one (UNICEF, Humanitarian / Field Operations).
  const DEMO = {
    periods: ['2026-Q2', '2026-Q3', '2026-Q4'],
    scale: [0.45, 0.8, 1],
    groups: {
      DPPA: { POL: 13, RES: 6, ADM: 4 }, DPO: { POL: 14, HUM: 6, ADM: 5 }, OCHA: { HUM: 24, PRG: 11, COM: 5, ADM: 4, RES: 2 },
      UNDP: { PRG: 23, ADM: 8, RES: 6, LEAD: 4 }, UNICEF: { PRG: 18, HUM: 12, ADM: 5, COM: 3 }, UNHCR: { HUM: 20, PRG: 8, LEG: 4, HR: 2 },
      WFP: { HUM: 17, ADM: 11, RES: 6, COM: 4 }, WHO: { PRG: 14, RES: 9, COM: 4 }, DMSPC: { HR: 5, ADM: 3 }, DOS: { ADM: 12, HR: 6, COM: 4 },
      OHCHR: { LEG: 8, POL: 6 }, UNWOMEN: { PRG: 8, POL: 4 }, OLA: { LEG: 6 }, OTHER: { PRG: 6, ADM: 5, OTH: 4 }
    },
    level: { PS: 3.75, IN: 3.65, CC: 3.55, LM: 3.7, IB: 3.35, OS: 3.25 }, // average favourability, 1 to 5
    cuts: [1.6, 2.6, 3.25, 4.35], // latent score -> answer 1 to 5 (5 = most favourable)
    na: { CC2: 0.12, IB4: 0.1, OS3: 0.16 }
  };

  function demoResponses() {
    const rand = rng(20261116);
    const normal = () => { let u = 0, v = 0; while (!u) u = rand(); while (!v) v = rand(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
    // Small random differences by entity: they are noise, not findings about any real entity.
    const effect = {};
    ENTITIES.forEach((e) => { effect[e.id] = Object.fromEntries(CATEGORIES.map((c) => [c.id, normal() * 0.12])); });
    const out = [];
    DEMO.periods.forEach((p, pi) => {
      ENTITIES.forEach((e) => FUNCTIONS.forEach((f) => {
        const size = Math.round(((DEMO.groups[e.id] || {})[f.id] || 0) * DEMO.scale[pi]);
        for (let i = 0; i < size; i += 1) {
          const person = normal() * 0.6;
          const answers = {};
          CATEGORIES.forEach((c) => c.items.forEach((it) => {
            if (rand() < (DEMO.na[it.id] || 0.03)) { answers[it.id] = NA.code; return; }
            const x = DEMO.level[c.id] + effect[e.id][c.id] + 0.06 * pi + person + normal() * 0.85;
            const v = 1 + DEMO.cuts.filter((cut) => x >= cut).length;
            answers[it.id] = c.lowerIsBetter ? v : 6 - v; // v = 5 is the most favourable answer
          }));
          out.push({ id: responseId(rand), period: p, entity: e.id, function: f.id, answers });
        }
      }));
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
        if (c.id === ENTITY_Q.id) return ENTITIES.findIndex((e) => e.id === r.entity) + 1;
        if (c.id === FUNCTION_Q.id) return FUNCTIONS.findIndex((f) => f.id === r.function) + 1;
        return r.answers[c.id];
      });
      lines.push([date, date, 0, '', 100, 300 + Math.floor(rand() * 300), 1, date, `R_demo${String(i + 1).padStart(5, '0')}`, 'anonymous', 'EN'].concat(values));
    });
    return lines.map((l) => l.map(csvCell).join(',')).join('\r\n') + '\r\n';
  }

  // ---------- responses saved in this browser (website prototype only) ----------
  function deviceStore(storage) {
    const key = CONFIG.storageKey;
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
        storage.setItem(key, JSON.stringify({ version: 1, responses: list }));
        return list.length;
      },
      clear() { storage.removeItem(key); }
    };
  }

  return {
    CONFIG, SURVEY_TITLE, ENTITIES, FUNCTIONS, CONSENT, ENTITY_Q, FUNCTION_Q, NA, SCALES, SOURCES, CATEGORIES, ITEMS,
    ITEM_BY_ID, CATEGORY_BY_ID, ENTITY_BY_ID, FUNCTION_BY_ID, TEXT, DEMO,
    polarity, answerLabel, periodOf, periodLabel, responseId, problems, makeResponse, longRows, datasets, aggregate,
    protect, buildRelease, checkRelease, cell, releaseRows, releaseCSV, questions, qualtricsTxt, codebookRows, codebookCSV,
    parseCSV, readExport, rng, demoResponses, demoCSV, deviceStore
  };
});
