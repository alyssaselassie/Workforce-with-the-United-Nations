# Workforce Survey: data storage, privacy and live collection

This note explains how the UN Workforce Experience Survey handles data on this website today, what a
static GitHub Pages site cannot do, and the options for collecting real responses from many people.
**Nothing external has been connected.** Each option below needs the team's approval first, together
with the accounts and credentials it lists.

## 1. What the website does today (no backend)

The site is static: GitHub Pages serves files and runs no server code. The dashboard has three data
sources. They are always shown separately, and every chart is labelled with its source.

| Source | Where the data come from | Who can see what |
|---|---|---|
| **Demonstration data** | Synthetic responses generated in the browser from a fixed seed (`demoResponses()` in `workforce-survey/workforce-survey.js`). | Anyone. They are not real results, and differences between entities are random. |
| **This device** | Responses submitted with `workforce-survey/survey.html` **in the same browser**. Each is saved in that browser's local storage (key `un-workforce-survey.responses.v1`). | Only people using that browser on that device. Responses from other people's devices never appear. |
| **Imported file** | A Qualtrics CSV export, or an aggregated results file (JSON) made by this dashboard. Files are read in the browser and never uploaded. | Whoever has the file. |

**Live demo.** Answers given in demo mode (`survey.html?demo=1`, the "Try the live demo" button) are saved in this browser under a separate key (`un-workforce-survey.demo-responses.v1`) and added to the demonstration data only, so presenters can show the dashboard updating. They never mix with real responses.

**This is not an organization-wide database.** The "This device" view is a working local prototype,
for example for one shared device at a workshop. It cannot pool answers from different computers.

### What is stored for each response

| Field | Example | Notes |
|---|---|---|
| `id` | `R-7KQ2M9XWH3TB` | Random anonymous identifier, not derived from the person or device |
| `entity` | `OCHA` | One of 14 codes (DPPA, DPO, OCHA, UNDP, UNICEF, UNHCR, WFP, WHO, DMSPC, DOS, OHCHR, UNWOMEN, OLA, OTHER) |
| `function` | `HUM` | One of 10 professional function codes |
| `period` | `2026-Q4` | Reporting period only; the date and time are not stored |
| `answers` | `{ "PS1": 2, …, "OS5": 98 }` | 34 answer codes: 1–5 in the order shown, 98 = "Don't know or not applicable" |

No name, email, staff ID, duty station, IP address or location is collected. In long form (one row per
answer) each row carries the response ID, entity, function, period, question ID, measurement category
and selected answer (`longRows()`). The codebook (`workforce-survey/workforce-survey-codebook.csv`)
lists every question, code and source.

### Separate datasets

`datasets()` splits the responses into **14 entity datasets** ("DPPA Dataset" … "Other Entities
Dataset") plus a separate **overall dataset**. Entity charts are built only from that entity's dataset,
and function filters apply inside it.

## 2. Anonymity rules

These are implemented in `buildRelease()` and tested in `tools/test_workforce_survey.js` (run
`node tools/test_workforce_survey.js`).

1. **Minimum group size: 10 completed responses** (`CONFIG.minGroupSize`). This applies to every
   reporting group, including filtered ones (entity × function × period). Smaller groups show only:
   *"Results are being collected. Aggregated insights will become available once the minimum response
   threshold has been reached."* The threshold can be raised, but the code will not go below 10.
2. **Secondary suppression.** Within each parent group (all entities, or one entity's functions), the
   hidden groups together must number 0 or at least 10. Otherwise the smallest shown group is also
   withheld, so no small group can be worked out by subtracting the shown groups from the total.
3. **Nested filters.** Function groups are released only inside a released entity. Organization-wide
   results for one function add up entity × function groups that are already shown, so filtering and
   comparing cannot reveal anything new.
4. **One period at a time.** No result covers several periods, so periods cannot be subtracted from
   each other.
5. **Hidden groups carry no numbers**, not even their exact size. Individual answers are never shown or
   exported.
6. **Comparisons** use shown groups only, display sample sizes and 95% confidence intervals, and warn
   when sample sizes or the mix of professional functions differ a lot.

**Important limit.** In this static prototype, the rules decide what the dashboard *shows and exports*.
Whoever holds a raw Qualtrics export, or uses the browser where survey responses were saved, can still
reach individual records: with the browser's developer tools, for example. Real deployments should
apply the same rules on a server that releases only aggregated results (option B below), so dashboard
users never receive individual responses.

### Aggregated results files

**Download → Aggregated results** produces a CSV (one row per group, question and answer) or a JSON
"release". Both contain only shown groups. The JSON file can be loaded into the dashboard ("Import a
file"), so entity focal points can explore their results without any individual answers. The dashboard
refuses a release file made with a threshold below 10, or one containing a group below it.

## 3. Options for real, cross-user collection

### Option A: Qualtrics plus exports (recommended start; no new services)

- **How:** import `workforce-survey/workforce-survey-qualtrics.txt` into Qualtrics (Tools → Import/Export → Import survey). Then:
  - select every question and turn on **Response requirements → Force response** (the TXT format cannot set it);
  - under **Survey options**, turn on **Anonymize responses**, the back button and **Prevent multiple submissions**;
  - in the **Survey flow**, end the survey when CONSENT = "No";
  - in **Look and feel**, add a progress bar.

  For a review screen before submitting, the last page in the file asks people to use the Back button; you can also add a Text/Graphic question with piped text showing each answer.
- **Analysis:** export responses as CSV with numeric values, then load the file on the dashboard ("Import a file"). Share the aggregated JSON or CSV with entities, never the raw export.
- **Needs:** a Qualtrics account (for example an institutional licence), and access-controlled storage for raw exports.
- **Costs:** none beyond the licence. **Credentials:** none in the website.
- **Live?** Updates when someone re-exports (for example weekly).

### Option B: Qualtrics plus a small aggregation service (near-live, still privacy-preserving)

```
Respondents → Qualtrics survey
                 │  (Qualtrics response export API; token kept only on the server)
                 ▼
     Serverless function (for example Cloudflare Workers, Azure Functions or AWS Lambda)
       runs workforce-survey.js → buildRelease()  →  aggregated release JSON only
                 │
                 ▼
     Dashboard (behind sign-in) fetches the release on a schedule and redraws
```

- **Needs:**
  - API access enabled on the Qualtrics account (a brand administrator decides), and an API token stored as a server secret, never in GitHub;
  - a serverless hosting account, with CORS for the dashboard's address;
  - sign-in for dashboard users, for example the organization's single sign-on (Microsoft Entra ID or similar), so only authorized users see results and comparisons;
  - logging, a retention policy and a data-protection review.
- **Costs:** usage at this scale is usually within serverless free tiers, but confirm current pricing. Sign-in services may charge per user.
- **Credentials:** the Qualtrics API token, deployment credentials and an identity-provider app registration, all held outside the repository.

### Option C: Own form endpoint and database (only if Qualtrics is not available)

The survey page would send each response to a serverless endpoint that writes to a database (for
example PostgreSQL), with access rules that stop browsers reading raw responses. A separate function
builds the releases. This needs:

- hosting and database accounts, secrets management and backups;
- protection against repeat or automated submissions without collecting identities (for example one-time survey links);
- a security review and an incident-response plan.

It is the most engineering work and carries the most data-protection responsibility.

## 4. Data-protection checklist

- [ ] Agree the purpose, the retention period and who may see which results; follow the [UN Personal Data Protection and Privacy Principles](https://unsceb.org/privacy-principles) (HLCM, 2018) and your entity's own policy.
- [ ] Turn on "Anonymize responses" in Qualtrics. The dashboard warns if an export contains IP addresses, names or locations.
- [ ] Never commit raw exports or individual responses to this public repository.
- [ ] Share only aggregated release files.
- [ ] Review the minimum group size (10) with your data-protection focal point. Consider a higher threshold where entities are small.
- [ ] Tell respondents, in the survey, how results will be reported (this is in the introduction).
- [ ] Restrict comparisons between entities to authorized users once sign-in exists (option B).
