# Secure backend for the Workforce Assessment (Supabase)

The survey application and the analytics dashboard are static websites. To collect real responses
from many people, they need a small backend. This folder holds it, ready to deploy to
[Supabase](https://supabase.com) (managed PostgreSQL with authentication and serverless functions).

**Nothing has been created or connected yet.** Setting it up needs a Supabase account and the
decisions listed under [Before you start](#before-you-start).

## What it does

```
Respondent's browser ──(publishable key)──▶ submit_assessment()  ──▶ assessment_responses table
   (survey app)                              checks every answer       no public read access

Researcher's browser ──sign in──▶ Supabase Auth
   (dashboard)       ──token────▶ assessment-release function ──(server only)──▶ reads responses,
                                   checks assessment_admins                      applies the rules,
                     ◀── aggregated results only (groups of 10 or more) ─────────┘
```

| File | What it is |
| --- | --- |
| `migrations/20261117000000_workforce_assessment.sql` | The database: the responses table (row level security on, no public access), the list of accounts allowed to see results, and `submit_assessment()`, the only way in for respondents. Generated from `apps/shared/assessment-model.js` by `node tools/build_assessment.js` |
| `functions/assessment-release/index.ts` | The results service (an Edge Function). It checks the signed-in user is in `assessment_admins`, reads responses on the server and returns only the aggregated, anonymity-protected release |
| `functions/assessment-release/release-handler.mjs` | The service's logic, tested in `tools/test_assessment.js` |
| `functions/_shared/assessment-model.js` | Generated copy of the shared model, so the server applies exactly the same anonymity rules as the dashboard |

## Security model

- Respondents use the **publishable** key (older projects call it the *anon* key). It is designed to
  be public. With this schema it can only call `submit_assessment()`: it cannot read, change or
  delete any response.
- `submit_assessment()` accepts only a valid department and exactly one valid answer code for each
  of the 34 statements. The database assigns the reporting quarter itself.
- Stored per response: a random ID, the department code, the quarter and the answer codes. No name,
  email, staff ID, IP address, date or time.
- Nobody can read responses through the public API. The results service reads them on the server
  with the service-role key, which Supabase provides to the function automatically. That key must
  never be put in the websites or this repository.
- Results go only to signed-in accounts listed in `assessment_admins`, and only as aggregated groups
  of at least 10 responses, with small groups protected from subtraction. The rules are the same code
  as the dashboard's (`buildRelease()` in the shared model).

These protections are tested: `tools/test_assessment_db.js` runs the schema against a real PostgreSQL
database with Supabase's roles. It checks that respondents can only submit, that 11 kinds of invalid
submission are rejected, and that nothing else is stored.

## Before you start

You need:

1. **A Supabase account and project.** The free plan is enough for a pilot. Free projects pause after
   a period of inactivity, and limits apply. Check current plans and prices at
   [supabase.com/pricing](https://supabase.com/pricing) before relying on it.
2. **A data protection decision.** Choose the project's region. Agree with the organization running
   the assessment who is responsible for the data, how long responses are kept and who may see
   results, then complete the privacy statement in `apps/survey/privacy.html`. For UN entities, follow
   the [UN Personal Data Protection and Privacy Principles](https://unsceb.org/privacy-principles)
   and the entity's own policy, and confirm whether an external provider may hold the data.
3. **The Supabase CLI** to deploy the function ([install guide](https://supabase.com/docs/guides/local-development/cli/getting-started)).

No credentials are needed in this repository. Only the project URL and the publishable key go into
the two websites' `config.js` files.

## Setting it up

1. **Create the project** in the Supabase dashboard.
2. **Create the database.** Open SQL Editor, paste
   `migrations/20261117000000_workforce_assessment.sql` and select Run. With the CLI linked to the
   project, `supabase db push` does the same.
3. **Turn off public sign-ups.** Go to Authentication → Sign In / Providers and turn off "Allow new
   users to sign up". Only accounts you create can sign in.
4. **Create the accounts that may see results.** In Authentication → Users → Add user, enter each
   person's email and a strong password, and confirm the user. Then, in SQL Editor:
   ```sql
   insert into public.assessment_admins (user_id)
   select id from auth.users where email = 'researcher@example.org';
   ```
5. **Deploy the results service** from the repository root:
   ```bash
   supabase login
   supabase link --project-ref <your-project-ref>
   supabase functions deploy assessment-release --no-verify-jwt
   supabase secrets set DASHBOARD_ORIGINS=https://<account>.github.io
   ```
   `--no-verify-jwt` is intended: the function checks each user's token itself, which works with both
   the older and the newer Supabase API keys. `DASHBOARD_ORIGINS` is the dashboard's address without a
   path (for several, separate them with commas).
6. **Connect the websites.** In Project Settings → API Keys, copy the project URL and the publishable
   key into `apps/survey/config.js` and `apps/analytics/config.js`, then deploy both apps. The survey's
   demonstration banner disappears and the dashboard's sign-in turns on.
7. **Test before inviting anyone.** Submit one response, sign in to the dashboard, and check that the
   department says "Results are being collected". Then delete the test row:
   `delete from public.assessment_responses;`

## Limits to know about

- **Repeat submissions.** An anonymous survey cannot stop one person submitting twice. Mitigations,
  none of them built yet: send the link only to the intended group; add a CAPTCHA or rate limit in
  front of `submit_assessment()`; or run the assessment in an institutional survey platform with
  one-time links, such as Qualtrics, and use the dashboard's results-file route.
- **Provider logs.** Like most hosting, Supabase keeps short-lived request logs, which can include IP
  addresses. They are not part of the assessment data, and the privacy statement says so.
- **Custom domains.** If you use a custom domain for Supabase, add it to `connect-src` in the
  Content-Security-Policy meta tag of each page in both apps.
