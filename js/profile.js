// Profile page: personal details, photo, learning snapshot, badges and backup.
(async function () {
  'use strict';
  const { esc, COMPETENCIES, Profile, Progress, Store } = App;
  const root = document.getElementById('profile-root');
  const SESSIONS_KEY = 'uncq.sessions.v1';
  const PHOTO_SIZE = 320;
  // Banner is 4:1, like a LinkedIn background photo.
  const COVER_W = 1200;
  const COVER_H = 300;
  const BACKUP_APP = 'uncq-navigator';

  let S, M;
  try {
    [S, M] = await Promise.all([App.loadScenarios(), App.loadMissions()]);
  } catch (err) {
    App.showError(root, err);
    return;
  }
  const missionById = Object.fromEntries(M.missions.map((m) => [m.id, m]));
  const modalEl = document.getElementById('edit-modal');
  const modal = window.bootstrap ? new bootstrap.Modal(modalEl) : null;
  let draftPhoto = null;
  let draftCover = null;

  // ---------- badges ----------
  // Each badge is earned from progress made in this demo session.
  function badges() {
    const p = Progress.get();
    const done = Object.values(p.completed);
    const totals = Progress.totals();
    const sessions = Object.keys(Store.read(SESSIONS_KEY, {})).length;
    const reflections = Object.values(p.reflections).filter((r) => r.text).length;
    const perfect = done.some((c) => COMPETENCIES.every((k) => App.pct(c.scores[k]) === 100));
    const strong = (k) => done.length >= 3 && App.pct(totals[k]) >= 75;
    return [
      { icon: 'bi-flag', name: 'First steps', how: 'Complete your first scenario', earned: done.length >= 1 },
      { icon: 'bi-signpost-2', name: 'Halfway there', how: 'Complete 5 scenarios', earned: done.length >= 5 },
      { icon: 'bi-compass', name: 'Navigator', how: `Complete all ${S.scenarios.length} scenarios`, earned: done.length >= S.scenarios.length },
      { icon: 'bi-stars', name: 'Clear sight', how: 'Score 100% on every competency in a scenario', earned: perfect },
      { icon: 'bi-eye', name: 'Bias spotter', how: 'Reach 75% Bias Awareness across 3+ scenarios', earned: strong('bias') },
      { icon: 'bi-shield-heart', name: 'Do No Harm champion', how: 'Reach 75% Do No Harm across 3+ scenarios', earned: strong('harm') },
      { icon: 'bi-arrow-repeat', name: 'Growth mindset', how: 'Replay a scenario to improve', earned: done.some((c) => c.attempts > 1) },
      { icon: 'bi-journal-text', name: 'Reflective practitioner', how: 'Save 3 reflections', earned: reflections >= 3 },
      { icon: 'bi-people', name: 'Team player', how: 'Start a Team Debrief session', earned: sessions > 0 }
    ];
  }

  // ---------- render ----------
  function render() {
    const pr = Profile.get();
    const p = Progress.get();
    const done = S.scenarios.filter((s) => p.completed[s.id]);
    const totals = Progress.totals();
    const overall = done.length ? Math.round(COMPETENCIES.reduce((a, k) => a + App.pct(totals[k]), 0) / COMPETENCIES.length) : 0;
    const mission = missionById[pr.mission];
    const langs = String(pr.languages || '').split(',').map((l) => l.trim()).filter(Boolean);
    const list = badges();
    const earned = list.filter((b) => b.earned).length;
    const recent = done.slice().sort((a, b) => p.completed[b.id].at.localeCompare(p.completed[a.id].at)).slice(0, 4);

    root.innerHTML = `
      ${pr.name ? '' : `
        <div class="alert alert-info d-flex flex-wrap align-items-center justify-content-between gap-2">
          <span><i class="bi bi-person-plus" aria-hidden="true"></i> <strong>Create your profile</strong> to personalize the Navigator and keep your learning in one place.</span>
          <button class="btn btn-primary btn-sm" data-edit>Set up profile</button>
        </div>`}

      <section class="surface profile-card mb-4" aria-label="Profile summary">
        <div class="profile-cover"${pr.cover ? ` style="background-image:url('${esc(pr.cover)}')"` : ''}>
          <label class="cover-edit no-print" title="${pr.cover ? 'Change banner photo' : 'Add a banner photo'}">
            <i class="bi bi-camera" aria-hidden="true"></i><span>${pr.cover ? 'Change banner' : 'Add banner photo'}</span>
            <input type="file" id="cover-quick" accept="image/*" class="file-input">
          </label>
        </div>
        <p class="cover-status small mb-0 no-print" id="cover-status" role="status"></p>
        <div class="profile-body">
          <div class="profile-avatar">${App.avatar(pr, 128)}</div>
          <div class="d-flex flex-wrap justify-content-between align-items-start gap-3">
            <div>
              <h1 class="h3 mb-1">${esc(pr.name || 'Your name')}</h1>
              <p class="mb-1">${esc(pr.headline || 'Add a headline, e.g. your role or program')}</p>
              <p class="small text-muted-2 mb-2">
                ${pr.location ? `<i class="bi bi-geo-alt" aria-hidden="true"></i> ${esc(pr.location)} · ` : ''}
                ${mission ? `<a href="map.html?mission=${mission.id}"><i class="bi bi-globe-americas" aria-hidden="true"></i> ${esc(mission.acronym)}</a>` : 'No duty station selected'}
              </p>
              <div>${langs.map((l) => `<span class="scope-chip"><i class="bi bi-translate" aria-hidden="true"></i> ${esc(l)}</span>`).join('')}</div>
            </div>
            <div class="d-flex gap-2 no-print">
              <button class="btn btn-primary btn-sm" data-edit><i class="bi bi-pencil" aria-hidden="true"></i> Edit profile</button>
            </div>
          </div>
          <div class="row g-2 mt-3 text-center">
            <div class="col-4"><div class="profile-stat"><div class="stat">${done.length}<span class="fs-6 text-muted-2">/${S.scenarios.length}</span></div><div class="small text-muted-2">Scenarios</div></div></div>
            <div class="col-4"><div class="profile-stat"><div class="stat">${overall}%</div><div class="small text-muted-2">Overall score</div></div></div>
            <div class="col-4"><div class="profile-stat"><div class="stat">${earned}</div><div class="small text-muted-2">Badges</div></div></div>
          </div>
        </div>
      </section>

      <div class="row g-4">
        <div class="col-lg-7">
          <section class="surface p-4 mb-4" aria-labelledby="about-h">
            <h2 class="h5" id="about-h">About</h2>
            <p class="mb-3">${pr.about ? esc(pr.about).replace(/\n/g, '<br>') : '<span class="text-muted-2">Tell others about your background and field experience.</span>'}</p>
            <h3 class="h6 mb-1"><i class="bi bi-bullseye" aria-hidden="true"></i> Learning goal</h3>
            <p class="mb-0">${pr.goal ? esc(pr.goal) : '<span class="text-muted-2">Set a goal to focus your practice.</span>'}</p>
          </section>

          <section class="surface p-4 mb-4" aria-labelledby="badges-h">
            <div class="d-flex justify-content-between align-items-baseline">
              <h2 class="h5" id="badges-h">Badges</h2>
              <span class="small text-muted-2">${earned} of ${list.length} earned</span>
            </div>
            <div class="row g-2">
              ${list.map((b) => `
                <div class="col-6 col-md-4">
                  <div class="badge-tile ${b.earned ? 'is-earned' : ''}" title="${esc(b.how)}">
                    <span class="badge-icon"><i class="bi ${b.icon}" aria-hidden="true"></i></span>
                    <div><div class="fw-bold small">${esc(b.name)}</div><div class="text-muted-2" style="font-size:.75rem">${b.earned ? 'Earned' : esc(b.how)}</div></div>
                  </div>
                </div>`).join('')}
            </div>
          </section>
        </div>

        <div class="col-lg-5">
          <section class="surface p-4 mb-4" aria-labelledby="skills-h">
            <h2 class="h5" id="skills-h">Competencies</h2>
            ${done.length ? COMPETENCIES.map((k) => App.meter(S.competencies[k].label, App.pct(totals[k]), 'mb-3')).join('')
              : '<p class="small text-muted-2">Complete a scenario to build your competency profile.</p>'}
            <a class="small" href="progress.html">See full progress <i class="bi bi-arrow-right" aria-hidden="true"></i></a>
          </section>

          <section class="surface p-4 mb-4" aria-labelledby="activity-h">
            <h2 class="h5" id="activity-h">Recent activity</h2>
            ${recent.length ? `<ul class="list-unstyled mb-0">${recent.map((s) => {
              const c = p.completed[s.id];
              const score = Math.round(COMPETENCIES.reduce((a, k) => a + App.pct(c.scores[k]), 0) / COMPETENCIES.length);
              return `<li class="d-flex justify-content-between gap-2 mb-2 small">
                <span><i class="bi bi-check-circle text-success" aria-hidden="true"></i> Completed <a href="scenarios.html?id=${s.id}">${esc(s.title)}</a></span>
                <span class="text-muted-2 text-nowrap">${score}% · ${new Date(c.at).toLocaleDateString()}</span></li>`;
            }).join('')}</ul>` : '<p class="small text-muted-2 mb-0">No activity yet. <a href="scenarios.html">Start a scenario</a>.</p>'}
          </section>

          <section class="surface p-4" aria-labelledby="backup-h">
            <h2 class="h5" id="backup-h"><i class="bi bi-cloud-arrow-down" aria-hidden="true"></i> Save and restore</h2>
            <p class="small text-muted-2">This is a prototype, so your profile and progress reset when you refresh or reopen the site. Download a backup to keep them, then restore it any time.</p>
            <div class="d-flex flex-wrap gap-2">
              <button class="btn btn-outline-primary btn-sm" id="backup"><i class="bi bi-download" aria-hidden="true"></i> Download backup</button>
              <label class="btn btn-outline-primary btn-sm mb-0"><i class="bi bi-upload" aria-hidden="true"></i> Restore backup
                <input type="file" id="restore" accept="application/json,.json" class="file-input"></label>
              <button class="btn btn-outline-danger btn-sm" id="delete-profile"><i class="bi bi-trash" aria-hidden="true"></i> Delete profile</button>
            </div>
            <p class="small mt-2 mb-0" id="backup-msg" role="status"></p>
          </section>
        </div>
      </div>`;

    root.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', openEditor));
    // Changing the banner from the card saves straight away.
    document.getElementById('cover-quick').addEventListener('change', async (e) => {
      const status = document.getElementById('cover-status');
      status.textContent = 'Loading banner…';
      const cover = await readImage(e, status, COVER_W, COVER_H);
      if (!cover) return;
      if (!Profile.save(Object.assign(Profile.get(), { cover }))) {
        status.textContent = 'Could not save the banner. Browser storage may be full or blocked.';
        return;
      }
      refreshAll();
    });
    document.getElementById('backup').addEventListener('click', backup);
    document.getElementById('restore').addEventListener('change', restore);
    document.getElementById('delete-profile').addEventListener('click', () => {
      if (!window.confirm('Delete your profile details and photos? Your scenario progress is kept.')) return;
      Profile.clear();
      refreshAll();
    });
  }

  // Header avatar lives in the shared nav, so re-render it too.
  function refreshAll() {
    render();
    App.renderChrome();
  }

  // ---------- editor ----------
  const fields = ['name', 'headline', 'mission', 'location', 'languages', 'about', 'goal'];
  const sel = document.getElementById('pf-mission');
  M.missions.slice().sort((a, b) => a.acronym.localeCompare(b.acronym)).forEach((m) => {
    sel.insertAdjacentHTML('beforeend', `<option value="${m.id}">${esc(m.acronym)}: ${esc(m.name)}</option>`);
  });

  function showPreview() {
    const name = document.getElementById('pf-name').value;
    document.getElementById('photo-preview').innerHTML = App.avatar({ name, photo: draftPhoto }, 88);
    document.getElementById('photo-remove').disabled = !draftPhoto;
    const cover = document.getElementById('cover-preview');
    cover.style.backgroundImage = draftCover ? `url('${draftCover}')` : '';
    document.getElementById('cover-remove').disabled = !draftCover;
  }

  function openEditor() {
    const pr = Profile.get();
    fields.forEach((f) => { document.getElementById(`pf-${f}`).value = pr[f] || ''; });
    draftPhoto = pr.photo || null;
    draftCover = pr.cover || null;
    document.getElementById('photo-msg').textContent = "JPG, PNG or WebP. It's cropped to a square.";
    document.getElementById('cover-msg').textContent = 'A wide image works best. It is cropped to a 4:1 banner.';
    showPreview();
    if (modal) modal.show();
  }

  document.getElementById('pf-name').addEventListener('input', showPreview);
  document.getElementById('photo-remove').addEventListener('click', () => { draftPhoto = null; showPreview(); });
  document.getElementById('cover-remove').addEventListener('click', () => { draftCover = null; showPreview(); });

  // Center-crop to the target shape and shrink, so images fit comfortably in browser storage.
  function cropImage(file, width, height) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(img.naturalWidth / width, img.naturalHeight / height);
        const sw = width * scale, sh = height * scale;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, 0, 0, width, height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Your browser can\'t open this image format (for example HEIC photos from an iPhone). Save it as JPG or PNG and try again.')); };
      img.src = url;
    });
  }

  // Validate a chosen file and return the cropped image, or null with a message.
  async function readImage(e, msg, width, height) {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) { msg.textContent = ''; return null; }
    if (!file.type.startsWith('image/')) { msg.textContent = 'Please choose an image file.'; return null; }
    if (file.size > 15 * 1024 * 1024) { msg.textContent = 'That image is over 15 MB. Please choose a smaller one.'; return null; }
    try {
      return await cropImage(file, width, height);
    } catch (err) {
      msg.textContent = err.message;
      return null;
    }
  }

  document.getElementById('photo-input').addEventListener('change', async (e) => {
    const msg = document.getElementById('photo-msg');
    const photo = await readImage(e, msg, PHOTO_SIZE, PHOTO_SIZE);
    if (!photo) return;
    draftPhoto = photo;
    msg.textContent = 'Photo ready. Save the profile to keep it.';
    showPreview();
  });

  document.getElementById('cover-input').addEventListener('change', async (e) => {
    const msg = document.getElementById('cover-msg');
    const cover = await readImage(e, msg, COVER_W, COVER_H);
    if (!cover) return;
    draftCover = cover;
    msg.textContent = 'Banner ready. Save the profile to keep it.';
    showPreview();
  });

  document.getElementById('edit-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const pr = {};
    fields.forEach((f) => { pr[f] = document.getElementById(`pf-${f}`).value.trim(); });
    if (draftPhoto) pr.photo = draftPhoto;
    if (draftCover) pr.cover = draftCover;
    pr.updatedAt = new Date().toISOString();
    if (!Profile.save(pr)) {
      document.getElementById('photo-msg').textContent = 'Could not save. Browser storage may be full or blocked.';
      return;
    }
    if (modal) modal.hide();
    refreshAll();
  });

  // ---------- backup / restore ----------
  function backup() {
    const pr = Profile.get();
    const safe = String(pr.name || 'my').replace(/[^a-z0-9]+/gi, '-').toLowerCase().replace(/^-|-$/g, '') || 'my';
    App.download(`${safe}-navigator-backup.json`, {
      app: BACKUP_APP,
      version: 1,
      exportedAt: new Date().toISOString(),
      profile: pr,
      progress: Progress.get(),
      sessions: Store.read(SESSIONS_KEY, {})
    });
    document.getElementById('backup-msg').textContent = 'Backup downloaded.';
  }

  async function restore(e) {
    const file = e.target.files[0];
    e.target.value = '';
    const msg = document.getElementById('backup-msg');
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!data || data.app !== BACKUP_APP || !data.progress || !data.progress.completed) {
        throw new Error('This file is not a Navigator backup.');
      }
      if (!window.confirm('Replace your current profile and progress with the backup?')) return;
      Profile.save(data.profile || {});
      Store.write('uncq.progress.v1', data.progress);
      // Keep any local debrief sessions and add the ones from the backup.
      Store.write(SESSIONS_KEY, Object.assign({}, Store.read(SESSIONS_KEY, {}), data.sessions || {}));
      refreshAll();
      document.getElementById('backup-msg').textContent = 'Backup restored.';
    } catch (err) {
      msg.className = 'small mt-2 mb-0 text-danger';
      msg.textContent = `Restore failed: ${err.message}`;
    }
  }

  render();
  if (App.param('edit') === '1') openEditor();
})();
