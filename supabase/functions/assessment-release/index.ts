// Supabase Edge Function: assessment-release
//
// Returns the aggregated, anonymity-protected results of the UN Workforce Inclusion & Psychological
// Safety Assessment to signed-in users listed in public.assessment_admins. Individual responses are
// read here, on the server, and never sent to the browser.
//
// Deploy (Supabase CLI):  supabase functions deploy assessment-release --no-verify-jwt
//   --no-verify-jwt: the function checks the user's token itself (supabase.auth.getUser), which works
//   with both the legacy and the new Supabase API keys.
// Secrets:  supabase secrets set DASHBOARD_ORIGINS=https://<account>.github.io
//   (comma-separated list of the dashboard's origins, for CORS). SUPABASE_URL and
//   SUPABASE_SERVICE_ROLE_KEY are provided by Supabase automatically; the service key never leaves
//   the server and must never be put in the website or the repository.
import { createClient } from 'npm:@supabase/supabase-js@2';
import '../_shared/assessment-model.js';
import { corsHeaders, handleRelease } from './release-handler.mjs';

// deno-lint-ignore no-explicit-any
const model = (globalThis as any).AssessmentModel;
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const serviceKey = Deno.env.get('ASSESSMENT_SERVICE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const allowedOrigins = (Deno.env.get('DASHBOARD_ORIGINS') ?? '').split(',').map((s) => s.trim()).filter(Boolean);

Deno.serve(async (req: Request) => {
  const cors = corsHeaders(req.headers.get('Origin') ?? '', allowedOrigins);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
  if (req.method !== 'GET') return json(405, { error: 'Method not allowed.' });
  if (!supabaseUrl || !serviceKey || !model) return json(500, { error: 'The results service is not configured.' });

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const result = await handleRelease({
    token,
    model,
    getUser: async (t: string) => {
      const { data, error } = await admin.auth.getUser(t);
      return error ? null : data.user;
    },
    isAdmin: async (id: string) => {
      const { data, error } = await admin.from('assessment_admins').select('user_id').eq('user_id', id).maybeSingle();
      if (error) throw error;
      return Boolean(data);
    },
    fetchRows: async (from: number, to: number) => {
      const { data, error } = await admin.from('assessment_responses').select('period, department, answers').order('id').range(from, to);
      if (error) throw error;
      return data ?? [];
    }
  });
  return json(result.status, result.body);
});
