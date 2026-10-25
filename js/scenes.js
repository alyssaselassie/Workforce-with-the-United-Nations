// Story scenes: illustrated backdrops, characters and speech bubbles for each scenario,
// plus medals and the mentor's tips. All art is inline SVG.
(function () {
  'use strict';
  const { esc } = App;
  const MENTOR = { name: 'Mentor Rio', look: 'mentor' };
  let uid = 0;

  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    const c = (v) => Math.max(0, Math.min(255, Math.round(v * f))).toString(16).padStart(2, '0');
    return `#${c(n >> 16)}${c((n >> 8) & 255)}${c(n & 255)}`;
  }

  // ---------- backdrops (viewBox 800 x 300, horizon near y = 206) ----------
  // Painted like the globe: soft gradients, light from the upper left, and far layers that fade into the sky.
  // Desktop shows y 60-300 and phones show x 133-667, so key details sit inside both.
  function painter() {
    const k = `bg${uid += 1}`;
    const defs = [];
    const memo = {};
    const stops = (list) => list.map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}"${a == null ? '' : ` stop-opacity="${a}"`}/>`).join('');
    const add = (tag, attrs, list) => {
      const key = tag + attrs + JSON.stringify(list);
      if (!memo[key]) {
        memo[key] = `${k}-${defs.length}`;
        defs.push(`<${tag} id="${memo[key]}" ${attrs}>${stops(list)}</${tag}>`);
      }
      return `url(#${memo[key]})`;
    };
    return {
      lin: (list, x2, y2) => add('linearGradient', `x1="0" y1="0" x2="${x2 == null ? 0 : x2}" y2="${y2 == null ? 1 : y2}"`, list),
      rad: (list, cx, cy, r) => add('radialGradient', `cx="${cx == null ? 0.5 : cx}" cy="${cy == null ? 0.5 : cy}" r="${r == null ? 0.5 : r}"`, list),
      defs: () => `<defs>${defs.join('')}</defs>`
    };
  }

  const vlin = (P, top, bottom) => P.lin([[0, top], [1, bottom]]);
  const lit = (P, c, hi, lo) => P.lin([[0, shade(c, hi || 1.06)], [1, shade(c, lo || 0.86)]], 1, 0.35);
  const shadow = (P, cx, cy, rx, ry) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${P.rad([[0, '#1d2733', 0.3], [1, '#1d2733', 0]])}"/>`;
  const rect = (x, y, w, h, fill, extra) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"${extra ? ` ${extra}` : ''}/>`;
  const stroke = (d, c, w, o) => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"${o ? ` opacity="${o}"` : ''}/>`;

  function sky(P, golden) {
    const fill = golden ? P.lin([[0, '#dd8a6e'], [0.5, '#f4bd8b'], [1, '#fde5c3']]) : P.lin([[0, '#4c9be0'], [0.55, '#97cbf0'], [1, '#e6f4fc']]);
    const [x, y, r] = golden ? [612, 192, 24] : [636, 92, 17];
    const glow = golden ? P.rad([[0, '#fff1c9', 1], [0.2, '#ffd08a', 0.7], [1, '#ffad6e', 0]]) : P.rad([[0, '#fffdf3', 1], [0.15, '#fff3c9', 0.65], [1, '#ffffff', 0]]);
    return `${rect(0, 0, 800, 300, fill)}<circle cx="${x}" cy="${y}" r="${golden ? 210 : 150}" fill="${glow}"/><circle cx="${x}" cy="${y}" r="${r}" fill="${golden ? '#fff4d8' : '#fffef6'}"/>`;
  }
  const horizon = (golden) => (golden ? '#fde5c3' : '#e6f4fc');
  function clouds(P, golden, list) {
    const fill = P.lin([[0, '#ffffff', 0.96], [1, golden ? '#ffd3b0' : '#d3e5f3', 0.92]]);
    return list.map(([x, y, s]) => `<path transform="translate(${x} ${y}) scale(${s})" fill="${fill}" d="M-70 0a16 16 0 0 1 14-16 22 22 0 0 1 36-14 28 28 0 0 1 48 2 18 18 0 0 1 28 10 14 14 0 0 1 14 18z"/>`).join('');
  }
  const haze = (P, y, h, c) => rect(0, y, 800, h, P.lin([[0, c, 0], [0.65, c, 0.62], [1, c, 0]]));
  const ground = (P, y, top, bottom) => rect(0, y, 800, 300 - y, vlin(P, top, bottom));
  // A soft light wash from the upper left and a gentle vignette, as on the globe.
  const finish = (P, golden) => rect(0, 0, 800, 300, P.lin([[0, golden ? '#ffd9a0' : '#fff6dc', 0.24], [0.6, '#ffffff', 0]], 1, 0.7))
    + rect(0, 0, 800, 300, P.rad([[0.62, '#0c2240', 0], [1, '#0c2240', 0.2]], 0.5, 0.4, 0.75));

  function treeLine(y, x0, x1, c) {
    let d = `M${x0} ${y + 4}V${y}`;
    for (let x = x0; x < x1; x += 14) d += `q7 ${-7 - ((x * 7) % 6)} 14 0`;
    return `<path d="${d}V${y + 4}z" fill="${c}"/>`;
  }

  function tree(P, x, y, s) {
    const leaf = P.lin([[0, '#9ccd73'], [0.55, '#5f9f52'], [1, '#3b6f40']], 0.7, 1);
    return `<g transform="translate(${x} ${y}) scale(${s})">${shadow(P, 8, 0, 54, 7)}
      <path d="M-5 0c1.6-13 1.6-27-.6-40h11.2c-2.2 13-2.2 27-.6 40z" fill="${P.lin([[0, '#8d6745'], [1, '#5b3d27']], 1, 0)}"/>
      ${stroke('M-2-28c-7-5-14-7-21-6M3-33c6-6 13-8 20-7', '#6b4a31', 3.4)}
      <path d="M-48-50c-6-13 4-27 19-26 3-15 22-22 35-12 13-7 30 1 31 16 13 3 18 18 10 27 3 13-9 22-22 18-8 9-25 9-33 1-13 5-28-1-31-12-9-1-13-7-9-12z" fill="${leaf}"/>
      ${stroke('M-34-64c3-8 11-12 19-10 5-7 14-9 20-4', '#c9e8a6', 5, 0.5)}${stroke('M-42-42c12 7 29 9 44 7 15 2 30-2 40-9', '#2c5a34', 6, 0.28)}</g>`;
  }
  const bush = (P, x, y, s) => `<g transform="translate(${x} ${y}) scale(${s})">${shadow(P, 4, 0, 26, 4)}<path d="M-24 0c-4-8 2-15 10-14 2-8 13-11 19-5 7-4 16 1 16 9 7 2 9 8 5 10z" fill="${P.lin([[0, '#93c66e'], [1, '#4a8247']], 0.6, 1)}"/></g>`;
  const tufts = (c, list) => stroke(list.map(([x, y]) => `M${x} ${y}l2-7m2 7l2-9m2 9l2-6`).join(''), c, 1.6, 0.75);

  // A plastered house with a corrugated metal roof, lit from the left.
  function house(P, x, base, w, h, wall, roof, golden) {
    const top = base - h;
    const rh = 12 + w * 0.1;
    const glass = golden ? vlin(P, '#ffe2a6', '#f0a258') : vlin(P, '#d5ebf8', '#7499bb');
    const frame = shade(wall, 0.72);
    const win = (wx) => `${rect(wx, top + h * 0.26, w * 0.17, h * 0.32, glass, `stroke="${frame}" stroke-width="2"`)}${stroke(`M${wx + w * 0.085} ${top + h * 0.26}v${h * 0.32}`, frame, 1.4)}${rect(wx - 2, top + h * 0.58, w * 0.17 + 4, 3, shade(wall, 0.84))}`;
    const n = Math.floor((w + 14) / 7);
    const ribs = Array.from({ length: n }, (_, i) => {
      const t = (i + 0.5) / n;
      return `M${x - 7 + t * (w + 14)} ${top + 1}L${x + 14 + t * (w - 28)} ${top - rh}`;
    }).join('');
    return `<g>${shadow(P, x + w / 2 + 10, base + 1, w * 0.72, 7)}
      ${rect(x, top, w, h, P.lin([[0, shade(wall, 1.04)], [1, shade(wall, 0.86)]], 1, 0.3))}${rect(x, base - 6, w, 6, shade(wall, 0.78))}${rect(x, top, w, 7, '#1d2733', 'opacity=".14"')}
      ${win(x + w * 0.12)}${win(x + w * 0.71)}${rect(x + w * 0.41, base - h * 0.64, w * 0.18, h * 0.64 - 6, P.lin([[0, '#9a6a45'], [1, '#6b4429']], 1, 0))}
      <path d="M${x - 7} ${top + 1}L${x + 14} ${top - rh}H${x + w - 14}L${x + w + 7} ${top + 1}z" fill="${P.lin([[0, shade(roof, 1.14)], [1, shade(roof, 0.8)]], 1, 0)}"/>
      ${stroke(ribs, shade(roof, 0.66), 0.9, 0.45)}${stroke(`M${x - 7} ${top + 1}H${x + w + 7}`, shade(roof, 0.6), 2)}</g>`;
  }

  // Facade for town and market streets: windows by floor, a cornice and a ground-floor shopfront.
  function building(P, x, base, w, h, wall, o) {
    const opt = o || {};
    const top = base - h;
    const glass = opt.glow ? vlin(P, '#ffe7ad', '#f2aa5c') : vlin(P, '#d6ebf7', '#6f96b9');
    const rows = Math.max(1, Math.floor((h - 50) / 34));
    const cols = Math.max(1, Math.floor((w - 14) / 30));
    const gap = (w - cols * 16) / (cols + 1);
    let wins = '';
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const wx = x + gap + c * (16 + gap);
        const wy = top + 16 + r * 34;
        if (opt.shutters) wins += rect(wx - 5, wy, 4.4, 21, opt.shutters) + rect(wx + 16.6, wy, 4.4, 21, opt.shutters);
        wins += rect(wx, wy, 16, 21, glass, 'rx="1.5"') + rect(wx - 1.5, wy + 21, 19, 2.6, shade(wall, 0.8));
      }
    }
    const balcony = opt.balcony ? `${rect(x + w * 0.2, top + 16 + 34 + 23, w * 0.6, 3, '#4a5266')}${stroke(Array.from({ length: 9 }, (_, i) => `M${x + w * 0.2 + (i + 0.5) * (w * 0.6 / 9)} ${top + 16 + 34 + 23}v-9`).join('') + `M${x + w * 0.2} ${top + 16 + 34 + 14}h${w * 0.6}`, '#4a5266', 1.2)}` : '';
    const awning = opt.awning ? `<path d="M${x + 4} ${base - 44}h${w - 8}l7 12H${x - 3}z" fill="${lit(P, opt.awning, 1.08, 0.82)}"/>` : '';
    return `<g>${rect(x, top, w, h, lit(P, wall, 1.05, 0.86))}${rect(x - 3, top - 6, w + 6, 8, shade(wall, 0.78))}${wins}${balcony}
      ${rect(x, base - 36, w, 36, shade(wall, 0.9))}${rect(x + w * 0.32, base - 30, w * 0.36, 30, opt.glow ? vlin(P, '#ffd894', '#eaa45a') : vlin(P, '#7a6352', '#54433a'))}${rect(x + w * 0.3, base - 33, w * 0.4, 3, shade(wall, 0.74))}${awning}
      ${rect(x + w - 7, top, 7, h, '#1d2733', 'opacity=".08"')}</g>`;
  }

  function lamp(P, x, base, golden) {
    return `<g>${stroke(`M${x} ${base}V${base - 96}M${x} ${base - 96}q0-8 10-8`, '#4a5266', 3)}<path d="M${x + 4} ${base - 106}h12l-2 7h-8z" fill="#4a5266"/>
      ${golden ? `<circle cx="${x + 10}" cy="${base - 96}" r="22" fill="${P.rad([[0, '#fff1c4', 0.9], [1, '#ffcf7a', 0]])}"/>` : ''}<ellipse cx="${x + 10}" cy="${base - 98}" rx="3.6" ry="2.2" fill="${golden ? '#fff1c4' : '#e8eef5'}"/></g>`;
  }

  function shelter(P, x, base, s, tarp) {
    const canvas = P.lin([[0, '#f8f6f0'], [1, '#d6d0c2']], 1, 0.2);
    return `<g transform="translate(${x} ${base}) scale(${s})">${shadow(P, 10, 0, 60, 6)}
      <path d="M0-52L58-48 70 0H46z" fill="#bfb7a6"/><path d="M0-52L46 0H-46z" fill="${canvas}"/>
      <path d="M-13 0L0-30 13 0z" fill="#7d8798"/><path d="M0-30L13 0H7L0-22z" fill="#e7e2d6"/>
      ${tarp ? '<path d="M-31-17L-14-36-2-25-19-6z" fill="#4d86c6" opacity=".92"/>' : ''}${stroke('M-46 0l-12 3M70 0l10 3M0-52v-5', '#9a917f', 1)}</g>`;
  }

  function stall(P, x, base, c) {
    const cream = '#fbf3e4';
    const stripes = Array.from({ length: 8 }, (_, i) => rect(x - 64 + i * 16, base - 106, 16, 26, i % 2 ? cream : c)
      + `<path d="M${x - 64 + i * 16} ${base - 80}a8 7 0 0 0 16 0z" fill="${i % 2 ? cream : c}"/>`).join('');
    const fruit = (cx, cy, col) => [[-8, 0], [0, 0], [8, 0], [-4, -6], [4, -6], [0, -12]]
      .map(([dx, dy]) => `<circle cx="${cx + dx}" cy="${cy + dy}" r="4.6" fill="${P.rad([[0, shade(col, 1.25)], [1, shade(col, 0.82)]], 0.35, 0.3, 0.7)}"/>`).join('');
    return `<g>${shadow(P, x + 8, base + 2, 80, 8)}${stroke(`M${x - 60} ${base}V${base - 84}M${x + 60} ${base}V${base - 84}`, '#7a5a3c', 4)}
      ${stripes}${rect(x - 64, base - 106, 128, 33, P.lin([[0, '#ffffff', 0.18], [1, '#1d2733', 0.18]], 1, 0.4))}
      ${rect(x - 58, base - 46, 116, 7, '#b98b5c', 'rx="2"')}${rect(x - 56, base - 39, 112, 34, lit(P, shade(c, 0.9), 1.05, 0.8))}
      ${fruit(x - 36, base - 51, '#f08a2c')}${fruit(x - 8, base - 51, '#d9452f')}${fruit(x + 22, base - 51, '#7ab648')}
      <path d="M${x + 36} ${base - 47}h18l-3 7h-12z" fill="#c99a5e"/></g>`;
  }

  // ---------- props ----------
  function pump(P) {
    const can = (x, y, s) => `<g transform="translate(${x} ${y}) scale(${s})">${shadow(P, 2, 0, 13, 2.6)}
      <path d="M-8-22h16c1.7 0 3 1.3 3 3V-2c0 1.1-.9 2-2 2H-9c-1.1 0-2-.9-2-2v-17c0-1.7 1.3-3 3-3z" fill="${P.lin([[0, '#f7d257'], [1, '#d39a12']], 1, 0.4)}"/>
      ${stroke('M-5-22v-4h7v4', '#c18c10', 2.2)}${rect(4, -25, 4, 3, '#2f6fd0', 'rx="1"')}${stroke('M-8-14h16', '#c18c10', 1, 0.6)}</g>`;
    return `<g>${shadow(P, 386, 266, 70, 9)}<ellipse cx="380" cy="262" rx="52" ry="9.5" fill="${vlin(P, '#dfdbd2', '#b4afa3')}"/><ellipse cx="380" cy="260" rx="45" ry="7" fill="${vlin(P, '#c7c2b7', '#e4e0d8')}"/>
      ${rect(373, 204, 14, 56, P.lin([[0, '#5aa1df'], [1, '#22578f']], 1, 0), 'rx="3"')}${rect(370, 199, 20, 8, '#2d6aa6', 'rx="3"')}
      ${stroke('M387 210L424 190', '#3a4150', 4)}<circle cx="387" cy="210" r="3" fill="#3a4150"/>${stroke('M373 232h-14v8', '#2d6aa6', 6)}
      ${can(338, 262, 1)}${can(420, 262, 0.95)}${can(436, 267, 0.9)}</g>`;
  }

  function signpost(P) {
    const board = (d, c) => `<path d="${d}" fill="${lit(P, c, 1.1, 0.85)}"/>`;
    return `<g>${shadow(P, 370, 266, 26, 4)}${rect(360, 150, 9, 116, P.lin([[0, '#9a714c'], [1, '#6a4a30']], 1, 0), 'rx="2"')}
      ${board('M369 160h62l12 11-12 11h-62z', '#2f6aa6')}${stroke('M378 171h40', '#e8f0f8', 2.4, 0.9)}
      ${board('M360 192h-62l-12 11 12 11h62z', '#2f7d5b')}${stroke('M296 203h32', '#e8f2ec', 2.4, 0.9)}
      ${rect(330, 195, 26, 16, '#e8e2d4', 'rx="2" opacity=".95"')}${stroke('M335 203h16', '#8d8577', 2, 0.8)}</g>`;
  }

  function track(P) {
    return `<path d="M250 300C320 266 412 236 494 210H512C452 238 420 266 470 300z" fill="${vlin(P, '#d9bd8e', '#bf9862')}"/>
      ${stroke('M318 300C372 268 440 238 499 211M432 300C418 270 446 240 507 211', '#a9844f', 2.2, 0.4)}`;
  }

  function lanterns(P, golden) {
    const glow = P.rad([[0, '#fff3c4', 0.95], [0.4, '#ffd27a', 0.45], [1, '#ffb45c', 0]]);
    const pts = [60, 150, 240, 330, 420, 510, 600, 690, 760].map((x) => [x, 78 + Math.sin(x / 127) * 10 + (x > 400 ? (800 - x) * 0.03 : x * 0.03)]);
    return `${stroke(`M0 70${pts.map(([x, y]) => `L${x} ${y}`).join('')}L800 72`, '#4a3f3a', 1.2)}
      ${pts.map(([x, y], i) => `${golden ? `<circle cx="${x}" cy="${y + 9}" r="18" fill="${glow}"/>` : ''}${stroke(`M${x} ${y}v3`, '#4a3f3a', 1)}<rect x="${x - 5}" y="${y + 3}" width="10" height="13" rx="4" fill="${['#ffd27a', '#ff9f6b', '#ffe6a3'][i % 3]}"/>`).join('')}`;
  }

  // A radio mast on a rooftop: rumors and radio travel together.
  function radioMast(x, base, top) {
    const n = 4;
    const seg = (base - top) / n;
    const half = (i) => 8 * (1 - i / n) + 1;
    const lattice = Array.from({ length: n }, (_, i) => `M${x - half(i)} ${base - i * seg}L${x + half(i + 1)} ${base - (i + 1) * seg}M${x + half(i)} ${base - i * seg}L${x - half(i + 1)} ${base - (i + 1) * seg}`).join('');
    return `<g>${stroke(`M${x - 9} ${base}L${x} ${top}L${x + 9} ${base}`, '#7d8597', 1.8)}${stroke(lattice, '#7d8597', 0.8, 0.8)}<circle cx="${x}" cy="${top - 2}" r="2.8" fill="#e85a4f"/>
      ${stroke(`M${x + 8} ${top - 8}q6 6 0 12M${x + 13} ${top - 13}q11 11 0 22`, '#e85a4f', 1.4, 0.8)}</g>`;
  }

  // A civic building with a portico: columns stand out against the shaded wall behind them.
  function civic(P, golden) {
    const column = P.lin([[0, '#fffaf2'], [0.45, '#efe5d4'], [1, '#c9bba3']], 1, 0);
    return `<g>${shadow(P, 368, 226, 130, 7)}${rect(262, 104, 196, 120, lit(P, '#f1e7d6', 1.04, 0.88))}${rect(270, 118, 180, 98, vlin(P, '#cdbfa6', '#b5a58a'))}
      ${rect(348, 156, 24, 60, golden ? vlin(P, '#ffd894', '#e9a55a') : vlin(P, '#6b5242', '#4a382c'), 'rx="2"')}
      ${[276, 308, 340, 380, 412, 444].map((x) => rect(x - 6, 116, 12, 100, column) + rect(x - 8.5, 112, 17, 5, '#e3d7c2') + rect(x - 8.5, 213, 17, 4, '#d8ccb6')).join('')}
      <path d="M250 106L360 62 470 106z" fill="${lit(P, '#e7dbc6', 1.06, 0.84)}"/><path d="M274 101L360 70 446 101z" fill="${vlin(P, '#d9ccb4', '#c9bba2')}"/>
      ${rect(250, 104, 220, 8, '#d8ccb6')}${rect(256, 216, 208, 6, '#dcd0bc')}${rect(248, 221, 224, 5, '#cfc3ad')}${rect(240, 225, 240, 4, '#c3b7a0')}</g>`;
  }

  // The needs-assessment desk: a shade canopy over a table with forms and a clipboard.
  function canopy(P, x, base) {
    return `<g>${shadow(P, x + 6, base, 92, 8)}${stroke(`M${x - 70} ${base}V${base - 64}M${x + 70} ${base}V${base - 64}`, '#8a93a3', 3)}
      <path d="M${x - 84} ${base - 62}L${x - 44} ${base - 92}H${x + 44}L${x + 84} ${base - 62}z" fill="${P.lin([[0, '#ffffff'], [1, '#d8dde5']], 1, 0.4)}"/>${rect(x - 84, base - 62, 168, 8, '#2f80c4')}
      ${rect(x - 52, base - 30, 104, 6, '#e9edf2', 'rx="2"')}${stroke(`M${x - 46} ${base - 24}v24M${x + 46} ${base - 24}v24`, '#8a93a3', 2.4)}
      ${rect(x - 38, base - 36, 22, 6, '#ffffff')}${rect(x + 2, base - 38, 14, 8, '#b88a55', 'rx="1"')}${rect(x + 4, base - 40, 10, 6, '#ffffff')}
      ${[x - 30, x + 26].map((cx) => `<path d="M${cx - 8} ${base - 22}h16v-16h-16zM${cx - 8} ${base - 22}v22M${cx + 8} ${base - 22}v22" fill="#3f86c9" stroke="#2f6aa6" stroke-width="1.4" opacity=".9"/>`).join('')}</g>`;
  }

  const PROPS = { pump, signpost, track, lanterns };

  // ---------- settings ----------
  const BACKDROPS = {
    village: (P, g) => sky(P, g) + clouds(P, g, [[200, 106, 0.9], [470, 86, 0.7]])
      + `<path d="M0 204C80 186 150 180 230 190S370 178 450 188 600 172 690 184 770 182 800 188V230H0z" fill="${vlin(P, '#a3c3ac', '#c5dac2')}"/>`
      + treeLine(206, 0, 800, '#8fb38a') + haze(P, 170, 50, horizon(g)) + ground(P, 205, '#e5cd9a', '#c39a62')
      + `<path d="M300 300C330 268 380 250 440 238S540 224 600 220" fill="none" stroke="${vlin(P, '#efdcb4', '#dcc193')}" stroke-width="36" stroke-linecap="round" opacity=".7"/>`
      + house(P, 150, 232, 96, 54, '#efdcbf', '#9aa7b3', g) + house(P, 276, 224, 74, 44, '#e7d0af', '#a7b1bb', g) + house(P, 556, 230, 108, 58, '#f2e4cb', '#8d9aa6', g)
      + tree(P, 488, 236, 0.92) + bush(P, 250, 244, 1) + bush(P, 690, 246, 1.1)
      + tufts('#86a95a', [[160, 282], [262, 290], [520, 286], [620, 294], [700, 280]]),

    camp: (P, g) => sky(P, g) + clouds(P, g, [[230, 100, 0.85], [520, 82, 0.65]])
      + `<path d="M0 200C90 182 170 184 260 194S420 178 520 190 690 176 800 190V230H0z" fill="${vlin(P, '#d4bfa0', '#e3d3ba')}"/>`
      + haze(P, 166, 54, horizon(g)) + ground(P, 204, '#e8d5ae', '#cdb081')
      + [150, 214, 278, 450, 520, 600, 676].map((x) => shelter(P, x, 214, 0.42, x === 520)).join('')
      + shelter(P, 168, 238, 0.74, false) + shelter(P, 470, 234, 0.66, true) + canopy(P, 330, 250)
      + `<g>${shadow(P, 588, 250, 46, 6)}${stroke('M562 250l4-34M614 250l-4-34M564 234h48', '#7c8494', 3)}
        ${rect(556, 158, 64, 58, P.lin([[0, '#5aa0dc'], [1, '#235d96']], 1, 0), 'rx="6"')}<ellipse cx="588" cy="158" rx="32" ry="7" fill="#83bbea"/>
        ${stroke('M556 178h64M556 196h64', '#1f4f80', 1.4, 0.35)}${stroke('M606 216v10h6', '#9aa3b5', 2.4)}</g>`
      + stroke('M740 252V214M770 254V214M800 256V214M740 222L800 224M740 236L800 238', '#8a6b45', 2.6)
      + tufts('#a8a065', [[150, 284], [280, 292], [600, 288], [700, 296]]),

    market: (P, g) => sky(P, g) + clouds(P, g, [[200, 70, 0.8]])
      + building(P, 0, 226, 150, 148, '#e8cda6', { shutters: '#3f8f9a' }) + building(P, 150, 226, 170, 120, '#dcb894', { balcony: true, awning: '#c2603f' })
      + building(P, 320, 226, 150, 156, '#efdcc2', { shutters: '#4d6fa8' }) + building(P, 470, 226, 160, 124, '#d8b48c', { awning: '#3f8f9a' })
      + building(P, 630, 226, 170, 150, '#e6d3b8', { shutters: '#a65d3f', balcony: true }) + radioMast(560, 97, 50)
      + stroke('M0 86Q200 104 400 92T800 86', '#5b4a3e', 1.2)
      + Array.from({ length: 20 }, (_, i) => { const x = 20 + i * 40; const y = 86 + Math.sin((x / 800) * Math.PI * 2) * 6 + 6; return `<path d="M${x - 7} ${y}h14l-7 13z" fill="${['#d9534f', '#f0ad4e', '#3f8f9a', '#4d6fa8', '#7ab648'][i % 5]}"/>`; }).join('')
      + ground(P, 226, '#e9d8bb', '#cbb18a') + stroke(Array.from({ length: 12 }, (_, i) => `M${i * 72 - 40} 300L${i * 66 + 34} 226`).join(''), '#bda47d', 1, 0.35)
      + stall(P, 230, 262, '#c2603f') + stall(P, 420, 258, '#3f8f9a') + stall(P, 620, 262, '#d39a2b'),

    town: (P, g) => sky(P, g) + clouds(P, g, [[220, 96, 0.8], [560, 80, 0.65]])
      + building(P, 0, 224, 140, 132, '#e9d6b9', { glow: g }) + building(P, 140, 224, 120, 104, '#d6e0ea', { glow: g, balcony: true })
      + civic(P, g)
      + building(P, 470, 224, 150, 140, '#f0dcc4', { glow: g, shutters: '#5a7fa8' }) + building(P, 620, 224, 180, 116, '#dfe8d8', { glow: g, balcony: true, awning: '#4d6fa8' })
      + ground(P, 224, '#dcd6cc', '#bfb7aa') + rect(0, 224, 800, 5, '#cfc7ba')
      + stroke(Array.from({ length: 14 }, (_, i) => `M${i * 70 - 60} 300L${i * 62 + 4} 229`).join('') + 'M0 252H800M0 274H800', '#b3ab9e', 1, 0.4)
      + tree(P, 120, 246, 0.62) + tree(P, 700, 248, 0.66) + lamp(P, 236, 248, g) + lamp(P, 560, 248, g),

    fields: (P, g) => sky(P, g) + clouds(P, g, [[200, 100, 0.85], [600, 78, 0.75]])
      + `<path d="M0 190L60 170 120 182 190 150 260 176 330 160 410 184 480 156 560 178 640 152 720 172 800 160V215H0z" fill="${vlin(P, '#9fb6cf', '#c7d7e6')}"/>`
      + haze(P, 150, 62, horizon(g))
      + `<path d="M0 206C100 192 200 198 300 202S500 190 600 198 750 192 800 196V222H0z" fill="${vlin(P, '#a7cc89', '#b9d79c')}"/>`
      + Array.from({ length: 11 }, (_, i) => tree(P, 150 + i * 19, 212 - (i % 2), 0.2)).join('')
      + house(P, 600, 212, 58, 26, '#f3e6d2', '#b5533c', g)
      + (() => {
        const vx = 430; const vy = 120; let quads = '';
        for (let i = 0; i < 24; i += 1) {
          const xb0 = -400 + i * 70; const xb1 = xb0 + 70;
          const at = (xb, y) => vx + (xb - vx) * ((y - vy) / (300 - vy));
          const col = xb0 < 380 ? (i % 2 ? '#8fc463' : '#7ab14f') : (i % 2 ? '#e8cf74' : '#dcbd5c');
          quads += `<path d="M${at(xb0, 212)} 212L${at(xb1, 212)} 212L${xb1} 300L${xb0} 300z" fill="${col}"/>`;
        }
        return quads + rect(0, 212, 800, 88, P.lin([[0, '#ffffff', 0.25], [0.5, '#ffffff', 0], [1, '#1d2733', 0.12]]));
      })()
      + tree(P, 120, 232, 0.8) + tree(P, 560, 226, 0.6)
      + stroke('M600 250V222M640 252V222M680 254V222M720 256V222M760 258V222M800 260V222M600 230L800 232M600 242L800 246', '#8a6b45', 2.2)
      + tufts('#5f9e42', [[150, 286], [300, 294], [620, 290], [720, 282]]),

    office: (P, g) => rect(0, 0, 800, 230, vlin(P, '#f2f5f8', '#dde4eb'))
      + `<g>${rect(96, 64, 308, 132, vlin(P, g ? '#f2b98b' : '#7fbbe9', g ? '#fde5c3' : '#e3f2fc'))}
        <path d="M96 168C150 154 200 160 250 164S350 152 404 160V196H96z" fill="${vlin(P, '#9fc3a8', '#b9d4be')}"/>
        ${[[118, 34], [146, 50], [176, 28], [214, 44], [246, 36], [280, 56], [316, 30], [350, 46], [380, 38]].map(([x, h]) => rect(x, 196 - h, 24, h, '#a9b9cc', 'opacity=".75"')).join('')}
        <path d="M150 64L210 64 120 196H96V140zM260 64h40L210 196h-40z" fill="#ffffff" opacity=".18"/>
        ${rect(91, 59, 318, 142, 'none', 'stroke="#c8d2dd" stroke-width="2"')}${rect(96, 64, 308, 132, 'none', 'stroke="#f9fbfc" stroke-width="8"')}${stroke('M199 64v132M301 64v132M96 130h308', '#eef2f5', 5)}${rect(88, 196, 324, 8, vlin(P, '#ffffff', '#cfd7e0'), 'rx="2"')}</g>`
      + `<g>${rect(450, 80, 194, 96, '#cdd5df', 'rx="4"')}${rect(456, 86, 182, 84, '#fdfefe')}
        ${stroke('M472 104h56M472 116h40M472 128h48', '#7aa7d8', 3)}${rect(548, 98, 26, 18, 'none', 'stroke="#2f80c4" stroke-width="2" rx="3"')}${stroke('M574 107h16', '#2f80c4', 2)}${rect(590, 98, 26, 18, 'none', 'stroke="#2f80c4" stroke-width="2" rx="3"')}
        ${rect(560, 132, 16, 16, '#ffe08a', 'transform="rotate(-4 568 140)"')}${rect(582, 134, 16, 16, '#a9d4ff', 'transform="rotate(3 590 142)"')}${rect(604, 131, 16, 16, '#ffc2d1', 'transform="rotate(-2 612 139)"')}
        ${rect(500, 170, 90, 5, '#9aa3b5', 'rx="2"')}</g>`
      + `<g><circle cx="706" cy="98" r="17" fill="#ffffff" stroke="#4a5266" stroke-width="3"/>${stroke('M706 98V87M706 98l8 5', '#4a5266', 2)}</g>`
      + `<g>${shadow(P, 712, 232, 56, 5)}${rect(664, 150, 96, 80, lit(P, '#c9b08d', 1.06, 0.86), 'rx="3"')}${rect(670, 156, 84, 34, '#e9dfcf')}
        ${['#2f80c4', '#e2735f', '#3faa86', '#e6b13e', '#8268cc', '#2f80c4'].map((c, i) => rect(674 + i * 12, 160 + (i % 2) * 3, 9, 30 - (i % 2) * 3, c, 'rx="1"')).join('')}${stroke('M712 196v28', '#a88f6c', 1.6)}</g>`
      + rect(0, 226, 800, 5, '#cfd6de') + rect(0, 230, 800, 70, vlin(P, '#dcc4a2', '#b48f64'))
      + stroke(Array.from({ length: 21 }, (_, i) => `M${400 + (i - 10) * 52} 230L${400 + (i - 10) * 92} 300`).join(''), '#a9845a', 1, 0.35)
      + '<path d="M118 232L412 232 520 300H170z" fill="#ffffff" opacity=".14"/>'
      + `<g>${shadow(P, 404, 248, 190, 9)}${['290', '400', '510'].map((x) => rect(Number(x) - 16, 196, 32, 30, '#3d4658', 'rx="6"')).join('')}
        <path d="M250 224H550L572 238H228z" fill="${P.lin([[0, '#e2c9a4'], [1, '#c4a27a']], 1, 0)}"/>${rect(228, 238, 344, 6, '#a98a64')}${stroke('M244 244v14M556 244v14', '#6b5640', 3)}
        <path d="M286 222h30l-3-14h-24z" fill="#4a5266"/><path d="M428 222h30l-3-14h-24z" fill="#4a5266"/>${rect(350, 226, 26, 7, '#ffffff', 'transform="rotate(-6 363 229)"')}${rect(486, 223, 9, 9, '#ffffff', 'rx="1"')}${rect(504, 225, 22, 6, '#ffffff')}</g>`
      + `<g transform="translate(60 268)">${shadow(P, 0, 0, 24, 4)}
        ${[-38, -18, 0, 20, 40].map((a, i) => `<path transform="rotate(${a})" d="M0-22c-9-10-12-26-6-${50 - (i % 2) * 8} 8 10 11 26 6 ${50 - (i % 2) * 8}z" fill="${P.lin([[0, '#7cc08a'], [1, '#2f7a52']], 1, 1)}"/>`).join('')}
        <path d="M-15 0h30l-4-24h-22z" fill="${lit(P, '#d9765c')}"/>${rect(-16, -26, 32, 4, '#c4654d', 'rx="1.5"')}</g>`
  };

  function backdrop(theme, prop, skyKind) {
    const P = painter();
    const golden = skyKind === 'golden';
    const draw = BACKDROPS[theme] || BACKDROPS.village;
    const body = draw(P, golden) + (prop === 'lanterns' ? lanterns(P, golden) : prop && PROPS[prop] ? PROPS[prop](P) : '')
      + (theme === 'office' ? '' : finish(P, golden));
    return `<svg class="stage-bg" viewBox="0 0 800 300" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">${P.defs()}${body}</svg>`;
  }

  // ---------- medals ----------
  const METAL = { gold: ['#ffe58a', '#f2b632', '#b47a10'], silver: ['#f4f6fa', '#c3cad6', '#7d8697'], bronze: ['#f6c39a', '#d08a52', '#8a4f22'] };
  function medal(tier, size, label) {
    const [hi, mid, lo] = METAL[tier] || METAL.gold;
    const id = `med${uid += 1}`;
    return `<svg class="medal-icon medal-${tier}" viewBox="0 0 64 80" width="${size}" height="${Math.round(size * 1.25)}" ${label ? `role="img" aria-label="${esc(label)}"` : 'aria-hidden="true"'} focusable="false">
      <defs><radialGradient id="${id}" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="${hi}"/><stop offset=".6" stop-color="${mid}"/><stop offset="1" stop-color="${lo}"/></radialGradient>
      <linearGradient id="${id}r" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#4f9be0"/><stop offset="1" stop-color="#1f5f9e"/></linearGradient></defs>
      <path d="M18 0h12l6 22h-12zM34 0h12l-6 22h-12z" fill="url(#${id}r)"/><path d="M24 22h16" stroke="#173f6b" stroke-width="2" opacity=".35"/>
      <circle cx="32" cy="48" r="26" fill="url(#${id})" stroke="${lo}" stroke-width="1.6"/><circle cx="32" cy="48" r="19.5" fill="none" stroke="${lo}" stroke-width="1.6" opacity=".5"/>
      <path d="M32 34l4.1 8.4 9.3 1.3-6.7 6.5 1.6 9.2-8.3-4.4-8.3 4.4 1.6-9.2-6.7-6.5 9.3-1.3z" fill="#fff" fill-opacity=".9" stroke="${lo}" stroke-width="1" stroke-opacity=".6"/>
      <path d="M14 38a20 20 0 0 1 14-12" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".45"/></svg>`;
  }


  // ---------- stage ----------
  // actors: [{ id, name, spec, x (percent), look, mood, anim }]; bubbles: [{ side: 'left' | 'right' | 'think', who, text, x }]
  function stage(o) {
    // The scene as data, so the 3D view (js/world3d.js) can attach to it or keep its live scene.
    const cfg = { theme: o.theme || 'village', prop: o.prop || '', sky: o.sky || '', actors: (o.actors || []).map(({ id, spec, mood, anim }) => ({ id, spec, mood: mood || '', anim: anim || '' })),
      bubbles: (o.bubbles || []).map(({ side, text }) => ({ side, text })) };
    const live = window.World3D && World3D.isLive(cfg) ? ' is-3d' : '';
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
      <figure class="stage theme-${esc(o.theme || 'village')}${o.sky ? ` sky-${esc(o.sky)}` : ''}${live}" id="stage" data-scene="${esc(JSON.stringify(cfg))}">
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
    strong: ['Strong approach.', 'Well reasoned. This keeps the people most affected in view.', 'Sound judgment. Everyone affected is heard.'],
    partial: ['Partly effective. What else could you check?', 'A reasonable start. Who might still be left out?', 'Some merit, but something important is missing.'],
    weak: ["Let's reconsider this one.", 'A mental shortcut may be shaping this choice.', 'Pause and ask whose view is missing here.']
  };
  function reaction(rating, i) {
    const list = REACTIONS[rating] || REACTIONS.partial;
    return list[i % list.length];
  }

  // A small strip where the mentor offers a practical tip.
  function mentorTip(text) {
    return `
      <div class="mentor-tip">
        <span class="mentor-head" aria-hidden="true"><img src="img/mentor-rio.png" alt="" width="52" height="52" loading="lazy"></span>
        <p class="tip-bubble mb-0"><strong>${esc(MENTOR.name)}:</strong> ${esc(text)}</p>
      </div>`;
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-tip]').forEach((el) => { el.innerHTML = mentorTip(el.dataset.tip); });
  });

  // Upgrades each story stage to 3D when the page includes js/world3d.js and WebGL is available.
  const upgraded = new WeakSet();
  function upgrade() {
    if (!window.World3D) return;
    document.querySelectorAll('.stage[data-scene]').forEach((el) => {
      if (upgraded.has(el)) return;
      upgraded.add(el);
      World3D.attachStage(el, JSON.parse(el.dataset.scene));
    });
  }
  new MutationObserver(upgrade).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('DOMContentLoaded', upgrade);

  window.Scenes = { stage, backdrop, medal, reaction, mentorTip, MENTOR };
})();
