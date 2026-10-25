# UN Cultural Intelligence & Bias Navigator

An interactive educational web application that helps United Nations personnel build cultural intelligence, recognize implicit bias and make more inclusive, evidence-based decisions before and during humanitarian fieldwork.

> **Learning prototype.** This is not an official United Nations product, and the UN has not endorsed it. All scenarios are fictional composites. Mission information should be checked against the official sources listed below.

## Modules

| Page | What it does |
| --- | --- |
| `index.html` | Deployment globe: each of the 11 exercises is pinned to a real mission context on a 3D globe of countries. Choose one and your avatar's airplane flies there from UN Headquarters, then the exercise opens. Also your avatar card, level, the 8-quest deployment path with the next quest one click away, live stats and the competency framework |
| `map.html` | Spinning 3D globe of UN field missions (D3). Selecting a mission, region or table row flies the globe to that area and highlights the countries in the mandate. Includes filters, a table view, mandate scope, source links, verification status, photos of each area, pre-deployment reflection prompts and a field passport that stamps each mission you open |
| `scenarios.html` | Scenario library and branching player (11 scenarios). Each scenario plays as an illustrated scene with your avatar, a story character and Mentor Rio in speech bubbles. Each choice gets feedback and XP, is scored on four competencies and shows which dimensions it overlooks. Strong decisions in a row build combos. Results show 1–3 stars, a bronze, silver or gold medal, the XP earned and the next quest. Keyboard play: A–D to answer, Enter to continue |
| `toolkit.html` | Bias Detective mini-game, dimensions framework, bias library (14 biases), the PAUSE protocol, CQ capabilities, humanitarian principles and an assumption-check worksheet |
| `collaboration.html` | Team Debrief: four cooperative team goals (every voice heard, every dimension discussed, decide together, agree on actions), facilitated sessions with a perspective wall, a "who's missing" prompt, contributions tagged by dimension, a dimension check before voting, a group vote compared with the guidance, an action plan and a printable summary. Sessions can be exported and imported as JSON |
| `progress.html` | Game hub (level, recent XP, quests and the full XP rules), then the competency profile, completed scenarios with stars, recurring biases, reflections, export and reset |
| `profile.html` | Personal profile: profile photo and LinkedIn-style banner photo (both cropped and resized in the browser), headline, duty station, languages, about and learning goal, plus your avatar (shown when there is no photo), medals, level, competencies, missions explored, the dimensions the learner most often misses, 18 badges with progress, recent activity and backup/restore of profile, progress and XP |

### Scoring

Each choice earns 0–3 points on four competencies:

- **Cultural Intelligence (CQ, Cultural Quotient)**: drive, knowledge, strategy and action.
- **Bias Awareness**: noticing shortcuts such as anchoring, affinity bias and stereotyping.
- **Evidence-Based Decisions**: triangulating sources, using disaggregated data and stating uncertainty.
- **Do No Harm & Inclusion**: humanitarian principles, safety and participation of affected people.

A scenario score is points earned divided by the best points available at each step. Scores are prompts for reflection, not assessments. The app does **not** measure anyone's implicit bias.

### Dimensions framework

A person cannot be defined by a single dimension. Building on the approach to lived experience (social positions, places and emotions) of [Relief Maps+](https://reliefmaps.upf.edu), created by Maria Rodó-Zárate and the INTERMAPS team at Universitat Pompeu Fabra (INTERMAPS, 2024; Rodó-Zárate, 2023), the Navigator adds a fourth dimension for UN fieldwork:

- **Social position**: role, gender, and national, international or uniformed status.
- **Place**: where the decision happens (meeting room, private conversation, water point, patrol route, virtual meeting).
- **Emotion / experience**: feeling safe or exposed, heard or overlooked, in that place.
- **Voice / power**: who speaks, who is missing and whose opinion counts.

Each scenario is tagged with the dimensions its stem names (at least three), and each response choice records the dimensions it overlooks (`missed`). A decision *tests* a dimension when at least one of its choices overlooks it. The profile shows how often the learner's choices missed each tested dimension. The dimensions describe the situation; the competencies score the response.

### Gamification

The Navigator is built around light, practical gamification: every reward points the learner to a useful next step.

- **XP and 8 levels**, from New Arrival to CQ Champion. The level chip in the nav fills toward the next level, and level-ups are celebrated (with confetti, unless the visitor prefers reduced motion).
- **Deployment path:** 8 quests that follow the learner journey: create your avatar, visit a duty station, make a first decision, spot 5 biases, PAUSE before acting, explore 3 regions, hear every voice and reach Proficient three times. Each quest links straight to where it is done.
- **Field passport:** opening a mission stamps it. Region chips and globe markers show what has been explored.
- **Scenario rewards:** XP for every decision (5 even for a weak one, as a learning moment), combos for strong decisions in a row, stars per scenario (1 under 50%, 2 for 50–74%, 3 for 75%+), XP for a reflection.
- **Bias Detective:** five-card rounds. Each card shows a field example; the learner names the bias from three options, then reads its definition and counter-strategy. Rounds favor biases not yet spotted, and options never pair two biases whose examples are nearly identical.
- **Team goals** in Team Debrief are cooperative and describe the session, never an individual.
- **18 badges** with progress bars, toasts for XP, badges and quests, and a transparent XP table on the progress page.

### Deployment globe, avatars and medals

The game layer stays professional: plain language, a calm palette and no leaderboards. All characters and art are original inline SVG, with no images or third-party game assets. Characters are expressive personal avatars: a big head on a slim body, almond eyes with colored irises and a bold lash line, shaped brows, a defined nose, colored lips and a toothy laugh, with soft gradient shading and thin outlines. Settings are painted like the globe: soft gradients lit from the upper left, contact shadows, and layers of haze for depth.

- **Deployment globe** (`js/deploy.js`): a D3 globe of the world's countries on the home page. Each exercise is pinned to the duty station of its mission context (for example, UNMISS in South Sudan); the scenarios themselves are fictional. Choose a pin or use the exercise list to see the role, time, mission context and route, then select **Fly there**: an airplane follows the great-circle route from your last location (UN Headquarters, New York, at the start) while the globe turns beneath it, and the exercise opens on arrival. The pin for your next quest pulses, and completed exercises show their medal. Drag to turn the globe; with reduced motion, the trip is instant.
- **Avatars** (`js/avatar.js`): an avatar creator with 8 skin tones, 6 eye colors, hair styles and colors, head coverings (hijab, turban), facial hair, glasses, shirts and a field vest. Extra gear (backpack, camera, radio, binoculars, award pin, sun hat, headphones, dyed hair) unlocks with levels. Skin tones, hair and head coverings are never locked. The avatar appears in the nav, on the home page, on the profile when there is no photo and in every scene. Open the creator from the home page, the profile, or any page with `?agent=1`.
- **Story scenes** (`js/scenes.js`): six settings (a village with a water point, a mission office, a needs-assessment site, a market street, a town square and farmland) with props such as a hand pump, a signpost, a farm track and evening lanterns. Each scenario's `scene` field sets its fictional place, mission context, backdrop and story character. Your choice appears in your speech bubble, Mentor Rio responds, and the full feedback stays below the scene.
- **Medals:** finishing a scenario earns a bronze, silver or gold medal by stars. Medals show on the globe and in the profile's medal case.
- **Mentor tips:** Mentor Rio gives a short, practical tip at the top of each module page (`data-tip` attributes).

Design principles: XP rewards learning actions (exploring a context, deciding, reflecting, hearing every voice) and never speed. Each action pays once; replaying earns XP only for doing better. There are no leaderboards, so learners are only compared with their past selves, and XP is not a measure of anyone's bias. `js/game.js` holds the rules (`XP`, `LEVELS`, `QUESTS`, badges); a ledger stores the best award per action key.

## Project structure

```
index.html  map.html  scenarios.html  toolkit.html  collaboration.html  progress.html
styles.css             shared styles (Bootstrap 5.3 + design tokens)
script.js              shared core: data loading, progress storage, header/footer, helpers
js/game.js             gamification layer: XP ledger, levels, quests, badges, medals, toasts, level chip
js/avatar.js           avatars, story characters and the avatar creator
js/scenes.js           story scene backdrops, speech bubbles, medals and mentor tips
js/deploy.js           home page deployment globe and airplane travel
js/detective.js        Bias Detective mini-game on the toolkit page
js/                    one module per page (home, map, scenarios, toolkit, collaboration, progress, profile)
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

An internet connection is needed for the CDN libraries (Bootstrap, Bootstrap Icons, D3, TopoJSON), the world map data and the mission photos. Without them, the map page still shows the full mission table.

## Deploying to GitHub Pages

1. Push to GitHub.
2. Go to **Settings → Pages → Build and deployment**, and set Source to *Deploy from a branch*, Branch `main`, folder `/ (root)`.
3. The site will be served at `https://<user>.github.io/<repo>/`. All paths are relative, so no configuration is needed.

## The mission globe

The map page (and, in a simpler form, the home page) draws an orthographic (3D-looking) globe with [D3](https://d3js.org/) 7.9.0 and [topojson-client](https://github.com/topojson/topojson-client) 3.1.0, using Natural Earth country shapes from [world-atlas](https://github.com/topojson/world-atlas) 2.0.2. Everything is vector SVG, so there is no API key, tile server or WebGL requirement, and the libraries load from jsDelivr.

- **Spinning:** the globe turns slowly on its own. Hovering a marker, dragging or selecting a mission pauses it, and the play/pause button controls it. People who set "reduce motion" in their system settings get a still globe, and selections jump straight to the area instead of flying.
- **Fly to an area:** selecting a mission, region chip or table row turns the globe to the area and zooms in so the mandate's countries fit the view. Those countries are highlighted in the mission type's color. Each mission's `mapIds` in `data/missions.json` lists Natural Earth country ids, or feature names for areas without an id (Kosovo, N. Cyprus, Somaliland). Scopes that are not countries, such as Golan, Abyei, the African Union or envoy regions, zoom to the office instead.
- **Detail on demand:** the light 1:110m map is used for spinning. When the view zooms in past 2.2×, the 1:50m map loads once and replaces it.
- **Markers** that would overlap on screen merge into a numbered marker and split apart as you zoom in. Markers on the far side of the globe are hidden.

### Photos of each area

When a mission is selected, the panel loads photos from [Wikimedia Commons](https://commons.wikimedia.org/) through its public API. Commons hosts many official UN and mission photos under free licenses. The page searches each mission's `photoSearch` terms (the mission first, then its area) and shows official photos first. A photo counts as official when its credit or title names the UN or a mission. Logos, maps, documents, small images and images whose title or description suggests violence or injury are filtered out. Each photo shows the photographer credit, license and a link to its file page, all taken from the file's own Commons metadata. Photos load live in the visitor's browser, so they need an internet connection, and results can change as Commons changes.

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

Add an object to `scenarios` in `data/scenarios.json` with `id`, `title`, `summary`, `missionIds`, `role`, `setting`, `minutes`, `biasFocus` (ids from `biases`), `dimensions` (at least three of `position`, `place`, `emotion`, `voice`), `steps` and `debrief`. Each step has a `prompt`, an optional `context` and `choices`. Each choice has `text`, `scores` (`cq`, `bias`, `evidence`, `harm`, each 0–3), `rating` (`strong | partial | weak`), `biasTags`, `missed` (dimensions the choice overlooks; empty for strong choices) and `feedback`. Link scenarios to missions from either file. Give it a `scene` for the story layer: `place` (a fictional setting), `context` (the id of a mission in `data/missions.json`; its first location places the exercise on the home globe), `theme` (`village`, `office`, `camp`, `market`, `town` or `fields`), optional `prop` (`pump`, `signpost`, `track`, `lanterns`) and `sky` (`golden`), and an `npc` with a `name` and a `look` from `Avatar.NPC` in `js/avatar.js`.

## Data, privacy and collaboration

Everything runs in the browser, and nothing is sent to a server. **Demo mode:** profiles (including the profile and banner photos, stored as small resized JPEGs), progress, reflections, worksheet drafts and debrief sessions are kept in `sessionStorage`. They carry over while moving between pages, but are cleared when the page is refreshed or the site is reopened, so every demo starts with no one signed in. Use **Download backup** on the profile page to keep a copy. To make data persist instead, switch `Store` in `script.js` back to `localStorage` and remove the reload check. Team Debrief is built for one shared screen in a meeting room or call. For use across devices, export and import session files; re-importing merges by id without duplicating entries. A future version could replace the storage layer in `js/collaboration.js` with a real-time backend (e.g. Firebase or Supabase). If it did, it would need authentication and a data-protection review, because it would hold staff reflections.

## Content principles

- Cultural knowledge is presented as a hypothesis to test with local colleagues, never as a conclusion about individuals. Scenarios use fictional places and do not name real ethnic or community groups.
- Feedback explains trade-offs rather than presenting a single right answer.
- Frameworks: cultural intelligence (CQ Drive, Knowledge, Strategy, Action), the humanitarian principles (GA resolutions 46/182 and 58/114), Do No Harm and accountability to affected populations.

## Accessibility

Semantic landmarks, a skip link, keyboard-operable map rows and markers, ARIA live regions for feedback, labeled form controls, visible focus styles and print styles. Layouts were tested at 375 px with no horizontal scrolling.

## License and attribution

Dimensions framework: adapted from Relief Maps+, created by Maria Rodó-Zárate and the INTERMAPS team at Universitat Pompeu Fabra. Voice / power is this project's addition.

Font: Nunito (SIL Open Font License), via Google Fonts. Map data: Natural Earth (public domain), via world-atlas (ISC). D3 (ISC). topojson-client (ISC). Bootstrap (MIT). Mission photos: Wikimedia Commons, credited individually under each file's own license. Boundaries and names on the map do not imply official endorsement or acceptance by the United Nations.

## References

- INTERMAPS. (2024). *Relief Maps+* [Web application]. Universitat Pompeu Fabra. https://reliefmaps.upf.edu
- Rodó-Zárate, M. (2023). Intersectionality and the spatiality of emotions in feminist research. *The Professional Geographer, 75*(4), 676–681. https://doi.org/10.1080/00330124.2022.2075406
