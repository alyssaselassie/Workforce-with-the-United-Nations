# Workplace Relief Map Survey

The standalone survey application for the Relief Maps Tool project. It is a separate product from the
Cultural Intelligence & Bias Navigator (the learning website), with its own address, home page,
navigation, privacy statement and confirmation page. It does not link to the Navigator or to the
dashboard.

It follows the Relief Maps Tool worksheet: a short, anonymous survey (26 questions, about 5 minutes)
whose answers make one combined Relief Map.

| Page | What it is |
| --- | --- |
| `index.html` | Home: what the survey covers (five workplace spaces), how it works, privacy summary |
| `survey.html` | The survey: consent, then one page per workplace space (your desk or workstation, meeting rooms, your supervisor's office, the kitchen, break room or cafeteria, and hallways, elevators and entrances). On each page: how comfortable you feel there in relation to your gender, age, religious identity, ethnicity and social class, with "Prefer not to say or not applicable" always available. It never asks which of these you are, or your department. A review screen with Change links comes before submitting. Every question is multiple choice and required; a progress bar and step counter show progress |
| `thanks.html` | Submission confirmation |
| `privacy.html` | Privacy statement. Complete the "Responsibility, retention and contact" section before collecting real responses |
| `config.js` | The database connection (see below) |
| `assets/assessment-model.js` | Generated copy of `apps/shared/assessment-model.js`. Do not edit this copy |

Only the answer codes are stored: no name, email, staff ID, department, IP address, date or time.

The pages load nothing from other companies: no web fonts, analytics or CDN scripts. A strict
Content-Security-Policy allows connections only to the site itself and to Supabase.

## Two modes

- **Demonstration**, when `config.js` is empty: every page says so, answers are not collected, and a
  submitted demonstration answer stays only in the browser, labelled as demonstration data. On the
  same `github.io` account, the dashboard's demonstration can show these answers, which is useful for
  live presentations. Adding `?demo=1` to any page runs the demonstration even when the database is
  connected.
- **Live**, when `config.js` holds the Supabase project URL and publishable key: each response is sent
  to `submit_assessment()` (see `supabase/README.md`) and nothing is kept in the browser.

## The same survey in Qualtrics

`apps/analytics/downloads/assessment-qualtrics.txt` is the same questionnaire in Qualtrics' Advanced
Format. In a new, blank Qualtrics survey: Tools → Import/Export → Import survey. Then turn on Force
response for every question, turn on Anonymize responses in Survey options, and add skip logic so that
"No" on the consent question ends the survey.

## Deploying it on its own (GitHub Pages)

1. Create a new public repository. Its name becomes part of the address:
   `https://<account>.github.io/<repository>/`.
2. Copy the **contents** of this folder (`apps/survey/`, including the empty `.nojekyll` file) to the
   root of that repository. From this repository's root:
   ```bash
   node tools/build_assessment.js     # refresh the generated model copy
   git clone https://github.com/<account>/<repository>.git ../<repository>
   cp -R apps/survey/. ../<repository>/
   cd ../<repository> && git add -A && git commit -m "Publish the survey" && git push
   ```
3. In that repository: Settings → Pages → Deploy from a branch → `main`, folder `/ (root)`.
4. Fill in `config.js` once the database exists, and push again.

Any static host works the same way (Netlify, Cloudflare Pages, an organization's web server). Give it
this folder as the site root.
