/**
 * Supabase Client Configuration
 * Creates and exports a configured Supabase client instance
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { supabase as supabaseConfig } from '../../config/environment';

// Initialize the Supabase client using the centralized config
// This ensures consistency and proper error handling
const supabaseUrl = supabaseConfig.url;
const supabaseAnonKey = supabaseConfig.anonKey;

// The environment.ts file will have already validated these variables
// But we'll keep this check for additional safety
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase configuration is missing. Authentication and database features will not work.');
}

// createClient() throws on an empty URL, which took down every test that
// imports this module without a .env file (CI has none). Fall back to a
// placeholder so the module can be imported; every real call then fails
// loudly with a network error instead of the whole app failing to mount.
const effectiveUrl = supabaseUrl || 'https://placeholder.supabase.co';
const effectiveKey =
  supabaseAnonKey ||
  'placeholder-anon-key-for-missing-configuration';

export const supabase = createClient<Database>(effectiveUrl, effectiveKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
  }
});

/**
 * Helper function to determine if Supabase is properly configured
 */
export function isSupabaseConfigured(): boolean {
  return !!supabaseUrl && !!supabaseAnonKey;
}

export default supabase;