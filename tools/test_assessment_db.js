#!/usr/bin/env node
// Tests the assessment database schema (supabase/migrations/*_workforce_assessment.sql) against a real
// PostgreSQL database, with Supabase's roles and default privileges recreated:
//   - respondents (anon) can submit a complete, valid response and nothing else;
//   - nobody can read, change or delete responses through the public roles;
//   - incomplete or invalid submissions are rejected;
//   - only the department, the quarter and the answer codes are stored.
//
// Needs psql and a THROWAWAY database (it creates roles, schemas and tables):
//   ASSESSMENT_TEST_DATABASE_URL=postgresql://postgres@localhost:5432/assessment_test node tools/test_assessment_db.js
// Without the variable the test is skipped.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const M = require('../apps/shared/assessment-model.js');

const URL = process.env.ASSESSMENT_TEST_DATABASE_URL;
if (!URL) { console.log('Skipped: set ASSESSMENT_TEST_DATABASE_URL to a throwaway PostgreSQL database to run the database tests.'); process.exit(0); }

const migration = path.join(__dirname, '../supabase/migrations/20261117000000_workforce_assessment.sql');
const valid = Object.fromEntries(M.ITEMS.map((it, i) => [it.id, [1, 2, 3, 4, 5, 98][i % 6]]));
const j = (o) => `'${JSON.stringify(o).replace(/'/g, "''")}'::jsonb`;
const without = (k) => { const o = Object.assign({}, valid); delete o[k]; return o; };
const withVal = (k, v) => Object.assign({}, valid, { [k]: v });

// Each rejected case: [description, department, answers SQL]
const rejected = [
  ['unknown department', "'FINANCE'", j(valid)],
  ['missing department', 'null', j(valid)],
  ['missing answers', "'HR'", 'null'],
  ['answers not an object', "'HR'", "'[1,2,3]'::jsonb"],
  ['one question unanswered', "'HR'", j(without('OS5'))],
  ['an extra, unknown question', "'HR'", j(Object.assign({}, without('OS5'), { XX1: 1 }))],
  ['answer code 0', "'HR'", j(withVal('PS1', 0))],
  ['answer code 6', "'HR'", j(withVal('PS1', 6))],
  ['answer code 1.5', "'HR'", j(withVal('PS1', 1.5))],
  ['answer as text', "'HR'", j(withVal('PS1', '1'))],
  ['answer null', "'HR'", j(withVal('PS1', null))]
];

const sql = `
\\set ON_ERROR_STOP on
set client_min_messages = warning;
-- Supabase's roles, auth schema and default privileges (simplified), so the revokes are tested
-- against the broad grants Supabase gives new public tables and functions.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;
drop schema if exists auth cascade;
drop table if exists public.assessment_responses, public.assessment_admins cascade;
drop function if exists public.submit_assessment(text, jsonb);
create schema auth;
create table auth.users (id uuid primary key);
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;

\\i ${migration}

-- A valid submission from a respondent.
set role anon;
select public.submit_assessment('HR', ${j(valid)});
select public.submit_assessment('OTH', ${j(Object.fromEntries(M.ITEMS.map((it) => [it.id, 98])))});
reset role;

-- Respondents and signed-in users cannot read, insert, change or delete rows directly.
do $$
declare r text; ok boolean;
begin
  foreach r in array array['anon', 'authenticated'] loop
    execute format('set local role %I', r);
    ok := false; begin perform 1 from public.assessment_responses limit 1; exception when insufficient_privilege then ok := true; end;
    if not ok then raise exception 'FAIL: % could read responses', r; end if;
    ok := false; begin insert into public.assessment_responses (period, department, answers) values ('2026-Q4', 'HR', '{}'); exception when insufficient_privilege then ok := true; end;
    if not ok then raise exception 'FAIL: % could insert directly', r; end if;
    ok := false; begin update public.assessment_responses set department = 'IT'; exception when insufficient_privilege then ok := true; end;
    if not ok then raise exception 'FAIL: % could update', r; end if;
    ok := false; begin delete from public.assessment_responses; exception when insufficient_privilege then ok := true; end;
    if not ok then raise exception 'FAIL: % could delete', r; end if;
    ok := false; begin perform 1 from public.assessment_admins limit 1; exception when insufficient_privilege then ok := true; end;
    if not ok then raise exception 'FAIL: % could read the admin list', r; end if;
    reset role;
  end loop;
end $$;

-- Invalid submissions are rejected and save nothing.
do $$
declare ok boolean;
begin
${rejected.map(([name, dep, ans]) => `  ok := false;
  begin set local role anon; perform public.submit_assessment(${dep}, ${ans}); exception when invalid_parameter_value then ok := true; end;
  reset role;
  if not ok then raise exception 'FAIL: accepted %', ${`'${name.replace(/'/g, "''")}'`}; end if;`).join('\n')}
end $$;

-- What was stored: two rows, the current quarter, the department and the answers, nothing else.
do $$
declare n int; cols text;
begin
  select count(*) into n from public.assessment_responses;
  if n <> 2 then raise exception 'FAIL: expected 2 stored responses, found %', n; end if;
  select count(*) into n from public.assessment_responses where period = to_char(timezone('utc', now()), 'YYYY') || '-Q' || to_char(timezone('utc', now()), 'Q');
  if n <> 2 then raise exception 'FAIL: reporting period not assigned by the database'; end if;
  select string_agg(column_name, ',' order by ordinal_position) into cols from information_schema.columns where table_schema = 'public' and table_name = 'assessment_responses';
  if cols <> 'id,period,department,answers' then raise exception 'FAIL: unexpected columns %', cols; end if;
  -- Row level security is on for both tables.
  select count(*) into n from pg_class where relname in ('assessment_responses', 'assessment_admins') and relrowsecurity;
  if n <> 2 then raise exception 'FAIL: row level security is not enabled on both tables'; end if;
end $$;
select 'DB TESTS PASSED' as result;
`;

const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'assessment-db-')), 'test.sql');
fs.writeFileSync(file, sql);
try {
  const out = execFileSync('psql', [URL, '-X', '-q', '-t', '-A', '-f', file], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  if (!/DB TESTS PASSED/.test(out)) { console.error(out); process.exit(1); }
  console.log(`Database tests passed: valid submissions accepted, ${rejected.length} invalid submissions rejected, no public read/write access, only department, quarter and answers stored.`);
} catch (e) {
  console.error(String(e.stderr || e.stdout || e.message));
  process.exit(1);
} finally {
  fs.rmSync(path.dirname(file), { recursive: true, force: true });
}
