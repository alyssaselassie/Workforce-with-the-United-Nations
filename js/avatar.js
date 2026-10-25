// Field agents: original cartoon avatars for the learner and the story characters,
// plus the avatar creator. Pure SVG, so they scale anywhere and need no image files.
(function () {
  'use strict';
  const { esc, Store } = App;
  const KEY = 'uncq.avatar.v1';
  const INK = '#2a2f45';
  const LINE = `stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"`;

  const SKIN = ['#fde4cf', '#f5cfaa', '#e8b388', '#d49a68', '#b77a4c', '#93603a', '#6e4427', '#4d2f1c'];
  const HAIR_COLORS = { black: '#2b2422', brown: '#5b3a24', chestnut: '#8c512b', auburn: '#a8442a', blonde: '#e3be62', gray: '#b9b9c0', teal: '#21a69a', purple: '#8a57d6' };
  const COLORS = { sky: '#4aa3ff', coral: '#ff7b6b', mint: '#34c389', sun: '#ffc23d', violet: '#9b7bf2', navy: '#34417c', rose: '#e8558a', white: '#f3f3f6', teal: '#21a69a' };

  const OPTIONS = {
    skin: SKIN.map((_, i) => i),
    hair: ['short', 'curly', 'long', 'bun', 'braids', 'ponytail', 'buzz', 'none'],
    hairColor: Object.keys(HAIR_COLORS),
    headwear: ['none', 'hijab', 'turban', 'cap', 'beanie', 'sunhat', 'headphones'],
    hwColor: ['teal', 'rose', 'navy', 'sun', 'violet', 'white'],
    facial: ['none', 'mustache', 'beard'],
    glasses: ['none', 'round', 'square'],
    shirt: ['sky', 'coral', 'mint', 'sun', 'violet', 'navy'],
    vest: ['none', 'field'],
    gear: ['none', 'lanyard', 'backpack', 'camera', 'radio', 'binoculars', 'medal']
  };
  const LABELS = {
    short: 'Short hair', curly: 'Curly hair', long: 'Long hair', bun: 'Bun', braids: 'Braids', ponytail: 'Ponytail', buzz: 'Buzz cut',
    hijab: 'Hijab', turban: 'Turban', cap: 'Cap', beanie: 'Beanie', sunhat: 'Sun hat', headphones: 'Headphones',
    mustache: 'Mustache', beard: 'Beard', round: 'Round glasses', square: 'Square glasses', field: 'Field vest',
    lanyard: 'ID lanyard', backpack: 'Backpack', camera: 'Camera', radio: 'Radio', binoculars: 'Binoculars', medal: 'Medal'
  };
  // Fun extras unlock with levels. Identity options (skin, hair, head coverings) are never locked.
  const UNLOCK = { headwear: { sunhat: 3, headphones: 5 }, gear: { backpack: 2, camera: 3, radio: 4, binoculars: 6, medal: 8 }, hairColor: { teal: 4, purple: 4 } };

  const DEFAULT = { skin: 3, hair: 'curly', hairColor: 'black', headwear: 'none', hwColor: 'teal', facial: 'none', glasses: 'none', shirt: 'sky', vest: 'field', gear: 'lanyard' };

  // Story characters. Looks are varied on purpose; head coverings appear on helpful characters.
  const NPC = {
    mentor: { skin: 4, hair: 'short', hairColor: 'gray', headwear: 'turban', hwColor: 'teal', facial: 'beard', glasses: 'round', shirt: 'mint', vest: 'none', gear: 'lanyard' },
    lead: { skin: 1, hair: 'buzz', hairColor: 'brown', shirt: 'navy', vest: 'field', gear: 'lanyard' },
    samir: { skin: 5, hair: 'short', hairColor: 'black', facial: 'mustache', shirt: 'violet', vest: 'none', gear: 'none' },
    amani: { skin: 6, hair: 'braids', hairColor: 'black', glasses: 'square', shirt: 'sun', vest: 'none', gear: 'lanyard' },
    rep: { skin: 3, headwear: 'hijab', hwColor: 'rose', shirt: 'coral', vest: 'none', gear: 'none' },
    colleague: { skin: 0, hair: 'long', hairColor: 'auburn', shirt: 'sky', vest: 'none', gear: 'lanyard' },
    colleague2: { skin: 2, hair: 'short', hairColor: 'brown', glasses: 'square', shirt: 'mint', vest: 'none', gear: 'lanyard' },
    host: { skin: 5, hair: 'bun', hairColor: 'black', shirt: 'violet', vest: 'none', gear: 'none' },
    resident: { skin: 6, hair: 'short', hairColor: 'gray', facial: 'beard', shirt: 'coral', vest: 'none', gear: 'none' },
    official: { skin: 2, hair: 'ponytail', hairColor: 'brown', glasses: 'square', shirt: 'navy', vest: 'none', gear: 'lanyard' },
    farmer: { skin: 6, hair: 'short', hairColor: 'black', headwear: 'sunhat', shirt: 'mint', vest: 'none', gear: 'none' },
    maya: { skin: 4, hair: 'long', hairColor: 'black', shirt: 'coral', vest: 'none', gear: 'lanyard' }
  };

  // ---------- drawing ----------
  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    const c = (v) => Math.max(0, Math.min(255, Math.round(v * f))).toString(16).padStart(2, '0');
    return `#${c(n >> 16)}${c((n >> 8) & 255)}${c(n & 255)}`;
  }

  const COVERS = ['hijab', 'turban', 'cap', 'beanie', 'sunhat'];

  function hairBack(style, color) {
    if (style === 'long') return `<path d="M17 48c-5 22-3 44 6 54h54c9-10 11-32 6-54z" fill="${color}" ${LINE}/>`;
    if (style === 'braids') {
      const braid = (x) => [62, 72, 82, 92, 101].map((y) => `<ellipse cx="${x}" cy="${y}" rx="4.6" ry="6" fill="${color}" ${LINE}/>`).join('');
      return braid(21) + braid(79);
    }
    if (style === 'ponytail') return `<path d="M73 29c15 6 19 27 13 45-3 8-9 10-12 6 6-14 6-30 0-42z" fill="${color}" ${LINE}/>`;
    if (style === 'curly') return `<ellipse cx="50" cy="42" rx="38" ry="31" fill="${color}" ${LINE}/>`;
    return '';
  }

  function hairFront(style, color) {
    const short = `<path d="M19 47c-3-20 11-34 31-34s34 14 31 34c-3-9-9-15-17-17-7 6-19 8-31 4-6 2-11 6-14 13z" fill="${color}" ${LINE}/>`;
    switch (style) {
      case 'short': case 'braids': case 'ponytail': return short;
      case 'bun': return `<circle cx="50" cy="12" r="9" fill="${color}" ${LINE}/>${short}`;
      case 'long': return `<path d="M18 60c-5-28 8-46 32-46s37 18 32 46c-2-14-8-23-16-27-9 5-22 6-33 1-8 5-13 14-15 26z" fill="${color}" ${LINE}/>`;
      case 'curly': return [[24, 34, 9], [32, 23, 10], [43, 17, 10], [55, 16, 10], [66, 21, 10], [75, 31, 9]]
        .map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${color}" ${LINE}/>`).join('');
      case 'buzz': return `<path d="M21 44c0-18 13-28 29-28s29 10 29 28c-7-6-17-9-29-9s-22 3-29 9z" fill="${color}" opacity=".9" ${LINE}/>`;
      default: return '';
    }
  }

  function headwearFront(kind, color) {
    const dark = shade(color, 0.82);
    switch (kind) {
      case 'hijab': return `<path d="M27 37c6-9 14-13 23-13s17 4 23 13c-7-4-15-6-23-6s-16 2-23 6z" fill="${dark}"/>`;
      case 'turban': return `<path d="M18 44c-2-22 12-34 32-35 20 1 34 13 32 35-8-7-19-10-32-10s-24 3-32 10z" fill="${color}" ${LINE}/>
        <path d="M24 33c9-9 19-11 26-3 7-8 17-6 26 3M28 24c8-6 16-6 22 0" fill="none" stroke="${dark}" stroke-width="2" stroke-linecap="round"/>`;
      case 'cap': return `<path d="M19 40c0-19 13-29 31-29s31 10 31 29z" fill="${color}" ${LINE}/>
        <path d="M50 38c16-1 30 0 42 5-12 3-26 3-42 0z" fill="${dark}" ${LINE}/><circle cx="50" cy="11" r="2.6" fill="${dark}"/>`;
      case 'beanie': return `<path d="M18 45c0-22 14-34 32-34s32 12 32 34z" fill="${color}" ${LINE}/>
        <rect x="17" y="37" width="66" height="10" rx="5" fill="${dark}" ${LINE}/><circle cx="50" cy="10" r="6" fill="${dark}" ${LINE}/>`;
      case 'sunhat': return `<ellipse cx="50" cy="33" rx="44" ry="9" fill="#d9b674" ${LINE}/>
        <path d="M27 33c0-14 10-23 23-23s23 9 23 23z" fill="#d9b674" ${LINE}/><rect x="27" y="26" width="46" height="6" fill="#8a6b3a"/>`;
      case 'headphones': return `<path d="M17 52c0-30 15-44 33-44s33 14 33 44" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>
        <rect x="11" y="43" width="11" height="19" rx="4" fill="${color}" ${LINE}/><rect x="78" y="43" width="11" height="19" rx="4" fill="${color}" ${LINE}/>`;
      default: return '';
    }
  }

  function gearHtml(kind) {
    switch (kind) {
      case 'lanyard': return `<path d="M42 82l8 15 8-15" fill="none" stroke="#2f6fd0" stroke-width="2.2"/>
        <rect x="44.5" y="95" width="11" height="9" rx="1.5" fill="#fff" ${LINE}/><rect x="44.5" y="95" width="11" height="2.6" fill="#2f6fd0"/>`;
      case 'backpack': return `<path d="M33 82l3 26M67 82l-3 26" stroke="#b5562a" stroke-width="3.2" stroke-linecap="round"/>`;
      case 'camera': return `<path d="M34 82l30 22" stroke="${INK}" stroke-width="1.8"/>
        <rect x="58" y="101" width="15" height="10" rx="2.5" fill="#3a3f55" ${LINE}/><circle cx="65.5" cy="106" r="3.2" fill="#8fb4e8" ${LINE}/>`;
      case 'radio': return `<path d="M80.5 104v-9" stroke="${INK}" stroke-width="1.8" stroke-linecap="round"/>
        <rect x="75" y="103" width="8" height="15" rx="2" fill="#3a3f55" ${LINE}/><circle cx="79" cy="108" r="1.4" fill="#ff7b6b"/>`;
      case 'binoculars': return `<path d="M40 82l5 10M60 82l-5 10" stroke="${INK}" stroke-width="1.6"/>
        <circle cx="45" cy="97" r="4.6" fill="#3a3f55" ${LINE}/><circle cx="55" cy="97" r="4.6" fill="#3a3f55" ${LINE}/><rect x="47" y="94" width="6" height="4" fill="#3a3f55"/>`;
      case 'medal': return `<path d="M44 81l6 12 6-12" fill="#e8558a" ${LINE}/>
        <circle cx="50" cy="98" r="6" fill="#ffc23d" ${LINE}/><path d="M50 94.6l1.1 2.3 2.5.3-1.8 1.7.5 2.5-2.3-1.2-2.3 1.2.5-2.5-1.8-1.7 2.5-.3z" fill="#fff6d6"/>`;
      default: return '';
    }
  }

  function face(s, hair, look, mood, cy) {
    const ey = cy + 2;
    const brow = mood === 'oops' ? [`M33 ${ey - 9}q6 -1 12 2`, `M55 ${ey - 7}q6 -3 12 -2`] : mood === 'think' ? [`M33 ${ey - 11}q6 -3 12 0`, `M55 ${ey - 9}h12`] : [`M33 ${ey - 9}q6 -3 12 0`, `M55 ${ey - 9}q6 -3 12 0`];
    const browColor = ['blonde', 'gray'].includes(s.hairColor) ? shade(hair, 0.7) : hair;
    const parts = [
      `<ellipse cx="39.5" cy="${ey}" rx="6" ry="7" fill="#fff" stroke="${INK}" stroke-width="1.3"/>`,
      `<ellipse cx="60.5" cy="${ey}" rx="6" ry="7" fill="#fff" stroke="${INK}" stroke-width="1.3"/>`,
      `<circle cx="${39.5 + look}" cy="${ey + 1}" r="3.1" fill="${INK}"/><circle cx="${60.5 + look}" cy="${ey + 1}" r="3.1" fill="${INK}"/>`,
      `<circle cx="${38.6 + look}" cy="${ey}" r="1" fill="#fff"/><circle cx="${59.6 + look}" cy="${ey}" r="1" fill="#fff"/>`,
      `<path d="${brow[0]}" fill="none" stroke="${browColor}" stroke-width="2.2" stroke-linecap="round"/><path d="${brow[1]}" fill="none" stroke="${browColor}" stroke-width="2.2" stroke-linecap="round"/>`,
      `<circle cx="32" cy="${cy + 12}" r="4" fill="#ff8a8a" opacity=".32"/><circle cx="68" cy="${cy + 12}" r="4" fill="#ff8a8a" opacity=".32"/>`
    ];
    if (s.facial === 'beard') parts.push(`<path d="M21 ${cy + 4}q2 26 29 30q27 -4 29 -30q-6 16 -14 19q-7 -2 -15 -2t-15 2q-8 -3 -14 -19z" fill="${hair}" ${LINE}/>`);
    const my = cy + 14;
    const mouth = mood === 'oops' ? `<ellipse cx="50" cy="${my + 2}" rx="3" ry="3.6" fill="#7a3324"/>`
      : mood === 'think' ? `<path d="M45 ${my + 2}q5 -1.5 10 0" fill="none" stroke="#7a3324" stroke-width="2.2" stroke-linecap="round"/>`
      : mood === 'grin' ? `<path d="M42 ${my - 1}q8 11 16 0z" fill="#7a3324" stroke="#7a3324" stroke-width="1.5" stroke-linejoin="round"/>`
      : `<path d="M43 ${my}q7 7 14 0" fill="none" stroke="#7a3324" stroke-width="2.2" stroke-linecap="round"/>`;
    parts.push(mouth);
    if (s.facial === 'mustache') parts.push(`<path d="M42 ${my - 3}q8 -4 16 0q-4 3 -8 2q-4 1 -8 -2z" fill="${hair}" ${LINE}/>`);
    return parts.join('');
  }

  function glassesHtml(kind, cy) {
    const ey = cy + 2;
    if (kind === 'round') return `<circle cx="39.5" cy="${ey}" r="8.4" fill="#fff" fill-opacity=".15" stroke="${INK}" stroke-width="1.8"/><circle cx="60.5" cy="${ey}" r="8.4" fill="#fff" fill-opacity=".15" stroke="${INK}" stroke-width="1.8"/><path d="M47.9 ${ey}h4.2" stroke="${INK}" stroke-width="1.8"/>`;
    if (kind === 'square') return `<rect x="31" y="${ey - 7}" width="17" height="14" rx="3.5" fill="#fff" fill-opacity=".15" stroke="${INK}" stroke-width="1.8"/><rect x="52" y="${ey - 7}" width="17" height="14" rx="3.5" fill="#fff" fill-opacity=".15" stroke="${INK}" stroke-width="1.8"/><path d="M48 ${ey}h4" stroke="${INK}" stroke-width="1.8"/>`;
    return '';
  }

  // spec: look options; opts: { view: 'full' | 'head', look: 'left' | 'right', mood, title }
  function svg(spec, opts) {
    const o = opts || {};
    const s = Object.assign({}, DEFAULT, spec);
    const skin = SKIN[s.skin] || SKIN[3];
    const hair = HAIR_COLORS[s.hairColor] || HAIR_COLORS.black;
    const hw = COLORS[s.hwColor] || COLORS.teal;
    const shirt = COLORS[s.shirt] || COLORS.sky;
    const look = o.look === 'left' ? -1.7 : o.look === 'right' ? 1.7 : 0;
    const hijab = s.headwear === 'hijab';
    const covered = COVERS.includes(s.headwear);
    const p = [];

    // Behind the head and body.
    if (hijab) p.push(`<path d="M50 9C23 9 12 31 13 55c1 19 8 30 17 37h40c9-7 16-18 17-37C88 31 77 9 50 9z" fill="${hw}" ${LINE}/>`);
    else if (!(covered && s.hair === 'curly')) p.push(hairBack(s.hair, hair));
    if (s.gear === 'backpack') p.push(`<rect x="24" y="84" width="52" height="34" rx="10" fill="#e07a3f" ${LINE}/>`);

    // Body.
    p.push(`<rect x="36" y="116" width="12" height="28" rx="5" fill="#3b4a7a" ${LINE}/><rect x="52" y="116" width="12" height="28" rx="5" fill="#3b4a7a" ${LINE}/>`);
    p.push(`<ellipse cx="41" cy="146" rx="9" ry="5" fill="${INK}"/><ellipse cx="59" cy="146" rx="9" ry="5" fill="${INK}"/>`);
    p.push(`<rect x="20" y="84" width="11" height="31" rx="5.5" fill="${shirt}" ${LINE} transform="rotate(8 25 86)"/><rect x="69" y="84" width="11" height="31" rx="5.5" fill="${shirt}" ${LINE} transform="rotate(-8 75 86)"/>`);
    p.push(`<rect x="29" y="79" width="42" height="43" rx="13" fill="${shirt}" ${LINE}/>`);
    if (s.vest === 'field') {
      p.push(`<rect x="29" y="80" width="16" height="42" rx="8" fill="#3d5a99" ${LINE}/><rect x="55" y="80" width="16" height="42" rx="8" fill="#3d5a99" ${LINE}/>`);
      p.push(`<rect x="33" y="103" width="9" height="7" rx="1.5" fill="#5677b8" ${LINE}/><rect x="58" y="103" width="9" height="7" rx="1.5" fill="#5677b8" ${LINE}/>`);
    }
    // The radio sits in the hand, so it is drawn after the hands.
    if (s.gear !== 'radio') p.push(gearHtml(s.gear));
    p.push(`<circle cx="21.3" cy="116" r="5.4" fill="${skin}" ${LINE}/><circle cx="78.7" cy="116" r="5.4" fill="${skin}" ${LINE}/>`);
    if (s.gear === 'radio') p.push(gearHtml('radio'));
    p.push(`<rect x="44" y="70" width="12" height="11" rx="3" fill="${shade(skin, 0.9)}"/>`);

    // Head.
    const cy = hijab ? 50 : 48;
    if (hijab) {
      p.push(`<ellipse cx="50" cy="52" rx="23.5" ry="26" fill="${skin}" ${LINE}/>`);
    } else {
      p.push(`<circle cx="19.5" cy="52" r="6.5" fill="${skin}" ${LINE}/><circle cx="80.5" cy="52" r="6.5" fill="${skin}" ${LINE}/>`);
      p.push(`<circle cx="19.5" cy="52" r="3" fill="${shade(skin, 0.85)}"/><circle cx="80.5" cy="52" r="3" fill="${shade(skin, 0.85)}"/>`);
      p.push(`<circle cx="50" cy="48" r="31" fill="${skin}" ${LINE}/>`);
      if (s.hair === 'none' && !covered) p.push('<ellipse cx="40" cy="27" rx="7" ry="3.5" fill="#fff" opacity=".35"/>');
    }
    p.push(face(s, hair, look, o.mood || 'happy', cy));
    if (!covered) p.push(hairFront(s.hair, hair));
    p.push(headwearFront(s.headwear, hw));
    p.push(glassesHtml(s.glasses, cy));

    const vb = o.view === 'head' ? '8 2 84 84' : '0 0 100 160';
    const a11y = o.title ? `role="img" aria-label="${esc(o.title)}"` : 'aria-hidden="true"';
    return `<svg class="agent-svg" viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" focusable="false" ${a11y}>${p.join('')}</svg>`;
  }

  // ---------- storage ----------
  function get() {
    const saved = Store.read(KEY, null);
    return Object.assign({}, DEFAULT, saved || {});
  }
  function isSet() {
    return Boolean(Store.read(KEY, null));
  }
  function save(spec) {
    const clean = {};
    Object.keys(OPTIONS).forEach((k) => { if (OPTIONS[k].includes(spec[k])) clean[k] = spec[k]; });
    return Store.write(KEY, Object.assign({}, DEFAULT, clean));
  }

  function lockLevel(key, value) {
    return (UNLOCK[key] && UNLOCK[key][value]) || 0;
  }
  function level() {
    return window.Game ? Game.currentLevel() : 1;
  }

  // Round head for the nav and profile, sized like the photo avatar it stands in for.
  function headHtml(size) {
    return `<span class="avatar avatar-agent" style="width:${size}px;height:${size}px" aria-hidden="true">${svg(get(), { view: 'head' })}</span>`;
  }

  // ---------- creator ----------
  let draft = null;
  let modal = null;

  const ROWS = [
    { key: 'skin', label: 'Skin tone', kind: 'swatch', color: (v) => SKIN[v], name: (v) => `Skin tone ${v + 1}` },
    { key: 'hair', label: 'Hair', kind: 'head' },
    { key: 'hairColor', label: 'Hair color', kind: 'swatch', color: (v) => HAIR_COLORS[v], name: (v) => `${v[0].toUpperCase()}${v.slice(1)} hair` },
    { key: 'headwear', label: 'Headwear', kind: 'head' },
    { key: 'hwColor', label: 'Headwear color', kind: 'swatch', color: (v) => COLORS[v], name: (v) => `${v[0].toUpperCase()}${v.slice(1)} headwear` },
    { key: 'facial', label: 'Facial hair', kind: 'head' },
    { key: 'glasses', label: 'Glasses', kind: 'head' },
    { key: 'shirt', label: 'Shirt', kind: 'swatch', color: (v) => COLORS[v], name: (v) => `${v[0].toUpperCase()}${v.slice(1)} shirt` },
    { key: 'vest', label: 'Vest', kind: 'body' },
    { key: 'gear', label: 'Gear', kind: 'body' }
  ];

  function optionLabel(row, v) {
    if (row.name) return row.name(v);
    if (v === 'none') return `No ${row.label.toLowerCase()}`;
    return LABELS[v] || v;
  }

  function rowHtml(row) {
    const lvl = level();
    return `
      <fieldset class="agent-row">
        <legend>${esc(row.label)}</legend>
        <div class="agent-opts">
          ${OPTIONS[row.key].map((v) => {
            const need = lockLevel(row.key, v);
            const locked = need > lvl;
            const on = draft[row.key] === v;
            const label = optionLabel(row, v) + (locked ? ` (unlocks at level ${need})` : '');
            const inner = row.kind === 'swatch' ? `<span class="agent-swatch" style="background:${row.color(v)}"></span>`
              : svg(Object.assign({}, draft, { [row.key]: v }), { view: row.kind === 'head' ? 'head' : 'full' });
            return `<button type="button" class="agent-opt agent-opt-${row.kind}${on ? ' is-on' : ''}${locked ? ' is-locked' : ''}" data-key="${row.key}" data-value="${v}"
              aria-pressed="${on}" aria-label="${esc(label)}" title="${esc(label)}"${locked ? ' disabled' : ''}>${inner}${locked ? `<span class="agent-lock"><i class="bi bi-lock-fill" aria-hidden="true"></i> Lv ${need}</span>` : ''}</button>`;
          }).join('')}
        </div>
      </fieldset>`;
  }

  function draw() {
    const el = document.getElementById('agent-modal');
    el.querySelector('#agent-preview').innerHTML = svg(draft, { title: 'Your field agent', mood: 'grin' });
    el.querySelector('#agent-rows').innerHTML = ROWS.map(rowHtml).join('');
  }

  function build() {
    document.body.insertAdjacentHTML('beforeend', `
      <div class="modal fade" id="agent-modal" tabindex="-1" aria-labelledby="agent-title" aria-hidden="true">
        <div class="modal-dialog modal-xl modal-dialog-scrollable">
          <div class="modal-content agent-modal">
            <div class="modal-header">
              <h2 class="modal-title h4" id="agent-title"><i class="bi bi-stars" aria-hidden="true"></i> Create your field agent</h2>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
              <div class="row g-4">
                <div class="col-md-4">
                  <div class="agent-stage"><div class="agent-preview" id="agent-preview"></div></div>
                  <label class="form-label fw-semibold mt-3" for="agent-name">Agent name</label>
                  <input class="form-control" id="agent-name" maxlength="40" placeholder="Your first name">
                  <div class="d-flex flex-wrap gap-2 mt-3">
                    <button type="button" class="btn btn-outline-primary btn-sm" id="agent-random"><i class="bi bi-shuffle" aria-hidden="true"></i> Surprise me</button>
                  </div>
                  <p class="small text-muted-2 mt-3 mb-0"><i class="bi bi-lock" aria-hidden="true"></i> Some gear unlocks as you level up. Skin tones, hair and head coverings are always open to everyone.</p>
                </div>
                <div class="col-md-8" id="agent-rows"></div>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
              <button type="button" class="btn btn-pop" id="agent-save"><i class="bi bi-check-lg" aria-hidden="true"></i> Save my agent</button>
            </div>
          </div>
        </div>
      </div>`);
    const el = document.getElementById('agent-modal');
    el.querySelector('#agent-rows').addEventListener('click', (e) => {
      const b = e.target.closest('.agent-opt');
      if (!b || b.disabled) return;
      draft[b.dataset.key] = b.dataset.key === 'skin' ? Number(b.dataset.value) : b.dataset.value;
      draw();
      const again = el.querySelector(`.agent-opt[data-key="${b.dataset.key}"][data-value="${b.dataset.value}"]`);
      if (again) again.focus();
    });
    el.querySelector('#agent-random').addEventListener('click', () => {
      const lvl = level();
      Object.keys(OPTIONS).forEach((k) => {
        const open = OPTIONS[k].filter((v) => lockLevel(k, v) <= lvl);
        draft[k] = open[Math.floor(Math.random() * open.length)];
      });
      draw();
    });
    el.querySelector('#agent-save').addEventListener('click', () => {
      save(draft);
      const name = el.querySelector('#agent-name').value.trim();
      const pr = App.Profile.get();
      if (name && name !== pr.name) App.Profile.save(Object.assign(pr, { name }));
      if (window.Game) Game.onAvatar(App.Profile.get());
      App.renderChrome();
      document.dispatchEvent(new CustomEvent('avatar:change'));
      if (modal) modal.hide();
    });
    modal = window.bootstrap ? new bootstrap.Modal(el) : null;
  }

  function openCreator() {
    if (!document.getElementById('agent-modal')) build();
    draft = get();
    document.getElementById('agent-name').value = App.Profile.get().name || '';
    draw();
    if (modal) modal.show();
  }

  // Any page can open the creator with ?agent=1, and any element with data-agent-open.
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-agent-open]')) {
      e.preventDefault();
      openCreator();
    }
  });
  document.addEventListener('DOMContentLoaded', () => {
    if (App.param('agent') === '1') openCreator();
  });

  window.Avatar = { svg, get, isSet, save, headHtml, openCreator, NPC, OPTIONS, UNLOCK, DEFAULT };
})();
