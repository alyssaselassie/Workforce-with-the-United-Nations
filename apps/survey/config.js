// Connection to the secure response database (Supabase). See README.md in this folder.
//
// Leave both values empty to run the assessment in DEMONSTRATION mode: answers are not collected,
// they stay in the participant's browser and are labelled as demonstration data.
//
// supabaseKey is the project's PUBLISHABLE key (called "anon" key in older projects). It is designed
// to be public: with the database schema in supabase/migrations it only allows submitting a complete
// response, never reading one. NEVER put a service-role or secret key here.
window.ASSESSMENT_CONFIG = {
  supabaseUrl: '',
  supabaseKey: ''
};
