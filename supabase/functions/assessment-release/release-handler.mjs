// The results service's logic, kept free of Supabase and Deno specifics so it can be tested in Node
// (tools/test_assessment.js). index.ts wires it to Supabase.
//
// What it does, in order:
//   1. no sign-in token            -> 401
//   2. token not valid             -> 401
//   3. account not in the admin list -> 403
//   4. reads every response on the server and returns ONLY the aggregated release built by the shared
//      model (assessment-model.js): one Relief Map, with no numbers until the minimum number of
//      responses is reached and no point with fewer answers than that. No individual response ever
//      leaves the server.

export function corsHeaders(origin, allowedOrigins) {
  const headers = {
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    Vary: 'Origin'
  };
  if (origin && allowedOrigins.includes(origin)) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

export async function handleRelease({ token, model, getUser, isAdmin, fetchRows, pageSize = 1000 }) {
  if (!token) return { status: 401, body: { error: 'Sign in to view results.' } };
  let user = null;
  try { user = await getUser(token); } catch (e) { user = null; }
  if (!user || !user.id) return { status: 401, body: { error: 'Your session has expired or is not valid. Sign in again.' } };

  let allowed = false;
  try { allowed = await isAdmin(user.id); } catch (e) { return { status: 500, body: { error: 'The results service could not check your access. Try again later.' } }; }
  if (!allowed) return { status: 403, body: { error: 'This account is not authorized to view assessment results. Ask the project administrator for access.' } };

  const rows = [];
  try {
    for (let from = 0; ; from += pageSize) {
      const page = await fetchRows(from, from + pageSize - 1);
      rows.push(...page);
      if (page.length < pageSize) break;
    }
  } catch (e) {
    return { status: 500, body: { error: 'The results service could not read the responses. Try again later.' } };
  }
  // Internal identifiers only for the aggregation; they are not part of the release.
  const responses = rows.map((r, i) => ({ id: `S${i + 1}`, answers: r.answers }));
  const release = model.buildRelease(responses, { source: 'live', label: 'Live results' });
  return { status: 200, body: release };
}
