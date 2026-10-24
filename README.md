# UN Cultural Intelligence & Bias Navigator

An interactive educational web application that helps United Nations personnel build cultural intelligence, recognize implicit bias and make more inclusive, evidence-based decisions before and during humanitarian fieldwork.

> **Learning prototype.** This is not an official United Nations product, and the UN has not endorsed it. All scenarios are fictional composites. Mission information should be checked against the official sources listed below.

## Modules

| Page | What it does |
| --- | --- |
| `index.html` | Landing page: overview, live stats, competency framework, learning path |
| `map.html` | Interactive world map of UN field missions (Leaflet), with filters, a table view, mandate scope, source links, verification status and pre-deployment reflection prompts |
| `scenarios.html` | Scenario library and branching player. Each choice gets feedback and is scored on four competencies. A results screen and saved reflection follow each scenario |
| `toolkit.html` | Bias library (14 biases), the PAUSE protocol, CQ capabilities, humanitarian principles and an assumption-check worksheet |
| `collaboration.html` | Team Debrief: facilitated sessions with a perspective wall, a "who's missing" prompt, a group vote compared with the guidance, an action plan and a printable summary. Sessions can be exported and imported as JSON |
| `progress.html` | Competency profile, completed scenarios, recurring biases, reflections, export and reset |
| `profile.html` | Personal profile: photo upload (cropped and resized in the browser), headline, duty station, languages, about and learning goal, plus competencies, badges, recent activity and backup/restore of profile and progress |

### Scoring

Each choice earns 0–3 points on four competencies:

- **Cultural Intelligence (CQ, Cultural Quotient)**: drive, knowledge, strategy and action.
- **Bias Awareness**: noticing shortcuts such as anchoring, affinity bias and stereotyping.
- **Evidence-Based Decisions**: triangulating sources, using disaggregated data and stating uncertainty.
- **Do No Harm & Inclusion**: humanitarian principles, safety and participation of affected people.

A scenario score is points earned divided by the best points available at each step. Scores are prompts for reflection, not assessments. The app does **not** measure anyone's implicit bias.

## Project structure

```
index.html  map.html  scenarios.html  toolkit.html  collaboration.html  progress.html
styles.css             shared styles (Bootstrap 5.3 + design tokens)
script.js              shared core: data loading, progress storage, header/footer, helpers
js/                    one module per page (home, map, scenarios, toolkit, collaboration, progress)
data/missions.json     mission locations, scope, status, sources, verification flags
data/scenarios.json    competencies, bias library, frameworks, scenarios, choices, feedback, scores
data/data-bundle.js    generated copy of the JSON so the site also works from file://
tools/bundle_data.py   regenerates data-bundle.js (and validates the JSON)
```

## Running locally

Option A: serve the folder (recommended, because JSON edits apply immediately):

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

Option B: double-click `index.html`. Browsers block `fetch()` on `file://`, so the pages fall back to `data/data-bundle.js`. If you edit a JSON file, regenerate the bundle:

```bash
python3 tools/bundle_data.py
```

An internet connection is needed for the CDN libraries (Bootstrap, Bootstrap Icons, Leaflet) and the map tiles. Without the map library, the map page still shows the full mission table.

## Deploying to GitHub Pages

1. Push to GitHub.
2. Go to **Settings → Pages → Build and deployment**, and set Source to *Deploy from a branch*, Branch `main`, folder `/ (root)`.
3. The site will be served at `https://<user>.github.io/<repo>/`. All paths are relative, so no configuration is needed.

## Why Leaflet?

[Leaflet](https://leafletjs.com/) 1.9.4 (BSD-2-Clause) is a ~40 KB, dependency-free, well-documented open-source mapping library. It works on static hosting with no API key, supports keyboard-accessible markers and touch, and uses free OpenStreetMap tiles. Heavier options (Mapbox GL, Google Maps) need API keys or billing, and a hand-drawn SVG map would be harder to keep accurate and to zoom. It is loaded from cdnjs, so no setup is needed. To self-host it, download `leaflet.js` and `leaflet.css` and change the two tags in `map.html`.

Markers that would overlap on screen are merged into a numbered pin, and the merge is recalculated at every zoom level. Markers show headquarters or main offices, not full areas of operation.

For production or heavy traffic, switch to a tile provider whose usage policy fits, because the public OpenStreetMap tile servers have [usage limits](https://operations.osmfoundation.org/policies/tiles/).

## Data sources and verification

Research foundation:

1. https://www.unmissions.org/en (primary reference for map locations)
2. https://www.unmissions.org/en/united-nations-field-missions
3. https://www.un.org/en/our-work/deliver-humanitarian-aid (humanitarian principles and coordination)

`data/missions.json` lists **29 entries**: 11 peacekeeping operations, 2 support offices (UNSOS, UNSOH), special political missions, regional offices (UNOWAS, UNOCA, UNRCCA, UNOAU) and envoy / good-offices presences. Multi-country and regional mandates list every country or area in scope and are flagged `multiCountry`. Recently concluded missions (UNMHA, UNAMI, UNITAMS, MINUSMA) are listed separately and are not mapped.

**Important:** when the dataset was compiled (24 October 2026), unmissions.org and un.org could not be loaded directly from the build environment. Entries were compiled from search-indexed copies of the directory, mission sites on unmissions.org subdomains, DPO's "Where we operate" page and Security Council documents. Each entry carries a `verification` flag:

- `confirmed`: name, scope and status confirmed against a UN source.
- `check-status`: the mandate is ending, under renewal or changing (e.g. UNTMIS ceases operations 31 Oct 2026; UNVMC's mandate runs to 31 Oct 2026 with renewal under discussion; UNIFIL).
- `check-listing`: a DPPA-supported presence. Confirm that it appears in the unmissions.org directory and that the `sourceUrl` resolves.

Before demonstrating to faculty or UN personnel, open the live directory, reconcile each entry, update `status`, `verification` and `sourceUrl`, add any missing presences, and run `python3 tools/bundle_data.py`.

### Adding a mission

```json
{
  "id": "short-id", "acronym": "ABC", "name": "Official mission name",
  "type": "PKO | SPM | REG | ENV | SUP", "region": "Africa",
  "scope": ["Country A", "Country B"], "scopeNote": "optional",
  "multiCountry": true, "established": "2020",
  "locations": [{ "label": "Headquarters, City", "lat": 0, "lng": 0 }],
  "status": "active | closing", "statusNote": "optional",
  "sourceUrl": "https://abc.unmissions.org/", "verification": "confirmed",
  "scenarioIds": ["sc-..."]
}
```

### Adding a scenario

Add an object to `scenarios` in `data/scenarios.json` with `id`, `title`, `summary`, `missionIds`, `role`, `setting`, `minutes`, `biasFocus` (ids from `biases`), `steps` and `debrief`. Each step has a `prompt`, an optional `context` and `choices`. Each choice has `text`, `scores` (`cq`, `bias`, `evidence`, `harm`, each 0–3), `rating` (`strong | partial | weak`), `biasTags` and `feedback`. Link scenarios to missions from either file.

## Data, privacy and collaboration

Everything runs in the browser. Profiles (including the photo, stored as a small resized JPEG), progress, reflections, worksheet drafts and debrief sessions are stored in `localStorage` on the user's device, and nothing is sent to a server. Team Debrief is built for one shared screen in a meeting room or call. For use across devices, export and import session files; re-importing merges by id without duplicating entries. A future version could replace the storage layer in `js/collaboration.js` with a real-time backend (e.g. Firebase or Supabase). If it did, it would need authentication and a data-protection review, because it would hold staff reflections.

## Content principles

- Cultural knowledge is presented as a hypothesis to test with local colleagues, never as a conclusion about individuals. Scenarios use fictional places and do not name real ethnic or community groups.
- Feedback explains trade-offs rather than presenting a single right answer.
- Frameworks: cultural intelligence (CQ Drive, Knowledge, Strategy, Action), the humanitarian principles (GA resolutions 46/182 and 58/114), Do No Harm and accountability to affected populations.

## Accessibility

Semantic landmarks, a skip link, keyboard-operable map rows and markers, ARIA live regions for feedback, labeled form controls, visible focus styles and print styles. Layouts were tested at 375 px with no horizontal scrolling.

## License and attribution

Map data © OpenStreetMap contributors. Leaflet © Volodymyr Agafonkin (BSD-2-Clause). Bootstrap (MIT). Boundaries and names on the map do not imply official endorsement or acceptance by the United Nations.
