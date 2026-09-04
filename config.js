// ============================================================
// Hoxiee — Supabase configuration
//
// 1. Go to your Supabase dashboard → Project Settings → API
// 2. Copy the "Project URL" into url below
// 3. Copy the "anon public" key into anonKey below
// ============================================================

const SUPABASE_CONFIG = {
  url: "https://fjulwtxyryixnmdgmnow.supabase.co",
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqdWx3dHh5cnlpeG5tZGdtbm93Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0NzA5ODcsImV4cCI6MjEwNDA0Njk4N30.K2yrlGHxOVAwlox_hSfTxmOQamjvFcbdLERMDy2NcrQ",
};

// Help AI chat — the Gemini API key lives server-side in the help-ai
// Supabase Edge Function; this is just its public URL.
const HELP_AI_CONFIG = {
  url: "https://fjulwtxyryixnmdgmnow.functions.supabase.co/help-ai",
};