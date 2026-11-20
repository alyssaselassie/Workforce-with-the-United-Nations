# UN Workforce Analytics Dashboard

The administrative dashboard for the Workforce Assessment, for authorized researchers and project
administrators. It is a separate application: the survey does not link to it, and it is not part of
the UN Cultural Intelligence & Bias Navigator. Search engines are asked not to index it.

## What it shows

The dashboard is kept deliberately simple: two views and two choices. Its main chart follows the
Relief Maps Tool specification and worksheet (Team C assignment): a team-level, anonymous **Relief Map**.

- **By department**: pick one of the **12 department datasets** (Human Resources to Other) or all
  departments together.
  - **Relief Map**, laid out like the worksheet: the five workplace settings of section G along the
    bottom (team meetings, one-on-one meetings with a supervisor, hybrid and virtual collaboration,
    informal networking, decision-making spaces), each labelled with its kind of place in brackets;
    **Comfort** at the bottom and **Discomfort** at the top; and one coloured line per identity
    dimension: **Gender, Age, Religious identity, Ethnicity and Social class**, with a legend. Each
    point is the average answer from 1 (very comfortable) to 5 (very uncomfortable); "Prefer not to say
    or not applicable" is left out. Choosing a legend entry highlights its line; hovering shows the
    values. Below it: a short reading (most discomfort, most comfort, the kinds of place, the biggest
    difference from all departments), the numbers in a table, and how settings are labelled.
  - **Kinds of place** (the worksheet's terms), checked in this order: *Places of oppression* (the
    lines average 3 or more), *Controversial places* (the highest and lowest lines are at least 1 point
    apart), *Places of relief* (the lines average 2 or less), *Neutral places* (anything in between). A
    setting is labelled only when at least 3 of its 5 points are shown. These thresholds are this
    project's reading aid for group averages, not part of the original method.
  - **Six separate graphs**, one per area: Psychological Safety, Workplace Inclusion, Cross-Cultural
    Collaboration, Leadership & Management, Implicit Bias Awareness and Organizational Support. Each
    shows the area's % favourable and one bar per statement. Hovering over a bar shows the full
    statement and the counts.
- **Compare departments**: one small Relief Map per department (the same five identity lines, settings
  numbered 1 to 5), a table of the kind of place of every setting by department, and a table of the
  six areas' averages. Select a department to open its Relief Map and six graphs.
- **Period**: the reporting quarter (the latest is shown first).

This is a workplace adaptation of Relief Maps (Rodó-Zárate, 2023; Relief Maps+, INTERMAPS) and the
NYU Intersectionality Lab's Relief Maps Tool, not the original individual-level method: it shows group
averages for workplace settings. Nobody is asked which gender, age, religion, ethnicity or social class
they are, only how comfortable they feel in relation to each, so the identity lines need no identity
groups and there are no small identity intersections to expose.

Each Relief Map point is shown only when at least **10** people in the group gave a comfort answer
("Prefer not to say" does not count). As for departments, the points held back in a period must
together hold 0 or at least 10 answers, so none can be worked out from the all-departments point;
if needed, the next-smallest department's point is held back too. A held-back point leaves a gap in
its line and a dash in the table.

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
