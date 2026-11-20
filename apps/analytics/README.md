# UN Workforce Analytics Dashboard

The administrative dashboard for the Workforce Assessment, for authorized researchers and project
administrators. It is a separate application: the survey does not link to it, and it is not part of
the UN Cultural Intelligence & Bias Navigator. Search engines are asked not to index it.

## What it shows

The dashboard is kept deliberately simple: two views and two choices.

- **By department**: pick one of the **12 department datasets** (Human Resources to Other) or all
  departments together. Each has **six separate graphs**, one per area: Psychological Safety, Workplace
  Inclusion, Cross-Cultural Collaboration, Leadership & Management, Implicit Bias Awareness and
  Organizational Support. Each graph shows the area's % favourable and one bar per statement (% of
  people who gave a favourable answer). Hovering over a bar shows the full statement and the counts.
- **Compare departments**: one table with every department and the six areas (% favourable),
  shaded light to dark blue, with the number of responses. Select a department to open its graphs.
- **Period**: the reporting quarter (the latest is shown first).

A department with fewer than 10 responses shows "Not enough responses yet", and a department hidden to
protect a smaller group shows "Hidden to protect a smaller group". Neither shows any numbers.

## Data sources

| Source | Who can use it | What it is |
| --- | --- | --- |
| **Sign in → live results** | Accounts listed in `assessment_admins` | Aggregated results from the results service (`supabase/functions/assessment-release`). Individual responses never reach the browser. The session is kept in memory only |
| **Demonstration** | Anyone | Fictional data, labelled as such. It also includes answers given in the survey's demonstration mode in the same browser, so a live demo can show a department appearing once it reaches 10 responses. Direct link: `?demo=1` (add `#compare` to open the comparison) |

Anonymity rules: no result for a group of fewer than **10** completed responses; if the hidden
departments add up to fewer than 10, the next-smallest department is withheld too; each reporting
period stands alone; hidden groups carry no numbers.

The `downloads/` folder holds the questionnaire for import into Qualtrics, the codebook and a
demonstration export. They are not linked from the dashboard.

## Deploying it on its own (GitHub Pages)

1. Create a new repository, for example `un-workforce-analytics`
   (`https://<account>.github.io/un-workforce-analytics/`).
2. Copy the **contents** of this folder (including `.nojekyll`) to the root of that repository, as
   in `apps/survey/README.md`, and turn on Pages (Deploy from a branch → `main`, `/ (root)`).
3. Once the backend exists (`supabase/README.md`), put the project URL and publishable key in
   `config.js`. Add the dashboard's origin (for example `https://<account>.github.io`) to the
   function's `DASHBOARD_ORIGINS` secret. Optionally set `surveyUrl` to the survey's address, for the
   demonstration link.

The dashboard's files are public on any static host. That is safe: they contain no data, and live
results need an authorized sign-in. To hide even the sign-in page, host it somewhere with access
control, such as an intranet or Cloudflare Access.
