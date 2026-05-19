/* ENV-DRIVEN FILE - DO NOT COMMIT LIVE TOKENS */

import {
  publicAnonKey as runtimePublicAnonKey,
  supabaseProjectId as runtimeProjectId,
} from '../../src/app/lib/supabase-config';

export const projectId = runtimeProjectId || 'your-project-id';
export const publicAnonKey = runtimePublicAnonKey || 'your-anon-key';
