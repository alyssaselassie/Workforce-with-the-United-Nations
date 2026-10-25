// 3D characters and story scenes with Three.js (WebGL): modeled, lit, shadowed and animated like the globe.
// Three.js loads only when a 3D view is needed. Without WebGL, the SVG art in avatar.js and scenes.js stays.
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

  // ---------- shared helpers ----------
  const geos = new Map();
  const mats = new Map();
  const G = (key, make) => {
    if (!geos.has(key)) geos.set(key, make());
    return geos.get(key);
  };
  function M(color, o) {
    const opts = Object.assign({ roughness: 0.78, metalness: 0 }, o || {});
    const key = color + JSON.stringify(opts);
    if (!mats.has(key)) mats.set(key, new T.MeshStandardMaterial(Object.assign({ color }, opts)));
    return mats.get(key);
  }
  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    const c = (v) => Math.max(0, Math.min(255, Math.round(v * f))).toString(16).padStart(2, '0');
    return `#${c(n >> 16)}${c((n >> 8) & 255)}${c(n & 255)}`;
  }
  function mix(a, b, t) {
    const pa = parseInt(a.slice(1), 16);
    const pb = parseInt(b.slice(1), 16);
    const c = (sh) => Math.round(lerp((pa >> sh) & 255, (pb >> sh) & 255, t)).toString(16).padStart(2, '0');
    return `#${c(16)}${c(8)}${c(0)}`;
  }
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
  function mesh(geo, mat, at, noShadow) {
    const m = new T.Mesh(geo, mat);
    m.castShadow = !noShadow;
    m.receiveShadow = true;
    return place(m, at);
  }
  function group(at, kids) {
    const g = new T.Group();
    (kids || []).forEach((k) => k && g.add(k));
    return place(g, at);
  }
  const V3 = (x, y, z) => new T.Vector3(x, y, z);
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const smooth = (e0, e1, x) => {
    const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
    return t * t * (3 - 2 * t);
  };
  // Shell scale for a coverage of 0 (tucked under the skin) to 1 (full thickness): edges blend smoothly.
  const cover = (c, thick) => lerp(0.9, thick, c);
  const damp = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));

  // Narrows a geometry toward one end (y from -h/2 to +h/2), for tapered limbs.
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
  const capsule = (r, len, bottom, top) => taper(new T.CapsuleGeometry(r, len, 8, 20), bottom == null ? 1 : bottom, top == null ? 1 : top);

  function tube(points, r, segs) {
    const curve = new T.CatmullRomCurve3(points.map(([x, y, z]) => V3(x, y, z)));
    return new T.TubeGeometry(curve, segs || 24, r, 8, false);
  }

  // A rounded box (for shoes, bags and props) from an extruded rounded rectangle.
  function roundBox(w, h, d, r) {
    const s = new T.Shape();
    const x = -w / 2 + r;
    const y = -h / 2 + r;
    const iw = w - 2 * r;
    const ih = h - 2 * r;
    s.moveTo(x, y - r);
    s.lineTo(x + iw, y - r);
    s.quadraticCurveTo(x + iw + r, y - r, x + iw + r, y);
    s.lineTo(x + iw + r, y + ih);
    s.quadraticCurveTo(x + iw + r, y + ih + r, x + iw, y + ih + r);
    s.lineTo(x, y + ih + r);
    s.quadraticCurveTo(x - r, y + ih + r, x - r, y + ih);
    s.lineTo(x - r, y);
    s.quadraticCurveTo(x - r, y - r, x, y - r);
    const g = new T.ExtrudeGeometry(s, { depth: d - 2 * r, bevelEnabled: true, bevelThickness: r, bevelSize: r * 0.98, bevelSegments: 3, curveSegments: 6 });
    g.translate(0, 0, -(d - 2 * r) / 2);
    return g;
  }

  // ---------- the head ----------
  // An egg-shaped head: the jaw narrows toward the chin and the back of the skull is fuller.
  const HEAD = { a: 0.095, b: 0.125, c: 0.108 };
  const HIP = 0.87;
  function jaw(uy) {
    const t = Math.max(0, (-uy - 0.2) / 0.8);
    return [1 - 0.3 * Math.pow(t, 1.2), 1 - 0.1 * t];
  }
  function headPoint(ux, uy, uz, k) {
    const [kx, kz] = jaw(uy);
    return [ux * kx * HEAD.a * k, uy * HEAD.b * k, uz * (uz > 0 ? kz : 1.06) * HEAD.c * k];
  }
  // The front of the face at (x, y), to seat the features on the skin.
  function surface(x, y) {
    const uy = y / HEAD.b;
    const [kx, kz] = jaw(uy);
    const ux = x / (HEAD.a * kx);
    return HEAD.c * kz * Math.sqrt(Math.max(0, 1 - ux * ux - uy * uy));
  }
  // A shell around the head (hair, head coverings, beards). keep() returns the shell's scale at a point;
  // parts at 0.9 or less sit under the skin.
  function shell(key, keep, segs) {
    return G(key, () => {
      const n = segs || 96;
      const g = new T.SphereGeometry(1, n, Math.round(n * 0.75));
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i += 1) {
        const ux = p.getX(i);
        const uy = p.getY(i);
        const uz = p.getZ(i);
        const k = keep(ux, uy, uz);
        const [x, y, z] = headPoint(ux, uy, uz, k);
        p.setXYZ(i, x, y, z);
      }
      g.computeVertexNormals();
      return g;
    });
  }
  // Height of the hairline on the unit head: high at the forehead, low at the nape.
  const hairline = (uz, lift) => 0.15 + 0.6 * uz - 0.05 * uz * uz + (lift || 0);
  const onFace = (x, y, lift) => V3(x, y, surface(x, y) + (lift || 0));
  // A feature that lies on the skin, from a flat outline.
  function skinShape(shape, lift) {
    const g = new T.ShapeGeometry(shape, 12);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i += 1) p.setZ(i, surface(p.getX(i), p.getY(i)) + lift);
    g.computeVertexNormals();
    return g;
  }
  const faceTube = (pts, r, lift) => {
    const curve = new T.CatmullRomCurve3(pts.map(([x, y]) => onFace(x, y, lift)));
    return new T.TubeGeometry(curve, 20, r, 6, false);
  };

  // ---------- figures ----------
  // A person about 1.75 m tall, built from smooth parts and rigged at the hips, spine, neck, shoulders,
  // elbows, hips and knees. spec uses the same options as the avatar creator.
  function figure(spec, opts) {
    const o = opts || {};
    const A = window.Avatar;
    const P = A.PALETTE;
    const s = Object.assign({}, A.DEFAULT, spec);
    const skinHex = P.SKIN[s.skin] || P.SKIN[3];
    const hairHex = P.HAIR_COLORS[s.hairColor] || P.HAIR_COLORS.black;
    const shirtHex = P.COLORS[s.shirt] || P.COLORS.sky;
    const hwHex = P.COLORS[s.hwColor] || P.COLORS.teal;
    const pantsHex = /^#[0-9a-f]{6}$/i.test(s.pants || '') ? s.pants : P.TROUSERS;
    const skin = M(skinHex, { roughness: 0.6, emissive: skinHex, emissiveIntensity: 0.07 });
    const skinDark = M(shade(skinHex, 0.86), { roughness: 0.65 });
    const lipHex = mix(P.LIPS[s.skin] || P.LIPS[3], skinHex, 0.35);
    const lips = M(lipHex, { roughness: 0.5 });
    const hairM = G('mat:hair' + hairHex, () => new T.MeshStandardMaterial({ color: hairHex, roughness: 0.46, metalness: 0.04, bumpMap: strands(), bumpScale: 0.5 }));
    const browM = M(shade(hairHex, ['blonde', 'gray'].includes(s.hairColor) ? 0.62 : 0.9), { roughness: 0.6 });
    const shirt = M(shirtHex, { roughness: 0.86 });
    const shirtDark = M(shade(shirtHex, 0.82), { roughness: 0.86 });
    const pants = M(pantsHex, { roughness: 0.88 });
    const shoe = M(P.SHOE, { roughness: 0.42 });
    const hw = M(hwHex, { roughness: 0.84 });
    const ink = M('#1e1a1a', { roughness: 0.3 });
    const white = M('#f6f3ee', { roughness: 0.25 });
    const hijab = s.headwear === 'hijab';
    const covered = ['hijab', 'turban', 'cap', 'beanie', 'sunhat'].includes(s.headwear);
    const hairHidden = hijab || s.headwear === 'turban';

    const root = new T.Group();
    const hips = group({ p: [0, HIP, 0] });
    root.add(hips);

    // Trousers: pelvis and legs.
    hips.add(mesh(G('pelvis', () => new T.LatheGeometry([[0.0, -0.095], [0.08, -0.098], [0.135, -0.075], [0.156, -0.02], [0.158, 0.035], [0.155, 0.05]].map(([r, y]) => new T.Vector2(r, y)), 48)), pants, { s: [1, 1, 0.68] }));
    hips.add(mesh(G('belt', () => new T.CylinderGeometry(0.161, 0.161, 0.026, 48, 1, true)), M('#3a2c25', { roughness: 0.45 }), { p: [0, 0.03, 0], s: [1, 1, 0.68] }));
    hips.add(mesh(G('buckle', () => roundBox(0.034, 0.026, 0.008, 0.003)), M('#b9b2a2', { roughness: 0.25, metalness: 0.8 }), { p: [0, 0.03, 0.109] }));
    const legs = [];
    const knees = [];
    [-1, 1].forEach((side) => {
      const leg = group({ p: [side * 0.084, -0.02, 0] });
      leg.add(mesh(G('thigh', () => capsule(0.073, 0.33, 0.8, 1.02)), pants, { p: [0, -0.205, 0] }));
      const knee = group({ p: [0, -0.41, 0] });
      knee.add(mesh(G('shin', () => capsule(0.058, 0.28, 0.86, 1)), pants, { p: [0, -0.17, 0] }));
      knee.add(mesh(G('shoe', () => roundBox(0.084, 0.056, 0.235, 0.026)), shoe, { p: [0, -0.412, 0.038] }));
      leg.add(knee);
      hips.add(leg);
      legs.push(leg);
      knees.push(knee);
    });

    // Upper body: the spine twists, breathes and bends from here.
    const spine = group({ p: [0, 0.0, 0] });
    hips.add(spine);
    const TORSO = [[0.149, -0.03], [0.155, 0.06], [0.148, 0.15], [0.153, 0.24], [0.166, 0.33], [0.173, 0.4], [0.18, 0.445], [0.166, 0.49], [0.12, 0.53], [0.07, 0.556], [0.05, 0.566]];
    const torsoR = (y) => {
      for (let i = 1; i < TORSO.length; i += 1) {
        if (y <= TORSO[i][1]) {
          const [r0, y0] = TORSO[i - 1];
          const [r1, y1] = TORSO[i];
          return lerp(r0, r1, (y - y0) / (y1 - y0));
        }
      }
      return TORSO[TORSO.length - 1][0];
    };
    const torsoZ = (x, y, k) => 0.66 * Math.sqrt(Math.max(0, Math.pow(torsoR(y) * (k || 1), 2) - x * x));
    const chest = group();
    spine.add(chest);
    chest.add(mesh(G('torso', () => new T.LatheGeometry(TORSO.map(([r, y]) => new T.Vector2(r, y)), 48)), shirt, { s: [1, 1, 0.66] }));
    // Collar, placket and buttons.
    chest.add(mesh(G('collarStand', () => new T.CylinderGeometry(0.06, 0.066, 0.036, 40, 1, true, 0.42, Math.PI * 2 - 0.84)), G('mat:collar' + shirtHex, () => new T.MeshStandardMaterial({ color: shade(shirtHex, 0.9), roughness: 0.86, side: T.DoubleSide })), { p: [0, 0.56, 0.004] }));
    const point = new T.Shape();
    point.moveTo(0, 0);
    point.lineTo(0.05, 0.004);
    point.lineTo(0.012, -0.05);
    point.lineTo(0, 0);
    [-1, 1].forEach((side) => chest.add(mesh(G('collarPoint', () => new T.ExtrudeGeometry(point, { depth: 0.004, bevelEnabled: false })), shirtDark, { p: [side * 0.006, 0.556, 0.06], r: [-0.62, side > 0 ? 0 : Math.PI, side > 0 ? -0.42 : Math.PI + 0.42], s: [1, 1, 1] })));
    chest.add(mesh(G('placket', () => new T.BoxGeometry(0.012, 0.42, 0.004)), shirtDark, { p: [0, 0.3, torsoZ(0, 0.3) + 0.001] }, true));
    [0.46, 0.37, 0.28, 0.19, 0.1].forEach((y) => chest.add(mesh(G('button', () => new T.CylinderGeometry(0.0045, 0.0045, 0.003, 10)), M('#f3f1ec', { roughness: 0.3 }), { p: [0, y, torsoZ(0, y) + 0.004], r: [Math.PI / 2, 0, 0] }, true)));

    // Field vest: open at the front, with pockets and a reflective band.
    const front = s.vest === 'field' ? 1.07 : 1;
    if (s.vest === 'field') {
      const vestM = M(P.VEST, { roughness: 0.72 });
      const cut = (g) => {
        const p = g.attributes.position;
        for (let i = 0; i < p.count; i += 1) {
          if (Math.abs(Math.atan2(p.getX(i), p.getZ(i))) < 0.2) p.setXYZ(i, p.getX(i) * 0.8, p.getY(i), p.getZ(i) * 0.8);
        }
        g.computeVertexNormals();
        return g;
      };
      const VEST = TORSO.slice(0, 9).map(([r, y]) => [r * 1.07, y]).concat([[0.1, 0.535]]);
      chest.add(mesh(G('vest', () => cut(new T.LatheGeometry(VEST.map(([r, y]) => new T.Vector2(r, y)), 64))), vestM, { s: [1, 1, 0.66] }));
      chest.add(mesh(G('vestBand', () => cut(new T.LatheGeometry([[torsoR(0.2) * 1.085, 0.2], [torsoR(0.228) * 1.085, 0.228]].map(([r, y]) => new T.Vector2(r, y)), 64))), M('#dfe5ee', { roughness: 0.35, emissive: '#dfe5ee', emissiveIntensity: 0.12 }), { s: [1, 1, 0.66] }, true));
      [[-0.075, 0.37, 0.07, 0.06], [0.075, 0.37, 0.07, 0.06], [-0.08, 0.11, 0.085, 0.08], [0.08, 0.11, 0.085, 0.08]].forEach(([x, y, w, h]) => {
        const z = torsoZ(x, y, 1.07) + 0.004;
        const turn = Math.atan2(x, z) * 0.9;
        chest.add(mesh(G(`pocket${w}`, () => roundBox(w, h, 0.012, 0.004)), M(shade(P.VEST, 0.88), { roughness: 0.72 }), { p: [x, y, z], r: [0, turn, 0] }));
        chest.add(mesh(G(`flap${w}`, () => roundBox(w + 0.004, 0.018, 0.016, 0.004)), M(shade(P.VEST, 0.76), { roughness: 0.72 }), { p: [x, y + h / 2 - 0.006, z + 0.002], r: [0, turn, 0] }));
      });
    }

    // Arms: shoulder, elbow and hand, in shirt sleeves with cuffs.
    const shoulders = [];
    const elbows = [];
    const hands = [];
    [-1, 1].forEach((side) => {
      const sh = group({ p: [side * 0.186, 0.455, -0.005], r: [0, 0, side * 0.08] });
      sh.add(mesh(G('shoulderCap', () => new T.SphereGeometry(0.047, 24, 16)), shirt, { s: [1, 0.85, 0.9] }));
      sh.add(mesh(G('upperArm', () => capsule(0.047, 0.19, 0.84, 1)), shirt, { p: [0, -0.125, 0] }));
      const el = group({ p: [0, -0.255, 0], r: [-0.16, 0, 0] });
      el.add(mesh(G('forearm', () => capsule(0.041, 0.17, 0.78, 1)), shirt, { p: [0, -0.115, 0] }));
      el.add(mesh(G('cuff', () => new T.CylinderGeometry(0.034, 0.035, 0.03, 20)), shirtDark, { p: [0, -0.215, 0] }));
      const hand = group({ p: [0, -0.235, 0] });
      hand.add(mesh(G('palm', () => new T.SphereGeometry(0.05, 24, 18)), skin, { p: [0, -0.068, 0.004], s: [0.34, 1.55, 0.84] }));
      hand.add(mesh(G('thumb', () => capsule(0.012, 0.034, 0.85, 1)), skin, { p: [-side * 0.006, -0.045, 0.036], r: [0.55, 0, -side * 0.25] }));
      el.add(hand);
      sh.add(el);
      chest.add(sh);
      shoulders.push(sh);
      elbows.push(el);
      hands.push(hand);
    });

    // Neck and head.
    chest.add(mesh(G('neck', () => new T.CylinderGeometry(0.047, 0.054, 0.12, 24)), skin, { p: [0, 0.575, 0.002] }));
    const neck = group({ p: [0, 0.625, 0.004] });
    chest.add(neck);
    const head = group({ p: [0, 0.1, 0.006], s: 1.15 });
    neck.add(head);
    head.add(mesh(headGeo(), skin));

    // Ears.
    if (!hijab) {
      [-1, 1].forEach((side) => {
        head.add(mesh(G('ear', () => new T.SphereGeometry(1, 16, 12)), skin, { p: [side * 0.093, -0.004, -0.006], s: [0.014, 0.03, 0.011], r: [0, side * 0.25, 0] }));
        head.add(mesh(G('earIn', () => new T.SphereGeometry(1, 12, 10)), skinDark, { p: [side * 0.1, -0.004, -0.004], s: [0.006, 0.018, 0.006] }, true));
      });
    }

    // Eyes with lids that blink, irises that look, and catchlights.
    const eyes = [];
    const iris = M('#3a2a20', { roughness: 0.25 });
    const glint = G('mat:glint', () => new T.MeshBasicMaterial({ color: '#ffffff' }));
    [-1, 1].forEach((side) => {
      const x = side * 0.0355;
      const y = 0.006;
      const eye = group({ p: [x, y, surface(x, y) - 0.0095] });
      eye.add(mesh(G('eyeball', () => new T.SphereGeometry(0.0165, 20, 16)), white, null, true));
      const look = group();
      look.add(mesh(G('iris', () => new T.SphereGeometry(0.0086, 16, 12)), iris, { p: [0, 0, 0.0094] }, true));
      look.add(mesh(G('pupil', () => new T.SphereGeometry(0.0044, 12, 10)), ink, { p: [0, 0, 0.0145] }, true));
      look.add(mesh(G('glint', () => new T.SphereGeometry(0.0017, 8, 6)), glint, { p: [-0.0035, 0.0042, 0.0158] }, true));
      eye.add(look);
      const lid = group();
      lid.add(mesh(G('lid', () => new T.SphereGeometry(0.0176, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.5)), skin, null, true));
      lid.add(mesh(G('lash', () => new T.TorusGeometry(0.0176, 0.0011, 6, 24, Math.PI)), ink, { r: [Math.PI / 2, 0, 0] }, true));
      eye.add(lid);
      const low = group();
      low.add(mesh(G('lowLid', () => new T.SphereGeometry(0.0172, 20, 10, 0, Math.PI * 2, Math.PI * 0.62, Math.PI * 0.38)), skin, null, true));
      eye.add(low);
      head.add(eye);
      eyes.push({ eye, look, lid, low });
    });

    // Brows, nose and the mouth shapes for each mood.
    const brows = [-1, 1].map((side) => {
      const b = group({ p: [side * 0.036, 0.037, 0] });
      const pts = [-0.019, 0, 0.019].map((dx, i) => {
        const x = side * 0.036 + dx * side;
        return [dx * side, [0, 0.0045, -0.001][i] + (i === 2 ? -0.002 : 0), surface(x, 0.037 + (i === 1 ? 0.0045 : 0)) + 0.003];
      });
      b.add(mesh(G(`brow${side}`, () => new T.TubeGeometry(new T.CatmullRomCurve3(pts.map(([x, yy, z]) => V3(x, yy, z))), 12, 0.0037, 6, false)), browM, null, true));
      head.add(b);
      return b;
    });
    head.add(mesh(G('noseBridge', () => capsule(0.0072, 0.026)), skin, { p: [0, -0.013, surface(0, -0.013) - 0.0012], r: [-0.42, 0, 0] }, true));
    head.add(mesh(G('noseTip', () => new T.SphereGeometry(0.0108, 16, 12)), skin, { p: [0, -0.034, surface(0, -0.034) + 0.0022], s: [1.25, 0.85, 0.9] }, true));
    [-1, 1].forEach((side) => head.add(mesh(G('nostril', () => new T.SphereGeometry(0.006, 10, 8)), skinDark, { p: [side * 0.0095, -0.04, surface(side * 0.0095, -0.04) + 0.002], s: [1, 0.7, 0.8] }, true)));

    const mouth = {};
    const darkMouth = M('#4a1c1a', { roughness: 0.6 });
    mouth.happy = group(null, [mesh(G('smile', () => faceTube([[-0.022, -0.0645], [0, -0.0712], [0.022, -0.0645]], 0.0027, 0.0012)), lips, null, true),
      mesh(G('lipLow', () => faceTube([[-0.012, -0.0752], [0, -0.0772], [0.012, -0.0752]], 0.0032, 0.0008)), M(shade(lipHex, 1.1), { roughness: 0.5 }), null, true)]);
    mouth.think = group(null, [mesh(G('smirk', () => faceTube([[-0.019, -0.0688], [0.002, -0.0695], [0.021, -0.0638]], 0.0027, 0.0012)), lips, null, true)]);
    const open = new T.Shape();
    open.moveTo(-0.025, -0.062);
    open.lineTo(0.025, -0.062);
    open.quadraticCurveTo(0.023, -0.088, 0, -0.089);
    open.quadraticCurveTo(-0.023, -0.088, -0.025, -0.062);
    const teeth = new T.Shape();
    teeth.moveTo(-0.0215, -0.0632);
    teeth.lineTo(0.0215, -0.0632);
    teeth.lineTo(0.019, -0.0705);
    teeth.quadraticCurveTo(0, -0.0728, -0.019, -0.0705);
    teeth.lineTo(-0.0215, -0.0632);
    mouth.grin = group(null, [mesh(G('grinOpen', () => skinShape(open, 0.0011)), darkMouth, null, true), mesh(G('grinTeeth', () => skinShape(teeth, 0.0017)), white, null, true),
      mesh(G('grinLip', () => faceTube([[-0.026, -0.0615], [0, -0.0606], [0.026, -0.0615]], 0.0024, 0.0015)), lips, null, true)]);
    const oh = new T.Shape();
    oh.absellipse(0, -0.071, 0.0072, 0.0092, 0, Math.PI * 2, false, 0);
    mouth.oops = group(null, [mesh(G('ohOpen', () => skinShape(oh, 0.0012)), darkMouth, null, true),
      mesh(G('ohLip', () => new T.TorusGeometry(0.0082, 0.0026, 8, 24)), lips, { p: [0, -0.071, surface(0, -0.071) + 0.0012], s: [1, 1.22, 0.6] }, true)]);
    Object.values(mouth).forEach((m) => head.add(m));

    // Facial hair.
    if (s.facial === 'beard') {
      head.add(mesh(shell('beard', (ux, uy, uz) => cover(smooth(-0.04, 0.08, -0.2 - 0.2 * Math.max(0, uz) - uy) * smooth(-0.4, -0.1, uz) * smooth(0.9, 1.12, Math.hypot(ux / 0.33, (uy + 0.56) / 0.13)), 1.06)), hairM));
    }
    if (s.facial === 'mustache' || s.facial === 'beard') {
      head.add(mesh(G('mustache', () => faceTube([[-0.027, -0.0545], [-0.012, -0.0482], [0, -0.0505], [0.012, -0.0482], [0.027, -0.0545]], 0.0058, 0.004)), hairM, null, true));
    }

    // Hair.
    if (!hairHidden && s.hair !== 'none') {
      const front = !covered;
      const style = s.hair;
      const lift = { short: 0, buzz: 0.02, curly: -0.06, long: -0.12, bun: 0.02, braids: 0, ponytail: 0.02 }[style] || 0;
      const thick = { short: 1.06, buzz: 1.018, curly: 1.09, long: 1.055, bun: 1.045, braids: 1.04, ponytail: 1.045 }[style] || 1.05;
      if (front || style === 'long' || style === 'ponytail' || style === 'braids') {
        // Under a hat only the hair below the brim shows.
        head.add(mesh(shell(`hair-${style}-${front}`, (ux, uy, uz) => {
          const temples = style === 'curly' ? 0 : 0.1 * Math.max(0, uz) * smooth(0.2, 0.6, Math.abs(ux));
          const c = smooth(-0.05, 0.05, uy - hairline(uz, lift + temples)) * (front ? 1 : smooth(0.16, 0.04, uy));
          return cover(c, thick + (style === 'short' ? Math.max(0, uy) * (0.05 + 0.03 * ux) : 0) + (style === 'curly' ? Math.max(0, uy) * 0.08 : 0));
        }), hairM));
      }
      if (style === 'curly' && front) {
        const curls = G('curls', () => {
          const pts = [];
          for (let i = 0; i < 340; i += 1) {
            const u = (i + 0.5) / 340;
            const phi = i * 2.39996;
            const uy = 1 - u * 1.35;
            const r = Math.sqrt(Math.max(0, 1 - uy * uy));
            const ux = Math.cos(phi) * r;
            const uz = Math.sin(phi) * r;
            if (uy > hairline(uz, -0.02)) pts.push(headPoint(ux, uy, uz, 1.12 + 0.07 * Math.max(0, uy) + ((i * 53) % 7) / 220));
          }
          return pts;
        });
        const ball = G('curl', () => new T.IcosahedronGeometry(0.017, 2));
        const inst = new T.InstancedMesh(ball, hairM, curls.length);
        const m4 = new T.Matrix4();
        curls.forEach(([x, y, z], i) => {
          const k = 0.8 + ((i * 37) % 10) / 22;
          m4.compose(V3(x, y, z), new T.Quaternion(), V3(k, k, k));
          inst.setMatrixAt(i, m4);
        });
        inst.castShadow = true;
        head.add(inst);
      }
      if (style === 'long') {
        head.add(mesh(G('longBack', () => new T.LatheGeometry([[0.1, 0.02], [0.112, -0.08], [0.122, -0.2], [0.125, -0.3], [0.112, -0.34]].map(([r, y]) => new T.Vector2(r, y)), 40, Math.PI * 0.62, Math.PI * 1.76)), G('mat:hairBack' + hairHex, () => new T.MeshStandardMaterial({ color: hairHex, roughness: 0.46, metalness: 0.04, bumpMap: strands(), bumpScale: 0.5, side: T.DoubleSide })), { p: [0, 0, -0.01], s: [1, 1, 0.78] }));
        [-1, 1].forEach((side) => head.add(mesh(G('lock', () => capsule(0.03, 0.17, 0.7, 1)), hairM, { p: [side * 0.086, -0.115, 0.028], r: [0.1, 0, side * -0.08], s: [0.62, 1, 0.5] })));
      }
      if (style === 'bun' && front) head.add(mesh(G('bun', () => new T.SphereGeometry(0.052, 24, 18)), hairM, { p: [0, 0.122, -0.045] }));
      if (style === 'ponytail') {
        head.add(mesh(G('tie', () => new T.TorusGeometry(0.02, 0.006, 8, 16)), M(shade(hairHex, 0.55)), { p: [0, 0.04, -0.118], r: [0.3, 0, 0] }));
        head.add(mesh(G('tail', () => capsule(0.026, 0.2, 0.45, 1)), hairM, { p: [0, -0.07, -0.142], r: [-0.16, 0, 0] }));
      }
      if (style === 'braids') {
        [-1, 1].forEach((side) => {
          for (let i = 0; i < 8; i += 1) {
            head.add(mesh(G('braid', () => new T.SphereGeometry(0.019, 14, 10)), hairM, { p: [side * (0.086 + i * 0.002), -0.03 - i * 0.034, 0.012 + i * 0.012], s: [1, 1.25, 1] }));
          }
          head.add(mesh(G('bead', () => new T.SphereGeometry(0.009, 10, 8)), M('#d9a441', { roughness: 0.3, metalness: 0.6 }), { p: [side * 0.101, -0.31, 0.11] }));
        });
      }
    }

    // Head coverings.
    const hwDark = M(shade(hwHex, 0.8), { roughness: 0.84 });
    if (hijab) {
      head.add(mesh(shell('hijab', (ux, uy, uz) => cover(uz < 0 ? 1 : smooth(0.9, 1.1, Math.hypot(ux / 0.64, (uy + 0.16) / 0.68)), 1.15 + Math.max(0, uy) * 0.04)), hw));
      chest.add(mesh(G('drape', () => new T.LatheGeometry([[0.07, 0.6], [0.085, 0.56], [0.12, 0.53], [0.19, 0.49], [0.23, 0.45], [0.235, 0.43]].map(([r, y]) => new T.Vector2(r, y)), 48)), hw, { s: [1, 1, 0.72] }));
    }
    if (s.headwear === 'turban') {
      const wrapM = G('mat:turban' + hwHex, () => new T.MeshStandardMaterial({ color: hwHex, roughness: 0.82, bumpMap: wraps(), bumpScale: 2.5 }));
      head.add(mesh(shell('turban', (ux, uy, uz) => cover(smooth(-0.06, 0.06, uy - (0.12 + 0.42 * uz)), 1.12 + 0.3 * Math.pow(Math.max(0, uy), 1.6) + 0.06 * Math.max(0, uz) * Math.max(0, uy))), wrapM));
    }
    if (s.headwear === 'cap') {
      head.add(mesh(G('capCrown', () => new T.SphereGeometry(1, 40, 20, 0, Math.PI * 2, 0, Math.PI * 0.5)), hw, { p: [0, 0.03, -0.004], s: [0.104, 0.112, 0.114], r: [-0.12, 0, 0] }));
      const brim = new T.Shape();
      brim.absellipse(0, 0, 0.098, 0.075, 0, Math.PI, false, 0);
      head.add(mesh(G('capBrim', () => new T.ExtrudeGeometry(brim, { depth: 0.006, bevelEnabled: false, curveSegments: 20 })), hwDark, { p: [0, 0.048, 0.07], r: [Math.PI / 2 - 0.12, 0, 0] }));
      head.add(mesh(G('capButton', () => new T.SphereGeometry(0.008, 10, 8)), hwDark, { p: [0, 0.141, -0.012] }));
    }
    if (s.headwear === 'beanie') {
      head.add(mesh(G('beanie', () => new T.SphereGeometry(1, 40, 20, 0, Math.PI * 2, 0, Math.PI * 0.52)), hw, { p: [0, 0.035, -0.006], s: [0.106, 0.124, 0.116], r: [-0.12, 0, 0] }));
      head.add(mesh(G('cuffRing', () => new T.TorusGeometry(0.104, 0.017, 12, 40)), hwDark, { p: [0, 0.042, -0.004], r: [Math.PI / 2 - 0.12, 0, 0], s: [1, 1.1, 1] }));
      head.add(mesh(G('pompom', () => new T.IcosahedronGeometry(0.032, 2)), M(shade(hwHex, 1.1), { roughness: 0.95 }), { p: [0, 0.165, -0.03] }));
    }
    if (s.headwear === 'sunhat') {
      const straw = M('#d6b471', { roughness: 0.92 });
      head.add(mesh(G('hatBrim', () => new T.LatheGeometry([[0.096, 0.07], [0.16, 0.062], [0.215, 0.046], [0.232, 0.034]].map(([r, y]) => new T.Vector2(r, y)), 56)), G('mat:brim', () => new T.MeshStandardMaterial({ color: '#d6b471', roughness: 0.92, side: T.DoubleSide })), { s: [1, 1, 1.05] }));
      head.add(mesh(G('hatCrown', () => new T.CylinderGeometry(0.078, 0.098, 0.085, 40)), straw, { p: [0, 0.11, -0.004] }));
      head.add(mesh(G('hatTop', () => new T.SphereGeometry(1, 32, 12, 0, Math.PI * 2, 0, Math.PI * 0.5)), straw, { p: [0, 0.152, -0.004], s: [0.078, 0.025, 0.078] }));
      head.add(mesh(G('hatBand', () => new T.CylinderGeometry(0.094, 0.0975, 0.022, 40, 1, true)), M('#7a5a35', { roughness: 0.7 }), { p: [0, 0.083, -0.004] }));
    }
    if (s.headwear === 'headphones') {
      const dark = M('#3a4150', { roughness: 0.4, metalness: 0.3 });
      head.add(mesh(G('band', () => new T.TorusGeometry(0.114, 0.0075, 8, 40, Math.PI)), dark, { p: [0, 0.012, -0.004] }));
      [-1, 1].forEach((side) => head.add(mesh(G('cup', () => new T.CylinderGeometry(0.034, 0.034, 0.028, 24)), hw, { p: [side * 0.108, 0.004, -0.004], r: [0, 0, Math.PI / 2] })));
      head.add(mesh(G('boom', () => tube([[-0.11, -0.018, 0.012], [-0.09, -0.06, 0.07], [-0.045, -0.074, 0.097]], 0.0035)), dark));
      head.add(mesh(G('mic', () => new T.SphereGeometry(0.008, 10, 8)), dark, { p: [-0.043, -0.075, 0.098] }));
    }

    // Glasses.
    if (s.glasses !== 'none') {
      const frame = M('#2e3446', { roughness: 0.35, metalness: 0.35 });
      const lens = G('mat:lens', () => new T.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.14, roughness: 0.05, metalness: 0.1 }));
      [-1, 1].forEach((side) => {
        const x = side * 0.0355;
        const z = surface(x, 0.006) + 0.011;
        if (s.glasses === 'round') {
          head.add(mesh(G('rimRound', () => new T.TorusGeometry(0.0215, 0.0023, 8, 32)), frame, { p: [x, 0.006, z] }, true));
          head.add(mesh(G('lensRound', () => new T.CircleGeometry(0.021, 28)), lens, { p: [x, 0.006, z] }, true));
        } else {
          const outer = new T.Shape();
          const rr = (sh, w, h, r) => {
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
          };
          rr(outer, 0.05, 0.036, 0.009);
          outer.holes.push(rr(new T.Path(), 0.043, 0.029, 0.007));
          head.add(mesh(G('rimSquare', () => new T.ExtrudeGeometry(outer, { depth: 0.004, bevelEnabled: false, curveSegments: 6 })), frame, { p: [x, 0.006, z - 0.002] }, true));
          head.add(mesh(G('lensSquare', () => new T.ShapeGeometry(rr(new T.Shape(), 0.044, 0.03, 0.007))), lens, { p: [x, 0.006, z] }, true));
        }
        head.add(mesh(G('temple', () => new T.BoxGeometry(0.003, 0.003, 0.085)), frame, { p: [side * 0.072, 0.009, z - 0.045], r: [0, side * 0.32, 0] }, true));
      });
      head.add(mesh(G('bridge', () => tube([[-0.013, 0.009, 0], [0, 0.014, 0.002], [0.013, 0.009, 0]], 0.0018, 10)), frame, { p: [0, 0, surface(0, 0.01) + 0.005] }, true));
    }

    // Gear.
    const chestZ = (x, y) => torsoZ(x, y, front) + 0.004;
    if (s.gear === 'lanyard') {
      const blue = M('#2f6fd0', { roughness: 0.6 });
      [-1, 1].forEach((side) => chest.add(mesh(G(`strap${front}`, () => tube([[0.03, 0.57, -0.04], [0.058, 0.552, 0.03], [0.04, 0.47, chestZ(0.04, 0.47)], [0.004, 0.405, chestZ(0, 0.405)]], 0.0045)), blue, { s: [side, 1, 1] })));
      const card = group({ p: [0, 0.37, chestZ(0, 0.37) + 0.006] }, [mesh(G('card', () => roundBox(0.05, 0.068, 0.004, 0.0018)), M('#ffffff', { roughness: 0.4 })),
        mesh(G('cardBand', () => new T.BoxGeometry(0.05, 0.014, 0.005)), blue, { p: [0, 0.026, 0] }),
        mesh(G('cardPhoto', () => new T.BoxGeometry(0.015, 0.018, 0.005)), M('#c9d3e2'), { p: [-0.012, 0.0, 0] }, true)]);
      chest.add(card);
    }
    if (s.gear === 'backpack') {
      const pack = M('#b5643a', { roughness: 0.8 });
      chest.add(mesh(G('pack', () => roundBox(0.3, 0.36, 0.13, 0.03)), pack, { p: [0, 0.29, -0.17] }));
      [-1, 1].forEach((side) => chest.add(mesh(G(`packStrap${front}`, () => tube([[0.09, 0.47, -0.12], [0.105, 0.552, -0.01], [0.1, 0.45, chestZ(0.1, 0.45)], [0.105, 0.2, chestZ(0.105, 0.2)]], 0.011)), M('#7c3f22', { roughness: 0.7 }), { s: [side, 1, 1] })));
    }
    if (s.gear === 'camera') {
      chest.add(mesh(G(`camStrap${front}`, () => tube([[-0.1, 0.55, 0.02], [-0.04, 0.42, chestZ(-0.04, 0.42)], [0.08, 0.22, chestZ(0.08, 0.22)], [0.13, 0.12, chestZ(0.13, 0.12)]], 0.005)), M('#2b2f3a', { roughness: 0.6 })));
      chest.add(group({ p: [0.13, 0.1, chestZ(0.13, 0.1) + 0.03] }, [mesh(G('camBody', () => roundBox(0.095, 0.062, 0.045, 0.008)), M('#2f3443', { roughness: 0.35, metalness: 0.3 })),
        mesh(G('lensBarrel', () => new T.CylinderGeometry(0.022, 0.024, 0.035, 24)), M('#1d2029', { roughness: 0.3, metalness: 0.4 }), { p: [0, 0, 0.035], r: [Math.PI / 2, 0, 0] }),
        mesh(G('lensGlass', () => new T.CircleGeometry(0.018, 24)), M('#4e6c9e', { roughness: 0.05, metalness: 0.6 }), { p: [0, 0, 0.0531] }, true)]));
    }
    if (s.gear === 'binoculars') {
      [-1, 1].forEach((side) => chest.add(mesh(G(`binoStrap${front}`, () => tube([[-0.035, 0.57, -0.03], [-0.05, 0.52, 0.06], [-0.025, 0.42, chestZ(-0.025, 0.42)]], 0.0035)), M('#2b2f3a'), { s: [side, 1, 1] }, true)));
      chest.add(group({ p: [0, 0.37, chestZ(0, 0.37) + 0.025] }, [-1, 1].map((side) => mesh(G('barrel', () => new T.CylinderGeometry(0.019, 0.021, 0.075, 20)), M('#2f3443', { roughness: 0.4, metalness: 0.3 }), { p: [side * 0.024, 0, 0] }))
        .concat([mesh(G('binoBridge', () => new T.BoxGeometry(0.03, 0.018, 0.016)), M('#2f3443', { roughness: 0.4, metalness: 0.3 }), { p: [0, 0.02, 0] })])));
    }
    if (s.gear === 'medal') {
      chest.add(mesh(G('ribbon', () => new T.BoxGeometry(0.022, 0.03, 0.003)), M('#2f6fd0', { roughness: 0.6 }), { p: [0.085, 0.43, chestZ(0.085, 0.43)], r: [0, 0.5, 0] }));
      chest.add(mesh(G('medalDisc', () => new T.CylinderGeometry(0.017, 0.017, 0.004, 24)), M('#e2a92b', { roughness: 0.25, metalness: 0.8 }), { p: [0.085, 0.402, chestZ(0.085, 0.402) + 0.002], r: [Math.PI / 2, 0, 0.5] }));
    }
    if (s.gear === 'radio') {
      hands[1].add(group({ p: [0.0, -0.06, 0.03], r: [0.2, 0, 0] }, [mesh(G('radio', () => roundBox(0.036, 0.095, 0.024, 0.005)), M('#2f3443', { roughness: 0.4, metalness: 0.2 })),
        mesh(G('antenna', () => new T.CylinderGeometry(0.003, 0.004, 0.07, 8)), M('#2f3443', { roughness: 0.4 }), { p: [0.01, 0.08, 0] }),
        mesh(G('led', () => new T.SphereGeometry(0.003, 8, 6)), G('mat:led', () => new T.MeshBasicMaterial({ color: '#ff6b5b' })), { p: [-0.01, 0.04, 0.013] }, true)]));
    }

    const fig = { root, hips, spine, chest, neck, head, legs, knees, shoulders, elbows, hands, eyes, brows, mouth, mood: '', action: null, look: 0, lookTarget: 0, blinkAt: 1 + Math.random() * 3, phase: Math.random() * 10, talkUntil: 0, base: {} };
    fig.base.shoulders = shoulders.map((x) => x.rotation.clone());
    fig.base.elbows = elbows.map((x) => x.rotation.clone());
    setMood(fig, o.mood || 'happy', true);
    return fig;
  }

  // Fine strands for hair, as a bump map running from the crown down.
  let strandTex = null;
  function strands() {
    if (!strandTex) {
      const c = document.createElement('canvas');
      c.width = 512;
      c.height = 64;
      const g = c.getContext('2d');
      g.fillStyle = '#808080';
      g.fillRect(0, 0, 512, 64);
      for (let i = 0; i < 900; i += 1) {
        const x = (i * 97.3) % 512;
        g.strokeStyle = `rgba(${i % 2 ? 255 : 0},${i % 2 ? 255 : 0},${i % 2 ? 255 : 0},${0.04 + (i % 7) / 70})`;
        g.lineWidth = 1 + (i % 3) * 0.5;
        g.beginPath();
        g.moveTo(x, 0);
        g.lineTo(x + ((i % 5) - 2) * 2, 64);
        g.stroke();
      }
      strandTex = new T.CanvasTexture(c);
      strandTex.wrapS = T.RepeatWrapping;
      strandTex.wrapT = T.RepeatWrapping;
    }
    return strandTex;
  }

  // Diagonal folds for a wrapped turban, as a bump map.
  let wrapTex = null;
  function wraps() {
    if (!wrapTex) {
      const c = document.createElement('canvas');
      c.width = 512;
      c.height = 256;
      const g = c.getContext('2d');
      g.fillStyle = '#808080';
      g.fillRect(0, 0, 512, 256);
      for (let i = -8; i < 16; i += 1) {
        const x = i * 46;
        const lg = g.createLinearGradient(x, 0, x + 34, 0);
        lg.addColorStop(0, 'rgba(0,0,0,0.55)');
        lg.addColorStop(0.35, 'rgba(255,255,255,0.5)');
        lg.addColorStop(1, 'rgba(0,0,0,0)');
        g.save();
        g.translate(x, 0);
        g.transform(1, 0, 0.9, 1, 0, 0);
        g.fillStyle = lg;
        g.translate(-x, 0);
        g.fillRect(x, 0, 40, 256);
        g.restore();
      }
      wrapTex = new T.CanvasTexture(c);
      wrapTex.wrapS = T.RepeatWrapping;
    }
    return wrapTex;
  }

  function headGeo() {
    return G('head', () => {
      const g = new T.SphereGeometry(1, 56, 40);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i += 1) {
        const [x, y, z] = headPoint(p.getX(i), p.getY(i), p.getZ(i), 1);
        p.setXYZ(i, x, y, z);
      }
      g.computeVertexNormals();
      return g;
    });
  }

  // ---------- expressions and motion ----------
  const MOODS = {
    happy: { brow: [0, 0], tilt: [0, 0], lid: -0.58, low: 0.1, look: [0, 0] },
    grin: { brow: [0.003, 0.003], tilt: [0.05, 0.05], lid: -0.45, low: -0.22, look: [0, 0] },
    think: { brow: [0.006, -0.001], tilt: [-0.12, 0.08], lid: -0.52, low: 0.1, look: [0.0045, 0.0035] },
    oops: { brow: [0.004, 0.004], tilt: [0.28, 0.28], lid: -0.8, low: 0.16, look: [0, -0.001] }
  };
  function setMood(f, mood, now) {
    const m = MOODS[mood] ? mood : 'happy';
    f.mood = m;
    Object.keys(f.mouth).forEach((k) => { f.mouth[k].visible = k === m; });
    f.face = MOODS[m];
    if (now) f.faceNow = Object.assign({}, f.face, { brow: f.face.brow.slice(), tilt: f.face.tilt.slice(), look: f.face.look.slice() });
  }

  const ACTIONS = { jump: 'cheer', tilt: 'ponder', shake: 'doubt', walk: 'walk' };
  function play(f, name, t, extra) {
    f.action = Object.assign({ name: ACTIONS[name] || name, t0: t }, extra || {});
    if (f.action.name === 'walk') {
      f.root.position.x = f.action.from;
      f.root.rotation.y = Math.PI / 2;
    }
  }

  // Frees what a figure owns; shared geometry and materials stay cached for the next one.
  function dispose(f) {
    f.root.traverse((o) => { if (o.isInstancedMesh) o.dispose(); });
    if (f.root.parent) f.root.parent.remove(f.root);
  }

  // One frame of life: breathing, weight shift, blinking, looking and any action in progress.
  function animate(f, t, dt) {
    const ph = t + f.phase;
    const breath = Math.sin(ph * 1.65);
    f.chest.scale.set(1 + breath * 0.004, 1 + breath * 0.004, 1 + breath * 0.012);
    f.hips.rotation.z = Math.sin(ph * 0.42) * 0.012;
    f.hips.position.x = Math.sin(ph * 0.42) * 0.006;
    f.hips.position.y = HIP;
    f.spine.rotation.set(0, 0, -f.hips.rotation.z * 0.6);
    f.legs.forEach((l, i) => { l.rotation.set(0, 0, (i ? -1 : 1) * f.hips.rotation.z * 0.5); });
    f.knees.forEach((k) => k.rotation.set(0, 0, 0));
    f.shoulders.forEach((sh, i) => sh.rotation.copy(f.base.shoulders[i]));
    f.elbows.forEach((el, i) => el.rotation.copy(f.base.elbows[i]));
    f.shoulders.forEach((sh, i) => { sh.rotation.x += Math.sin(ph * 0.9 + i) * 0.015; });

    // Look toward the target, with small natural movements.
    f.look = damp(f.look, f.lookTarget, 4, dt);
    f.neck.rotation.set(Math.sin(ph * 0.7) * 0.02 + 0.03, f.look * 0.7 + Math.sin(ph * 0.31) * 0.04, Math.sin(ph * 0.5) * 0.015);
    f.spine.rotation.y = f.look * 0.25;

    // Expressions ease into place.
    const cur = f.faceNow;
    const goal = f.face;
    [0, 1].forEach((i) => {
      cur.brow[i] = damp(cur.brow[i], goal.brow[i], 10, dt);
      cur.tilt[i] = damp(cur.tilt[i], goal.tilt[i], 10, dt);
      cur.look[i] = damp(cur.look[i], goal.look[i], 6, dt);
    });
    cur.lid = damp(cur.lid, goal.lid, 10, dt);
    cur.low = damp(cur.low, goal.low, 10, dt);
    f.brows.forEach((b, i) => {
      b.position.y = 0.037 + cur.brow[i];
      b.rotation.z = (i ? -1 : 1) * cur.tilt[i];
    });

    // Blink every few seconds.
    let lid = cur.lid;
    if (!reduceMotion) {
      if (t > f.blinkAt + 0.18) f.blinkAt = t + 2 + Math.random() * 4;
      const b = t - f.blinkAt;
      if (b > 0 && b < 0.18) lid = lerp(lid, 0.95, Math.sin((b / 0.18) * Math.PI));
    }
    f.eyes.forEach((e) => {
      e.lid.rotation.x = lid;
      e.low.rotation.x = cur.low;
      e.look.position.set(cur.look[0], cur.look[1], 0);
    });

    // Talking: the mouth opens and closes softly while a speech bubble is fresh.
    const talking = t < f.talkUntil && !reduceMotion;
    if (talking) {
      const open = Math.sin(t * 13) > 0.15;
      f.mouth.grin.visible = open && f.mood !== 'oops';
      f.mouth[f.mood].visible = !open || f.mood === 'oops';
      if (f.mood === 'grin') f.mouth.grin.visible = true;
    } else if (f.wasTalking) {
      Object.keys(f.mouth).forEach((k) => { f.mouth[k].visible = k === f.mood; });
    }
    f.wasTalking = talking;

    if (f.action) runAction(f, t, dt);
  }

  function runAction(f, t, dt) {
    const a = f.action;
    const k = t - a.t0;
    if (a.name === 'cheer') {
      const d = 1.1;
      if (k > d) { f.action = null; return; }
      const u = k / d;
      const hop = Math.max(0, Math.sin(u * Math.PI * 2)) * 0.035 * (1 - u);
      f.hips.position.y = HIP + hop;
      f.neck.rotation.x += Math.sin(u * Math.PI * 4) * 0.12 * (1 - u);
      f.shoulders[1].rotation.x -= Math.sin(u * Math.PI) * 0.5;
      f.elbows[1].rotation.x -= Math.sin(u * Math.PI) * 0.9;
    } else if (a.name === 'ponder' || a.name === 'think-hold') {
      const d = a.name === 'ponder' ? 1.8 : 1e9;
      if (k > d) { f.action = null; return; }
      const env = a.name === 'ponder' ? Math.sin(Math.min(1, k / d) * Math.PI) : Math.min(1, k / 0.6);
      f.neck.rotation.z += 0.16 * env;
      f.shoulders[1].rotation.x -= 0.95 * env;
      f.shoulders[1].rotation.z -= 0.15 * env;
      f.elbows[1].rotation.x -= 1.95 * env;
      f.elbows[1].rotation.y += 0.35 * env;
    } else if (a.name === 'doubt') {
      const d = 0.9;
      if (k > d) { f.action = null; return; }
      const u = k / d;
      f.neck.rotation.y += Math.sin(u * Math.PI * 3) * 0.2 * (1 - u * 0.6);
    } else if (a.name === 'gesture') {
      const d = 1.6;
      if (k > d) { f.action = null; return; }
      const env = Math.sin((k / d) * Math.PI);
      f.shoulders[1].rotation.x -= 0.55 * env;
      f.shoulders[1].rotation.z -= 0.12 * env;
      f.elbows[1].rotation.x -= 0.75 * env;
      f.elbows[1].rotation.y += 0.25 * env;
    } else if (a.name === 'wave') {
      const d = 2;
      if (k > d) { f.action = null; return; }
      const env = Math.sin(Math.min(1, k / d) * Math.PI);
      f.shoulders[1].rotation.z -= 2.3 * env;
      f.elbows[1].rotation.z -= 0.6 * env + Math.sin(k * 9) * 0.25 * env;
    } else if (a.name === 'walk') {
      const d = a.dur || 1.8;
      const u = Math.min(1, k / d);
      const x = lerp(a.from, a.to, ease(u) * 0.35 + u * 0.65);
      f.root.position.x = x;
      const stride = Math.sin(k * 7.4);
      const on = u < 1 ? 1 : Math.max(0, 1 - (k - d) / 0.3);
      f.legs[0].rotation.x = stride * 0.42 * on;
      f.legs[1].rotation.x = -stride * 0.42 * on;
      f.knees[0].rotation.x = Math.max(0, -stride) * 0.6 * on;
      f.knees[1].rotation.x = Math.max(0, stride) * 0.6 * on;
      f.shoulders[0].rotation.x -= stride * 0.3 * on;
      f.shoulders[1].rotation.x += stride * 0.3 * on;
      f.hips.position.y = HIP + Math.abs(Math.cos(k * 7.4)) * 0.018 * on;
      const turn = u < 1 ? 0 : Math.min(1, (k - d) / 0.45);
      f.root.rotation.y = lerp(Math.PI / 2, a.face, ease(turn));
      if (turn >= 1) { f.root.rotation.y = a.face; f.action = null; }
    }
  }

  // ---------- lights ----------
  function lights(scene, o) {
    const golden = o && o.golden;
    const hemi = new T.HemisphereLight(golden ? '#ffd9b0' : '#dcecff', golden ? '#6b5440' : '#8a7a60', golden ? 1.25 : 1.5);
    scene.add(hemi);
    const sun = new T.DirectionalLight(golden ? '#ffc58a' : '#fff4e2', golden ? 2.4 : 2.8);
    sun.position.set(golden ? -5 : -4, golden ? 4.5 : 9, 6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -7;
    sun.shadow.camera.right = 7;
    sun.shadow.camera.top = 6;
    sun.shadow.camera.bottom = -4;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 30;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.02;
    sun.shadow.radius = 4;
    scene.add(sun);
    const rim = new T.DirectionalLight(golden ? '#ffb27a' : '#cfe6ff', golden ? 1.4 : 1.0);
    rim.position.set(4, 5, -6);
    scene.add(rim);
    const fill = new T.DirectionalLight('#ffffff', 0.35);
    fill.position.set(5, 2, 5);
    scene.add(fill);
    return { hemi, sun, rim, fill };
  }

  function renderer(canvasHost, opts) {
    const r = new T.WebGLRenderer({ antialias: true, alpha: Boolean(opts && opts.alpha), powerPreference: 'high-performance', preserveDrawingBuffer: Boolean(opts && opts.keep) });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, (opts && opts.dpr) || 2));
    r.outputColorSpace = T.SRGBColorSpace;
    r.toneMapping = T.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;
    r.shadowMap.enabled = true;
    r.shadowMap.type = T.PCFSoftShadowMap;
    if (canvasHost) canvasHost.appendChild(r.domElement);
    return r;
  }

  // A soft contact shadow under a figure, to ground it even where the sun's shadow falls behind.
  let blobTex = null;
  function blob(size) {
    if (!blobTex) {
      const c = document.createElement('canvas');
      c.width = 128;
      c.height = 128;
      const g = c.getContext('2d');
      const rg = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      rg.addColorStop(0, 'rgba(18,24,34,0.42)');
      rg.addColorStop(0.55, 'rgba(18,24,34,0.16)');
      rg.addColorStop(1, 'rgba(18,24,34,0)');
      g.fillStyle = rg;
      g.fillRect(0, 0, 128, 128);
      blobTex = new T.CanvasTexture(c);
    }
    const m = new T.Mesh(G('blobPlane', () => new T.PlaneGeometry(1, 1)), G('mat:blob', () => new T.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false })));
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.004;
    m.scale.set(size, size * 0.62, 1);
    m.renderOrder = 1;
    return m;
  }

  // ---------- settings ----------
  // Each setting is a small diorama around the characters (who stand near z = 0), lit by the sun,
  // with fog that fades distant things into the sky like the glow around the globe.
  const box = (w, h, d, mat, at, noShadow) => mesh(G(`box${w},${h},${d}`, () => new T.BoxGeometry(w, h, d)), mat, at, noShadow);
  const cyl = (rt, rb, h, mat, at, segs, noShadow) => mesh(G(`cyl${rt},${rb},${h},${segs || 24}`, () => new T.CylinderGeometry(rt, rb, h, segs || 24)), mat, at, noShadow);
  function canvasTex(key, w, h, draw, repeat) {
    return G(`tex:${key}`, () => {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      draw(c.getContext('2d'), w, h);
      const t = new T.CanvasTexture(c);
      t.colorSpace = T.SRGBColorSpace;
      t.anisotropy = 4;
      if (repeat) {
        t.wrapS = T.RepeatWrapping;
        t.wrapT = T.RepeatWrapping;
        t.repeat.set(repeat[0], repeat[1]);
      }
      return t;
    });
  }
  const hash = (n) => {
    const x = Math.sin(n * 127.1) * 43758.5453;
    return x - Math.floor(x);
  };
  // Speckled ground: sand, earth, grass, paving or floorboards.
  function groundTex(kind, base) {
    return canvasTex(`ground-${kind}-${base}`, 512, 512, (g, w, h) => {
      g.fillStyle = base;
      g.fillRect(0, 0, w, h);
      if (kind === 'tiles' || kind === 'boards') {
        g.strokeStyle = 'rgba(70,50,30,0.22)';
        g.lineWidth = 2;
        const step = kind === 'tiles' ? 64 : 42;
        for (let i = 0; i <= w; i += step) {
          g.beginPath();
          g.moveTo(i, 0);
          g.lineTo(i, h);
          g.stroke();
        }
        if (kind === 'tiles') {
          for (let j = 0; j <= h; j += 64) {
            g.beginPath();
            g.moveTo(0, j);
            g.lineTo(w, j);
            g.stroke();
          }
        } else {
          for (let i = 0; i < w; i += 42) {
            for (let j = (i * 7) % 160; j < h; j += 160) {
              g.beginPath();
              g.moveTo(i, j);
              g.lineTo(i + 42, j);
              g.stroke();
            }
          }
        }
      }
      for (let i = 0; i < 2600; i += 1) {
        const v = hash(i) > 0.5 ? 255 : 0;
        g.fillStyle = `rgba(${v},${v},${v},${0.03 + hash(i + 9) * 0.05})`;
        const r = 1 + hash(i + 3) * (kind === 'grass' ? 3 : 2);
        g.fillRect(hash(i + 1) * w, hash(i + 2) * h, r, kind === 'grass' ? r * 2.2 : r);
      }
    }, kind === 'boards' ? [6, 6] : [24, 24]);
  }

  function skyDome(o) {
    const mat = new T.ShaderMaterial({
      side: T.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: { top: { value: new T.Color(o.top) }, horizon: { value: new T.Color(o.horizon) }, sun: { value: o.sun.clone().normalize() }, glow: { value: new T.Color(o.glow) } },
      vertexShader: 'varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform vec3 top; uniform vec3 horizon; uniform vec3 sun; uniform vec3 glow; varying vec3 vDir;
        void main() {
          vec3 d = normalize(vDir);
          float h = clamp(d.y, 0.0, 1.0);
          vec3 c = mix(horizon, top, pow(h, 0.5));
          float s = max(dot(d, sun), 0.0);
          c += glow * (pow(s, 900.0) * 3.0 + pow(s, 40.0) * 0.45 + pow(s, 6.0) * 0.18);
          gl_FragColor = vec4(c, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`
    });
    const m = new T.Mesh(G('skyBall', () => new T.SphereGeometry(95, 40, 20)), mat);
    m.renderOrder = -1;
    return m;
  }

  // A lumpy canopy blob for trees and bushes.
  const canopyGeo = () => G('canopy', () => {
    const g = new T.IcosahedronGeometry(1, 3);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i += 1) {
      const v = V3(p.getX(i), p.getY(i), p.getZ(i));
      const n = 1 + 0.09 * Math.sin(v.x * 7.1 + v.y * 3.3) * Math.cos(v.z * 6.7 - v.y * 2.1) + 0.05 * Math.sin(v.y * 13 + v.x * 5);
      v.multiplyScalar(n);
      p.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    return g;
  });
  function tree(at, s, tint, noShadow) {
    const g = group(at);
    g.add(mesh(G('trunk', () => taper(new T.CylinderGeometry(0.1, 0.15, 1.7, 12), 1, 0.7)), M('#6b4a31', { roughness: 0.95 }), { p: [0, 0.85, 0] }, noShadow));
    const leaf = M(tint || '#5a9a4f', { roughness: 0.88 });
    const dark = M(shade(tint || '#5a9a4f', 0.82), { roughness: 0.9 });
    [[0, 2.35, 0, 1.05, leaf], [0.7, 2.05, 0.25, 0.75, dark], [-0.68, 2.1, -0.1, 0.8, leaf], [0.2, 2.85, -0.25, 0.72, leaf], [-0.3, 2.55, 0.5, 0.62, dark]]
      .forEach(([x, y, z, r, m]) => g.add(mesh(canopyGeo(), m, { p: [x, y, z], s: r }, noShadow)));
    g.scale.multiplyScalar(s || 1);
    return g;
  }
  const bush = (at, s, tint) => group(at, [[0, 0.32, 0, 0.42], [0.35, 0.26, 0.1, 0.32], [-0.32, 0.25, 0.05, 0.3]].map(([x, y, z, r]) => mesh(canopyGeo(), M(tint || '#5f9a4c', { roughness: 0.9 }), { p: [x * (s || 1), y * (s || 1), z], s: r * (s || 1) })));

  // Window, door and roof textures.
  function facadeTex(key, o) {
    return canvasTex(`facade-${key}`, 256, Math.round(256 * o.h / o.w), (g, w, h) => {
      const lg = g.createLinearGradient(0, 0, 0, h);
      lg.addColorStop(0, shade(o.wall, 1.04));
      lg.addColorStop(1, shade(o.wall, 0.9));
      g.fillStyle = lg;
      g.fillRect(0, 0, w, h);
      g.fillStyle = shade(o.wall, 0.78);
      g.fillRect(0, 0, w, 10);
      const floors = Math.max(1, Math.floor((o.h - 1.6) / 2.6));
      const cols = Math.max(1, Math.round(o.w / 1.9));
      const ppm = h / o.h;
      for (let f = 0; f < floors; f += 1) {
        for (let c = 0; c < cols; c += 1) {
          const ww = (w / cols) * 0.42;
          const x = (w / cols) * (c + 0.5) - ww / 2;
          const y = 22 + f * 2.6 * ppm;
          const wh = 1.3 * ppm;
          if (o.shutters) {
            g.fillStyle = o.shutters;
            g.fillRect(x - ww * 0.42, y, ww * 0.38, wh);
            g.fillRect(x + ww * 1.04, y, ww * 0.38, wh);
          }
          const gl = g.createLinearGradient(0, y, 0, y + wh);
          gl.addColorStop(0, o.glow ? '#ffe7ad' : '#cfe4f3');
          gl.addColorStop(1, o.glow ? '#f0a85c' : '#5f86aa');
          g.fillStyle = gl;
          g.fillRect(x, y, ww, wh);
          g.strokeStyle = shade(o.wall, 0.7);
          g.lineWidth = 3;
          g.strokeRect(x, y, ww, wh);
          g.beginPath();
          g.moveTo(x + ww / 2, y);
          g.lineTo(x + ww / 2, y + wh);
          g.stroke();
          g.fillStyle = shade(o.wall, 0.8);
          g.fillRect(x - 3, y + wh, ww + 6, 4);
          if (o.balcony && f === 0 && c % 2 === 0) {
            g.strokeStyle = '#4a5266';
            g.lineWidth = 2;
            g.strokeRect(x - 6, y + wh - 14, ww + 12, 14);
            for (let k = 0; k < 6; k += 1) {
              g.beginPath();
              g.moveTo(x - 6 + k * (ww + 12) / 5, y + wh - 14);
              g.lineTo(x - 6 + k * (ww + 12) / 5, y + wh);
              g.stroke();
            }
          }
        }
      }
      const sh = 1.9 * ppm;
      g.fillStyle = shade(o.wall, 0.86);
      g.fillRect(0, h - sh - 8, w, sh + 8);
      const dw = w * 0.36;
      const dl = g.createLinearGradient(0, h - sh, 0, h);
      dl.addColorStop(0, o.glow ? '#ffd894' : '#6f5a4a');
      dl.addColorStop(1, o.glow ? '#e9a55a' : '#4b3c32');
      g.fillStyle = dl;
      g.fillRect((w - dw) / 2, h - sh, dw, sh);
      if (o.awning) {
        for (let i = 0; i < 10; i += 1) {
          g.fillStyle = i % 2 ? '#fbf3e4' : o.awning;
          g.fillRect((w - dw) / 2 - 10 + i * (dw + 20) / 10, h - sh - 22, (dw + 20) / 10, 18);
        }
      }
    });
  }
  function building(o, at) {
    const side = M(shade(o.wall, 0.86), { roughness: 0.92 });
    const front = new T.MeshStandardMaterial({ map: facadeTex(`${o.w}x${o.h}-${o.wall}-${o.shutters || ''}-${o.glow ? 1 : 0}-${o.balcony ? 1 : 0}-${o.awning || ''}`, o), roughness: 0.9, emissive: o.glow ? '#ffffff' : '#000000', emissiveMap: o.glow ? facadeTex(`${o.w}x${o.h}-${o.wall}-${o.shutters || ''}-1-${o.balcony ? 1 : 0}-${o.awning || ''}`, o) : null, emissiveIntensity: o.glow ? 0.35 : 0 });
    const g = group(at);
    g.add(mesh(G(`bld${o.w},${o.h},${o.d || 6}`, () => new T.BoxGeometry(o.w, o.h, o.d || 6)), [side, side, M(shade(o.wall, 0.75)), side, front, side], { p: [0, o.h / 2, 0] }, true));
    g.add(box(o.w + 0.3, 0.3, (o.d || 6) + 0.3, M(shade(o.wall, 0.78), { roughness: 0.9 }), { p: [0, o.h + 0.15, 0] }, true));
    return g;
  }

  // A plastered house with a corrugated metal hip roof.
  function house(o, at) {
    const g = group(at);
    const wall = M(o.wall, { roughness: 0.93 });
    g.add(box(o.w, o.h, o.d, wall, { p: [0, o.h / 2, 0] }, o.far));
    g.add(box(o.w + 0.06, 0.24, o.d + 0.06, M(shade(o.wall, 0.78), { roughness: 0.95 }), { p: [0, 0.12, 0] }, true));
    const ribs = canvasTex(`roof-${o.roof}`, 256, 64, (c, w, h) => {
      c.fillStyle = o.roof;
      c.fillRect(0, 0, w, h);
      for (let x = 0; x < w; x += 8) {
        const lg = c.createLinearGradient(x, 0, x + 8, 0);
        lg.addColorStop(0, 'rgba(255,255,255,0.28)');
        lg.addColorStop(0.5, 'rgba(0,0,0,0.12)');
        lg.addColorStop(1, 'rgba(255,255,255,0.05)');
        c.fillStyle = lg;
        c.fillRect(x, 0, 8, h);
      }
    });
    g.add(mesh(G('hipRoof', () => new T.ConeGeometry(Math.SQRT1_2, 1, 4, 1)), new T.MeshStandardMaterial({ map: ribs, roughness: 0.42, metalness: 0.45 }), { p: [0, o.h + 0.45, 0], r: [0, Math.PI / 4, 0], s: [o.w + 0.6, 0.9, o.d + 0.6] }, o.far));
    const glass = M('#5f86aa', { roughness: 0.15, metalness: 0.3 });
    const frame = M('#f4efe6', { roughness: 0.6 });
    [-0.3, 0.3].forEach((fx) => {
      g.add(box(0.62, 0.72, 0.06, frame, { p: [fx * o.w, o.h * 0.58, o.d / 2 + 0.01] }, true));
      g.add(box(0.5, 0.6, 0.07, glass, { p: [fx * o.w, o.h * 0.58, o.d / 2 + 0.02] }, true));
    });
    g.add(box(0.72, 1.55, 0.07, M('#7a5236', { roughness: 0.7 }), { p: [0, 0.78, o.d / 2 + 0.02] }, true));
    return g;
  }

  // A ridge tent: canvas gable, a door flap and sometimes a blue tarp.
  function tent(o, at) {
    const g = group(at);
    const shape = new T.Shape();
    shape.moveTo(-o.w / 2, 0);
    shape.lineTo(o.w / 2, 0);
    shape.lineTo(0, o.h);
    shape.lineTo(-o.w / 2, 0);
    g.add(mesh(G(`tent${o.w},${o.h},${o.d}`, () => new T.ExtrudeGeometry(shape, { depth: o.d, bevelEnabled: false }).translate(0, 0, -o.d / 2)), M('#ece8de', { roughness: 0.95 }), null, o.far));
    const door = new T.Shape();
    door.moveTo(-o.w * 0.16, 0);
    door.lineTo(o.w * 0.16, 0);
    door.lineTo(0, o.h * 0.62);
    door.lineTo(-o.w * 0.16, 0);
    g.add(mesh(G(`tentDoor${o.w},${o.h}`, () => new T.ShapeGeometry(door)), M('#6f7889', { roughness: 0.9 }), { p: [0, 0.01, o.d / 2 + 0.01] }, true));
    if (o.tarp) {
      const slope = Math.atan2(o.h, o.w / 2);
      g.add(box(o.w * 0.42, 0.02, o.d * 0.6, M('#3f7fc4', { roughness: 0.6 }), { p: [-o.w * 0.25, o.h * 0.5, 0], r: [0, 0, slope] }, true));
    }
    return g;
  }

  function jerrycan(at, r) {
    return group(at, [mesh(G('jerry', () => roundBox(0.24, 0.33, 0.15, 0.035)), M('#f0c43a', { roughness: 0.45 }), { p: [0, 0.165, 0] }),
      mesh(G('jerryCap', () => new T.CylinderGeometry(0.025, 0.025, 0.04, 12)), M('#2f6fd0', { roughness: 0.4 }), { p: [0.07, 0.35, 0] }, true),
      mesh(G('jerryHandle', () => new T.TorusGeometry(0.045, 0.012, 8, 16, Math.PI)), M('#d9a51f', { roughness: 0.45 }), { p: [-0.04, 0.33, 0] }, true)]).rotateY(r || 0);
  }

  // A market stall: striped awning, posts, a cloth-fronted table and piles of produce.
  function stall(color, at) {
    const g = group(at);
    const wood = M('#7a5a3c', { roughness: 0.8 });
    [-1, 1].forEach((sx) => [-1, 1].forEach((sz) => g.add(cyl(0.035, 0.035, 2.1, wood, { p: [sx * 1.05, 1.05, sz * 0.45] }, 10))));
    const stripes = canvasTex(`stripes-${color}`, 256, 64, (c, w, h) => {
      for (let i = 0; i < 8; i += 1) {
        c.fillStyle = i % 2 ? '#fbf3e4' : color;
        c.fillRect(i * 32, 0, 32, h);
      }
    });
    g.add(mesh(G('awning', () => new T.BoxGeometry(2.4, 0.04, 1.3)), new T.MeshStandardMaterial({ map: stripes, roughness: 0.85 }), { p: [0, 2.15, 0.08], r: [0.2, 0, 0] }));
    g.add(box(2.2, 0.08, 0.95, M('#b98b5c', { roughness: 0.7 }), { p: [0, 0.86, 0] }));
    g.add(box(2.16, 0.78, 0.04, M(shade(color, 0.9), { roughness: 0.9 }), { p: [0, 0.44, 0.47] }));
    const fruit = [['#f08a2c', -0.6], ['#d9452f', 0], ['#7ab648', 0.6]];
    fruit.forEach(([c, x]) => {
      const pile = [[-0.12, 0], [0, 0], [0.12, 0], [-0.06, 0.1], [0.06, 0.1], [0, 0.2], [-0.06, 0], [0.06, 0]];
      pile.forEach(([dx, dy], i) => g.add(mesh(G('fruit', () => new T.SphereGeometry(0.06, 14, 10)), M(c, { roughness: 0.45 }), { p: [x + dx, 0.96 + dy * 0.9, (i > 5 ? -0.12 : 0.05)] })));
    });
    return g;
  }

  // A catenary of lights or flags between two points.
  function catenary(a, b, sag, n) {
    const pts = [];
    for (let i = 0; i <= n; i += 1) {
      const t = i / n;
      pts.push(V3(lerp(a[0], b[0], t), lerp(a[1], b[1], t) - Math.sin(t * Math.PI) * sag, lerp(a[2], b[2], t)));
    }
    return pts;
  }

  function mountains(color, z, n, seed) {
    const g = group();
    for (let i = 0; i < n; i += 1) {
      const h = 6 + hash(i + seed) * 9;
      g.add(mesh(G(`peak${i % 3}`, () => new T.ConeGeometry(1, 1, 7 + (i % 3), 1)), M(color, { roughness: 1 }), { p: [-60 + i * (120 / n) + hash(i * 3 + seed) * 6, h / 2 - 0.5, z - hash(i + 7) * 12], s: [8 + hash(i + 2) * 7, h, 6 + hash(i + 5) * 4], r: [0, hash(i) * 3, 0] }, true));
    }
    return g;
  }

  const SKY = {
    day: { top: '#2f80d0', horizon: '#d4ebf8', glow: '#fff1c8', sun: [-0.35, 0.55, -0.75] },
    golden: { top: '#a7697a', horizon: '#fbd2a2', glow: '#ffcb7a', sun: [0.55, 0.1, -0.85] }
  };

  const SETTINGS = {
    village(ctx) {
      const { add } = ctx;
      add(mountains('#9fb7a6', -55, 9, 1));
      add(ctx.ground('earth', '#d6bb88'));
      add(mesh(G('villagePath', () => {
        const s = new T.Shape();
        s.moveTo(-2.6, 6);
        s.bezierCurveTo(-1.6, 1, 1.5, -3, 4.5, -9);
        s.lineTo(6.2, -9);
        s.bezierCurveTo(3, -3, 0.4, 1, -0.6, 6);
        s.lineTo(-2.6, 6);
        return new T.ShapeGeometry(s, 24).rotateX(-Math.PI / 2).translate(0, 0.006, 0);
      }), M('#e6d1a6', { roughness: 1 }), null, true));
      add(house({ w: 4.2, h: 2.6, d: 3.4, wall: '#efdcbf', roof: '#97a3ae' }, { p: [-5.2, 0, -7.5], r: [0, 0.18, 0] }));
      add(house({ w: 3.4, h: 2.3, d: 3, wall: '#e5cda9', roof: '#a5afb9', far: true }, { p: [-0.6, 0, -11], r: [0, -0.1, 0] }));
      add(house({ w: 4.6, h: 2.8, d: 3.6, wall: '#f2e4cb', roof: '#8a97a3' }, { p: [5.6, 0, -8], r: [0, -0.22, 0] }));
      add(tree({ p: [2.6, 0, -6] }, 1.15));
      add(tree({ p: [-9, 0, -12] }, 1.3, '#6aa257', true));
      add(tree({ p: [10, 0, -14] }, 1.2, '#6aa257', true));
      add(bush({ p: [-2.8, 0, -4.5] }, 1.1));
      add(bush({ p: [6.8, 0, -4.2] }, 1));
    },
    office(ctx) {
      const { add } = ctx;
      add(ctx.ground('boards', '#c9a77e'));
      const wallM = M('#e9eef3', { roughness: 0.95 });
      const z = -3.6;
      // Back wall with a wide window onto the city.
      add(box(30, 1.0, 0.25, wallM, { p: [0, 0.5, z] }, true));
      add(box(30, 2.0, 0.25, wallM, { p: [0, 4.2, z] }, true));
      add(box(12.8, 2.2, 0.25, wallM, { p: [-10.6, 2.1, z] }, true));
      add(box(13.8, 2.2, 0.25, wallM, { p: [8.1, 2.1, z] }, true));
      add(box(30, 0.12, 0.3, M('#cfd6de'), { p: [0, 0.06, z + 0.05] }, true));
      const frame = M('#f8fafc', { roughness: 0.5 });
      [[-4.2, 2.1, 0.12, 2.2], [1.2, 2.1, 0.12, 2.2], [-1.5, 2.1, 0.08, 2.2]].forEach(([x, y, w, h]) => add(box(w, h, 0.2, frame, { p: [x, y, z] }, true)));
      add(box(5.6, 0.1, 0.2, frame, { p: [-1.5, 1.0, z] }, true));
      add(box(5.6, 0.1, 0.2, frame, { p: [-1.5, 3.2, z] }, true));
      add(box(5.8, 0.08, 0.45, M('#ffffff', { roughness: 0.5 }), { p: [-1.5, 0.98, z + 0.2] }, true));
      [[-6, 3.5, -16], [-3, 5, -18], [0.5, 4, -17], [3, 6, -20], [-8.5, 4.5, -19]].forEach(([x, h, zz], i) => add(building({ w: 2.6, h: h + 2, wall: ['#c9d6e3', '#d9cfc2', '#bfcbd8'][i % 3] }, { p: [x, -0.5, zz] })));
      // Whiteboard, clock and cabinet.
      const board = canvasTex('whiteboard', 512, 256, (g, w, h) => {
        g.fillStyle = '#fdfefe';
        g.fillRect(0, 0, w, h);
        g.strokeStyle = '#7aa7d8';
        g.lineWidth = 7;
        g.lineCap = 'round';
        [[40, 60, 190], [40, 95, 150], [40, 130, 170]].forEach(([x, y, l]) => { g.beginPath(); g.moveTo(x, y); g.lineTo(x + l, y); g.stroke(); });
        g.strokeStyle = '#2f80c4';
        g.lineWidth = 5;
        g.strokeRect(270, 45, 80, 52);
        g.strokeRect(400, 45, 80, 52);
        g.beginPath();
        g.moveTo(350, 71);
        g.lineTo(400, 71);
        g.stroke();
        [['#ffe08a', 300, 150], ['#a9d4ff', 365, 158], ['#ffc2d1', 430, 148]].forEach(([c, x, y]) => { g.fillStyle = c; g.fillRect(x, y, 50, 50); });
      });
      add(box(2.5, 1.3, 0.05, M('#c9d1db', { roughness: 0.5 }), { p: [3.6, 2.2, z + 0.15] }, true));
      add(mesh(G('boardFace', () => new T.PlaneGeometry(2.36, 1.16)), new T.MeshStandardMaterial({ map: board, roughness: 0.35 }), { p: [3.6, 2.2, z + 0.18] }, true));
      const clock = canvasTex('clock', 128, 128, (g) => {
        g.fillStyle = '#ffffff';
        g.beginPath();
        g.arc(64, 64, 60, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = '#4a5266';
        g.lineWidth = 8;
        g.stroke();
        g.lineWidth = 6;
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(64, 64);
        g.lineTo(64, 26);
        g.moveTo(64, 64);
        g.lineTo(92, 78);
        g.stroke();
      });
      add(mesh(G('clockFace', () => new T.CircleGeometry(0.32, 32)), new T.MeshStandardMaterial({ map: clock, roughness: 0.4 }), { p: [6.1, 2.7, z + 0.14] }, true));
      add(box(1.6, 1.1, 0.5, M('#c9b08d', { roughness: 0.7 }), { p: [7.2, 0.55, z + 0.35] }));
      ['#2f80c4', '#e2735f', '#3faa86', '#e6b13e', '#8268cc', '#2f80c4', '#3faa86'].forEach((c, i) => add(box(0.12, 0.38, 0.3, M(c, { roughness: 0.6 }), { p: [6.65 + i * 0.16, 1.29, z + 0.35] })));
      // Meeting table with laptops, papers and chairs.
      const wood = M('#b98f63', { roughness: 0.55 });
      add(box(3.6, 0.07, 1.2, wood, { p: [0.4, 0.76, -2.1] }));
      [[-1.3, -2.5], [2.1, -2.5], [-1.3, -1.7], [2.1, -1.7]].forEach(([x, zz]) => add(cyl(0.035, 0.035, 0.74, M('#5b4636'), { p: [x, 0.37, zz] }, 10)));
      [-0.6, 1.0].forEach((x) => {
        add(box(0.42, 0.02, 0.3, M('#9aa3b5', { roughness: 0.3, metalness: 0.5 }), { p: [x, 0.805, -2.1] }));
        add(box(0.42, 0.28, 0.02, M('#3a4150', { roughness: 0.3, metalness: 0.4 }), { p: [x, 0.95, -2.25], r: [-0.25, 0, 0] }));
      });
      add(box(0.3, 0.005, 0.22, M('#ffffff', { roughness: 0.8 }), { p: [0.2, 0.8, -1.9], r: [0, 0.2, 0] }, true));
      add(cyl(0.04, 0.035, 0.1, M('#ffffff', { roughness: 0.4 }), { p: [1.7, 0.84, -1.85] }, 16));
      [-0.8, 0.4, 1.6].forEach((x) => {
        add(box(0.5, 0.06, 0.48, M('#3d4658', { roughness: 0.6 }), { p: [x, 0.5, -2.95] }));
        add(box(0.5, 0.6, 0.06, M('#3d4658', { roughness: 0.6 }), { p: [x, 0.85, -3.2] }));
        add(cyl(0.03, 0.03, 0.45, M('#7d8597', { metalness: 0.6, roughness: 0.3 }), { p: [x, 0.25, -2.95] }, 8));
      });
      // A plant by the window.
      const pot = group({ p: [-4.9, 0, -2.6] }, [cyl(0.24, 0.18, 0.5, M('#d9765c', { roughness: 0.8 }), { p: [0, 0.25, 0] })]);
      for (let i = 0; i < 9; i += 1) {
        const a = (i / 9) * Math.PI * 2;
        pot.add(mesh(G('leafBlade', () => new T.SphereGeometry(1, 12, 8)), M(i % 2 ? '#3f8f5e' : '#4ea36d', { roughness: 0.7 }), { p: [Math.cos(a) * 0.16, 0.85 + (i % 3) * 0.1, Math.sin(a) * 0.16], s: [0.06, 0.42, 0.13], r: [Math.sin(a) * 0.5, a, Math.cos(a) * 0.5] }));
      }
      add(pot);
      add(mesh(G('lightPatch', () => new T.PlaneGeometry(5.4, 3.2).rotateX(-Math.PI / 2)), G('mat:lightPatch', () => new T.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.12, depthWrite: false })), { p: [-0.6, 0.008, -1.4], r: [0, 0.35, 0] }, true));
    },
    camp(ctx) {
      const { add } = ctx;
      add(mountains('#c4ae8e', -55, 9, 4));
      add(ctx.ground('sand', '#dcc69c'));
      [-9, -5.5, -2, 1.5, 5, 8.5].forEach((x, i) => add(tent({ w: 3, h: 2, d: 3.6, tarp: i === 3, far: true }, { p: [x, 0, -14 - (i % 2) * 2], r: [0, (hash(i) - 0.5) * 0.3, 0] })));
      add(tent({ w: 3.2, h: 2.2, d: 3.8 }, { p: [-6, 0, -7], r: [0, 0.25, 0] }));
      add(tent({ w: 3, h: 2.1, d: 3.6, tarp: true }, { p: [5.5, 0, -8], r: [0, -0.2, 0] }));
      // The assessment desk under a shade canopy.
      const desk = group({ p: [-1.6, 0, -2.6], r: [0, 0.12, 0] });
      [-1, 1].forEach((sx) => [-1, 1].forEach((sz) => desk.add(cyl(0.03, 0.03, 2.3, M('#8a93a3', { metalness: 0.6, roughness: 0.3 }), { p: [sx * 1.4, 1.15, sz * 1.1] }, 10))));
      desk.add(mesh(G('canopyRoof', () => new T.ConeGeometry(Math.SQRT1_2, 1, 4, 1)), M('#f4f6f8', { roughness: 0.8 }), { p: [0, 2.55, 0], r: [0, Math.PI / 4, 0], s: [3.3, 0.55, 2.7] }));
      desk.add(box(3.3, 0.18, 2.7, M('#2f80c4', { roughness: 0.7 }), { p: [0, 2.21, 0] }));
      desk.add(box(1.8, 0.05, 0.75, M('#eef1f4', { roughness: 0.6 }), { p: [0, 0.75, 0] }));
      [-0.75, 0.75].forEach((x) => desk.add(cyl(0.025, 0.025, 0.73, M('#8a93a3'), { p: [x, 0.37, 0] }, 8)));
      desk.add(box(0.32, 0.01, 0.24, M('#ffffff'), { p: [-0.4, 0.78, 0.05] }, true));
      desk.add(box(0.24, 0.02, 0.32, M('#b88a55', { roughness: 0.6 }), { p: [0.35, 0.785, 0.05] }));
      [-0.5, 0.5].forEach((x) => {
        desk.add(box(0.42, 0.05, 0.42, M('#3f86c9', { roughness: 0.5 }), { p: [x, 0.45, -0.7] }));
        desk.add(box(0.42, 0.42, 0.05, M('#3f86c9', { roughness: 0.5 }), { p: [x, 0.7, -0.9] }));
      });
      add(desk);
      // Water tank on a stand.
      const tank = group({ p: [2.9, 0, -3.4] });
      [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]].forEach(([x, zz]) => tank.add(cyl(0.04, 0.04, 1.2, M('#7c8494', { metalness: 0.5, roughness: 0.4 }), { p: [x, 0.6, zz] }, 8)));
      tank.add(cyl(0.72, 0.72, 1.2, M('#3f86c9', { roughness: 0.45 }), { p: [0, 1.82, 0] }, 32));
      tank.add(cyl(0.74, 0.74, 0.06, M('#2d6aa6', { roughness: 0.45 }), { p: [0, 2.44, 0] }, 32));
      add(tank);
      for (let i = 0; i < 6; i += 1) add(cyl(0.05, 0.05, 1.1, M('#8a6b45', { roughness: 0.9 }), { p: [6 + i * 1.2, 0.55, -3 - i * 0.15] }, 8));
      add(box(6.2, 0.05, 0.05, M('#8a6b45'), { p: [9, 0.85, -3.4], r: [0, 0.12, 0] }));
    },
    market(ctx) {
      const { add } = ctx;
      add(ctx.ground('tiles', '#d8c3a0'));
      const row = [[-11, 6, 7.5, '#e8cda6', '#3f8f9a'], [-5.2, 5.4, 6.4, '#dcb894', null], [0.2, 5.2, 8.2, '#efdcc2', '#4d6fa8'], [5.4, 5.2, 6.6, '#d8b48c', null], [10.8, 5.6, 7.8, '#e6d3b8', '#a65d3f']];
      row.forEach(([x, w, h, wall, shutters], i) => add(building({ w, h, wall, shutters, balcony: i % 2 === 1, awning: ['#c2603f', '#3f8f9a', '#d39a2b'][i % 3] }, { p: [x, 0, -9] })));
      // Rooftop radio mast.
      const mast = group({ p: [5.4, 6.6, -10] });
      [-1, 1].forEach((s1) => [-1, 1].forEach((s2) => mast.add(mesh(G('mastLeg', () => new T.CylinderGeometry(0.025, 0.025, 3.2, 6)), M('#7d8597', { metalness: 0.6, roughness: 0.3 }), { p: [s1 * 0.12, 1.6, s2 * 0.12], r: [s2 * 0.035, 0, -s1 * 0.035] }, true))));
      mast.add(mesh(G('beacon', () => new T.SphereGeometry(0.08, 12, 8)), G('mat:beacon', () => new T.MeshBasicMaterial({ color: '#ff5d4f' })), { p: [0, 3.25, 0] }, true));
      add(mast);
      add(stall('#c2603f', { p: [-2.0, 0, -3.2], r: [0, 0.1, 0] }));
      add(stall('#3f8f9a', { p: [1.6, 0, -4.2], r: [0, -0.05, 0] }));
      add(stall('#d39a2b', { p: [5.4, 0, -3.4], r: [0, -0.15, 0] }));
      const flags = catenary([-12, 4.6, -6.5], [12, 4.4, -6.5], 0.8, 24);
      add(mesh(new T.TubeGeometry(new T.CatmullRomCurve3(flags), 48, 0.012, 4), M('#5b4a3e'), null, true));
      const flag = new T.Shape();
      flag.moveTo(-0.16, 0);
      flag.lineTo(0.16, 0);
      flag.lineTo(0, -0.34);
      flag.lineTo(-0.16, 0);
      flags.forEach((p, i) => { if (i % 1 === 0 && i < flags.length - 1) add(mesh(G('flag', () => new T.ShapeGeometry(flag)), G(`mat:flag${i % 5}`, () => new T.MeshStandardMaterial({ color: ['#d9534f', '#f0ad4e', '#3f8f9a', '#4d6fa8', '#7ab648'][i % 5], side: T.DoubleSide, roughness: 0.8 })), { p: [p.x, p.y, p.z] }, true)); });
    },
    town(ctx) {
      const { add, golden } = ctx;
      add(ctx.ground('tiles', '#cfc8bc'));
      [[-12, 6.5, 8.5, '#e9d6b9', null], [-6.6, 5, 7, '#d6e0ea', null], [6.8, 5.6, 8.6, '#f0dcc4', '#5a7fa8'], [12.4, 5.8, 7.2, '#dfe8d8', null]]
        .forEach(([x, w, h, wall, shutters], i) => add(building({ w, h, wall, shutters, glow: golden, balcony: i % 2 === 1, awning: i === 3 ? '#4d6fa8' : null }, { p: [x, 0, -10] })));
      // The civic portico.
      const civic = group({ p: [0.2, 0, -10.5] });
      const stone = M('#efe5d4', { roughness: 0.85 });
      civic.add(box(8, 5.4, 4, stone, { p: [0, 3.0, -1] }, true));
      civic.add(box(7.4, 4.4, 0.2, M('#cbbda5', { roughness: 0.9 }), { p: [0, 2.8, 1.0] }, true));
      civic.add(box(1.3, 2.4, 0.1, golden ? M('#e9a55a', { emissive: '#ffb45c', emissiveIntensity: 0.6 }) : M('#5a4436', { roughness: 0.7 }), { p: [0, 1.8, 1.12] }, true));
      [-3, -1.8, -0.6, 0.6, 1.8, 3].forEach((x) => civic.add(cyl(0.22, 0.25, 4.2, M('#f6efe3', { roughness: 0.7 }), { p: [x, 2.7, 1.6] }, 20, true)));
      const ped = new T.Shape();
      ped.moveTo(-4.3, 0);
      ped.lineTo(4.3, 0);
      ped.lineTo(0, 1.5);
      ped.lineTo(-4.3, 0);
      civic.add(mesh(G('pediment', () => new T.ExtrudeGeometry(ped, { depth: 1.2, bevelEnabled: false })), stone, { p: [0, 5.1, 0.6] }, true));
      civic.add(box(8.8, 0.3, 1.6, stone, { p: [0, 4.95, 1.2] }, true));
      [0, 1, 2].forEach((i) => civic.add(box(8.4 + i * 0.6, 0.18, 1.0 + i * 0.5, M('#ddd3c1', { roughness: 0.9 }), { p: [0, 0.09 + (2 - i) * 0.18, 1.9 + i * 0.25] }, true)));
      add(civic);
      [[-4.2, -5.5], [4.6, -5.8]].forEach(([x, zz]) => {
        const lamp = group({ p: [x, 0, zz] }, [cyl(0.06, 0.08, 3.6, M('#4a5266', { metalness: 0.5, roughness: 0.4 }), { p: [0, 1.8, 0] }, 12),
          box(0.5, 0.06, 0.06, M('#4a5266'), { p: [0.22, 3.55, 0] }),
          mesh(G('lampHead', () => new T.ConeGeometry(0.2, 0.22, 16, 1, true)), M('#4a5266', { side: T.DoubleSide }), { p: [0.44, 3.45, 0] }),
          mesh(G('bulb', () => new T.SphereGeometry(0.09, 12, 8)), golden ? G('mat:bulbOn', () => new T.MeshBasicMaterial({ color: '#fff1c4' })) : M('#eef2f6', { roughness: 0.2 }), { p: [0.44, 3.36, 0] }, true)]);
        if (golden) {
          const pl = new T.PointLight('#ffcf8a', 6, 9, 1.6);
          pl.position.set(0.44, 3.2, 0);
          lamp.add(pl);
        }
        add(lamp);
      });
      [[-8.4, -6.2], [8.8, -6.6]].forEach(([x, zz]) => {
        add(box(1.2, 0.5, 1.2, M('#b9ad98', { roughness: 0.9 }), { p: [x, 0.25, zz] }));
        add(tree({ p: [x, 0.4, zz] }, 0.75));
      });
    },
    fields(ctx) {
      const { add } = ctx;
      add(mountains('#8fa9c4', -70, 10, 7));
      add(mountains('#9cbf86', -40, 8, 3));
      add(ctx.ground('grass', '#8dbb5e'));
      // Crop rows in real perspective: green on the left, ripe grain on the right.
      const rows = new T.InstancedMesh(G('cropRow', () => new T.BoxGeometry(0.34, 0.26, 40)), M('#6fa847', { roughness: 0.9 }), 22);
      const grain = new T.InstancedMesh(G('cropRow', () => new T.BoxGeometry(0.34, 0.26, 40)), M('#d9bd5a', { roughness: 0.9 }), 22);
      const m4 = new T.Matrix4();
      for (let i = 0; i < 22; i += 1) {
        m4.makeTranslation(-14 + i * 0.6, 0.13, -24);
        rows.setMatrixAt(i, m4);
        m4.makeTranslation(1.2 + i * 0.6, 0.13, -24);
        grain.setMatrixAt(i, m4);
      }
      rows.receiveShadow = true;
      grain.receiveShadow = true;
      add(rows);
      add(grain);
      add(house({ w: 3.6, h: 2.4, d: 3, wall: '#f3e6d2', roof: '#b5533c', far: true }, { p: [9, 0, -22], r: [0, -0.3, 0] }));
      for (let i = 0; i < 8; i += 1) add(tree({ p: [-12 + i * 1.6, 0, -30 - (i % 2)] }, 0.55, '#5e9b4c', true));
      add(tree({ p: [-5.2, 0, -5] }, 0.95));
      add(tree({ p: [4.4, 0, -9] }, 0.8, '#68a556'));
      for (let i = 0; i < 9; i += 1) add(cyl(0.05, 0.06, 1.1, M('#8a6b45', { roughness: 0.9 }), { p: [3.4 + i * 1.3, 0.55, -2.4 - i * 0.05] }, 8));
      [0.45, 0.85].forEach((y) => add(box(11, 0.06, 0.05, M('#8a6b45', { roughness: 0.9 }), { p: [8.6, y, -2.6], r: [0, 0.04, 0] })));
    }
  };

  const PROPS3D = {
    pump(ctx) {
      const g = group({ p: [-0.9, 0, -1.4] });
      g.add(cyl(0.75, 0.82, 0.08, M('#cfcac0', { roughness: 0.9 }), { p: [0, 0.04, 0] }, 32));
      g.add(cyl(0.065, 0.07, 0.95, M('#2f73b8', { roughness: 0.35, metalness: 0.3 }), { p: [0, 0.55, 0] }, 16));
      g.add(cyl(0.1, 0.1, 0.12, M('#245f99', { roughness: 0.35, metalness: 0.3 }), { p: [0, 1.06, 0] }, 16));
      g.add(cyl(0.022, 0.022, 0.75, M('#3a4150', { roughness: 0.4, metalness: 0.5 }), { p: [0.32, 1.2, 0], r: [0, 0, 1.1] }, 8));
      g.add(cyl(0.035, 0.035, 0.32, M('#2f73b8', { roughness: 0.35, metalness: 0.3 }), { p: [-0.16, 0.8, 0.06], r: [0, 0, 1.4] }, 10));
      g.add(jerrycan({ p: [-0.55, 0.08, 0.35] }, 0.4));
      g.add(jerrycan({ p: [0.5, 0.08, 0.4] }, -0.3));
      g.add(jerrycan({ p: [0.85, 0, 0.75] }, 0.9));
      ctx.add(g);
    },
    signpost(ctx) {
      const g = group({ p: [-0.9, 0, -1.6] });
      g.add(cyl(0.06, 0.07, 2.6, M('#8a6444', { roughness: 0.8 }), { p: [0, 1.3, 0] }, 10));
      const sign = (dir, y, color, patch) => {
        const tex = canvasTex(`sign-${color}-${patch}`, 256, 64, (c, w, h) => {
          c.fillStyle = color;
          c.fillRect(0, 0, w, h);
          c.strokeStyle = 'rgba(255,255,255,0.9)';
          c.lineWidth = 8;
          c.lineCap = 'round';
          c.beginPath();
          c.moveTo(40, 32);
          c.lineTo(190, 32);
          c.stroke();
          if (patch) {
            c.fillStyle = '#e8e2d4';
            c.fillRect(110, 12, 90, 40);
          }
        });
        const s = new T.Shape();
        s.moveTo(0, -0.14);
        s.lineTo(0.95, -0.14);
        s.lineTo(1.12, 0);
        s.lineTo(0.95, 0.14);
        s.lineTo(0, 0.14);
        s.lineTo(0, -0.14);
        const geo = G(`arrow${dir}`, () => {
          const e = new T.ExtrudeGeometry(s, { depth: 0.04, bevelEnabled: false });
          const uv = e.attributes.uv;
          const p = e.attributes.position;
          for (let i = 0; i < uv.count; i += 1) uv.setXY(i, p.getX(i) / 1.12, (p.getY(i) + 0.14) / 0.28);
          return e;
        });
        return mesh(geo, new T.MeshStandardMaterial({ map: tex, roughness: 0.6 }), { p: [0, y, 0.04], r: [0, dir < 0 ? Math.PI : 0, 0] });
      };
      g.add(sign(1, 2.25, '#2f6aa6', false));
      g.add(sign(-1, 1.85, '#2f7d5b', true));
      ctx.add(g);
    },
    track(ctx) {
      ctx.add(mesh(G('track', () => {
        const s = new T.Shape();
        s.moveTo(-3.2, 7);
        s.bezierCurveTo(-1.6, 0, 1.2, -10, 2.2, -40);
        s.lineTo(3.4, -40);
        s.bezierCurveTo(2.6, -10, 0.6, 0, -0.4, 7);
        s.lineTo(-3.2, 7);
        return new T.ShapeGeometry(s, 32).rotateX(-Math.PI / 2).translate(0, 0.012, 0);
      }), M('#c9a46d', { roughness: 1 }), null, true));
      [-0.55, 0.55].forEach((dx) => ctx.add(mesh(G(`rut${dx}`, () => new T.TubeGeometry(new T.CatmullRomCurve3([V3(-1.8 + dx, 0.016, 7), V3(-0.3 + dx * 0.8, 0.016, -2), V3(1.6 + dx * 0.5, 0.016, -14), V3(2.8 + dx * 0.2, 0.016, -40)]), 60, 0.07, 4).scale(1, 0.15, 1)), M('#a8834f', { roughness: 1 }), null, true)));
    },
    lanterns(ctx) {
      const pts = catenary([-9, 3.6, -2.2], [9, 3.5, -2.2], 0.6, 18);
      ctx.add(mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 40, 0.01, 4), M('#4a3f3a'), null, true));
      pts.forEach((p, i) => {
        if (i === 0 || i === pts.length - 1) return;
        const on = ctx.golden;
        const lan = group({ p: [p.x, p.y - 0.14, p.z] }, [mesh(G('lantern', () => new T.CylinderGeometry(0.07, 0.07, 0.18, 12)), on ? G(`mat:lanternOn${i % 3}`, () => new T.MeshBasicMaterial({ color: ['#ffd27a', '#ffb07a', '#ffe6a3'][i % 3] })) : M(['#ffd27a', '#ff9f6b', '#ffe6a3'][i % 3], { roughness: 0.5 }), null, true)]);
        if (on && i % 6 === 3) {
          const pl = new T.PointLight('#ffc27a', 3, 6, 1.6);
          lan.add(pl);
        }
        ctx.add(lan);
      });
    }
  };

  // Builds a setting into a scene and returns its lights.
  function buildSetting(scene, theme, prop, golden) {
    const sky = SKY[golden ? 'golden' : 'day'];
    const sunDir = V3(sky.sun[0], sky.sun[1], sky.sun[2]);
    scene.background = new T.Color(sky.horizon);
    if (theme !== 'office' || true) scene.add(skyDome({ top: sky.top, horizon: sky.horizon, glow: sky.glow, sun: sunDir }));
    scene.fog = new T.Fog(sky.horizon, theme === 'office' ? 14 : 20, theme === 'office' ? 40 : 85);
    const ctx = {
      golden,
      add: (o) => scene.add(o),
      ground: (kind, base) => {
        const m = mesh(G(`groundPlane`, () => new T.PlaneGeometry(240, 240).rotateX(-Math.PI / 2)), new T.MeshStandardMaterial({ color: '#ffffff', map: groundTex(kind, base), roughness: 0.96 }), null, true);
        m.receiveShadow = true;
        return m;
      }
    };
    (SETTINGS[theme] || SETTINGS.village)(ctx);
    if (prop && PROPS3D[prop]) PROPS3D[prop](ctx);
    const L = lights(scene, { golden });
    if (golden) L.sun.position.set(6, 3.2, -4);
    return L;
  }

  // ---------- the live story stage ----------
  // One stage stays alive while a scenario is played: re-rendering the same scene only updates moods,
  // reactions and who is speaking, so the camera doesn't fly in again at every step.
  const FACING = { you: 0.5, npc: -0.38, mentor: -0.52 };
  const DEPTH = { you: 0.35, npc: 0, mentor: -0.2 };
  const SPOTS = { wide: { you: 0.13, npc: 0.63, mentor: 0.86 }, narrow: { you: 0.13, npc: 0.58, mentor: 0.875 } };
  let live = null;

  function sceneKey(cfg) {
    return JSON.stringify([cfg.theme, cfg.prop || '', cfg.sky || '', cfg.actors.map((a) => [a.id, a.spec])]);
  }

  function buildStage(art, cfg, key) {
    const L = { key, art, cfg, figs: {}, t: 0, last: performance.now(), busyUntil: 0, raf: 0, visible: true, pointer: [0, 0], pointerNow: [0, 0] };
    L.renderer = renderer(null, { dpr: window.innerWidth < 768 ? 1.5 : 2 });
    L.canvas = L.renderer.domElement;
    L.canvas.className = 'stage-3d';
    L.canvas.setAttribute('aria-hidden', 'true');
    L.scene = new T.Scene();
    L.lights = buildSetting(L.scene, cfg.theme, cfg.prop, cfg.sky === 'golden');
    L.camera = new T.PerspectiveCamera(28, 2, 0.1, 200);
    cfg.actors.forEach((a) => {
      const f = figure(a.spec, { mood: a.mood || 'happy' });
      f.id = a.id;
      f.root.rotation.y = FACING[a.id] || 0;
      f.root.add(blob(0.95));
      L.scene.add(f.root);
      L.figs[a.id] = f;
    });
    L.fly = reduceMotion ? null : { t0: 0, dur: 2.4 };
    art.prepend(L.canvas);
    L.resize = new ResizeObserver(() => layout(L));
    L.resize.observe(art);
    L.io = new IntersectionObserver((entries) => { L.visible = entries.some((e) => e.isIntersecting); if (L.visible) kick(L); });
    L.io.observe(art);
    L.onPointer = (e) => {
      const r = L.art.getBoundingClientRect();
      L.pointer = [((e.clientX - r.left) / r.width - 0.5) * 2, ((e.clientY - r.top) / r.height - 0.5) * 2];
      kick(L);
    };
    art.addEventListener('pointermove', L.onPointer);
    L.onVis = () => kick(L);
    document.addEventListener('visibilitychange', L.onVis);
    layout(L);
    return L;
  }

  // Places the camera and the characters so they stand where the speech bubbles expect them.
  function layout(L) {
    const w = L.art.clientWidth;
    const h = L.art.clientHeight;
    if (!w || !h) return;
    L.renderer.setSize(w, h, false);
    L.camera.aspect = w / h;
    L.camera.updateProjectionMatrix();
    L.home = { pos: V3(0, 1.62, 5.7), look: V3(0, 0.98, 0) };
    L.camera.position.copy(L.home.pos);
    L.camera.lookAt(L.home.look);
    L.camera.updateMatrixWorld();
    const spots = SPOTS[w / h > 2.4 ? 'wide' : 'narrow'];
    const p = V3();
    Object.values(L.figs).forEach((f) => {
      const z = DEPTH[f.id] || 0;
      p.set(0, 0.9, z).project(L.camera);
      const x0 = p.x;
      p.set(1, 0.9, z).project(L.camera);
      const x = ((spots[f.id] || 0.5) * 2 - 1 - x0) / (p.x - x0);
      f.home = V3(x, 0, z);
      if (!(f.action && f.action.name === 'walk')) f.root.position.copy(f.home);
      else { f.action.to = x; f.action.from = x - 3.2; f.root.position.z = z; }
    });
    kick(L);
  }

  // Applies a re-render: moods, reactions, who speaks and who listens.
  function updateStage(L, cfg) {
    L.cfg = cfg;
    const t = L.t;
    const speaker = (cfg.bubbles || []).reduce((s, b) => (b.side === 'left' ? 'you' : b.side === 'right' ? 'mentor' : s), null);
    cfg.actors.forEach((a) => {
      const f = L.figs[a.id];
      if (!f) return;
      if (a.mood !== f.moodIn) {
        setMood(f, a.mood || 'happy');
        f.moodIn = a.mood;
      }
      if (a.anim === 'walk') {
        play(f, 'walk', t + (L.fly ? 0.5 : 0), { from: f.home.x - 3.2, to: f.home.x, face: FACING[a.id] || 0, dur: 1.9 });
      } else if (a.anim) {
        play(f, a.anim, t);
      } else if (a.mood === 'think' && a.id === 'npc') {
        if (!f.action) play(f, 'think-hold', t);
      } else if (f.action && f.action.name === 'think-hold') {
        f.action = null;
      }
    });
    const bubble = (cfg.bubbles || []).filter((b) => b.side === 'left' || b.side === 'right').pop();
    if (speaker && L.figs[speaker]) {
      const f = L.figs[speaker];
      f.talkUntil = t + Math.min(2.6, 0.6 + ((bubble && bubble.text) || '').length * 0.03);
      if (!f.action) play(f, 'gesture', t + 0.2);
    }
    const target = (id) => {
      if (speaker && id !== speaker) return speaker;
      if (id === 'you') return 'npc';
      return 'you';
    };
    Object.values(L.figs).forEach((f) => { f.watch = target(f.id); });
    L.busyUntil = t + 3;
    kick(L);
  }

  function kick(L) {
    if (!L.raf && L.visible && !document.hidden && L.canvas.isConnected) {
      L.last = performance.now();
      L.raf = requestAnimationFrame((now) => frame(L, now));
    }
  }

  function frame(L, now) {
    L.raf = 0;
    if (L !== live || !L.canvas.isConnected) return;
    const dt = Math.min(0.05, (now - L.last) / 1000);
    L.last = now;
    L.t += dt;
    const t = L.t;
    Object.values(L.figs).forEach((f) => {
      const o = L.figs[f.watch];
      if (o) {
        const dx = o.root.position.x - f.root.position.x;
        const dz = o.root.position.z - f.root.position.z;
        f.lookTarget = Math.max(-0.85, Math.min(0.85, Math.atan2(dx, dz) - f.root.rotation.y));
      }
      animate(f, t, dt);
    });
    // The camera flies in like the globe does, then drifts gently and leans toward the pointer.
    L.pointerNow[0] = damp(L.pointerNow[0], L.pointer[0], 2.5, dt);
    L.pointerNow[1] = damp(L.pointerNow[1], L.pointer[1], 2.5, dt);
    const home = L.home;
    const pos = home.pos.clone();
    if (!reduceMotion) {
      pos.x += Math.sin(t * 0.17) * 0.16 + L.pointerNow[0] * 0.22;
      pos.y += Math.sin(t * 0.23) * 0.05 - L.pointerNow[1] * 0.1;
    }
    if (L.fly) {
      const u = Math.min(1, t / L.fly.dur);
      const k = ease(u);
      pos.set(lerp(home.pos.x + 4.2, pos.x, k), lerp(home.pos.y + 2.6, pos.y, k), lerp(home.pos.z + 7.5, pos.z, k));
      if (u >= 1) L.fly = null;
    }
    L.camera.position.copy(pos);
    L.camera.lookAt(home.look);
    L.renderer.render(L.scene, L.camera);
    placeLabels(L);
    if (!L.shown) {
      L.shown = true;
      L.canvas.style.opacity = '1';
      L.stage.classList.add('is-3d');
    }
    const busy = t < L.busyUntil || L.fly || Object.values(L.figs).some((f) => f.action && f.action.name !== 'think-hold' || t < f.talkUntil);
    if (reduceMotion && !busy) return;
    if (busy) L.raf = requestAnimationFrame((n) => frame(L, n));
    else L.timer = setTimeout(() => { L.timer = 0; L.raf = requestAnimationFrame((n) => frame(L, n)); }, 33);
  }

  // Keeps the HTML name labels under each character's feet.
  function placeLabels(L) {
    const p = V3();
    L.cfg.actors.forEach((a) => {
      const f = L.figs[a.id];
      const el = L.stage.querySelector(`.actor[data-actor="${a.id}"]`);
      if (!f || !el) return;
      p.set(f.root.position.x, 0, f.root.position.z).project(L.camera);
      el.style.left = `${((p.x + 1) / 2) * 100}%`;
      el.style.bottom = `${((p.y + 1) / 2) * 100}%`;
    });
  }

  function destroy(L) {
    cancelAnimationFrame(L.raf);
    clearTimeout(L.timer);
    L.resize.disconnect();
    L.io.disconnect();
    L.art.removeEventListener('pointermove', L.onPointer);
    document.removeEventListener('visibilitychange', L.onVis);
    Object.values(L.figs).forEach(dispose);
    L.scene.traverse((o) => {
      if (o.isMesh && o.material && !Array.isArray(o.material) && o.material.isShaderMaterial) o.material.dispose();
    });
    L.renderer.dispose();
    L.canvas.remove();
  }

  // Attaches 3D to a story stage element rendered by Scenes.stage(); returns false to keep the SVG art.
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
        live.art.removeEventListener('pointermove', live.onPointer);
        live.art = art;
        art.prepend(live.canvas);
        live.resize.observe(art);
        live.io.observe(art);
        art.addEventListener('pointermove', live.onPointer);
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

  window.World3D = {
    load,
    attachStage,
    isLive: (cfg) => Boolean(T && live && live.shown && live.key === sceneKey(cfg)),
    get ready() { return Boolean(T); },
    // Internal pieces shared with the scene builders below.
    _: { G, M, shade, place, mesh, group, V3, lerp, ease, damp, roundBox, tube, figure, setMood, play, animate, dispose, lights, renderer, blob, buildSetting, reduceMotion, get T() { return T; } }
  };
})();
