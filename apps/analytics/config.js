// Connection to the secure results service. See README.md in this folder.
//
// Leave supabaseUrl and supabaseKey empty and the dashboard offers only the demonstration: sign-in
// is switched off.
//
// supabaseKey is the project's PUBLISHABLE key (called "anon" key in older projects). It is designed
// to be public: it lets an account sign in, and results are only returned to accounts listed in
// assessment_admins. NEVER put a service-role or secret key here.
window.ANALYTICS_CONFIG = {
  supabaseUrl: '',
  supabaseKey: '',
  // The Edge Function that returns aggregated results (supabase/functions/assessment-release).
  resultsFunction: 'assessment-release',
  // Optional: the address of the separate survey application, e.g. 'https://<account>.github.io/un-workforce-assessment/'.
  // Used only for the "Take the demonstration survey" link in demonstration mode.
  surveyUrl: 'https://alyssaselassie.github.io/un-workforce-assessment/'
};
