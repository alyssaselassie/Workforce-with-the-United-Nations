# UN Workforce Analytics Dashboard

The administrative dashboard for the Workforce Assessment, for authorized researchers and project
administrators. It is a separate application: the survey does not link to it, and it is not part of
the UN Cultural Intelligence & Bias Navigator. Search engines are asked not to index it.

## What it shows

- **12 department datasets** (Human Resources to Other) plus the organization-wide dataset. Each has
  **six separate graphs**, one per area: Psychological Safety, Workplace Inclusion, Cross-Cultural
  Collaboration, Leadership & Management, Implicit Bias Awareness and Organizational Support. Each graph
  shows a stacked bar per statement, % favourable with a 95% confidence interval, a trend line across
  reporting periods and a numbers table.
- **Filters** for department, area and reporting period.
- **Compare departments**: dot plots per area with sample sizes, confidence intervals, a dashed
  line for all departments, warnings when sample sizes differ, and a table.
- **About the data**: the statements and their sources, the anonymity rules, data sources and downloads.

## Data sources

| Source | Who can use it | What it is |
| --- | --- | --- |
| **Sign in → live results** | Accounts listed in `assessment_admins` | Aggregated results from the results service (`supabase/functions/assessment-release`). Individual responses never reach the browser. The session is kept in memory only |
| **Demonstration** | Anyone | Fictional data, labelled as such on every chart. It also includes answers given in the survey's demonstration mode in the same browser, so a live demo can show a department unlocking at 10 responses |
| **Results file** | Whoever holds the file | A Qualtrics export (CSV) or an aggregated results file (JSON), read in the browser and never uploaded. For organizations that run the assessment in Qualtrics (`downloads/assessment-qualtrics.txt`) |

Anonymity rules, applied to every source: no result for a group of fewer than **10** completed
responses; if the hidden departments add up to fewer than 10, the next-smallest department is withheld
too; each reporting period stands alone; hidden groups carry no numbers.

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
