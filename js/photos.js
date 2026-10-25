// Mission photos: official UN and mission photos from Wikimedia Commons, with the
// photographer credit and license taken from each file's own metadata.
(function () {
  'use strict';
  const { esc } = App;

  const API = 'https://commons.wikimedia.org/w/api.php';
  const MAX_PHOTOS = 6;
  const MIN_WIDTH = 500;
  const MIME = /^image\/(jpeg|png|webp)$/;
  // Skip logos, maps and documents, and images likely to be distressing.
  const NOT_A_PHOTO = /\b(logo|emblem|flag|map|seal|coat of arms|insignia|badge|medal|stamp|banknote|icon|diagram|chart|poster|screenshot|document|letter|signature)s?\b/i;
  const SENSITIVE = /\b(dead|death|died|killed|kill|body|bodies|corpse|massacre|wounded|injur\w*|blood|funeral|grave|execut\w*|victim|casualt\w*|attack|explosion|bomb\w*|weapon\w*|gun\w*|rifle|riot|tortur\w*)\b/i;
  // A photo counts as official when its credit or title names the UN or a mission.
  const OFFICIAL = /\b(UN Photo|United Nations|UN Mission|MONUSCO|MINUSCA|UNMISS|UNIFIL|UNFICYP|UNDOF|UNTSO|UNMOGIP|MINURSO|UNISFA|UNMIK|UNAMA|BINUH|UNSMIL|UNSOM|UNTMIS|UNSOS|UNSOH|AMISOM|ATMIS|UNVMC|UNOWAS|UNOCA|UNRCCA|UNOAU|UNSCO|UNSCOL)\b/i;
  const cache = new Map();

  // Commons metadata values are HTML; keep only their text.
  function text(html) {
    if (!html) return '';
    const doc = new DOMParser().parseFromString(String(html), 'text/html');
    return (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function startsWith(url, prefix) {
    return typeof url === 'string' && url.startsWith(prefix) ? url : '';
  }

  // Wikimedia asks browser clients to identify themselves with Api-User-Agent;
  // retry without it if a network or CORS error blocks the request.
  async function getJson(url) {
    let res;
    try {
      res = await fetch(url, { headers: { 'Api-User-Agent': 'UN-CQ-Navigator/1.0 (educational prototype)' } });
    } catch (err) {
      res = await fetch(url);
    }
    if (!res.ok) throw new Error(`Wikimedia Commons returned ${res.status}`);
    return res.json();
  }

  function toPhoto(page) {
    const info = page.imageinfo && page.imageinfo[0];
    if (!info || !MIME.test(info.mime || '') || (info.width || 0) < MIN_WIDTH) return null;
    const meta = info.extmetadata || {};
    const value = (key) => (meta[key] && meta[key].value) || '';
    const title = page.title.replace(/^File:/, '').replace(/\.[a-z0-9]+$/i, '').replace(/_/g, ' ');
    const description = text(value('ImageDescription')) || text(value('ObjectName')) || title;
    if (NOT_A_PHOTO.test(title) || SENSITIVE.test(`${title} ${description}`)) return null;
    const src = startsWith(info.thumburl, 'https://upload.wikimedia.org/');
    const fileUrl = startsWith(info.descriptionurl, 'https://commons.wikimedia.org/');
    if (!src || !fileUrl) return null;
    const artist = text(value('Artist'));
    const credit = text(value('Credit'));
    return {
      src,
      fileUrl,
      description: description.length > 160 ? `${description.slice(0, 157)}…` : description,
      artist: artist || credit || 'Unknown photographer',
      license: text(value('LicenseShortName')) || 'See file page',
      licenseUrl: startsWith(value('LicenseUrl'), 'https://') || startsWith(value('LicenseUrl'), 'http://'),
      official: OFFICIAL.test(`${artist} ${credit} ${title}`)
    };
  }

  async function search(term) {
    const params = new URLSearchParams({
      action: 'query', format: 'json', formatversion: '2', origin: '*',
      generator: 'search', gsrnamespace: '6', gsrlimit: '30', gsrsearch: `${term} filetype:bitmap`,
      prop: 'imageinfo', iiprop: 'url|mime|size|extmetadata', iiurlwidth: '720',
      iiextmetadatafilter: 'Artist|Credit|LicenseShortName|LicenseUrl|ImageDescription|ObjectName'
    });
    const json = await getJson(`${API}?${params}`);
    const pages = (json.query && json.query.pages) || [];
    return pages.slice().sort((a, b) => (a.index || 0) - (b.index || 0)).map(toPhoto).filter(Boolean);
  }

  // Official photos first; the last search term is the area, used to fill gaps.
  function load(mission) {
    if (cache.has(mission.id)) return cache.get(mission.id);
    const promise = (async () => {
      const terms = mission.photoSearch && mission.photoSearch.length ? mission.photoSearch : [mission.acronym];
      const seen = new Set();
      const official = [];
      const other = [];
      let failures = 0;
      for (let i = 0; i < terms.length; i += 1) {
        const areaTerm = terms.length > 1 && i === terms.length - 1;
        if (areaTerm && official.length >= 3) break;
        let results = [];
        try {
          results = await search(terms[i]);
        } catch (err) {
          failures += 1;
          continue;
        }
        results.forEach((p) => {
          if (seen.has(p.src)) return;
          seen.add(p.src);
          (p.official ? official : other).push(Object.assign(p, { area: areaTerm && !p.official }));
        });
        if (official.length >= MAX_PHOTOS) break;
      }
      if (failures === terms.length) throw new Error('Photos could not be loaded.');
      return official.concat(other).slice(0, MAX_PHOTOS);
    })();
    cache.set(mission.id, promise);
    promise.catch(() => cache.delete(mission.id));
    return promise;
  }

  function searchLink(mission) {
    const term = (mission.photoSearch && mission.photoSearch[0]) || mission.acronym;
    return `https://commons.wikimedia.org/w/index.php?search=${encodeURIComponent(term)}&title=Special:MediaSearch&type=image`;
  }

  function kindLabel(p) {
    if (p.official) return '<span class="badge photo-kind is-official"><i class="bi bi-patch-check-fill" aria-hidden="true"></i> Official photo</span>';
    return `<span class="badge photo-kind">${p.area ? 'Photo of the area' : 'Related photo'}</span>`;
  }

  function viewer(container, mission, photos) {
    let index = 0;
    function draw() {
      const p = photos[index];
      container.innerHTML = `
        <figure class="photo-viewer mb-0">
          <div class="photo-frame">
            <img src="${esc(p.src)}" alt="${esc(p.description)}" decoding="async">
            ${kindLabel(p)}
            ${photos.length > 1 ? `
              <button type="button" class="photo-nav prev" data-step="-1" aria-label="Previous photo"><i class="bi bi-chevron-left" aria-hidden="true"></i></button>
              <button type="button" class="photo-nav next" data-step="1" aria-label="Next photo"><i class="bi bi-chevron-right" aria-hidden="true"></i></button>
              <span class="photo-count">${index + 1} / ${photos.length}</span>` : ''}
          </div>
          <figcaption class="small mt-1">
            <span class="photo-caption">${esc(p.description)}</span>
            <span class="photo-credit">Photo: ${esc(p.artist)} ·
              ${p.licenseUrl ? `<a href="${esc(p.licenseUrl)}" target="_blank" rel="noopener">${esc(p.license)}</a>` : esc(p.license)} ·
              <a href="${esc(p.fileUrl)}" target="_blank" rel="noopener">Wikimedia Commons</a></span>
          </figcaption>
        </figure>
        ${photos.length > 1 ? `<div class="photo-thumbs" role="group" aria-label="Choose a photo">
          ${photos.map((t, i) => `<button type="button" class="photo-thumb${i === index ? ' is-current' : ''}" data-index="${i}" aria-label="Photo ${i + 1}" aria-pressed="${i === index}"><img src="${esc(t.src)}" alt="" loading="lazy"></button>`).join('')}
        </div>` : ''}
        <a class="small d-inline-block mt-1" href="${esc(searchLink(mission))}" target="_blank" rel="noopener">More photos on Wikimedia Commons <i class="bi bi-box-arrow-up-right" aria-hidden="true"></i></a>`;
    }
    container.onclick = (e) => {
      const step = e.target.closest('[data-step]');
      const thumb = e.target.closest('[data-index]');
      if (step) index = (index + Number(step.dataset.step) + photos.length) % photos.length;
      else if (thumb) index = Number(thumb.dataset.index);
      else return;
      draw();
    };
    draw();
  }

  // Show photos for a mission in the given container. isCurrent() guards against
  // drawing stale results after the learner has selected another mission.
  async function render(container, mission, isCurrent) {
    container.innerHTML = '<div class="photo-skeleton" aria-label="Loading photos"></div>';
    try {
      const photos = await load(mission);
      if (!isCurrent()) return;
      if (!photos.length) {
        container.innerHTML = `<p class="small text-muted-2 mb-0">No suitable photos found yet. <a href="${esc(searchLink(mission))}" target="_blank" rel="noopener">Search Wikimedia Commons</a>.</p>`;
        return;
      }
      viewer(container, mission, photos);
    } catch (err) {
      if (!isCurrent()) return;
      container.innerHTML = `<p class="small text-muted-2 mb-0"><i class="bi bi-wifi-off" aria-hidden="true"></i> Photos could not be loaded right now. <a href="${esc(searchLink(mission))}" target="_blank" rel="noopener">View them on Wikimedia Commons</a>.</p>`;
    }
  }

  window.MissionPhotos = { load, render };
})();
