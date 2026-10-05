import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

let configuredClient: SupabaseClient | null = null;
let configurationError = '';

if (supabaseUrl && supabaseAnonKey) {
  try {
    configuredClient = createClient(supabaseUrl, supabaseAnonKey);
  } catch (error) {
    configurationError = error instanceof Error ? error.message : 'Invalid Supabase configuration.';
  }
} else if (supabaseUrl || supabaseAnonKey) {
  configurationError = 'Both VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be configured.';
}

export const supabaseClient = configuredClient;
export const supabaseConfigurationError = configurationError;
