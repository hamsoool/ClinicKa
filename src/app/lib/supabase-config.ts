const PUBLIC_SUPABASE_CONFIG_ERROR =
  'Missing Supabase config. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (or VITE_SUPABASE_PUBLISHABLE_KEY) in your .env file.';

function normalizeBaseUrl(value?: string) {
  return String(value || '')
    .trim()
    .replace(/\/+$/, '');
}

export const supabaseProjectId = String(import.meta.env.VITE_SUPABASE_PROJECT_ID || '').trim();
export const supabaseUrl = normalizeBaseUrl(import.meta.env.VITE_SUPABASE_URL || '');
export const publicAnonKey = String(
  import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '',
).trim();
export const configuredSiteUrl = normalizeBaseUrl(import.meta.env.VITE_SITE_URL || '');

export function assertPublicSupabaseConfig() {
  if (!supabaseUrl || !publicAnonKey) {
    throw new Error(PUBLIC_SUPABASE_CONFIG_ERROR);
  }
}

export { PUBLIC_SUPABASE_CONFIG_ERROR };
