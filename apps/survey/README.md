# UN Workforce Inclusion & Psychological Safety Assessment

The standalone survey application. It is a separate product from the UN Cultural Intelligence & Bias
Navigator (the learning website), with its own address, home page, navigation, privacy statement and
confirmation page. It does not link to the Navigator or to the analytics dashboard.

| Page | What it is |
| --- | --- |
| `index.html` | Home: purpose, what the assessment covers, how it works, privacy summary |
| `survey.html` | The assessment: consent, department (12 options), six sections (A to F) of statements, a review screen with Change links, then submit. Every question is multiple choice and required; a progress bar and step counter show progress |
| `thanks.html` | Submission confirmation |
| `privacy.html` | Privacy statement. Complete the "Responsibility, retention and contact" section before collecting real responses |
| `config.js` | The database connection (see below) |
| `assets/assessment-model.js` | Generated copy of `apps/shared/assessment-model.js`. Do not edit this copy |

The pages load nothing from other companies: no web fonts, analytics or CDN scripts. A strict
Content-Security-Policy allows connections only to the site itself and to Supabase.

## Two modes

- **Demonstration**, when `config.js` is empty: every page says so, answers are not collected, and a
  submitted demonstration answer stays only in the browser, labelled as demonstration data. On the
  same `github.io` account, the analytics dashboard's demonstration can show these answers, which is
  useful for live presentations. Adding `?demo=1` to any page runs the demonstration even when the
  database is connected.
- **Live**, when `config.js` holds the Supabase project URL and publishable key: each response is sent
  to `submit_assessment()` (see `supabase/README.md`) and nothing is kept in the browser.

## Deploying it on its own (GitHub Pages)

1. Create a new public repository, for example `un-workforce-assessment`. The name becomes part of
   the address: `https://<account>.github.io/un-workforce-assessment/`.
2. Copy the **contents** of this folder (`apps/survey/`, including the empty `.nojekyll` file) to the
   root of that repository. From this repository's root:
   ```bash
   node tools/build_assessment.js     # refresh the generated model copy
   git clone https://github.com/<account>/un-workforce-assessment.git ../un-workforce-assessment
   cp -R apps/survey/. ../un-workforce-assessment/
   cd ../un-workforce-assessment && git add -A && git commit -m "Publish the assessment" && git push
   ```
3. In that repository: Settings → Pages → Deploy from a branch → `main`, folder `/ (root)`.
4. Fill in `config.js` once the database exists, and push again.

Any static host works the same way (Netlify, Cloudflare Pages, an organization's web server). Give it
this folder as the site root.
