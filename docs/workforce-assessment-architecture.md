# Workplace Relief Map: architecture and deployment options

## Decision

The workforce survey used to be a section of the UN Cultural Intelligence & Bias Navigator, in its main
menu. It is now three distinct products:

1. **UN Cultural Intelligence & Bias Navigator**: the learning platform. It is unchanged except that
   the survey is gone: no menu item, no module card, and it collects no workforce responses. Its old
   `workforce-survey/` address now shows a short "this assessment has moved" notice, and the Navigator
   deletes any responses the old survey left in the browser.
2. **Workplace Relief Map Survey** (`apps/survey/`): the survey, with its own home page, navigation,
   privacy statement and confirmation page. It asks how comfortable people feel in five physical
   workplace spaces in relation to their gender, age, religious identity, ethnicity and social class,
   and nothing about who they are (not even their department). It does not link to the dashboard or
   the Navigator.
3. **Workplace Relief Map Dashboard** (`apps/analytics/`): the analysis tool, with a sign-in for live
   results. Like the Relief Maps Tool worksheet, it shows one graph for one dataset: a Relief Map with
   the spaces across and one line per identity dimension.

The survey and dashboard are developed in this repository, so that they share one tested model file.
They are not published as part of the Navigator: `_config.yml` excludes them from its site. Each is
deployed as its own website.

## Why a backend is needed

GitHub Pages only serves files. A page on it cannot store a response where another person's browser
could later read it, so it cannot pool answers from many people. The earlier prototype saved
responses in each browser, which works only on one shared device. The new survey does not store real
responses in the browser at all. When no database is connected it runs as a clearly labelled
demonstration.

## Recommended architecture: static sites + Supabase

```
            ┌──────────────────────────┐       ┌───────────────────────────────┐
participant │ Survey app (static site) │──────▶│ submit_assessment()           │
            └──────────────────────────┘ write │ validates every answer        │
                                          only │ ──▶ assessment_responses      │
                                               │     (row level security,      │
            ┌──────────────────────────┐       │      no public read access)   │
researcher  │ Dashboard (static site)  │─sign─▶│ Supabase Auth                 │
            │                          │  in   │                               │
            │                          │──────▶│ assessment-release function   │
            │  aggregated results only │◀──────│ checks assessment_admins,     │
            └──────────────────────────┘       │ aggregates on the server      │
                                               └───────────────────────────────┘
```

- **Collection:** the survey calls one database function with the publishable key. The function
  checks every answer and stores only the answer codes: no department, date or time. The public key
  cannot read anything back.
- **Analysis:** the dashboard signs the researcher in. A server-side function checks the account is on
  the admin list, reads the responses and returns only the aggregated release, built by the same code
  the dashboard and tests use. Individual responses never reach a browser.
- **Anonymity rules** (one implementation, `buildRelease()` in `apps/shared/assessment-model.js`):
  - all responses form one dataset and one map, so there are no subgroups to subtract;
  - nothing is shown for fewer than 10 completed responses, not even the count;
  - each point (space × identity dimension) needs at least 10 comfort answers ("Prefer not to say"
    does not count), or it carries no numbers;
  - the survey never asks anyone's gender, age, religion, ethnicity, social class or department, only
    how comfortable they feel in relation to each identity, so there are no identity groups to
    protect.
- **Demonstration data** is generated in the browser, labelled on every chart and never mixed with
  real results.

Setup steps are in `supabase/README.md`.

## What it needs (nothing has been created yet)

| Item | Why | Cost | Credentials |
| --- | --- | --- | --- |
| Two new GitHub repositories, for example `workplace-relief-map-survey` and `workplace-relief-map-dashboard` | Separate addresses for the survey and the dashboard on GitHub Pages | Free for public repositories | None in the code |
| A Supabase project | Database, sign-in and the results service | Free plan for a pilot (free projects pause when inactive; check current pricing) | Project URL and publishable key (public by design) in each app's `config.js`. The service-role key stays inside Supabase |
| Dashboard accounts | Researchers and administrators who may see results | Included | Created by the project owner in Supabase |
| A data protection decision | Who is responsible, retention period, region and who sees what. Complete the privacy statement | n/a | n/a |

Note: all GitHub Pages sites of one account share the address `https://<account>.github.io`, so the
browser treats them as one site for storage. That is harmless here, because no real responses or
sessions are stored in the browser. Separate custom domains would separate them completely.

## Alternatives

- **An institutional survey platform (for example Qualtrics), with no new backend.** Import
  `apps/analytics/downloads/assessment-qualtrics.txt`, then turn on Force response and Anonymize
  responses, and report results with the platform's own tools, applying the same rules (at least 10
  responses per group, no individual answers). This suits organizations that already have a licence
  and data protection approval for their platform. It avoids a new provider, but this dashboard would
  not be used: it reads results only from the secure results service (or its demonstration data).
- **Another database with an API** (an organization's own PostgreSQL behind an API, Azure or AWS).
  The schema and the results-service logic are plain PostgreSQL and JavaScript, so they can be
  ported. This is more engineering work.
