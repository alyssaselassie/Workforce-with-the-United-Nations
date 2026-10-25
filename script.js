/*
 * UN Cultural Intelligence & Bias Navigator — shared core.
 * Loads data, stores progress, renders the site header/footer and exposes
 * small helpers on window.App for the page modules in js/.
 */
(function () {
  'use strict';

  const PROGRESS_KEY = 'uncq.progress.v1';
  const PROFILE_KEY = 'uncq.profile.v1';
  const COMPETENCIES = ['cq', 'bias', 'evidence', 'harm'];

  // ---------- storage (never throws; works in private mode) ----------
  // Prototype demo mode: everything lives in sessionStorage, so it survives moving
  // between pages but is gone when the tab is closed, and it is cleared on refresh
  // so every demo starts with no one signed in.
  const KEY_PREFIX = 'uncq.';
  const session = (() => { try { return window.sessionStorage; } catch (e) { return null; } })();
  function clearDemoData(storage) {
    try {
      Object.keys(storage).filter((k) => k.startsWith(KEY_PREFIX)).forEach((k) => storage.removeItem(k));
    } catch (e) { /* ignore */ }
  }
  try {
    const nav = performance.getEntriesByType('navigation')[0];
    if (session && nav && nav.type === 'reload') clearDemoData(session);
    // Earlier versions kept data in localStorage; remove it so nothing lingers.
    clearDemoData(window.localStorage);
  } catch (e) { /* ignore */ }

  const Store = {
    read(key, fallback) {
      try {
        const raw = session.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
      } catch (e) {
        return fallback;
      }
    },
    write(key, value) {
      try {
        session.setItem(key, JSON.stringify(value));
        return true;
      } catch (e) {
        return false;
      }
    },
    remove(key) {
      try { session.removeItem(key); } catch (e) { /* ignore */ }
    }
  };

  // ---------- data loading ----------
  // Prefer the live JSON files (served over http). When the site is opened
  // from file://, fetch is blocked, so fall back to data/data-bundle.js.
  const cache = {};
  async function loadJSON(name) {
    if (cache[name]) return cache[name];
    const bundled = window.APP_DATA && window.APP_DATA[name];
    if (window.location.protocol === 'file:' && bundled) {
      cache[name] = bundled;
      return cache[name];
    }
    try {
      const res = await fetch(`data/${name}.json`, { cache: 'no-cache' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      cache[name] = await res.json();
    } catch (err) {
      if (bundled) {
        cache[name] = bundled;
      } else {
        throw new Error(`Could not load data/${name}.json (${err.message}). Serve the folder over http (see README) or run tools/bundle_data.py.`);
      }
    }
    return cache[name];
  }

  // ---------- progress ----------
  function emptyProgress() {
    return { completed: {}, reflections: {} };
  }

  const Progress = {
    get() {
      const p = Store.read(PROGRESS_KEY, null);
      return p && p.completed ? p : emptyProgress();
    },
    record(scenarioId, result) {
      const p = Progress.get();
      const prev = p.completed[scenarioId];
      p.completed[scenarioId] = {
        at: new Date().toISOString(),
        attempts: prev ? prev.attempts + 1 : 1,
        scores: result.scores,
        choices: result.choices,
        biasTags: result.biasTags
      };
      Store.write(PROGRESS_KEY, p);
      return p;
    },
    saveReflection(scenarioId, text) {
      const p = Progress.get();
      p.reflections[scenarioId] = { text, at: new Date().toISOString() };
      return Store.write(PROGRESS_KEY, p);
    },
    reset() {
      Store.remove(PROGRESS_KEY);
    },
    // Sum earned/max per competency across completed scenarios.
    totals() {
      const p = Progress.get();
      const t = {};
      COMPETENCIES.forEach((k) => { t[k] = { earned: 0, max: 0 }; });
      Object.values(p.completed).forEach((c) => {
        COMPETENCIES.forEach((k) => {
          if (c.scores && c.scores[k]) {
            t[k].earned += c.scores[k].earned;
            t[k].max += c.scores[k].max;
          }
        });
      });
      return t;
    },
    // Per dimension: how many decisions tested it, and how often the learner's
    // latest choice overlooked it.
    dimensionStats(S) {
      const p = Progress.get();
      const stats = {};
      Object.keys(S.dimensions).forEach((d) => { stats[d] = { tested: 0, missed: 0 }; });
      S.scenarios.forEach((s) => {
        const c = p.completed[s.id];
        if (!c || !Array.isArray(c.choices)) return;
        s.steps.forEach((step, i) => {
          const choice = step.choices[c.choices[i]];
          if (!choice) return;
          stepDimensions(step).forEach((d) => {
            if (!stats[d]) return;
            stats[d].tested += 1;
            if ((choice.missed || []).includes(d)) stats[d].missed += 1;
          });
        });
      });
      return stats;
    }
  };

  // A decision tests a dimension when at least one of its choices overlooks it.
  function stepDimensions(step) {
    const set = new Set();
    step.choices.forEach((c) => (c.missed || []).forEach((d) => set.add(d)));
    return [...set];
  }

  // Small colored tag for a dimension, e.g. "Voice / power".
  function dimChip(S, id, extraClass) {
    const d = S.dimensions[id];
    if (!d) return '';
    return `<span class="dim-chip dim-${esc(id)} ${extraClass || ''}" title="${esc(d.description)}"><i class="bi ${esc(d.icon)}" aria-hidden="true"></i> ${esc(d.label)}</span>`;
  }

  // The official UN policies and guidance a decision's feedback draws on.
  function sourcesHtml(step, extraClass) {
    const list = (step && step.sources) || [];
    if (!list.length) return '';
    const items = list.map((src) => (src.url ? `<a href="${esc(src.url)}" target="_blank" rel="noopener">${esc(src.title)}</a>` : esc(src.title)));
    return `<p class="small sources-line ${extraClass || ''}"><i class="bi bi-journal-bookmark" aria-hidden="true"></i> <strong>Sources:</strong> ${items.join('; ')}</p>`;
  }

  // ---------- profile ----------
  const Profile = {
    get() {
      return Store.read(PROFILE_KEY, {});
    },
    save(profile) {
      return Store.write(PROFILE_KEY, profile);
    },
    clear() {
      Store.remove(PROFILE_KEY);
    },
    initials(profile) {
      const parts = String(profile.name || '').trim().split(/\s+/).filter(Boolean);
      return parts.length ? (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() : '';
    }
  };

  // Round avatar: the uploaded photo, else the learner's avatar, else initials, else a person icon.
  function avatar(profile, size) {
    const style = `width:${size}px;height:${size}px;font-size:${Math.round(size * 0.4)}px`;
    if (profile.photo) return `<img class="avatar" src="${esc(profile.photo)}" alt="" style="${style}">`;
    if (window.Avatar && Avatar.isSet()) return Avatar.headHtml(size);
    const ini = Profile.initials(profile);
    return `<span class="avatar avatar-empty" style="${style}" aria-hidden="true">${ini ? esc(ini) : '<i class="bi bi-person"></i>'}</span>`;
  }

  // ---------- helpers ----------
  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function pct(score) {
    if (!score || !score.max) return 0;
    return Math.round((score.earned / score.max) * 100);
  }

  function param(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function download(filename, data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const RATING = {
    strong: { label: 'Strong approach', cls: 'text-bg-success', icon: 'bi-check-circle-fill' },
    partial: { label: 'Partially effective', cls: 'text-bg-warning', icon: 'bi-exclamation-circle-fill' },
    weak: { label: 'Reconsider', cls: 'text-bg-danger', icon: 'bi-x-circle-fill' }
  };

  function ratingBadge(rating) {
    const r = RATING[rating] || RATING.partial;
    return `<span class="badge ${r.cls}"><i class="bi ${r.icon}" aria-hidden="true"></i> ${r.label}</span>`;
  }

  // Bootstrap-styled progress bar used on results and progress pages.
  function meter(label, value, extraClass) {
    return `
      <div class="meter ${extraClass || ''}">
        <div class="d-flex justify-content-between small mb-1">
          <span class="fw-semibold">${esc(label)}</span><span>${value}%</span>
        </div>
        <div class="progress" role="progressbar" aria-label="${esc(label)}" aria-valuenow="${value}" aria-valuemin="0" aria-valuemax="100">
          <div class="progress-bar" style="width:${value}%"></div>
        </div>
      </div>`;
  }

  function showError(container, err) {
    container.innerHTML = `
      <div class="alert alert-danger" role="alert">
        <h2 class="h6 mb-1"><i class="bi bi-exclamation-triangle" aria-hidden="true"></i> Data could not be loaded</h2>
        <p class="mb-0 small">${esc(err.message || err)}</p>
      </div>`;
  }

  // ---------- shared chrome ----------
  const NAV = [
    { href: 'index.html', page: 'home', label: 'Home', icon: 'bi-house' },
    { href: 'map.html', page: 'map', label: 'Mission Map', icon: 'bi-globe-americas' },
    { href: 'scenarios.html', page: 'scenarios', label: 'Scenarios', icon: 'bi-signpost-split' },
    { href: 'toolkit.html', page: 'toolkit', label: 'Bias Toolkit', icon: 'bi-lightbulb' },
    { href: 'collaboration.html', page: 'collaboration', label: 'Team Debrief', icon: 'bi-people' }
  ];

  function renderChrome() {
    const current = document.body.dataset.page;
    const profile = Profile.get();
    const firstName = String(profile.name || '').trim().split(/\s+/)[0];
    const onProfile = current === 'profile' || current === 'progress';
    const header = document.getElementById('site-header');
    if (header) {
      header.innerHTML = `
        <a class="visually-hidden-focusable skip-link" href="#main">Skip to main content</a>
        <nav class="navbar navbar-expand-xl navbar-dark site-nav" aria-label="Main">
          <div class="container-xl">
            <a class="navbar-brand d-flex align-items-center gap-2" href="index.html">
              <span class="brand-mark" aria-hidden="true"><i class="bi bi-compass"></i></span>
              <span><span class="fw-semibold">CQ &amp; Bias Navigator</span><span class="brand-sub d-none d-sm-block d-xl-none d-xxl-block">CQ = Cultural Quotient · UN fieldwork learning prototype</span></span>
            </a>
            ${window.Game ? Game.chipHtml() : ''}
            <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navMain" aria-controls="navMain" aria-expanded="false" aria-label="Toggle navigation">
              <span class="navbar-toggler-icon"></span>
            </button>
            <div class="collapse navbar-collapse" id="navMain">
              <ul class="navbar-nav ms-auto">
                ${NAV.map((n) => `
                  <li class="nav-item">
                    <a class="nav-link${n.page === current ? ' active' : ''}" ${n.page === current ? 'aria-current="page"' : ''} href="${n.href}">
                      <i class="bi ${n.icon}" aria-hidden="true"></i> ${n.label}
                    </a>
                  </li>`).join('')}
                <li class="nav-item ms-xl-2">
                  <a class="nav-link nav-profile${firstName ? '' : ' is-cta'}${onProfile ? ' active' : ''}" ${onProfile ? 'aria-current="page"' : ''} href="profile.html${firstName ? '' : '?edit=1'}" title="${firstName ? 'My profile and progress' : 'Create your profile'}">
                    ${avatar(profile, 28)}<span class="ms-2">${firstName ? esc(firstName) : 'Create profile'}</span>
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </nav>
        ${current === 'home' ? '' : '<div class="demo-banner no-print"><div class="container-xl"><i class="bi bi-arrow-clockwise" aria-hidden="true"></i> <strong>Demo mode:</strong> your profile and progress reset when you refresh or reopen the site.</div></div>'}`;
    }

    const footer = document.getElementById('site-footer');
    if (footer) {
      footer.innerHTML = `
        <div class="container-xl py-4">
          <div class="row g-3 align-items-start">
            <div class="col-md-7">
              <p class="mb-1 fw-semibold">UN Cultural Intelligence &amp; Bias Navigator</p>
              <p class="small mb-0">An educational technology prototype. <strong>This is not an official United Nations product</strong> and is not endorsed by the UN. Scenarios are fictional composites. Check mission information against official sources.</p>
              <p class="small mb-0 mt-2">Dimensions framework adapted from <a href="https://reliefmaps.upf.edu" target="_blank" rel="noopener">Relief Maps+</a> by Maria Rodó-Zárate and the INTERMAPS team, Universitat Pompeu Fabra. <a href="toolkit.html#dimensions">Full credit</a>.</p>
            </div>
            <div class="col-md-5">
              <p class="small fw-semibold mb-1">Official sources</p>
              <ul class="list-unstyled small mb-0">
                <li><a href="https://www.unmissions.org/en" target="_blank" rel="noopener">unmissions.org</a></li>
                <li><a href="https://www.unmissions.org/en/united-nations-field-missions" target="_blank" rel="noopener">United Nations Field Missions</a></li>
                <li><a href="https://www.un.org/en/our-work/deliver-humanitarian-aid" target="_blank" rel="noopener">UN: Deliver Humanitarian Aid</a></li>
              </ul>
            </div>
          </div>
        </div>`;
    }
  }

  document.addEventListener('DOMContentLoaded', renderChrome);

  window.App = {
    COMPETENCIES,
    Store,
    Progress,
    Profile,
    avatar,
    renderChrome,
    stepDimensions,
    dimChip,
    sourcesHtml,
    loadMissions: () => loadJSON('missions'),
    loadScenarios: () => loadJSON('scenarios'),
    esc,
    pct,
    param,
    uid,
    download,
    ratingBadge,
    meter,
    showError
  };
})();
