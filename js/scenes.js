// Story scenes: cartoon backdrops, characters and speech bubbles for each scenario
// island, plus medallions and the mentor's tips. All art is inline SVG.
(function () {
  'use strict';
  const { esc } = App;
  const INK = '#2a2f45';
  const MENTOR = { name: 'Mentor Rio', look: 'mentor' };
  let uid = 0;

  // ---------- backdrop pieces (viewBox 800 x 300, ground from y = 250) ----------
  function sky(kind) {
    const id = `sky${uid += 1}`;
    const [top, bottom] = kind === 'golden' ? ['#ff9f6b', '#ffe2ae'] : ['#6cc4ff', '#dff3ff'];
    return `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient></defs>
      <rect width="800" height="300" fill="url(#${id})"/>
      <circle cx="${kind === 'golden' ? 640 : 690}" cy="${kind === 'golden' ? 120 : 58}" r="30" fill="${kind === 'golden' ? '#ffd27a' : '#fff2a8'}"/>`;
  }
  const cloud = (x, y, s) => `<g transform="translate(${x} ${y}) scale(${s})" fill="#fff" opacity=".92"><ellipse cx="0" cy="0" rx="34" ry="14"/><ellipse cx="-16" cy="-8" rx="16" ry="13"/><ellipse cx="12" cy="-12" rx="20" ry="16"/></g>`;
  const hills = (c1, c2) => `<path d="M0 214Q120 156 262 206T524 196T800 212V300H0z" fill="${c1}"/><path d="M0 236Q160 200 330 232T660 226T800 236V300H0z" fill="${c2}"/>`;
  const ground = (c) => `<rect y="250" width="800" height="50" fill="${c}"/>`;
  const tufts = (c) => [40, 150, 300, 520, 610, 740].map((x) => `<path d="M${x} 262l4-10 3 10 4-12 3 12" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round"/>`).join('');
  const hut = (x, s) => `<g transform="translate(${x} 250) scale(${s})"><rect x="-36" y="-46" width="72" height="46" rx="6" fill="#f0c98f" stroke="${INK}" stroke-width="2"/>
    <path d="M-48-42Q0-104 48-42z" fill="#b8743d" stroke="${INK}" stroke-width="2"/><path d="M-30-60h60M-20-74h40" stroke="#8c5428" stroke-width="2"/>
    <rect x="-10" y="-30" width="20" height="30" rx="9" fill="#7a4b28"/></g>`;
  const acacia = (x) => `<g transform="translate(${x} 250)"><path d="M-4 0l2-60-14-16M-2-60l16-14" stroke="#6b4a2b" stroke-width="7" stroke-linecap="round" fill="none"/>
    <ellipse cx="0" cy="-80" rx="62" ry="15" fill="#5fae4f" stroke="${INK}" stroke-width="2"/><ellipse cx="-20" cy="-90" rx="30" ry="10" fill="#6cc05a"/></g>`;
  const tree = (x) => `<g transform="translate(${x} 250)"><rect x="-6" y="-46" width="12" height="46" fill="#7a5230"/><circle cy="-64" r="30" fill="#59b35a" stroke="${INK}" stroke-width="2"/><circle cx="-14" cy="-72" r="12" fill="#6fc66b"/></g>`;
  const tent = (x, y, s) => `<g transform="translate(${x} ${y}) scale(${s})"><path d="M-46 0L0-50L46 0z" fill="#f4f0e6" stroke="#b6ad98" stroke-width="2.4"/><path d="M-12 0L0-30L12 0z" fill="#9aa7bd"/><path d="M0-50v-8" stroke="#b6ad98" stroke-width="2"/></g>`;
  const house = (x, w, h, wall, roof) => `<g transform="translate(${x} 250)"><rect x="0" y="${-h}" width="${w}" height="${h}" fill="${wall}" stroke="${INK}" stroke-width="2"/>
    <path d="M-8 ${-h}L${w / 2} ${-h - 34}L${w + 8} ${-h}z" fill="${roof}" stroke="${INK}" stroke-width="2"/>
    ${[0.22, 0.62].map((f) => `<rect x="${w * f}" y="${-h + 16}" width="${w * 0.18}" height="20" rx="2" fill="#bfe3ff" stroke="${INK}" stroke-width="1.5"/>`).join('')}
    <rect x="${w * 0.42}" y="-30" width="${w * 0.16}" height="30" fill="#8a5a36"/></g>`;
  const stall = (x, c) => `<g transform="translate(${x} 250)">
    <rect x="-56" y="-44" width="112" height="44" fill="#e9c38f" stroke="${INK}" stroke-width="2"/>
    ${[0, 1, 2, 3].map((i) => `<path d="M${-60 + i * 30} -86h30v22q-15 10 -30 0z" fill="${i % 2 ? '#fff' : c}" stroke="${INK}" stroke-width="1.6"/>`).join('')}
    <path d="M-56-64v20M56-64v20" stroke="${INK}" stroke-width="2"/>
    ${[[-34, '#ff8a3d'], [-14, '#ffc23d'], [8, '#7ccf5a'], [30, '#ff5d5d']].map(([cx, f]) => `<circle cx="${cx}" cy="-50" r="8" fill="${f}" stroke="${INK}" stroke-width="1.2"/>`).join('')}</g>`;

  const PROPS = {
    pump: `<g transform="translate(440 250)"><rect x="-6" y="-58" width="12" height="58" fill="#2f6fd0" stroke="${INK}" stroke-width="2"/>
      <path d="M0-50L34-70" stroke="${INK}" stroke-width="4" stroke-linecap="round"/><path d="M-6-40h-16v8" fill="none" stroke="#2f6fd0" stroke-width="6"/>
      <path d="M-34-14h24l-4 14h-16z" fill="#ffc23d" stroke="${INK}" stroke-width="2"/></g>`,
    signpost: `<g transform="translate(430 250)"><rect x="-4" y="-96" width="8" height="96" fill="#8a5a36"/>
      <path d="M4-90h56l14 11-14 11H4z" fill="#ffc23d" stroke="${INK}" stroke-width="2"/><path d="M-4-60h-56l-14 11 14 11h56z" fill="#4aa3ff" stroke="${INK}" stroke-width="2"/>
      <text x="34" y="-73" font-size="16" font-weight="800" text-anchor="middle" fill="${INK}">?</text><text x="-34" y="-43" font-size="16" font-weight="800" text-anchor="middle" fill="${INK}">?</text></g>`,
    track: '<path d="M330 300Q380 270 420 250T470 222" fill="none" stroke="#c99a5c" stroke-width="36" stroke-linecap="round" opacity=".85"/>',
    lanterns: `<path d="M0 40Q200 80 400 46T800 40" fill="none" stroke="${INK}" stroke-width="1.5"/>${[90, 210, 330, 470, 590, 710].map((x, i) =>
      `<g transform="translate(${x} ${58 + (i % 2) * 8})"><rect x="-7" y="0" width="14" height="18" rx="5" fill="${['#ff7b6b', '#ffc23d', '#9b7bf2'][i % 3]}" stroke="${INK}" stroke-width="1.4"/></g>`).join('')}`,
    radio: `<g transform="translate(700 250)"><path d="M-14 0L0-170L14 0M-9-60h18M-6-110h12" fill="none" stroke="#7d8597" stroke-width="3"/>
      <circle cy="-172" r="5" fill="#ff5d5d"/><path d="M14-180q10 8 0 16M22-188q18 16 0 32" fill="none" stroke="#ff5d5d" stroke-width="2.5" stroke-linecap="round"/></g>`
  };

  const BACKDROPS = {
    village: (k) => sky(k) + cloud(150, 60, 1) + cloud(470, 44, 0.8) + hills('#a9e08f', '#8ccf73') + ground('#e2c389') + hut(120, 1) + hut(250, 0.8) + acacia(640) + hut(560, 0.7) + tufts('#7fb05a'),
    camp: (k) => sky(k) + cloud(200, 54, 0.9) + cloud(520, 70, 0.7) + hills('#c8dfa0', '#b9d48c') + ground('#dcc59a')
      + tent(130, 236, 0.6) + tent(230, 236, 0.6) + tent(330, 236, 0.6) + tent(80, 250, 0.9) + tent(220, 250, 0.9)
      + `<g transform="translate(600 250)"><rect x="-40" y="-90" width="80" height="58" rx="8" fill="#4aa3ff" stroke="${INK}" stroke-width="2"/><ellipse cy="-90" rx="40" ry="9" fill="#7cc0ff" stroke="${INK}" stroke-width="2"/><path d="M-30-32v32M30-32v32" stroke="${INK}" stroke-width="4"/></g>`
      + [700, 730, 760, 790].map((x) => `<rect x="${x}" y="222" width="5" height="30" fill="#8a6b45"/>`).join('') + '<path d="M700 230h95" stroke="#8a6b45" stroke-width="2"/>',
    market: (k) => sky(k) + cloud(160, 50, 0.9) + `<rect x="0" y="150" width="800" height="100" fill="#f2d7b8"/>`
      + house(20, 120, 110, '#ffd6a8', '#e07a5f') + house(560, 140, 120, '#cfe7ff', '#6b8cce') + ground('#e6cfa8')
      + stall(250, '#ff6b6b') + stall(420, '#4aa3ff') + PROPS.radio
      + `<path d="M0 30L800 30" stroke="${INK}" stroke-width="1.2"/>${Array.from({ length: 16 }, (_, i) => `<path d="M${i * 50 + 10} 30l12 18 12-18z" fill="${['#ff7b6b', '#ffc23d', '#34c389', '#4aa3ff'][i % 4]}"/>`).join('')}`,
    town: (k) => sky(k) + cloud(220, 48, 0.8) + cloud(560, 66, 0.7)
      + house(30, 130, 120, '#ffe1b3', '#c96a4a') + house(190, 110, 96, '#d9ecff', '#5c7fc2')
      + `<g transform="translate(470 250)"><rect x="0" y="-130" width="170" height="130" fill="#fff4e0" stroke="${INK}" stroke-width="2"/><path d="M-12-130L85-176L182-130z" fill="#9b7bf2" stroke="${INK}" stroke-width="2"/>${[18, 58, 98, 138].map((x) => `<rect x="${x}" y="-120" width="14" height="120" fill="#efe2c6" stroke="${INK}" stroke-width="1.4"/>`).join('')}</g>`
      + house(670, 120, 104, '#e8ffe1', '#3fa56b') + ground('#cfc9bf') + '<rect y="250" width="800" height="8" fill="#e8e3da"/>'
      + `<g transform="translate(400 250)"><rect x="-3" y="-120" width="6" height="120" fill="#5a6177"/><circle cy="-124" r="10" fill="#fff2a8" stroke="${INK}" stroke-width="2"/></g>`,
    fields: (k) => sky(k) + cloud(180, 56, 0.9) + cloud(600, 42, 0.8)
      + '<path d="M0 205Q200 180 400 198T800 190V300H0z" fill="#bfe39a"/>'
      + [0, 1, 2, 3, 4, 5].map((i) => `<path d="M0 ${214 + i * 7}Q400 ${200 + i * 7} 800 ${208 + i * 7}" fill="none" stroke="${i % 2 ? '#e9d36a' : '#8fcf62'}" stroke-width="7"/>`).join('')
      + ground('#a7d77c') + house(620, 100, 70, '#ffe7c7', '#c0583f') + tree(110) + tree(520) + tufts('#5f9e42'),
    office: () => `<rect width="800" height="300" fill="#f6efe4"/><rect y="238" width="800" height="62" fill="#d1a879"/>
      ${[100, 260, 420, 580, 740].map((x) => `<path d="M${x} 238v62" stroke="#b98f5f" stroke-width="2"/>`).join('')}
      <rect y="232" width="800" height="8" fill="#e8dccb"/>
      <g><rect x="60" y="46" width="220" height="140" rx="6" fill="#bfe6ff" stroke="${INK}" stroke-width="3"/>${cloud(130, 96, 0.7)}${cloud(220, 130, 0.5)}
      <path d="M170 46v140M60 116h220" stroke="${INK}" stroke-width="3"/></g>
      <g><rect x="330" y="60" width="200" height="110" rx="4" fill="#fff" stroke="${INK}" stroke-width="3"/>
      <path d="M350 86h90M350 104h130M350 122h70" stroke="#4aa3ff" stroke-width="4" stroke-linecap="round"/><path d="M450 120l20 20 40-46" fill="none" stroke="#ff7b6b" stroke-width="4" stroke-linecap="round"/>
      <rect x="400" y="170" width="60" height="6" fill="#9aa3b5"/></g>
      <g transform="translate(330 232)"><rect x="0" y="-40" width="220" height="12" rx="3" fill="#b98f5f" stroke="${INK}" stroke-width="2"/><path d="M14-28v28M206-28v28" stroke="${INK}" stroke-width="4"/></g>
      <g transform="translate(720 238)"><path d="M-18 0h36l-6-34h-24z" fill="#e07a5f" stroke="${INK}" stroke-width="2"/>
      <path d="M0-34q-26-30-6-62M0-34q22-26 8-58M0-34q-6-36 22-46" fill="none" stroke="#3fa56b" stroke-width="7" stroke-linecap="round"/></g>
      <path d="M560 0v24" stroke="${INK}" stroke-width="2"/><path d="M536 24h48l-8 14h-32z" fill="#ffc23d" stroke="${INK}" stroke-width="2"/>`
  };

  function backdrop(theme, prop, skyKind) {
    const draw = BACKDROPS[theme] || BACKDROPS.village;
    return `<svg class="stage-bg" viewBox="0 0 800 300" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
      ${draw(skyKind)}${prop && PROPS[prop] ? PROPS[prop] : ''}</svg>`;
  }

  // ---------- medallions ----------
  const METAL = { gold: ['#ffe58a', '#f2b632', '#b47a10'], silver: ['#f4f6fa', '#c3cad6', '#7d8697'], bronze: ['#f6c39a', '#d08a52', '#8a4f22'] };
  function medallion(tier, size, label) {
    const [hi, mid, lo] = METAL[tier] || METAL.gold;
    const id = `med${uid += 1}`;
    return `<svg class="medallion medallion-${tier}" viewBox="0 0 64 80" width="${size}" height="${Math.round(size * 1.25)}" ${label ? `role="img" aria-label="${esc(label)}"` : 'aria-hidden="true"'} focusable="false">
      <defs><radialGradient id="${id}" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="${hi}"/><stop offset=".6" stop-color="${mid}"/><stop offset="1" stop-color="${lo}"/></radialGradient></defs>
      <path d="M18 0h12l6 22h-12zM34 0h12l-6 22h-12z" fill="#4aa3ff" stroke="${INK}" stroke-width="1.5"/>
      <circle cx="32" cy="48" r="26" fill="url(#${id})" stroke="${INK}" stroke-width="2.4"/><circle cx="32" cy="48" r="19" fill="none" stroke="${lo}" stroke-width="2" opacity=".6"/>
      <path d="M32 34l4.1 8.4 9.3 1.3-6.7 6.5 1.6 9.2-8.3-4.4-8.3 4.4 1.6-9.2-6.7-6.5 9.3-1.3z" fill="#fff" fill-opacity=".85" stroke="${lo}" stroke-width="1.2"/></svg>`;
  }

  // ---------- stage ----------
  // actors: [{ id, name, spec, x (percent), look, mood, anim }]; bubbles: [{ side: 'left' | 'right' | 'think', who, text, x }]
  function stage(o) {
    const actors = (o.actors || []).map((a) => `
      <div class="actor" style="--x:${a.x}%" data-actor="${a.id}">
        <div class="actor-body${a.anim ? ` is-${a.anim}` : ''}">${Avatar.svg(a.spec, { look: a.look, mood: a.mood })}</div>
        <span class="actor-name">${esc(a.name)}</span>
      </div>`).join('');
    const bubbles = (o.bubbles || []).map((b) => `
      <div class="bubble bubble-${b.side}" data-who="${esc(b.id || '')}"${b.x != null ? ` style="--x:${b.x}%"` : ''}>
        ${b.side === 'think' ? '' : `<span class="bubble-who">${esc(b.who)}</span>`}${esc(b.text)}
      </div>`).join('');
    return `
      <figure class="stage theme-${esc(o.theme || 'village')}" id="stage">
        <div class="stage-art">
          ${backdrop(o.theme, o.prop, o.sky)}
          <div class="stage-actors" aria-hidden="true">${actors}</div>
          ${o.banner ? `<div class="stage-banner">${o.banner}</div>` : ''}
          ${o.label ? `<span class="stage-label">${esc(o.label)}</span>` : ''}
        </div>
        <div class="stage-bubbles" aria-live="polite">${bubbles}</div>
        ${o.caption ? `<figcaption class="visually-hidden">${esc(o.caption)}</figcaption>` : ''}
      </figure>`;
  }

  // The mentor's reaction to a choice, varied by decision so it doesn't feel canned.
  const REACTIONS = {
    strong: ['Brilliant call!', "That's how a pro handles it!", 'Spot on. Everyone gets heard.'],
    partial: ["Good instinct, but something's missing.", 'Close! Look again at who might be left out.', 'Halfway there. What else could you check?'],
    weak: ["Hmm, let's rethink this one.", 'Careful: a shortcut may be steering this choice.', 'Pause. Whose view is missing here?']
  };
  function reaction(rating, i) {
    const list = REACTIONS[rating] || REACTIONS.partial;
    return list[i % list.length];
  }

  // A small strip where the mentor offers a practical tip.
  function mentorTip(text) {
    return `
      <div class="mentor-tip">
        <span class="mentor-head" aria-hidden="true">${Avatar.svg(Avatar.NPC.mentor, { view: 'head', look: 'right' })}</span>
        <p class="tip-bubble mb-0"><strong>${esc(MENTOR.name)}:</strong> ${esc(text)}</p>
      </div>`;
  }

  window.Scenes = { stage, backdrop, medallion, reaction, mentorTip, MENTOR };
})();
