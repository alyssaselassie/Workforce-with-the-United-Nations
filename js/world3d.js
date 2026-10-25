// 3D characters in the group's glossy "clay toy" style, built with Three.js (WebGL): big round heads,
// shiny bead eyes, rosy cheeks, chunky glossy hair, pastel hoodies and mitten hands, in soft studio light.
// Three.js loads only when a 3D view is needed. Without WebGL, the drawn SVG art in avatar.js and scenes.js stays.
(function () {
  'use strict';
  const LIB = 'https://cdn.jsdelivr.net/npm/three@0.158.0/build/three.min.js';
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let T = null;
  let loading = null;

  function webgl() {
    try {
      const c = document.createElement('canvas');
      return Boolean(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
    } catch (e) {
      return false;
    }
  }

  // Loads Three.js once. Rejects when WebGL or the library is unavailable, so callers keep the SVG art.
  function load() {
    if (!loading) {
      loading = new Promise((resolve, reject) => {
        const done = () => {
          T = window.THREE || null;
          if (T) resolve(T);
          else reject(new Error('Three.js did not load'));
        };
        if (!webgl()) {
          reject(new Error('WebGL is not available'));
        } else if (window.THREE) {
          done();
        } else {
          const s = document.createElement('script');
          s.src = LIB;
          s.onload = done;
          s.onerror = () => reject(new Error('Three.js did not load'));
          document.head.appendChild(s);
        }
      });
    }
    return loading;
  }

  // ---------- helpers ----------
  const cache = new Map();
  const G = (key, make) => {
    if (!cache.has(key)) cache.set(key, make());
    return cache.get(key);
  };
  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    const c = (v) => Math.max(0, Math.min(255, Math.round(v * f))).toString(16).padStart(2, '0');
    return `#${c(n >> 16)}${c((n >> 8) & 255)}${c(n & 255)}`;
  }
  const lerp = (a, b, t) => a + (b - a) * t;
  function mix(a, b, t) {
    const pa = parseInt(a.slice(1), 16);
    const pb = parseInt(b.slice(1), 16);
    const c = (sh) => Math.round(lerp((pa >> sh) & 255, (pb >> sh) & 255, t)).toString(16).padStart(2, '0');
    return `#${c(16)}${c(8)}${c(0)}`;
  }
  // Richer color for the clay look, from the same palette the drawn avatars use.
  function vivid(hex, ks, kl) {
    const c = new T.Color(hex);
    const h = {};
    c.getHSL(h);
    c.setHSL(h.h, Math.min(1, h.s * ks), Math.min(0.97, h.l * (kl || 1)));
    return `#${c.getHexString()}`;
  }
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  // Overshoots a little and settles, for pops.
  const back = (t) => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2);
  const damp = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
  const smooth = (e0, e1, x) => {
    const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
    return t * t * (3 - 2 * t);
  };
  function place(o, at) {
    if (!at) return o;
    if (at.p) o.position.set(at.p[0], at.p[1], at.p[2]);
    if (at.r) o.rotation.set(at.r[0], at.r[1], at.r[2]);
    if (at.s != null) {
      if (Array.isArray(at.s)) o.scale.set(at.s[0], at.s[1], at.s[2]);
      else o.scale.setScalar(at.s);
    }
    return o;
  }
  function mesh(geo, mat, at, cast) {
    const m = new T.Mesh(geo, mat);
    m.castShadow = Boolean(cast);
    m.receiveShadow = true;
    return place(m, at);
  }
  function group(at, kids) {
    const g = new T.Group();
    (kids || []).forEach((k) => k && g.add(k));
    return place(g, at);
  }
  const V3 = (x, y, z) => new T.Vector3(x || 0, y || 0, z || 0);
  const ball = () => G('ball', () => new T.SphereGeometry(1, 32, 24));
  const dot = () => G('dot', () => new T.SphereGeometry(1, 16, 12));
  function taper(g, bottom, top) {
    g.computeBoundingBox();
    const { min, max } = g.boundingBox;
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i += 1) {
      const k = lerp(bottom, top, (p.getY(i) - min.y) / (max.y - min.y || 1));
      p.setX(i, p.getX(i) * k);
      p.setZ(i, p.getZ(i) * k);
    }
    g.computeVertexNormals();
    return g;
  }
  const capsule = (r, len, bottom, top) => taper(new T.CapsuleGeometry(r, len, 12, 28), bottom == null ? 1 : bottom, top == null ? 1 : top);
  const tubeGeo = (pts, r, segs) => new T.TubeGeometry(new T.CatmullRomCurve3(pts.map(([x, y, z]) => V3(x, y, z))), segs || 24, r, 10, false);
  function roundRect(sh, w, h, r) {
    sh.moveTo(-w / 2 + r, -h / 2);
    sh.lineTo(w / 2 - r, -h / 2);
    sh.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
    sh.lineTo(w / 2, h / 2 - r);
    sh.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
    sh.lineTo(-w / 2 + r, h / 2);
    sh.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
    sh.lineTo(-w / 2, -h / 2 + r);
    sh.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
    return sh;
  }
  function roundBox(w, h, d, r) {
    const depth = Math.max(0.001, d - 2 * r);
    const ir = Math.min(r, (w - 2 * r) / 2, (h - 2 * r) / 2) * 0.9;
    const g = new T.ExtrudeGeometry(roundRect(new T.Shape(), w - 2 * r, h - 2 * r, ir), { depth, bevelEnabled: true, bevelThickness: r, bevelSize: r * 0.98, bevelSegments: 5, curveSegments: 6 });
    g.translate(0, 0, -depth / 2);
    return g;
  }
  function canvasTex(key, w, h, draw) {
    return G(`tex:${key}`, () => {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      draw(c.getContext('2d'), w, h);
      const t = new T.CanvasTexture(c);
      t.colorSpace = T.SRGBColorSpace;
      return t;
    });
  }

  // ---------- clay materials ----------
  // Soft plastic: satin skin and cloth, and a glossy coat on hair, eyes and shoes.
  function clay(color, kind) {
    return G(`mat:${kind || 'cloth'}:${color}`, () => {
      const o = { color, envMapIntensity: 0.45 };
      if (kind === 'hair') return new T.MeshPhysicalMaterial(Object.assign(o, { roughness: 0.38, clearcoat: 0.6, clearcoatRoughness: 0.22 }));
      if (kind === 'gloss') return new T.MeshPhysicalMaterial(Object.assign(o, { roughness: 0.14, clearcoat: 1, clearcoatRoughness: 0.05 }));
      if (kind === 'metal') Object.assign(o, { roughness: 0.25, metalness: 0.85 });
      else Object.assign(o, { roughness: kind === 'skin' ? 0.46 : 0.7 });
      return new T.MeshStandardMaterial(o);
    });
  }
  const flat = (color) => G(`mat:flat:${color}`, () => new T.MeshBasicMaterial({ color }));

  // A soft studio, reflected in the glossy coats.
  const envs = new WeakMap();
  function studio(renderer) {
    if (!envs.has(renderer)) {
      const pm = new T.PMREMGenerator(renderer);
      const env = new T.Scene();
      env.background = new T.Color('#e9ecf5');
      const panel = (w, h, color, x, y, z) => {
        const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color, side: T.DoubleSide }));
        m.position.set(x, y, z);
        m.lookAt(0, 0, 0);
        env.add(m);
      };
      panel(7, 5, '#ffffff', -4, 5, 5);
      panel(5, 4, '#fff0f6', 6, 2, 3);
      panel(7, 3, '#e4ecff', 0, 4, -6);
      panel(24, 24, '#f4effc', 0, -7, 0);
      envs.set(renderer, pm.fromScene(env, 0.04).texture);
      pm.dispose();
    }
    return envs.get(renderer);
  }

  // ---------- the body ----------
  // The hoodie's profile as [radius, height] from hem to collar; front to back it is flattened to 0.82.
  const BODY = [[0.0, -0.03], [0.17, -0.025], [0.214, 0.02], [0.232, 0.11], [0.236, 0.21], [0.224, 0.29], [0.193, 0.355], [0.135, 0.392], [0.07, 0.408], [0.0, 0.412]];
  function bodyR(y) {
    for (let i = 1; i < BODY.length; i += 1) {
      if (y <= BODY[i][1]) return lerp(BODY[i - 1][0], BODY[i][0], Math.max(0, (y - BODY[i - 1][1]) / (BODY[i][1] - BODY[i - 1][1])));
    }
    return 0;
  }
  const frontZ = (x, y, k) => 0.82 * Math.sqrt(Math.max(0, Math.pow(bodyR(y) * (k || 1), 2) - x * x));
  const UPPER = 0.17;
  const FORE = 0.205;

  // ---------- the head ----------
  const HEAD = { a: 0.3, b: 0.285, c: 0.29 };
  // Round, with slightly full cheeks and a soft chin.
  const chinK = (uy) => (uy < -0.3 ? 1 - 0.13 * Math.pow((-uy - 0.3) / 0.7, 1.4) : 1);
  const cheekK = (uy) => 1 + 0.045 * Math.exp(-Math.pow((uy + 0.28) / 0.24, 2));
  function headPoint(ux, uy, uz, k) {
    const ch = chinK(uy);
    return [ux * HEAD.a * ch * cheekK(uy) * k, uy * HEAD.b * k, uz * HEAD.c * ch * k];
  }
  function surface(x, y) {
    const uy = y / HEAD.b;
    const ch = chinK(uy);
    const ux = x / (HEAD.a * ch * cheekK(uy));
    return HEAD.c * ch * Math.sqrt(Math.max(0, 1 - ux * ux - uy * uy));
  }
  // A group on the face at (x, y), turned to follow the curve of the head.
  function onFace(x, y, lift, kids) {
    const z = surface(x, y);
    const g = group({ p: [x, y, z + (lift || 0)] }, kids);
    g.rotation.order = 'YXZ';
    g.rotation.y = Math.atan2(x, z) * 0.85;
    g.rotation.x = -Math.atan2(y, Math.hypot(x, z)) * 0.85;
    return g;
  }
  const headGeo = () => G('head', () => {
    const g = new T.SphereGeometry(1, 56, 42);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i += 1) {
      const [x, y, z] = headPoint(p.getX(i), p.getY(i), p.getZ(i), 1);
      p.setXYZ(i, x, y, z);
    }
    g.computeVertexNormals();
    return g;
  });
  // A shell around the head (hair, head coverings, beards): keep() gives the scale at each point;
  // 0.9 or less tucks that part under the skin, so edges blend smoothly.
  function shell(key, keep, fine) {
    return G(key, () => {
      const g = fine ? new T.SphereGeometry(1, 96, 72) : new T.SphereGeometry(1, 72, 54);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i += 1) {
        const [x, y, z] = headPoint(p.getX(i), p.getY(i), p.getZ(i), keep(p.getX(i), p.getY(i), p.getZ(i)));
        p.setXYZ(i, x, y, z);
      }
      g.computeVertexNormals();
      return g;
    });
  }
  const cover = (c, thick) => lerp(0.9, thick, c);
  const hairline = (uz, lift) => 0.5 * uz - 0.05 * uz * uz + (lift || 0);
  // Curly hair as one soft cloud: rounded lobes spread over the scalp that merge without gaps.
  const LOBES = (() => {
    const list = [];
    for (let i = 0; i < 44; i += 1) {
      const uy = 1 - (2 * (i + 0.5)) / 44;
      const r = Math.sqrt(1 - uy * uy);
      const a = i * 2.39996 + 0.4;
      const uz = Math.sin(a) * r;
      if (uy > hairline(uz, -0.06) - 0.1) list.push([Math.cos(a) * r, uy, uz]);
    }
    return list;
  })();
  function lobed(ux, uy, uz) {
    let acc = 0;
    LOBES.forEach(([x, y, z]) => {
      acc += Math.exp((-4 * (1 - (ux * x + uy * y + uz * z))) / 0.03);
    });
    return Math.pow(acc, 0.25);
  }
  // Bends a flat shape onto the curve of the head (radius about 0.3).
  function bend(g, lift) {
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i += 1) {
      const x = p.getX(i);
      const y = p.getY(i);
      p.setZ(i, p.getZ(i) - (x * x + y * y) / 0.6 + lift);
    }
    g.computeVertexNormals();
    return g;
  }
  const faceTube = (pts, r) => tubeGeo(pts.map(([x, y]) => [x, y, -(x * x + y * y) / 0.6 + 0.004]), r, 20);

  // ---------- figures ----------
  // A chibi figure about 1.35 units tall (the head is nearly half of it), rigged at the hips, chest,
  // neck, shoulders and elbows. spec uses the same options as the avatar creator.
  function figure(spec, opts) {
    const o = opts || {};
    const A = window.Avatar;
    const P = A.PALETTE;
    const s = Object.assign({}, A.DEFAULT, spec);
    const skinHex = vivid(P.SKIN[s.skin] || P.SKIN[3], 1.12);
    const hairHex = vivid(P.HAIR_COLORS[s.hairColor] || P.HAIR_COLORS.black, 1.35);
    const shirtHex = vivid(mix(P.COLORS[s.shirt] || P.COLORS.sky, '#ffffff', 0.16), 1.12);
    const hwHex = vivid(P.COLORS[s.hwColor] || P.COLORS.teal, 1.1);
    const pantsHex = mix(/^#[0-9a-f]{6}$/i.test(s.pants || '') ? s.pants : '#3f4f7a', '#ffffff', 0.12);
    const skin = clay(skinHex, 'skin');
    const skinDeep = clay(shade(skinHex, 0.88), 'skin');
    const hair = clay(hairHex, 'hair');
    const hood = clay(shirtHex);
    const hoodDeep = clay(shade(shirtHex, 0.9));
    const hw = clay(hwHex);
    const hwDeep = clay(shade(hwHex, 0.86));
    const ink = clay('#1d1412', 'gloss');
    const hijab = s.headwear === 'hijab';
    const covered = ['hijab', 'turban', 'cap', 'beanie', 'sunhat'].includes(s.headwear);
    const hairHidden = hijab || s.headwear === 'turban';
    const vestOn = s.vest === 'field';

    const root = new T.Group();
    const hips = group({ p: [0, 0.3, 0] });
    root.add(hips);

    // Short legs and glossy sneakers.
    const pants = clay(pantsHex);
    [-1, 1].forEach((side) => {
      hips.add(group({ p: [side * 0.095, 0.02, 0] }, [mesh(G('leg', () => capsule(0.08, 0.12, 0.9, 1)), pants, { p: [0, -0.13, 0] }, true),
        mesh(G('shoe', () => roundBox(0.14, 0.09, 0.22, 0.044)), clay('#f6f7fa', 'gloss'), { p: [0, -0.266, 0.035] }, true),
        mesh(G('sole', () => roundBox(0.146, 0.032, 0.226, 0.015)), clay('#cbd2e0'), { p: [0, -0.302, 0.035] })]));
    });

    // The hoodie: a soft bell with a hood rim, drawstrings and a small badge.
    const chest = group();
    hips.add(chest);
    chest.add(mesh(G('body', () => new T.LatheGeometry(BODY.map(([r, y]) => new T.Vector2(r, y)), 64)), hood, { s: [1, 1, 0.82] }, true));
    chest.add(mesh(G('hem', () => new T.TorusGeometry(0.192, 0.026, 14, 56)), hoodDeep, { p: [0, -0.006, 0], r: [Math.PI / 2, 0, 0], s: [1, 0.82, 1] }, true));
    if (!hijab) {
      chest.add(mesh(G('hoodRim', () => new T.TorusGeometry(0.125, 0.046, 20, 48)), hood, { p: [0, 0.39, -0.012], r: [Math.PI / 2 + 0.12, 0, 0], s: [1, 0.86, 1] }, true));
      chest.add(mesh(ball(), hoodDeep, { p: [0, 0.4, -0.13], s: [0.17, 0.09, 0.1] }, true));
      [-1, 1].forEach((side) => chest.add(mesh(G('string', () => capsule(0.01, 0.07)), clay('#ffffff'), { p: [side * 0.045, 0.31, frontZ(side * 0.045, 0.31) + 0.012], r: [0.14, 0, 0] })));
    }
    if (!vestOn && s.gear !== 'medal') {
      chest.add(group({ p: [-0.1, 0.24, frontZ(-0.1, 0.24) - 0.001], r: [0, -0.48, 0] }, [mesh(G('badge', () => new T.CylinderGeometry(0.03, 0.03, 0.008, 32).rotateX(Math.PI / 2)), clay('#ffffff', 'gloss')),
        mesh(G('badgeDot', () => new T.CylinderGeometry(0.016, 0.016, 0.01, 24).rotateX(Math.PI / 2)), clay('#2fb3a3', 'gloss'), { p: [0, 0, 0.002] })]));
    }

    // Field vest: open at the front, with a reflective band and pockets.
    if (vestOn) {
      const open = (g) => {
        const p = g.attributes.position;
        for (let i = 0; i < p.count; i += 1) {
          if (Math.abs(Math.atan2(p.getX(i), p.getZ(i))) < 0.3) p.setXYZ(i, p.getX(i) * 0.85, p.getY(i), p.getZ(i) * 0.85);
        }
        g.computeVertexNormals();
        return g;
      };
      const VEST = BODY.slice(1, 7).map(([r, y]) => [r * 1.07, y]).concat([[0.16, 0.37]]);
      chest.add(mesh(G('vest', () => open(new T.LatheGeometry(VEST.map(([r, y]) => new T.Vector2(r, y)), 72))), clay('#3b74c4'), { s: [1, 1, 0.82] }, true));
      chest.add(mesh(G('band', () => open(new T.LatheGeometry([[bodyR(0.15) * 1.085, 0.15], [bodyR(0.19) * 1.085, 0.19]].map(([r, y]) => new T.Vector2(r, y)), 72))), clay('#f2f5fa', 'gloss'), { s: [1, 1, 0.82] }));
      [-1, 1].forEach((side) => chest.add(mesh(G('vestPocket', () => roundBox(0.08, 0.07, 0.022, 0.009)), clay('#346ab4'), { p: [side * 0.1, 0.24, frontZ(side * 0.1, 0.24, 1.07)], r: [0, Math.atan2(side * 0.1, 0.2) * 0.8, 0] })));
    }

    // Arms with mitten hands. The thumb points forward at rest, so a forearm raised forward makes a thumbs-up.
    const shoulders = [];
    const elbows = [];
    const hands = [];
    [-1, 1].forEach((side) => {
      const sh = group({ p: [side * 0.205, 0.32, 0], r: [0, 0, side * 0.32] });
      sh.add(mesh(G('upperArm', () => capsule(0.07, 0.08, 0.9, 1)), hood, { p: [0, -0.085, 0] }, true));
      const el = group({ p: [0, -UPPER, 0], r: [-0.25, 0, 0] });
      el.add(mesh(G('forearm', () => capsule(0.065, 0.07, 0.88, 1)), hood, { p: [0, -0.07, 0] }, true));
      el.add(mesh(G('cuff', () => new T.TorusGeometry(0.052, 0.017, 12, 28)), hoodDeep, { p: [0, -0.14, 0], r: [Math.PI / 2, 0, 0] }));
      const hand = group({ p: [0, -0.17, 0] }, [mesh(ball(), skin, { p: [0, -0.035, 0], s: [0.062, 0.07, 0.056] }, true),
        mesh(G('thumb', () => capsule(0.026, 0.05)), skin, { p: [-side * 0.032, -0.03, 0.05], r: [1.3, 0, -side * 0.2] }, true)]);
      el.add(hand);
      sh.add(el);
      chest.add(sh);
      shoulders.push(sh);
      elbows.push(el);
      hands.push(hand);
    });

    // Neck and head.
    chest.add(mesh(G('neck', () => new T.CylinderGeometry(0.07, 0.075, 0.1, 24)), skin, { p: [0, 0.43, 0] }));
    const neck = group({ p: [0, 0.44, 0.005] });
    chest.add(neck);
    const head = group({ p: [0, 0.26, 0] });
    neck.add(head);
    head.add(mesh(headGeo(), skin, null, true));
    if (!hijab) {
      [-1, 1].forEach((side) => {
        head.add(mesh(ball(), skin, { p: [side * 0.29, -0.03, 0], s: [0.044, 0.07, 0.054] }, true));
        head.add(mesh(dot(), skinDeep, { p: [side * 0.305, -0.03, 0.008], s: [0.016, 0.042, 0.028] }));
      });
    }

    // Eyes: glossy beads with two catchlights, closed arcs for laughing, and brows.
    const browMat = clay(shade(hairHex, ['blonde', 'gray'].includes(s.hairColor) ? 0.62 : 0.85), 'hair');
    const eyes = [-1, 1].map((side) => {
      const x = side * 0.105;
      const open = group(null, [mesh(ball(), ink, { s: [0.046, 0.064, 0.028] }),
        mesh(dot(), flat('#ffffff'), { p: [-0.015, 0.025, 0.022], s: [0.014, 0.016, 0.007] }),
        mesh(dot(), flat('#ffffff'), { p: [0.015, -0.022, 0.021], s: [0.0065, 0.0065, 0.004] })]);
      const shut = mesh(G('shut', () => tubeGeo([[-0.038, -0.014, 0.008], [-0.019, 0.013, 0.016], [0, 0.021, 0.018], [0.019, 0.013, 0.016], [0.038, -0.014, 0.008]], 0.0105)), ink);
      const eye = onFace(x, -0.014, -0.013, [open, shut]);
      head.add(eye);
      const brow = onFace(x, 0.094, 0.002, [mesh(G('brow', () => tubeGeo([[-0.036, -0.006, 0], [0, 0.007, 0.004], [0.036, -0.003, 0]], 0.0085)), browMat)]);
      head.add(brow);
      return { eye, open, shut, brow, side };
    });

    // Nose, cheeks and mouths.
    head.add(mesh(ball(), clay(mix(skinHex, '#ff9a8a', 0.12), 'skin'), { p: [0, -0.062, surface(0, -0.062) - 0.006], s: [0.03, 0.024, 0.024] }, true));
    const blushTex = canvasTex('blush', 64, 64, (g) => {
      const rg = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      rg.addColorStop(0, 'rgba(255,255,255,1)');
      rg.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = rg;
      g.fillRect(0, 0, 64, 64);
    });
    const blushMat = G(`mat:blush:${s.skin}`, () => new T.MeshBasicMaterial({ map: blushTex, color: s.skin >= 5 ? '#ff6f7d' : '#ff8a96', transparent: true, opacity: s.skin >= 5 ? 0.42 : 0.5, depthWrite: false }));
    [-1, 1].forEach((side) => head.add(onFace(side * 0.17, -0.085, 0.003, [mesh(G('blushPlane', () => bend(new T.PlaneGeometry(0.13, 0.085, 8, 6), 0)), blushMat)])));
    const lipInk = clay('#4a1a1c', 'gloss');
    const mouthIn = clay('#6c1e28', 'gloss');
    const mouth = onFace(0, -0.142, 0);
    head.add(mouth);
    const D = (w, h) => {
      const sh = new T.Shape();
      sh.moveTo(-w, 0.02);
      sh.lineTo(w, 0.02);
      sh.quadraticCurveTo(w * 0.94, 0.02 - h * 1.0, 0, 0.02 - h);
      sh.quadraticCurveTo(-w * 0.94, 0.02 - h * 1.0, -w, 0.02);
      return sh;
    };
    const ellipse = (x, y, rx, ry) => {
      const sh = new T.Shape();
      sh.absellipse(x, y, rx, ry, 0, Math.PI * 2, false, 0);
      return sh;
    };
    const teeth = new T.Shape();
    teeth.moveTo(-0.058, 0.016);
    teeth.lineTo(0.058, 0.016);
    teeth.lineTo(0.052, -0.002);
    teeth.quadraticCurveTo(0, -0.01, -0.052, -0.002);
    teeth.lineTo(-0.058, 0.016);
    const moods = {
      happy: group(null, [mesh(G('smile', () => faceTube([[-0.05, 0.012], [-0.025, -0.012], [0, -0.02], [0.025, -0.012], [0.05, 0.012]], 0.0085)), lipInk)]),
      grin: group(null, [mesh(G('grinOpen', () => bend(new T.ShapeGeometry(D(0.068, 0.092), 16), 0.003)), mouthIn),
        mesh(G('grinTongue', () => bend(new T.ShapeGeometry(ellipse(0, -0.046, 0.038, 0.02), 16), 0.005)), clay('#ff7f93', 'gloss')),
        mesh(G('grinTeeth', () => bend(new T.ShapeGeometry(teeth, 12), 0.005)), clay('#ffffff', 'gloss'))]),
      think: group(null, [mesh(G('smirk', () => faceTube([[-0.035, -0.008], [0, -0.014], [0.026, -0.006], [0.042, 0.008]], 0.0085)), lipInk)]),
      oops: group(null, [mesh(G('ohOpen', () => bend(new T.ShapeGeometry(ellipse(0, -0.012, 0.024, 0.03), 16), 0.004)), mouthIn)]),
      talk: group(null, [mesh(G('talkOpen', () => bend(new T.ShapeGeometry(D(0.04, 0.05), 12), 0.003)), mouthIn),
        mesh(G('talkTongue', () => bend(new T.ShapeGeometry(ellipse(0, -0.016, 0.022, 0.011), 12), 0.005)), clay('#ff7f93', 'gloss'))])
    };
    moods.talk.position.y = 0.006;
    Object.values(moods).forEach((m) => mouth.add(m));

    // Facial hair.
    if (s.facial === 'beard') {
      head.add(mesh(shell('beard', (ux, uy, uz) => cover(smooth(-0.04, 0.1, -0.3 - 0.15 * Math.max(0, uz) - uy) * smooth(-0.35, -0.1, uz) * smooth(0.95, 1.15, Math.hypot(ux / 0.3, (uy + 0.5) / 0.15)), 1.08)), hair, null, true));
    }
    if (s.facial === 'mustache' || s.facial === 'beard') {
      [-1, 1].forEach((side) => head.add(onFace(side * 0.034, -0.104, 0.006, [mesh(dot(), hair, { s: [0.044, 0.02, 0.022], r: [0, 0, side * -0.25] })])));
    }

    // Hair, in chunky glossy shapes. Under a cap, beanie or sun hat only the hair below the band shows.
    if (!hairHidden && s.hair !== 'none') {
      const style = s.hair;
      const front = !covered;
      const top = { cap: 0.3, beanie: 0.4, sunhat: 0.56 }[s.headwear] || 1;
      const lift = { short: -0.04, buzz: 0.06, curly: -0.06, long: -0.08, bun: 0.02, braids: 0.02, ponytail: 0.02 }[style] || 0;
      const thick = front ? { buzz: 1.03, curly: 1.0, short: 1.1 }[style] || 1.085 : style === 'curly' ? 1.0 : 1.04;
      const extra = (ux, uy, uz) => {
        if (style === 'curly') return front ? 0.1 + Math.max(0, uy) * 0.06 + lobed(ux, uy, uz) * 0.24 : 0.04 + lobed(ux, uy, uz) * 0.1;
        return style === 'short' && front ? Math.max(0, uy) * 0.08 : 0;
      };
      head.add(mesh(shell(`hair-${style}-${front ? 'open' : s.headwear}`, (ux, uy, uz) => cover(smooth(-0.05, 0.06, uy - hairline(uz, lift)) * (front ? 1 : smooth(top + 0.04, top - 0.08, uy)),
        thick + extra(ux, uy, uz)), style === 'curly'), hair, null, true));
      // Sculpted locks along the hairline.
      const locks = (list) => list.forEach(([yaw, uy, sx, sy, roll]) => {
        const r = Math.sqrt(1 - uy * uy);
        const [x, y, z] = headPoint(Math.sin(yaw) * r, uy, Math.cos(yaw) * r, 1.07);
        const t = group({ p: [x, y, z] }, [mesh(ball(), hair, { s: [sx, sy, 0.065], r: [0, 0, roll] }, true)]);
        t.rotation.order = 'YXZ';
        t.rotation.y = yaw;
        t.rotation.x = -Math.asin(uy) * 0.9;
        head.add(t);
      });
      if (front && style === 'short') locks([[-0.62, 0.44, 0.1, 0.065, 0.6], [-0.2, 0.5, 0.13, 0.07, 0.3], [0.25, 0.5, 0.12, 0.068, -0.25], [0.68, 0.42, 0.09, 0.06, -0.6]]);
      if (front && style === 'long') locks([[-0.32, 0.43, 0.16, 0.07, 0.42], [0.22, 0.46, 0.15, 0.066, -0.3]]);
      if (front && ['bun', 'ponytail', 'braids'].includes(style)) locks([[-0.32, 0.52, 0.12, 0.05, 0.3], [0.32, 0.52, 0.12, 0.05, -0.3]]);
      if (style === 'long') {
        [-1, 1].forEach((side) => head.add(mesh(G('curtain', () => capsule(0.08, 0.3, 0.8, 1)), hair, { p: [side * 0.275, -0.2, -0.01], r: [0, 0, side * -0.12], s: [1, 1, 0.82] }, true)));
        head.add(mesh(ball(), hair, { p: [0, -0.1, -0.13], s: [0.3, 0.37, 0.21] }, true));
      }
      if (style === 'bun' && front) {
        head.add(mesh(ball(), hair, { p: [0, 0.33, -0.06], s: 0.115 }, true));
        head.add(mesh(G('tie', () => new T.TorusGeometry(0.062, 0.017, 10, 24)), clay(shade(hairHex, 0.6)), { p: [0, 0.27, -0.045], r: [Math.PI / 2 + 0.3, 0, 0] }));
      }
      if (style === 'ponytail') {
        head.add(mesh(G('ptie', () => new T.TorusGeometry(0.046, 0.015, 10, 24)), clay('#ff8fa3'), { p: [0, 0.17, -0.28], r: [0.5, 0, 0] }));
        [[0.1, -0.34, 0.082], [-0.04, -0.36, 0.076], [-0.17, -0.34, 0.064], [-0.27, -0.3, 0.05]].forEach(([y, z, r]) => head.add(mesh(ball(), hair, { p: [0, y, z], s: r }, true)));
      }
      if (style === 'braids') {
        [-1, 1].forEach((side) => {
          for (let i = 0; i < 6; i += 1) head.add(mesh(dot(), hair, { p: [side * (0.255 + i * 0.006), -0.1 - i * 0.07, 0.04 + i * 0.024], s: [0.05, 0.058, 0.05] }, true));
          head.add(mesh(dot(), clay('#ffd25a', 'gloss'), { p: [side * 0.29, -0.53, 0.18], s: 0.028 }));
        });
      }
    }

    // Head coverings.
    if (hijab) {
      head.add(mesh(shell('hijab', (ux, uy, uz) => cover(uz < 0 ? 1 : smooth(0.92, 1.1, Math.hypot(ux / 0.64, (uy + 0.1) / 0.7)), 1.14 + Math.max(0, uy) * 0.05)), hw, null, true));
      chest.add(mesh(G('drape', () => new T.LatheGeometry([[0.12, 0.5], [0.165, 0.45], [0.218, 0.41], [0.25, 0.37], [0.256, 0.35]].map(([r, y]) => new T.Vector2(r, y)), 56)), hw, { s: [1, 1, 0.84] }, true));
    }
    if (s.headwear === 'turban') {
      // A wrapped dome: two raised folds cross above the forehead.
      const fold = (ux, uy, uz, sx) => Math.exp(-Math.pow((sx * 0.407 * ux + 0.717 * uy - 0.566 * uz) / 0.085, 2));
      head.add(mesh(shell('turban', (ux, uy, uz) => cover(smooth(-0.06, 0.06, uy - (0.16 + 0.32 * uz)),
        1.12 + 0.26 * Math.pow(Math.max(0, uy), 1.5) + 0.09 * Math.max(fold(ux, uy, uz, 1), fold(ux, uy, uz, -1)))), hw, null, true));
    }
    if (s.headwear === 'cap') {
      head.add(mesh(G('capCrown', () => new T.SphereGeometry(1, 48, 24, 0, Math.PI * 2, 0, Math.PI * 0.52)), hw, { p: [0, 0.1, -0.005], s: [0.316, 0.29, 0.31], r: [-0.1, 0, 0] }, true));
      const brim = new T.Shape();
      brim.absellipse(0, 0, 0.22, 0.25, 0, Math.PI, false, 0);
      head.add(mesh(G('capBrim', () => new T.ExtrudeGeometry(brim, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 3, curveSegments: 24 })), hwDeep, { p: [0, 0.14, 0.16], r: [Math.PI / 2 + 0.32, 0, 0] }, true));
      head.add(mesh(dot(), hwDeep, { p: [0, 0.39, -0.03], s: 0.024 }));
    }
    if (s.headwear === 'beanie') {
      head.add(mesh(G('beanieCrown', () => new T.SphereGeometry(1, 48, 24, 0, Math.PI * 2, 0, Math.PI * 0.55)), hw, { p: [0, 0.1, -0.008], s: [0.322, 0.32, 0.318], r: [-0.1, 0, 0] }, true));
      head.add(mesh(G('beanieCuff', () => new T.TorusGeometry(0.3, 0.05, 16, 56)), hwDeep, { p: [0, 0.13, -0.004], r: [Math.PI / 2 - 0.1, 0, 0] }, true));
      head.add(mesh(ball(), clay(mix(hwHex, '#ffffff', 0.25)), { p: [0, 0.44, -0.05], s: 0.07 }, true));
    }
    if (s.headwear === 'sunhat') {
      const straw = clay('#ecc983');
      head.add(mesh(G('hatCrown', () => new T.CylinderGeometry(0.22, 0.275, 0.18, 48)), straw, { p: [0, 0.25, -0.01] }, true));
      head.add(mesh(G('hatTop', () => new T.SphereGeometry(1, 40, 12, 0, Math.PI * 2, 0, Math.PI * 0.5)), straw, { p: [0, 0.34, -0.01], s: [0.22, 0.06, 0.22] }, true));
      head.add(mesh(G('hatBand', () => new T.CylinderGeometry(0.266, 0.274, 0.05, 48, 1, true)), clay('#ff8a70'), { p: [0, 0.19, -0.01] }));
      head.add(mesh(G('hatBrim', () => new T.CylinderGeometry(0.5, 0.52, 0.026, 64)), straw, { p: [0, 0.165, -0.01], r: [-0.08, 0, 0] }, true));
    }
    if (s.headwear === 'headphones') {
      const dark = clay('#3a4150', 'gloss');
      head.add(mesh(G('band', () => new T.TorusGeometry(0.335, 0.024, 12, 56, Math.PI)), dark, { p: [0, 0.02, 0] }, true));
      [-1, 1].forEach((side) => head.add(mesh(G('cup', () => new T.CylinderGeometry(0.088, 0.088, 0.07, 32)), hw, { p: [side * 0.33, -0.02, 0], r: [0, 0, Math.PI / 2] }, true)));
      head.add(mesh(G('boom', () => tubeGeo([[-0.34, -0.07, 0.05], [-0.28, -0.17, 0.19], [-0.12, -0.18, 0.27]], 0.011)), dark));
      head.add(mesh(dot(), dark, { p: [-0.11, -0.18, 0.272], s: 0.022 }));
    }

    // Glasses.
    if (s.glasses !== 'none') {
      const frame = clay('#2e3446', 'gloss');
      const lens = G('mat:lens', () => new T.MeshPhysicalMaterial({ color: '#ffffff', transparent: true, opacity: 0.16, roughness: 0.04, clearcoat: 1 }));
      [-1, 1].forEach((side) => {
        const parts = [];
        if (s.glasses === 'round') {
          parts.push(mesh(G('rimRound', () => new T.TorusGeometry(0.062, 0.0095, 12, 40)), frame), mesh(G('lensRound', () => new T.CircleGeometry(0.06, 36)), lens));
        } else {
          const ring = roundRect(new T.Shape(), 0.136, 0.106, 0.03);
          ring.holes.push(roundRect(new T.Path(), 0.112, 0.082, 0.022));
          parts.push(mesh(G('rimSquare', () => new T.ExtrudeGeometry(ring, { depth: 0.012, bevelEnabled: false, curveSegments: 8 })), frame), mesh(G('lensSquare', () => new T.ShapeGeometry(roundRect(new T.Shape(), 0.114, 0.084, 0.022))), lens));
        }
        head.add(onFace(side * 0.105, -0.014, 0.034, parts));
        head.add(mesh(G('temple', () => tubeGeo([[0.165, 0.004, surface(0.165, 0) + 0.018], [0.25, 0.01, 0.17], [0.3, 0.0, 0.04]], 0.007)), frame, { s: [side, 1, 1] }));
      });
      head.add(mesh(G('bridge', () => tubeGeo([[-0.044, 0.008, 0], [0, 0.024, 0.006], [0.044, 0.008, 0]], 0.008)), frame, { p: [0, 0, surface(0, 0.01) + 0.024] }));
    }

    // Gear.
    const z = (x, y) => frontZ(x, y, vestOn ? 1.07 : 1) + 0.006;
    if (s.gear === 'lanyard') {
      const blue = clay('#2f6fd0');
      [-1, 1].forEach((side) => chest.add(mesh(G(`strap${vestOn}`, () => tubeGeo([[0.05, 0.405, -0.03], [0.1, 0.39, 0.06], [0.065, 0.32, z(0.065, 0.32)], [0.012, 0.25, z(0.012, 0.25)]], 0.009)), blue, { s: [side, 1, 1] })));
      chest.add(group({ p: [0, 0.21, z(0, 0.21) + 0.01] }, [mesh(G('card', () => roundBox(0.078, 0.098, 0.012, 0.005)), clay('#ffffff', 'gloss')),
        mesh(G('cardBand', () => new T.BoxGeometry(0.078, 0.022, 0.013)), blue, { p: [0, 0.036, 0] }), mesh(G('cardPhoto', () => new T.BoxGeometry(0.024, 0.028, 0.013)), clay('#c9d3e2'), { p: [-0.018, -0.004, 0] })]));
    }
    if (s.gear === 'backpack') {
      chest.add(mesh(G('pack', () => roundBox(0.34, 0.36, 0.16, 0.06)), clay('#ffa36f'), { p: [0, 0.2, -0.24] }, true));
      [-1, 1].forEach((side) => chest.add(mesh(G(`packStrap${vestOn}`, () => tubeGeo([[0.11, 0.33, -0.17], [0.13, 0.39, -0.03], [0.13, 0.32, z(0.13, 0.32)], [0.14, 0.12, z(0.14, 0.12)]], 0.018)), clay('#e8804f'), { s: [side, 1, 1] })));
    }
    if (s.gear === 'camera') {
      chest.add(mesh(G(`camStrap${vestOn}`, () => tubeGeo([[-0.13, 0.38, 0.0], [-0.06, 0.3, z(-0.06, 0.3)], [0.08, 0.15, z(0.08, 0.15)], [0.15, 0.08, z(0.15, 0.08)]], 0.008)), clay('#2b2f3a')));
      chest.add(group({ p: [0.14, 0.07, z(0.14, 0.07) + 0.035] }, [mesh(G('camBody', () => roundBox(0.12, 0.08, 0.06, 0.018)), clay('#3a4150', 'gloss')),
        mesh(G('lens', () => new T.CylinderGeometry(0.03, 0.032, 0.04, 24)), clay('#20242e', 'gloss'), { p: [0, 0, 0.045], r: [Math.PI / 2, 0, 0] })]));
    }
    if (s.gear === 'binoculars') {
      chest.add(group({ p: [0, 0.2, z(0, 0.2) + 0.035] }, [-1, 1].map((side) => mesh(G('barrel', () => new T.CylinderGeometry(0.028, 0.03, 0.09, 20)), clay('#3a4150', 'gloss'), { p: [side * 0.035, 0, 0] }))));
    }
    if (s.gear === 'medal') {
      chest.add(mesh(G('ribbon', () => new T.BoxGeometry(0.03, 0.045, 0.006)), clay('#2f6fd0'), { p: [0.11, 0.275, z(0.11, 0.275)] }));
      chest.add(mesh(G('medalDisc', () => new T.CylinderGeometry(0.028, 0.028, 0.008, 28)), clay('#f2b632', 'metal'), { p: [0.11, 0.238, z(0.11, 0.238) + 0.004], r: [Math.PI / 2, 0, 0] }));
    }
    if (s.gear === 'radio') {
      hands[1].add(group({ p: [0.0, -0.05, 0.045], r: [0.3, 0, 0] }, [mesh(G('radio', () => roundBox(0.05, 0.11, 0.035, 0.012)), clay('#3a4150', 'gloss')),
        mesh(G('antenna', () => new T.CylinderGeometry(0.006, 0.007, 0.07, 8)), clay('#3a4150'), { p: [0.012, 0.085, 0] })]));
    }

    // Little action lines that pop around the head when a character reacts.
    const sparks = [-1, 1].map((side) => group(null, [10, 40, 70].map((deg) => {
      const a = (deg * Math.PI) / 180;
      return mesh(G('spark', () => capsule(0.013, 0.05)), flat('#ffc93c'), { p: [side * Math.cos(a) * 0.43, Math.sin(a) * 0.43, 0.08], r: [0, 0, side * (a - Math.PI / 2)] });
    })));
    sparks.forEach((g) => {
      g.visible = false;
      head.add(g);
    });

    const fig = { root, hips, chest, neck, head, shoulders, elbows, hands, eyes, moods, sparks, mood: '', action: null, look: 0, lookTarget: 0, blinkAt: 1 + Math.random() * 3, phase: Math.random() * 10, talkUntil: 0 };
    fig.rest = { sh: shoulders.map((x) => x.rotation.clone()), el: elbows.map((x) => x.rotation.clone()) };
    setMood(fig, o.mood || 'happy', true);
    return fig;
  }

  // ---------- expressions and motion ----------
  const FACES = {
    happy: { brow: [0, 0], tilt: [0, 0], closed: false },
    grin: { brow: [0.012, 0.012], tilt: [0.08, 0.08], closed: true },
    think: { brow: [0.02, -0.004], tilt: [-0.12, 0.14], closed: false },
    oops: { brow: [0.012, 0.012], tilt: [0.34, 0.34], closed: false }
  };
  function setMood(f, mood, now) {
    const m = FACES[mood] ? mood : 'happy';
    f.mood = m;
    f.face = FACES[m];
    Object.keys(f.moods).forEach((k) => { f.moods[k].visible = k === m; });
    f.eyes.forEach((e) => {
      e.open.visible = !f.face.closed;
      e.shut.visible = f.face.closed;
    });
    if (now) f.faceNow = { brow: f.face.brow.slice(), tilt: f.face.tilt.slice() };
  }
  // The scenario's reactions, in this style: thumbs-up and a laugh, a hand on the chin, hands on the cheeks.
  const ACTIONS = { jump: 'cheer', tilt: 'ponder', shake: 'doubt', walk: 'enter' };
  function play(f, name, t, extra) {
    f.action = Object.assign({ name: ACTIONS[name] || name, t0: t }, extra || {});
  }
  function dispose(f) {
    if (f.root.parent) f.root.parent.remove(f.root);
  }

  // Two-bone reach for an arm: puts the hand at a point in chest space, with the elbow bending toward pole.
  function reach(f, i, target, pole, k) {
    if (k <= 0) return;
    const sh = f.shoulders[i];
    const d = V3(target[0], target[1], target[2]).sub(sh.position);
    const dist = Math.min(UPPER + FORE - 0.002, Math.max(0.06, d.length()));
    d.normalize();
    const cosA = (UPPER * UPPER + dist * dist - FORE * FORE) / (2 * UPPER * dist);
    const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
    const u = V3(pole[0], pole[1], pole[2]);
    u.sub(d.clone().multiplyScalar(u.dot(d))).normalize();
    const a = d.clone().multiplyScalar(cosA).add(u.clone().multiplyScalar(sinA));
    const b = d.clone().multiplyScalar(dist).sub(a.clone().multiplyScalar(UPPER)).normalize();
    // The bone's local -y runs down the upper arm and its local +z is the way the forearm bends.
    const y = a.clone().negate();
    const zz = b.clone().sub(a.clone().multiplyScalar(b.dot(a)));
    if (zz.lengthSq() < 1e-6) zz.copy(u).negate();
    zz.normalize();
    const q = new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(V3().crossVectors(y, zz), y, zz));
    sh.quaternion.slerp(q, k);
    const bend = Math.acos(Math.max(-1, Math.min(1, a.dot(b))));
    f.elbows[i].quaternion.slerp(new T.Quaternion().setFromEuler(new T.Euler(-bend, 0, 0)), k);
  }
  // Hand targets in chest space for each pose, per arm side (-1 is the figure's right arm), with an elbow pole.
  const POSES = {
    thumbs: (s) => [[s * 0.2, 0.3, 0.24], [s * 0.5, -1, -0.3]],
    chin: (s) => (s > 0 ? [[0.035, 0.39, 0.25], [0.8, -1, 0]] : null),
    cheeks: (s) => [[s * 0.17, 0.54, 0.255], [s, -0.6, -0.1]],
    present: (s) => (s > 0 ? [[0.36, 0.2, 0.2], [0.3, -1, -0.4]] : null),
    wave: (s, k) => (s > 0 ? [[0.4 + Math.sin(k * 9) * 0.045, 0.63, 0.08], [1, -0.6, 0]] : null)
  };
  function pose(f, name, k, time) {
    [-1, 1].forEach((side, i) => {
      const p = POSES[name](side, time);
      if (p) reach(f, i, p[0], p[1], k);
    });
  }
  const SPARK = { cheer: '#ffc93c', ponder: '#36c2b4', doubt: '#ff7a59' };
  function sparks(f, color, u) {
    f.sparks.forEach((g) => {
      g.visible = u > 0.01;
      g.scale.setScalar(Math.max(0.001, u));
      g.children.forEach((m) => { m.material = flat(color); });
    });
  }

  // One frame of life: breathing, a gentle sway, blinking, looking, and any action in progress.
  function animate(f, t, dt) {
    const ph = t + f.phase;
    const breath = Math.sin(ph * 1.9);
    f.chest.scale.set(1 + breath * 0.008, 1 + breath * 0.012, 1 + breath * 0.008);
    f.hips.position.set(0, 0.3, 0);
    f.hips.rotation.set(0, 0, Math.sin(ph * 0.8) * 0.02);
    f.root.scale.setScalar(f.pop == null ? 1 : f.pop);
    f.shoulders.forEach((sh, i) => {
      sh.rotation.copy(f.rest.sh[i]);
      sh.rotation.z += Math.sin(ph * 1.9 + i) * 0.015;
    });
    f.elbows.forEach((el, i) => el.rotation.copy(f.rest.el[i]));
    f.look = damp(f.look, f.lookTarget, 4, dt);
    f.neck.rotation.set(Math.sin(ph * 0.9) * 0.03, f.look + Math.sin(ph * 0.45) * 0.05, Math.sin(ph * 0.7) * 0.04);

    const cur = f.faceNow;
    [0, 1].forEach((i) => {
      cur.brow[i] = damp(cur.brow[i], f.face.brow[i], 10, dt);
      cur.tilt[i] = damp(cur.tilt[i], f.face.tilt[i], 10, dt);
    });
    f.eyes.forEach((e, i) => {
      e.brow.children[0].position.y = cur.brow[i];
      e.brow.children[0].rotation.z = -e.side * cur.tilt[i];
    });

    // A blink every few seconds.
    let lid = 1;
    if (!reduceMotion) {
      if (t > f.blinkAt + 0.16) f.blinkAt = t + 2.2 + Math.random() * 3.5;
      const b = t - f.blinkAt;
      if (b > 0 && b < 0.16) lid = 1 - 0.9 * Math.sin((b / 0.16) * Math.PI);
    }
    f.eyes.forEach((e) => { e.open.scale.y = lid; });

    // Talking: a small mouth opens and closes while a speech bubble is fresh.
    const talking = t < f.talkUntil && !reduceMotion && (f.mood === 'happy' || f.mood === 'think');
    Object.keys(f.moods).forEach((k) => { f.moods[k].visible = talking ? k === 'talk' : k === f.mood; });
    if (talking) f.moods.talk.scale.y = 0.35 + 0.65 * Math.abs(Math.sin(t * 9));
    sparks(f, '#ffc93c', 0);
    if (f.action) act(f, t);
  }

  function act(f, t) {
    const a = f.action;
    const k = t - a.t0;
    if (k < 0) {
      if (a.name === 'enter') f.root.position.x = a.from;
      return;
    }
    const env = (d) => (k < 0.3 ? ease(k / 0.3) : k > d - 0.35 ? ease(Math.max(0, d - k) / 0.35) : 1);
    const pop = (d) => (k < d - 0.3 ? back(Math.min(1, k / 0.3)) : ease(Math.max(0, d - k) / 0.3));
    if (a.name === 'cheer') {
      const d = 1.9;
      if (k > d) { f.action = null; return; }
      pose(f, 'thumbs', env(d));
      f.hips.position.y += Math.max(0, Math.sin(Math.min(1, k / 0.45) * Math.PI)) * 0.06;
      f.neck.rotation.x += Math.sin(k * 10) * 0.04 * env(d);
      sparks(f, SPARK.cheer, pop(d));
    } else if (a.name === 'ponder' || a.name === 'think-hold') {
      const d = a.name === 'ponder' ? 2.3 : 1e9;
      if (k > d) { f.action = null; return; }
      pose(f, 'chin', env(d));
      f.neck.rotation.z += 0.12 * env(d);
      if (a.name === 'ponder') sparks(f, SPARK.ponder, pop(d) * 0.9);
    } else if (a.name === 'doubt') {
      const d = 2.0;
      if (k > d) { f.action = null; return; }
      pose(f, 'cheeks', env(d));
      f.neck.rotation.y += Math.sin(k * 9) * 0.08 * env(d);
      sparks(f, SPARK.doubt, pop(d));
    } else if (a.name === 'gesture') {
      const d = 1.6;
      if (k > d) { f.action = null; return; }
      pose(f, 'present', env(d));
    } else if (a.name === 'wave') {
      const d = 2.2;
      if (k > d) { f.action = null; return; }
      pose(f, 'wave', env(d), k);
    } else if (a.name === 'enter') {
      // Hops in from the side and settles.
      const d = 1.1;
      const u = Math.min(1, k / d);
      f.root.position.x = lerp(a.from, a.to, ease(u));
      f.hips.position.y += Math.abs(Math.sin(u * Math.PI * 3)) * 0.07 * (1 - u);
      if (k > d) f.action = null;
    }
  }

  // Soft, bright studio light like the group's renders.
  function lights(scene) {
    scene.add(new T.HemisphereLight('#ffffff', '#e9dcff', 0.95));
    const key = new T.DirectionalLight('#fffaf4', 2.5);
    key.position.set(-2.2, 3.4, 4.2);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -4.5;
    key.shadow.camera.right = 4.5;
    key.shadow.camera.top = 3;
    key.shadow.camera.bottom = -1.5;
    key.shadow.bias = -0.0006;
    key.shadow.normalBias = 0.02;
    scene.add(key);
    const fill = new T.DirectionalLight('#ffeaf3', 0.6);
    fill.position.set(3, 1.2, 3);
    scene.add(fill);
    const rim = new T.DirectionalLight('#e2eaff', 1.6);
    rim.position.set(0.5, 3, -4);
    scene.add(rim);
  }

  function renderer(host, opts) {
    const r = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: Boolean(opts && opts.keep) });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, (opts && opts.dpr) || 2));
    r.outputColorSpace = T.SRGBColorSpace;
    r.toneMapping = T.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.0;
    r.shadowMap.enabled = true;
    r.shadowMap.type = T.PCFSoftShadowMap;
    r.setClearColor(0x000000, 0);
    if (host) host.appendChild(r.domElement);
    return r;
  }
  function release(r) {
    r.dispose();
    r.forceContextLoss();
  }

  // A soft contact shadow under a figure.
  function blob(size) {
    const tex = canvasTex('blob', 128, 128, (g) => {
      const rg = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      rg.addColorStop(0, 'rgba(70,50,120,0.32)');
      rg.addColorStop(0.6, 'rgba(70,50,120,0.11)');
      rg.addColorStop(1, 'rgba(70,50,120,0)');
      g.fillStyle = rg;
      g.fillRect(0, 0, 128, 128);
    });
    const m = new T.Mesh(G('blobPlane', () => new T.PlaneGeometry(1, 1)), G('mat:blob', () => new T.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })));
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.003;
    m.scale.set(size, size * 0.55, 1);
    return m;
  }

  // ---------- the story stage ----------
  // Calm, like the group's app: the characters pop in on a soft pastel card, breathe, blink, look at
  // whoever is speaking and react to your choices. One live stage carries through a scenario's steps.
  const FACING = { you: 0.35, npc: -0.25, mentor: -0.3 };
  const SPOTS = { wide: { you: 0.13, npc: 0.63, mentor: 0.86 }, narrow: { you: 0.14, npc: 0.58, mentor: 0.875 } };
  let live = null;
  const sceneKey = (cfg) => JSON.stringify(cfg.actors.map((a) => [a.id, a.spec]));

  function buildStage(art, cfg, key) {
    const L = { key, art, cfg, figs: {}, t: 0, last: performance.now(), raf: 0, timer: 0, visible: true, busyUntil: 0 };
    L.renderer = renderer(null, { dpr: window.innerWidth < 768 ? 1.75 : 2 });
    L.canvas = L.renderer.domElement;
    L.canvas.className = 'stage-3d';
    L.canvas.setAttribute('aria-hidden', 'true');
    L.scene = new T.Scene();
    L.scene.environment = studio(L.renderer);
    lights(L.scene);
    L.camera = new T.PerspectiveCamera(22, 2, 0.1, 60);
    cfg.actors.forEach((a, i) => {
      const f = figure(a.spec, { mood: a.mood || 'happy' });
      f.id = a.id;
      f.moodIn = a.mood;
      f.root.rotation.y = FACING[a.id] || 0;
      f.root.add(blob(0.8));
      f.pop = reduceMotion ? 1 : 0;
      f.popAt = 0.1 + 0.12 * i;
      L.scene.add(f.root);
      L.figs[a.id] = f;
    });
    art.prepend(L.canvas);
    L.resize = new ResizeObserver(() => layout(L));
    L.resize.observe(art);
    L.io = new IntersectionObserver((entries) => {
      L.visible = entries.some((e) => e.isIntersecting);
      if (L.visible) kick(L);
    });
    L.io.observe(art);
    L.onVis = () => kick(L);
    document.addEventListener('visibilitychange', L.onVis);
    layout(L);
    return L;
  }

  // The camera frames the figures at about two thirds of the stage height, standing near the bottom,
  // and each figure stands where its name label sits in the drawn version.
  function layout(L) {
    const w = L.art.clientWidth;
    const h = L.art.clientHeight;
    if (!w || !h) return;
    L.renderer.setSize(w, h, false);
    L.camera.aspect = w / h;
    L.camera.position.set(0, 0.95, 5.45);
    L.camera.lookAt(0, 0.84, 0);
    L.camera.updateProjectionMatrix();
    L.camera.updateMatrixWorld();
    const spots = SPOTS[w / h > 2.4 ? 'wide' : 'narrow'];
    const p = V3();
    Object.values(L.figs).forEach((f) => {
      p.set(0, 0.6, 0).project(L.camera);
      const x0 = p.x;
      p.set(1, 0.6, 0).project(L.camera);
      const x = ((spots[f.id] || 0.5) * 2 - 1 - x0) / (p.x - x0);
      f.home = x;
      if (f.action && f.action.name === 'enter') {
        f.action.to = x;
        f.action.from = x - 1.8;
      } else {
        f.root.position.x = x;
      }
    });
    kick(L);
  }

  function updateStage(L, cfg) {
    L.cfg = cfg;
    const t = L.t;
    const speaker = (cfg.bubbles || []).reduce((sp, b) => (b.side === 'left' ? 'you' : b.side === 'right' ? 'mentor' : sp), null);
    cfg.actors.forEach((a) => {
      const f = L.figs[a.id];
      if (!f) return;
      if (a.mood !== f.moodIn) {
        setMood(f, a.mood || 'happy');
        f.moodIn = a.mood;
      }
      if (a.anim === 'walk') {
        if (!reduceMotion) play(f, 'enter', t + 0.15, { from: f.home - 1.8, to: f.home });
      }
      else if (a.anim) play(f, a.anim, t + 0.1);
      else if (a.mood === 'think' && a.id === 'npc') {
        if (!f.action) play(f, 'think-hold', t);
      } else if (f.action && f.action.name === 'think-hold') f.action = null;
    });
    const said = (cfg.bubbles || []).filter((b) => b.side === 'left' || b.side === 'right').pop();
    if (speaker && L.figs[speaker]) {
      const f = L.figs[speaker];
      f.talkUntil = t + 0.25 + Math.min(1.8, 0.4 + ((said && said.text) || '').length * 0.02);
      if (!f.action) play(f, 'gesture', t + 0.2);
    }
    Object.values(L.figs).forEach((f) => {
      f.watch = speaker && f.id !== speaker ? speaker : f.id === 'you' ? 'npc' : 'you';
    });
    L.busyUntil = t + 2.5;
    kick(L);
  }

  function kick(L) {
    if (L.timer) {
      clearTimeout(L.timer);
      L.timer = 0;
    }
    if (!L.raf && L.visible && !document.hidden && L.canvas.isConnected) {
      L.last = performance.now();
      L.raf = requestAnimationFrame((now) => frame(L, now));
    }
  }

  function frame(L, now) {
    L.raf = 0;
    if (L !== live || !L.canvas.isConnected || !L.visible || document.hidden) return;
    const dt = Math.min(0.05, (now - L.last) / 1000);
    L.last = now;
    L.t += dt;
    const t = L.t;
    Object.values(L.figs).forEach((f) => {
      if (f.pop < 1) f.pop = t < f.popAt ? 0 : back(Math.min(1, (t - f.popAt) / 0.45));
      const other = L.figs[f.watch];
      if (other) f.lookTarget = Math.max(-0.35, Math.min(0.35, (Math.atan2(other.root.position.x - f.root.position.x, 1.2) - f.root.rotation.y) * 0.5));
      animate(f, t, dt);
    });
    L.renderer.render(L.scene, L.camera);
    placeLabels(L);
    if (!L.shown) {
      L.shown = true;
      L.canvas.style.opacity = '1';
      if (L.stage) L.stage.classList.add('is-3d');
      const Av = window.Avatar;
      if (Av && Av.isSet() && !Av.portraitUrl()) setTimeout(() => Av.storePortrait(portrait(Av.get(), 256)), 400);
    }
    const busy = t < L.busyUntil || Object.values(L.figs).some((f) => (f.action && f.action.name !== 'think-hold') || f.pop < 1 || t < f.talkUntil);
    if (reduceMotion && !busy) return;
    // Idle breathing and blinking run at a gentle 30 frames a second.
    if (busy) L.raf = requestAnimationFrame((n) => frame(L, n));
    else L.timer = setTimeout(() => { L.timer = 0; L.raf = requestAnimationFrame((n) => frame(L, n)); }, 33);
  }

  function placeLabels(L) {
    if (!L.stage) return;
    const p = V3();
    L.cfg.actors.forEach((a) => {
      const f = L.figs[a.id];
      const el = L.stage.querySelector(`.actor[data-actor="${a.id}"]`);
      if (!f || !el) return;
      p.set(f.root.position.x, 0, 0).project(L.camera);
      el.style.left = `${((p.x + 1) / 2) * 100}%`;
      el.style.bottom = `${((p.y + 1) / 2) * 100}%`;
    });
  }

  function destroy(L) {
    cancelAnimationFrame(L.raf);
    clearTimeout(L.timer);
    L.resize.disconnect();
    L.io.disconnect();
    document.removeEventListener('visibilitychange', L.onVis);
    Object.values(L.figs).forEach(dispose);
    release(L.renderer);
    L.canvas.remove();
  }

  // Attaches 3D to a story stage rendered by Scenes.stage(); returns false to keep the SVG art.
  async function attachStage(stage, cfg) {
    try {
      await load();
    } catch (e) {
      return false;
    }
    if (!stage.isConnected) return false;
    const art = stage.querySelector('.stage-art');
    const key = sceneKey(cfg);
    if (live && live.key === key) {
      if (live.art !== art) {
        live.resize.disconnect();
        live.io.disconnect();
        live.art = art;
        art.prepend(live.canvas);
        live.resize.observe(art);
        live.io.observe(art);
      }
    } else {
      if (live) destroy(live);
      live = buildStage(art, cfg, key);
    }
    live.stage = stage;
    if (live.shown) stage.classList.add('is-3d');
    updateStage(live, cfg);
    layout(live);
    return true;
  }

  // ---------- the avatar preview ----------
  // In the creator the avatar waves hello, then sways gently on its card; drag to turn it.
  function turntable(host, spec) {
    const R = renderer(host);
    const el = R.domElement;
    el.className = 'turntable-3d';
    el.setAttribute('role', 'img');
    el.setAttribute('aria-label', 'Your avatar in 3D. Drag to turn it.');
    const scene = new T.Scene();
    scene.environment = studio(R);
    lights(scene);
    const cam = new T.PerspectiveCamera(24, 0.8, 0.1, 30);
    const S = { fig: null, angle: 0.25, drag: null, hold: 0, bump: -1, t: 0, last: performance.now(), raf: 0, alive: true };
    const set = (sp) => {
      if (S.fig) dispose(S.fig);
      S.fig = figure(sp, { mood: 'happy' });
      S.fig.root.add(blob(0.85));
      scene.add(S.fig.root);
    };
    set(spec);
    if (!reduceMotion) play(S.fig, 'wave', 0.3);
    const size = () => {
      const w = host.clientWidth || 300;
      const h = host.clientHeight || 380;
      R.setSize(w, h, false);
      cam.aspect = w / h;
      cam.position.set(0, 0.86, 3.75 * Math.max(1, 0.78 / cam.aspect));
      cam.lookAt(0, 0.7, 0);
      cam.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(size);
    ro.observe(host);
    size();
    el.addEventListener('pointerdown', (e) => {
      S.drag = { x: e.clientX, angle: S.angle };
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', (e) => {
      if (S.drag) S.angle = S.drag.angle + (e.clientX - S.drag.x) * 0.012;
    });
    const end = () => {
      S.drag = null;
      S.hold = S.t + 2.5;
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    function frame(now) {
      S.raf = 0;
      if (!S.alive || !el.isConnected) return;
      const dt = Math.min(0.05, (now - S.last) / 1000);
      S.last = now;
      S.t += dt;
      if (!S.drag && S.t > S.hold) S.angle = damp(S.angle, 0.25 + (reduceMotion ? 0 : Math.sin(S.t * 0.5) * 0.3), 2, dt);
      S.fig.root.rotation.y = S.angle;
      animate(S.fig, S.t, dt);
      // A small bounce when an option changes.
      const u = (S.t - S.bump) / 0.35;
      if (S.bump >= 0 && u < 1) S.fig.root.scale.setScalar(0.94 + 0.06 * back(Math.max(0, u)));
      R.render(scene, cam);
      S.raf = requestAnimationFrame(frame);
    }
    S.raf = requestAnimationFrame(frame);
    return {
      update(sp) {
        set(sp);
        S.hold = 0;
        if (!reduceMotion) S.bump = S.t;
      },
      dispose() {
        S.alive = false;
        cancelAnimationFrame(S.raf);
        ro.disconnect();
        if (S.fig) dispose(S.fig);
        release(R);
        el.remove();
      }
    };
  }

  // ---------- portraits ----------
  // A head-and-shoulders render as an image, for the nav, the home card, the profile and mentor tips.
  let shot = null;
  function portrait(spec, size, o) {
    const px = size || 256;
    if (!shot) {
      const R = renderer(null, { keep: true, dpr: 1 });
      const scene = new T.Scene();
      scene.environment = studio(R);
      lights(scene);
      shot = { R, scene, cam: new T.PerspectiveCamera(22, 1, 0.1, 20) };
    }
    const { R, scene, cam } = shot;
    R.setSize(px, px, false);
    const f = figure(spec, { mood: (o && o.mood) || 'happy' });
    f.root.rotation.y = o && o.turn != null ? o.turn : 0.22;
    f.phase = 0;
    scene.add(f.root);
    animate(f, 0, 0.016);
    f.neck.rotation.set(0, 0, 0);
    f.eyes.forEach((e) => { e.open.scale.y = 1; });
    cam.position.set(0.04, 1.0, 2.6);
    cam.lookAt(0, 0.96, 0);
    R.render(scene, cam);
    const url = R.domElement.toDataURL('image/png');
    dispose(f);
    return url;
  }

  window.World3D = {
    load,
    attachStage,
    turntable: (host, spec) => turntable(host, spec),
    portrait: (spec, size, o) => portrait(spec, size, o),
    isLive: (cfg) => Boolean(T && live && live.shown && live.key === sceneKey(cfg)),
    get ready() { return Boolean(T); },
    // Internal pieces, for review renders and tests.
    _: { figure, setMood, play, animate, lights, renderer, studio, blob, get T() { return T; }, get live() { return live; } }
  };
})();
