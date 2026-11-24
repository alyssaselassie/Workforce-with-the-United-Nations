# Workplace Relief Map applications

Two applications for the Relief Maps Tool project, separate from the UN Cultural Intelligence & Bias
Navigator (the learning website in the root of this repository). They share one model file and the
backend in `supabase/`. Like the Relief Maps Tool worksheet, they collect one dataset and show one
graph.

| | Navigator | Survey application | Analytics dashboard |
| --- | --- | --- | --- |
| Name | UN Cultural Intelligence & Bias Navigator | Workplace Relief Map Survey | Workplace Relief Map Dashboard |
| Purpose | Education and professional development | Anonymous workforce data collection | Aggregated research and organizational analysis |
| Audience | UN personnel and training participants | Survey participants | Authorized researchers and project administrators |
| Source | repository root | `apps/survey/` | `apps/analytics/` |
| Address | `https://alyssaselassie.github.io/Workforce-with-the-United-Nations/` (unchanged) | `https://alyssaselassie.github.io/workforce-assessment/` | `https://alyssaselassie.github.io/workforce-analytics/` |
| Published from | this repository | [alyssaselassie/workforce-assessment](https://github.com/alyssaselassie/workforce-assessment) | [alyssaselassie/workforce-analytics](https://github.com/alyssaselassie/workforce-analytics) |
| Collects responses? | No | Yes, answer codes only, to the secure database (demonstration mode when not connected) | No; signs in and reads the aggregated map |

The two apps are kept out of the Navigator's GitHub Pages site (`_config.yml` excludes `apps/` and
`supabase/`), so they are not pages of the learning website. Each folder is a complete website that
can be deployed on its own; see `survey/README.md` and `analytics/README.md`.

**Publishing an update:** the two standalone repositories hold copies of these folders. After
changing an app here, run `node tools/build_assessment.js` and the tests, then copy the folder's
contents into the matching repository and push. Keep the `config.js` values of the published copy.

## Layout

```
apps/shared/assessment-model.js   the single source: spaces, identity dimensions, questions, anonymity rules
apps/survey/                      the survey application (deploy this folder on its own)
apps/analytics/                   the dashboard (deploy this folder on its own)
supabase/                         database schema and results service (see supabase/README.md)
tools/build_assessment.js         copies the model into each app and the service; regenerates the
                                  Qualtrics file, codebook, demonstration export and database schema
tools/test_assessment.js          model, anonymity rules, results service and app separation
tools/test_assessment_db.js       the database schema against a real PostgreSQL database
docs/workforce-assessment-architecture.md   why it is built this way, and the options
```

## Changing the survey

1. Edit `apps/shared/assessment-model.js` only.
2. Run `node tools/build_assessment.js` to update every copy and generated file.
3. Run the tests:
   ```bash
   node tools/test_assessment.js
   ASSESSMENT_TEST_DATABASE_URL=postgresql://... node tools/test_assessment_db.js   # needs a throwaway PostgreSQL database
   ```
4. If the questions changed, apply the regenerated SQL to the database as a new migration, and
   redeploy both apps and the results service.

## Running locally

Serve each folder from its own root, for example:

```bash
python3 -m http.server 8001 --directory apps/survey
python3 -m http.server 8002 --directory apps/analytics
```

With empty `config.js` files both run in demonstration mode. To try the live flow locally, run
Supabase's local stack (`supabase start`, which serves on `http://127.0.0.1:54321`) and put that
address and its publishable key in both `config.js` files.
