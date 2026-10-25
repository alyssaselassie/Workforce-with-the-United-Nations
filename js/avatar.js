// Avatars: original illustrated characters for the learner and the story characters,
// plus the avatar creator. Pure SVG, so they scale anywhere and need no image files.
(function () {
  'use strict';
  const { esc, Store } = App;
  const KEY = 'uncq.avatar.v1';
  const SKIN = ['#fde4cf', '#f5cfaa', '#e8b388', '#d49a68', '#b77a4c', '#93603a', '#6e4427', '#4d2f1c'];
  const LIPS = ['#c26f60', '#b9654f', '#a95a44', '#97503b', '#7f4231', '#683525', '#552a1d', '#432016'];
  const HAIR_COLORS = { black: '#2b2422', brown: '#5b3a24', chestnut: '#8c512b', auburn: '#a8442a', blonde: '#dcb56a', gray: '#b9b9c0', teal: '#21a69a', purple: '#8a57d6' };
  const COLORS = { sky: '#4f8fd6', coral: '#e2735f', mint: '#3faa86', sun: '#e6b13e', violet: '#8268cc', navy: '#2f3f73', rose: '#d45c86', white: '#eef0f4', teal: '#1f9c90' };

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
    lanyard: 'ID lanyard', backpack: 'Backpack', camera: 'Camera', radio: 'Radio', binoculars: 'Binoculars', medal: 'Award pin'
  };
  // Fun extras unlock with levels. Identity options (skin, hair, head coverings) are never locked.
  const UNLOCK = { headwear: { sunhat: 3, headphones: 5 }, gear: { backpack: 2, camera: 3, radio: 4, binoculars: 6, medal: 8 }, hairColor: { teal: 4, purple: 4 } };

  const DEFAULT = { skin: 3, hair: 'curly', hairColor: 'black', headwear: 'none', hwColor: 'teal', facial: 'none', glasses: 'none', shirt: 'sky', vest: 'field', gear: 'lanyard' };

  // Story characters. Looks are varied on purpose; head coverings appear on helpful characters.
  const NPC = {
    mentor: { skin: 4, hair: 'short', hairColor: 'gray', headwear: 'turban', hwColor: 'teal', facial: 'beard', glasses: 'round', shirt: 'mint', vest: 'none', gear: 'lanyard' },
    lead: { skin: 1, hair: 'buzz', hairColor: 'brown', shirt: 'navy', vest: 'field', gear: 'lanyard' },
    samir: { skin: 5, hair: 'short', hairColor: 'black', facial: 'mustache', shirt: 'violet', vest: 'none', gear: 'none', pants: '#4a4f5c' },
    amani: { skin: 6, hair: 'braids', hairColor: 'black', glasses: 'square', shirt: 'sun', vest: 'none', gear: 'lanyard' },
    rep: { skin: 3, headwear: 'hijab', hwColor: 'rose', shirt: 'coral', vest: 'none', gear: 'none', pants: '#4b4058' },
    colleague: { skin: 0, hair: 'long', hairColor: 'auburn', shirt: 'sky', vest: 'none', gear: 'lanyard' },
    colleague2: { skin: 2, hair: 'short', hairColor: 'brown', glasses: 'square', shirt: 'mint', vest: 'none', gear: 'lanyard' },
    host: { skin: 5, hair: 'bun', hairColor: 'black', shirt: 'violet', vest: 'none', gear: 'none', pants: '#3a3d48' },
    resident: { skin: 6, hair: 'short', hairColor: 'gray', facial: 'beard', shirt: 'coral', vest: 'none', gear: 'none', pants: '#5b4a3a' },
    official: { skin: 2, hair: 'ponytail', hairColor: 'brown', glasses: 'square', shirt: 'navy', vest: 'none', gear: 'lanyard', pants: '#2b2f3a' },
    farmer: { skin: 6, hair: 'short', hairColor: 'black', headwear: 'sunhat', shirt: 'mint', vest: 'none', gear: 'none', pants: '#7a6a4c' },
    maya: { skin: 4, hair: 'long', hairColor: 'black', shirt: 'coral', vest: 'none', gear: 'lanyard' }
  };

  // ---------- drawing ----------
  // Figures stand in a 100 x 160 box, about four and a half heads tall, lit from the upper left like the globe.
  // Soft gradients and thin tonal edges replace heavy outlines.
  const TROUSERS = '#34405e';
  const VEST = '#2b5c9e';
  const SHOE = '#3b2d27';
  const METAL = '#2f3443';
  const EYE = '#2a211f';
  let seq = 0;

  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    const c = (v) => Math.max(0, Math.min(255, Math.round(v * f))).toString(16).padStart(2, '0');
    return `#${c(n >> 16)}${c((n >> 8) & 255)}${c(n & 255)}`;
  }
  const edge = (c, w) => `stroke="${shade(c, 0.6)}" stroke-opacity=".42" stroke-width="${w || 0.6}" stroke-linejoin="round"`;
  const lit = (id, c, hi, lo) => `<linearGradient id="${id}" x1=".1" y1="0" x2=".9" y2="1"><stop offset="0" stop-color="${shade(c, hi)}"/><stop offset="1" stop-color="${shade(c, lo)}"/></linearGradient>`;
  const line = (d, c, w, o) => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"${o ? ` opacity="${o}"` : ''}/>`;

  const FACE = 'M37.5 28C37.5 18.6 43 13.5 50 13.5S62.5 18.6 62.5 28C62.5 37.6 57.6 45.6 50 45.6S37.5 37.6 37.5 28z';
  const TORSO = 'M44.6 49.6c-4.5.6-9.4 1.7-11.7 4.3-1.6 1.8-2 4.4-1.8 7.4l2.2 36.1c.1 1.9 1.6 3.3 3.5 3.3h26.4c1.9 0 3.4-1.4 3.5-3.3l2.2-36.1c.2-3-.2-5.6-1.8-7.4-2.3-2.6-7.2-3.7-11.7-4.3-1.3 1.9-3.2 2.9-5.4 2.9s-4.1-1-5.4-2.9z';
  const ARMS = ['M36 52.6C31.4 53.2 28.6 56 27.7 61.2 26.9 66 26.4 76.4 26.2 91.8h7.2c.4-11.2 1-19.6 3-24.6z',
    'M64 52.6c4.6.6 7.4 3.4 8.3 8.6.8 4.8 1.3 15.2 1.5 30.6h-7.2c-.4-11.2-1-19.6-3-24.6z'];
  const LEGS = 'M35.2 98.5h29.6l-1.3 50.3c0 1-.8 1.7-1.8 1.7h-8.1c-1 0-1.7-.7-1.8-1.7L50.6 109h-1.2l-1.2 39.8c-.1 1-.8 1.7-1.8 1.7h-8.1c-1 0-1.8-.7-1.8-1.7z';
  const SHOES = 'M36.9 148.6h10.2c.9 0 1.6.7 1.6 1.6v2.2c0 .9-.7 1.6-1.6 1.6H35.4c-1 0-1.7-.9-1.5-1.8.4-2 1.4-3.6 3-3.6zM63.1 148.6H52.9c-.9 0-1.6.7-1.6 1.6v2.2c0 .9.7 1.6 1.6 1.6h11.7c1 0 1.7-.9 1.5-1.8-.4-2-1.4-3.6-3-3.6z';
  const VEST_PANELS = 'M44.2 50.4c-4 .7-8.5 1.8-10.6 4.1-1.5 1.7-1.9 4.1-1.7 6.9l2.2 36.3c.1 1.9 1.6 3.3 3.5 3.3h10l.2-44.6c-1.5-1.3-2.7-3.4-3.6-6zM55.8 50.4c4 .7 8.5 1.8 10.6 4.1 1.5 1.7 1.9 4.1 1.7 6.9l-2.2 36.3c-.1 1.9-1.6 3.3-3.5 3.3h-10l-.2-44.6c1.5-1.3 2.7-3.4 3.6-6z';
  const HIJAB_BACK = 'M50 8.6C39.4 8.6 33 16 33 28.2c0 7 1.6 13.1 4.2 18.1L31 56.5c5.3 4.6 12.2 6.6 19 6.6s13.7-2 19-6.6l-6.2-10.2c2.6-5 4.2-11.1 4.2-18.1C67 16 60.6 8.6 50 8.6z';
  const HIJAB_DRAPE = 'M38.4 40.2c2.4 7 6.6 10.6 11.6 10.6s9.2-3.6 11.6-10.6l6.8 15.2c-4.8 4.2-11.4 6.2-18.4 6.2s-13.6-2-18.4-6.2z';
  const HIJAB_FRAME = 'M50 11.6c-8.8 0-14.2 6.8-14.2 16.6 0 9.8 5.4 19.2 14.2 19.2s14.2-9.4 14.2-19.2c0-9.8-5.4-16.6-14.2-16.6zM50 16.2c6.7 0 10.7 4.8 10.7 11.8 0 8.8-4.5 15.6-10.7 15.6S39.3 36.8 39.3 28c0-7 4-11.8 10.7-11.8z';

  const COVERS = ['hijab', 'turban', 'cap', 'beanie', 'sunhat'];
  const SHEEN = (o) => line('M42.2 16.4c2.6-2.3 5.7-3.2 8.8-2.9', '#fff', 1.3, o || 0.22);
  const braid = (x, dir, fill, c) => [34, 39, 44, 49, 54, 59, 64].map((y, i) =>
    `<ellipse cx="${x + dir * i * 0.18}" cy="${y}" rx="2.4" ry="3" fill="${fill}" ${edge(c, 0.5)}/>`).join('') + `<circle cx="${x + dir * 1.3}" cy="67.8" r="1.1" fill="#d9a441"/>`;

  function hairBack(style, fill, c) {
    if (style === 'long') return `<path d="M36.2 25.5c0-9.9 5.9-16 13.8-16s13.8 6.1 13.8 16l1.6 33c.2 4.2-2.6 7-6.4 7H41c-3.8 0-6.6-2.8-6.4-7z" fill="${fill}" ${edge(c)}/>`;
    if (style === 'braids') return `<path d="M36.4 26c0-9.6 5.8-15.4 13.6-15.4S63.6 16.4 63.6 26l.4 8H36z" fill="${fill}"/>`;
    if (style === 'ponytail') return `<path d="M58.6 15.4c6.4.4 10.2 5.8 10 13.4-.2 6.8-2.8 12.6-6.6 15.6-1.2-4.8-.8-9.6.8-13.8 1.4-3.6.6-9-4.2-15.2z" fill="${fill}" ${edge(c)}/>`;
    if (style === 'curly') return [[36.5, 27, 6], [37.4, 18.6, 6.8], [43, 12.6, 7], [50, 10.4, 7.2], [57, 12.6, 7], [62.6, 18.6, 6.8], [63.5, 27, 6]]
      .map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" ${edge(c, 0.5)}/>`).join('') + `<ellipse cx="50" cy="21" rx="13" ry="10" fill="${fill}"/>`;
    return '';
  }

  // Hair that falls in front of the shoulders.
  function hairDrape(style, fill, c) {
    if (style === 'long') return `<path d="M37.4 31c-1 7.4-.8 15.2 1.2 22.4.7 2.3 3.1 3 4.6 1.4-2.6-6.6-3.2-14-2.5-21.8zM62.6 31c1 7.4.8 15.2-1.2 22.4-.7 2.3-3.1 3-4.6 1.4 2.6-6.6 3.2-14 2.5-21.8z" fill="${fill}" ${edge(c)}/>`;
    if (style === 'braids') return braid(38.3, -1, fill, c) + braid(61.7, 1, fill, c);
    return '';
  }

  function hairFront(style, fill, c) {
    const pulled = `<path d="M37.4 28.6c-1-9.8 4.6-16 12.6-16s13.6 6.2 12.6 16c-1.7-4.7-5.1-7.6-12.6-8.4-7.5.8-10.9 3.7-12.6 8.4z" fill="${fill}" ${edge(c)}/>`;
    switch (style) {
      case 'short': return `<path d="M37.2 29.4C35.8 19 41.1 11.6 50.1 11.6c8.4 0 13.9 6.5 12.7 17.6-.9-4.6-2.6-7.6-5.2-9.3-3.9 2.4-10 3-16.1 1.1-2.1 2-3.5 4.8-4.3 8.4z" fill="${fill}" ${edge(c)}/>${SHEEN()}`;
      case 'long': return `<path d="M37 33.6C35.4 21 41.3 11.6 50.4 11.6c8.8 0 14.4 8 12.8 21.8-.6-5.8-2.3-9.8-5-12.3-4.2 3.3-11.4 4.4-17.6 2.3-1.9 2.7-3.1 6.1-3.6 10.2z" fill="${fill}" ${edge(c)}/>${SHEEN()}`;
      case 'bun': return `<circle cx="50" cy="9.4" r="5.6" fill="${fill}" ${edge(c)}/>${pulled}${line('M45.8 13.4c2.8-1 5.6-1 8.4 0', shade(c, 0.6), 1.2)}${SHEEN()}`;
      case 'ponytail': return `${pulled}${line('M59.6 15.2c.9.5 1.6 1.2 2.1 2', shade(c, 0.55), 1.6)}${SHEEN()}`;
      case 'braids': return `<path d="M37.4 29c-1.2-10.2 4.6-16.6 12.6-16.6s13.8 6.4 12.6 16.6c-1.4-4.8-4.4-7.8-8.6-8.8-1.6-.4-3-1.4-4-2.8-1 1.4-2.4 2.4-4 2.8-4.2 1-7.2 4-8.6 8.8z" fill="${fill}" ${edge(c)}/>${SHEEN(0.16)}`;
      case 'curly': return [[41, 20.6, 3.6], [45.4, 18.6, 3.8], [50, 18, 3.9], [54.6, 18.6, 3.8], [59, 20.6, 3.6], [38.4, 24.8, 3], [61.6, 24.8, 3]]
        .map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" ${edge(c, 0.5)}/>`).join('');
      case 'buzz': return `<path d="M37.6 27.2c-.2-8.4 4.9-13.4 12.4-13.4s12.6 5 12.4 13.4c-1.9-4.2-6.2-7-12.4-7s-10.5 2.8-12.4 7z" fill="${fill}" opacity=".9"/>`;
      default: return '<ellipse cx="45" cy="18.4" rx="4.2" ry="2.2" fill="#fff" opacity=".16"/>';
    }
  }

  function headwearFront(kind, fill, c, straw) {
    const dark = shade(c, 0.7);
    switch (kind) {
      case 'turban': return `<path d="M36.6 26.8c-1.3-11.6 4.9-19.4 13.4-19.4s14.7 7.8 13.4 19.4c-3.6-3-8.2-4.4-13.4-4.4s-9.8 1.4-13.4 4.4z" fill="${fill}" ${edge(c)}/>
        ${line('M38.6 21.2c4.7-6.2 13.4-8.4 21.6-4.2M38.4 15.8c5.4-5.6 13.8-6.3 20.1-2.4M43.4 23c3.9-5.3 10.6-7.2 16.4-5.2', dark, 0.8, 0.5)}${line('M42.4 11.2c2.6-1.5 5.5-2.1 8.4-1.8', '#fff', 1.1, 0.25)}`;
      case 'cap': return `<path d="M37.4 25.6c0-9.4 5.4-15 12.6-15s12.6 5.6 12.6 15z" fill="${fill}" ${edge(c)}/>
        ${line('M50 10.8v14.4M43.6 12.4c-1.6 3.8-2.2 8.2-1.6 13M56.4 12.4c1.6 3.8 2.2 8.2 1.6 13', dark, 0.55, 0.45)}<circle cx="50" cy="11" r="1.1" fill="${dark}"/>
        <path d="M35.4 25c4.4-1.9 9.2-2.8 14.6-2.8s10.2.9 14.6 2.8c.8.4.8 1.5 0 1.9-4.4 1.7-9.2 2.5-14.6 2.5s-10.2-.8-14.6-2.5c-.8-.4-.8-1.5 0-1.9z" fill="${shade(c, 0.8)}" ${edge(c)}/>`;
      case 'beanie': return `<path d="M36.8 26.6c-.8-11 5.2-17.4 13.2-17.4s14 6.4 13.2 17.4z" fill="${fill}" ${edge(c)}/>
        <circle cx="50" cy="8.6" r="3.4" fill="${shade(c, 1.1)}" ${edge(c)}/><rect x="36.2" y="21.4" width="27.6" height="6.2" rx="3.1" fill="${shade(c, 0.82)}" ${edge(c)}/>
        ${line(Array.from({ length: 11 }, (_, i) => `M${38.5 + i * 2.3} 22.3v4.4`).join(''), dark, 0.5, 0.45)}`;
      case 'sunhat': return `<ellipse cx="50" cy="22.6" rx="20.6" ry="4.5" fill="${straw}" ${edge('#c9a15e')}/>
        <path d="M40.2 22.8c-.3-8.3 3.7-13.2 9.8-13.2s10.1 4.9 9.8 13.2z" fill="${straw}" ${edge('#c9a15e')}/><path d="M40.3 19.2c6.4 1.3 13 1.3 19.4 0v3.2c-6.4 1.3-13 1.3-19.4 0z" fill="#7a5a35"/>
        ${line('M33.6 23.2c5 1.8 11 2.6 16.4 2.6s11.4-.8 16.4-2.6M38 20.6c3.6-.8 7.6-1.1 12-1.1', '#b58b4b', 0.5, 0.5)}`;
      case 'headphones': return `${line('M36.2 30.5c-1.8-12.6 4.6-20.8 13.8-20.8s15.6 8.2 13.8 20.8', '#3a4150', 2)}
        <rect x="33.4" y="26" width="5.6" height="9.6" rx="2.4" fill="${fill}" ${edge(c)}/><rect x="61" y="26" width="5.6" height="9.6" rx="2.4" fill="${fill}" ${edge(c)}/>
        ${line('M36.6 34.6c.6 4.2 3.6 7 8.4 7.2', '#3a4150', 0.9)}<circle cx="45.6" cy="41.8" r="1.1" fill="#3a4150"/>`;
      default: return '';
    }
  }

  function gearHtml(kind, u) {
    switch (kind) {
      case 'lanyard': return `${line('M45.2 50.4L50 63.4l4.8-13', '#2f6fd0', 1.1)}<rect x="49.3" y="62.6" width="1.4" height="1.6" fill="#9aa3b5"/>
        <rect x="47" y="63.8" width="6" height="8.2" rx=".9" fill="#fff" ${edge('#b8c4d6')}/><path d="M47 64.7c0-.5.4-.9.9-.9h4.2c.5 0 .9.4.9.9v1H47z" fill="#2f6fd0"/>
        <rect x="48" y="66.8" width="1.9" height="2.3" rx=".3" fill="#c9d3e2"/>${line('M50.7 67.3h1.4M50.7 68.6h1', '#c9d3e2', 0.5)}`;
      case 'backpack': return `${line('M36.4 53.2c.7 9.6.8 19.4.2 28.8M63.6 53.2c-.7 9.6-.8 19.4-.2 28.8', '#8c4a26', 2.6)}
        <rect x="35" y="71" width="3.2" height="2.4" rx=".5" fill="#c9cfd8"/><rect x="61.8" y="71" width="3.2" height="2.4" rx=".5" fill="#c9cfd8"/>`;
      case 'camera': return `${line('M38.6 52.6L60.8 83', '#2b2f3a', 1.2)}<rect x="58" y="81" width="3.2" height="1.8" rx=".5" fill="${METAL}"/>
        <rect x="56.6" y="82.4" width="9.8" height="7" rx="1.5" fill="${METAL}"/><circle cx="61.5" cy="85.9" r="2.4" fill="url(#${u}l)"/>${line('M60.3 84.9c.4-.5.9-.7 1.4-.7', '#fff', 0.5, 0.8)}`;
      case 'radio': return `${line('M71.6 88.6v-5.4', METAL, 0.9)}<rect x="68.4" y="88.6" width="4.4" height="9.6" rx="1" fill="${METAL}"/>
        <circle cx="69.6" cy="89.8" r=".55" fill="#ff6b5b"/>${line('M69.4 92.4h2.4M69.4 93.8h2.4M69.4 95.2h2.4', '#5b6274', 0.5)}`;
      case 'binoculars': return `${line('M45 50.6l2.2 14.6M55 50.6l-2.2 14.6', '#2b2f3a', 0.8)}
        <rect x="44.8" y="64.4" width="4.8" height="7.6" rx="1.8" fill="${METAL}"/><rect x="50.4" y="64.4" width="4.8" height="7.6" rx="1.8" fill="${METAL}"/>
        <rect x="49" y="65.6" width="2" height="2.4" fill="${METAL}"/><ellipse cx="47.2" cy="71.4" rx="1.7" ry=".7" fill="#8fb4e8"/><ellipse cx="52.8" cy="71.4" rx="1.7" ry=".7" fill="#8fb4e8"/>`;
      case 'medal': return `<path d="M56.6 57.4h3.2l-.4 3.6h-2.4z" fill="#2f6fd0"/><circle cx="58.2" cy="63.4" r="2.5" fill="url(#${u}m)" ${edge('#b47a10')}/>
        <path d="M58.2 61.7l.5 1.1 1.2.2-.9.8.2 1.2-1-.6-1 .6.2-1.2-.9-.8 1.2-.2z" fill="#fff6d6"/>`;
      default: return '';
    }
  }

  function face(s, o) {
    const look = o.look === 'left' ? -1.4 : o.look === 'right' ? 1.4 : 0;
    const mood = o.mood || 'happy';
    const skin = SKIN[s.skin] || SKIN[3];
    const hair = HAIR_COLORS[s.hairColor] || HAIR_COLORS.black;
    const brow = shade(hair, ['blonde', 'gray'].includes(s.hairColor) ? 0.62 : 0.85);
    const lips = LIPS[s.skin] || LIPS[3];
    const [lx, rx, ey] = [45.1 + look, 54.9 + look, 30.6];
    const [mx, my] = [50 + look * 0.7, 39.8];
    const p = [`<ellipse cx="${43.4 + look * 0.5}" cy="35.6" rx="2.5" ry="1.5" fill="#f08a78" opacity=".2"/><ellipse cx="${56.6 + look * 0.5}" cy="35.6" rx="2.5" ry="1.5" fill="#f08a78" opacity=".2"/>`];
    if (mood === 'grin') {
      p.push(line(`M${lx - 1.6} ${ey + 0.5}q1.6-2.1 3.2 0M${rx - 1.6} ${ey + 0.5}q1.6-2.1 3.2 0`, EYE, 0.95));
    } else {
      const [dx, dy] = mood === 'think' ? [0.5, -0.5] : [0, 0];
      p.push([lx, rx].map((x) => `<ellipse cx="${x + dx}" cy="${ey + dy}" rx="1.35" ry="1.75" fill="${EYE}"/><circle cx="${x + dx - 0.45}" cy="${ey + dy - 0.6}" r=".45" fill="#fff"/>`).join(''));
      p.push(line(`M${lx - 1.8} ${ey - 1.5}q1.8-1.2 3.6 0M${rx - 1.8} ${ey - 1.5}q1.8-1.2 3.6 0`, EYE, 0.5, 0.55));
    }
    const brows = mood === 'think' ? `M${lx - 2.6} ${ey - 4.8}q2.6-1.9 5.2-.5M${rx - 2.6} ${ey - 3.5}q2.6-1.1 5.2.1`
      : mood === 'oops' ? `M${lx - 2.6} ${ey - 3.2}q2.8-.4 5-1.9M${rx - 2.4} ${ey - 5.1}q2.2 1.5 5 1.9`
        : `M${lx - 2.6} ${ey - 3.5}q2.6-1.6 5.2-.2M${rx - 2.6} ${ey - 3.7}q2.6-1.4 5.2.2`;
    p.push(line(brows, brow, 1.05));
    p.push(line(`M${50.4 + look} 33.2c.9 1.4 1.1 2.4.4 3.1-.6.5-1.5.5-2.2.2`, shade(skin, 0.72), 0.75));
    if (s.facial === 'beard') {
      p.push(`<path d="M37.6 29.6c.2 9.2 4.6 17 12.4 17.3 7.8-.3 12.2-8.1 12.4-17.3-1.3 4.7-3.4 7.8-6.2 8.9-1.6-1.4-3.8-2-6.2-1-2.4-1-4.6-.4-6.2 1-2.8-1.1-4.9-4.2-6.2-8.9z" fill="url(#${o.u}h)" ${edge(hair)}/>`);
    }
    if (mood === 'grin') {
      p.push(`<path d="M${mx - 3.4} ${my - 0.8}q3.4 4.6 6.8 0z" fill="#5a2622"/><path d="M${mx - 2.9} ${my - 0.55}q2.9 1.1 5.8 0l-.3.8q-2.6.9-5.2 0z" fill="#fff"/>`);
    } else if (mood === 'oops') {
      p.push(`<ellipse cx="${mx}" cy="${my + 0.4}" rx="1.3" ry="1.1" fill="#5a2622"/>`);
    } else if (mood === 'think') {
      p.push(line(`M${mx - 2} ${my + 0.6}q2.2.6 4.4-.6`, lips, 1));
    } else {
      p.push(line(`M${mx - 3} ${my - 0.3}q3 2.4 6 0`, lips, 1));
    }
    if (s.facial === 'mustache') {
      p.push(`<path d="M45.6 37.9c1.4-1.5 3.3-1.6 4.4-.6 1.1-1 3-.9 4.4.6-1.2 1.2-2.8 1.4-4.4.8-1.6.6-3.2.4-4.4-.8z" transform="translate(${look * 0.7} 0)" fill="url(#${o.u}h)" ${edge(hair)}/>`);
    }
    return { html: p.join(''), lx, rx, ey };
  }

  function glassesHtml(kind, f) {
    const { lx, rx, ey } = f;
    const frame = '#2e3446';
    const temples = line(`M${lx - 3.3} ${ey - 0.5}L37.6 ${ey - 1.2}M${rx + 3.3} ${ey - 0.5}L62.4 ${ey - 1.2}`, frame, 0.7);
    const glint = line(`M${lx - 1.8} ${ey - 1.6}q.9-.8 2-.9M${rx - 1.8} ${ey - 1.6}q.9-.8 2-.9`, '#fff', 0.45, 0.75);
    if (kind === 'round') {
      return `${temples}<circle cx="${lx}" cy="${ey}" r="3.3" fill="#fff" fill-opacity=".12" stroke="${frame}" stroke-width=".75"/><circle cx="${rx}" cy="${ey}" r="3.3" fill="#fff" fill-opacity=".12" stroke="${frame}" stroke-width=".75"/>
        ${line(`M${lx + 3.3} ${ey - 0.4}q${(rx - lx - 6.6) / 2} -1.1 ${rx - lx - 6.6} 0`, frame, 0.75)}${glint}`;
    }
    if (kind === 'square') {
      return `${temples}<rect x="${lx - 3.6}" y="${ey - 2.7}" width="7.2" height="5.4" rx="1.4" fill="#fff" fill-opacity=".12" stroke="${frame}" stroke-width=".75"/><rect x="${rx - 3.6}" y="${ey - 2.7}" width="7.2" height="5.4" rx="1.4" fill="#fff" fill-opacity=".12" stroke="${frame}" stroke-width=".75"/>
        ${line(`M${lx + 3.6} ${ey - 0.6}h${rx - lx - 7.2}`, frame, 0.75)}${glint}`;
    }
    return '';
  }

  // spec: look options; opts: { view: 'full' | 'head', look: 'left' | 'right', mood, title }
  function svg(spec, opts) {
    const o = Object.assign({}, opts || {});
    const s = Object.assign({}, DEFAULT, spec);
    const u = `av${seq += 1}`;
    o.u = u;
    const skin = SKIN[s.skin] || SKIN[3];
    const hair = HAIR_COLORS[s.hairColor] || HAIR_COLORS.black;
    const hw = COLORS[s.hwColor] || COLORS.teal;
    const shirt = COLORS[s.shirt] || COLORS.sky;
    const pants = /^#[0-9a-f]{6}$/i.test(s.pants || '') ? s.pants : TROUSERS;
    const hijab = s.headwear === 'hijab';
    const covered = COVERS.includes(s.headwear);
    const hairHidden = hijab || s.headwear === 'turban';
    const showHair = (part) => !hairHidden && !(covered && (part === 'front' || s.hair === 'curly'));
    const p = [];

    p.push(`<defs>${lit(`${u}k`, skin, 1.05, 0.9)}${lit(`${u}h`, hair, 1.18, 0.78)}${lit(`${u}s`, shirt, 1.08, 0.82)}${lit(`${u}w`, hw, 1.1, 0.8)}
      ${lit(`${u}v`, VEST, 1.15, 0.8)}${lit(`${u}t`, pants, 1.15, 0.8)}${lit(`${u}p`, '#d9b878', 1.08, 0.86)}${lit(`${u}b`, '#c26a3a', 1.1, 0.82)}
      <radialGradient id="${u}g"><stop offset="0" stop-color="#0b1e44" stop-opacity=".26"/><stop offset="1" stop-color="#0b1e44" stop-opacity="0"/></radialGradient>
      <radialGradient id="${u}l" cx=".35" cy=".35"><stop offset="0" stop-color="#b9d4f5"/><stop offset="1" stop-color="#22355c"/></radialGradient>
      <radialGradient id="${u}m" cx=".35" cy=".3"><stop offset="0" stop-color="#ffe58a"/><stop offset=".6" stop-color="#f2b632"/><stop offset="1" stop-color="#b47a10"/></radialGradient></defs>`);
    if (o.view !== 'head') p.push(`<ellipse cx="50" cy="153.4" rx="21" ry="3.4" fill="url(#${u}g)"/>`);

    // Behind the figure.
    if (hijab) p.push(`<path d="${HIJAB_BACK}" fill="url(#${u}w)" ${edge(hw)}/>`);
    else if (showHair('back')) p.push(hairBack(s.hair, `url(#${u}h)`, hair));
    if (s.gear === 'backpack') p.push(`<rect x="27.6" y="53.6" width="44.8" height="40" rx="8" fill="url(#${u}b)" ${edge('#c26a3a')}/>`);

    // Body.
    p.push(ARMS.map((d) => `<path d="${d}" fill="url(#${u}s)" ${edge(shirt)}/>`).join(''));
    p.push(`<path d="M26.3 89.4h7.15l-.05 2.4H26.25zM66.6 89.4h7.15l.05 2.4H66.6z" fill="${shade(shirt, 0.84)}"/>`);
    p.push(`<path d="${LEGS}" fill="url(#${u}t)" ${edge(pants)}/>${line('M42 111v36M58 111v36', shade(pants, 1.5), 0.6, 0.3)}`);
    p.push(`<path d="${SHOES}" fill="${SHOE}"/>${line('M37.4 150.2h9M53 150.2h9', '#fff', 0.7, 0.16)}`);
    p.push(`<path d="M45.4 39.5h9.2v10.6c0 1.7-2.1 2.7-4.6 2.7s-4.6-1-4.6-2.7z" fill="${shade(skin, 0.9)}"/><path d="M45.4 41.4c1.4 2.4 3 3.4 4.6 3.4s3.2-1 4.6-3.4v3.6c-1.5 1.4-3 2-4.6 2s-3.1-.6-4.6-2z" fill="${shade(skin, 0.72)}" opacity=".55"/>`);
    p.push(`<path d="${TORSO}" fill="url(#${u}s)" ${edge(shirt)}/>`);
    p.push(`<path d="M44.6 49.6L50 54.4l-2.6 4.2-5.6-6.4zM55.4 49.6L50 54.4l2.6 4.2 5.6-6.4z" fill="${shade(shirt, 1.1)}" ${edge(shirt)}/>`);
    p.push(`${line('M50 54.6V99', shade(shirt, 0.7), 0.55, 0.5)}${[61, 69, 77, 85].map((y) => `<circle cx="50" cy="${y}" r=".6" fill="${shade(shirt, 0.62)}"/>`).join('')}`);
    if (s.vest === 'field') {
      p.push(`<path d="${VEST_PANELS}" fill="url(#${u}v)" ${edge(VEST)}/>`);
      p.push(`<path d="M33.2 77.2h14.4v2.2H33.3zM52.4 77.2h14.4l-.1 2.2H52.4z" fill="#dfe5ee" opacity=".85"/>`);
      p.push(['36.6', '55.8'].map((x) => `<rect x="${x}" y="62.4" width="7.6" height="6.4" rx=".9" fill="${shade(VEST, 0.86)}" ${edge(VEST)}/><rect x="${x}" y="62.4" width="7.6" height="2" rx=".6" fill="${shade(VEST, 0.74)}"/>`).join(''));
      p.push(['35.8', '54.8'].map((x) => `<rect x="${x}" y="83" width="9.4" height="8.6" rx="1" fill="${shade(VEST, 0.86)}" ${edge(VEST)}/><rect x="${x}" y="83" width="9.4" height="2.2" rx=".6" fill="${shade(VEST, 0.74)}"/>`).join(''));
      p.push(line('M47.7 57v43.6M52.3 57v43.6', shade(VEST, 1.45), 0.5, 0.5));
    }
    if (s.gear !== 'radio') p.push(gearHtml(s.gear, u));
    if (hijab) p.push(`<path d="${HIJAB_DRAPE}" fill="url(#${u}w)" ${edge(hw)}/>${line('M40.6 51.6c3 2.6 6.1 3.6 9.4 3.6s6.4-1 9.4-3.6M36.4 55.8c4.2 2.4 8.6 3.4 13.6 3.4s9.4-1 13.6-3.4', shade(hw, 0.7), 0.7, 0.35)}`);
    p.push(`<ellipse cx="29.8" cy="95.4" rx="3.4" ry="3.9" fill="url(#${u}k)" ${edge(skin)}/><ellipse cx="70.2" cy="95.4" rx="3.4" ry="3.9" fill="url(#${u}k)" ${edge(skin)}/>`);
    if (s.gear === 'radio') p.push(gearHtml('radio', u));
    if (showHair('back')) p.push(hairDrape(s.hair, `url(#${u}h)`, hair));

    // Head.
    if (!hijab) {
      p.push(`<ellipse cx="37.4" cy="30.6" rx="2.4" ry="3.4" fill="url(#${u}k)" ${edge(skin)}/><ellipse cx="62.6" cy="30.6" rx="2.4" ry="3.4" fill="url(#${u}k)" ${edge(skin)}/>`);
      p.push(line('M37.8 29.2q-.9 1.4 0 2.8M62.2 29.2q.9 1.4 0 2.8', shade(skin, 0.72), 0.6, 0.7));
    }
    p.push(`<path d="${FACE}" fill="url(#${u}k)" ${edge(skin)}/>`);
    const f = face(s, o);
    p.push(f.html);
    if (showHair('front')) p.push(hairFront(s.hair, `url(#${u}h)`, hair));
    p.push(headwearFront(s.headwear, `url(#${u}w)`, hw, `url(#${u}p)`));
    if (hijab) p.push(`<path d="${HIJAB_FRAME}" fill-rule="evenodd" fill="url(#${u}w)" ${edge(hw)}/>`);
    p.push(glassesHtml(s.glasses, f));

    const vb = o.view === 'head' ? '28 5 44 44' : '0 0 100 160';
    const a11y = o.title ? `role="img" aria-label="${esc(o.title)}"` : 'aria-hidden="true"';
    return `<svg class="agent-svg" viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" focusable="false" data-hair="${esc(s.hair)}" data-headwear="${esc(s.headwear)}" ${a11y}>${p.join('')}</svg>`;
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
            // Hair previews leave out headwear, so each style is visible even under a hijab or hat.
            const look = Object.assign({}, draft, { [row.key]: v }, row.key === 'hair' ? { headwear: 'none' } : {});
            const inner = row.kind === 'swatch' ? `<span class="agent-swatch" style="background:${row.color(v)}"></span>`
              : svg(look, { view: row.kind === 'head' ? 'head' : 'full' });
            return `<button type="button" class="agent-opt agent-opt-${row.kind}${on ? ' is-on' : ''}${locked ? ' is-locked' : ''}" data-key="${row.key}" data-value="${v}"
              aria-pressed="${on}" aria-label="${esc(label)}" title="${esc(label)}"${locked ? ' disabled' : ''}>${inner}${locked ? `<span class="agent-lock"><i class="bi bi-lock-fill" aria-hidden="true"></i> Lv ${need}</span>` : ''}</button>`;
          }).join('')}
        </div>
      </fieldset>`;
  }

  function draw() {
    const el = document.getElementById('agent-modal');
    el.querySelector('#agent-preview').innerHTML = svg(draft, { title: 'Your avatar', mood: 'grin' });
    el.querySelector('#agent-rows').innerHTML = ROWS.map(rowHtml).join('');
  }

  function build() {
    document.body.insertAdjacentHTML('beforeend', `
      <div class="modal fade" id="agent-modal" tabindex="-1" aria-labelledby="agent-title" aria-hidden="true">
        <div class="modal-dialog modal-xl modal-dialog-scrollable">
          <div class="modal-content agent-modal">
            <div class="modal-header">
              <h2 class="modal-title h4" id="agent-title"><i class="bi bi-person-badge" aria-hidden="true"></i> Create your avatar</h2>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
              <div class="row g-4">
                <div class="col-md-4">
                  <div class="agent-stage"><div class="agent-preview" id="agent-preview"></div></div>
                  <label class="form-label fw-semibold mt-3" for="agent-name">Name</label>
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
              <button type="button" class="btn btn-accent" id="agent-save"><i class="bi bi-check-lg" aria-hidden="true"></i> Save avatar</button>
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

  const PALETTE = { SKIN, LIPS, HAIR_COLORS, COLORS, TROUSERS, VEST, SHOE };

  window.Avatar = { svg, get, isSet, save, headHtml, openCreator, NPC, OPTIONS, UNLOCK, DEFAULT, PALETTE };
})();
