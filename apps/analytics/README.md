# Workplace Relief Map Dashboard

The dashboard for the Workplace Relief Map Survey, for authorized researchers and project
administrators. It is a separate application: the survey does not link to it, and it is not part of
the Cultural Intelligence & Bias Navigator. Search engines are asked not to index it.

## What it shows

One graph for one dataset, exactly like the Relief Maps Tool worksheet: a team-level, anonymous
**Relief Map** of everyone who took part. There are no departments, periods or comparisons.

- **The map:** the five workplace spaces along the bottom (your desk or workstation, meeting rooms,
  your supervisor's office, the kitchen, break room or cafeteria, and hallways, elevators and
  entrances), each labelled with its kind of place in brackets; **Comfort** at the bottom and
  **Discomfort** at the top; and one coloured line per identity dimension: **Gender, Age, Religious
  identity, Ethnicity and Social class**, with a legend. Each point is the average answer from 1 (very
  comfortable) to 5 (very uncomfortable); "Prefer not to say or not applicable" is left out. Choosing
  a legend entry highlights its line; hovering shows the values.
- **Below it:** a short reading (most discomfort, most comfort, the kinds of place), **suggested next
  steps** for the team, the numbers in a table, and how spaces are labelled.
- **Kinds of place**, adapted from the worksheet and named in plain, positive workplace language,
  checked in this order: *Places to improve* (the lines average 3 or more), *Mixed places* (the
  highest and lowest lines are at least 1 point apart), *Places of comfort* (the lines average 2 or
  less), *Neutral places* (anything in between). A space is labelled only when at least 3 of its 5
  points are shown. These thresholds are this project's reading aid for group averages, not part of
  the original method.
- **Suggested next steps** (`AssessmentModel.nextSteps`): practical ideas chosen from the pattern on
  the map. Places to improve come first (with the line that shows the most discomfort and an idea for
  that space), then mixed places (with an idea for the line that shows the most discomfort), then
  what already works, a reminder to talk the map through as a team without asking who answered what,
  and a suggestion to run the survey again after 3 months. They are starting points for a team
  conversation, not findings. The wording lives in `apps/shared/assessment-model.js` (`SPACE_IDEAS`,
  `DIMENSION_IDEAS`) and can be edited there.

**Look:** styled to match the team's Relief Maps survey: a cream page, deep green panels and buttons,
Newsreader for headings, Inter for text and JetBrains Mono for small labels. The fonts are served from
`assets/fonts` under the SIL Open Font License (licence files alongside them), so nothing loads from
third parties. The line colours are unchanged and sit on a white card, keeping their checked
contrast.

This is a workplace adaptation of Relief Maps (Rodó-Zárate, 2023; Relief Maps+, INTERMAPS) and the
NYU Intersectionality Lab's Relief Maps Tool, not the original individual-level method: it shows group
averages for workplace spaces. Nobody is asked which gender, age, religion, ethnicity or social class
they are, only how comfortable they feel in relation to each, so the identity lines need no identity
groups and there are no small groups to expose.

## Anonymity rules

- Nothing is shown until at least **10** people have submitted a complete response; until then the
  page says "Not enough responses yet" and carries no numbers, not even the count.
- Each point is shown only when at least **10** people gave a comfort answer to it ("Prefer not to
  say" does not count). A held-back point leaves a gap in its line and a dash in the table.
- All responses form one dataset, so no small group can be worked out by subtracting one result from
  another.

## Data sources

| Source | Who can use it | What it is |
| --- | --- | --- |
| **Sign in → live results** | Accounts listed in `assessment_admins` | The aggregated map from the results service (`supabase/functions/assessment-release`). Individual responses never reach the browser. The session is kept in memory only |
| **Demonstration** | Anyone | Fictional responses from one team of 24, labelled as such. It also includes answers given in the survey's demonstration mode in the same browser. Direct link: `?demo=1` |

The `downloads/` folder holds the questionnaire for import into Qualtrics, the codebook and a
demonstration export. They are not linked from the dashboard.

## Deploying it on its own (GitHub Pages)

1. Create a new repository (`https://<account>.github.io/<repository>/`).
2. Copy the **contents** of this folder (including `.nojekyll`) to the root of that repository, as
   in `apps/survey/README.md`, and turn on Pages (Deploy from a branch → `main`, `/ (root)`).
3. Once the backend exists (`supabase/README.md`), put the project URL and publishable key in
   `config.js`. Add the dashboard's origin (for example `https://<account>.github.io`) to the
   function's `DASHBOARD_ORIGINS` secret. Optionally set `surveyUrl` to the survey's address, for the
   demonstration link.

The dashboard's files are public on any static host. That is safe: they contain no data, and live
results need an authorized sign-in. To hide even the sign-in page, host it somewhere with access
control, such as an intranet or Cloudflare Access.
