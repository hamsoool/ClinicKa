const PUBLIC_SUPABASE_CONFIG_ERROR =
  'Missing backend API configuration. Set VITE_API_URL or VITE_SUPABASE_URL in your environment.';

function normalizeBaseUrl(value?: string) {
  const trimmed = String(value || '')
    .trim()
    .replace(/\/+$/, '');

  // When running in a browser:
  // If accessing via ngrok, LAN IP, or Vite proxy (port 5173), route via current origin /api
  // to avoid cross-origin CORS preflight and HTTPS-to-HTTP mixed content blocking.
  if (typeof window !== 'undefined' && window.location) {
    const isTargetLocal = !trimmed || trimmed.includes('localhost') || trimmed.includes('127.0.0.1');
    const isClientOnNgrokOrRemote =
      window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';

    if (isClientOnNgrokOrRemote || (isTargetLocal && window.location.port !== '8000')) {
      return `${window.location.origin}/api`;
    }
  }

  if (!trimmed) {
    return 'http://localhost:8000/api';
  }
  // Ensure the base URL ends with /api if pointing to the Laravel backend
  if (!trimmed.endsWith('/api') && !trimmed.includes('/api/')) {
    return `${trimmed}/api`;
  }
  return trimmed;
}

export const supabaseProjectId = String(import.meta.env.VITE_SUPABASE_PROJECT_ID || 'clinicka-local').trim();

export const supabaseUrl = normalizeBaseUrl(
  import.meta.env.VITE_API_URL ||
    import.meta.env.VITE_BACKEND_URL ||
    import.meta.env.VITE_SUPABASE_URL ||
    'http://localhost:8000/api'
);

export const publicAnonKey = String(
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    'clinicka_anon_key'
).trim();

export const configuredSiteUrl =
  typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin
    : String(import.meta.env.VITE_SITE_URL || 'http://localhost')
        .trim()
        .replace(/\/+$/, '');

export function assertPublicSupabaseConfig() {
  if (!supabaseUrl) {
    throw new Error(PUBLIC_SUPABASE_CONFIG_ERROR);
  }
}

export { PUBLIC_SUPABASE_CONFIG_ERROR };
